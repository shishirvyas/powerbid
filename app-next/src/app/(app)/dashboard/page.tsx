import dynamicImport from "next/dynamic";

const DashboardClient = dynamicImport(
  () => import("./dashboard-client").then((mod) => mod.DashboardClient),
  { loading: () => <div className="h-[52vh] min-h-[18rem] animate-pulse rounded-lg border bg-muted/40" /> },
);

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  return <DashboardClient />;
}
