import type { QuotationItemInput, QuotationTotals } from "@powerbid/shared";

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface ComputedItem {
  qty: number;
  unitPrice: number;
  discountPercent: number;
  gstRate: number;
  lineSubtotal: number;
  lineGst: number;
  lineTotal: number;
}

/**
 * Pure formula:
 *   line_subtotal = qty * unit_price * (1 - discount_percent/100)
 *   line_gst      = line_subtotal * gst_rate / 100
 *   line_total    = line_subtotal + line_gst
 *
 *   subtotal        = Σ line_subtotal
 *   discount_amount = (header discount %) of subtotal OR flat amount, capped at subtotal
 *   taxable_amount  = subtotal - discount_amount
 *   gst_amount      = Σ line_gst   pro-rated against taxable_amount when header discount used
 *   grand_total     = taxable_amount + gst_amount + freight_amount
 */
export function computeItem(input: QuotationItemInput): ComputedItem {
  const qty = Number(input.qty) || 0;
  const unitPrice = Number(input.unitPrice) || 0;
  const discountPercent = Number(input.discountPercent) || 0;
  const gstRate = Number(input.gstRate) || 0;
  const lineSubtotal = round2(qty * unitPrice * (1 - discountPercent / 100));
  const lineGst = round2((lineSubtotal * gstRate) / 100);
  const lineTotal = round2(lineSubtotal + lineGst);
  return { qty, unitPrice, discountPercent, gstRate, lineSubtotal, lineGst, lineTotal };
}

export function computeTotals(args: {
  items: QuotationItemInput[];
  discountType: "percent" | "amount";
  discountValue: number;
  freightAmount: number;
}): { totals: QuotationTotals; items: ComputedItem[] } {
  const items = args.items.map(computeItem);
  const subtotal = round2(items.reduce((s, i) => s + i.lineSubtotal, 0));

  const rawDiscount =
    args.discountType === "percent"
      ? (subtotal * Math.max(0, Math.min(100, args.discountValue))) / 100
      : Math.max(0, args.discountValue);
  const discountAmount = round2(Math.min(rawDiscount, subtotal));

  const taxableAmount = round2(subtotal - discountAmount);

  // Pro-rate GST against the taxable amount so header discount also reduces GST.
  const ratio = subtotal > 0 ? taxableAmount / subtotal : 0;
  const gstAmount = round2(items.reduce((s, i) => s + i.lineGst, 0) * ratio);

  const freightAmount = round2(Math.max(0, args.freightAmount || 0));
  const grandTotal = round2(taxableAmount + gstAmount + freightAmount);

  return {
    items,
    totals: { subtotal, discountAmount, taxableAmount, gstAmount, freightAmount, grandTotal },
  };
}

/** Indian English amount-in-words (paise + rupees). Compact, POC-grade. */
export function amountInWordsINR(value: number): string {
  const rupees = Math.floor(value);
  const paise = Math.round((value - rupees) * 100);
  const w = numToWords(rupees);
  const main = `${w || "Zero"} Rupees`;
  return paise > 0 ? `${main} and ${numToWords(paise)} Paise Only` : `${main} Only`;
}

function numToWords(n: number): string {
  if (n === 0) return "";
  const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen"];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const two = (x: number): string =>
    x < 20 ? a[x] : `${b[Math.floor(x / 10)]}${x % 10 ? " " + a[x % 10] : ""}`;
  const three = (x: number): string =>
    x >= 100 ? `${a[Math.floor(x / 100)]} Hundred${x % 100 ? " " + two(x % 100) : ""}` : two(x);

  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;
  const parts = [
    crore ? `${three(crore)} Crore` : "",
    lakh ? `${three(lakh)} Lakh` : "",
    thousand ? `${three(thousand)} Thousand` : "",
    rest ? three(rest) : "",
  ].filter(Boolean);
  return parts.join(" ").trim();
}
