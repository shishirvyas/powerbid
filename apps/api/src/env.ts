// Cloudflare Worker bindings + env contract.
// Keep in sync with wrangler.toml.

export interface Env {
  // D1 database
  DB: D1Database;
  // R2 bucket for PDFs / attachments
  FILES: R2Bucket;
  // Browser Rendering (PDF generation)
  BROWSER?: Fetcher;

  // Vars
  ENVIRONMENT: "development" | "staging" | "production";
  JWT_ISSUER: string;
  APP_URL: string;
  API_URL: string;
  MAIL_FROM: string;
  MAIL_FROM_NAME: string;
  ALLOWED_ORIGINS: string; // comma-separated

  // Secrets
  JWT_SECRET: string;
  MAILCHANNELS_API_KEY?: string;
  SEED_KEY?: string;
}
