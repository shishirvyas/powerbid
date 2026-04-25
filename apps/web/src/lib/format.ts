/** Format INR with grouping: 12,34,567.00 → "Rs. 12,34,567" or "Rs. 12.3 L". */
export function formatRs(amount: number, opts: { compact?: boolean } = {}): string {
  if (!Number.isFinite(amount)) return "Rs. 0";
  if (opts.compact) {
    if (amount >= 10000000) return `Rs. ${(amount / 10000000).toFixed(2)} Cr`;
    if (amount >= 100000) return `Rs. ${(amount / 100000).toFixed(2)} L`;
    if (amount >= 1000) return `Rs. ${(amount / 1000).toFixed(1)} K`;
  }
  return `Rs. ${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(amount)}`;
}

export function formatMonthLabel(ym: string): string {
  // "2026-04" -> "Apr"
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleString("en-IN", { month: "short" });
}
