export type QtyBreakup = Record<string, number>;

export function parseQtyBreakup(raw: string | null | undefined): QtyBreakup {
  if (!raw) return {};

  const trimmed = raw.trim();
  if (!trimmed) return {};

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === "object") {
      const out: QtyBreakup = {};
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        const n = Number(v);
        if (k.trim() && Number.isFinite(n) && n > 0) out[k.trim()] = n;
      }
      return out;
    }
  } catch {
    // Fall through to key:value parser.
  }

  const out: QtyBreakup = {};
  const tokens = trimmed
    .split(/\r?\n|;|,/)
    .map((t) => t.trim())
    .filter(Boolean);

  for (const token of tokens) {
    const idx = token.search(/[:=]/);
    if (idx <= 0) continue;
    const key = token.slice(0, idx).trim();
    const value = Number(token.slice(idx + 1).trim());
    if (!key || !Number.isFinite(value) || value <= 0) continue;
    out[key] = value;
  }
  return out;
}

export function stringifyQtyBreakup(map: QtyBreakup): string {
  const compact: QtyBreakup = {};
  for (const [k, v] of Object.entries(map)) {
    if (k.trim() && Number.isFinite(v) && v > 0) compact[k.trim()] = v;
  }
  if (Object.keys(compact).length === 0) return "";
  return JSON.stringify(compact);
}

export function sumQtyBreakup(map: QtyBreakup): number {
  return Object.values(map).reduce((acc, n) => acc + n, 0);
}

export function collectQtyColumns(values: Array<string | null | undefined>): string[] {
  const set = new Set<string>();
  for (const raw of values) {
    const map = parseQtyBreakup(raw);
    for (const k of Object.keys(map)) set.add(k);
  }
  return Array.from(set);
}
