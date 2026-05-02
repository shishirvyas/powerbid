import { and, eq, ilike, sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { bomItems, bomMaster, products, purchaseOrderItems, purchaseOrders, supplierProducts } from "@/lib/db/schema";
import { ApiError, errorToResponse, jsonOk, parseJson, requireSession } from "@/lib/api";
import { calcPurchaseOrder } from "@/lib/calc";

export const runtime = "nodejs";

const generateSchema = z.object({
  bomId: z.coerce.number().int().positive(),
});

async function nextPoNumber() {
  const year = new Date().getFullYear();
  const prefix = `PO-${year}-`;
  const rows = await db
    .select({ max: sql<string | null>`max(${purchaseOrders.poNumber})` })
    .from(purchaseOrders)
    .where(ilike(purchaseOrders.poNumber, `${prefix}%`));
  const max = rows[0]?.max ?? null;
  const last = max ? Number(max.slice(prefix.length)) : 0;
  const next = String((Number.isFinite(last) ? last : 0) + 1).padStart(4, "0");
  return `${prefix}${next}`;
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    if (session.role === "viewer") throw new ApiError(403, "Only sales/admin users can generate purchase orders");

    const data = await parseJson(req, generateSchema);

    const [existingOpen] = await db
      .select({ id: purchaseOrders.id, poNumber: purchaseOrders.poNumber, status: purchaseOrders.status })
      .from(purchaseOrders)
      .where(
        and(
          eq(purchaseOrders.bomId, data.bomId),
          sql`${purchaseOrders.status} not in ('closed', 'cancelled')`,
        ),
      )
      .limit(1);

    if (existingOpen) {
      return jsonOk({
        created: false,
        reason: "open_po_exists",
        poId: existingOpen.id,
        poNumber: existingOpen.poNumber,
        status: existingOpen.status,
      });
    }

    const [bom] = await db
      .select({
        id: bomMaster.id,
        soId: bomMaster.soId,
        bomCode: bomMaster.bomCode,
      })
      .from(bomMaster)
      .where(eq(bomMaster.id, data.bomId));

    if (!bom) throw new ApiError(404, "BOM not found");

    const items = await db
      .select({
        rawMaterialId: bomItems.rawMaterialId,
        supplierProductId: bomItems.supplierProductId,
        supplierId: supplierProducts.supplierId,
        qtyPerUnit: bomItems.qtyPerUnit,
        unitPrice: bomItems.unitPrice,
        productName: products.name,
        unitName: bomItems.unitName,
      })
      .from(bomItems)
      .leftJoin(products, eq(bomItems.rawMaterialId, products.id))
      .leftJoin(supplierProducts, eq(bomItems.supplierProductId, supplierProducts.id))
      .where(eq(bomItems.bomId, data.bomId));

    const validItems = items.filter((it) => it.rawMaterialId != null && Number(it.qtyPerUnit) > 0);
    if (validItems.length === 0) {
      throw new ApiError(400, "No raw materials found in BOM to create PO");
    }

    const groups = new Map<number, typeof validItems>();
    let unmappedCount = 0;

    for (const item of validItems) {
      const sid = item.supplierId ?? null;
      if (!sid) {
        unmappedCount += 1;
        continue;
      }
      const list = groups.get(sid) || [];
      list.push(item);
      groups.set(sid, list);
    }

    if (groups.size === 0) {
      throw new ApiError(400, "No supplier-mapped BOM lines found. Map supplier products in BOM items first.");
    }
    const created: Array<{ id: number; poNumber: string; supplierId: number }> = [];

    for (const [supplierId, groupedItems] of groups.entries()) {
      const payload = {
        supplierId,
        soId: bom.soId ?? null,
        bomId: bom.id,
        expectedDate: null,
        status: "draft" as const,
        currency: "INR",
        discountType: "percent" as const,
        discountValue: 0,
        freightAmount: 0,
        remarks: `Auto-generated from BOM ${bom.bomCode}`,
        termsConditions: null,
        paymentTerms: null,
        items: groupedItems.map((it) => ({
          productId: Number(it.rawMaterialId),
          productName: it.productName || `Product ${it.rawMaterialId}`,
          unitName: it.unitName,
          qty: Number(it.qtyPerUnit),
          unitPrice: Number(it.unitPrice || 0),
          discountPercent: 0,
          gstRate: 0,
          gstSlabId: null,
        })),
      };

      const calc = calcPurchaseOrder(payload);

      let poCreated: { id: number; poNumber: string } | null = null;
      let lastErr: unknown = null;

      for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
          const poNumber = await nextPoNumber();
          poCreated = await db.transaction(async (tx) => {
            const [po] = await tx
              .insert(purchaseOrders)
              .values({
                poNumber,
                supplierId: payload.supplierId,
                soId: payload.soId,
                bomId: payload.bomId,
                expectedDate: payload.expectedDate,
                status: payload.status,
                currency: payload.currency,
                discountType: payload.discountType,
                discountValue: "0",
                freightAmount: "0",
                subtotal: calc.subtotal.toString(),
                discountAmount: calc.discountAmount.toString(),
                taxableAmount: calc.taxableAmount.toString(),
                gstAmount: calc.gstAmount.toString(),
                grandTotal: calc.grandTotal.toString(),
                remarks: payload.remarks,
                termsConditions: payload.termsConditions,
                paymentTerms: payload.paymentTerms,
                createdBy: session.userId,
                updatedBy: session.userId,
              })
              .returning({ id: purchaseOrders.id, poNumber: purchaseOrders.poNumber });

            await tx.insert(purchaseOrderItems).values(
              calc.lines.map((l, i) => ({
                poId: po.id,
                productId: l.productId,
                productName: l.productName,
                unitName: l.unitName,
                qty: l.qty.toString(),
                unitPrice: l.unitPrice.toString(),
                discountPercent: l.discountPercent.toString(),
                gstRate: l.gstRate.toString(),
                gstSlabId: l.gstSlabId,
                lineSubtotal: l.lineSubtotal.toString(),
                lineGst: l.lineGst.toString(),
                lineTotal: l.lineTotal.toString(),
                sortOrder: i,
              })),
            );

            return po;
          });
          break;
        } catch (err) {
          lastErr = err;
          const message = err instanceof Error ? err.message.toLowerCase() : "";
          if (!message.includes("duplicate") && !message.includes("unique")) {
            throw err;
          }
        }
      }

      if (!poCreated) throw (lastErr instanceof Error ? lastErr : new ApiError(500, "Failed to create PO"));
      created.push({ ...poCreated, supplierId });
    }

    return jsonOk({
      created: true,
      poCount: created.length,
      pos: created,
      skippedUnmappedLines: unmappedCount,
    });
  } catch (err) {
    return errorToResponse(err);
  }
}
