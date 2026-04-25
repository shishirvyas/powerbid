import { eq } from "drizzle-orm";
import type { Env } from "../../env";
import { getDb } from "../../db/client";
import { customers, quotations } from "../../db/schema";
import { badRequest, conflict, notFound } from "../../lib/errors";
import { renderQuotationPdf } from "../../services/pdf";
import { sendEmail } from "../../services/mailer";

const EMAIL_EVENTS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS quotation_email_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    quotation_id INTEGER NOT NULL,
    recipient_to TEXT NOT NULL,
    recipient_cc TEXT,
    subject TEXT NOT NULL,
    body_html TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    tracking_token TEXT NOT NULL UNIQUE,
    is_reminder INTEGER NOT NULL DEFAULT 0,
    sent_at TEXT,
    opened_at TEXT,
    failed_at TEXT,
    failure_reason TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;

const EMAIL_EVENTS_INDEXES_SQL = [
  "CREATE INDEX IF NOT EXISTS idx_qee_quotation_id ON quotation_email_events(quotation_id)",
  "CREATE INDEX IF NOT EXISTS idx_qee_status ON quotation_email_events(status)",
  "CREATE INDEX IF NOT EXISTS idx_qee_tracking_token ON quotation_email_events(tracking_token)",
  "CREATE INDEX IF NOT EXISTS idx_qee_reminder_status ON quotation_email_events(is_reminder, status)",
];

const TRANSPARENT_GIF_BASE64 =
  "R0lGODlhAQABAPAAAAAAAAAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";

export interface SendQuotationEmailOptions {
  to?: string;
  cc?: string;
  subject?: string;
  body?: string;
  isReminder?: boolean;
}

interface EmailEventRow {
  status: string;
  recipient_to: string;
  recipient_cc: string | null;
  subject: string;
  sent_at: string | null;
  opened_at: string | null;
  failed_at: string | null;
  failure_reason: string | null;
  is_reminder: number;
}

export async function ensureQuotationEmailTables(d1: D1Database): Promise<void> {
  await d1.prepare(EMAIL_EVENTS_TABLE_SQL).run();
  for (const stmt of EMAIL_EVENTS_INDEXES_SQL) {
    await d1.prepare(stmt).run();
  }
}

export async function sendQuotationEmailAutomation(
  env: Env,
  quotationId: number,
  options: SendQuotationEmailOptions = {},
) {
  await ensureQuotationEmailTables(env.DB);

  const db = getDb(env.DB);
  const [row] = await db
    .select()
    .from(quotations)
    .leftJoin(customers, eq(customers.id, quotations.customerId))
    .where(eq(quotations.id, quotationId))
    .limit(1);
  if (!row) throw notFound("Quotation not found");

  const quotation = row.quotations;
  const customer = row.customers;
  if (quotation.status === "draft") throw conflict("Finalize quotation before emailing");

  const to = options.to?.trim() || customer?.email?.trim() || "";
  if (!to) throw badRequest("Customer email is required to send quotation");

  const subject = options.subject?.trim() || defaultSubject(quotation.quotationNo, !!options.isReminder);
  const token = crypto.randomUUID();
  const baseBody = options.body?.trim() || defaultBodyHtml({
    customerName: customer?.name ?? "Customer",
    quotationNo: quotation.quotationNo,
    grandTotal: quotation.grandTotal,
    isReminder: !!options.isReminder,
  });
  const html = `${baseBody}${trackingPixelHtml(env, token)}`;

  const pdf = await ensurePdfAttachment(env, quotation.id, quotation.quotationNo, quotation.pdfR2Key);

  await env.DB
    .prepare(
      `INSERT INTO quotation_email_events (
         quotation_id, recipient_to, recipient_cc, subject, body_html, status, tracking_token, is_reminder
       ) VALUES (?1, ?2, ?3, ?4, ?5, 'queued', ?6, ?7)`,
    )
    .bind(quotation.id, to, options.cc ?? null, subject, baseBody, token, options.isReminder ? 1 : 0)
    .run();

  try {
    await sendEmail(env, {
      to,
      cc: options.cc,
      subject,
      html,
      text: defaultText({
        customerName: customer?.name ?? "Customer",
        quotationNo: quotation.quotationNo,
        grandTotal: quotation.grandTotal,
        isReminder: !!options.isReminder,
      }),
      attachments: [pdf],
    });

    const sentAt = new Date().toISOString();
    await env.DB
      .prepare(
        `UPDATE quotation_email_events
            SET status = 'sent', sent_at = ?1, updated_at = ?1
          WHERE tracking_token = ?2`,
      )
      .bind(sentAt, token)
      .run();

    const nextFollowupAt = options.isReminder ? null : new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    await db
      .update(quotations)
      .set({
        status: quotation.status === "final" ? "sent" : quotation.status,
        sentAt,
        followupAt: nextFollowupAt,
        updatedAt: sentAt,
      })
      .where(eq(quotations.id, quotation.id));

    return {
      ok: true as const,
      status: options.isReminder ? "reminder_sent" : "sent",
      sentAt,
      to,
      subject,
    };
  } catch (error) {
    const failedAt = new Date().toISOString();
    const message = error instanceof Error ? error.message.slice(0, 1000) : "Email delivery failed";
    await env.DB
      .prepare(
        `UPDATE quotation_email_events
            SET status = 'failed', failed_at = ?1, failure_reason = ?2, updated_at = ?1
          WHERE tracking_token = ?3`,
      )
      .bind(failedAt, message, token)
      .run();
    throw error;
  }
}

