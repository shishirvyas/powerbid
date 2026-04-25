/**
 * Demo seed endpoint — for sales demos and first-paying-client onboarding.
 *
 *   POST /api/admin/seed-demo
 *   Header: X-Seed-Key: <env.SEED_KEY>   (or ?key=)
 *
 * Idempotent: safe to call repeatedly. Returns demo credentials and counts.
 */
import { Hono } from "hono";
import { eq, sql } from "drizzle-orm";
import type { AppEnv } from "../../index";
import { getDb } from "../../db/client";
import {
  users,
  customers,
  products,
  brands,
  units,
  gstSlabs,
  inquiries,
  inquiryItems,
  quotations,
  quotationItems,
} from "../../db/schema";
import { hashPassword } from "../../services/crypto";
import { unauthorized } from "../../lib/errors";
import { computeTotals } from "../quotations/quotations.calc";

export const adminRoutes = new Hono<AppEnv>();

adminRoutes.post("/seed-demo", async (c) => {
  const provided = c.req.header("x-seed-key") ?? c.req.query("key") ?? "";
  const expected = c.env.SEED_KEY ?? "powerbid-demo";
  if (provided !== expected) throw unauthorized("Invalid seed key");

  const db = getDb(c.env.DB);

  /* ------------------------------ users -------------------------------- */
  const demoPassword = "demo1234";
  const demoUsers = [
    { email: "admin@powerbid.dev", name: "Demo Admin", role: "admin" as const },
    { email: "sales@powerbid.dev", name: "Priya Sharma", role: "sales" as const },
    { email: "viewer@powerbid.dev", name: "Demo Viewer", role: "viewer" as const },
  ];
  for (const u of demoUsers) {
    const existing = await db.query.users.findFirst({ where: eq(users.email, u.email) });
    if (!existing) {
      await db.insert(users).values({ ...u, passwordHash: await hashPassword(demoPassword) });
    }
  }
  const adminUser = await db.query.users.findFirst({ where: eq(users.email, "admin@powerbid.dev") });
  const adminId = adminUser?.id ?? null;

  /* --------------------------- masters seed ---------------------------- */
  const brandSeeds = ["Polycab", "Havells", "Finolex", "Anchor by Panasonic", "Legrand", "Schneider"];
  for (const name of brandSeeds) {
    await db.insert(brands).values({ name }).onConflictDoNothing();
  }
  const unitSeeds = [
    { code: "NOS", name: "Numbers" },
    { code: "MTR", name: "Meter" },
    { code: "BOX", name: "Box" },
    { code: "COIL", name: "Coil" },
    { code: "KG", name: "Kilogram" },
    { code: "SET", name: "Set" },
  ];
  for (const u of unitSeeds) {
    await db.insert(units).values(u).onConflictDoNothing();
  }
  const gstSeeds = [
    { name: "GST 0", rate: 0 },
    { name: "GST 5", rate: 5 },
    { name: "GST 12", rate: 12 },
    { name: "GST 18", rate: 18 },
    { name: "GST 28", rate: 28 },
  ];
  for (const g of gstSeeds) {
    await db.insert(gstSlabs).values(g).onConflictDoNothing();
  }

  /* --------------------------- products -------------------------------- */
  const productSeeds = [
    { sku: "WIRE-2.5-90M-RED",  name: "1100V FR PVC Wire 2.5 sqmm",        unitName: "COIL", basePrice: 2150,  gstRate: 18, brand: "Polycab" },
    { sku: "WIRE-1.5-90M-RED",  name: "1100V FR PVC Wire 1.5 sqmm",        unitName: "COIL", basePrice: 1450,  gstRate: 18, brand: "Polycab" },
    { sku: "WIRE-4.0-90M-RED",  name: "1100V FR PVC Wire 4.0 sqmm",        unitName: "COIL", basePrice: 3450,  gstRate: 18, brand: "Polycab" },
    { sku: "MCB-32A-SP",        name: "MCB 32A SP C-Curve",                unitName: "NOS",  basePrice: 320,   gstRate: 18, brand: "Havells" },
    { sku: "MCB-63A-TP",        name: "MCB 63A TP C-Curve",                unitName: "NOS",  basePrice: 980,   gstRate: 18, brand: "Havells" },
    { sku: "RCCB-40A-30MA",     name: "RCCB 40A 30mA 4-pole",              unitName: "NOS",  basePrice: 2150,  gstRate: 18, brand: "Schneider" },
    { sku: "DB-12W-DD",         name: "Distribution Board 12-Way Double Door", unitName: "NOS", basePrice: 4250, gstRate: 18, brand: "Legrand" },
    { sku: "SOCKET-16A-MOD",    name: "16A 3-Pin Modular Socket",          unitName: "NOS",  basePrice: 145,   gstRate: 18, brand: "Anchor by Panasonic" },
    { sku: "SWITCH-1WAY-MOD",   name: "1-Way 6A Modular Switch",           unitName: "NOS",  basePrice: 65,    gstRate: 18, brand: "Anchor by Panasonic" },
    { sku: "PIPE-PVC-25-MED",   name: "PVC Conduit Pipe 25mm Medium",      unitName: "MTR",  basePrice: 38,    gstRate: 18, brand: "Finolex" },
    { sku: "JBOX-ROUND-3M",     name: "Round Junction Box 3-Module",       unitName: "NOS",  basePrice: 22,    gstRate: 18, brand: "Anchor by Panasonic" },
    { sku: "LED-15W-CW",        name: "LED Bulb 15W Cool White B22",       unitName: "NOS",  basePrice: 165,   gstRate: 12, brand: "Havells" },
  ];
  const unitMap = new Map<string, number>();
  for (const u of await db.select().from(units)) unitMap.set(u.code, u.id);
  const brandMap = new Map<string, number>();
  for (const b of await db.select().from(brands)) brandMap.set(b.name, b.id);
  const gstMap = new Map<number, number>();
  for (const g of await db.select().from(gstSlabs)) gstMap.set(g.rate, g.id);

  for (const p of productSeeds) {
    const existing = await db.query.products.findFirst({ where: eq(products.sku, p.sku) });
    if (existing) continue;
    await db.insert(products).values({
      sku: p.sku,
      name: p.name,
      basePrice: p.basePrice,
      unitId: unitMap.get(p.unitName) ?? null,
      brandId: brandMap.get(p.brand) ?? null,
      gstSlabId: gstMap.get(p.gstRate) ?? null,
    });
  }

  /* --------------------------- customers ------------------------------- */
  const customerSeeds = [
    {
      code: "CUST-001",
      name: "Bharat Heavy Electricals Ltd",
      contactPerson: "Rajesh Kumar",
      email: "rajesh.kumar@bhel-demo.in",
      phone: "+91 98765 43210",
      gstin: "29AABCB1234M1Z5",
      addressLine1: "Plot 32, Industrial Area Phase II",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560058",
    },
    {
      code: "CUST-002",
      name: "Tata Projects Ltd",
      contactPerson: "Anita Desai",
      email: "anita.desai@tataproj-demo.in",
      phone: "+91 98200 11223",
      gstin: "27AAACT2727Q1Z6",
      addressLine1: "Mithona Towers, Banjara Hills",
      city: "Hyderabad",
      state: "Telangana",
      pincode: "500034",
    },
    {
      code: "CUST-003",
      name: "L&T Construction",
      contactPerson: "Vikram Iyer",
      email: "vikram.iyer@lnt-demo.in",
      phone: "+91 99876 65432",
      gstin: "33AAACL0140P1ZK",
      addressLine1: "Mount Poonamallee Road",
      city: "Chennai",
      state: "Tamil Nadu",
      pincode: "600089",
    },
    {
      code: "CUST-004",
      name: "Godrej & Boyce Mfg",
      contactPerson: "Sneha Patil",
      email: "sneha.patil@godrej-demo.in",
      phone: "+91 91234 50000",
      gstin: "27AAACG3582M1Z2",
      addressLine1: "Pirojshanagar, Vikhroli (W)",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400079",
    },
    {
      code: "CUST-005",
      name: "Adani Power Ltd",
      contactPerson: "Mehul Shah",
      email: "mehul.shah@adanipw-demo.in",
      phone: "+91 90990 90909",
      gstin: "24AAFCA9072G1Z8",
      addressLine1: "Adani House, Mithakhali Six Roads",
      city: "Ahmedabad",
      state: "Gujarat",
      pincode: "380009",
    },
  ];
  for (const cust of customerSeeds) {
    const existing = await db.query.customers.findFirst({ where: eq(customers.code, cust.code) });
    if (existing) continue;
    await db.insert(customers).values(cust);
  }

  /* --------------------------- inquiries + quotations ------------------ */
  // Generate a small but realistic pipeline. Idempotent by quotationNo prefix DEMO-.
  const allCustomers = await db.select().from(customers);
  const allProducts = await db.select().from(products);
  const existingDemoQ = await db
    .select({ count: sql<number>`count(*)` })
    .from(quotations)
    .where(sql`${quotations.quotationNo} LIKE 'DEMO-%'`);
  if ((existingDemoQ[0]?.count ?? 0) === 0 && allCustomers.length && allProducts.length) {
    const today = new Date();
    const isoDate = (offsetDays: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() + offsetDays);
      return d.toISOString().slice(0, 10);
    };

    const scenarios: Array<{
      no: string;
      customerIdx: number;
      productIdxs: number[];
      qtys: number[];
      status: "draft" | "final" | "sent" | "won" | "lost";
      dateOffset: number;
    }> = [
      { no: "DEMO-001", customerIdx: 0, productIdxs: [0, 3, 6], qtys: [10, 25, 4], status: "won",   dateOffset: -28 },
      { no: "DEMO-002", customerIdx: 1, productIdxs: [1, 7, 8], qtys: [15, 50, 80], status: "sent",  dateOffset: -10 },
      { no: "DEMO-003", customerIdx: 2, productIdxs: [2, 4, 5], qtys: [8, 6, 3],   status: "final", dateOffset: -3 },
      { no: "DEMO-004", customerIdx: 3, productIdxs: [9, 10],   qtys: [200, 60],   status: "lost",  dateOffset: -45 },
      { no: "DEMO-005", customerIdx: 4, productIdxs: [0, 1, 11], qtys: [20, 15, 100], status: "draft", dateOffset: -1 },
      { no: "DEMO-006", customerIdx: 0, productIdxs: [3, 4, 5, 6], qtys: [40, 12, 8, 2], status: "sent",  dateOffset: -7 },
    ];

    for (const sc of scenarios) {
      const cust = allCustomers[sc.customerIdx % allCustomers.length];
      if (!cust) continue;
      const draftItems = sc.productIdxs.map((pi, idx) => {
        const p = allProducts[pi % allProducts.length];
        return {
          productId: p.id,
          productName: p.name,
          unitName: null,
          qty: sc.qtys[idx],
          unitPrice: p.basePrice,
          discountPercent: idx === 0 ? 5 : 0,
          gstRate: 18,
        };
      });
      const totals = computeTotals({
        items: draftItems,
        discountType: "percent",
        discountValue: 0,
        freightAmount: 0,
      });
      const [head] = await db
        .insert(quotations)
        .values({
          quotationNo: sc.no,
          quotationDate: isoDate(sc.dateOffset),
          validityDays: 15,
          customerId: cust.id,
          status: sc.status,
          subtotal: totals.totals.subtotal,
          discountType: "percent",
          discountValue: 0,
          discountAmount: totals.totals.discountAmount,
          taxableAmount: totals.totals.taxableAmount,
          gstAmount: totals.totals.gstAmount,
          freightAmount: 0,
          grandTotal: totals.totals.grandTotal,
          termsConditions:
            "1. Prices are inclusive of standard packaging.\n2. Delivery: Ex-works our warehouse.\n3. Validity as stated above.",
          paymentTerms: "50% advance with PO; balance 50% before dispatch.",
          deliverySchedule: "4-6 weeks ex-works after receipt of confirmed Purchase Order.",
          notes: sc.status === "won" ? "Order received via PO #PUR-2026-0142" : null,
          sentAt: ["sent", "won", "lost"].includes(sc.status) ? isoDate(sc.dateOffset + 1) : null,
          closedAt: sc.status === "won" || sc.status === "lost" ? isoDate(sc.dateOffset + 14) : null,
          createdBy: adminId,
          updatedBy: adminId,
        })
        .returning();
      await db.insert(quotationItems).values(
        draftItems.map((it, idx) => ({
          quotationId: head.id,
          productId: it.productId ?? null,
          productName: it.productName,
          unitName: null,
          qty: it.qty,
          unitPrice: it.unitPrice,
          discountPercent: it.discountPercent,
          gstRate: it.gstRate,
          lineSubtotal: totals.items[idx].lineSubtotal,
          lineGst: totals.items[idx].lineGst,
          lineTotal: totals.items[idx].lineTotal,
          sortOrder: idx,
        })),
      );
    }
  }

  /* --------------------------- inquiries seed -------------------------- */
  const existingDemoI = await db
    .select({ count: sql<number>`count(*)` })
    .from(inquiries)
    .where(sql`${inquiries.inquiryNo} LIKE 'INQ-DEMO-%'`);
  if ((existingDemoI[0]?.count ?? 0) === 0 && allCustomers.length) {
    const inqSeeds = [
      { no: "INQ-DEMO-001", customerIdx: 1, source: "email" as const, priority: "high" as const, status: "new" as const, requirement: "Need quote for site electrification — Phase 1 of new factory at Pune. Approx 200 points." },
      { no: "INQ-DEMO-002", customerIdx: 4, source: "phone" as const, priority: "urgent" as const, status: "in_progress" as const, requirement: "Replacement DBs and MCBs for 2 floors. Site visit tomorrow." },
      { no: "INQ-DEMO-003", customerIdx: 3, source: "walkin" as const, priority: "medium" as const, status: "quoted" as const, requirement: "LED retrofit for warehouse. ~500 fittings." },
    ];
    for (const inq of inqSeeds) {
      const cust = allCustomers[inq.customerIdx % allCustomers.length];
      if (!cust) continue;
      const [created] = await db
        .insert(inquiries)
        .values({
          inquiryNo: inq.no,
          customerId: cust.id,
          customerName: cust.name,
          source: inq.source,
          priority: inq.priority,
          status: inq.status,
          requirement: inq.requirement,
          assignedTo: adminId,
        })
        .returning();
      await db.insert(inquiryItems).values([
        { inquiryId: created.id, productId: allProducts[0]?.id ?? null, productName: allProducts[0]?.name ?? "TBD", qty: 5, remarks: null },
        { inquiryId: created.id, productId: allProducts[3]?.id ?? null, productName: allProducts[3]?.name ?? "TBD", qty: 10, remarks: null },
      ]);
    }
  }

  /* --------------------------- summary --------------------------------- */
  const counts = {
    users: (await db.select({ c: sql<number>`count(*)` }).from(users))[0]?.c ?? 0,
    customers: (await db.select({ c: sql<number>`count(*)` }).from(customers))[0]?.c ?? 0,
    products: (await db.select({ c: sql<number>`count(*)` }).from(products))[0]?.c ?? 0,
    inquiries: (await db.select({ c: sql<number>`count(*)` }).from(inquiries))[0]?.c ?? 0,
    quotations: (await db.select({ c: sql<number>`count(*)` }).from(quotations))[0]?.c ?? 0,
  };

  return c.json({
    ok: true,
    credentials: {
      admin: { email: "admin@powerbid.dev", password: demoPassword },
      sales: { email: "sales@powerbid.dev", password: demoPassword },
      viewer: { email: "viewer@powerbid.dev", password: demoPassword },
    },
    counts,
  });
});
