import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { quotationsApi, quotationsCsvUrl, type QuotationListItem } from "../../lib/quotations";

const STATUS_TABS = ["all", "draft", "final", "sent", "won", "lost", "expired"] as const;

const BASE = (import.meta as ImportMeta & { env: { VITE_API_BASE_URL?: string } }).env
  .VITE_API_BASE_URL ?? "";

async function downloadCsv(status: string) {
  const token = localStorage.getItem("pb_token");
  const res = await fetch(`${BASE}${quotationsCsvUrl(status)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    alert("Export failed");
    return;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `quotations-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const statusClasses: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  final: "bg-blue-100 text-blue-700",
  sent: "bg-sky-100 text-sky-700",
  won: "bg-emerald-100 text-emerald-700",
  lost: "bg-red-100 text-red-700",
  expired: "bg-amber-100 text-amber-700",
};

export function QuotationListPage() {
  const [tab, setTab] = useState<(typeof STATUS_TABS)[number]>("all");
  const [q, setQ] = useState("");

  const query = useQuery({
    queryKey: ["quotations", tab, q],
    queryFn: () =>
      quotationsApi.list({
        status: tab === "all" ? undefined : tab,
        q: q || undefined,
      }),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Quotations</h1>
          <p className="text-sm text-slate-500">Create, finalize, send and track quotations.</p>
        </div>
        <Link
          to="/quotations/new"
          className="inline-flex h-9 items-center rounded-md bg-blue-700 px-4 text-sm font-medium text-white hover:bg-blue-800"
        >
          + New quotation
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => setTab(s)}
            className={`h-8 rounded-full px-3 text-xs font-medium capitalize transition ${
              tab === s
                ? "bg-blue-700 text-white"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-slate-300"
            }`}
          >
            {s}
          </button>
        ))}
        <button
          onClick={() => downloadCsv(tab)}
          className="h-8 rounded-full bg-white px-3 text-xs font-medium text-slate-600 ring-1 ring-slate-200 transition hover:ring-slate-300 inline-flex items-center"
          title="Download as CSV (opens in Excel)"
        >
          Export Excel
        </button>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search quotation no or customer…"
          className="ml-auto h-9 w-72 rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
        />
      </div>

      <div className="overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">Quotation No</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Grand Total</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {query.isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                  Loading…
                </td>
              </tr>
            )}
            {query.data?.items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                  No quotations yet. Create one to get started.
                </td>
              </tr>
            )}
            {query.data?.items.map((row: QuotationListItem) => (
              <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                <td className="px-4 py-3 font-mono text-blue-700">
                  <Link to={`/quotations/${row.id}`}>{row.quotationNo}</Link>
                </td>
                <td className="px-4 py-3 text-slate-500">{row.quotationDate}</td>
                <td className="px-4 py-3">{row.customerName ?? "—"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex h-6 items-center rounded-full px-2 text-xs font-medium capitalize ${
                      statusClasses[row.status] ?? "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {row.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">
                  ₹ {row.grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    to={`/quotations/${row.id}`}
                    className="text-xs font-medium text-blue-700 hover:underline"
                  >
                    Open →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
