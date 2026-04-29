import dynamicImport from "next/dynamic";

const StockItemsClient = dynamicImport(
  () => import("./stock-items-client").then((mod) => mod.StockItemsClient),
  { loading: () => <div className="h-[52vh] min-h-[18rem] animate-pulse rounded-lg border bg-muted/40" /> },
);

export const dynamic = "force-dynamic";

export default function Page() {
  return <StockItemsClient />;
}
