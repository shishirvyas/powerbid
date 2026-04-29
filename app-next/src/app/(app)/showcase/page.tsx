import dynamicImport from "next/dynamic";

const ShowcaseClient = dynamicImport(
  () => import("./showcase-client").then((mod) => mod.ShowcaseClient),
  { loading: () => <div className="h-[52vh] min-h-[18rem] animate-pulse rounded-lg border bg-muted/40" /> },
);

export const metadata = {
  title: "Executive Showcase",
};

export default function ShowcasePage() {
  return <ShowcaseClient />;
}
