import { NextRequest } from "next/server";
import { createTransport } from "nodemailer";
import { errorToResponse, jsonOk, parseJson, requireSession } from "@/lib/api";
import { smtpTestSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    await requireSession();
    const payload = await parseJson(req, smtpTestSchema);

    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = Number(process.env.SMTP_PORT || "587");
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpFrom = process.env.SMTP_FROM;

    if (!smtpHost || !smtpFrom) {
      throw new Error("SMTP is not configured. Set SMTP_HOST and SMTP_FROM.");
    }

    const transport = createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined,
    });

    await transport.verify();

    const info = await transport.sendMail({
      from: smtpFrom,
      to: payload.to,
      subject: "BID SMTP test",
      text: "SMTP configuration is working.",
    });

    return jsonOk({ ok: true, messageId: info.messageId });
  } catch (err) {
    return errorToResponse(err);
  }
}
