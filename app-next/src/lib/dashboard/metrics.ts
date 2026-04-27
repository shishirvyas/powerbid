import { SQL, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import type { DashboardOverviewQuery } from "@/lib/schemas";

type TrendGranularity = "day" | "month";
type AlertTone = "default" | "warning" | "danger" | "success";
type SlaState = "within" | "near" | "breached";

type TrendPoint = {
  bucket: string;
  created?: number;
  sent?: number;
  won?: number;
  lost?: number;
  quotedAmount?: number;
  wonAmount?: number;
  lostAmount?: number;
  incoming?: number;
};

type ActionAlert = {
  id: string;
  tone: AlertTone;
  title: string;
  description: string;
  count: number;
  amount?: number;
  href: string;
};

type BucketSummary = {
  bucket: string;
  count: number;
  amount?: number;
  href: string;
};

type ComparisonRow = {
  key: string;
  label: string;
  current: number;
  previous: number;
  changePct: number | null;
};

type FunnelStage = {
  key: string;
  label: string;
  count: number;
  conversionPct: number | null;
  href: string;
};

type SupportedFilters = {
  dateRange: boolean;
  ownerId: boolean;
  customerId: boolean;
  source: boolean;
  statusGroup: boolean;
  customerType: false;
  region: false;
  productCategory: false;
};

export type DashboardOverview = {
  generatedAt: string;
  dateWindow: {
    preset: DashboardOverviewQuery["preset"];
    startDate: string;
    endDate: string;
    previousStartDate: string;
    previousEndDate: string;
    granularity: TrendGranularity;
  };
  supportedFilters: SupportedFilters;
  filters: DashboardOverviewQuery;
  kpis: {
    quotations: {
      total: number;
      pendingApproval: number;
      sentToday: number;
      overdueFollowUp: number;
      ctaHref: string;
    };
    inquiries: {
      open: number;
      newToday: number;
      needQuotation: number;
      slaBreached: number;
      ctaHref: string;
    };
    customers: {
      total: number;
      newThisMonth: number;
      inactive30Days: number;
      repeatCustomersPct: number;
      ctaHref: string;
    };
    revenue: {
      wonThisMonth: number;
      wonPreviousMonth: number;
      growthPct: number | null;
      direction: "up" | "down" | "flat";
      ctaHref: string;
    };
  };
  comparison: {
    currentLabel: string;
    previousLabel: string;
    rows: ComparisonRow[];
  };
  trends: {
    quotations: TrendPoint[];
    revenue: TrendPoint[];
    inquiries: TrendPoint[];
  };
  sla: {
    inquiries: {
      acknowledgement: Record<SlaState, number> & { href: string };
      quotationCreation: Record<SlaState, number> & { href: string };
    };
    quotations: {
      followUp: Record<SlaState, number> & { href: string };
      negotiationClosure: Record<SlaState, number> & { href: string };
    };
  };
  aging: {
    quotations: BucketSummary[];
    inquiries: BucketSummary[];
  };
  actionCenter: ActionAlert[];
  funnel: FunnelStage[];
  lostReasons: Array<{ reason: string; count: number; amount: number }>;
  onboarding: {
    avgInquiryDays: number | null;
    avgQuotationDays: number | null;
    avgWinDays: number | null;
    fastestWinDays: number | null;
    slowestWinDays: number | null;
    sampleSize: number;
  };
};

type NormalizedWindow = {
  preset: DashboardOverviewQuery["preset"];
  startDate: Date;
  endDateExclusive: Date;
  previousStartDate: Date;
  previousEndDateExclusive: Date;
  granularity: TrendGranularity;
};

const SUPPORTED_FILTERS: SupportedFilters = {
  dateRange: true,
  ownerId: true,
  customerId: true,
  source: true,
  statusGroup: true,
  customerType: false,
  region: false,
  productCategory: false,
};

function startOfUtcDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function addMonths(value: Date, months: number) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + months, value.getUTCDate()));
}

function toDateParam(value: Date) {
  return value.toISOString().slice(0, 10);
}

function monthStart(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

function nextMonthStart(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 1));
}

function normalizeWindow(filters: DashboardOverviewQuery): NormalizedWindow {
  const today = startOfUtcDay(new Date());
  const preset = filters.preset ?? "30d";
  let startDate: Date;
  let endDateExclusive: Date;

  if (filters.startDate && filters.endDate) {
    startDate = new Date(`${filters.startDate}T00:00:00.000Z`);
    endDateExclusive = addDays(new Date(`${filters.endDate}T00:00:00.000Z`), 1);
  } else {
    switch (preset) {
      case "7d":
        startDate = addDays(today, -6);
        endDateExclusive = addDays(today, 1);
        break;
      case "this_month":
        startDate = monthStart(today);
        endDateExclusive = addDays(today, 1);
        break;
      case "6m":
        startDate = monthStart(addMonths(today, -5));
        endDateExclusive = nextMonthStart(today);
        break;
      case "30d":
      default:
        startDate = addDays(today, -29);
        endDateExclusive = addDays(today, 1);
        break;
    }
  }

  const daySpan = Math.max(1, Math.round((endDateExclusive.getTime() - startDate.getTime()) / 86400000));
  const previousEndDateExclusive = new Date(startDate);
  const previousStartDate = addDays(previousEndDateExclusive, -daySpan);

  return {
    preset,
    startDate,
    endDateExclusive,
    previousStartDate,
    previousEndDateExclusive,
    granularity: daySpan > 92 ? "month" : "day",
  };
}

