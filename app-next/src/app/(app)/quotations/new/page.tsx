"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { QuotationBuilder, blankInitial, type QuotationBuilderInitial } from "../quotation-builder";
import { useResource } from "@/lib/hooks";

type InquiryDetail = {
  id: number;
  inquiryNo: string;
  customerId: number | null;
  customerName: string | null;
  requirement: string | null;
  expectedClosure: string | null;
  items: {
    id: number;
    productId: number | null;
    productName: string;
    qty: string;
    remarks: string | null;
  }[];
};

type ProductOption = {
  id: number;
  sku: string;
  name: string;
  basePrice: string;
  unitName: string | null;
  gstRate: string | null;
};

type ProductsResp = { rows: ProductOption[]; total: number };

export default function Page() {
  const searchParams = useSearchParams();
  const fromInquiry = searchParams.get("fromInquiry");
  const inquiryId = fromInquiry ? Number(fromInquiry) : null;

  const { data: inquiry, loading: loadingInquiry, error: inquiryError } = useResource<InquiryDetail>(
    inquiryId ? `/api/inquiries/${inquiryId}` : null,
  );
  const { data: products, loading: loadingProducts } = useResource<ProductsResp>(
    inquiryId ? `/api/products?limit=200` : null,
  );

  // Not from an inquiry → render with blank initial immediately.
  if (!inquiryId) {
    return <QuotationBuilder mode="create" initial={blankInitial} />;
  }

  if (inquiryError) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        Could not load inquiry: {inquiryError}
      </div>
    );
  }

  if (loadingInquiry || loadingProducts || !inquiry) {
    return <div className="text-sm text-muted-foreground">Loading inquiry…</div>;
  }

  const productMap = new Map<number, ProductOption>();
  for (const p of products?.rows ?? []) productMap.set(p.id, p);

  const items: QuotationBuilderInitial["items"] = inquiry.items.length
    ? inquiry.items.map((it) => {
        const prod = it.productId ? productMap.get(it.productId) : undefined;
        return {
          productId: it.productId ? String(it.productId) : "",
          productName: it.productName,
          unitName: prod?.unitName ?? "",
          qtyBreakup: "",
          qty: it.qty || "1",
          unitPrice: prod?.basePrice ?? "0",
          discountPercent: "0",
          gstRate: prod?.gstRate ?? "18",
        };
      })
    : blankInitial.items;

  const initial: QuotationBuilderInitial = {
    ...blankInitial,
    referenceNo: inquiry.inquiryNo,
    projectName: blankInitial.projectName,
    customerId: inquiry.customerId,
    inquiryId: inquiry.id,
    notes: inquiry.requirement
      ? `From inquiry ${inquiry.inquiryNo}:\n${inquiry.requirement}`
      : blankInitial.notes,
    items,
  };

  return <QuotationBuilder mode="create" initial={initial} />;
}
