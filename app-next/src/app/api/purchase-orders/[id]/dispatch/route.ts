import { and, count, desc, eq, gte } from "drizzle-orm";
import { NextRequest } from "next/server";
import { createTransport } from "nodemailer";
import { db } from "@/lib/db";
import { communicationLogs, purchaseOrders, suppliers } from "@/lib/db/schema";
import { ApiError, errorToResponse, jsonOk, parseId, parseJson, requireSession } from "@/lib/api";
import { quotationDispatchSchema } from "@/lib/schemas";

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
      .where(and(eq(communicationLogs.entity, "purchase_order"), eq(communicationLogs.entityId, id)))
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
    if (session.role === "viewer") throw new ApiError(403, "Only sales/admin users can dispatch purchase orders");
    const id = parseId((await ctx.params).id);
    const payload = await parseJson(req, quotationDispatchSchema);

    const since = new Date(Date.now() - 2 * 60 * 1000);
    const [recent] = await db
      .select({ attempts: count() })
      .from(communicationLogs)
      .where(
        and(
          eq(communicationLogs.entity, "purchase_order"),
          eq(communicationLogs.entityId, id),
          eq(communicationLogs.channel, payload.channel),
          gte(communicationLogs.createdAt, since),
        ),
      );
    if (Number(recent?.attempts || 0) >= 5) {
      throw new ApiError(429, "Too many send attempts. Please wait a minute and retry.");
    }

    const [po] = await db
      .select({
        id: purchaseOrders.id,
        poNumber: purchaseOrders.poNumber,
        status: purchaseOrders.status,
        approvalMode: purchaseOrders.approvalMode,
        selfApprovalScanPath: purchaseOrders.selfApprovalScanPath,
        supplierId: purchaseOrders.supplierId,
      })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.id, id));
    if (!po) throw new ApiError(404, "Purchase Order not found");
    if (po.status !== "approved") {
      throw new ApiError(409, "Purchase Order must be approved before supplier dispatch");
    }
    if (po.approvalMode === "self_with_scan" && !po.selfApprovalScanPath) {
      throw new ApiError(409, "Self-approved PO requires signed scan before supplier dispatch");
    }

    const [supplier] = await db
      .select({
        id: suppliers.id,
        companyName: suppliers.companyName,
        email: suppliers.email,
        phone: suppliers.phone,
      })
      .from(suppliers)
      .where(eq(suppliers.id, po.supplierId || 0));

    const pdfUrl = `${appBaseUrl(req)}/api/purchase-orders/${id}/pdf`;
    const effectiveSubject =
      payload.subject?.trim() || `Purchase Order ${po.poNumber}`;
    const effectiveMessage =
      payload.message?.trim() ||
      `Dear ${supplier?.companyName || "Supplier"}, please find Purchase Order ${po.poNumber}. PDF: ${pdfUrl}`;

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
          entity: "purchase_order",
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
          entity: "purchase_order",
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
          filename: `${po.poNumber}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        });
      }

      try {
        const info = await transport.sendMail({
          from: smtpFrom,
          to: payload.to,
          subject: effectiveSubject,
          text: effectiveMessage,
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

        await db
          .update(purchaseOrders)
          .set({ status: "sent", updatedAt: now, updatedBy: session.userId })
          .where(eq(purchaseOrders.id, id));

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
    const waText = `${effectiveMessage}`;
    const [waLog] = await db
      .insert(communicationLogs)
      .values({
        entity: "purchase_order",
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

      await db
        .update(purchaseOrders)
        .set({ status: "sent", updatedAt: now, updatedBy: session.userId })
        .where(eq(purchaseOrders.id, id));

      return jsonOk({ ok: true, channel: "whatsapp", recipient: toPhone, provider: "twilio", messageId: twData.sid || null });
    }

    const whatsappUrl = `https://wa.me/${encodeURIComponent(toPhone)}?text=${encodeURIComponent(`${waText}\n\nPDF: ${pdfUrl}`)}`;

    await db.update(communicationLogs).set({ providerPayload: JSON.stringify({ whatsappUrl }) }).where(eq(communicationLogs.id, waLog.id));

    await db
      .update(purchaseOrders)
      .set({ status: "sent", updatedAt: now, updatedBy: session.userId })
      .where(eq(purchaseOrders.id, id));

    return jsonOk({ ok: true, channel: "whatsapp", recipient: toPhone, provider: "wa_me", whatsappUrl });
  } catch (err) {
    return errorToResponse(err);
  }
}
