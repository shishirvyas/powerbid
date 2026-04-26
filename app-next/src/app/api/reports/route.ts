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

    const byStatus = await db.execute<{ status: string; count: number; total: number }>(sql`
      select status, count(*)::int as count, coalesce(sum(grand_total), 0)::float8 as total
      from quotations group by status order by status
    `);

    const byMonth = await db.execute<{ month: string; count: number; total: number }>(sql`
      select to_char(created_at, 'YYYY-MM') as month,
             count(*)::int as count,
             coalesce(sum(grand_total), 0)::float8 as total
      from quotations
      where created_at >= now() - interval '6 months'
      group by 1 order by 1
    `);

    const topCustomers = await db.execute<{
      id: number;
      name: string;
      total: number;
      count: number;
    }>(sql`
      select c.id, c.name, coalesce(sum(q.grand_total), 0)::float8 as total, count(q.id)::int as count
      from customers c
      left join quotations q on q.customer_id = c.id and q.status = 'won'
      group by c.id, c.name
      order by sum(q.grand_total) desc nulls last
      limit 5
    `);

    const commByChannel = await db.execute<{
      channel: string;
      total: number;
      sent: number;
      failed: number;
      queued: number;
    }>(sql`
      select
        channel,
        count(*)::int as total,
        sum(case when status = 'sent' then 1 else 0 end)::int as sent,
        sum(case when status = 'failed' then 1 else 0 end)::int as failed,
        sum(case when status = 'queued' then 1 else 0 end)::int as queued
      from communication_logs
      where created_at >= now() - interval '30 days'
      group by channel
      order by channel
    `);

    const commByDay = await db.execute<{
      day: string;
      sent: number;
      failed: number;
    }>(sql`
      select
        to_char(created_at, 'YYYY-MM-DD') as day,
        sum(case when status = 'sent' then 1 else 0 end)::int as sent,
        sum(case when status = 'failed' then 1 else 0 end)::int as failed
      from communication_logs
      where created_at >= now() - interval '14 days'
      group by 1
      order by 1
    `);

    return jsonOk({
      counts: counts ?? { customers: 0, products: 0, inquiries: 0, quotations: 0 },
      byStatus: Array.from(byStatus),
      byMonth: Array.from(byMonth),
      topCustomers: Array.from(topCustomers),
      communications: {
        byChannel: Array.from(commByChannel),
        byDay: Array.from(commByDay),
      },
    });
  } catch (err) {
    return errorToResponse(err);
  }
}
