import dynamicImport from "next/dynamic";

const SalesOrderDetailClient = dynamicImport(
  () => import("./sales-order-detail-client"),
  { loading: () => <div className="h-[52vh] min-h-[18rem] animate-pulse rounded-lg border bg-muted/40" /> },
);

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <SalesOrderDetailClient id={(await params).id} />;
}
