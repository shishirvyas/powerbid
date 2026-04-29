import dynamicImport from "next/dynamic";

const SettingsClient = dynamicImport(
  () => import("./settings-client").then((mod) => mod.SettingsClient),
  { loading: () => <div className="h-[52vh] min-h-[18rem] animate-pulse rounded-lg border bg-muted/40" /> },
);

export const dynamic = "force-dynamic";

export default function Page() {
  return <SettingsClient />;
}
