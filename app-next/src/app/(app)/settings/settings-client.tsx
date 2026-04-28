"use client";

import * as React from "react";
import { Loader2, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { api, ApiClientError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { APP_NAME, COMPANY_NAME } from "@/lib/branding";

type Tab = "gst" | "communications";

type Unit = { id: number; code: string; name: string; isActive: boolean };
type Gst = { id: number; name: string; rate: string; isActive: boolean };

type Listing<T> = { rows: T[] };

export function SettingsClient() {
  const [tab, setTab] = React.useState<Tab>("gst");

  return (
    <div className="space-y-6 animate-in fade-in-50">
      <PageHeader title="Settings" description="Master data: GST slabs and communication templates." />

      <div className="inline-flex rounded-md border bg-muted/30 p-1">
        <TabBtn current={tab} setCurrent={setTab} value="gst" label="GST slabs" />
        <TabBtn current={tab} setCurrent={setTab} value="communications" label="Communications" />
      </div>

      {tab === "gst" ? <GstPanel /> : null}
      {tab === "communications" ? <CommunicationsPanel /> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">About</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {APP_NAME} · {COMPANY_NAME}. Master data drives product pricing and quotation tax.
        </CardContent>
      </Card>
    </div>
  );
}

function TabBtn({
  current,
  setCurrent,
  value,
  label,
}: {
  current: Tab;
  setCurrent: (t: Tab) => void;
  value: Tab;
  label: string;
}) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => setCurrent(value)}
      className={cn(
        "rounded px-3 py-1.5 text-sm transition-colors",
        active ? "bg-background shadow-sm font-medium" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

/* -------------------------------- GST --------------------------------- */
function GstPanel() {
  const [rows, setRows] = React.useState<Gst[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Gst | null>(null);
  const [confirmDel, setConfirmDel] = React.useState<Gst | null>(null);
  const [form, setForm] = React.useState({ name: "", rate: "0", isActive: true });

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await api<Listing<Gst>>("/api/masters/gst");
      setRows(r.rows);
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);
  React.useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    try {
      if (editing) {
        await api(`/api/masters/gst/${editing.id}`, { method: "PUT", json: form });
      } else {
        await api("/api/masters/gst", { method: "POST", json: form });
      }
      toast.success("Saved");
      setOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "Save failed");
    }
  }

  return (
    <MasterPanel
      title="GST slabs"
      onNew={() => {
        setEditing(null);
        setForm({ name: "", rate: "0", isActive: true });
        setOpen(true);
      }}
      headers={["Name", "Rate", "Status", ""]}
      loading={loading}
      empty={rows.length === 0}
      rows={rows.map((g) => (
        <TableRow key={g.id}>
          <TableCell className="font-medium">{g.name}</TableCell>
          <TableCell className="tabular-nums">{Number(g.rate).toFixed(2)}%</TableCell>
          <TableCell>
            <Badge variant={g.isActive ? "success" : "muted"}>{g.isActive ? "Active" : "Inactive"}</Badge>
          </TableCell>
          <TableCell className="text-right">
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setEditing(g);
                  setForm({ name: g.name, rate: g.rate, isActive: g.isActive });
                  setOpen(true);
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setConfirmDel(g)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </TableCell>
        </TableRow>
      ))}
    >
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit GST slab" : "New GST slab"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Rate (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.rate}
                onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.isActive ? "1" : "0"}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.value === "1" }))}
              >
                <option value="1">Active</option>
                <option value="0">Inactive</option>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!confirmDel}
        onOpenChange={(v) => !v && setConfirmDel(null)}
        title="Delete GST slab?"
        description={confirmDel ? confirmDel.name : undefined}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          if (!confirmDel) return;
          try {
            await api(`/api/masters/gst/${confirmDel.id}`, { method: "DELETE" });
            toast.success("Deleted");
            setConfirmDel(null);
            load();
          } catch (e) {
            toast.error(e instanceof ApiClientError ? e.message : "Delete failed");
          }
        }}
      />
    </MasterPanel>
  );
}

type CommTemplate = {
  id: number;
  channel: "email" | "whatsapp";
  templateKey: string;
  name: string;
  subject: string | null;
  body: string;
  isActive: boolean;
};

