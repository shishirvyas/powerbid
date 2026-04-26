"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LogOut, Search, User } from "lucide-react";
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

export function Topbar({ user }: { user: User }) {
  const router = useRouter();

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
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 sm:gap-4 border-b bg-background/80 backdrop-blur px-4 sm:px-6">
      <MobileNav />
      <BrandLogo className="hidden lg:flex [&_svg]:h-8 [&_svg]:w-8" compact />
      <button
        type="button"
        onClick={() => {
          // Synthesize Ctrl+K to open the command palette
          window.dispatchEvent(
            new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }),
          );
        }}
        className="group relative flex-1 min-w-0 max-w-md flex items-center gap-2 rounded-md border border-transparent bg-muted/50 px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:border-border transition-colors"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="truncate text-left">Search or jump to...</span>
        <kbd className="ml-auto hidden sm:inline-flex shrink-0 items-center gap-0.5 rounded border bg-background/60 px-1.5 py-0.5 text-[10px] font-mono">
          <span className="text-[11px]">⌘</span>K
        </kbd>
      </button>
      <div className="ml-auto flex items-center gap-1 sm:gap-2 shrink-0">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-2 px-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                {initials || "U"}
              </span>
              <span className="hidden sm:flex flex-col items-start leading-tight">
                <span className="text-sm font-medium max-w-[10rem] truncate">{user.name}</span>
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
