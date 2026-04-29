import { NextRequest } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  supplierAddresses,
  supplierBankDetails,
  supplierContacts,
  suppliers,
} from "@/lib/db/schema";
import {
  ApiError,
  errorToResponse,
  jsonOk,
  parseId,
  parseJson,
  requireSession,
} from "@/lib/api";
import { supplierProfileSchema } from "@/lib/schemas";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireSession();
    const id = parseId((await ctx.params).id);

    const [supplier] = await db
      .select({
        id: suppliers.id,
        code: suppliers.code,
        companyName: suppliers.companyName,
        gstin: suppliers.gstin,
        pan: suppliers.pan,
        msmeStatus: suppliers.msmeStatus,
        paymentTerms: suppliers.paymentTerms,
        email: suppliers.email,
        phone: suppliers.phone,
        rating: suppliers.rating,
        isActive: suppliers.isActive,
        createdAt: suppliers.createdAt,
        updatedAt: suppliers.updatedAt,
      })
      .from(suppliers)
      .where(eq(suppliers.id, id));

    if (!supplier) throw new ApiError(404, "Supplier not found");

    const contacts = await db
      .select()
      .from(supplierContacts)
      .where(eq(supplierContacts.supplierId, id))
      .orderBy(desc(supplierContacts.isPrimary), supplierContacts.id);

    const addresses = await db
      .select()
      .from(supplierAddresses)
      .where(eq(supplierAddresses.supplierId, id))
      .orderBy(desc(supplierAddresses.isDefault), supplierAddresses.id);

    const bankDetails = await db
      .select()
      .from(supplierBankDetails)
      .where(eq(supplierBankDetails.supplierId, id))
      .orderBy(desc(supplierBankDetails.isPrimary), supplierBankDetails.id);

    const [stats] = await db.execute<{
      totalOrders: number;
      totalPurchase: number;
      outstandingPayable: number;
      openOrders: number;
    }>(sql`
      select
        count(*)::int as "totalOrders",
        coalesce(sum(po.grand_total), 0)::float8 as "totalPurchase",
        coalesce(sum(case when po.status not in ('closed', 'cancelled') then po.grand_total else 0 end), 0)::float8 as "outstandingPayable",
        coalesce(sum(case when po.status not in ('closed', 'cancelled') then 1 else 0 end), 0)::int as "openOrders"
      from purchase_orders po
      where po.supplier_id = ${id}
    `);

    const purchaseHistory = await db.execute<{
      id: number;
      poNumber: string;
      status: string;
      expectedDate: string | null;
      amount: number;
      createdAt: string;
    }>(sql`
      select
        po.id,
        po.po_number as "poNumber",
        po.status,
        po.expected_date as "expectedDate",
        po.grand_total::float8 as amount,
        po.created_at::text as "createdAt"
      from purchase_orders po
      where po.supplier_id = ${id}
      order by po.created_at desc
      limit 100
    `);

    const ledger = Array.from(purchaseHistory).map((row) => ({
      date: row.createdAt,
      reference: row.poNumber,
      entryType: "purchase_order",
      status: row.status,
      debit: row.amount,
      credit: 0,
      balanceImpact: row.amount,
    }));

    return jsonOk({
      supplier,
      contacts,
      addresses,
      bankDetails,
      stats: stats ?? {
        totalOrders: 0,
        totalPurchase: 0,
        outstandingPayable: 0,
        openOrders: 0,
      },
      purchaseHistory: Array.from(purchaseHistory),
      ledger,
    });
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    await requireSession();
    const id = parseId((await ctx.params).id);
    const data = await parseJson(req, supplierProfileSchema);

    const [existing] = await db
      .select({ id: suppliers.id, code: suppliers.code })
      .from(suppliers)
      .where(eq(suppliers.id, id))
      .limit(1);
    if (!existing) throw new ApiError(404, "Supplier not found");

    const [supplier] = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(suppliers)
        .set({
          code: data.code ?? existing.code,
          companyName: data.companyName,
          gstin: data.gstin,
          pan: data.pan,
          msmeStatus: data.msmeStatus,
          paymentTerms: data.paymentTerms,
          email: data.email,
          phone: data.phone,
          rating: data.rating == null ? null : String(data.rating),
          isActive: data.isActive,
          updatedAt: new Date(),
        })
        .where(eq(suppliers.id, id))
        .returning();

      await tx.delete(supplierContacts).where(eq(supplierContacts.supplierId, id));
      await tx.delete(supplierAddresses).where(eq(supplierAddresses.supplierId, id));
      await tx.delete(supplierBankDetails).where(eq(supplierBankDetails.supplierId, id));

      if (data.contacts.length) {
        await tx.insert(supplierContacts).values(
          data.contacts.map((c) => ({
            supplierId: id,
            name: c.name,
            designation: c.designation,
            email: c.email,
            phone: c.phone,
            isPrimary: c.isPrimary,
            isActive: c.isActive,
          }))
        );
      }

      if (data.addresses.length) {
        await tx.insert(supplierAddresses).values(
          data.addresses.map((a) => ({
            supplierId: id,
            type: a.type,
            addressLine1: a.addressLine1,
            addressLine2: a.addressLine2,
            city: a.city,
            state: a.state,
            pincode: a.pincode,
            country: a.country,
            isDefault: a.isDefault,
          }))
        );
      }

      if (data.bankDetails.length) {
        await tx.insert(supplierBankDetails).values(
          data.bankDetails.map((b) => ({
            supplierId: id,
            accountName: b.accountName,
            accountNumber: b.accountNumber,
            bankName: b.bankName,
            branchName: b.branchName,
            ifscCode: b.ifscCode,
            swiftCode: b.swiftCode,
            isPrimary: b.isPrimary,
          }))
        );
      }

      return [updated];
    });

    return jsonOk(supplier);
  } catch (err) {
    return errorToResponse(err);
  }
}
