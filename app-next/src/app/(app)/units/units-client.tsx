"use client";

import * as React from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
import { TableSkeleton } from "@/components/table-skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { api, ApiClientError } from "@/lib/api-client";

type Unit = { id: number; code: string; name: string; isActive: boolean };
type Listing<T> = { rows: T[] };

export function UnitsClient() {
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

  function openNew() {
    setEditing(null);
    setForm({ code: "", name: "", isActive: true });
    setOpen(true);
  }

  function openEdit(u: Unit) {
    setEditing(u);
    setForm({ code: u.code, name: u.name, isActive: u.isActive });
    setOpen(true);
  }

  async function save() {
    if (!form.code.trim() || !form.name.trim()) {
      toast.error("Code and name are required");
      return;
    }
    try {
      if (editing) {
        await api(`/api/masters/units/${editing.id}`, { method: "PUT", json: form });
        toast.success("Unit updated");
      } else {
        await api("/api/masters/units", { method: "POST", json: form });
        toast.success("Unit created");
      }
      setOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "Save failed");
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in-50">
      <PageHeader
        title="Units"
        description="Manage product units (e.g., kg, liter, pieces)."
        actions={
          <Button onClick={openNew}>
            <Plus className="h-4 w-4" /> New unit
          </Button>
        }
      />

      {loading ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground mb-4">No units yet</p>
              <Button onClick={openNew}>
                <Plus className="h-4 w-4" /> Create first unit
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-mono text-xs">{u.code}</TableCell>
                  <TableCell className="font-medium">{u.name}</TableCell>
                  <TableCell>
                    <Badge variant={u.isActive ? "success" : "muted"}>
                      {u.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setConfirmDel(u)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit unit" : "New unit"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Code *</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                maxLength={20}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
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
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
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
            toast.success("Unit deleted");
            setConfirmDel(null);
            load();
          } catch (e) {
            toast.error(e instanceof ApiClientError ? e.message : "Delete failed");
          }
        }}
      />
    </div>
  );
}
