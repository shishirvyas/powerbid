import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSession } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { CommandPalette } from "@/components/command-palette";
import { RouteContentSkeleton } from "@/components/route-content-skeleton";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-background md:grid md:grid-cols-[14rem_minmax(0,1fr)]">
      <Sidebar />
      <div className="flex min-h-screen min-w-0 flex-col md:h-screen md:overflow-hidden">
        <Topbar
          user={{
            name: session.name,
            email: session.email,
            role: session.role,
          }}
        />
        <main className="dense-ui flex-1 min-w-0 p-2 sm:p-3 lg:p-3 md:overflow-auto md:[scrollbar-gutter:stable] app-scroll-area overscroll-contain">
          <Suspense fallback={<RouteContentSkeleton />}>
            {children}
          </Suspense>
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
