"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ExternalLink, Layers, Loader2, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebounced, useList } from "@/lib/hooks";
import { api, ApiClientError } from "@/lib/api-client";
import { formatDate } from "@/lib/calc";

type WorkflowBomRow = {
  id: number;
  bomCode: string;
  version: string;
  isActive: boolean;
  soId: number | null;
  soNumber: string | null;
  productName: string;
  productSku: string | null;
  createdAt: string;
  itemCount: number;
  supplierReadyCount: number;
  openPoCount: number;
  openPos: Array<{ id: number; poNumber: string }>;
};

export function WorkflowControlClient() {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const q = useDebounced(search, 300);
  const [busyBomId, setBusyBomId] = React.useState<number | null>(null);

  const { data, loading, error, refresh } = useList<WorkflowBomRow>("/api/workflow-control/boms-ready", {
    q,
    limit: 100,
    offset: 0,
  });

  async function generatePo(bomId: number) {
    try {
      setBusyBomId(bomId);
      const res = await api<{
        created: boolean;
        poId?: number;
        poNumber?: string;
        reason?: string;
        pos?: Array<{ id: number; poNumber: string; supplierId: number }>;
        poCount?: number;
        skippedUnmappedLines?: number;
      }>(
        "/api/workflow-control/generate-po",
        { method: "POST", json: { bomId } },
      );

      if (!res.created && res.reason === "open_po_exists" && res.poId) {
        toast.warning(`Open PO already exists (${res.poNumber || `#${res.poId}`})`);
        router.push(`/purchase-orders/${res.poId}`);
        return;
      }

      if (res.created && res.pos && res.pos.length === 1) {
        toast.success(`Purchase Order ${res.pos[0].poNumber} created`);
        router.push(`/purchase-orders/${res.pos[0].id}`);
        return;
      }

      if (res.created && res.pos && res.pos.length > 1) {
        const skipped = res.skippedUnmappedLines ? ` (${res.skippedUnmappedLines} unmapped lines skipped)` : "";
        toast.success(`${res.pos.length} Purchase Orders created${skipped}`);
        router.push("/purchase-orders");
        return;
      }

      toast.warning("PO generation finished with no new PO created");
      refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to generate PO");
    } finally {
      setBusyBomId(null);
      refresh();
    }
  }

  return (
    <div className="space-y-3 animate-in fade-in-50">
      <PageHeader
        title="Workflow Control"
        description="BOM → Procurement handoff. Generate draft purchase orders directly from BOM rows."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/purchase-orders">
              Open Purchase Orders <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      <div className="flex items-center justify-between gap-3">
        <Input
          placeholder="Search BOM code / product / SO..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 max-w-sm text-sm"
        />
        {data ? (
          <span className="text-xs text-muted-foreground tabular-nums">
            {data.rows.length} of {data.total} BOM{data.total === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      {loading && !data ? (
        <div className="space-y-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-md border bg-muted/40" />
          ))}
        </div>
      ) : null}

      {!loading && data && data.rows.length === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          No BOM rows available for workflow control.
        </div>
      ) : null}

      {data && data.rows.length > 0 ? (
        <div className="overflow-hidden rounded-md border border-border/70 bg-card">
          {/* Header */}
          <div className="hidden lg:grid grid-cols-[160px_1fr_140px_72px_72px_88px_120px_1fr_180px] items-center gap-3 border-b bg-muted/40 px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <div>BOM</div>
            <div>Product</div>
            <div>SO</div>
            <div className="text-right">Items</div>
            <div className="text-right">Sup. Ready</div>
            <div className="text-right">Open PO</div>
            <div>Created</div>
            <div>Linked POs</div>
            <div className="text-right">Action</div>
          </div>

          <ul className="divide-y divide-border/60">
            {data.rows.map((row) => {
              const hasOpenPo = row.openPoCount > 0;
              const generating = busyBomId === row.id;
              const canGenerate = !hasOpenPo && row.isActive && row.supplierReadyCount > 0;
              const buttonLabel = hasOpenPo
                ? "PO Generated"
                : !row.isActive
                  ? "Inactive"
                  : row.supplierReadyCount === 0
                    ? "Map Supplier"
                    : "Generate PO";

              return (
                <li
                  key={row.id}
                  className="grid grid-cols-1 lg:grid-cols-[160px_1fr_140px_72px_72px_88px_120px_1fr_180px] items-center gap-x-3 gap-y-1 px-3 py-2 text-sm hover:bg-muted/30"
                >
                  {/* BOM code + version + active badge */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-xs truncate">{row.bomCode}</span>
                    <span className="text-[10px] text-muted-foreground">v{row.version}</span>
                    {!row.isActive ? (
                      <Badge variant="muted" className="h-4 px-1 text-[10px]">Inactive</Badge>
                    ) : null}
                  </div>

                  {/* Product */}
                  <div className="min-w-0">
                    <div className="truncate font-medium">{row.productName}</div>
                    <div className="truncate text-[11px] text-muted-foreground">{row.productSku || "No SKU"}</div>
                  </div>

                  {/* SO */}
                  <div className="font-mono text-xs text-muted-foreground truncate">
                    <span className="lg:hidden text-[10px] uppercase mr-1">SO:</span>
                    {row.soNumber || "-"}
                  </div>

                  {/* Items */}
                  <div className="text-right tabular-nums">
                    <span className="lg:hidden text-[10px] uppercase mr-1">Items:</span>
                    {row.itemCount}
                  </div>

                  {/* Supplier Ready */}
                  <div
                    className={`text-right tabular-nums ${
                      row.supplierReadyCount === 0 ? "text-amber-600" : ""
                    }`}
                  >
                    <span className="lg:hidden text-[10px] uppercase mr-1">Sup:</span>
                    {row.supplierReadyCount}/{row.itemCount}
                  </div>

                  {/* Open PO count */}
                  <div className="text-right tabular-nums">
                    <span className="lg:hidden text-[10px] uppercase mr-1">Open PO:</span>
                    <span className={hasOpenPo ? "font-medium text-emerald-600" : "text-muted-foreground"}>
                      {row.openPoCount}
                    </span>
                  </div>

                  {/* Created */}
                  <div className="text-xs text-muted-foreground tabular-nums truncate">
                    <span className="lg:hidden text-[10px] uppercase mr-1">Created:</span>
                    {formatDate(row.createdAt)}
                  </div>

                  {/* Linked POs (chips) */}
                  <div className="min-w-0">
                    {row.openPos.length === 0 ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {row.openPos.slice(0, 3).map((po) => (
                          <Link
                            key={po.id}
                            href={`/purchase-orders/${po.id}`}
                            className="inline-flex items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[11px] hover:bg-accent"
                            title={po.poNumber}
                          >
                            {po.poNumber}
                            <ExternalLink className="h-3 w-3 opacity-60" />
                          </Link>
                        ))}
                        {row.openPos.length > 3 ? (
                          <span className="text-[11px] text-muted-foreground">+{row.openPos.length - 3}</span>
                        ) : null}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      size="sm"
                      variant={canGenerate ? "default" : "outline"}
                      className="h-7 px-2 text-xs"
                      onClick={() => generatePo(row.id)}
                      disabled={generating || !canGenerate}
                    >
                      {generating ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <PackageCheck className="h-3.5 w-3.5" />
                      )}
                      <span className="ml-1">{buttonLabel}</span>
                    </Button>
                    <Button asChild size="sm" variant="outline" className="h-7 w-7 p-0" title="Open BOM">
                      <Link href={`/boms?highlight=${row.id}`}>
                        <Layers className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
