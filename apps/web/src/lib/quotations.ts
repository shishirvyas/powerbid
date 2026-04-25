import { api } from "./api";
import type {
  QuotationDraftInput,
  QuotationStatus,
  EmailQuotationInput,
} from "@powerbid/shared";

export interface QuotationListItem {
  id: number;
  quotationNo: string;
  quotationDate: string;
  status: QuotationStatus;
  grandTotal: number;
  customerId: number;
  customerName: string | null;
  updatedAt: string;
}

export interface QuotationItem {
  id: number;
  quotationId: number;
  productId: number | null;
  productName: string;
  description: string | null;
  unitName: string | null;
  qty: number;
  unitPrice: number;
  discountPercent: number;
  gstRate: number;
  lineSubtotal: number;
  lineGst: number;
  lineTotal: number;
  sortOrder: number;
}

export interface QuotationHead {
  id: number;
  quotationNo: string;
  quotationDate: string;
  validityDays: number;
  customerId: number;
  status: QuotationStatus;
  subtotal: number;
  discountType: "percent" | "amount";
  discountValue: number;
  discountAmount: number;
  taxableAmount: number;
  gstAmount: number;
  freightAmount: number;
  grandTotal: number;
  termsConditions: string | null;
  notes: string | null;
  pdfR2Key: string | null;
  sentAt: string | null;
}

export interface QuotationDetail {
  quotation: QuotationHead;
  customer: { id: number; name: string; gstin: string | null; email: string | null } | null;
  items: QuotationItem[];
}

export const quotationsApi = {
  list: (params?: { status?: string; q?: string }) => {
    const sp = new URLSearchParams();
    if (params?.status) sp.set("status", params.status);
    if (params?.q) sp.set("q", params.q);
    const qs = sp.toString();
    return api<{ items: QuotationListItem[] }>(`/api/quotations${qs ? `?${qs}` : ""}`);
  },
  get: (id: number) => api<QuotationDetail>(`/api/quotations/${id}`),
  createDraft: (input: QuotationDraftInput) =>
    api<{ id: number; quotationNo: string }>(`/api/quotations`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateDraft: (id: number, input: QuotationDraftInput) =>
    api<{ id: number }>(`/api/quotations/${id}`, {
      method: "PUT",
      body: JSON.stringify(input),
    }),
  finalize: (id: number) =>
    api<{ id: number; quotationNo: string }>(`/api/quotations/${id}/finalize`, { method: "POST" }),
  setStatus: (id: number, status: QuotationStatus, closeReason?: string) =>
    api<{ id: number }>(`/api/quotations/${id}/status`, {
      method: "POST",
      body: JSON.stringify({ status, closeReason }),
    }),
  clone: (id: number) =>
    api<{ id: number }>(`/api/quotations/${id}/clone`, { method: "POST" }),
  generatePdf: (id: number) =>
    api<{ key: string }>(`/api/quotations/${id}/pdf`, { method: "POST" }),
  pdfUrl: (id: number) => `/api/quotations/${id}/pdf`,
  email: (id: number, input: EmailQuotationInput) =>
    api<{ ok: boolean }>(`/api/quotations/${id}/email`, {
      method: "POST",
      body: JSON.stringify(input),
    }),
};
