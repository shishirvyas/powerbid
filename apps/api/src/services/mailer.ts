import type { Env } from "../env";

export interface MailAttachment {
  filename: string;
  /** Base64-encoded content. */
  content: string;
  type: string;
}

export interface MailMessage {
  to: string;
  cc?: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: MailAttachment[];
}

// Sends transactional email via MailChannels (free for Cloudflare Workers).
// Domain SPF/DKIM/Lockdown should be configured. See: https://support.mailchannels.com/
export async function sendEmail(env: Env, msg: MailMessage): Promise<void> {
  const personalization: Record<string, unknown> = { to: [{ email: msg.to }] };
  if (msg.cc) personalization.cc = [{ email: msg.cc }];

  const body: Record<string, unknown> = {
    personalizations: [personalization],
    from: { email: env.MAIL_FROM, name: env.MAIL_FROM_NAME },
    subject: msg.subject,
    content: [
      ...(msg.text ? [{ type: "text/plain", value: msg.text }] : []),
      { type: "text/html", value: msg.html },
    ],
  };
  if (msg.attachments?.length) body.attachments = msg.attachments;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (env.MAILCHANNELS_API_KEY) headers["X-Api-Key"] = env.MAILCHANNELS_API_KEY;

  const res = await fetch("https://api.mailchannels.net/tx/v1/send", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Mail send failed: ${res.status} ${await res.text()}`);
}
