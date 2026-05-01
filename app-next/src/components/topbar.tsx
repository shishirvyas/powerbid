"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell, LogOut, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileNav } from "@/components/sidebar";
import { BrandLogo } from "@/components/brand-logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type User = { name: string; email: string; role: string };

type Notification = {
  id: number;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  impactRecordId: number;
};

function NotificationBell({ role }: { role: string }) {
  const [notifications, setNotifications] = React.useState<Notification[]>([]);
  const [open, setOpen] = React.useState(false);

  const fetchNotifs = React.useCallback(async () => {
    try {
      const res = await fetch(`/api/change-propagation/notifications?role=${encodeURIComponent(role)}`);
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data.notifications ?? []);
    } catch {
      // silently ignore — notification bell is non-critical
    }
  }, [role]);

  React.useEffect(() => {
    fetchNotifs();
    const timer = setInterval(fetchNotifs, 30_000);
    return () => clearInterval(timer);
  }, [fetchNotifs]);

  const unread = notifications.filter((n) => !n.isRead).length;

  async function markRead(id: number) {
    try {
      await fetch("/api/change-propagation/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: id }),
      });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
    } catch {
      // silently ignore
    }
  }

  async function markAllRead() {
    await Promise.all(notifications.filter((n) => !n.isRead).map((n) => markRead(n.id)));
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9" aria-label="Notifications">
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>BOM Impact Alerts</span>
          {unread > 0 && (
            <button
              type="button"
              onClick={markAllRead}
              className="text-[11px] font-normal text-primary hover:underline"
            >
              Mark all read
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-muted-foreground">No notifications</div>
        ) : (
          notifications.slice(0, 20).map((n) => (
            <DropdownMenuItem
              key={n.id}
              className={`flex flex-col items-start gap-0.5 px-3 py-2.5 ${!n.isRead ? "bg-primary/5" : ""}`}
              onClick={() => !n.isRead && markRead(n.id)}
            >
              <div className={`text-xs font-medium ${!n.isRead ? "text-foreground" : "text-muted-foreground"}`}>
                {n.title}
              </div>
              <div className="line-clamp-2 text-[11px] text-muted-foreground">{n.body}</div>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Topbar({ user }: { user: User }) {
  const router = useRouter();

  React.useEffect(() => {
    const quickLinks = [
      "/dashboard",
      "/inquiries",
      "/quotations",
      "/sales-orders",
      "/suppliers",
      "/purchase-orders",
      "/stock-items",
      "/production-orders",
    ];

    for (const href of quickLinks) {
      router.prefetch(href);
    }
  }, [router]);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const initials = user.name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/90 px-3 backdrop-blur sm:gap-3 sm:px-4 lg:px-5">
      <MobileNav />
      <BrandLogo className="block shrink-0 md:hidden" compact />
      <button
        type="button"
        onClick={() => {
          // Synthesize Ctrl+K to open the command palette
          window.dispatchEvent(
            new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }),
          );
        }}
        className="group relative flex min-w-0 max-w-sm flex-1 items-center gap-2 rounded-md border border-transparent bg-muted/50 px-2.5 py-1.5 text-[13px] text-muted-foreground transition-colors hover:border-border hover:bg-muted"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="truncate text-left">Search or jump to...</span>
        <kbd className="ml-auto hidden shrink-0 items-center gap-0.5 rounded border bg-background/60 px-1.5 py-0.5 font-mono text-[10px] md:inline-flex">
          <span className="text-[11px]">⌘</span>K
        </kbd>
      </button>
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <ThemeToggle />
        <NotificationBell role={user.role} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 gap-2 px-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                {initials || "U"}
              </span>
              <span className="hidden sm:flex flex-col items-start leading-tight">
                <span className="max-w-[10rem] truncate text-[13px] font-medium">{user.name}</span>
                <span className="text-[11px] text-muted-foreground capitalize">
                  {user.role}
                </span>
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="font-medium truncate">{user.name}</div>
              <div className="text-xs text-muted-foreground truncate">{user.email}</div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" /> Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
