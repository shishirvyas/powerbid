import dynamicImport from "next/dynamic";

const SubjectTemplatesClient = dynamicImport(
  () => import("./subject-templates-client").then((mod) => mod.SubjectTemplatesClient),
  { loading: () => <div className="h-[52vh] min-h-[18rem] animate-pulse rounded-lg border bg-muted/40" /> },
);

export default function SubjectTemplatesPage() {
  return <SubjectTemplatesClient />;
}
