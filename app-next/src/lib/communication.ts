import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { communicationTemplates } from "@/lib/db/schema";

type TemplateVars = {
  customerName: string;
  quotationNo: string;
  referenceNo: string;
  projectName: string;
  pdfUrl: string;
};

const defaultTemplates: Record<"email" | "whatsapp", { name: string; subject?: string; body: string }> = {
  email: {
    name: "Quotation Email",
    subject: "Quotation {{referenceNo}}",
    body: "Dear {{customerName}},\n\nPlease find attached our quotation {{referenceNo}} for your kind review.\n\nProject: {{projectName}}\nPDF: {{pdfUrl}}\n\nRegards,\nBID",
  },
  whatsapp: {
    name: "Quotation WhatsApp",
    body: "Dear {{customerName}}, please find quotation {{referenceNo}}. Project: {{projectName}}. PDF: {{pdfUrl}}",
  },
};

export function renderTemplate(input: string, vars: TemplateVars) {
  return input.replace(/{{\s*(\w+)\s*}}/g, (_m, token: keyof TemplateVars) => String(vars[token] ?? ""));
}

export async function getTemplate(channel: "email" | "whatsapp", templateKey = "quotation_send") {
  const [row] = await db
    .select()
    .from(communicationTemplates)
    .where(and(eq(communicationTemplates.channel, channel), eq(communicationTemplates.templateKey, templateKey), eq(communicationTemplates.isActive, true)));

  if (row) return row;
  const fallback = defaultTemplates[channel];
  return {
    id: 0,
    channel,
    templateKey,
    name: fallback.name,
    subject: fallback.subject ?? null,
    body: fallback.body,
    isActive: true,
    updatedBy: null,
    updatedAt: new Date(),
    createdAt: new Date(),
  };
}
