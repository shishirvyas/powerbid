import { and, count, desc, eq, gte } from "drizzle-orm";
import { NextRequest } from "next/server";
import { createTransport } from "nodemailer";
import { db } from "@/lib/db";
import { communicationLogs, customers, quotations } from "@/lib/db/schema";
import { ApiError, errorToResponse, jsonOk, parseId, parseJson, requireSession } from "@/lib/api";
import { quotationDispatchSchema } from "@/lib/schemas";
import { getTemplate, renderTemplate } from "@/lib/communication";

type Ctx = { params: Promise<{ id: string }> };

function appBaseUrl(req: NextRequest) {
  return process.env.APP_URL || req.nextUrl.origin;
}

function normalizePhone(raw: string) {
  return raw.replace(/[^\d+]/g, "");
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireSession();
    const id = parseId((await ctx.params).id);
    const logs = await db
      .select()
      .from(communicationLogs)
      .where(and(eq(communicationLogs.entity, "quotation"), eq(communicationLogs.entityId, id)))
      .orderBy(desc(communicationLogs.createdAt))
      .limit(30);
    return jsonOk(logs);
  } catch (err) {
    return errorToResponse(err);
  }
}

export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const session = await requireSession();
    const id = parseId((await ctx.params).id);
    const payload = await parseJson(req, quotationDispatchSchema);

    const since = new Date(Date.now() - 2 * 60 * 1000);
    const [recent] = await db
      .select({ attempts: count() })
      .from(communicationLogs)
      .where(
        and(
          eq(communicationLogs.entity, "quotation"),
          eq(communicationLogs.entityId, id),
          eq(communicationLogs.channel, payload.channel),
          gte(communicationLogs.createdAt, since),
        ),
      );
    if (Number(recent?.attempts || 0) >= 5) {
      throw new ApiError(429, "Too many send attempts. Please wait a minute and retry.");
    }

    const [q] = await db.select().from(quotations).where(eq(quotations.id, id));
    if (!q) throw new ApiError(404, "Quotation not found");
    const [customer] = await db.select().from(customers).where(eq(customers.id, q.customerId));
    const pdfUrl = `${appBaseUrl(req)}/api/quotations/${id}/pdf`;
    const template = await getTemplate(payload.channel, "quotation_send");
    const vars = {
      customerName: customer?.name || "Customer",
      quotationNo: q.quotationNo,
      referenceNo: q.referenceNo || q.quotationNo,
      projectName: q.projectName || "General",
      pdfUrl,
    };
    const templateSubject = template.subject ? renderTemplate(template.subject, vars) : null;
    const templateMessage = renderTemplate(template.body, vars);

    const effectiveSubject = payload.subject?.trim() || templateSubject || q.subject || `Quotation ${q.referenceNo || q.quotationNo}`;
    const effectiveMessage = payload.message?.trim() || templateMessage;

    const now = new Date();

    if (payload.channel === "email") {
      if (!isValidEmail(payload.to)) throw new ApiError(400, "Invalid recipient email");

      const smtpHost = process.env.SMTP_HOST;
      const smtpPort = Number(process.env.SMTP_PORT || "587");
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;
      const smtpFrom = process.env.SMTP_FROM;

      if (!smtpHost || !smtpFrom) {
        await db.insert(communicationLogs).values({
          entity: "quotation",
          entityId: id,
          channel: "email",
          status: "failed",
          recipient: payload.to,
          subject: effectiveSubject,
          message: effectiveMessage,
          error: "SMTP is not configured",
          createdBy: session.userId,
        });
        throw new ApiError(400, "SMTP is not configured. Set SMTP_HOST and SMTP_FROM in environment.");
      }

      const [log] = await db
        .insert(communicationLogs)
        .values({
          entity: "quotation",
          entityId: id,
          channel: "email",
          status: "queued",
          recipient: payload.to,
          subject: effectiveSubject,
          message: effectiveMessage,
          createdBy: session.userId,
        })
        .returning();

      const transport = createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
      });

      const attachments: Array<{ filename: string; content: Buffer; contentType: string }> = [];
      if (payload.attachPdf) {
        const pdfRes = await fetch(pdfUrl, {
          headers: { cookie: req.headers.get("cookie") || "" },
          cache: "no-store",
        });
        if (!pdfRes.ok) {
          throw new ApiError(500, "Could not generate PDF attachment");
        }
        const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());
        attachments.push({
          filename: `${q.quotationNo}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        });
      }

      try {
        const info = await transport.sendMail({
          from: smtpFrom,
          to: payload.to,
          subject: effectiveSubject,
          text: `${effectiveMessage}\n\nPDF: ${pdfUrl}`,
          attachments,
        });

        await db
          .update(communicationLogs)
          .set({
            status: "sent",
            providerMessageId: info.messageId,
            providerPayload: JSON.stringify({ response: info.response }),
            sentAt: now,
            error: null,
          })
          .where(eq(communicationLogs.id, log.id));

        await db.update(quotations).set({ status: "sent", sentAt: now.toISOString(), updatedAt: now, updatedBy: session.userId }).where(eq(quotations.id, id));

        return jsonOk({ ok: true, channel: "email", recipient: payload.to, messageId: info.messageId });
      } catch (sendErr) {
        const msg = sendErr instanceof Error ? sendErr.message : "Email send failed";
        await db
          .update(communicationLogs)
          .set({
            status: "failed",
            error: msg,
          })
          .where(eq(communicationLogs.id, log.id));
        throw new ApiError(500, msg);
      }
    }

    const toPhone = normalizePhone(payload.to);
    if (toPhone.length < 8) throw new ApiError(400, "Invalid WhatsApp number");
    const waText = `${effectiveMessage}\n\nPDF: ${pdfUrl}`;
    const [waLog] = await db
      .insert(communicationLogs)
      .values({
        entity: "quotation",
        entityId: id,
        channel: "whatsapp",
        status: "queued",
        recipient: toPhone,
        subject: effectiveSubject,
        message: waText,
        createdBy: session.userId,
      })
      .returning();

    const provider = (process.env.WHATSAPP_PROVIDER || "wa_me").toLowerCase();
    if (provider === "twilio") {
      const sid = process.env.TWILIO_ACCOUNT_SID;
      const token = process.env.TWILIO_AUTH_TOKEN;
      const from = process.env.TWILIO_WHATSAPP_FROM;
      if (!sid || !token || !from) {
        await db
          .update(communicationLogs)
          .set({ status: "failed", error: "Twilio WhatsApp is not configured" })
          .where(eq(communicationLogs.id, waLog.id));
        throw new ApiError(400, "Twilio WhatsApp is not configured");
      }

      const params = new URLSearchParams();
      params.set("From", from);
      params.set("To", toPhone.startsWith("whatsapp:") ? toPhone : `whatsapp:${toPhone}`);
      params.set("Body", waText);

      const twRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });
      const twData = await twRes.json();
      if (!twRes.ok) {
        await db
          .update(communicationLogs)
          .set({ status: "failed", error: String(twData?.message || "Twilio send failed"), providerPayload: JSON.stringify(twData) })
          .where(eq(communicationLogs.id, waLog.id));
        throw new ApiError(500, String(twData?.message || "Twilio send failed"));
      }

      await db
        .update(communicationLogs)
        .set({
          status: "sent",
          providerMessageId: twData.sid || null,
          providerPayload: JSON.stringify(twData),
          sentAt: now,
          error: null,
        })
        .where(eq(communicationLogs.id, waLog.id));

      await db.update(quotations).set({ status: "sent", sentAt: now.toISOString(), updatedAt: now, updatedBy: session.userId }).where(eq(quotations.id, id));

      return jsonOk({ ok: true, channel: "whatsapp", recipient: toPhone, provider: "twilio", messageId: twData.sid || null });
    }

    const whatsappUrl = `https://wa.me/${encodeURIComponent(toPhone)}?text=${encodeURIComponent(waText)}`;

    await db.update(communicationLogs).set({ providerPayload: JSON.stringify({ whatsappUrl }) }).where(eq(communicationLogs.id, waLog.id));

    await db.update(quotations).set({ status: "sent", sentAt: now.toISOString(), updatedAt: now, updatedBy: session.userId }).where(eq(quotations.id, id));

    return jsonOk({ ok: true, channel: "whatsapp", recipient: toPhone, provider: "wa_me", whatsappUrl });
  } catch (err) {
    return errorToResponse(err);
  }
}
