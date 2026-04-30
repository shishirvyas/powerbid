"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useResource } from "@/lib/hooks";
import { api, ApiClientError } from "@/lib/api-client";
import { formatCurrency, formatDate } from "@/lib/calc";

type Contact = {
  id?: number;
  name: string;
  designation: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  isActive: boolean;
};

type Address = {
  id?: number;
  type: "billing" | "shipping";
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  country: string;
  isDefault: boolean;
};

type BankDetail = {
  id?: number;
  accountName: string;
  accountNumber: string;
  bankName: string;
  branchName: string | null;
  ifscCode: string;
  swiftCode: string | null;
  isPrimary: boolean;
};

type SupplierProfile = {
  supplier: {
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
  };
  contacts: Contact[];
  addresses: Address[];
  bankDetails: BankDetail[];
  stats: {
    totalOrders: number;
    totalPurchase: number;
    outstandingPayable: number;
    openOrders: number;
  };
  purchaseHistory: {
    id: number;
    poNumber: string;
    status: string;
    expectedDate: string | null;
    amount: number;
    createdAt: string;
  }[];
  ledger: {
    date: string;
    reference: string;
    entryType: string;
    status: string;
    debit: number;
    credit: number;
    balanceImpact: number;
  }[];
};

type EditableProfile = {
  code: string;
  companyName: string;
  gstin: string;
  pan: string;
  msmeStatus: string;
  paymentTerms: string;
  email: string;
  phone: string;
  rating: string;
  isActive: boolean;
  contacts: Contact[];
  addresses: Address[];
  bankDetails: BankDetail[];
};

function blankContact(): Contact {
  return {
    name: "",
    designation: null,
    email: null,
    phone: null,
    isPrimary: false,
    isActive: true,
  };
}

function blankAddress(): Address {
  return {
    type: "billing",
    addressLine1: null,
    addressLine2: null,
    city: null,
    state: null,
    pincode: null,
    country: "IN",
    isDefault: false,
  };
}

function blankBank(): BankDetail {
  return {
    accountName: "",
    accountNumber: "",
    bankName: "",
    branchName: null,
    ifscCode: "",
    swiftCode: null,
    isPrimary: false,
  };
}

function toEditable(data: SupplierProfile): EditableProfile {
  return {
    code: data.supplier.code || "",
    companyName: data.supplier.companyName || "",
    gstin: data.supplier.gstin || "",
    pan: data.supplier.pan || "",
    msmeStatus: data.supplier.msmeStatus || "",
    paymentTerms: data.supplier.paymentTerms || "",
    email: data.supplier.email || "",
    phone: data.supplier.phone || "",
    rating: data.supplier.rating || "",
    isActive: data.supplier.isActive,
    contacts: data.contacts,
    addresses: data.addresses,
    bankDetails: data.bankDetails,
  };
}

