/**
 * Tiny CSV writer with Excel-friendly defaults:
 *  - UTF-8 BOM so Excel detects the encoding correctly
 *  - Quoted fields, doubles inner quotes, normalises CR/LF
 *
 * Excel ("Open / Import") accepts CSV happily; we expose this as the
 * "Export Excel" surface to avoid bundling a full xlsx writer in a Worker.
 */
export function toCsv(rows: Array<Record<string, unknown>>, columns: string[]): string {
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = String(v).replace(/\r?\n/g, " ");
    if (/[",]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const header = columns.join(",");
  const body = rows.map((r) => columns.map((c) => esc(r[c])).join(",")).join("\n");
  return "\uFEFF" + header + "\n" + body;
}

export function csvResponse(filename: string, csv: string): Response {
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
