import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  users,
  brands,
  units,
  gstSlabs,
  customers,
  customerContacts,
  products,
  inquiries,
  inquiryItems,
  quotations,
  quotationItems,
} from "@/lib/db/schema";
import { hashPassword } from "@/lib/crypto";
import { DEMO_USERS } from "@/lib/branding";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  const expected = process.env.SEED_KEY;
  if (!expected) {
    return NextResponse.json({ error: "SEED_KEY not configured" }, { status: 500 });
  }
  const provided = req.headers.get("x-seed-key");
  if (provided !== expected) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Wipe in dependency order.
  await db.execute(sql`
    TRUNCATE TABLE
      quotation_items, quotations,
      inquiry_items, inquiries,
      customer_contacts, customers,
      products,
      gst_slabs, units, brands,
      notes, audit_log,
      users
    RESTART IDENTITY CASCADE
  `);

  // ---- users ----
  const passwordHash = await hashPassword("demo1234");
  const insertedUsers = await db
    .insert(users)
    .values([
      { email: DEMO_USERS.admin, name: "Demo Admin", role: "admin", passwordHash },
      { email: DEMO_USERS.sales, name: "Demo Sales", role: "sales", passwordHash },
      { email: DEMO_USERS.viewer, name: "Demo Viewer", role: "viewer", passwordHash },
    ])
    .returning();
  const admin = insertedUsers[0];
  const sales = insertedUsers[1];

  // ---- masters ----
  const insertedBrands = await db
    .insert(brands)
    .values([
      { name: "Siemens" },
      { name: "Schneider" },
      { name: "ABB" },
      { name: "Legrand" },
      { name: "Havells" },
      { name: "Polycab" },
    ])
    .returning();

  const insertedUnits = await db
    .insert(units)
    .values([
      { code: "PCS", name: "Pieces" },
      { code: "MTR", name: "Meter" },
      { code: "KG", name: "Kilogram" },
      { code: "BOX", name: "Box" },
      { code: "SET", name: "Set" },
      { code: "ROL", name: "Roll" },
    ])
    .returning();

  const insertedGst = await db
    .insert(gstSlabs)
    .values([
      { name: "Nil", rate: "0" },
      { name: "5%", rate: "5" },
      { name: "12%", rate: "12" },
      { name: "18%", rate: "18" },
      { name: "28%", rate: "28" },
    ])
    .returning();

  const gst18 = insertedGst.find((g) => g.name === "18%")!;
  const gst28 = insertedGst.find((g) => g.name === "28%")!;

  // ---- products ----
  const insertedProducts = await db
    .insert(products)
    .values([
      { sku: "MCB-C32", name: "MCB 32A C-Curve", brandId: insertedBrands[0].id, unitId: insertedUnits[0].id, gstSlabId: gst18.id, basePrice: "320" },
      { sku: "MCB-C16", name: "MCB 16A C-Curve", brandId: insertedBrands[1].id, unitId: insertedUnits[0].id, gstSlabId: gst18.id, basePrice: "240" },
      { sku: "RCCB-40A", name: "RCCB 40A 30mA", brandId: insertedBrands[2].id, unitId: insertedUnits[0].id, gstSlabId: gst18.id, basePrice: "1850" },
      { sku: "CON-9A", name: "Contactor 9A", brandId: insertedBrands[0].id, unitId: insertedUnits[0].id, gstSlabId: gst18.id, basePrice: "1200" },
      { sku: "CON-25A", name: "Contactor 25A", brandId: insertedBrands[2].id, unitId: insertedUnits[0].id, gstSlabId: gst18.id, basePrice: "2400" },
      { sku: "DB-8W", name: "Distribution Board 8 Way", brandId: insertedBrands[3].id, unitId: insertedUnits[0].id, gstSlabId: gst18.id, basePrice: "1450" },
      { sku: "SW-16A", name: "Modular Switch 16A", brandId: insertedBrands[3].id, unitId: insertedUnits[0].id, gstSlabId: gst18.id, basePrice: "120" },
      { sku: "WIRE-2.5", name: "Copper Wire 2.5 sqmm", brandId: insertedBrands[5].id, unitId: insertedUnits[5].id, gstSlabId: gst18.id, basePrice: "2800" },
      { sku: "WIRE-4.0", name: "Copper Wire 4.0 sqmm", brandId: insertedBrands[5].id, unitId: insertedUnits[5].id, gstSlabId: gst18.id, basePrice: "4400" },
      { sku: "CABLE-3C", name: "3C Armoured Cable 4 sqmm", brandId: insertedBrands[5].id, unitId: insertedUnits[1].id, gstSlabId: gst18.id, basePrice: "180" },
      { sku: "LED-18W", name: "LED Panel 18W", brandId: insertedBrands[4].id, unitId: insertedUnits[0].id, gstSlabId: gst18.id, basePrice: "650" },
      { sku: "FAN-CEIL", name: "Ceiling Fan 1200mm", brandId: insertedBrands[4].id, unitId: insertedUnits[0].id, gstSlabId: gst28.id, basePrice: "2200" },
    ])
    .returning();

  // ---- customers ----
  const insertedCustomers = await db
    .insert(customers)
    .values([
      { code: "CUST-001", name: "Sterling Electricals Pvt Ltd", contactPerson: "Rohan Mehta", email: "rohan@sterling.in", phone: "+91 98200 11111", gstin: "27ABCDE1234F1Z5", city: "Mumbai", state: "Maharashtra", pincode: "400001" },
      { code: "CUST-002", name: "Crescent Power Solutions", contactPerson: "Priya Sharma", email: "priya@crescent.in", phone: "+91 98200 22222", gstin: "27ABCDE1234F1Z6", city: "Pune", state: "Maharashtra", pincode: "411001" },
      { code: "CUST-003", name: "Veer Industries", contactPerson: "Anil Kapoor", email: "anil@veer.in", phone: "+91 98200 33333", city: "Ahmedabad", state: "Gujarat", pincode: "380001" },
      { code: "CUST-004", name: "Northstar Switchgear", contactPerson: "Sunita Rao", email: "sunita@northstar.in", phone: "+91 98200 44444", city: "Delhi", state: "Delhi", pincode: "110001" },
      { code: "CUST-005", name: "Apex Builders", contactPerson: "Vikram Singh", email: "vikram@apex.in", phone: "+91 98200 55555", city: "Bengaluru", state: "Karnataka", pincode: "560001" },
    ])
    .returning();

  // primary contacts
  await db.insert(customerContacts).values(
    insertedCustomers.map((c) => ({
      customerId: c.id,
      name: c.contactPerson || c.name,
      email: c.email || null,
      phone: c.phone || null,
      isPrimary: true,
    })),
  );

  // ---- inquiries ----
  const insertedInquiries = await db
    .insert(inquiries)
    .values([
      { inquiryNo: "INQ-2025-0001", customerId: insertedCustomers[0].id, customerName: insertedCustomers[0].name, source: "phone", priority: "high", status: "in_progress", requirement: "Need MCBs and DBs for residential project", assignedTo: sales.id },
      { inquiryNo: "INQ-2025-0002", customerId: insertedCustomers[2].id, customerName: insertedCustomers[2].name, source: "email", priority: "medium", status: "quoted", requirement: "Cable and wire requirement for warehouse", assignedTo: sales.id },
      { inquiryNo: "INQ-2025-0003", customerId: insertedCustomers[4].id, customerName: insertedCustomers[4].name, source: "walkin", priority: "urgent", status: "new", requirement: "Bulk fans and LED panels", assignedTo: admin.id },
    ])
    .returning();

  await db.insert(inquiryItems).values([
    { inquiryId: insertedInquiries[0].id, productId: insertedProducts[0].id, productName: insertedProducts[0].name, qty: "50" },
    { inquiryId: insertedInquiries[0].id, productId: insertedProducts[5].id, productName: insertedProducts[5].name, qty: "10" },
    { inquiryId: insertedInquiries[1].id, productId: insertedProducts[7].id, productName: insertedProducts[7].name, qty: "20" },
    { inquiryId: insertedInquiries[2].id, productId: insertedProducts[10].id, productName: insertedProducts[10].name, qty: "60" },
    { inquiryId: insertedInquiries[2].id, productId: insertedProducts[11].id, productName: insertedProducts[11].name, qty: "30" },
  ]);

  // ---- quotations ----
  const today = new Date().toISOString().slice(0, 10);
  function calc<T extends { qty: number; price: number; gstRate: number; discPct?: number }>(
    items: T[],
  ) {
    let subtotal = 0;
    let gstAmount = 0;
    const lines = items.map((it) => {
      const gross = it.qty * it.price;
      const disc = (gross * (it.discPct ?? 0)) / 100;
      const lineSubtotal = gross - disc;
      const lineGst = (lineSubtotal * it.gstRate) / 100;
      subtotal += lineSubtotal;
      gstAmount += lineGst;
      return {
        ...it,
        discPct: it.discPct ?? 0,
        lineSubtotal,
        lineGst,
        lineTotal: lineSubtotal + lineGst,
      };
    });
    return { subtotal, gstAmount, grandTotal: subtotal + gstAmount, lines };
  }

  const quoteSeeds = [
    { custIdx: 0, status: "sent", items: [
      { pIdx: 0, qty: 50, price: 320, discPct: 5 },
      { pIdx: 5, qty: 10, price: 1450, discPct: 0 },
    ]},
    { custIdx: 1, status: "won", items: [
      { pIdx: 2, qty: 8, price: 1850, discPct: 3 },
      { pIdx: 6, qty: 40, price: 120, discPct: 0 },
    ]},
    { custIdx: 2, status: "won", items: [
      { pIdx: 7, qty: 15, price: 2800, discPct: 0 },
      { pIdx: 9, qty: 200, price: 180, discPct: 2 },
    ]},
    { custIdx: 3, status: "draft", items: [
      { pIdx: 1, qty: 30, price: 240 },
      { pIdx: 3, qty: 20, price: 1200 },
    ]},
    { custIdx: 4, status: "sent", items: [
      { pIdx: 10, qty: 60, price: 650, discPct: 5 },
      { pIdx: 11, qty: 30, price: 2200, discPct: 0 },
    ]},
    { custIdx: 0, status: "lost", items: [
      { pIdx: 4, qty: 5, price: 2400 },
    ]},
  ];

  for (let i = 0; i < quoteSeeds.length; i++) {
    const q = quoteSeeds[i];
    const lines = q.items.map((it) => ({
      product: insertedProducts[it.pIdx],
      qty: it.qty,
      price: it.price,
      gstRate: 18,
      discPct: "discPct" in it ? it.discPct : 0,
    }));
    const calced = calc(lines);
    const [inserted] = await db
      .insert(quotations)
      .values({
        quotationNo: `QT-2025-${String(i + 1).padStart(4, "0")}`,
        quotationDate: today,
        validityDays: 15,
        customerId: insertedCustomers[q.custIdx].id,
        status: q.status,
        currency: "INR",
        subtotal: calced.subtotal.toFixed(2),
        discountType: "percent",
        discountValue: "0",
        discountAmount: "0",
        taxableAmount: calced.subtotal.toFixed(2),
        gstAmount: calced.gstAmount.toFixed(2),
        freightAmount: "0",
        grandTotal: calced.grandTotal.toFixed(2),
        termsConditions: "Payment within 30 days. Delivery ex-warehouse.",
        paymentTerms: "30 days",
        deliverySchedule: "2-3 weeks",
        createdBy: sales.id,
      })
      .returning();

    await db.insert(quotationItems).values(
      calced.lines.map((ln, idx) => ({
        quotationId: inserted.id,
        productId: ln.product.id,
        productName: ln.product.name,
        qty: ln.qty.toString(),
        unitPrice: ln.price.toFixed(2),
        discountPercent: ln.discPct.toFixed(2),
        gstRate: ln.gstRate.toFixed(2),
        lineSubtotal: ln.lineSubtotal.toFixed(2),
        lineGst: ln.lineGst.toFixed(2),
        lineTotal: ln.lineTotal.toFixed(2),
        sortOrder: idx,
      })),
    );
  }

  return NextResponse.json({
    ok: true,
    summary: {
      users: insertedUsers.length,
      brands: insertedBrands.length,
      units: insertedUnits.length,
      gstSlabs: insertedGst.length,
      products: insertedProducts.length,
      customers: insertedCustomers.length,
      inquiries: insertedInquiries.length,
      quotations: quoteSeeds.length,
    },
    credentials: {
      admin: `${DEMO_USERS.admin} / demo1234`,
      sales: `${DEMO_USERS.sales} / demo1234`,
      viewer: `${DEMO_USERS.viewer} / demo1234`,
    },
  });
}
