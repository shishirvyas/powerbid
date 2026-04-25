/**
 * Atomic per-year inquiry numbering: INQ-YYYY-####
 * Mirrors quotations.numbering but for inquiries.
 */
export async function nextInquiryNo(d1: D1Database, year: number): Promise<string> {
  await d1
    .prepare(
      `CREATE TABLE IF NOT EXISTS inquiry_sequences (
         year INTEGER PRIMARY KEY,
         last_value INTEGER NOT NULL DEFAULT 0
       )`,
    )
    .run();
  const row = await d1
    .prepare(
      `INSERT INTO inquiry_sequences (year, last_value) VALUES (?1, 1)
       ON CONFLICT(year) DO UPDATE SET last_value = last_value + 1
       RETURNING last_value`,
    )
    .bind(year)
    .first<{ last_value: number }>();
  const seq = row?.last_value ?? 1;
  return `INQ-${year}-${String(seq).padStart(4, "0")}`;
}
