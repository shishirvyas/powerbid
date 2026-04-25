import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { errorToResponse, jsonOk, requireSession } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(_req: NextRequest) {
  try {
    await requireSession();

    const [counts] = await db.execute<{
      customers: number;
      products: number;
      inquiries: number;
      quotations: number;
    }>(sql`
      select
        (select count(*)::int from customers) as customers,
        (select count(*)::int from products) as products,
        (select count(*)::int from inquiries) as inquiries,
        (select count(*)::int from quotations) as quotations
    `);

    const byStatus = await db.execute<{ status: string; count: number; total: string }>(sql`
      select status, count(*)::int as count, coalesce(sum(grand_total), 0)::text as total
      from quotations group by status order by status
    `);

    const byMonth = await db.execute<{ month: string; count: number; total: string }>(sql`
      select to_char(created_at, 'YYYY-MM') as month,
             count(*)::int as count,
             coalesce(sum(grand_total), 0)::text as total
      from quotations
      where created_at >= now() - interval '6 months'
      group by 1 order by 1
    `);

    const topCustomers = await db.execute<{
      id: number;
      name: string;
      total: string;
      count: number;
    }>(sql`
      select c.id, c.name, coalesce(sum(q.grand_total), 0)::text as total, count(q.id)::int as count
      from customers c
      left join quotations q on q.customer_id = c.id and q.status = 'won'
      group by c.id, c.name
      order by sum(q.grand_total) desc nulls last
      limit 5
    `);

    return jsonOk({
      counts: counts ?? { customers: 0, products: 0, inquiries: 0, quotations: 0 },
      byStatus: Array.from(byStatus),
      byMonth: Array.from(byMonth),
      topCustomers: Array.from(topCustomers),
    });
  } catch (err) {
    return errorToResponse(err);
  }
}
