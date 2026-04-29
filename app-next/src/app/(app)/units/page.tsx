import dynamicImport from "next/dynamic";

const UnitsClient = dynamicImport(
  () => import("./units-client").then((mod) => mod.UnitsClient),
  { loading: () => <div className="h-[52vh] min-h-[18rem] animate-pulse rounded-lg border bg-muted/40" /> },
);

export default function UnitsPage() {
  return <UnitsClient />;
}
