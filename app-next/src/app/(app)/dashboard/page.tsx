import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { quotations, customers, products, inquiries } from "@/lib/db/schema";
import { sql, eq } from "drizzle-orm";
import { formatINR } from "@/lib/utils";
import { FileText, Users, Package, Inbox } from "lucide-react";

async function getStats() {
  try {
    const [quoteCount] = await db.select({ c: sql<number>`count(*)::int` }).from(quotations);
    const [custCount] = await db.select({ c: sql<number>`count(*)::int` }).from(customers);
    const [prodCount] = await db.select({ c: sql<number>`count(*)::int` }).from(products);
    const [inqCount] = await db.select({ c: sql<number>`count(*)::int` }).from(inquiries);
    const [revenue] = await db
      .select({ s: sql<string>`coalesce(sum(grand_total), 0)::text` })
      .from(quotations)
      .where(eq(quotations.status, "won"));
    return {
      quotations: quoteCount?.c ?? 0,
      customers: custCount?.c ?? 0,
      products: prodCount?.c ?? 0,
      inquiries: inqCount?.c ?? 0,
      revenue: Number(revenue?.s ?? 0),
    };
  } catch {
    return { quotations: 0, customers: 0, products: 0, inquiries: 0, revenue: 0 };
  }
}

export default async function DashboardPage() {
  const s = await getStats();
  const cards = [
    { label: "Quotations", value: s.quotations, icon: FileText },
    { label: "Customers", value: s.customers, icon: Users },
    { label: "Products", value: s.products, icon: Package },
    { label: "Open Inquiries", value: s.inquiries, icon: Inbox },
  ];
  return (
    <div className="space-y-8 animate-in fade-in-50">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Snapshot of your quotation pipeline.
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
          <CardDescription>Total value of won quotations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-semibold tracking-tight">
            {formatINR(s.revenue)}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
