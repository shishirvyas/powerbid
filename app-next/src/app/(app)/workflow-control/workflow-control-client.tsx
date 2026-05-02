"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ExternalLink, Layers, Loader2, PackageCheck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
    <div className="space-y-6 animate-in fade-in-50">
      <PageHeader
        title="Workflow Control"
        description="BOM to Procurement handoff. Generate draft purchase orders directly from BOM cards."
        actions={
          <Button asChild variant="outline">
            <Link href="/purchase-orders">
              Open Purchase Orders <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      <div className="max-w-md">
        <Input
          placeholder="Search BOM code / product / SO..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {loading && !data ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl border bg-muted/40" />
          ))}
        </div>
      ) : null}

      {!loading && data && data.rows.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
          No BOM cards available for workflow control.
        </div>
      ) : null}

      {data && data.rows.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.rows.map((row) => {
            const hasOpenPo = row.openPoCount > 0;
            const generating = busyBomId === row.id;

            return (
              <Card key={row.id} className="border-border/70">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="font-mono text-sm">{row.bomCode}</CardTitle>
                      <CardDescription>v{row.version}</CardDescription>
                    </div>
                    <Badge variant={row.isActive ? "success" : "muted"}>{row.isActive ? "Active" : "Inactive"}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="text-sm font-medium">{row.productName}</div>
                    <div className="text-xs text-muted-foreground">{row.productSku || "No SKU"}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md bg-muted/40 p-2">
                      <div className="text-muted-foreground">SO</div>
                      <div className="font-mono">{row.soNumber || "-"}</div>
                    </div>
                    <div className="rounded-md bg-muted/40 p-2">
                      <div className="text-muted-foreground">Items</div>
                      <div className="font-medium">{row.itemCount}</div>
                    </div>
                    <div className="rounded-md bg-muted/40 p-2">
                      <div className="text-muted-foreground">Open PO</div>
                      <div className="font-medium">{row.openPoCount}</div>
                    </div>
                    <div className="rounded-md bg-muted/40 p-2">
                      <div className="text-muted-foreground">Supplier Ready</div>
                      <div className="font-medium">{row.supplierReadyCount}</div>
                    </div>
                    <div className="rounded-md bg-muted/40 p-2">
                      <div className="text-muted-foreground">Created</div>
                      <div>{formatDate(row.createdAt)}</div>
                    </div>
                  </div>

                  {hasOpenPo ? (
                    <div className="rounded-md border border-border bg-muted/40 px-2 py-2 space-y-1">
                      <div className="text-xs text-muted-foreground font-medium">Linked Purchase Orders</div>
                      <div className="flex flex-wrap gap-1.5">
                        {row.openPos.map((po) => (
                          <Link
                            key={po.id}
                            href={`/purchase-orders/${po.id}`}
                            className="inline-flex items-center gap-1 rounded-sm bg-background border border-border px-2 py-0.5 text-xs font-mono hover:bg-accent transition-colors"
                          >
                            {po.poNumber}
                            <ExternalLink className="h-3 w-3 opacity-60" />
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="flex gap-2">
                    <Button
                      className="flex-1"
                      onClick={() => generatePo(row.id)}
                      disabled={generating || hasOpenPo || !row.isActive || row.supplierReadyCount === 0}
                    >
                      {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
                      {hasOpenPo ? "PO Generated" : row.supplierReadyCount === 0 ? "Map Supplier Product" : "Generate PO"}
                    </Button>
                    <Button variant="outline" asChild>
                      <Link href={`/boms?highlight=${row.id}`}>
                        <Layers className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
