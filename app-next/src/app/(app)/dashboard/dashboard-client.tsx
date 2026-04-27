"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Clock3,
  FileText,
  Inbox,
  RefreshCw,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CardSkeleton } from "@/components/table-skeleton";
import { useResource } from "@/lib/hooks";
import { formatINR } from "@/lib/utils";

const PRESETS = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "this_month", label: "This Month" },
  { value: "6m", label: "6M" },
] as const;

type Preset = (typeof PRESETS)[number]["value"];

type DashboardOverview = {
  generatedAt: string;
  dateWindow: {
    preset: Preset;
    startDate: string;
    endDate: string;
    previousStartDate: string;
    previousEndDate: string;
    granularity: "day" | "month";
  };
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
    rows: Array<{
      key: string;
      label: string;
      current: number;
      previous: number;
      changePct: number | null;
    }>;
  };
  trends: {
    quotations: Array<{ bucket: string; created?: number; sent?: number; won?: number; lost?: number }>;
    revenue: Array<{ bucket: string; quotedAmount?: number; wonAmount?: number; lostAmount?: number }>;
    inquiries: Array<{ bucket: string; incoming?: number }>;
  };
  sla: {
    inquiries: {
      acknowledgement: { within: number; near: number; breached: number; href: string };
      quotationCreation: { within: number; near: number; breached: number; href: string };
    };
    quotations: {
      followUp: { within: number; near: number; breached: number; href: string };
      negotiationClosure: { within: number; near: number; breached: number; href: string };
    };
  };
  aging: {
    quotations: Array<{ bucket: string; count: number; amount?: number; href: string }>;
    inquiries: Array<{ bucket: string; count: number; href: string }>;
  };
  actionCenter: Array<{
    id: string;
    tone: "default" | "warning" | "danger" | "success";
    title: string;
    description: string;
    count: number;
    amount?: number;
    href: string;
  }>;
  funnel: Array<{
    key: string;
    label: string;
    count: number;
    conversionPct: number | null;
    href: string;
  }>;
};

