import type { QuotationItemInput } from "@/lib/schemas";

export type QuotationCalcLine = QuotationItemInput & {
  lineSubtotal: number;
  lineGst: number;
  lineTotal: number;
};

export type QuotationCalcInput = {
  items: QuotationItemInput[];
  discountType: "percent" | "amount";
  discountValue: number;
  freightAmount: number;
};

export type QuotationCalcResult = {
  lines: QuotationCalcLine[];
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  gstAmount: number;
  freightAmount: number;
  grandTotal: number;
};

const round = (n: number) => Math.round(n * 100) / 100;

export function calcQuotation(input: QuotationCalcInput): QuotationCalcResult {
  const lines: QuotationCalcLine[] = input.items.map((it) => {
    const qty = Number(it.qty) || 0;
    const price = Number(it.unitPrice) || 0;
    const rate = Number(it.gstRate) || 0;
    const gross = qty * price;
    const lineSubtotal = round(gross);
    const lineGst = round((lineSubtotal * rate) / 100);
    return {
      ...it,
      qty,
      unitPrice: price,
      gstRate: rate,
      lineSubtotal,
      lineGst,
      lineTotal: round(lineSubtotal + lineGst),
    };
  });

  const subtotal = round(lines.reduce((s, l) => s + l.lineSubtotal, 0));
  const discountAmount =
    input.discountType === "percent"
      ? round((subtotal * (input.discountValue || 0)) / 100)
      : round(input.discountValue || 0);
  const taxableAmount = round(subtotal - discountAmount);
  // Re-apply discount proportionally to GST (simple approach: scale gst)
  const ratio = subtotal > 0 ? taxableAmount / subtotal : 1;
  const gstAmount = round(lines.reduce((s, l) => s + l.lineGst, 0) * ratio);
  const freight = round(input.freightAmount || 0);
  const grandTotal = round(taxableAmount + gstAmount + freight);

  return {
    lines,
    subtotal,
    discountAmount,
    taxableAmount,
    gstAmount,
    freightAmount: freight,
    grandTotal,
  };
}

export function formatCurrency(n: number | string, currency = "INR"): string {
  const num = typeof n === "string" ? Number(n) : n;
  if (!Number.isFinite(num)) return "—";
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    return `${currency} ${num.toFixed(2)}`;
  }
}

export function formatNumber(n: number | string, digits = 2): string {
  const num = typeof n === "string" ? Number(n) : n;
  if (!Number.isFinite(num)) return "—";
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(num);
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

import type { PurchaseOrderItemInput } from "@/lib/schemas";

export type PurchaseOrderCalcLine = PurchaseOrderItemInput & {
  lineSubtotal: number;
  lineGst: number;
  lineTotal: number;
};

export type PurchaseOrderCalcInput = {
  items: PurchaseOrderItemInput[];
  discountType: "percent" | "amount";
  discountValue: number;
  freightAmount: number;
};

export type PurchaseOrderCalcResult = {
  lines: PurchaseOrderCalcLine[];
  subtotal: number;
  discountAmount: number;
  taxableAmount: number;
  gstAmount: number;
  freightAmount: number;
  grandTotal: number;
};

export function calcPurchaseOrder(input: PurchaseOrderCalcInput): PurchaseOrderCalcResult {
  const lines: PurchaseOrderCalcLine[] = input.items.map((it) => {
    const qty = Number(it.qty) || 0;
    const price = Number(it.unitPrice) || 0;
    const rate = Number(it.gstRate) || 0;
    const itemDiscount = Number(it.discountPercent) || 0;
    
    const gross = qty * price;
    const discountValue = (gross * itemDiscount) / 100;
    const lineSubtotal = round(gross - discountValue);
    const lineGst = round((lineSubtotal * rate) / 100);
    
    return {
      ...it,
      qty,
      unitPrice: price,
      discountPercent: itemDiscount,
      gstRate: rate,
      lineSubtotal,
      lineGst,
      lineTotal: round(lineSubtotal + lineGst),
    };
  });

  const subtotal = round(lines.reduce((s, l) => s + l.lineSubtotal, 0));
  const discountAmount =
    input.discountType === "percent"
      ? round((subtotal * (input.discountValue || 0)) / 100)
      : round(input.discountValue || 0);
  const taxableAmount = round(subtotal - discountAmount);
  const ratio = subtotal > 0 ? taxableAmount / subtotal : 1;
  const gstAmount = round(lines.reduce((s, l) => s + l.lineGst, 0) * ratio);
  const freight = round(input.freightAmount || 0);
  const grandTotal = round(taxableAmount + gstAmount + freight);

  return {
    lines,
    subtotal,
    discountAmount,
    taxableAmount,
    gstAmount,
    freightAmount: freight,
    grandTotal,
  };
}

export type BomRollupLine = {
  rawMaterialId: number;
  rawMaterialName: string;
  qtyPerUnit: number;
  unitPrice: number;
  estimatedRate: number;
  lineCost: number;
};

export function calcBomRollup(input: {
  lines: Array<{
    rawMaterialId: number;
    rawMaterialName: string;
    qtyPerUnit: number;
    unitPrice: number;
    estimatedRate: number;
  }>;
  laborCost: number;
  overheadCost: number;
}) {
  const lines: BomRollupLine[] = input.lines.map((line) => {
    const qty = Number(line.qtyPerUnit) || 0;
    const price = Number(line.unitPrice) || Number(line.estimatedRate) || 0;
    const lineCost = round(qty * price);
    return {
      rawMaterialId: line.rawMaterialId,
      rawMaterialName: line.rawMaterialName,
      qtyPerUnit: qty,
      unitPrice: Number(line.unitPrice) || 0,
      estimatedRate: Number(line.estimatedRate) || 0,
      lineCost,
    };
  });
  const materialCost = round(lines.reduce((sum, line) => sum + line.lineCost, 0));
  const laborCost = round(Number(input.laborCost) || 0);
  const overheadCost = round(Number(input.overheadCost) || 0);
  const totalCostPerUnit = round(materialCost + laborCost + overheadCost);
  return { lines, materialCost, laborCost, overheadCost, totalCostPerUnit };
}
