"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Play, PackageCheck, Scissors } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, ApiClientError } from "@/lib/api-client";
import { formatDate } from "@/lib/calc";
import { useResource } from "@/lib/hooks";

type Detail = {
  id: number;
  productionNumber: string;
  status: string;
  plannedQty: string;
  producedQty: string;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  productName: string;
  productSku: string | null;
  warehouseName: string;
  consumption: Array<{
    id: number;
    rawMaterialId: number;
    rawMaterialName: string;
    rawMaterialSku: string | null;
    qtyPlanned: string;
    qtyConsumed: string;
  }>;
  outputs: Array<{
    id: number;
    qtyProduced: string;
    remarks: string | null;
    createdAt: string;
  }>;
};

export default function ProductionOrderDetailClient({ id }: { id: string }) {
  const { data, loading, error, refresh } = useResource<Detail>(`/api/production-orders/${id}`);
  const [busy, setBusy] = React.useState<"start" | "complete" | null>(null);
  const [consumeBusyId, setConsumeBusyId] = React.useState<number | null>(null);
  const [consumeQty, setConsumeQty] = React.useState<Record<number, string>>({});
  const [completeQty, setCompleteQty] = React.useState("1");
  const [completeRemarks, setCompleteRemarks] = React.useState("");

  async function startProduction() {
    try {
      setBusy("start");
      await api(`/api/production-orders/${id}/start`, { method: "POST" });
      toast.success("Production started");
      refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Failed to start production");
    } finally {
      setBusy(null);
    }
  }

  async function consumeMaterial(rawMaterialId: number) {
    const qty = Number(consumeQty[rawMaterialId] || 0);
    if (qty <= 0) {
      toast.error("Enter a valid consume quantity");
      return;
    }
    try {
      setConsumeBusyId(rawMaterialId);
      await api(`/api/production-orders/${id}/consume`, {
        method: "POST",
        json: { rawMaterialId, qty },
      });
      toast.success("Material consumed");
      setConsumeQty((prev) => ({ ...prev, [rawMaterialId]: "" }));
      refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Consumption failed");
    } finally {
      setConsumeBusyId(null);
    }
  }

  async function completeProduction() {
    const qty = Number(completeQty || 0);
    if (qty <= 0) {
      toast.error("Enter produced quantity");
      return;
    }
    try {
      setBusy("complete");
      await api(`/api/production-orders/${id}/complete`, {
        method: "POST",
        json: { qtyProduced: qty, remarks: completeRemarks || null },
      });
      toast.success("Production completed and stock updated");
      refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Completion failed");
    } finally {
      setBusy(null);
    }
  }

  if (error) return <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>;
  if (loading || !data) return <div className="text-sm text-muted-foreground">Loading...</div>;

  const statusVariant = data.status === "completed" ? "success" : data.status === "in_progress" ? "warning" : "muted";

  return (
    <div className="space-y-6 animate-in fade-in-50">
      <PageHeader
        title={data.productionNumber}
        description={`${data.productName} · ${data.warehouseName}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/production-orders"><ArrowLeft className="h-4 w-4" /> Back</Link>
            </Button>
            {data.status === "draft" ? (
              <Button onClick={startProduction} disabled={busy !== null}>
                {busy === "start" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Start
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Overview</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Product</span><span>{data.productName} {data.productSku ? `(${data.productSku})` : ""}</span></div>
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Warehouse</span><span>{data.warehouseName}</span></div>
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Planned Qty</span><span className="tabular-nums">{Number(data.plannedQty).toLocaleString("en-IN")}</span></div>
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Produced Qty</span><span className="tabular-nums">{Number(data.producedQty).toLocaleString("en-IN")}</span></div>
            <div className="flex items-center justify-between"><span className="text-muted-foreground">Start Date</span><span>{data.startDate ? formatDate(data.startDate) : "-"}</span></div>
            <div className="flex items-center justify-between"><span className="text-muted-foreground">End Date</span><span>{data.endDate ? formatDate(data.endDate) : "-"}</span></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Status</CardTitle></CardHeader>
          <CardContent><Badge variant={statusVariant as any}>{data.status.replaceAll("_", " ")}</Badge></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Material Consumption</CardTitle></CardHeader>
        <CardContent>
          {data.consumption.length === 0 ? (
            <div className="text-sm text-muted-foreground">No BOM-based consumption plan on this order.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Planned</TableHead>
                  <TableHead className="text-right">Consumed</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                  <TableHead className="text-right">Consume</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.consumption.map((line) => {
                  const pending = Math.max(0, Number(line.qtyPlanned) - Number(line.qtyConsumed));
                  return (
                    <TableRow key={line.id}>
                      <TableCell>
                        <div className="font-medium">{line.rawMaterialName}</div>
                        <div className="text-xs text-muted-foreground">{line.rawMaterialSku || "No SKU"}</div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{Number(line.qtyPlanned).toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-right tabular-nums">{Number(line.qtyConsumed).toLocaleString("en-IN")}</TableCell>
                      <TableCell className="text-right tabular-nums">{pending.toLocaleString("en-IN")}</TableCell>
                      <TableCell>
                        {data.status === "in_progress" ? (
                          <div className="flex items-center justify-end gap-2">
                            <Input
                              className="w-28"
                              type="number"
                              min="0.0001"
                              step="0.0001"
                              value={consumeQty[line.rawMaterialId] ?? ""}
                              onChange={(e) => setConsumeQty((p) => ({ ...p, [line.rawMaterialId]: e.target.value }))}
                              placeholder="Qty"
                            />
                            <Button size="sm" onClick={() => consumeMaterial(line.rawMaterialId)} disabled={consumeBusyId !== null || pending <= 0}>
                              {consumeBusyId === line.rawMaterialId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scissors className="h-4 w-4" />}
                            </Button>
                          </div>
                        ) : (
                          <div className="text-right text-xs text-muted-foreground">{data.status === "completed" ? "Done" : "Start order"}</div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Finish Production</CardTitle></CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-3">
          <Input type="number" min="0.0001" step="0.0001" value={completeQty} onChange={(e) => setCompleteQty(e.target.value)} placeholder="Produced quantity" />
          <Input value={completeRemarks} onChange={(e) => setCompleteRemarks(e.target.value)} placeholder="Remarks" />
          <Button onClick={completeProduction} disabled={data.status !== "in_progress" || busy !== null}>
            {busy === "complete" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />} Complete & Post FG
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Output History</CardTitle></CardHeader>
        <CardContent>
          {data.outputs.length === 0 ? (
            <div className="text-sm text-muted-foreground">No output entries yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead className="text-right">Qty Produced</TableHead>
                  <TableHead>Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.outputs.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>{formatDate(o.createdAt)}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(o.qtyProduced).toLocaleString("en-IN")}</TableCell>
                    <TableCell>{o.remarks || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
