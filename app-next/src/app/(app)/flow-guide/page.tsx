import dynamicImport from "next/dynamic";

const FlowGuideClient = dynamicImport(
  () => import("./flow-guide-client").then((mod) => mod.FlowGuideClient),
  { loading: () => <div className="h-[60vh] animate-pulse rounded-lg border bg-muted/40" /> },
);

export const metadata = {
  title: "BOM Change Propagation — Live Demo Guide",
};

export default function FlowGuidePage() {
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <FlowGuideClient />
    </div>
  );
}
