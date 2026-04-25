"use client";

import * as React from "react";
import { Building2, FileText, Package, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
};

const STAT_ICONS = {
  customers: Users,
  products: Package,
  inquiries: FileText,
  quotations: Building2,
};

export function ReportsClient() {
  const { data, loading, error } = useResource<ReportData>("/api/reports");

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

  return (
    <div className="space-y-6 animate-in fade-in-50">
      <PageHeader
        title="Reports"
        description="At-a-glance pipeline, revenue and customer insights."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {(Object.keys(data.counts) as (keyof typeof data.counts)[]).map((k) => {
          const Icon = STAT_ICONS[k];
          return (
            <Card key={k}>
              <CardContent className="flex items-center gap-4 pt-6">
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">{k}</div>
                  <div className="text-2xl font-semibold">{data.counts[k].toLocaleString("en-IN")}</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pipeline by status</CardTitle>
          </CardHeader>
          <CardContent>
            {data.byStatus.length === 0 ? (
              <p className="text-sm text-muted-foreground">No quotations yet.</p>
            ) : (
              <ul className="space-y-3">
                {data.byStatus.map((s) => (
                  <li key={s.status} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <QuotationStatusBadge status={s.status} />
                        <span className="text-muted-foreground">{s.count} quote{s.count === 1 ? "" : "s"}</span>
                      </div>
                      <span className="tabular-nums font-medium">{formatCurrency(s.total)}</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded bg-muted">
                      <div
                        className="h-full bg-primary"
                        style={{ width: `${(s.total / statusMax) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Last 12 months</CardTitle>
          </CardHeader>
          <CardContent>
            {data.byMonth.length === 0 ? (
              <p className="text-sm text-muted-foreground">No history yet.</p>
            ) : (
              <div className="flex h-44 items-end gap-2">
                {data.byMonth.map((m) => (
                  <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t bg-primary/80"
                      style={{ height: `${Math.max(2, (m.total / monthMax) * 100)}%` }}
                      title={`${formatCurrency(m.total)} · ${m.count} quote(s)`}
                    />
                    <div className="text-[10px] text-muted-foreground rotate-45 origin-left whitespace-nowrap">
                      {m.month}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top customers</CardTitle>
        </CardHeader>
        <CardContent>
          {data.topCustomers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No customer revenue yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Quotations</TableHead>
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