export function SupplierDetailClient({ supplierId }: { supplierId: number }) {
  const { data, loading, error, refresh } = useResource<SupplierProfile>(
    Number.isInteger(supplierId) && supplierId > 0 ? `/api/suppliers/${supplierId}/profile` : null,
  );

  const [form, setForm] = React.useState<EditableProfile | null>(null);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (data) setForm(toEditable(data));
  }, [data]);

  if (!Number.isInteger(supplierId) || supplierId <= 0) {
    return <div className="text-sm text-destructive">Invalid supplier id.</div>;
  }

  if (error) {
    return <div className="text-sm text-destructive">{error}</div>;
  }

  if (loading || !data || !form) {
    return <div className="text-sm text-muted-foreground">Loading supplier details...</div>;
  }

  async function saveAll() {
    if (!form) return;
    setSaving(true);
    try {
      await api(`/api/suppliers/${supplierId}/profile`, {
        method: "PUT",
        json: {
          code: form.code,
          companyName: form.companyName,
          gstin: form.gstin,
          pan: form.pan,
          msmeStatus: form.msmeStatus,
          paymentTerms: form.paymentTerms,
          email: form.email,
          phone: form.phone,
          rating: form.rating ? Number(form.rating) : null,
          isActive: form.isActive,
          contacts: form.contacts,
          addresses: form.addresses,
          bankDetails: form.bankDetails,
        },
      });
      toast.success("Supplier profile saved");
      refresh();
    } catch (e) {
      toast.error(e instanceof ApiClientError ? e.message : "Failed to save supplier");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={form.companyName || "Supplier"}
        description={`Supplier code: ${form.code}`}
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href="/suppliers">
                <ArrowLeft className="h-4 w-4" /> Back
              </Link>
            </Button>
            <Button onClick={saveAll} disabled={saving}>
              <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard title="Total Purchase" value={formatCurrency(data.stats.totalPurchase)} />
        <MetricCard title="Outstanding Payable" value={formatCurrency(data.stats.outstandingPayable)} />
        <MetricCard title="Total Orders" value={String(data.stats.totalOrders)} />
        <MetricCard title="Open Orders" value={String(data.stats.openOrders)} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Company Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Supplier Code">
            <Input value={form.code} onChange={(e) => setForm((f) => (f ? { ...f, code: e.target.value } : f))} />
          </Field>
          <Field label="Company Name">
            <Input value={form.companyName} onChange={(e) => setForm((f) => (f ? { ...f, companyName: e.target.value } : f))} />
          </Field>
          <Field label="Email">
            <Input value={form.email} onChange={(e) => setForm((f) => (f ? { ...f, email: e.target.value } : f))} />
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={(e) => setForm((f) => (f ? { ...f, phone: e.target.value } : f))} />
          </Field>
          <Field label="GSTIN">
            <Input value={form.gstin} onChange={(e) => setForm((f) => (f ? { ...f, gstin: e.target.value } : f))} />
          </Field>
          <Field label="PAN">
            <Input value={form.pan} onChange={(e) => setForm((f) => (f ? { ...f, pan: e.target.value } : f))} />
          </Field>
          <Field label="MSME Status">
            <Input value={form.msmeStatus} onChange={(e) => setForm((f) => (f ? { ...f, msmeStatus: e.target.value } : f))} />
          </Field>
          <Field label="Payment Terms">
            <Input value={form.paymentTerms} onChange={(e) => setForm((f) => (f ? { ...f, paymentTerms: e.target.value } : f))} />
          </Field>
          <Field label="Rating (0-5)">
            <Input type="number" min="0" max="5" step="0.1" value={form.rating} onChange={(e) => setForm((f) => (f ? { ...f, rating: e.target.value } : f))} />
          </Field>
          <Field label="Status">
            <Select value={form.isActive ? "active" : "inactive"} onChange={(e) => setForm((f) => (f ? { ...f, isActive: e.target.value === "active" } : f))}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Contacts</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setForm((f) => (f ? { ...f, contacts: [...f.contacts, blankContact()] } : f))}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {form.contacts.map((c, idx) => (
            <div key={`contact-${idx}`} className="grid gap-3 rounded border p-3 md:grid-cols-6">
              <Input placeholder="Name" value={c.name} onChange={(e) => updateRow(form, setForm, "contacts", idx, "name", e.target.value)} />
              <Input placeholder="Designation" value={c.designation || ""} onChange={(e) => updateRow(form, setForm, "contacts", idx, "designation", e.target.value || null)} />
              <Input placeholder="Email" value={c.email || ""} onChange={(e) => updateRow(form, setForm, "contacts", idx, "email", e.target.value || null)} />
              <Input placeholder="Phone" value={c.phone || ""} onChange={(e) => updateRow(form, setForm, "contacts", idx, "phone", e.target.value || null)} />
              <div className="flex items-center gap-4 text-sm">
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={c.isPrimary} onChange={(e) => updateRow(form, setForm, "contacts", idx, "isPrimary", e.target.checked)} />Primary</label>
                <label className="inline-flex items-center gap-2"><input type="checkbox" checked={c.isActive} onChange={(e) => updateRow(form, setForm, "contacts", idx, "isActive", e.target.checked)} />Active</label>
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeRow(form, setForm, "contacts", idx)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          ))}
          {form.contacts.length === 0 ? <p className="text-sm text-muted-foreground">No contacts added.</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Addresses</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setForm((f) => (f ? { ...f, addresses: [...f.addresses, blankAddress()] } : f))}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {form.addresses.map((a, idx) => (
            <div key={`address-${idx}`} className="grid gap-3 rounded border p-3 md:grid-cols-6">
              <Select value={a.type} onChange={(e) => updateRow(form, setForm, "addresses", idx, "type", e.target.value as "billing" | "shipping")}>
                <option value="billing">Billing</option>
                <option value="shipping">Shipping</option>
              </Select>
              <Input placeholder="Address line 1" value={a.addressLine1 || ""} onChange={(e) => updateRow(form, setForm, "addresses", idx, "addressLine1", e.target.value || null)} />
              <Input placeholder="City" value={a.city || ""} onChange={(e) => updateRow(form, setForm, "addresses", idx, "city", e.target.value || null)} />
              <Input placeholder="State" value={a.state || ""} onChange={(e) => updateRow(form, setForm, "addresses", idx, "state", e.target.value || null)} />
              <Input placeholder="Pincode" value={a.pincode || ""} onChange={(e) => updateRow(form, setForm, "addresses", idx, "pincode", e.target.value || null)} />
              <div className="flex items-center justify-between gap-3">
                <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={a.isDefault} onChange={(e) => updateRow(form, setForm, "addresses", idx, "isDefault", e.target.checked)} />Default</label>
                <Button variant="ghost" size="icon" onClick={() => removeRow(form, setForm, "addresses", idx)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
          {form.addresses.length === 0 ? <p className="text-sm text-muted-foreground">No addresses added.</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Bank Details</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setForm((f) => (f ? { ...f, bankDetails: [...f.bankDetails, blankBank()] } : f))}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {form.bankDetails.map((b, idx) => (
            <div key={`bank-${idx}`} className="grid gap-3 rounded border p-3 md:grid-cols-6">
              <Input placeholder="Account name" value={b.accountName} onChange={(e) => updateRow(form, setForm, "bankDetails", idx, "accountName", e.target.value)} />
              <Input placeholder="Account number" value={b.accountNumber} onChange={(e) => updateRow(form, setForm, "bankDetails", idx, "accountNumber", e.target.value)} />
              <Input placeholder="Bank" value={b.bankName} onChange={(e) => updateRow(form, setForm, "bankDetails", idx, "bankName", e.target.value)} />
              <Input placeholder="Branch" value={b.branchName || ""} onChange={(e) => updateRow(form, setForm, "bankDetails", idx, "branchName", e.target.value || null)} />
              <Input placeholder="IFSC" value={b.ifscCode} onChange={(e) => updateRow(form, setForm, "bankDetails", idx, "ifscCode", e.target.value.toUpperCase())} />
              <div className="flex items-center justify-between gap-3">
                <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={b.isPrimary} onChange={(e) => updateRow(form, setForm, "bankDetails", idx, "isPrimary", e.target.checked)} />Primary</label>
                <Button variant="ghost" size="icon" onClick={() => removeRow(form, setForm, "bankDetails", idx)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
          {form.bankDetails.length === 0 ? <p className="text-sm text-muted-foreground">No bank details added.</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Supplier Purchase History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO Number</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.purchaseHistory.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-xs">{row.poNumber}</TableCell>
                  <TableCell>{formatDate(row.createdAt)}</TableCell>
                  <TableCell>{row.status.replace("_", " ")}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.amount)}</TableCell>
                </TableRow>
              ))}
              {data.purchaseHistory.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No purchase history yet.</TableCell></TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Supplier Ledger</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                <TableHead className="text-right">Impact</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.ledger.map((row, idx) => (
                <TableRow key={`ledger-${idx}`}>
                  <TableCell>{formatDate(row.date)}</TableCell>
                  <TableCell className="font-mono text-xs">{row.reference}</TableCell>
                  <TableCell>{row.status.replace("_", " ")}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.debit)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.credit)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(row.balanceImpact)}</TableCell>
                </TableRow>
              ))}
              {data.ledger.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No ledger entries yet.</TableCell></TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function updateRow<T extends keyof Pick<EditableProfile, "contacts" | "addresses" | "bankDetails">, K extends keyof EditableProfile[T][number]>(
  form: EditableProfile,
  setForm: React.Dispatch<React.SetStateAction<EditableProfile | null>>,
  section: T,
  index: number,
  key: K,
  value: EditableProfile[T][number][K],
) {
  const rows = [...form[section]];
  rows[index] = { ...rows[index], [key]: value } as EditableProfile[T][number];
  setForm((f) => (f ? { ...f, [section]: rows } : f));
}

function removeRow<T extends keyof Pick<EditableProfile, "contacts" | "addresses" | "bankDetails">>(
  form: EditableProfile,
  setForm: React.Dispatch<React.SetStateAction<EditableProfile | null>>,
  section: T,
  index: number,
) {
  const rows = [...form[section]];
  rows.splice(index, 1);
  setForm((f) => (f ? { ...f, [section]: rows } : f));
}
