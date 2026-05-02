import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import { calcQuotation } from "@/lib/calc";
import { db } from "@/lib/db";
import { customers, salesOrderItems, salesOrders } from "@/lib/db/schema";
import { ApiError, errorToResponse, jsonOk, jsonList, parseJson, parseSearch, requireSession } from "@/lib/api";
import { listQuerySchema, salesOrderSchema } from "@/lib/schemas";
import { runIdempotentMutation } from "@/lib/idempotency";

export const runtime = "nodejs";

async function nextSoNumber() {
  const year = new Date().getFullYear();
  const prefix = `SO-${year}-`;
  const rows = await db
    .select({ max: sql<string | null>`max(${salesOrders.soNumber})` })
    .from(salesOrders)
    .where(ilike(salesOrders.soNumber, `${prefix}%`));
  const max = rows[0]?.max ?? null;
  const last = max ? Number(max.slice(prefix.length)) : 0;
  const next = String((Number.isFinite(last) ? last : 0) + 1).padStart(4, "0");
  return `${prefix}${next}`;
}

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const { q, limit, offset } = parseSearch(new URL(req.url), listQuerySchema);
    const where = q ? or(ilike(salesOrders.soNumber, `%${q}%`), ilike(customers.name, `%${q}%`)) : undefined;

    const rows = await db
      .select({
        id: salesOrders.id,
        soNumber: salesOrders.soNumber,
        orderDate: salesOrders.orderDate,
        status: salesOrders.status,
        currency: salesOrders.currency,
        grandTotal: salesOrders.grandTotal,
        customerId: salesOrders.customerId,
        customerName: customers.name,
        createdAt: salesOrders.createdAt,
      })
      .from(salesOrders)
      .leftJoin(customers, eq(salesOrders.customerId, customers.id))
      .where(where)
      .orderBy(desc(salesOrders.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(salesOrders)
      .leftJoin(customers, eq(salesOrders.customerId, customers.id))
      .where(where);

    return jsonList({ rows, total: count, limit, offset });
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    if (session.role === "viewer") throw new ApiError(403, "Only sales/admin users can create sales orders");
    const data = await parseJson(req, salesOrderSchema);
    return await runIdempotentMutation(
      {
        req,
        userId: session.userId,
        fingerprint: data,
      },
      async () => {
        const calc = calcQuotation({
          items: data.items.map((i) => ({
            productId: i.productId ?? 0,
            productName: i.productName,
            unitName: i.unitName || null,
            qty: i.qty,
            unitPrice: i.unitPrice,
            gstRate: i.gstRate,
            gstSlabId: null,
          })),
          discountType: "percent",
          discountValue: 0,
          freightAmount: 0,
        });

        let created: { id: number } | null = null;
        for (let attempt = 0; attempt < 5; attempt += 1) {
          try {
            created = await db.transaction(async (tx) => {
              const [order] = await tx
                .insert(salesOrders)
                .values({
                  soNumber: await nextSoNumber(),
                  orderDate: data.orderDate,
                  quotationId: data.quotationId || null,
                  customerId: data.customerId,
                  status: data.status,
                  currency: "INR",
                  subtotal: String(calc.subtotal),
                  discountAmount: String(calc.discountAmount),
                  taxableAmount: String(calc.taxableAmount),
                  gstAmount: String(calc.gstAmount),
                  freightAmount: String(calc.freightAmount),
                  grandTotal: String(calc.grandTotal),
                  notes: data.notes,
                  createdBy: session.userId,
                  updatedBy: session.userId,
                })
                .returning({ id: salesOrders.id });

              await tx.insert(salesOrderItems).values(
                calc.lines.map((line, idx) => ({
                  soId: order.id,
                  productId: line.productId || null,
                  productName: line.productName,
                  unitName: line.unitName || null,
                  qty: String(line.qty),
                  dispatchedQty: "0",
                  unitPrice: String(line.unitPrice),
                  gstRate: String(line.gstRate),
                  lineSubtotal: String(line.lineSubtotal),
                  lineGst: String(line.lineGst),
                  lineTotal: String(line.lineTotal),
                  sortOrder: idx,
                })),
              );

              return order;
            });
            break;
          } catch (err) {
            const msg = err instanceof Error ? err.message.toLowerCase() : "";
            if (!msg.includes("duplicate") && !msg.includes("unique")) throw err;
          }
        }

        if (!created) throw new ApiError(500, "Failed to create sales order");
        return { data: created, status: 201 };
      },
    );
  } catch (err) {
    return errorToResponse(err);
  }
}
