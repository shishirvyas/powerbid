import { NextRequest } from "next/server";
import { desc, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { inquiries, inquiryItems, customers } from "@/lib/db/schema";
import {
  ApiError,
  errorToResponse,
  jsonOk,
  parseJson,
  parseSearch,
  requireSession,
} from "@/lib/api";
import { inquirySchema, listQuerySchema } from "@/lib/schemas";

export const runtime = "nodejs";

async function nextInquiryNo(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INQ-${year}-`;
  const rows = await db
    .select({ max: sql<string | null>`max(${inquiries.inquiryNo})` })
    .from(inquiries)
    .where(ilike(inquiries.inquiryNo, `${prefix}%`));
  const max = rows[0]?.max ?? null;
  const lastNum = max ? Number(max.slice(prefix.length)) : 0;
  const next = String((Number.isFinite(lastNum) ? lastNum : 0) + 1).padStart(4, "0");
  return `${prefix}${next}`;
}

export async function GET(req: NextRequest) {
  try {
    await requireSession();
    const { q, limit, offset } = parseSearch(new URL(req.url), listQuerySchema);
    const where = q
      ? or(
          ilike(inquiries.inquiryNo, `%${q}%`),
          ilike(inquiries.customerName, `%${q}%`),
          ilike(inquiries.requirement, `%${q}%`),
        )
      : undefined;
    const rows = await db
      .select({
        id: inquiries.id,
        inquiryNo: inquiries.inquiryNo,
        customerId: inquiries.customerId,
        customerName: sql<string>`coalesce(${inquiries.customerName}, ${customers.name})`,
        source: inquiries.source,
        priority: inquiries.priority,
        status: inquiries.status,
        requirement: inquiries.requirement,
        expectedClosure: inquiries.expectedClosure,
        createdAt: inquiries.createdAt,
      })
      .from(inquiries)
      .leftJoin(customers, eq(inquiries.customerId, customers.id))
      .where(where)
      .orderBy(desc(inquiries.createdAt))
      .limit(limit)
      .offset(offset);
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(inquiries)
      .where(where);
    return jsonOk({ rows, total: count, limit, offset });
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const data = await parseJson(req, inquirySchema);
    const inquiryNo = await nextInquiryNo();
    const { items, ...rest } = data;
    const [row] = await db
      .insert(inquiries)
      .values({ ...rest, inquiryNo })
      .returning();
    if (items.length) {
      await db.insert(inquiryItems).values(
        items.map((it) => ({
          inquiryId: row.id,
          productId: it.productId ?? null,
          productName: it.productName,
          qty: String(it.qty),
          remarks: it.remarks ?? null,
        })),
      );
    }
    return jsonOk(row, { status: 201 });
  } catch (err) {
    return errorToResponse(err);
  }
}
