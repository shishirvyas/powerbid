import dynamicImport from "next/dynamic";

const SalesOrdersClient = dynamicImport(
  () => import("./sales-orders-client").then((mod) => mod.SalesOrdersClient),
  { loading: () => <div className="h-[52vh] min-h-[18rem] animate-pulse rounded-lg border bg-muted/40" /> },
);

export const dynamic = "force-dynamic";

export default function Page() {
  return <SalesOrdersClient />;
}
