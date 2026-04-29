import dynamicImport from "next/dynamic";

const ProductionOrdersClient = dynamicImport(
  () => import("./production-orders-client").then((mod) => mod.ProductionOrdersClient),
  { loading: () => <div className="h-[52vh] min-h-[18rem] animate-pulse rounded-lg border bg-muted/40" /> },
);

export const dynamic = "force-dynamic";

export default function Page() {
  return <ProductionOrdersClient />;
}
