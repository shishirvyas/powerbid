import { NextRequest } from "next/server";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
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
import { inquiryListQuerySchema, inquirySchema } from "@/lib/schemas";

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
    const {
      q,
      limit,
      offset,
      status,
      ownerId,
      customerId,
      source,
      needsQuotation,
      unassigned,
      ageBucket,
      slaState,
    } = parseSearch(new URL(req.url), inquiryListQuerySchema);
    const clauses = [];
    if (q) {
      clauses.push(
        or(
          ilike(inquiries.inquiryNo, `%${q}%`),
          ilike(inquiries.customerName, `%${q}%`),
          ilike(inquiries.requirement, `%${q}%`),
          ilike(customers.name, `%${q}%`),
        ),
      );
    }
    if (status) clauses.push(eq(inquiries.status, status));
    if (ownerId) clauses.push(eq(inquiries.assignedTo, ownerId));
    if (customerId) clauses.push(eq(inquiries.customerId, customerId));
    if (source) clauses.push(eq(inquiries.source, source));
    if (unassigned) clauses.push(sql`${inquiries.assignedTo} is null`);
    if (needsQuotation) clauses.push(sql`not exists (select 1 from quotations q where q.inquiry_id = ${inquiries.id})`);
    if (slaState === "within") {
      clauses.push(sql`${inquiries.createdAt} + interval '24 hours' > now() + interval '2 hours'`);
    }
    if (slaState === "near") {
      clauses.push(sql`${inquiries.createdAt} + interval '24 hours' between now() and now() + interval '2 hours'`);
    }
    if (slaState === "breached") {
      clauses.push(sql`${inquiries.createdAt} + interval '24 hours' < now()`);
    }
    if (ageBucket === "0_2") {
      clauses.push(sql`${inquiries.createdAt} > now() - interval '3 days'`);
    }
    if (ageBucket === "3_7") {
      clauses.push(sql`${inquiries.createdAt} <= now() - interval '3 days' and ${inquiries.createdAt} > now() - interval '8 days'`);
    }
    if (ageBucket === "8_15") {
      clauses.push(sql`${inquiries.createdAt} <= now() - interval '8 days' and ${inquiries.createdAt} > now() - interval '16 days'`);
    }
    if (ageBucket === "15_plus") {
      clauses.push(sql`${inquiries.createdAt} <= now() - interval '16 days'`);
    }
    const where = clauses.length ? and(...clauses) : undefined;
    const rows = await db
      .select({
        id: inquiries.id,
        inquiryNo: inquiries.inquiryNo,
        dateOfInquiry: inquiries.dateOfInquiry,
        referenceNumber: inquiries.referenceNumber,
        customerId: inquiries.customerId,
        customerName: sql<string>`coalesce(${inquiries.customerName}, ${customers.name})`,
        source: inquiries.source,
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
      .leftJoin(customers, eq(inquiries.customerId, customers.id))
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
          unitName: it.unitName ?? null,
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
