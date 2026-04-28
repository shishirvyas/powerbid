"use client";

import * as React from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
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

type SubjectTemplate = {
  id: number;
  name: string;
  subjectText: string;
  introParagraph: string | null;
  isDefault: boolean;
  isActive: boolean;
};

type Listing<T> = { rows: T[] };

export function SubjectTemplatesClient() {
  const [rows, setRows] = React.useState<SubjectTemplate[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<SubjectTemplate | null>(null);
  const [confirmDel, setConfirmDel] = React.useState<SubjectTemplate | null>(null);
  const [form, setForm] = React.useState({
    name: "",
    subjectText: "",
    introParagraph: "",
    isDefault: false,
    isActive: true,
  });

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await api<Listing<SubjectTemplate>>("/api/masters/subject-templates");
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
    setForm({
      name: "",
      subjectText: "",
      introParagraph: "",
      isDefault: false,
      isActive: true,
    });
    setOpen(true);
  }

  function openEdit(t: SubjectTemplate) {
    setEditing(t);
    setForm({
      name: t.name,
      subjectText: t.subjectText,
      introParagraph: t.introParagraph ?? "",
      isDefault: t.isDefault,
      isActive: t.isActive,
    });
    setOpen(true);
  }

  async function save() {
    if (!form.name.trim() || !form.subjectText.trim()) {
      toast.error("Name and subject text are required");
      return;
    }
    try {
      if (editing) {
        await api(`/api/masters/subject-templates/${editing.id}`, {
          method: "PUT",
          json: form,
        });
        toast.success("Template updated");
      } else {
        await api("/api/masters/subject-templates", { method: "POST", json: form });
        toast.success("Template created");
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
        title="Subject Templates"
        description="Manage quotation subject templates with default option."
        actions={
          <Button onClick={openNew}>
            <Plus className="h-4 w-4" /> New template
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
              <p className="text-sm text-muted-foreground mb-4">No templates yet</p>
              <Button onClick={openNew}>
                <Plus className="h-4 w-4" /> Create first template
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Default</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="text-sm max-w-xs truncate">{t.subjectText}</TableCell>
                  <TableCell>
                    {t.isDefault && (
                      <Badge variant="default">Default</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={t.isActive ? "success" : "muted"}>
                      {t.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setConfirmDel(t)}>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit template" : "New template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Template Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g., Standard, Premium, etc."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Subject Line *</Label>
              <Input
                value={form.subjectText}
                onChange={(e) => setForm((f) => ({ ...f, subjectText: e.target.value }))}
                placeholder="e.g., Quotation for Supply of Materials"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Intro Paragraph</Label>
              <Textarea
                value={form.introParagraph}
                onChange={(e) => setForm((f) => ({ ...f, introParagraph: e.target.value }))}
                rows={4}
                placeholder="Introduction text for quotation..."
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
                  className="w-4 h-4"
                />
                <span className="text-sm">Use as default template</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="w-4 h-4"
                />
                <span className="text-sm">Active</span>
              </label>
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
        title="Delete template?"
        description={confirmDel ? `"${confirmDel.name}" will be deleted.` : undefined}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          if (!confirmDel) return;
          try {
            await api(`/api/masters/subject-templates/${confirmDel.id}`, { method: "DELETE" });
            toast.success("Template deleted");
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
