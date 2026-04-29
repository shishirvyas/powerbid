"use client";

import * as React from "react";
import { Building2, FileText, Package, Pencil, Save, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { QuotationStatusBadge } from "@/components/status-badges";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useResource } from "@/lib/hooks";
import { formatCurrency } from "@/lib/calc";

type ReportData = {
  counts: { customers: number; products: number; inquiries: number; quotations: number };
  byStatus: { status: string; count: number; total: number }[];
  byMonth: { month: string; count: number; total: number }[];
  topCustomers: { id: number; name: string; total: number; count: number }[];
  communications: {
    byChannel: { channel: string; total: number; sent: number; failed: number; queued: number }[];
    byDay: { day: string; sent: number; failed: number }[];
  };
};

type ReportSection = "status" | "months" | "customers" | "reliability" | "delivery";

const STAT_ICONS = {
  customers: Users,
  products: Package,
  inquiries: FileText,
  quotations: Building2,
};

export function ReportsClient() {
  const { data, loading, error } = useResource<ReportData>("/api/reports");
  const [selected, setSelected] = React.useState<ReportSection>("status");
  const [editing, setEditing] = React.useState(false);
  const [warnThreshold, setWarnThreshold] = React.useState("90");
  const [dangerThreshold, setDangerThreshold] = React.useState("80");

  if (error) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {error}
      </div>
    );
  }
  if (loading || !data) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }

  const monthMax = Math.max(1, ...data.byMonth.map((m) => m.total));
  const statusMax = Math.max(1, ...data.byStatus.map((s) => s.total));

  const sections: Array<{ key: ReportSection; label: string; count?: number }> = [
    { key: "status", label: "Pipeline by status", count: data.byStatus.length },
    { key: "months", label: "Monthly trend", count: data.byMonth.length },
    { key: "customers", label: "Top customers", count: data.topCustomers.length },
    { key: "reliability", label: "Comm reliability", count: data.communications.byChannel.length },
    { key: "delivery", label: "Delivery trend", count: data.communications.byDay.length },
  ];

  return (
    <div className="space-y-4 animate-in fade-in-50">
      <PageHeader title="Reports" description="At-a-glance pipeline, revenue and customer insights." />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(Object.keys(data.counts) as (keyof typeof data.counts)[]).map((k) => {
          const Icon = STAT_ICONS[k];
          return (
            <Card key={k}>
              <CardContent className="flex items-center gap-3 p-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{k}</div>
                  <div className="text-xl font-semibold tabular-nums">{data.counts[k].toLocaleString("en-IN")}</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.55fr)]">
        <aside className="rounded-xl border bg-card p-3">
          <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Report sections</div>
          <div className="space-y-1">
            {sections.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSelected(s.key)}
                className={[
                  "flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                  selected === s.key ? "bg-muted" : "hover:bg-muted/50",
                ].join(" ")}
              >
                <span>{s.label}</span>
                <span className="tabular-nums text-xs text-muted-foreground">{s.count}</span>
              </button>
            ))}
          </div>

          <div className="mt-3 rounded-md border p-2.5">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Inline alert thresholds</div>
              {!editing ? (
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                  <Save className="h-4 w-4" /> Done
                </Button>
              )}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <div className="mb-1 text-xs text-muted-foreground">Warn below %</div>
                {editing ? <Input value={warnThreshold} onChange={(e) => setWarnThreshold(e.target.value)} /> : <div className="text-sm">{warnThreshold}%</div>}
              </div>
              <div>
                <div className="mb-1 text-xs text-muted-foreground">Danger below %</div>
                {editing ? <Input value={dangerThreshold} onChange={(e) => setDangerThreshold(e.target.value)} /> : <div className="text-sm">{dangerThreshold}%</div>}
              </div>
            </div>
          </div>
        </aside>

        <section className="rounded-xl border bg-card p-3">
          {selected === "status" ? (
            <>
              <div className="mb-2 text-sm font-medium">Pipeline by status</div>
              {data.byStatus.length === 0 ? (
                <p className="text-sm text-muted-foreground">No quotations yet.</p>
              ) : (
                <ul className="space-y-2">
                  {data.byStatus.map((s) => (
                    <li key={s.status} className="space-y-1 rounded-md bg-muted/20 p-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <QuotationStatusBadge status={s.status} />
                          <span className="text-muted-foreground">{s.count} quote{s.count === 1 ? "" : "s"}</span>
                        </div>
                        <span className="tabular-nums font-medium">{formatCurrency(s.total)}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded bg-muted">
                        <div className="h-full bg-primary" style={{ width: `${(s.total / statusMax) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : null}

          {selected === "months" ? (
            <>
              <div className="mb-2 text-sm font-medium">Last 12 months</div>
              {data.byMonth.length === 0 ? (
                <p className="text-sm text-muted-foreground">No history yet.</p>
              ) : (
                <div className="flex h-40 items-end gap-1.5">
                  {data.byMonth.map((m) => (
                    <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                      <div
                        className="w-full rounded-t bg-primary/80"
                        style={{ height: `${Math.max(2, (m.total / monthMax) * 100)}%` }}
                        title={`${formatCurrency(m.total)} · ${m.count} quote(s)`}
                      />
                      <div className="text-[10px] text-muted-foreground">{m.month.slice(2)}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : null}

          {selected === "customers" ? (
            <>
              <div className="mb-2 text-sm font-medium">Top customers</div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Quotes</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.topCustomers.map((c, i) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.count}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(c.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          ) : null}

          {selected === "reliability" ? (
            <>
              <div className="mb-2 text-sm font-medium">Communication reliability</div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Channel</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Sent</TableHead>
                    <TableHead className="text-right">Failed</TableHead>
                    <TableHead className="text-right">Success %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.communications.byChannel.map((c) => {
                    const rate = c.total > 0 ? (c.sent / c.total) * 100 : 0;
                    return (
                      <TableRow key={c.channel}>
                        <TableCell className="capitalize font-medium">{c.channel}</TableCell>
                        <TableCell className="text-right tabular-nums">{c.total}</TableCell>
                        <TableCell className="text-right tabular-nums text-emerald-600">{c.sent}</TableCell>
                        <TableCell className="text-right tabular-nums text-destructive">{c.failed}</TableCell>
                        <TableCell className="text-right tabular-nums">{rate.toFixed(1)}%</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </>
          ) : null}

          {selected === "delivery" ? (
            <>
              <div className="mb-2 text-sm font-medium">Delivery trend (14 days)</div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Day</TableHead>
                    <TableHead className="text-right">Sent</TableHead>
                    <TableHead className="text-right">Failed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.communications.byDay.map((d) => (
                    <TableRow key={d.day}>
                      <TableCell>{d.day}</TableCell>
                      <TableCell className="text-right tabular-nums text-emerald-600">{d.sent}</TableCell>
                      <TableCell className="text-right tabular-nums text-destructive">{d.failed}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}
