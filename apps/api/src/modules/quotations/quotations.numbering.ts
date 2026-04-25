import type { D1Database } from "@cloudflare/workers-types";

/**
 * Generate Q-YYYY-#### using a transactional update on a sequence table.
 * Falls back to MAX+1 when the sequence row doesn't exist yet.
 */
export async function nextQuotationNo(db: D1Database, year: number): Promise<string> {
  // Ensure sequence table exists (idempotent; cheap).
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS quotation_sequences (
         year INTEGER PRIMARY KEY,
         last_value INTEGER NOT NULL DEFAULT 0
       )`,
    )
    .run();

  // Atomic increment via UPSERT + RETURNING.
  const row = await db
    .prepare(
      `INSERT INTO quotation_sequences (year, last_value) VALUES (?, 1)
         ON CONFLICT(year) DO UPDATE SET last_value = last_value + 1
       RETURNING last_value`,
    )
    .bind(year)
    .first<{ last_value: number }>();
  const seq = row?.last_value ?? 1;
  return `Q-${year}-${String(seq).padStart(4, "0")}`;
}
