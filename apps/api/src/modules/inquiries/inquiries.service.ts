import { and, eq, like, or, desc, sql } from "drizzle-orm";
import type { InquiryInput } from "@powerbid/shared";
import type { DB } from "../../db/client";
import { inquiries, inquiryItems, customers } from "../../db/schema";
import { notFound } from "../../lib/errors";
import { nextInquiryNo } from "./inquiries.numbering";

export const inquiriesService = {
  async list(
    db: DB,
    filter: { q?: string; status?: string; limit: number; offset: number },
  ) {
    const where = [eq(inquiries.isActive, true)];
    if (filter.status) where.push(eq(inquiries.status, filter.status as never));
    if (filter.q) {
      const term = `%${filter.q}%`;
      where.push(
        or(
          like(inquiries.inquiryNo, term),
          like(inquiries.customerName, term),
          like(customers.name, term),
        )!,
      );
    }
    const rows = await db
      .select({
        id: inquiries.id,
        inquiryNo: inquiries.inquiryNo,
        status: inquiries.status,
        priority: inquiries.priority,
        source: inquiries.source,
        customerId: inquiries.customerId,
        customerName: sql<string>`coalesce(${customers.name}, ${inquiries.customerName})`,
        requirement: inquiries.requirement,
        expectedClosure: inquiries.expectedClosure,
        assignedTo: inquiries.assignedTo,
        updatedAt: inquiries.updatedAt,
      })
      .from(inquiries)
      .leftJoin(customers, eq(customers.id, inquiries.customerId))
      .where(and(...where))
      .orderBy(desc(inquiries.updatedAt))
      .limit(filter.limit)
      .offset(filter.offset);
    return { items: rows };
  },

  async get(db: DB, id: number) {
    const [head] = await db.select().from(inquiries).where(eq(inquiries.id, id)).limit(1);
    if (!head) throw notFound("Inquiry not found");
    const items = await db.select().from(inquiryItems).where(eq(inquiryItems.inquiryId, id));
    return { inquiry: head, items };
  },

  async create(db: DB, d1: D1Database, input: InquiryInput, userId: number | null) {
    const year = new Date().getUTCFullYear();
    const inquiryNo = await nextInquiryNo(d1, year);

    const [created] = await db
      .insert(inquiries)
      .values({
        inquiryNo,
        customerId: input.customerId ?? null,
        customerName: input.customerName ?? null,
        source: input.source,
        priority: input.priority,
        requirement: input.requirement ?? null,
        expectedClosure: input.expectedClosure ?? null,
        assignedTo: input.assignedTo ?? null,
        status: "new",
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();

    if (input.items.length) {
      await db.insert(inquiryItems).values(
        input.items.map((it) => ({
          inquiryId: created.id,
          productId: it.productId ?? null,
          productName: it.productName,
          qty: it.qty,
          remarks: it.remarks ?? null,
        })),
      );
    }
    return { id: created.id, inquiryNo: created.inquiryNo };
  },
};
