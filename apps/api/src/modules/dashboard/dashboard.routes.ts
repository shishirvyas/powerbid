import { Hono } from "hono";
import type { AppEnv } from "../../index";
import { requireAuth } from "../../middleware/auth";

export const dashboardRoutes = new Hono<AppEnv>();
dashboardRoutes.use("*", requireAuth);

/**
 * Executive dashboard summary backed by raw D1 prepared statements,
 * batched so the entire payload is a single round-trip.
 */
dashboardRoutes.get("/", async (c) => {
  const db = c.env.DB;

  // server is UTC; UI shows IST. Use UTC bounds; the difference is acceptable
  // for a daily/monthly KPI roll-up.
  const now = new Date();
  const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const today = now.toISOString().slice(0, 10);

  // 6 months back including current, formatted as YYYY-MM, oldest first.
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }

  const [
    counts,
    statusBreakdown,
    pipeline,
    monthRevenue,
    topProducts,
    topCustomers,
    leaderboard,
    monthlySeries,
    recent,
  ] = await db.batch([
    db.prepare(
      `SELECT
          (SELECT COUNT(*) FROM quotations WHERE quotation_date = ?2) AS today_quotations,
          (SELECT COALESCE(SUM(grand_total),0) FROM quotations WHERE quotation_date = ?2) AS today_value,
          (SELECT COUNT(*) FROM quotations WHERE substr(quotation_date,1,7) = ?1) AS quotations_this_month,
          (SELECT COALESCE(SUM(grand_total),0) FROM quotations WHERE substr(quotation_date,1,7) = ?1) AS month_value,
          (SELECT COUNT(*) FROM quotations WHERE status = 'draft' AND is_active = 1) AS draft_pending,
          (SELECT COUNT(*) FROM quotations WHERE status = 'won') AS won,
          (SELECT COUNT(*) FROM quotations WHERE status = 'lost') AS lost,
          (SELECT COUNT(*) FROM customers WHERE is_active = 1) AS active_customers,
          (SELECT COUNT(*) FROM inquiries WHERE status IN ('new','in_progress')) AS open_inquiries`,
    ).bind(ym, today),

    db.prepare(
      `SELECT status, COUNT(*) AS n, COALESCE(SUM(grand_total),0) AS total
         FROM quotations
        WHERE is_active = 1
        GROUP BY status`,
    ),

    db.prepare(
      `SELECT COALESCE(SUM(grand_total),0) AS pipeline_value
         FROM quotations
        WHERE status IN ('final','sent') AND is_active = 1`,
    ),

    db.prepare(
      `SELECT COALESCE(SUM(grand_total),0) AS month_revenue
         FROM quotations
        WHERE status = 'won' AND substr(quotation_date,1,7) = ?1`,
    ).bind(ym),

    db.prepare(
      `SELECT qi.product_name AS name,
              SUM(qi.qty)        AS qty,
              SUM(qi.line_total) AS total
         FROM quotation_items qi
         JOIN quotations q ON q.id = qi.quotation_id
        WHERE q.status IN ('final','sent','won')
        GROUP BY qi.product_name
        ORDER BY total DESC
        LIMIT 5`,
    ),

    db.prepare(
      `SELECT c.id,
              c.name,
              COUNT(q.id)             AS quotations,
              COALESCE(SUM(q.grand_total),0) AS total,
              SUM(CASE WHEN q.status = 'won' THEN 1 ELSE 0 END) AS won
         FROM quotations q
         JOIN customers c ON c.id = q.customer_id
        WHERE q.is_active = 1
        GROUP BY c.id, c.name
        ORDER BY total DESC
        LIMIT 5`,
    ),

    db.prepare(
      `SELECT u.id,
              u.name,
              u.email,
              COUNT(q.id) AS quotations,
              COALESCE(SUM(q.grand_total),0) AS total,
              COALESCE(SUM(CASE WHEN q.status = 'won' THEN q.grand_total ELSE 0 END),0) AS won_value,
              SUM(CASE WHEN q.status = 'won' THEN 1 ELSE 0 END) AS won,
              SUM(CASE WHEN q.status = 'lost' THEN 1 ELSE 0 END) AS lost
         FROM users u
         LEFT JOIN quotations q ON q.created_by = u.id AND q.is_active = 1
        WHERE u.is_active = 1
        GROUP BY u.id, u.name, u.email
        HAVING COUNT(q.id) > 0
        ORDER BY won_value DESC, total DESC
        LIMIT 10`,
    ),

    db.prepare(
      `SELECT substr(quotation_date,1,7) AS month,
              COUNT(*) AS quotations,
              COALESCE(SUM(grand_total),0) AS total,
              COALESCE(SUM(CASE WHEN status = 'won' THEN grand_total ELSE 0 END),0) AS won_value
         FROM quotations
        WHERE is_active = 1
          AND substr(quotation_date,1,7) >= ?1
        GROUP BY substr(quotation_date,1,7)
        ORDER BY month`,
    ).bind(months[0]),

    db.prepare(
      `SELECT q.id, q.quotation_no, q.status, q.grand_total, q.updated_at,
              c.name AS customer_name
         FROM quotations q
         LEFT JOIN customers c ON c.id = q.customer_id
        WHERE q.is_active = 1
        ORDER BY q.updated_at DESC
        LIMIT 8`,
    ),
  ]);

  const head = (counts.results?.[0] as Record<string, number>) ?? {};
  const won = head.won ?? 0;
  const lost = head.lost ?? 0;
  const decided = won + lost;

  // Fill missing months in series with zeros
  const seriesMap = new Map<string, { quotations: number; total: number; won_value: number }>();
  for (const r of monthlySeries.results ?? []) {
    const row = r as { month: string; quotations: number; total: number; won_value: number };
    seriesMap.set(row.month, {
      quotations: row.quotations,
      total: row.total,
      won_value: row.won_value,
    });
  }
  const series = months.map((m) => ({
    month: m,
    quotations: seriesMap.get(m)?.quotations ?? 0,
    total: seriesMap.get(m)?.total ?? 0,
    wonValue: seriesMap.get(m)?.won_value ?? 0,
  }));

  return c.json({
    kpis: {
      todayQuotations: head.today_quotations ?? 0,
      todayValue: head.today_value ?? 0,
      quotationsThisMonth: head.quotations_this_month ?? 0,
      monthValue: head.month_value ?? 0,
      draftPending: head.draft_pending ?? 0,
      won,
      lost,
      winRate: decided > 0 ? Math.round((won / decided) * 1000) / 10 : 0, // %, 1 decimal
      activeCustomers: head.active_customers ?? 0,
      openInquiries: head.open_inquiries ?? 0,
      pipelineValue: (pipeline.results?.[0] as { pipeline_value?: number })?.pipeline_value ?? 0,
      monthRevenue: (monthRevenue.results?.[0] as { month_revenue?: number })?.month_revenue ?? 0,
    },
    statusBreakdown: statusBreakdown.results ?? [],
    topProducts: topProducts.results ?? [],
    topCustomers: topCustomers.results ?? [],
    leaderboard: leaderboard.results ?? [],
    monthlySeries: series,
    recent: recent.results ?? [],
  });
});

// keep old path for back-compat
dashboardRoutes.get("/summary", (c) => c.redirect("/api/dashboard"));