export async function trackQuotationEmailOpen(env: Env, token: string): Promise<boolean> {
  await ensureQuotationEmailTables(env.DB);
  const openedAt = new Date().toISOString();
  const result = await env.DB
    .prepare(
      `UPDATE quotation_email_events
          SET status = CASE WHEN status = 'sent' THEN 'opened' ELSE status END,
              opened_at = COALESCE(opened_at, ?1),
              updated_at = ?1
        WHERE tracking_token = ?2`,
    )
    .bind(openedAt, token)
    .run();
  return (result.meta.changes ?? 0) > 0;
}

export async function getQuotationEmailSummary(env: Env, quotationId: number) {
  await ensureQuotationEmailTables(env.DB);
  const row = await env.DB
    .prepare(
      `SELECT status, recipient_to, recipient_cc, subject, sent_at, opened_at, failed_at, failure_reason, is_reminder
         FROM quotation_email_events
        WHERE quotation_id = ?1
        ORDER BY id DESC
        LIMIT 1`,
    )
    .bind(quotationId)
    .first<EmailEventRow>();
  if (!row) return null;
  return {
    status: row.status,
    to: row.recipient_to,
    cc: row.recipient_cc,
    subject: row.subject,
    sentAt: row.sent_at,
    openedAt: row.opened_at,
    failedAt: row.failed_at,
    failureReason: row.failure_reason,
    isReminder: row.is_reminder === 1,
  };
}

export async function runQuotationReminderCron(env: Env) {
  await ensureQuotationEmailTables(env.DB);
  const now = new Date().toISOString();
  const due = await env.DB
    .prepare(
      `SELECT q.id
         FROM quotations q
         JOIN customers c ON c.id = q.customer_id
        WHERE q.is_active = 1
          AND q.followup_at IS NOT NULL
          AND q.followup_at <= ?1
          AND q.status IN ('final', 'sent')
          AND c.email IS NOT NULL
          AND TRIM(c.email) <> ''
          AND NOT EXISTS (
            SELECT 1 FROM quotation_email_events e
             WHERE e.quotation_id = q.id AND e.status = 'opened'
          )
          AND NOT EXISTS (
            SELECT 1 FROM quotation_email_events e
             WHERE e.quotation_id = q.id AND e.is_reminder = 1 AND e.status = 'sent'
          )
        ORDER BY q.followup_at ASC
        LIMIT 50`,
    )
    .bind(now)
    .all<{ id: number }>();

  const results: Array<{ quotationId: number; status: string; error?: string }> = [];
  for (const row of due.results ?? []) {
    try {
      await sendQuotationEmailAutomation(env, row.id, { isReminder: true });
      results.push({ quotationId: row.id, status: "reminder_sent" });
    } catch (error) {
      results.push({
        quotationId: row.id,
        status: "failed",
        error: error instanceof Error ? error.message : "Reminder failed",
      });
    }
  }

  return { scanned: due.results?.length ?? 0, processed: results.length, results };
}

export function trackingPixelResponse() {
  const binary = atob(TRANSPARENT_GIF_BASE64);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new Response(bytes, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

async function ensurePdfAttachment(env: Env, quotationId: number, quotationNo: string, existingKey: string | null) {
  const db = getDb(env.DB);
  let key = existingKey;
  if (!key) {
    const pdf = await renderQuotationPdf(env, quotationId);
    key = `quotations/${quotationId}/${quotationNo}-${Date.now()}.pdf`;
    await env.FILES.put(key, pdf, { httpMetadata: { contentType: "application/pdf" } });
    await db.update(quotations).set({ pdfR2Key: key, updatedAt: new Date().toISOString() }).where(eq(quotations.id, quotationId));
  }

  const obj = await env.FILES.get(key);
  if (!obj) throw notFound("Stored quotation PDF not found");

  const buf = new Uint8Array(await obj.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i += 1) bin += String.fromCharCode(buf[i]);

  return {
    filename: `${quotationNo}.pdf`,
    content: btoa(bin),
    type: "application/pdf",
  };
}

function defaultSubject(quotationNo: string, isReminder: boolean) {
  return isReminder ? `Reminder: Quotation ${quotationNo}` : `Quotation ${quotationNo}`;
}

function defaultBodyHtml(input: {
  customerName: string;
  quotationNo: string;
  grandTotal: number;
  isReminder: boolean;
}) {
  const intro = input.isReminder
    ? "This is a gentle reminder regarding the quotation shared earlier."
    : "Please find attached quotation.";
  return [
    `<p>Dear ${escapeHtml(input.customerName)},</p>`,
    `<p>${intro}</p>`,
    `<p>Quotation No: <strong>${escapeHtml(input.quotationNo)}</strong><br/>Grand Total: <strong>${formatRs(input.grandTotal)}</strong></p>`,
    `<p>Regards,<br/>PowerBid</p>`,
  ].join("");
}

function defaultText(input: {
  customerName: string;
  quotationNo: string;
  grandTotal: number;
  isReminder: boolean;
}) {
  const intro = input.isReminder
    ? "This is a gentle reminder regarding the quotation shared earlier."
    : "Please find attached quotation.";
  return `Dear ${input.customerName},\n\n${intro}\n\nQuotation No: ${input.quotationNo}\nGrand Total: ${formatRs(input.grandTotal)}\n\nRegards,\nPowerBid`;
}

function trackingPixelHtml(env: Env, token: string) {
  const baseUrl = (env.API_URL ?? env.APP_URL).replace(/\/$/, "");
  const src = `${baseUrl}/api/email-events/open/${encodeURIComponent(token)}`;
  return `<img src="${src}" alt="" width="1" height="1" style="display:block;border:0;width:1px;height:1px;" />`;
}

function formatRs(amount: number) {
  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `Rs. ${formatted}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}
