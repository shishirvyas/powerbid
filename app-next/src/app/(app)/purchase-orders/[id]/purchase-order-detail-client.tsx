"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Download, Loader2, Mail, MessageCircle, Pencil, Printer, Send, ShieldCheck, ShieldX, Upload } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { api, ApiClientError } from "@/lib/api-client";
import { useResource } from "@/lib/hooks";
import { formatCurrency, formatDate } from "@/lib/calc";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type PoDetail = {
  id: number;
  poNumber: string;
  soId: number | null;
  bomId: number | null;
  expectedDate: string | null;
  status: string;
  approvalMode: string;
  approvedBy: number | null;
  approvedAt: string | null;
  selfApprovalScanName: string | null;
  selfApprovalScanPath: string | null;
  currency: string;
  subtotal: string;
  taxableAmount: string;
  gstAmount: string;
  grandTotal: string;
  remarks: string | null;
  termsConditions: string | null;
  paymentTerms: string | null;
  supplier: {
    id: number;
    code: string;
    companyName: string;
    email: string | null;
    phone: string | null;
  } | null;
  items: Array<{
    id: number;
    productName: string;
    unitName: string | null;
    qty: string;
    unitPrice: string;
    gstRate: string;
    lineTotal: string;
  }>;
};

type DispatchLog = {
  id: number;
  channel: string;
  status: string;
  recipient: string;
  error: string | null;
  createdAt: string;
};

type ApprovalData = {
  po: { id: number; status: string };
  approvals: Array<{
    id: number;
    approverId: number;
    approverName: string | null;
    approverEmail: string | null;
    status: string;
    comments: string | null;
    approvedAt: string | null;
  }>;
  approvers: Array<{ id: number; name: string; email: string; role: string }>;
  me: number;
  meRole: string;
};

function statusVariant(status: string): "muted" | "info" | "success" | "warning" | "destructive" | "secondary" {
  if (status === "approved") return "success";
  if (status === "pending_approval") return "warning";
  if (status === "sent") return "info";
  if (status === "cancelled" || status === "rejected") return "destructive";
  if (status === "closed") return "secondary";
  return "muted";
}

