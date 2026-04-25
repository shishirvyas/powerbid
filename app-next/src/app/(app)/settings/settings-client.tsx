"use client";

import * as React from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
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

type Tab = "brands" | "units" | "gst";

type Brand = { id: number; name: string; isActive: boolean };
type Unit = { id: number; code: string; name: string; isActive: boolean };
type Gst = { id: number; name: string; rate: string; isActive: boolean };

type Listing<T> = { rows: T[] };

export function SettingsClient() {
  const [tab, setTab] = React.useState<Tab>("brands");

  return (
    <div className="space-y-6 animate-in fade-in-50">
      <PageHeader title="Settings" description="Master data: brands, units, and GST slabs." />

      <div className="inline-flex rounded-md border bg-muted/30 p-1">
        <TabBtn current={tab} setCurrent={setTab} value="brands" label="Brands" />
        <TabBtn current={tab} setCurrent={setTab} value="units" label="Units" />
        <TabBtn current={tab} setCurrent={setTab} value="gst" label="GST slabs" />
      </div>

      {tab === "brands" ? <BrandsPanel /> : null}
      {tab === "units" ? <UnitsPanel /> : null}
      {tab === "gst" ? <GstPanel /> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">About</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          PowerBid · Quotation Suite. Master data drives product pricing and quotation tax.
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

/* ------------------------------ Brands -------------------------------- */
function BrandsPanel() {
  const [rows, setRows] = React.useState<Brand[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Brand | null>(null);
  const [confirmDel, setConfirmDel] = React.useState<Brand | null>(null);
  const [form, setForm] = React.useState({ name: "", isActive: true });

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await api<Listing<Brand>>("/api/masters/brands");
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

  function openNew() {
    setEditing(null);
    setForm({ name: "", isActive: true });
    setOpen(true);
  }
  function openEdit(b: Brand) {
    setEditing(b);
    setForm({ name: b.name, isActive: b.isActive });
    setOpen(true);
  }

  async function save() {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    try {
      if (editing) {
        await api(`/api/masters/brands/${editing.id}`, { method: "PUT", json: form });
      } else {
        await api("/api/masters/brands", { method: "POST", json: form });
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
      title="Brands"
      onNew={openNew}
      headers={["Name", "Status", ""]}
      loading={loading}
      empty={rows.length === 0}
      rows={rows.map((b) => (
        <TableRow key={b.id}>
          <TableCell className="font-medium">{b.name}</TableCell>
          <TableCell>
            <Badge variant={b.isActive ? "success" : "muted"}>{b.isActive ? "Active" : "Inactive"}</Badge>
          </TableCell>
          <TableCell className="text-right">
            <div className="flex justify-end gap-1">
              <Button variant="ghost" size="icon" onClick={() => openEdit(b)}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setConfirmDel(b)}>
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
            <DialogTitle>{editing ? "Edit brand" : "New brand"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
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
        title="Delete brand?"
        description={confirmDel ? `"${confirmDel.name}" will be removed.` : undefined}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          if (!confirmDel) return;
          try {
            await api(`/api/masters/brands/${confirmDel.id}`, { method: "DELETE" });
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

/* ------------------------------- Units -------------------------------- */
function UnitsPanel() {
  const [rows, setRows] = React.useState<Unit[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Unit | null>(null);
  const [confirmDel, setConfirmDel] = React.useState<Unit | null>(null);
  const [form, setForm] = React.useState({ code: "", name: "", isActive: true });

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await api<Listing<Unit>>("/api/masters/units");
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
    if (!form.code.trim() || !form.name.trim()) {
      toast.error("Code and name are required");
      return;
    }
    try {
      if (editing) {
        await api(`/api/masters/units/${editing.id}`, { method: "PUT", json: form });
      } else {
        await api("/api/masters/units", { method: "POST", json: form });
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
      title="Units"
      onNew={() => {
        setEditing(null);
        setForm({ code: "", name: "", isActive: true });
        setOpen(true);
      }}
      headers={["Code", "Name", "Status", ""]}
      loading={loading}
      empty={rows.length === 0}
      rows={rows.map((u) => (
        <TableRow key={u.id}>
          <TableCell className="font-mono text-xs">{u.code}</TableCell>
          <TableCell className="font-medium">{u.name}</TableCell>
          <TableCell>
            <Badge variant={u.isActive ? "success" : "muted"}>{u.isActive ? "Active" : "Inactive"}</Badge>
          </TableCell>
          <TableCell className="text-right">
            <div className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setEditing(u);
                  setForm({ code: u.code, name: u.name, isActive: u.isActive });
                  setOpen(true);
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setConfirmDel(u)}>
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
            <DialogTitle>{editing ? "Edit unit" : "New unit"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Code *</Label>
              <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} maxLength={20} />
            </div>
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
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
        title="Delete unit?"
        description={confirmDel ? `${confirmDel.code} — ${confirmDel.name}` : undefined}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          if (!confirmDel) return;
          try {
            await api(`/api/masters/units/${confirmDel.id}`, { method: "DELETE" });
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
