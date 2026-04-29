"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, EmptyState } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Pagination } from "@/components/pagination";
import { TableSkeleton } from "@/components/table-skeleton";
import {
  FormField,
  getServerFieldErrors,
  summarizeFieldErrors,
  useFieldErrors,
} from "@/components/form-field";
import { useDebounced, useList } from "@/lib/hooks";
import { api, ApiClientError } from "@/lib/api-client";

type Supplier = {
  id: number;
  code: string;
  companyName: string;
  gstin: string | null;
  pan: string | null;
  msmeStatus: string | null;
  paymentTerms: string | null;
  email: string | null;
  phone: string | null;
  rating: string | null;
  isActive: boolean;
  createdAt: string;
};

const empty: Partial<Supplier> = {
  code: "",
  companyName: "",
  gstin: "",
  pan: "",
  msmeStatus: "",
  paymentTerms: "",
  email: "",
  phone: "",
  rating: "",
  isActive: true,
};

const labelMap: Record<string, string> = {
  code: "Code",
  companyName: "Company Name",
  email: "Email",
  phone: "Phone",
  gstin: "GSTIN",
  pan: "PAN",
  msmeStatus: "MSME Status",
  paymentTerms: "Payment Terms",
  rating: "Rating",
};

export function SuppliersClient() {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const q = useDebounced(search, 300);
  const [limit, setLimit] = React.useState(25);
  const [offset, setOffset] = React.useState(0);

  React.useEffect(() => {
    setOffset(0);
  }, [q, limit]);

  const { data, loading, error, refresh } = useList<Supplier>("/api/suppliers", {
    q,
    limit,
    offset,
  });

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Supplier | null>(null);
  const [confirmDel, setConfirmDel] = React.useState<Supplier | null>(null);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(s: Supplier) {
    setEditing(s);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-6 animate-in fade-in-50">
      <PageHeader
        title="Suppliers"
        description="Vendors and suppliers you purchase from."
        actions={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> New supplier
          </Button>
        }
      />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, code, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {!loading && data && data.rows.length === 0 ? (
        <EmptyState
          title={q ? "No suppliers match your search" : "No suppliers yet"}
          description={q ? undefined : "Create your first supplier to get started."}
          action={
            !q ? (
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4" /> New supplier
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(data?.rows ?? []).slice(0, 6).map((s) => (
              <Card key={`card-${s.id}`} className="border-primary/20 bg-gradient-to-br from-background to-muted/30">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span className="truncate">{s.companyName}</span>
                    <Badge variant={s.isActive ? "success" : "muted"}>
                      {s.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="text-muted-foreground">{s.code}</div>
                  <div className="line-clamp-1">{s.email || "No email"}</div>
                  <div className="line-clamp-1">{s.phone || "No phone"}</div>
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-muted-foreground">Rating: {s.rating || "—"}</span>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/suppliers/${s.id}`}>Details</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Company Name</TableHead>
                <TableHead className="hidden md:table-cell">Phone</TableHead>
                <TableHead className="hidden lg:table-cell">Email</TableHead>
                <TableHead className="hidden xl:table-cell">Rating</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !data ? (
                <TableSkeleton cols={7} rows={6} />
              ) : (
                data?.rows.map((s) => (
                  <TableRow
                    key={s.id}
                    className="cursor-pointer transition-colors hover:bg-muted/40"
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest("button, a")) return;
                      router.push(`/suppliers/${s.id}`);
                    }}
                  >
                    <TableCell className="font-mono text-xs">{s.code}</TableCell>
                    <TableCell className="font-medium">{s.companyName}</TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{s.phone || "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm">{s.email || "—"}</TableCell>
                    <TableCell className="hidden xl:table-cell text-sm">{s.rating || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={s.isActive ? "success" : "muted"}>
                        {s.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button asChild variant="ghost" size="icon" aria-label="View">
                          <Link href={`/suppliers/${s.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(s)} aria-label="Edit">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setConfirmDel(s)}
                          aria-label="Delete"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {data ? (
            <Pagination
              total={data.total}
              limit={limit}
              offset={offset}
              onPageChange={setOffset}
              onLimitChange={setLimit}
            />
          ) : null}
        </div>
      )}

      <SupplierFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        onSaved={() => {
          setDialogOpen(false);
          refresh();
        }}
      />

      <ConfirmDialog
        open={!!confirmDel}
        onOpenChange={(v) => !v && setConfirmDel(null)}
        title="Delete supplier?"
        description={confirmDel ? `"${confirmDel.companyName}" will be permanently removed.` : undefined}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={async () => {
          if (!confirmDel) return;
          try {
            await api(`/api/suppliers/${confirmDel.id}`, { method: "DELETE" });
            toast.success("Supplier deleted");
            setConfirmDel(null);
            refresh();
          } catch (e) {
            toast.error(e instanceof ApiClientError ? e.message : "Delete failed");
          }
        }}
      />
    </div>
  );
}

function SupplierFormDialog({
  open,
  onOpenChange,
  editing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Supplier | null;
  onSaved: () => void;
}) {
  const [form, setForm] = React.useState<Partial<Supplier>>(empty);
  const [saving, setSaving] = React.useState(false);
  const { errors, set: setErrors, reset: resetErrors, setOne } = useFieldErrors();

  React.useEffect(() => {
    if (open) {
      resetErrors();
      setForm(
        editing
          ? {
              ...editing,
              email: editing.email ?? "",
              phone: editing.phone ?? "",
              gstin: editing.gstin ?? "",
              pan: editing.pan ?? "",
              msmeStatus: editing.msmeStatus ?? "",
              paymentTerms: editing.paymentTerms ?? "",
              rating: editing.rating ?? "",
            }
          : empty,
      );
    }
  }, [open, editing, resetErrors]);

  function update<K extends keyof Supplier>(key: K, value: Supplier[K] | string | boolean) {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key as string]) setOne(key as string, undefined);
  }

  function clientValidate(): Record<string, string> {
    const next: Record<string, string> = {};
    if (!form.companyName?.trim()) next.companyName = "Company Name is required";
    if (form.email && form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      next.email = "Enter a valid email";
    }
    return next;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clientErrs = clientValidate();
    if (Object.keys(clientErrs).length) {
      setErrors(clientErrs);
      toast.error(summarizeFieldErrors(clientErrs, labelMap) ?? "Please complete required fields");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api(`/api/suppliers/${editing.id}`, { method: "PUT", json: form });
        toast.success("Supplier updated");
      } else {
        await api("/api/suppliers", { method: "POST", json: form });
        toast.success("Supplier created");
      }
      resetErrors();
      onSaved();
    } catch (err) {
      const fieldErrs = getServerFieldErrors(err);
      if (Object.keys(fieldErrs).length) {
        setErrors(fieldErrs);
        toast.error(summarizeFieldErrors(fieldErrs, labelMap) ?? "Validation failed");
      } else {
        toast.error(err instanceof ApiClientError ? err.message : "Save failed");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit supplier" : "New supplier"}</DialogTitle>
          <DialogDescription>
            Fields marked <span className="text-destructive">*</span> are required.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Code" error={errors.code}>
              <Input
                value={form.code ?? ""}
                onChange={(e) => update("code", e.target.value)}
                placeholder={editing ? "SUP0001" : "Auto generated (optional)"}
                maxLength={50}
              />
            </FormField>
            <FormField label="Company Name" required error={errors.companyName}>
              <Input
                value={form.companyName ?? ""}
                onChange={(e) => update("companyName", e.target.value)}
                placeholder="Supplier Pvt Ltd"
              />
            </FormField>
            <FormField label="Email" error={errors.email}>
              <Input
                type="email"
                value={form.email ?? ""}
                onChange={(e) => update("email", e.target.value)}
              />
            </FormField>
            <FormField label="Phone" error={errors.phone}>
              <Input
                value={form.phone ?? ""}
                onChange={(e) => update("phone", e.target.value)}
              />
            </FormField>
            <FormField label="GSTIN" error={errors.gstin}>
              <Input
                value={form.gstin ?? ""}
                onChange={(e) => update("gstin", e.target.value)}
              />
            </FormField>
            <FormField label="PAN" error={errors.pan}>
              <Input
                value={form.pan ?? ""}
                onChange={(e) => update("pan", e.target.value)}
              />
            </FormField>
            <FormField label="MSME Status" error={errors.msmeStatus}>
              <Input
                value={form.msmeStatus ?? ""}
                onChange={(e) => update("msmeStatus", e.target.value)}
                placeholder="Micro / Small / Medium"
              />
            </FormField>
            <FormField label="Payment Terms" error={errors.paymentTerms}>
              <Input
                value={form.paymentTerms ?? ""}
                onChange={(e) => update("paymentTerms", e.target.value)}
                placeholder="Net 30"
              />
            </FormField>
            <FormField label="Rating (0-5)" error={errors.rating}>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="5"
                value={form.rating ?? ""}
                onChange={(e) => update("rating", e.target.value)}
              />
            </FormField>
            <FormField label="Status">
              <Select
                value={form.isActive ? "1" : "0"}
                onChange={(e) => update("isActive", e.target.value === "1")}
              >
                <option value="1">Active</option>
                <option value="0">Inactive</option>
              </Select>
            </FormField>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : editing ? "Save changes" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