export default function PurchaseOrderDetailClient({ id }: { id: string }) {
  const { data, loading, error, refresh } = useResource<PoDetail>(`/api/purchase-orders/${id}`);
  const { data: logs, refresh: refreshLogs } = useResource<DispatchLog[]>(`/api/purchase-orders/${id}/dispatch`);
  const { data: approvals, refresh: refreshApprovals } = useResource<ApprovalData>(`/api/purchase-orders/${id}/approval`);

  const [sending, setSending] = React.useState<"email" | "whatsapp" | null>(null);
  const [acting, setActing] = React.useState<"submit" | "approve" | "reject" | "self_approve" | null>(null);
  const [scanUploading, setScanUploading] = React.useState(false);
  const [selectedApproverIds, setSelectedApproverIds] = React.useState<number[]>([]);

  React.useEffect(() => {
    if (!approvals) return;
    if (approvals.approvals.length > 0) {
      setSelectedApproverIds(approvals.approvals.map((a) => a.approverId));
      return;
    }
    if (approvals.approvers.length > 0) {
      const defaults = approvals.approvers.slice(0, Math.min(2, approvals.approvers.length)).map((a) => a.id);
      setSelectedApproverIds(defaults);
    }
  }, [approvals]);

  async function sendEmail() {
    if (!data) return;
    const to = window.prompt("Recipient email", data.supplier?.email || "");
    if (!to) return;
    const subject = window.prompt("Email subject", `Purchase Order ${data.poNumber}`) || undefined;
    try {
      setSending("email");
      await api(`/api/purchase-orders/${id}/dispatch`, {
        method: "POST",
        json: { channel: "email", to, subject, attachPdf: true },
      });
      toast.success("Purchase order emailed successfully");
      refresh();
      refreshLogs();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "Email send failed");
    } finally {
      setSending(null);
    }
  }

  async function sendWhatsApp() {
    if (!data) return;
    const to = window.prompt("WhatsApp number (with country code)", data.supplier?.phone || "");
    if (!to) return;
    const message = window.prompt("Message", `Please find Purchase Order ${data.poNumber}.`) || undefined;
    try {
      setSending("whatsapp");
      const res = await api<{ whatsappUrl?: string }>(`/api/purchase-orders/${id}/dispatch`, {
        method: "POST",
        json: { channel: "whatsapp", to, message, attachPdf: true },
      });
      if (res.whatsappUrl) window.open(res.whatsappUrl, "_blank");
      toast.success("WhatsApp message prepared");
      refresh();
      refreshLogs();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "WhatsApp send failed");
    } finally {
      setSending(null);
    }
  }

  async function submitForApproval() {
    if (!approvals || approvals.approvers.length === 0) {
      toast.error("No active approvers found");
      return;
    }
    if (selectedApproverIds.length === 0) {
      toast.error("Enter at least one valid approver id");
      return;
    }

    try {
      setActing("submit");
      await api(`/api/purchase-orders/${id}/approval`, { method: "POST", json: { approverIds: selectedApproverIds } });
      toast.success("Submitted for approval");
      refresh();
      refreshApprovals();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "Submit for approval failed");
    } finally {
      setActing(null);
    }
  }

  async function actionApproval(status: "approved" | "rejected") {
    try {
      setActing(status === "approved" ? "approve" : "reject");
      const comments = window.prompt(status === "approved" ? "Approval comments (optional)" : "Rejection reason (optional)") || undefined;
      await api(`/api/purchase-orders/${id}/approval`, { method: "PATCH", json: { status, comments } });
      toast.success(status === "approved" ? "PO approved" : "PO rejected");
      refresh();
      refreshApprovals();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "Approval action failed");
    } finally {
      setActing(null);
    }
  }

  async function uploadSelfApprovalScan(file: File | null) {
    if (!file) return;
    try {
      setScanUploading(true);
      const body = new FormData();
      body.append("file", file);
      await api(`/api/purchase-orders/${id}/approval-scan`, { method: "POST", body });
      toast.success("Signed approval scan uploaded");
      refresh();
      refreshApprovals();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "Scan upload failed");
    } finally {
      setScanUploading(false);
    }
  }

  async function selfApproveWithScan() {
    if (!data?.selfApprovalScanPath) {
      toast.error("Upload signed approval scan before self-approval");
      return;
    }
    try {
      setActing("self_approve");
      const comments = window.prompt("Self-approval comments (optional)") || undefined;
      await api(`/api/purchase-orders/${id}/approval`, {
        method: "PATCH",
        json: { status: "approved", mode: "self_with_scan", comments },
      });
      toast.success("PO self-approved with scan");
      refresh();
      refreshApprovals();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "Self-approval failed");
    } finally {
      setActing(null);
    }
  }

  if (error) {
    return <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>;
  }
  if (loading || !data) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }

  const myPendingApproval = approvals?.approvals.find((a) => a.approverId === approvals.me && a.status === "pending");
  const canSubmitApproval = approvals?.meRole === "admin" || approvals?.meRole === "sales" || approvals?.meRole === "procurement";

  function toggleApprover(userId: number) {
    setSelectedApproverIds((prev) => {
      if (prev.includes(userId)) return prev.filter((idVal) => idVal !== userId);
      return [...prev, userId];
    });
  }

  return (
    <div className="space-y-6 animate-in fade-in-50">
      <PageHeader
        title={data.poNumber}
        description={`Expected ${formatDate(data.expectedDate || new Date().toISOString())}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/purchase-orders">
                <ArrowLeft className="h-4 w-4" /> Back
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/purchase-orders/${id}/print`} target="_blank">
                <Printer className="h-4 w-4" /> Print
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/api/purchase-orders/${id}/pdf`} target="_blank">
                <Download className="h-4 w-4" /> Download PDF
              </Link>
            </Button>
            <Button variant="outline" onClick={sendEmail} disabled={sending !== null || data.status !== "approved"}>
              {sending === "email" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Send Email
            </Button>
            <Button variant="outline" onClick={sendWhatsApp} disabled={sending !== null || data.status !== "approved"}>
              {sending === "whatsapp" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />} Send WhatsApp
            </Button>
            {canSubmitApproval ? (
              <Button variant="outline" onClick={submitForApproval} disabled={acting !== null || selectedApproverIds.length === 0}>
                {acting === "submit" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Submit Approval
              </Button>
            ) : null}
            {myPendingApproval ? (
              <>
                <Button variant="outline" onClick={() => actionApproval("approved")} disabled={acting !== null}>
                  {acting === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Approve
                </Button>
                <Button variant="outline" onClick={() => actionApproval("rejected")} disabled={acting !== null}>
                  {acting === "reject" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldX className="h-4 w-4" />} Reject
                </Button>
              </>
            ) : null}
            <Button asChild>
              <Link href={`/purchase-orders/${id}/edit`}>
                <Pencil className="h-4 w-4" /> Edit
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Supplier</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <div className="font-semibold">{data.supplier?.companyName || "—"}</div>
            <div className="text-muted-foreground">Code: {data.supplier?.code || "—"}</div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {data.supplier?.email ? <span>{data.supplier.email}</span> : null}
              {data.supplier?.phone ? <span>{data.supplier.phone}</span> : null}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={statusVariant(data.status)}>{data.status.replaceAll("_", " ")}</Badge>
            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
              <div>Linked SO: {data.soId ? `SO-${data.soId}` : "—"}</div>
              <div>Linked BOM: {data.bomId ? `BOM-${data.bomId}` : "—"}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Line items</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">GST %</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((it, i) => (
                <TableRow key={it.id}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell>
                    <div className="font-medium">{it.productName}</div>
                    {it.unitName ? <div className="text-xs text-muted-foreground">{it.unitName}</div> : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{Number(it.qty).toLocaleString("en-IN")}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(it.unitPrice, data.currency)}</TableCell>
                  <TableCell className="text-right tabular-nums">{Number(it.gstRate).toFixed(2)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(it.lineTotal, data.currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Terms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <Section title="Payment terms" body={data.paymentTerms} />
            <Section title="Terms & conditions" body={data.termsConditions} />
            <Section title="Remarks" body={data.remarks} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Totals</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <Row label="Subtotal" value={formatCurrency(data.subtotal, data.currency)} />
              <Row label="Taxable" value={formatCurrency(data.taxableAmount, data.currency)} />
              <Row label="GST" value={formatCurrency(data.gstAmount, data.currency)} />
              <div className="my-2 h-px bg-border" />
              <Row label="Grand total" value={formatCurrency(data.grandTotal, data.currency)} strong />
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Approval Matrix</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 rounded-md border bg-muted/30 p-3">
            <div className="mb-2 text-sm font-medium">Self Approval With Signed Scan</div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <Upload className="h-4 w-4" />
                Upload Signed Scan
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  onChange={(e) => {
                    void uploadSelfApprovalScan(e.currentTarget.files?.[0] ?? null);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
              <Button
                variant="outline"
                onClick={selfApproveWithScan}
                disabled={acting !== null || !data.selfApprovalScanPath || data.status === "approved"}
              >
                {acting === "self_approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Self Approve
              </Button>
              {scanUploading ? <span className="text-xs text-muted-foreground">Uploading...</span> : null}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {data.selfApprovalScanName
                ? `Uploaded scan: ${data.selfApprovalScanName}`
                : "No signed scan uploaded yet"}
            </div>
          </div>

          {approvals && canSubmitApproval ? (
            <div className="mb-4 rounded-md border bg-muted/40 p-3">
              <div className="mb-2 text-sm font-medium">Select Approvers</div>
              <div className="grid gap-2 md:grid-cols-2">
                {approvals.approvers.map((u) => (
                  <label key={u.id} className="flex items-center gap-2 rounded border bg-background px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedApproverIds.includes(u.id)}
                      onChange={() => toggleApprover(u.id)}
                    />
                    <span className="font-medium">{u.name}</span>
                    <span className="text-xs text-muted-foreground">({u.role})</span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}

          {!approvals || approvals.approvals.length === 0 ? (
            <div className="text-sm text-muted-foreground">No approvals configured yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Approver</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Comments</TableHead>
                  <TableHead>Actioned At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approvals.approvals.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{a.approverName || a.approverEmail || `User #${a.approverId}`}</TableCell>
                    <TableCell><Badge variant={statusVariant(a.status)}>{a.status}</Badge></TableCell>
                    <TableCell>{a.comments || "-"}</TableCell>
                    <TableCell>{a.approvedAt ? formatDate(a.approvedAt) : "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dispatch history</CardTitle>
        </CardHeader>
        <CardContent>
          {!logs || logs.length === 0 ? (
            <div className="text-sm text-muted-foreground">No send attempts yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Recipient</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{formatDate(log.createdAt)}</TableCell>
                    <TableCell className="capitalize">{log.channel}</TableCell>
                    <TableCell>{log.recipient}</TableCell>
                    <TableCell className="capitalize">{log.status}</TableCell>
                    <TableCell className="text-destructive">{log.error || "-"}</TableCell>
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

function Section({ title, body }: { title: string; body: string | null }) {
  if (!body) return null;
  const plain = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{title}</div>
      <p className="whitespace-pre-wrap">{plain || "-"}</p>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${strong ? "text-base font-semibold" : ""}`}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
