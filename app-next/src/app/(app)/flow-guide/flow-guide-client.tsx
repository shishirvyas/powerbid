"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Copy,
  ExternalLink,
  GitBranch,
  Layers,
  Play,
  RefreshCw,
  Server,
  Shield,
  ShieldCheck,
  Sparkles,
  Terminal,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// ─── Types ─────────────────────────────────────────────────────────────────────

type StepStatus = "idle" | "running" | "done" | "error";

type ApiHealth = {
  boms: boolean;
  versioning: boolean;
  propagation: boolean;
  notifications: boolean;
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function StatusDot({ status }: { status: StepStatus }) {
  if (status === "running")
    return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />;
  if (status === "done")
    return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (status === "error")
    return <AlertTriangle className="h-4 w-4 text-destructive" />;
  return <CircleDot className="h-4 w-4 text-muted-foreground" />;
}

function CodeBlock({ code, lang = "json" }: { code: string; lang?: string }) {
  const [copied, setCopied] = React.useState(false);
  function copy() {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  return (
    <div className="relative rounded-md border bg-zinc-950 font-mono text-[12px] text-zinc-100 dark:bg-zinc-900">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-1.5">
        <span className="text-[10px] uppercase tracking-widest text-zinc-500">{lang}</span>
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-zinc-200"
        >
          <Copy className="h-3 w-3" />
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-3 leading-relaxed">{code}</pre>
    </div>
  );
}

function HealthPill({ ok, label }: { ok: boolean | null; label: string }) {
  if (ok === null)
    return <Badge variant="outline" className="text-muted-foreground">{label} — checking…</Badge>;
  return (
    <Badge variant={ok ? "success" : "destructive"}>
      {ok ? "✓" : "✗"} {label}
    </Badge>
  );
}

// ─── Architecture Diagram ──────────────────────────────────────────────────────

function ArchDiagram() {
  const nodes = [
    { id: "bom", x: 60, y: 100, label: "BOM", sub: "edit / save", color: "#2563eb" },
    { id: "ver", x: 220, y: 100, label: "Versioning", sub: "snapshot", color: "#7c3aed" },
    { id: "prop", x: 380, y: 100, label: "Propagation", sub: "impact analysis", color: "#d97706" },
    { id: "po", x: 540, y: 50, label: "Prod. Orders", sub: "needs_revision", color: "#dc2626" },
    { id: "purch", x: 540, y: 160, label: "Purch. Orders", sub: "needs_revision", color: "#dc2626" },
    { id: "dash", x: 700, y: 100, label: "Dashboard", sub: "open impacts", color: "#059669" },
    { id: "bell", x: 700, y: 200, label: "Notif. Bell", sub: "role alerts", color: "#0891b2" },
  ];

  const edges = [
    { from: [160, 110], to: [220, 110] },
    { from: [320, 110], to: [380, 110] },
    { from: [480, 110], to: [540, 70] },
    { from: [480, 110], to: [540, 170] },
    { from: [640, 70], to: [700, 110] },
    { from: [640, 170], to: [700, 110] },
    { from: [640, 170], to: [700, 210] },
  ];

  return (
    <div className="overflow-x-auto rounded-lg border bg-zinc-950 p-4">
      <svg viewBox="0 0 840 260" className="h-48 w-full min-w-[660px]">
        {/* Edges */}
        {edges.map(({ from, to }, i) => (
          <g key={i}>
            <line
              x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]}
              stroke="#4b5563" strokeWidth="1.5"
              markerEnd="url(#arrow)"
            />
          </g>
        ))}
        <defs>
          <marker id="arrow" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="#4b5563" />
          </marker>
        </defs>
        {/* Nodes */}
        {nodes.map((n) => (
          <g key={n.id} transform={`translate(${n.x},${n.y - 28})`}>
            <rect x="0" y="0" width="100" height="48" rx="6" fill="#18181b" stroke={n.color} strokeWidth="1.5" />
            <text x="50" y="18" textAnchor="middle" fill={n.color} fontSize="11" fontWeight="600">{n.label}</text>
            <text x="50" y="34" textAnchor="middle" fill="#71717a" fontSize="9">{n.sub}</text>
          </g>
        ))}
        {/* Legend */}
        <text x="420" y="248" textAnchor="middle" fill="#52525b" fontSize="9">
          BOM save triggers immutable version snapshot → downstream impact detection → dashboard + notifications
        </text>
      </svg>
    </div>
  );
}

