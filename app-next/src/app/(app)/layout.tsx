import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSession } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { CommandPalette } from "@/components/command-palette";
import { RouteContentSkeleton } from "@/components/route-content-skeleton";
import { AppShortcuts } from "@/components/app-shortcuts";
import { Workbench } from "@/components/workbench";
import { SidebarCollapseController } from "@/components/sidebar-collapse-controller";
import { OfflineToast } from "@/components/offline-toast";
import { SyncProvider } from "@/lib/offline";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <SyncProvider>
      <div className="app-shell-grid h-screen bg-background md:grid md:grid-cols-[14rem_minmax(0,1fr)] overflow-hidden">
        <Sidebar />
        <div className="wb-shell">
          <Topbar
            user={{
              name: session.name,
              email: session.email,
              role: session.role,
            }}
          />
          <Workbench>
            <Suspense fallback={<RouteContentSkeleton />}>{children}</Suspense>
          </Workbench>
        </div>
        <CommandPalette />
        <AppShortcuts />
        <SidebarCollapseController />
        <OfflineToast />
      </div>
    </SyncProvider>
  );
}
