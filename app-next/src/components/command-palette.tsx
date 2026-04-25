"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  FileText,
  LayoutDashboard,
  Package,
  Receipt,
  Search,
  Settings as SettingsIcon,
  Users,
} from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";

type Action = {
  id: string;
  label: string;
  hint?: string;
  href?: string;
  onSelect?: () => void;
  icon: React.ReactNode;
  keywords?: string[];
  group: "Navigate" | "Create";
};

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Global hotkey: Ctrl/Cmd+K
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isK = e.key.toLowerCase() === "k";
      if (isK && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "/" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  React.useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  const actions: Action[] = React.useMemo(
    () => [
      { id: "nav-dash", group: "Navigate", label: "Dashboard", href: "/dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
      { id: "nav-cust", group: "Navigate", label: "Customers", href: "/customers", icon: <Users className="h-4 w-4" /> },
      { id: "nav-prod", group: "Navigate", label: "Products", href: "/products", icon: <Package className="h-4 w-4" /> },
      { id: "nav-inq", group: "Navigate", label: "Inquiries", href: "/inquiries", icon: <FileText className="h-4 w-4" /> },
      { id: "nav-quo", group: "Navigate", label: "Quotations", href: "/quotations", icon: <Receipt className="h-4 w-4" /> },
      { id: "nav-rep", group: "Navigate", label: "Reports", href: "/reports", icon: <Building2 className="h-4 w-4" /> },
      { id: "nav-set", group: "Navigate", label: "Settings", href: "/settings", icon: <SettingsIcon className="h-4 w-4" /> },
      { id: "new-quo", group: "Create", label: "New quotation", hint: "Ctrl+Shift+Q", href: "/quotations/new", icon: <Receipt className="h-4 w-4" />, keywords: ["create", "add"] },
    ],
    [],
  );

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter(
      (a) =>
        a.label.toLowerCase().includes(q) ||
        a.keywords?.some((k) => k.toLowerCase().includes(q)),
    );
  }, [actions, query]);

  React.useEffect(() => {
    setActive(0);
  }, [query]);

  function runAction(a: Action) {
    setOpen(false);
    if (a.href) router.push(a.href);
    else a.onSelect?.();
  }

  function onInputKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const a = filtered[active];
      if (a) runAction(a);
    }
  }

  // Group items
  const groups: Record<string, Action[]> = {};
  filtered.forEach((a) => {
    (groups[a.group] ??= []).push(a);
  });

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className="fixed left-1/2 top-[20%] z-50 w-full max-w-xl -translate-x-1/2 rounded-lg border bg-popover shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <Dialog.Description className="sr-only">
            Quickly jump between pages or create records.
          </Dialog.Description>
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onInputKey}
              placeholder="Type a command or search..."
              className="flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
            />
            <kbd className="hidden rounded border bg-muted/60 px-1.5 text-[10px] font-mono text-muted-foreground sm:inline-flex">
              ESC
            </kbd>
          </div>
          <div className="max-h-[50vh] overflow-y-auto p-1.5">
            {filtered.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-muted-foreground">No matches.</div>
            ) : (
              Object.entries(groups).map(([group, items]) => (
                <div key={group} className="mb-1">
                  <div className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {group}
                  </div>
                  {items.map((a) => {
                    const idx = filtered.indexOf(a);
                    const isActive = idx === active;
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => runAction(a)}
                        onMouseEnter={() => setActive(idx)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                          isActive ? "bg-accent text-accent-foreground" : "text-foreground hover:bg-accent/60",
                        )}
                      >
                        <span className="text-muted-foreground">{a.icon}</span>
                        <span className="flex-1">{a.label}</span>
                        {a.hint ? (
                          <kbd className="rounded border bg-muted/60 px-1.5 text-[10px] font-mono text-muted-foreground">
                            {a.hint}
                          </kbd>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
          <div className="flex items-center justify-between border-t px-3 py-2 text-[11px] text-muted-foreground">
            <span>↑ ↓ to navigate · ↵ to select</span>
            <span>
              <kbd className="rounded border bg-muted/60 px-1 font-mono">⌘K</kbd> to toggle
            </span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
