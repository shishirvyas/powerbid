import { and, eq, gte, lte, ne, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { customers, quotations } from "@/lib/db/schema";

type QuotationReferenceOptions = {
  customerId: number;
  quotationDate: string;
  quotationId?: number;
  currentReferenceNo?: string | null;
};

function normalizeCustomerCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "");
}

function parseQuotationDate(value: string): Date {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function formatFinancialYearLabel(quotationDate: string): string {
  const parsed = parseQuotationDate(quotationDate);
  const year = parsed.getFullYear();
  const month = parsed.getMonth();
  const startYear = month >= 3 ? year : year - 1;
  const endYear = (startYear + 1) % 100;
  return `${startYear}-${String(endYear).padStart(2, "0")}`;
}

export function formatQuotationReference(customerCode: string, quotationDate: string, sequence: number): string {
  return `Lan/Quotation/${normalizeCustomerCode(customerCode)}/${formatFinancialYearLabel(quotationDate)}/${String(sequence).padStart(2, "0")}`;
}

export async function generateQuotationReference({
  customerId,
  quotationDate,
  quotationId,
  currentReferenceNo,
}: QuotationReferenceOptions): Promise<string> {
  const [customer] = await db
    .select({ code: customers.code })
    .from(customers)
    .where(eq(customers.id, customerId));

  if (!customer) throw new Error("Customer not found for quotation reference generation");

  const customerCode = normalizeCustomerCode(customer.code);
  const fiscalYear = formatFinancialYearLabel(quotationDate);
  const prefix = `Lan/Quotation/${customerCode}/${fiscalYear}/`;

  if (currentReferenceNo?.startsWith(prefix)) {
    return currentReferenceNo;
  }

  const parsed = parseQuotationDate(quotationDate);
  const year = parsed.getFullYear();
  const month = parsed.getMonth();
  const startYear = month >= 3 ? year : year - 1;
  const fromDate = `${startYear}-04-01`;
  const toDate = `${startYear + 1}-03-31`;

  const conditions = [
    eq(quotations.customerId, customerId),
    gte(quotations.quotationDate, fromDate),
    lte(quotations.quotationDate, toDate),
  ];

  if (quotationId) {
    conditions.push(ne(quotations.id, quotationId));
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(quotations)
    .where(and(...conditions));

  return formatQuotationReference(customer.code, quotationDate, count + 1);
}