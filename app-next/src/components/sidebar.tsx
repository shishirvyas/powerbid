"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  BarChart3,
  FileText,
  Inbox,
  LayoutDashboard,
  Menu,
  MonitorPlay,
  Package,
  Settings,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";
import { APP_SUBTITLE } from "@/lib/branding";

type NavItem = {
  type: "item";
  label: string;
  href: string;
  icon?: React.ComponentType<{ className?: string }>;
};

type NavGroup = {
  type: "group";
  key: string;
  label: string;
  children: Array<{
    label: string;
    href: string;
    icon?: React.ComponentType<{ className?: string }>;
  }>;
};

type NavNode = NavItem | NavGroup;

const navConfig: NavNode[] = [
  { type: "item", href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    type: "group",
    key: "transactions",
    label: "Transactions",
    children: [
      { label: "Inquiries", href: "/inquiries", icon: Inbox },
      { label: "Quotations", href: "/quotations", icon: FileText },
      { label: "Sales Orders", href: "/sales-orders", icon: FileText },
    ],
  },
  {
    type: "group",
    key: "procurement",
    label: "Procurement",
    children: [
      { label: "Suppliers", href: "/suppliers", icon: Users },
      { label: "Purchase Orders", href: "/purchase-orders", icon: FileText },
    ],
  },
  {
    type: "group",
    key: "analytics",
    label: "Analytics",
    children: [
      { label: "Reports", href: "/reports", icon: BarChart3 },
      { label: "Showcase", href: "/showcase", icon: MonitorPlay },
    ],
  },
  {
    type: "group",
    key: "inventory",
    label: "Inventory",
    children: [
      { label: "Warehouses", href: "/warehouses", icon: Package },
      { label: "Stock Items", href: "/stock-items", icon: Package },
      { label: "BOM", href: "/boms", icon: FileText },
      { label: "Production Orders", href: "/production-orders", icon: Settings },
    ],
  },
  {
    type: "group",
    key: "administration",
    label: "Administration",
    children: [{ label: "Settings", href: "/settings", icon: Settings }],
  },
  {
    type: "group",
    key: "masters",
    label: "Masters",
    children: [
      { label: "Customers", href: "/customers", icon: Users },
      { label: "Products", href: "/products", icon: Package },
      { label: "Units", href: "/units", icon: Package },
      { label: "Subject Templates", href: "/subject-templates", icon: FileText },
    ],
  },
];

function Brand() {
  return (
    <div className="flex h-14 items-center gap-2 px-4 border-b border-sidebar-border">
      <BrandLogo compact className="" />
    </div>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5 app-scroll-area">
      {navConfig.map((node) => {
        if (node.type === "item") {
          const active = isActive(node.href);
          const Icon = node.icon;
          return (
            <Link
              key={node.href}
              href={node.href}
              prefetch
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] leading-5 transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
            >
              {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
              <span className="truncate">{node.label}</span>
            </Link>
          );
        }

        const hasActiveChild = node.children.some((child) => isActive(child.href));

        return (
          <div key={node.key} className="pt-1 first:pt-0">
            <div
              className={cn(
                "px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em]",
                hasActiveChild ? "text-sidebar-foreground" : "text-sidebar-foreground/55",
              )}
            >
              {node.label}
            </div>

            <div className="mt-0.5 ml-2.5 space-y-0.5 border-l border-sidebar-border/70 pl-2.5">
              {node.children.map((child) => {
                const active = isActive(child.href);
                const Icon = child.icon;
                return (
                  <Link
                    key={child.href}
                    href={child.href}
                    prefetch
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] leading-5 transition-colors",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                    )}
                  >
                    {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
                    <span className="truncate">{child.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:sticky md:top-0 md:flex md:h-screen md:flex-col">
      <Brand />
      <NavLinks />
      <div className="border-t border-sidebar-border px-4 py-2 text-[11px] text-sidebar-foreground/50">
        v0.1 · {new Date().getFullYear()}
      </div>
    </aside>
  );
}

export function MobileNav() {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden -ml-2"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-64 max-w-[85vw] flex-col",
            "bg-sidebar text-sidebar-foreground border-r border-sidebar-border shadow-xl",
            "data-[state=open]:animate-in data-[state=open]:slide-in-from-left",
            "data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left",
            "duration-200 md:hidden",
          )}
        >
          <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Browse {APP_SUBTITLE} sections.
          </DialogPrimitive.Description>
          <div className="relative">
            <Brand />
            <DialogPrimitive.Close
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>
          <NavLinks onNavigate={() => setOpen(false)} />
          <div className="px-5 py-3 text-[11px] text-sidebar-foreground/50 border-t border-sidebar-border">
            v0.1 · {new Date().getFullYear()}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