function joinClauses(clauses: SQL[]) {
  return clauses.length ? sql.join(clauses, sql` and `) : sql`true`;
}

function inArray(column: string, values: string[]) {
  return sql`${sql.raw(column)} in (${sql.join(values.map((value) => sql`${value}`), sql`, `)})`;
}

function buildQuotationWhere(filters: DashboardOverviewQuery, window: NormalizedWindow, alias = "q") {
  const startIso = window.startDate.toISOString();
  const endIso = window.endDateExclusive.toISOString();
  const clauses: SQL[] = [
    sql`${sql.raw(`${alias}.created_at`)} >= ${startIso}::timestamptz`,
    sql`${sql.raw(`${alias}.created_at`)} < ${endIso}::timestamptz`,
  ];
  if (filters.ownerId) clauses.push(sql`${sql.raw(`${alias}.created_by`)} = ${filters.ownerId}`);
  if (filters.customerId) clauses.push(sql`${sql.raw(`${alias}.customer_id`)} = ${filters.customerId}`);
  if (filters.source) {
    clauses.push(
      sql`exists (
        select 1 from inquiries iq
        where iq.id = ${sql.raw(`${alias}.inquiry_id`)}
          and iq.source = ${filters.source}
      )`,
    );
  }
  if (filters.statusGroup === "won") clauses.push(sql`${sql.raw(`${alias}.status`)} = ${"won"}`);
  if (filters.statusGroup === "lost") clauses.push(sql`${sql.raw(`${alias}.status`)} = ${"lost"}`);
  if (filters.statusGroup === "open" || filters.statusGroup === "active") {
    clauses.push(inArray(`${alias}.status`, ["draft", "sent"]));
  }
  if (filters.statusGroup === "closed") {
    clauses.push(inArray(`${alias}.status`, ["won", "lost", "expired", "cancelled"]));
  }
  return joinClauses(clauses);
}

function buildInquiryWhere(filters: DashboardOverviewQuery, window: NormalizedWindow, alias = "i") {
  const startIso = window.startDate.toISOString();
  const endIso = window.endDateExclusive.toISOString();
  const clauses: SQL[] = [
    sql`${sql.raw(`${alias}.created_at`)} >= ${startIso}::timestamptz`,
    sql`${sql.raw(`${alias}.created_at`)} < ${endIso}::timestamptz`,
  ];
  if (filters.ownerId) clauses.push(sql`${sql.raw(`${alias}.assigned_to`)} = ${filters.ownerId}`);
  if (filters.customerId) clauses.push(sql`${sql.raw(`${alias}.customer_id`)} = ${filters.customerId}`);
  if (filters.source) clauses.push(sql`${sql.raw(`${alias}.source`)} = ${filters.source}`);
  if (filters.statusGroup === "won") clauses.push(sql`${sql.raw(`${alias}.status`)} = ${"won"}`);
  if (filters.statusGroup === "lost") clauses.push(sql`${sql.raw(`${alias}.status`)} = ${"lost"}`);
  if (filters.statusGroup === "open" || filters.statusGroup === "active") {
    clauses.push(inArray(`${alias}.status`, ["new", "in_progress", "quoted"]));
  }
  if (filters.statusGroup === "closed") {
    clauses.push(inArray(`${alias}.status`, ["won", "lost", "closed"]));
  }
  return joinClauses(clauses);
}

function buildHref(path: "/quotations" | "/inquiries" | "/customers" | "/reports", params: Record<string, string | number | boolean | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}

function pctChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : null;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function stageConversion(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : null;
  return Number(((current / previous) * 100).toFixed(1));
}

function directionFromGrowth(growthPct: number | null): "up" | "down" | "flat" {
  if (growthPct === null || growthPct === 0) return "flat";
  return growthPct > 0 ? "up" : "down";
}

function roundMetric(value: number | null | undefined) {
  return value == null ? null : Number(value.toFixed(1));
}

