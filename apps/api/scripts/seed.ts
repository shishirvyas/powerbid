// Local seed script: run via `pnpm db:seed:local`
// Uses the wrangler local D1 SQLite file for development convenience.
// For remote seeding, prefer SQL migrations or a dedicated /admin endpoint.

import { execSync } from "node:child_process";

const isRemote = process.argv.includes("--remote");
const flag = isRemote ? "--remote" : "--local";

const seed = `
INSERT OR IGNORE INTO gst_slabs (name, rate) VALUES ('GST 0', 0), ('GST 5', 5), ('GST 12', 12), ('GST 18', 18), ('GST 28', 28);
INSERT OR IGNORE INTO units (code, name) VALUES ('NOS', 'Numbers'), ('MTR', 'Meter'), ('BOX', 'Box'), ('COIL', 'Coil'), ('KG', 'Kilogram');
INSERT OR IGNORE INTO brands (name) VALUES ('Generic');
INSERT OR IGNORE INTO email_templates (code, subject, body) VALUES
  ('QUOTATION_SEND', 'Quotation {{quotationNo}}', 'Dear {{customerName}}, please find attached our quotation {{quotationNo}}.'),
  ('FOLLOWUP', 'Following up on {{quotationNo}}', 'Hi {{customerName}}, just following up on our quotation {{quotationNo}}.');
`;

execSync(`wrangler d1 execute powerbid ${flag} --command="${seed.replace(/\n/g, " ")}"`, {
  stdio: "inherit",
});
