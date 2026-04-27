import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardOverview } from "@/lib/dashboard/metrics";
import { formatINR } from "@/lib/utils";
import { FileText, Users, Package, Inbox } from "lucide-react";

export default async function DashboardPage() {
  const overview = await getDashboardOverview({ preset: "30d" });
  const cards = [
    { label: "Quotations", value: overview.kpis.quotations.total, icon: FileText },
    { label: "Customers", value: overview.kpis.customers.total, icon: Users },
    { label: "Open Inquiries", value: overview.kpis.inquiries.open, icon: Inbox },
    { label: "Pending Approval", value: overview.kpis.quotations.pendingApproval, icon: Package },
  ];
  return (
    <div className="space-y-8 animate-in fade-in-50">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Snapshot of your quotation pipeline for the last 30 days.
        </p>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label}>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {c.label}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold">{c.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Won revenue</CardTitle>
          <CardDescription>
            Current month vs previous month: {overview.kpis.revenue.growthPct == null ? "new baseline" : `${overview.kpis.revenue.growthPct}%`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-semibold tracking-tight">
            {formatINR(overview.kpis.revenue.wonThisMonth)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