function CommunicationsPanel() {
  const [rows, setRows] = React.useState<CommTemplate[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [savingChannel, setSavingChannel] = React.useState<"email" | "whatsapp" | null>(null);
  const [testTo, setTestTo] = React.useState("");
  const [testing, setTesting] = React.useState(false);
  const [emailTemplate, setEmailTemplate] = React.useState({ name: "Quotation Email", subject: "Quotation {{referenceNo}}", body: "" });
  const [waTemplate, setWaTemplate] = React.useState({ name: "Quotation WhatsApp", body: "" });

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await api<Listing<CommTemplate>>("/api/settings/communications");
      setRows(r.rows);
      const email = r.rows.find((x) => x.channel === "email" && x.templateKey === "quotation_send");
      const wa = r.rows.find((x) => x.channel === "whatsapp" && x.templateKey === "quotation_send");
      setEmailTemplate({
        name: email?.name || "Quotation Email",
        subject: email?.subject || "Quotation {{referenceNo}}",
        body: email?.body || "Dear {{customerName}},\n\nPlease find attached quotation {{referenceNo}}.\n\nRegards,\nBID",
      });
      setWaTemplate({
        name: wa?.name || "Quotation WhatsApp",
        body: wa?.body || "Dear {{customerName}}, please find quotation {{referenceNo}}. PDF: {{pdfUrl}}",
      });
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "Failed to load communication settings");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  async function saveEmailTemplate() {
    try {
      setSavingChannel("email");
      await api("/api/settings/communications", {
        method: "PUT",
        json: {
          channel: "email",
          templateKey: "quotation_send",
          name: emailTemplate.name,
          subject: emailTemplate.subject,
          body: emailTemplate.body,
          isActive: true,
        },
      });
      toast.success("Email template saved");
      load();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "Save failed");
    } finally {
      setSavingChannel(null);
    }
  }

  async function saveWaTemplate() {
    try {
      setSavingChannel("whatsapp");
      await api("/api/settings/communications", {
        method: "PUT",
        json: {
          channel: "whatsapp",
          templateKey: "quotation_send",
          name: waTemplate.name,
          subject: null,
          body: waTemplate.body,
          isActive: true,
        },
      });
      toast.success("WhatsApp template saved");
      load();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "Save failed");
    } finally {
      setSavingChannel(null);
    }
  }

  async function testSmtp() {
    if (!testTo.trim()) {
      toast.error("Enter a recipient email");
      return;
    }
    try {
      setTesting(true);
      await api("/api/settings/communications/smtp-test", {
        method: "POST",
        json: { to: testTo.trim() },
      });
      toast.success("SMTP test email sent");
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "SMTP test failed");
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">Loading...</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Template variables</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Use placeholders: {"{{customerName}}"}, {"{{quotationNo}}"}, {"{{referenceNo}}"}, {"{{projectName}}"}, {"{{pdfUrl}}"}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Email quotation template</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Template name</Label>
            <Input value={emailTemplate.name} onChange={(e) => setEmailTemplate((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Input value={emailTemplate.subject} onChange={(e) => setEmailTemplate((f) => ({ ...f, subject: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Body</Label>
            <textarea
              className="min-h-36 w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={emailTemplate.body}
              onChange={(e) => setEmailTemplate((f) => ({ ...f, body: e.target.value }))}
            />
          </div>
          <div>
            <Button onClick={saveEmailTemplate} disabled={savingChannel !== null}>
              {savingChannel === "email" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save email template
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">WhatsApp quotation template</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Template name</Label>
            <Input value={waTemplate.name} onChange={(e) => setWaTemplate((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Body</Label>
            <textarea
              className="min-h-28 w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={waTemplate.body}
              onChange={(e) => setWaTemplate((f) => ({ ...f, body: e.target.value }))}
            />
          </div>
          <div>
            <Button onClick={saveWaTemplate} disabled={savingChannel !== null}>
              {savingChannel === "whatsapp" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save WhatsApp template
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">SMTP test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Recipient email</Label>
            <Input value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="name@company.com" />
          </div>
          <div>
            <Button variant="outline" onClick={testSmtp} disabled={testing}>
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send test email
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active templates</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No templates saved yet. Defaults are currently in use.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Channel</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Name</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="capitalize">{r.channel}</TableCell>
                    <TableCell>{r.templateKey}</TableCell>
                    <TableCell>{r.name}</TableCell>
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

/* --------------------------- shared shell ----------------------------- */
function MasterPanel({
  title,
  onNew,
  headers,
  rows,
  loading,
  empty,
  children,
}: {
  title: string;
  onNew: () => void;
  headers: string[];
  rows: React.ReactNode[];
  loading: boolean;
  empty: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{title}</CardTitle>
        <Button size="sm" onClick={onNew}>
          <Plus className="h-4 w-4" /> New
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : empty ? (
          <p className="text-sm text-muted-foreground">No entries yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {headers.map((h, i) => (
                  <TableHead key={i} className={i === headers.length - 1 ? "text-right" : ""}>
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>{rows}</TableBody>
          </Table>
        )}
      </CardContent>
      {children}
    </Card>
  );
}
