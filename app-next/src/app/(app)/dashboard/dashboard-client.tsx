"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  FileText,
  Inbox,
  RefreshCw,
  Users,
  Zap,
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

function lastTrendValue(points: Array<{ bucket: string; [k: string]: number | string | undefined }>, key: string) {
  const last = points[points.length - 1];
  if (!last) return 0;
  const n = Number(last[key] ?? 0);
  return Number.isFinite(n) ? n : 0;
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

type OpenImpact = {
  id: number;
  impactedEntityType: string;
  impactedEntityId: string;
  impactReason: string;
  revisionStatus: string;
  createdAt: string;
  bomId?: number;
  bomCode?: string;
};

function OpenImpactsWidget() {
  const { data, loading, refresh } = useResource<{ impacts: OpenImpact[]; total: number }>(
    "/api/change-propagation/open-impacts",
  );
  const [acking, setAcking] = React.useState<number | null>(null);

  async function acknowledge(id: number) {
    setAcking(id);
    try {
      await fetch(`/api/change-propagation/impacts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "acknowledge" }),
      });
      refresh();
    } finally {
      setAcking(null);
    }
  }

  const impacts = data?.impacts ?? [];

  if (!loading && impacts.length === 0) return null;

  return (
    <Card className="border-amber-400/60 bg-amber-50/30 dark:bg-amber-950/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Zap className="h-4 w-4 text-amber-500" />
            BOM Change Impacts
            {data?.total ? (
              <Badge variant="warning" className="ml-1">{data.total}</Badge>
            ) : null}
          </CardTitle>
          <Button type="button" variant="ghost" size="sm" onClick={refresh}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
        <CardDescription>Production orders and purchase orders needing review after BOM updates</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {impacts.slice(0, 8).map((impact) => (
              <div
                key={impact.id}
                className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 truncate font-medium">
                    <span className="capitalize text-muted-foreground">
                      {impact.impactedEntityType.replace("_", " ")}
                    </span>
                    <span>#{impact.impactedEntityId}</span>
                  </div>
                  <div className="truncate text-xs text-muted-foreground">{impact.impactReason}</div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge
                    variant={
                      impact.revisionStatus === "needs_revision"
                        ? "destructive"
                        : impact.revisionStatus === "acknowledged"
                          ? "warning"
                          : "success"
                    }
                    className="text-[10px]"
                  >
                    {impact.revisionStatus.replace("_", " ")}
                  </Badge>
                  {impact.revisionStatus === "needs_revision" && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-6 px-2 text-[11px]"
                      disabled={acking === impact.id}
                      onClick={() => acknowledge(impact.id)}
                    >
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      Ack
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {(data?.total ?? 0) > 8 && (
              <p className="text-center text-xs text-muted-foreground">
                +{(data?.total ?? 0) - 8} more impacts
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
            <Card>
              <CardContent className="p-3">
                <div className="text-[11px] text-muted-foreground">Quotations</div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-2xl font-semibold tabular-nums">{data.kpis.quotations.total}</span>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">Pending {data.kpis.quotations.pendingApproval}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="text-[11px] text-muted-foreground">Inquiries Open</div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-2xl font-semibold tabular-nums">{data.kpis.inquiries.open}</span>
                  <Inbox className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">Need quote {data.kpis.inquiries.needQuotation}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="text-[11px] text-muted-foreground">Revenue Won</div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-xl font-semibold tabular-nums">{formatINR(data.kpis.revenue.wonThisMonth)}</span>
                  {data.kpis.revenue.direction === "up" ? (
                    <ArrowUpRight className="h-4 w-4 text-emerald-600" />
                  ) : data.kpis.revenue.direction === "down" ? (
                    <ArrowDownRight className="h-4 w-4 text-destructive" />
                  ) : (
                    <Clock3 className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className={`mt-1 text-[11px] ${toneClass(data.kpis.revenue.growthPct)}`}>{pctText(data.kpis.revenue.growthPct)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="text-[11px] text-muted-foreground">Customers</div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-2xl font-semibold tabular-nums">{data.kpis.customers.total}</span>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">New {data.kpis.customers.newThisMonth}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="text-[11px] text-muted-foreground">SLA Breaches</div>
                <div className="mt-1 text-2xl font-semibold tabular-nums text-destructive">
                  {data.kpis.inquiries.slaBreached + data.kpis.quotations.overdueFollowUp}
                </div>
                <div className="mt-1 text-[11px] text-muted-foreground">Inq + quotation</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <div className="text-[11px] text-muted-foreground">Sent Today</div>
                <div className="mt-1 text-2xl font-semibold tabular-nums">{data.kpis.quotations.sentToday}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">New inquiries {data.kpis.inquiries.newToday}</div>
              </CardContent>
            </Card>
          </div>

          <OpenImpactsWidget />

          <div className="grid gap-3 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Quotations Trend</CardTitle>
                <CardDescription>Created, sent, won, lost</CardDescription>
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
                <CardTitle className="text-sm">Revenue Trend</CardTitle>
                <CardDescription>Quoted vs won vs lost</CardDescription>
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
          </div>

          <div className="grid gap-3 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm">Recent Activity</CardTitle>
                <CardDescription>Latest business movement in selected window</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="rounded-md bg-muted/30 px-2.5 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span>Revenue growth this period</span>
                    <span className={`font-medium ${toneClass(data.kpis.revenue.growthPct)}`}>{pctText(data.kpis.revenue.growthPct)}</span>
                  </div>
                </div>
                <div className="rounded-md bg-muted/30 px-2.5 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span>Latest inquiries bucket</span>
                    <span className="font-medium tabular-nums">{lastTrendValue(data.trends.inquiries, "incoming")}</span>
                  </div>
                </div>
                <div className="rounded-md bg-muted/30 px-2.5 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span>Quotation wins in latest bucket</span>
                    <span className="font-medium tabular-nums text-emerald-600">{lastTrendValue(data.trends.quotations, "won")}</span>
                  </div>
                </div>
                <div className="rounded-md bg-muted/30 px-2.5 py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span>Current vs previous period volume</span>
                    <span className="font-medium">{data.comparison.currentLabel} vs {data.comparison.previousLabel}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button asChild size="sm" variant="outline"><Link href={data.kpis.quotations.ctaHref}>Quotations</Link></Button>
                  <Button asChild size="sm" variant="outline"><Link href={data.kpis.inquiries.ctaHref}>Inquiries</Link></Button>
                  <Button asChild size="sm" variant="outline"><Link href={data.kpis.revenue.ctaHref}>Won Deals</Link></Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Alerts</CardTitle>
                <CardDescription>Priority exceptions needing action</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link href={data.sla.inquiries.quotationCreation.href} className="block rounded-md bg-muted/30 px-2.5 py-2 text-sm transition-colors hover:bg-muted/50">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2"><AlertTriangle className="h-3.5 w-3.5 text-destructive" /> Inquiry SLA breached</span>
                    <span className="font-medium tabular-nums text-destructive">{data.sla.inquiries.quotationCreation.breached}</span>
                  </div>
                </Link>
                <Link href={data.sla.quotations.followUp.href} className="block rounded-md bg-muted/30 px-2.5 py-2 text-sm transition-colors hover:bg-muted/50">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2"><AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Quotation follow-up due</span>
                    <span className="font-medium tabular-nums">{data.sla.quotations.followUp.near + data.sla.quotations.followUp.breached}</span>
                  </div>
                </Link>
                {data.actionCenter.slice(0, 4).map((a) => (
                  <Link key={a.id} href={a.href} className="block rounded-md bg-muted/30 px-2.5 py-2 text-sm transition-colors hover:bg-muted/50">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate">{a.title}</span>
                      <span className="font-medium tabular-nums">{a.count}</span>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
