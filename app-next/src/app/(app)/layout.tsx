import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { Topbar } from "@/components/topbar";
import { CommandPalette } from "@/components/command-palette";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          user={{
            name: session.name,
            email: session.email,
            role: session.role,
          }}
        />
        <main className="flex-1 p-4 sm:p-6 md:p-8 min-w-0">{children}</main>
      </div>
      <CommandPalette />
    </div>
  );
}
