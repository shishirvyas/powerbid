import dynamicImport from "next/dynamic";

const InquiriesClient = dynamicImport(
  () => import("./inquiries-client").then((mod) => mod.InquiriesClient),
  { loading: () => <div className="h-[52vh] min-h-[18rem] animate-pulse rounded-lg border bg-muted/40" /> },
);

export const dynamic = "force-dynamic";

export default function Page() {
  return <InquiriesClient />;
}