// ─── Step Card ─────────────────────────────────────────────────────────────────

function StepCard({
  number,
  title,
  description,
  status,
  onRun,
  runLabel,
  result,
  children,
  links,
}: {
  number: number;
  title: string;
  description: string;
  status: StepStatus;
  onRun?: () => void;
  runLabel?: string;
  result?: string | null;
  children?: React.ReactNode;
  links?: Array<{ label: string; href: string }>;
}) {
  const [open, setOpen] = React.useState(false);

  const borderColor =
    status === "done"
      ? "border-emerald-400/60"
      : status === "error"
        ? "border-destructive/60"
        : status === "running"
          ? "border-blue-400/60"
          : "border-border";

  return (
    <div className={`rounded-lg border ${borderColor} bg-card transition-colors`}>
      <button
        type="button"
        className="flex w-full items-center gap-4 px-5 py-4 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
          {number}
        </div>
        <div className="flex-1">
          <div className="font-semibold text-sm">{title}</div>
          <div className="text-xs text-muted-foreground">{description}</div>
        </div>
        <StatusDot status={status} />
        {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t px-5 pb-5 pt-4 space-y-4">
          {children}

          <div className="flex flex-wrap items-center gap-2">
            {onRun && (
              <Button
                type="button"
                size="sm"
                disabled={status === "running"}
                onClick={onRun}
                className="gap-1.5"
              >
                {status === "running" ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                {runLabel ?? "Run this step"}
              </Button>
            )}
            {links?.map((l) => (
              <Button key={l.href} asChild variant="outline" size="sm">
                <Link href={l.href}>
                  {l.label} <ExternalLink className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            ))}
          </div>

          {result && (
            <CodeBlock
              code={result}
              lang={result.trim().startsWith("{") || result.trim().startsWith("[") ? "json" : "text"}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function FlowGuideClient() {
  // Health check state
  const [health, setHealth] = React.useState<Record<keyof ApiHealth, boolean | null>>({
    boms: null,
    versioning: null,
    propagation: null,
    notifications: null,
  });

  // Per-step status
  const [steps, setSteps] = React.useState<Record<number, StepStatus>>({});
  const [results, setResults] = React.useState<Record<number, string>>({});

  // Seeded BOM id for chaining steps
  const [demoBomId, setDemoBomId] = React.useState<number | null>(null);
  const [demoVersionId, setDemoVersionId] = React.useState<number | null>(null);
  const [demoImpactId, setDemoImpactId] = React.useState<number | null>(null);

  function setStep(n: number, s: StepStatus) {
    setSteps((p) => ({ ...p, [n]: s }));
  }
  function setResult(n: number, r: string) {
    setResults((p) => ({ ...p, [n]: r }));
  }

  // ── Health checks ────────────────────────────────────────────────────────────
  async function runHealthChecks() {
    setHealth({ boms: null, versioning: null, propagation: null, notifications: null });
    const checks: Array<[keyof ApiHealth, string]> = [
      ["boms", "/api/boms?limit=1"],
      ["versioning", demoBomId ? `/api/versioning/BOM/${demoBomId}` : "/api/boms?limit=1"],
      ["propagation", "/api/change-propagation/open-impacts"],
      ["notifications", "/api/change-propagation/notifications?role=admin"],
    ];
    for (const [key, url] of checks) {
      try {
        const r = await fetch(url);
        setHealth((p) => ({ ...p, [key]: r.ok }));
      } catch {
        setHealth((p) => ({ ...p, [key]: false }));
      }
    }
  }

  React.useEffect(() => {
    runHealthChecks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Step 1: Seed RBAC ────────────────────────────────────────────────────────
  async function seedRbac() {
    setStep(1, "running");
    try {
      const r = await fetch("/api/admin/rbac/seed", { method: "POST" });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`);
      setResult(1, JSON.stringify(body, null, 2));
      setStep(1, "done");
    } catch (e: unknown) {
      setResult(1, String(e instanceof Error ? e.message : e));
      setStep(1, "error");
    }
  }

  // ── Step 2: Seed demo BOM ────────────────────────────────────────────────────
  async function seedBom() {
    setStep(2, "running");
    try {
      // First pick any product
      const prodRes = await fetch("/api/products?limit=1");
      const prodData = await prodRes.json();
      const product = prodData.rows?.[0];
      if (!product) throw new Error("No products found. Create at least one product first.");

      // Pick a raw material
      const matRes = await fetch("/api/products?limit=5");
      const matData = await matRes.json();
      const material = matData.rows?.find((p: { id: number }) => p.id !== product.id) ?? matData.rows?.[0];
      if (!material) throw new Error("Need at least one product to use as raw material.");

      const payload = {
        productId: product.id,
        bomCode: `DEMO-BOM-${Date.now()}`,
        version: "1.0",
        isActive: true,
        laborCost: 500,
        overheadCost: 200,
        notes: "Flow guide demo BOM",
        items: [
          { rawMaterialId: material.id, qtyPerUnit: 2, wastagePercent: 5, notes: "Demo item" },
        ],
      };
      const r = await fetch("/api/boms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`);
      setDemoBomId(body.id);
      setResult(2, JSON.stringify({ bomId: body.id, bomCode: body.bomCode, version: body.version }, null, 2));
      setStep(2, "done");
    } catch (e: unknown) {
      setResult(2, String(e instanceof Error ? e.message : e));
      setStep(2, "error");
    }
  }

  // ── Step 3: Snapshot initial BOM version ─────────────────────────────────────
  async function snapshotVersion() {
    if (!demoBomId) { setResult(3, "Run Step 2 first to create a demo BOM."); setStep(3, "error"); return; }
    setStep(3, "running");
    try {
      const r = await fetch(`/api/versioning/BOM/${demoBomId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snapshot: { bomId: demoBomId, label: "v1.0 baseline" }, label: "v1.0" }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`);
      setDemoVersionId(body.version?.id ?? null);
      setResult(3, JSON.stringify({ versionId: body.version?.id, label: body.version?.label }, null, 2));
      setStep(3, "done");
    } catch (e: unknown) {
      setResult(3, String(e instanceof Error ? e.message : e));
      setStep(3, "error");
    }
  }

  // ── Step 4: Trigger change propagation ───────────────────────────────────────
  async function triggerPropagation() {
    if (!demoBomId || !demoVersionId) { setResult(4, "Run Steps 2 and 3 first."); setStep(4, "error"); return; }
    setStep(4, "running");
    try {
      const r = await fetch("/api/change-propagation/propagate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bomId: demoBomId, newVersionId: demoVersionId }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`);
      setResult(4, JSON.stringify(body, null, 2));
      setStep(4, "done");
    } catch (e: unknown) {
      setResult(4, String(e instanceof Error ? e.message : e));
      setStep(4, "error");
    }
  }

  // ── Step 5: Check open impacts ───────────────────────────────────────────────
  async function checkImpacts() {
    setStep(5, "running");
    try {
      const r = await fetch("/api/change-propagation/open-impacts");
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`);
      const first = body.impacts?.[0];
      if (first) setDemoImpactId(first.id);
      setResult(5, JSON.stringify({ total: body.total, sample: body.impacts?.slice(0, 3) }, null, 2));
      setStep(5, "done");
    } catch (e: unknown) {
      setResult(5, String(e instanceof Error ? e.message : e));
      setStep(5, "error");
    }
  }

  // ── Step 6: Acknowledge an impact ────────────────────────────────────────────
  async function acknowledgeImpact() {
    if (!demoImpactId) { setResult(6, "No open impact found. Ensure production orders exist referencing the demo BOM."); setStep(6, "error"); return; }
    setStep(6, "running");
    try {
      const r = await fetch(`/api/change-propagation/impacts/${demoImpactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "acknowledge" }),
      });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`);
      setResult(6, JSON.stringify(body, null, 2));
      setStep(6, "done");
    } catch (e: unknown) {
      setResult(6, String(e instanceof Error ? e.message : e));
      setStep(6, "error");
    }
  }

  // ── Step 7: Fetch notifications ───────────────────────────────────────────────
  async function fetchNotifications() {
    setStep(7, "running");
    try {
      const r = await fetch("/api/change-propagation/notifications?role=production");
      const body = await r.json();
      if (!r.ok) throw new Error(body.error ?? `HTTP ${r.status}`);
      setResult(7, JSON.stringify({ unread: body.notifications?.filter((n: { isRead: boolean }) => !n.isRead).length ?? 0, sample: body.notifications?.slice(0, 3) }, null, 2));
      setStep(7, "done");
    } catch (e: unknown) {
      setResult(7, String(e instanceof Error ? e.message : e));
      setStep(7, "error");
    }
  }

  const allHealthGreen = Object.values(health).every((v) => v === true);

  return (
    <div className="mx-auto max-w-4xl space-y-8 animate-in fade-in-50 pb-16">

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-primary/10 via-primary/5 to-background px-8 py-10">
        <div className="absolute right-6 top-6 opacity-10">
          <Zap className="h-32 w-32 text-primary" />
        </div>
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20">
            <GitBranch className="h-5 w-5 text-primary" />
          </div>
          <Badge className="text-xs">Live Demo Guide</Badge>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">BOM Change Propagation Flow</h1>
        <p className="mt-2 max-w-xl text-muted-foreground">
          When a Bill of Materials is updated, PowerBid automatically versions it, finds every downstream
          production order and purchase order that is affected, flags them for review, and notifies the
          responsible teams — all without manual intervention.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {(["Immutable Versioning", "Impact Analysis", "Role Notifications", "Audit Trail"] as const).map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5 rounded-full border bg-background/70 px-3 py-1 text-xs font-medium">
              <Sparkles className="h-3 w-3 text-primary" /> {t}
            </span>
          ))}
        </div>
      </div>

      {/* ── Architecture ─────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">How It Works</h2>
        </div>
        <ArchDiagram />
        <div className="grid gap-3 sm:grid-cols-3 text-sm">
          {[
            { icon: <GitBranch className="h-4 w-4 text-violet-500" />, title: "Immutable Versions", body: "Every BOM save creates a timestamped snapshot. No history is ever lost." },
            { icon: <Zap className="h-4 w-4 text-amber-500" />, title: "Instant Propagation", body: "Production orders (via BOM FK) and purchase orders (via raw material overlap) are detected automatically." },
            { icon: <Bell className="h-4 w-4 text-cyan-500" />, title: "Role-Targeted Alerts", body: "Production and procurement teams see only their relevant change notifications." },
          ].map((c) => (
            <div key={c.title} className="rounded-lg border bg-card p-4 space-y-1.5">
              <div className="flex items-center gap-2">{c.icon}<span className="font-semibold text-xs">{c.title}</span></div>
              <p className="text-xs text-muted-foreground">{c.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Pre-flight health ────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">API Health Check</h2>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={runHealthChecks}>
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Re-check
          </Button>
        </div>
        <div className={`flex flex-wrap gap-2 rounded-lg border p-4 ${allHealthGreen ? "border-emerald-400/50 bg-emerald-50/30 dark:bg-emerald-950/20" : "border-border bg-muted/20"}`}>
          <HealthPill ok={health.boms} label="BOM API" />
          <HealthPill ok={health.versioning} label="Versioning API" />
          <HealthPill ok={health.propagation} label="Change Propagation API" />
          <HealthPill ok={health.notifications} label="Notifications API" />
          {allHealthGreen && (
            <span className="ml-auto flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" /> All systems ready
            </span>
          )}
        </div>
      </div>

      {/* ── Step-by-step walkthrough ──────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Step-by-Step Walkthrough</h2>
        </div>
        <div className="space-y-3">

          <StepCard
            number={1}
            title="Seed Roles & Permissions"
            description="Bootstrap default roles (admin, sales, procurement, production, stores, qa) and full permission matrix."
            status={steps[1] ?? "idle"}
            onRun={seedRbac}
            runLabel="Seed RBAC"
            result={results[1]}
          >
            <p className="text-sm text-muted-foreground">
              This one-time setup call creates all system roles, departments, and workflow transition policies.
              Safe to re-run — uses upsert so existing data is not duplicated.
            </p>
            <CodeBlock
              lang="http"
              code={`POST /api/admin/rbac/seed\nAuthorization: (admin session cookie)`}
            />
          </StepCard>

          <StepCard
            number={2}
            title="Create a Demo BOM"
            description="Automatically creates a BOM using the first available product and raw material in the system."
            status={steps[2] ?? "idle"}
            onRun={seedBom}
            runLabel="Create Demo BOM"
            result={results[2]}
            links={[{ label: "Open BOMs page", href: "/boms" }]}
          >
            <p className="text-sm text-muted-foreground">
              In production use, your team edits the BOM through the BOM Management page.
              The demo creates one programmatically so you can see the version + propagation
              flow without manual data entry.
            </p>
            <CodeBlock
              lang="http"
              code={`POST /api/boms\n{\n  "productId": <any product id>,\n  "bomCode": "DEMO-BOM-...",\n  "version": "1.0",\n  "items": [{ "rawMaterialId": ..., "qtyPerUnit": 2 }]\n}`}
            />
          </StepCard>

          <StepCard
            number={3}
            title="Snapshot BOM as Version 1.0"
            description="Creates an immutable version record of the current BOM state. This is what downstream orders are 'locked to'."
            status={steps[3] ?? "idle"}
            onRun={snapshotVersion}
            runLabel="Snapshot Version"
            result={results[3]}
          >
            <p className="text-sm text-muted-foreground">
              In normal app use this happens automatically on every BOM save. The snapshot is stored in
              <code className="mx-1 rounded bg-muted px-1 text-xs">entity_versions</code>
              and the active pointer is updated in
              <code className="mx-1 rounded bg-muted px-1 text-xs">entity_version_sets</code>.
            </p>
            <CodeBlock
              lang="http"
              code={`POST /api/versioning/BOM/${demoBomId ?? "<bomId>"}\n{\n  "snapshot": { "bomId": <id>, "label": "v1.0 baseline" },\n  "label": "v1.0"\n}`}
            />
          </StepCard>

          <StepCard
            number={4}
            title="Trigger Change Propagation"
            description="Simulates a BOM update. The engine finds all impacted production orders and purchase orders."
            status={steps[4] ?? "idle"}
            onRun={triggerPropagation}
            runLabel="Run Propagation"
            result={results[4]}
          >
            <p className="text-sm text-muted-foreground">
              The propagation engine runs two scans:
            </p>
            <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
              <li><strong>Production orders</strong> — directly linked via <code className="rounded bg-muted px-1 text-xs">bomId</code> foreign key</li>
              <li><strong>Purchase orders</strong> — indirectly linked via raw material product ID overlap with BOM items</li>
            </ul>
            <p className="text-sm text-muted-foreground mt-1">
              Draft records are auto-actioned. In-flight records (approved/sent/in_progress) require human acknowledgement.
            </p>
            <CodeBlock
              lang="http"
              code={`POST /api/change-propagation/propagate\n{\n  "bomId": ${demoBomId ?? "<bomId>"},\n  "newVersionId": ${demoVersionId ?? "<versionId>"}\n}`}
            />
          </StepCard>

          <StepCard
            number={5}
            title="View Open Impacts on Dashboard"
            description="The dashboard Open Impacts widget shows all records needing review. This step fetches them directly."
            status={steps[5] ?? "idle"}
            onRun={checkImpacts}
            runLabel="Fetch Open Impacts"
            result={results[5]}
            links={[{ label: "Go to Dashboard", href: "/dashboard" }]}
          >
            <p className="text-sm text-muted-foreground">
              The amber <strong>BOM Change Impacts</strong> card on the dashboard auto-appears whenever
              there are open impacts. Each row shows the affected entity, reason, and an Acknowledge button.
            </p>
            <CodeBlock lang="http" code={`GET /api/change-propagation/open-impacts`} />
          </StepCard>

          <StepCard
            number={6}
            title="Acknowledge an Impact"
            description="Mark a production or purchase order as 'reviewed — aware of the BOM change'. The status moves from needs_revision → acknowledged."
            status={steps[6] ?? "idle"}
            onRun={acknowledgeImpact}
            runLabel="Acknowledge Impact"
            result={results[6]}
          >
            <p className="text-sm text-muted-foreground">
              After acknowledgement the planner can continue working or escalate to a resolution
              (e.g. update the order's quantities to match the new BOM). Resolution moves status to
              <code className="mx-1 rounded bg-muted px-1 text-xs">resolved</code>.
            </p>
            <CodeBlock
              lang="http"
              code={`PATCH /api/change-propagation/impacts/${demoImpactId ?? "<impactId>"}\n{ "action": "acknowledge" }\n\n# To resolve:\n{ "action": "resolve", "note": "Quantities updated to match v2.0" }`}
            />
          </StepCard>

          <StepCard
            number={7}
            title="Check Role Notifications"
            description="Production and procurement roles receive targeted alerts in the topbar bell. Verify they were created."
            status={steps[7] ?? "idle"}
            onRun={fetchNotifications}
            runLabel="Fetch Notifications"
            result={results[7]}
          >
            <p className="text-sm text-muted-foreground">
              The bell icon in the top navigation bar polls every 30 seconds. Unread alerts are shown
              with a red badge count. Clicking an alert auto-marks it read.
            </p>
            <CodeBlock
              lang="http"
              code={`GET /api/change-propagation/notifications?role=production\n\n# Mark read:\nPOST /api/change-propagation/notifications\n{ "notificationId": <id> }`}
            />
          </StepCard>

        </div>
      </div>

      {/* ── Run All ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-6 py-4">
        <div>
          <p className="font-semibold text-sm">Run full demo sequence</p>
          <p className="text-xs text-muted-foreground">Executes steps 1 → 7 in order. Requires at least one product to exist.</p>
        </div>
        <Button
          type="button"
          onClick={async () => {
            await seedRbac();
            await seedBom();
            await snapshotVersion();
            await triggerPropagation();
            await checkImpacts();
            await acknowledgeImpact();
            await fetchNotifications();
          }}
        >
          <Zap className="mr-2 h-4 w-4" /> Run All Steps
        </Button>
      </div>

      {/* ── API Reference ────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">API Reference</h2>
        </div>
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-2.5 text-left font-semibold">Method</th>
                <th className="px-4 py-2.5 text-left font-semibold">Endpoint</th>
                <th className="px-4 py-2.5 text-left font-semibold">Purpose</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {[
                ["POST", "/api/admin/rbac/seed", "Bootstrap roles, departments, permission matrix"],
                ["POST", "/api/boms", "Create BOM (auto-versions on save)"],
                ["PUT", "/api/boms/:id", "Update BOM (auto-versions + propagates on save)"],
                ["GET", "/api/versioning/BOM/:id", "List all version snapshots for a BOM"],
                ["POST", "/api/versioning/BOM/:id", "Create new version snapshot"],
                ["GET", "/api/versioning/BOM/:id/current", "Get active version with parsed snapshot"],
                ["POST", "/api/change-propagation/propagate", "Trigger impact analysis for a BOM version change"],
                ["GET", "/api/change-propagation/open-impacts", "List all unresolved impact records"],
                ["PATCH", "/api/change-propagation/impacts/:id", "Acknowledge or resolve an impact record"],
                ["GET", "/api/change-propagation/notifications", "Fetch unread notifications by role"],
                ["POST", "/api/change-propagation/notifications", "Mark a notification as read"],
              ].map(([m, ep, desc]) => (
                <tr key={ep} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2.5">
                    <Badge variant={m === "GET" ? "outline" : m === "POST" ? "default" : m === "PUT" ? "warning" : "secondary"} className="text-[10px]">
                      {m}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-muted-foreground">{ep}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Feature checklist ────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">What to Show Buyers</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {[
            { title: "Zero manual tracking", body: "BOM edit → version snapshot → impact flags happen in one save click. No spreadsheets, no emails." },
            { title: "Complete audit trail", body: "Every version is stored immutably. Who changed what, when, and what was affected is always queryable." },
            { title: "Smart impact detection", body: "Direct FK links for production orders + smart raw material overlap for purchase orders." },
            { title: "Role-based notifications", body: "Production team sees production impacts. Procurement sees purchase order impacts. No noise." },
            { title: "Dashboard at a glance", body: "One amber card on the dashboard shows all open impacts with inline Acknowledge buttons." },
            { title: "Lifecycle governance", body: "Draft records auto-actioned. In-flight orders require conscious acknowledgement or resolution." },
          ].map((f) => (
            <div key={f.title} className="flex gap-3 rounded-lg border bg-card p-4">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <div>
                <div className="font-semibold text-sm">{f.title}</div>
                <div className="text-xs text-muted-foreground">{f.body}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Next Steps ───────────────────────────────────────────────────────── */}
      <div className="rounded-lg border bg-primary/5 px-6 py-5">
        <p className="font-semibold text-sm mb-3">Continue exploring</p>
        <div className="flex flex-wrap gap-2">
          {[
            { label: "BOM Management", href: "/boms" },
            { label: "Production Orders", href: "/production-orders" },
            { label: "Purchase Orders", href: "/purchase-orders" },
            { label: "Dashboard", href: "/dashboard" },
            { label: "Workflow Builder", href: "/workflow-builder" },
            { label: "Executive Showcase", href: "/showcase" },
          ].map((l) => (
            <Button key={l.href} asChild variant="outline" size="sm">
              <Link href={l.href}>
                {l.label} <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          ))}
        </div>
      </div>

    </div>
  );
}
