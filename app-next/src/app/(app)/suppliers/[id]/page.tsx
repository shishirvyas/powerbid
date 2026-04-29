import dynamicImport from "next/dynamic";

const SupplierDetailClient = dynamicImport(
  () => import("./supplier-detail-client").then((mod) => mod.SupplierDetailClient),
  { loading: () => <div className="h-[52vh] min-h-[18rem] animate-pulse rounded-lg border bg-muted/40" /> },
);

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  return <SupplierDetailClient supplierId={id} />;
}