function pctText(v: number | null) {
  if (v == null) return "New baseline";
  return `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
}

function toneClass(v: number | null) {
  if (v == null || v === 0) return "text-muted-foreground";
  return v > 0 ? "text-emerald-600" : "text-destructive";
}

function PolylineChart({
  data,
  series,
  yFormat,
}: {
  data: Array<Record<string, number | string | undefined>>;
  series: Array<{ key: string; label: string; color: string }>;
  yFormat?: (n: number) => string;
}) {
  const width = 760;
  const height = 220;
  const pad = 24;
  const maxY = Math.max(
    1,
    ...data.flatMap((d) =>
      series.map((s) => {
        const v = Number(d[s.key] ?? 0);
        return Number.isFinite(v) ? v : 0;
      }),
    ),
  );

  const toPoint = (i: number, v: number) => {
    const x = pad + ((width - pad * 2) * i) / Math.max(1, data.length - 1);
    const y = height - pad - ((height - pad * 2) * v) / maxY;
    return `${x},${y}`;
  };

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full min-w-[680px]">
          <line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke="hsl(var(--border))" />
          <line x1={pad} y1={pad} x2={pad} y2={height - pad} stroke="hsl(var(--border))" />
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const y = height - pad - (height - pad * 2) * t;
            const label = yFormat ? yFormat(Math.round(maxY * t)) : String(Math.round(maxY * t));
            return (
              <g key={t}>
                <line x1={pad} y1={y} x2={width - pad} y2={y} stroke="hsl(var(--muted))" strokeDasharray="3 3" />
                <text x={4} y={y + 4} fontSize="10" fill="hsl(var(--muted-foreground))">{label}</text>
              </g>
            );
          })}
          {series.map((s) => {
            const points = data.map((d, i) => toPoint(i, Number(d[s.key] ?? 0))).join(" ");
            return <polyline key={s.key} fill="none" stroke={s.color} strokeWidth="2.5" points={points} />;
          })}
        </svg>
      </div>
      <div className="flex flex-wrap gap-3 text-xs">
        {series.map((s) => (
          <div key={s.key} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            <span className="text-muted-foreground">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AgingBars({
  rows,
  showAmount,
}: {
  rows: Array<{ bucket: string; count: number; amount?: number; href: string }>;
  showAmount?: boolean;
}) {
  const total = Math.max(1, rows.reduce((s, r) => s + r.count, 0));
  const labelOf: Record<string, string> = {
    "0_2": "0-2 days",
    "3_7": "3-7 days",
    "8_15": "8-15 days",
    "15_plus": "15+ days",
  };

  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <Link key={r.bucket} href={r.href} className="block rounded-md border p-3 transition-colors hover:bg-muted/40">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">{labelOf[r.bucket] ?? r.bucket}</span>
            <span className="text-muted-foreground">{r.count} items</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded bg-muted">
            <div className="h-full rounded bg-primary" style={{ width: `${(r.count / total) * 100}%` }} />
          </div>
          {showAmount && r.amount != null ? (
            <div className="mt-2 text-xs text-muted-foreground">Value: {formatINR(r.amount)}</div>
          ) : null}
        </Link>
      ))}
    </div>
  );
}

function StatusPill({ label, value, tone }: { label: string; value: number; tone: "success" | "warning" | "destructive" }) {
  const variant = tone === "success" ? "success" : tone === "warning" ? "warning" : "destructive";
  return (
    <div className="flex items-center justify-between rounded-md border p-2.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Badge variant={variant}>{value}</Badge>
    </div>
  );
}

export function DashboardClient() {
  const [preset, setPreset] = React.useState<Preset>("30d");
  const { data, loading, error, refresh } = useResource<DashboardOverview>(`/api/dashboard/overview?preset=${preset}`);

  return (
    <div className="space-y-6 animate-in fade-in-50">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Live business control tower for quotations and inquiries.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <Button key={p.value} type="button" variant={preset === p.value ? "default" : "outline"} size="sm" onClick={() => setPreset(p.value)}>
              {p.label}
            </Button>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
      ) : null}

      {loading || !data ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Quotations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-3xl font-semibold">{data.kpis.quotations.total}</span>
                  <FileText className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="text-xs text-muted-foreground">Pending: {data.kpis.quotations.pendingApproval}</div>
                <div className="text-xs text-muted-foreground">Sent today: {data.kpis.quotations.sentToday}</div>
                <div className="text-xs text-destructive">Overdue follow-up: {data.kpis.quotations.overdueFollowUp}</div>
                <Button asChild size="sm" variant="outline" className="mt-2 w-full">
                  <Link href={data.kpis.quotations.ctaHref}>View Pending</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Inquiries</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-3xl font-semibold">{data.kpis.inquiries.open}</span>
                  <Inbox className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="text-xs text-muted-foreground">New today: {data.kpis.inquiries.newToday}</div>
                <div className="text-xs text-muted-foreground">Need quotation: {data.kpis.inquiries.needQuotation}</div>
                <div className="text-xs text-destructive">SLA breached: {data.kpis.inquiries.slaBreached}</div>
                <Button asChild size="sm" variant="outline" className="mt-2 w-full">
                  <Link href={data.kpis.inquiries.ctaHref}>Open Queue</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Customers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-3xl font-semibold">{data.kpis.customers.total}</span>
                  <Users className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="text-xs text-muted-foreground">New this month: {data.kpis.customers.newThisMonth}</div>
                <div className="text-xs text-muted-foreground">Inactive &gt;30d: {data.kpis.customers.inactive30Days}</div>
                <div className="text-xs text-muted-foreground">Repeat customers: {data.kpis.customers.repeatCustomersPct.toFixed(1)}%</div>
                <Button asChild size="sm" variant="outline" className="mt-2 w-full">
                  <Link href={data.kpis.customers.ctaHref}>View Customers</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Revenue</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-semibold">{formatINR(data.kpis.revenue.wonThisMonth)}</span>
                  {data.kpis.revenue.direction === "up" ? (
                    <ArrowUpRight className="h-5 w-5 text-emerald-600" />
                  ) : data.kpis.revenue.direction === "down" ? (
                    <ArrowDownRight className="h-5 w-5 text-destructive" />
                  ) : (
                    <Clock3 className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="text-xs text-muted-foreground">Prev month: {formatINR(data.kpis.revenue.wonPreviousMonth)}</div>
                <div className={`text-xs font-medium ${toneClass(data.kpis.revenue.growthPct)}`}>
                  Growth: {pctText(data.kpis.revenue.growthPct)}
                </div>
                <Button asChild size="sm" variant="outline" className="mt-2 w-full">
                  <Link href={data.kpis.revenue.ctaHref}>View Won</Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Current vs Previous Month</CardTitle>
              <CardDescription>{data.comparison.currentLabel} compared to {data.comparison.previousLabel}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.comparison.rows.map((r) => (
                <div key={r.key} className="grid grid-cols-[1.5fr_1fr_1fr_1fr] items-center gap-2 rounded-md border p-2.5 text-sm">
                  <div className="font-medium">{r.label}</div>
                  <div className="text-right tabular-nums">{r.key === "revenue" ? formatINR(r.current) : r.current}</div>
                  <div className="text-right tabular-nums text-muted-foreground">{r.key === "revenue" ? formatINR(r.previous) : r.previous}</div>
                  <div className={`text-right tabular-nums font-medium ${toneClass(r.changePct)}`}>{pctText(r.changePct)}</div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Quotations Trend</CardTitle>
                <CardDescription>Created, sent, won and lost trend for selected period.</CardDescription>
              </CardHeader>
              <CardContent>
                <PolylineChart
                  data={data.trends.quotations}
                  series={[
                    { key: "created", label: "Created", color: "#2563eb" },
                    { key: "sent", label: "Sent", color: "#0ea5e9" },
                    { key: "won", label: "Won", color: "#16a34a" },
                    { key: "lost", label: "Lost", color: "#dc2626" },
                  ]}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Action Center</CardTitle>
                <CardDescription>Top priority actions right now.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.actionCenter.map((a) => (
                  <Link key={a.id} href={a.href} className="block rounded-md border p-3 transition-colors hover:bg-muted/40">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className={`mt-0.5 h-4 w-4 ${a.tone === "danger" ? "text-destructive" : a.tone === "warning" ? "text-amber-500" : "text-muted-foreground"}`} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium leading-tight">{a.title}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{a.description}</div>
                        {a.amount != null ? (
                          <div className="mt-1 text-xs font-medium text-muted-foreground">{formatINR(a.amount)}</div>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Revenue Trend</CardTitle>
                <CardDescription>Quoted vs won vs lost value trend.</CardDescription>
              </CardHeader>
              <CardContent>
                <PolylineChart
                  data={data.trends.revenue}
                  series={[
                    { key: "quotedAmount", label: "Quoted", color: "#2563eb" },
                    { key: "wonAmount", label: "Won", color: "#16a34a" },
                    { key: "lostAmount", label: "Lost", color: "#dc2626" },
                  ]}
                  yFormat={(n) => (n >= 100000 ? `${(n / 100000).toFixed(1)}L` : `${Math.round(n / 1000)}k`)}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Inquiry Trend</CardTitle>
                <CardDescription>Daily incoming inquiries.</CardDescription>
              </CardHeader>
              <CardContent>
                <PolylineChart
                  data={data.trends.inquiries}
                  series={[{ key: "incoming", label: "Incoming", color: "#7c3aed" }]}
                />
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Inquiry SLA</CardTitle>
                <CardDescription>Acknowledge in 2h and quote in 24h.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">Acknowledgement</div>
                  <StatusPill label="Within SLA" value={data.sla.inquiries.acknowledgement.within} tone="success" />
                  <StatusPill label="Near breach" value={data.sla.inquiries.acknowledgement.near} tone="warning" />
                  <StatusPill label="Breached" value={data.sla.inquiries.acknowledgement.breached} tone="destructive" />
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">Quotation creation</div>
                  <StatusPill label="Within SLA" value={data.sla.inquiries.quotationCreation.within} tone="success" />
                  <StatusPill label="Near breach" value={data.sla.inquiries.quotationCreation.near} tone="warning" />
                  <StatusPill label="Breached" value={data.sla.inquiries.quotationCreation.breached} tone="destructive" />
                </div>
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link href={data.sla.inquiries.quotationCreation.href}>Open Inquiry SLA Queue</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quotation SLA</CardTitle>
                <CardDescription>Follow-up in 3d and negotiation closure in 7d.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">Follow-up</div>
                  <StatusPill label="Within SLA" value={data.sla.quotations.followUp.within} tone="success" />
                  <StatusPill label="Near breach" value={data.sla.quotations.followUp.near} tone="warning" />
                  <StatusPill label="Breached" value={data.sla.quotations.followUp.breached} tone="destructive" />
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">Negotiation closure</div>
                  <StatusPill label="Within SLA" value={data.sla.quotations.negotiationClosure.within} tone="success" />
                  <StatusPill label="Near breach" value={data.sla.quotations.negotiationClosure.near} tone="warning" />
                  <StatusPill label="Breached" value={data.sla.quotations.negotiationClosure.breached} tone="destructive" />
                </div>
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link href={data.sla.quotations.followUp.href}>Open Quotation SLA Queue</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sales Funnel</CardTitle>
                <CardDescription>Inquiry to win conversion path.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.funnel.map((s) => (
                  <Link key={s.key} href={s.href} className="block rounded-md border p-2.5 transition-colors hover:bg-muted/40">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{s.label}</span>
                      <span className="tabular-nums">{s.count}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {s.conversionPct == null ? "Base stage" : `Conversion: ${s.conversionPct.toFixed(1)}%`}
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quotations Aging</CardTitle>
                <CardDescription>Pending work by age bucket.</CardDescription>
              </CardHeader>
              <CardContent>
                <AgingBars rows={data.aging.quotations} showAmount />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Inquiry Aging</CardTitle>
                <CardDescription>Open inquiry pressure by age bucket.</CardDescription>
              </CardHeader>
              <CardContent>
                <AgingBars rows={data.aging.inquiries} />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