export async function getDashboardOverview(filters: DashboardOverviewQuery): Promise<DashboardOverview> {
  const window = normalizeWindow(filters);
  const windowStartIso = window.startDate.toISOString();
  const windowEndIso = window.endDateExclusive.toISOString();
  const quotationWhere = buildQuotationWhere(filters, window, "q");
  const inquiryWhere = buildInquiryWhere(filters, window, "i");
  const bucketExpr = window.granularity === "month"
    ? sql.raw("to_char(date_trunc('month', ts), 'YYYY-MM')")
    : sql.raw("to_char(date_trunc('day', ts), 'YYYY-MM-DD')");

  const [quotationKpi] = await db.execute<{
    total: number;
    pending_approval: number;
    sent_today: number;
    overdue_followup: number;
  }>(sql`
    select
      count(*)::int as total,
      sum(case when q.status = 'draft' then 1 else 0 end)::int as pending_approval,
      sum(case when nullif(q.sent_at, '') is not null and nullif(q.sent_at, '')::date = current_date then 1 else 0 end)::int as sent_today,
      sum(
        case
          when q.status = 'sent'
           and coalesce(nullif(q.sent_at, '')::timestamptz, q.created_at) + interval '3 days' < now()
          then 1 else 0
        end
      )::int as overdue_followup
    from quotations q
    where ${quotationWhere}
  `);

  const [inquiryKpi] = await db.execute<{
    open_count: number;
    new_today: number;
    need_quotation: number;
    sla_breached: number;
  }>(sql`
    select
      sum(case when i.status not in ('won', 'lost', 'closed') then 1 else 0 end)::int as open_count,
      sum(case when i.created_at::date = current_date then 1 else 0 end)::int as new_today,
      sum(
        case when i.status in ('new', 'in_progress')
          and not exists (select 1 from quotations q where q.inquiry_id = i.id)
        then 1 else 0 end
      )::int as need_quotation,
      sum(
        case when i.status in ('new', 'in_progress')
          and not exists (select 1 from quotations q where q.inquiry_id = i.id)
          and i.created_at + interval '24 hours' < now()
        then 1 else 0 end
      )::int as sla_breached
    from inquiries i
    where ${inquiryWhere}
  `);

  const monthCurrentStart = monthStart(new Date());
  const monthCurrentEnd = nextMonthStart(new Date());
  const monthPreviousStart = addMonths(monthCurrentStart, -1);
  const monthPreviousEnd = monthCurrentStart;
  const monthCurrentStartIso = monthCurrentStart.toISOString();
  const monthCurrentEndIso = monthCurrentEnd.toISOString();
  const monthPreviousStartIso = monthPreviousStart.toISOString();
  const monthPreviousEndIso = monthPreviousEnd.toISOString();

  const [customerKpi] = await db.execute<{
    total: number;
    new_this_month: number;
    inactive_30_days: number;
    repeat_pct: number;
  }>(sql`
    with customer_activity as (
      select
        c.id,
        c.created_at,
        greatest(
          c.updated_at,
          coalesce((select max(i.created_at) from inquiries i where i.customer_id = c.id), c.created_at),
          coalesce((select max(q.created_at) from quotations q where q.customer_id = c.id), c.created_at)
        ) as last_activity,
        (select count(*)::int from quotations q where q.customer_id = c.id) as quotation_count
      from customers c
      where (${filters.customerId ? sql`c.id = ${filters.customerId}` : sql`true`})
    )
    select
      count(*)::int as total,
      sum(case when created_at >= ${monthCurrentStartIso}::timestamptz and created_at < ${monthCurrentEndIso}::timestamptz then 1 else 0 end)::int as new_this_month,
      sum(case when last_activity < now() - interval '30 days' then 1 else 0 end)::int as inactive_30_days,
      coalesce(round(100.0 * avg(case when quotation_count > 1 then 1.0 else 0.0 end), 1), 0)::float8 as repeat_pct
    from customer_activity
  `);

  const [revenueKpi] = await db.execute<{
    current_month: number;
    previous_month: number;
  }>(sql`
    select
      coalesce(sum(case when q.status = 'won' and coalesce(nullif(q.closed_at, '')::timestamptz, q.created_at) >= ${monthCurrentStartIso}::timestamptz and coalesce(nullif(q.closed_at, '')::timestamptz, q.created_at) < ${monthCurrentEndIso}::timestamptz then q.grand_total::float8 else 0 end), 0)::float8 as current_month,
      coalesce(sum(case when q.status = 'won' and coalesce(nullif(q.closed_at, '')::timestamptz, q.created_at) >= ${monthPreviousStartIso}::timestamptz and coalesce(nullif(q.closed_at, '')::timestamptz, q.created_at) < ${monthPreviousEndIso}::timestamptz then q.grand_total::float8 else 0 end), 0)::float8 as previous_month
    from quotations q
    where ${filters.customerId ? sql`q.customer_id = ${filters.customerId}` : sql`true`}
      and ${filters.ownerId ? sql`q.created_by = ${filters.ownerId}` : sql`true`}
      and ${filters.source ? sql`exists (select 1 from inquiries iq where iq.id = q.inquiry_id and iq.source = ${filters.source})` : sql`true`}
  `);

  const [comparisonRaw] = await db.execute<{
    current_inquiries: number;
    previous_inquiries: number;
    current_quotations: number;
    previous_quotations: number;
    current_wins: number;
    previous_wins: number;
    current_revenue: number;
    previous_revenue: number;
    current_customers: number;
    previous_customers: number;
  }>(sql`
    select
      (select count(*)::int from inquiries i where i.created_at >= ${monthCurrentStartIso}::timestamptz and i.created_at < ${monthCurrentEndIso}::timestamptz ${filters.ownerId ? sql`and i.assigned_to = ${filters.ownerId}` : sql``} ${filters.customerId ? sql`and i.customer_id = ${filters.customerId}` : sql``} ${filters.source ? sql`and i.source = ${filters.source}` : sql``}) as current_inquiries,
      (select count(*)::int from inquiries i where i.created_at >= ${monthPreviousStartIso}::timestamptz and i.created_at < ${monthPreviousEndIso}::timestamptz ${filters.ownerId ? sql`and i.assigned_to = ${filters.ownerId}` : sql``} ${filters.customerId ? sql`and i.customer_id = ${filters.customerId}` : sql``} ${filters.source ? sql`and i.source = ${filters.source}` : sql``}) as previous_inquiries,
      (select count(*)::int from quotations q where q.created_at >= ${monthCurrentStartIso}::timestamptz and q.created_at < ${monthCurrentEndIso}::timestamptz ${filters.ownerId ? sql`and q.created_by = ${filters.ownerId}` : sql``} ${filters.customerId ? sql`and q.customer_id = ${filters.customerId}` : sql``} ${filters.source ? sql`and exists (select 1 from inquiries iq where iq.id = q.inquiry_id and iq.source = ${filters.source})` : sql``}) as current_quotations,
      (select count(*)::int from quotations q where q.created_at >= ${monthPreviousStartIso}::timestamptz and q.created_at < ${monthPreviousEndIso}::timestamptz ${filters.ownerId ? sql`and q.created_by = ${filters.ownerId}` : sql``} ${filters.customerId ? sql`and q.customer_id = ${filters.customerId}` : sql``} ${filters.source ? sql`and exists (select 1 from inquiries iq where iq.id = q.inquiry_id and iq.source = ${filters.source})` : sql``}) as previous_quotations,
      (select count(*)::int from quotations q where q.status = 'won' and coalesce(nullif(q.closed_at, '')::timestamptz, q.created_at) >= ${monthCurrentStartIso}::timestamptz and coalesce(nullif(q.closed_at, '')::timestamptz, q.created_at) < ${monthCurrentEndIso}::timestamptz ${filters.ownerId ? sql`and q.created_by = ${filters.ownerId}` : sql``} ${filters.customerId ? sql`and q.customer_id = ${filters.customerId}` : sql``}) as current_wins,
      (select count(*)::int from quotations q where q.status = 'won' and coalesce(nullif(q.closed_at, '')::timestamptz, q.created_at) >= ${monthPreviousStartIso}::timestamptz and coalesce(nullif(q.closed_at, '')::timestamptz, q.created_at) < ${monthPreviousEndIso}::timestamptz ${filters.ownerId ? sql`and q.created_by = ${filters.ownerId}` : sql``} ${filters.customerId ? sql`and q.customer_id = ${filters.customerId}` : sql``}) as previous_wins,
      (select coalesce(sum(q.grand_total::float8), 0)::float8 from quotations q where q.status = 'won' and coalesce(nullif(q.closed_at, '')::timestamptz, q.created_at) >= ${monthCurrentStartIso}::timestamptz and coalesce(nullif(q.closed_at, '')::timestamptz, q.created_at) < ${monthCurrentEndIso}::timestamptz ${filters.ownerId ? sql`and q.created_by = ${filters.ownerId}` : sql``} ${filters.customerId ? sql`and q.customer_id = ${filters.customerId}` : sql``}) as current_revenue,
      (select coalesce(sum(q.grand_total::float8), 0)::float8 from quotations q where q.status = 'won' and coalesce(nullif(q.closed_at, '')::timestamptz, q.created_at) >= ${monthPreviousStartIso}::timestamptz and coalesce(nullif(q.closed_at, '')::timestamptz, q.created_at) < ${monthPreviousEndIso}::timestamptz ${filters.ownerId ? sql`and q.created_by = ${filters.ownerId}` : sql``} ${filters.customerId ? sql`and q.customer_id = ${filters.customerId}` : sql``}) as previous_revenue,
      (select count(*)::int from customers c where c.created_at >= ${monthCurrentStartIso}::timestamptz and c.created_at < ${monthCurrentEndIso}::timestamptz ${filters.customerId ? sql`and c.id = ${filters.customerId}` : sql``}) as current_customers,
      (select count(*)::int from customers c where c.created_at >= ${monthPreviousStartIso}::timestamptz and c.created_at < ${monthPreviousEndIso}::timestamptz ${filters.customerId ? sql`and c.id = ${filters.customerId}` : sql``}) as previous_customers
  `);

  const quotationTrendRows = await db.execute<{
    bucket: string;
    created: number;
    sent: number;
    won: number;
    lost: number;
  }>(sql`
    with points as (
      select ${bucketExpr} as bucket,
        sum(case when event_type = 'created' then 1 else 0 end)::int as created,
        sum(case when event_type = 'sent' then 1 else 0 end)::int as sent,
        sum(case when event_type = 'won' then 1 else 0 end)::int as won,
        sum(case when event_type = 'lost' then 1 else 0 end)::int as lost
      from (
        select q.created_at as ts, 'created'::text as event_type from quotations q where ${quotationWhere}
        union all
        select nullif(q.sent_at, '')::timestamptz as ts, 'sent'::text as event_type from quotations q where ${quotationWhere} and nullif(q.sent_at, '') is not null
        union all
        select coalesce(nullif(q.closed_at, '')::timestamptz, q.created_at) as ts, 'won'::text as event_type from quotations q where ${quotationWhere} and q.status = 'won'
        union all
        select coalesce(nullif(q.closed_at, '')::timestamptz, q.created_at) as ts, 'lost'::text as event_type from quotations q where ${quotationWhere} and q.status = 'lost'
      ) events
      where ts >= ${windowStartIso}::timestamptz and ts < ${windowEndIso}::timestamptz
      group by 1
      order by 1
    )
    select bucket, created, sent, won, lost from points
  `);

  const revenueTrendRows = await db.execute<{
    bucket: string;
    quoted_amount: number;
    won_amount: number;
    lost_amount: number;
  }>(sql`
    with revenue_points as (
      select ${bucketExpr} as bucket,
        sum(case when event_type = 'quoted' then amount else 0 end)::float8 as quoted_amount,
        sum(case when event_type = 'won' then amount else 0 end)::float8 as won_amount,
        sum(case when event_type = 'lost' then amount else 0 end)::float8 as lost_amount
      from (
        select q.created_at as ts, 'quoted'::text as event_type, q.grand_total::float8 as amount from quotations q where ${quotationWhere}
        union all
        select coalesce(nullif(q.closed_at, '')::timestamptz, q.created_at) as ts, 'won'::text as event_type, q.grand_total::float8 as amount from quotations q where ${quotationWhere} and q.status = 'won'
        union all
        select coalesce(nullif(q.closed_at, '')::timestamptz, q.created_at) as ts, 'lost'::text as event_type, q.grand_total::float8 as amount from quotations q where ${quotationWhere} and q.status = 'lost'
      ) points
      where ts >= ${windowStartIso}::timestamptz and ts < ${windowEndIso}::timestamptz
      group by 1
      order by 1
    )
    select bucket, quoted_amount, won_amount, lost_amount from revenue_points
  `);

  const inquiryTrendRows = await db.execute<{
    bucket: string;
    incoming: number;
  }>(sql`
    select
      ${window.granularity === "month" ? sql.raw("to_char(date_trunc('month', i.created_at), 'YYYY-MM')") : sql.raw("to_char(date_trunc('day', i.created_at), 'YYYY-MM-DD')")} as bucket,
      count(*)::int as incoming
    from inquiries i
    where ${inquiryWhere}
    group by 1
    order by 1
  `);

  const [slaRaw] = await db.execute<{
    inquiry_within: number;
    inquiry_near: number;
    inquiry_breached: number;
    quote_within: number;
    quote_near: number;
    quote_breached: number;
    follow_within: number;
    follow_near: number;
    follow_breached: number;
    negotiation_within: number;
    negotiation_near: number;
    negotiation_breached: number;
  }>(sql`
    select
      (
        select count(*)::int from inquiries i
        where ${inquiryWhere}
          and i.status in ('new', 'in_progress')
            and i.created_at + interval '2 hours' > now() + interval '30 minutes'
      ) as inquiry_within,
      (
        select count(*)::int from inquiries i
        where ${inquiryWhere}
          and i.status in ('new', 'in_progress')
            and i.created_at + interval '2 hours' between now() and now() + interval '30 minutes'
      ) as inquiry_near,
      (
        select count(*)::int from inquiries i
        where ${inquiryWhere}
          and i.status in ('new', 'in_progress')
            and i.created_at + interval '2 hours' < now()
      ) as inquiry_breached,
      (
        select count(*)::int from inquiries i
        where ${inquiryWhere}
          and i.status in ('new', 'in_progress')
          and not exists (select 1 from quotations q where q.inquiry_id = i.id)
            and i.created_at + interval '24 hours' > now() + interval '2 hours'
      ) as quote_within,
      (
        select count(*)::int from inquiries i
        where ${inquiryWhere}
          and i.status in ('new', 'in_progress')
          and not exists (select 1 from quotations q where q.inquiry_id = i.id)
            and i.created_at + interval '24 hours' between now() and now() + interval '2 hours'
      ) as quote_near,
      (
        select count(*)::int from inquiries i
        where ${inquiryWhere}
          and i.status in ('new', 'in_progress')
          and not exists (select 1 from quotations q where q.inquiry_id = i.id)
            and i.created_at + interval '24 hours' < now()
      ) as quote_breached,
      (
        select count(*)::int from quotations q
        where ${quotationWhere}
          and q.status = 'sent'
          and coalesce(nullif(q.sent_at, '')::timestamptz, q.created_at) + interval '3 days' > now() + interval '12 hours'
      ) as follow_within,
      (
        select count(*)::int from quotations q
        where ${quotationWhere}
          and q.status = 'sent'
          and coalesce(nullif(q.sent_at, '')::timestamptz, q.created_at) + interval '3 days' between now() and now() + interval '12 hours'
      ) as follow_near,
      (
        select count(*)::int from quotations q
        where ${quotationWhere}
          and q.status = 'sent'
          and coalesce(nullif(q.sent_at, '')::timestamptz, q.created_at) + interval '3 days' < now()
      ) as follow_breached,
      (
        select count(*)::int from quotations q
        where ${quotationWhere}
          and q.status = 'sent'
          and coalesce(nullif(q.sent_at, '')::timestamptz + interval '7 days', q.created_at + interval '7 days') > now() + interval '12 hours'
      ) as negotiation_within,
      (
        select count(*)::int from quotations q
        where ${quotationWhere}
          and q.status = 'sent'
          and coalesce(nullif(q.sent_at, '')::timestamptz + interval '7 days', q.created_at + interval '7 days') between now() and now() + interval '12 hours'
      ) as negotiation_near,
      (
        select count(*)::int from quotations q
        where ${quotationWhere}
          and q.status = 'sent'
          and coalesce(nullif(q.sent_at, '')::timestamptz + interval '7 days', q.created_at + interval '7 days') < now()
      ) as negotiation_breached
  `);

  const quotationAgingRows = await db.execute<{
    bucket: string;
    count: number;
    amount: number;
  }>(sql`
    select
      case
        when now() - q.created_at < interval '3 days' then '0_2'
        when now() - q.created_at < interval '8 days' then '3_7'
        when now() - q.created_at < interval '16 days' then '8_15'
        else '15_plus'
      end as bucket,
      count(*)::int as count,
      coalesce(sum(q.grand_total::float8), 0)::float8 as amount
    from quotations q
    where ${quotationWhere}
      and q.status in ('draft', 'sent')
    group by 1
    order by 1
  `);

  const inquiryAgingRows = await db.execute<{
    bucket: string;
    count: number;
  }>(sql`
    select
      case
        when now() - i.created_at < interval '3 days' then '0_2'
        when now() - i.created_at < interval '8 days' then '3_7'
        when now() - i.created_at < interval '16 days' then '8_15'
        else '15_plus'
      end as bucket,
      count(*)::int as count
    from inquiries i
    where ${inquiryWhere}
      and i.status in ('new', 'in_progress', 'quoted')
    group by 1
    order by 1
  `);

  const [unassignedInquiries] = await db.execute<{ count: number }>(sql`
    select count(*)::int as count
    from inquiries i
    where ${inquiryWhere}
      and i.status = 'new'
      and i.assigned_to is null
  `);

  const [expiringQuotes] = await db.execute<{ count: number; amount: number }>(sql`
    select
      count(*)::int as count,
      coalesce(sum(q.grand_total::float8), 0)::float8 as amount
    from quotations q
    where ${quotationWhere}
      and q.status in ('draft', 'sent')
      and q.grand_total::float8 >= 100000
      and to_date(q.quotation_date, 'YYYY-MM-DD') + q.validity_days = current_date
  `);

  const [funnelRaw] = await db.execute<{
    inquiries_received: number;
    quote_prepared: number;
    quote_sent: number;
    negotiation: number;
    won: number;
    lost: number;
  }>(sql`
    select
      (select count(*)::int from inquiries i where ${inquiryWhere}) as inquiries_received,
      (select count(*)::int from quotations q where ${quotationWhere}) as quote_prepared,
      (select count(*)::int from quotations q where ${quotationWhere} and (q.status <> 'draft' or nullif(q.sent_at, '') is not null)) as quote_sent,
      (select count(*)::int from quotations q where ${quotationWhere} and q.status = 'sent') as negotiation,
      (select count(*)::int from quotations q where ${quotationWhere} and q.status = 'won') as won,
      (select count(*)::int from quotations q where ${quotationWhere} and q.status = 'lost') as lost
  `);

  const lostReasonRows = await db.execute<{
    reason: string;
    count: number;
    amount: number;
  }>(sql`
    select
      'Not captured'::text as reason,
      count(*)::int as count,
      coalesce(sum(q.grand_total::float8), 0)::float8 as amount
    from quotations q
    where ${quotationWhere}
      and q.status = 'lost'
    group by 1
    order by 2 desc, 1 asc
  `);

  const [onboardingRaw] = await db.execute<{
    avg_inquiry_days: number | null;
    avg_quotation_days: number | null;
    avg_win_days: number | null;
    fastest_win_days: number | null;
    slowest_win_days: number | null;
    sample_size: number;
  }>(sql`
    with firsts as (
      select
        c.id,
        c.created_at,
        (select min(i.created_at) from inquiries i where i.customer_id = c.id) as first_inquiry_at,
        (select min(q.created_at) from quotations q where q.customer_id = c.id) as first_quotation_at,
        (select min(coalesce(nullif(q.closed_at, '')::timestamptz, q.created_at)) from quotations q where q.customer_id = c.id and q.status = 'won') as first_win_at
      from customers c
      where (${filters.customerId ? sql`c.id = ${filters.customerId}` : sql`true`})
    )
    select
      avg(extract(epoch from (first_inquiry_at - created_at)) / 86400.0)::float8 as avg_inquiry_days,
      avg(extract(epoch from (first_quotation_at - created_at)) / 86400.0)::float8 as avg_quotation_days,
      avg(extract(epoch from (first_win_at - created_at)) / 86400.0)::float8 as avg_win_days,
      min(extract(epoch from (first_win_at - created_at)) / 86400.0)::float8 as fastest_win_days,
      max(extract(epoch from (first_win_at - created_at)) / 86400.0)::float8 as slowest_win_days,
      count(first_win_at)::int as sample_size
    from firsts
  `);

  const revenueGrowthPct = pctChange(revenueKpi?.current_month ?? 0, revenueKpi?.previous_month ?? 0);
  const comparisonRows: ComparisonRow[] = [
    {
      key: "inquiries",
      label: "Inquiries",
      current: comparisonRaw?.current_inquiries ?? 0,
      previous: comparisonRaw?.previous_inquiries ?? 0,
      changePct: pctChange(comparisonRaw?.current_inquiries ?? 0, comparisonRaw?.previous_inquiries ?? 0),
    },
    {
      key: "quotations",
      label: "Quotations",
      current: comparisonRaw?.current_quotations ?? 0,
      previous: comparisonRaw?.previous_quotations ?? 0,
      changePct: pctChange(comparisonRaw?.current_quotations ?? 0, comparisonRaw?.previous_quotations ?? 0),
    },
    {
      key: "wins",
      label: "Wins",
      current: comparisonRaw?.current_wins ?? 0,
      previous: comparisonRaw?.previous_wins ?? 0,
      changePct: pctChange(comparisonRaw?.current_wins ?? 0, comparisonRaw?.previous_wins ?? 0),
    },
    {
      key: "revenue",
      label: "Revenue",
      current: comparisonRaw?.current_revenue ?? 0,
      previous: comparisonRaw?.previous_revenue ?? 0,
      changePct: pctChange(comparisonRaw?.current_revenue ?? 0, comparisonRaw?.previous_revenue ?? 0),
    },
    {
      key: "new_customers",
      label: "New Customers",
      current: comparisonRaw?.current_customers ?? 0,
      previous: comparisonRaw?.previous_customers ?? 0,
      changePct: pctChange(comparisonRaw?.current_customers ?? 0, comparisonRaw?.previous_customers ?? 0),
    },
  ];

  const quoteAmountAged = quotationAgingRows
    .filter((row) => row.bucket === "8_15" || row.bucket === "15_plus")
    .reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const agedQuoteCount = quotationAgingRows
    .filter((row) => row.bucket === "8_15" || row.bucket === "15_plus")
    .reduce((sum, row) => sum + Number(row.count ?? 0), 0);

  const actionCenter: ActionAlert[] = [
    {
      id: "overdue-followup",
      tone: (quotationKpi?.overdue_followup ?? 0) > 0 ? "danger" : "default",
      title: `${quotationKpi?.overdue_followup ?? 0} quotations overdue follow-up`,
      description: "Sent quotations that crossed the 3-day follow-up SLA.",
      count: quotationKpi?.overdue_followup ?? 0,
      href: buildHref("/quotations", { overdueFollowup: true }),
    },
    {
      id: "aged-pipeline",
      tone: agedQuoteCount > 0 ? "warning" : "default",
      title: `${agedQuoteCount} pending quotations aging >7 days`,
      description: "Commercial exposure sitting in the pipeline beyond one week.",
      count: agedQuoteCount,
      amount: quoteAmountAged,
      href: buildHref("/quotations", { ageBucket: "8_15" }),
    },
    {
      id: "unassigned-inquiries",
      tone: (unassignedInquiries?.count ?? 0) > 0 ? "danger" : "default",
      title: `${unassignedInquiries?.count ?? 0} new inquiries unassigned`,
      description: "Fresh demand that has no owner yet.",
      count: unassignedInquiries?.count ?? 0,
      href: buildHref("/inquiries", { status: "new", unassigned: true }),
    },
    {
      id: "expiring-high-value",
      tone: (expiringQuotes?.count ?? 0) > 0 ? "warning" : "default",
      title: `${expiringQuotes?.count ?? 0} high-value quotes expiring today`,
      description: "Quotations above Rs 1 lakh reaching validity end today.",
      count: expiringQuotes?.count ?? 0,
      amount: expiringQuotes?.amount ?? 0,
      href: buildHref("/quotations", { slaState: "near" }),
    },
  ];

  const funnelValues = [
    { key: "inquiry_received", label: "Inquiry Received", count: funnelRaw?.inquiries_received ?? 0, href: buildHref("/inquiries", {}) },
    { key: "quote_prepared", label: "Quote Prepared", count: funnelRaw?.quote_prepared ?? 0, href: buildHref("/quotations", { status: "draft" }) },
    { key: "quote_sent", label: "Quote Sent", count: funnelRaw?.quote_sent ?? 0, href: buildHref("/quotations", { status: "sent" }) },
    { key: "negotiation", label: "Negotiation", count: funnelRaw?.negotiation ?? 0, href: buildHref("/quotations", { status: "sent" }) },
    { key: "won", label: "Won", count: funnelRaw?.won ?? 0, href: buildHref("/quotations", { status: "won" }) },
    { key: "lost", label: "Lost", count: funnelRaw?.lost ?? 0, href: buildHref("/quotations", { status: "lost" }) },
  ];
  const funnel: FunnelStage[] = funnelValues.map((stage, index) => ({
    ...stage,
    conversionPct: index === 0 ? null : stageConversion(stage.count, funnelValues[index - 1]?.count ?? 0),
  }));

  return {
    generatedAt: new Date().toISOString(),
    dateWindow: {
      preset: window.preset,
      startDate: toDateParam(window.startDate),
      endDate: toDateParam(addDays(window.endDateExclusive, -1)),
      previousStartDate: toDateParam(window.previousStartDate),
      previousEndDate: toDateParam(addDays(window.previousEndDateExclusive, -1)),
      granularity: window.granularity,
    },
    supportedFilters: SUPPORTED_FILTERS,
    filters,
    kpis: {
      quotations: {
        total: quotationKpi?.total ?? 0,
        pendingApproval: quotationKpi?.pending_approval ?? 0,
        sentToday: quotationKpi?.sent_today ?? 0,
        overdueFollowUp: quotationKpi?.overdue_followup ?? 0,
        ctaHref: buildHref("/quotations", { status: "draft" }),
      },
      inquiries: {
        open: inquiryKpi?.open_count ?? 0,
        newToday: inquiryKpi?.new_today ?? 0,
        needQuotation: inquiryKpi?.need_quotation ?? 0,
        slaBreached: inquiryKpi?.sla_breached ?? 0,
        ctaHref: buildHref("/inquiries", { status: "new" }),
      },
      customers: {
        total: customerKpi?.total ?? 0,
        newThisMonth: customerKpi?.new_this_month ?? 0,
        inactive30Days: customerKpi?.inactive_30_days ?? 0,
        repeatCustomersPct: Number(customerKpi?.repeat_pct ?? 0),
        ctaHref: buildHref("/customers", {}),
      },
      revenue: {
        wonThisMonth: revenueKpi?.current_month ?? 0,
        wonPreviousMonth: revenueKpi?.previous_month ?? 0,
        growthPct: revenueGrowthPct,
        direction: directionFromGrowth(revenueGrowthPct),
        ctaHref: buildHref("/quotations", { status: "won" }),
      },
    },
    comparison: {
      currentLabel: monthCurrentStart.toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }),
      previousLabel: monthPreviousStart.toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }),
      rows: comparisonRows,
    },
    trends: {
      quotations: Array.from(quotationTrendRows).map((row) => ({ bucket: row.bucket, created: row.created, sent: row.sent, won: row.won, lost: row.lost })),
      revenue: Array.from(revenueTrendRows).map((row) => ({ bucket: row.bucket, quotedAmount: row.quoted_amount, wonAmount: row.won_amount, lostAmount: row.lost_amount })),
      inquiries: Array.from(inquiryTrendRows).map((row) => ({ bucket: row.bucket, incoming: row.incoming })),
    },
    sla: {
      inquiries: {
        acknowledgement: {
          within: slaRaw?.inquiry_within ?? 0,
          near: slaRaw?.inquiry_near ?? 0,
          breached: slaRaw?.inquiry_breached ?? 0,
          href: buildHref("/inquiries", { slaState: "breached" }),
        },
        quotationCreation: {
          within: slaRaw?.quote_within ?? 0,
          near: slaRaw?.quote_near ?? 0,
          breached: slaRaw?.quote_breached ?? 0,
          href: buildHref("/inquiries", { needsQuotation: true }),
        },
      },
      quotations: {
        followUp: {
          within: slaRaw?.follow_within ?? 0,
          near: slaRaw?.follow_near ?? 0,
          breached: slaRaw?.follow_breached ?? 0,
          href: buildHref("/quotations", { overdueFollowup: true }),
        },
        negotiationClosure: {
          within: slaRaw?.negotiation_within ?? 0,
          near: slaRaw?.negotiation_near ?? 0,
          breached: slaRaw?.negotiation_breached ?? 0,
          href: buildHref("/quotations", { status: "sent" }),
        },
      },
    },
    aging: {
      quotations: Array.from(quotationAgingRows).map((row) => ({
        bucket: row.bucket,
        count: row.count,
        amount: row.amount,
        href: buildHref("/quotations", { ageBucket: row.bucket }),
      })),
      inquiries: Array.from(inquiryAgingRows).map((row) => ({
        bucket: row.bucket,
        count: row.count,
        href: buildHref("/inquiries", { ageBucket: row.bucket }),
      })),
    },
    actionCenter,
    funnel,
    lostReasons: Array.from(lostReasonRows).map((row) => ({ reason: row.reason, count: row.count, amount: row.amount })),
    onboarding: {
      avgInquiryDays: roundMetric(onboardingRaw?.avg_inquiry_days),
      avgQuotationDays: roundMetric(onboardingRaw?.avg_quotation_days),
      avgWinDays: roundMetric(onboardingRaw?.avg_win_days),
      fastestWinDays: roundMetric(onboardingRaw?.fastest_win_days),
      slowestWinDays: roundMetric(onboardingRaw?.slowest_win_days),
      sampleSize: onboardingRaw?.sample_size ?? 0,
    },
  };
}
