import { useQuery } from "@tanstack/react-query";
import { dashboardApi, type DashboardPayload, type MonthPoint } from "../../lib/dashboard";
import { formatMonthLabel, formatRs } from "../../lib/format";

const STATUS_COLORS: Record<string, string> = {
  draft: "#94A3B8",
  final: "#2563EB",
  sent: "#1E40AF",
  won: "#10B981",
  lost: "#EF4444",
};

export default function DashboardPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["dashboard"],
    queryFn: dashboardApi.get,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  if (isLoading) {
    return <div className="p-6 text-slate-500">Loading dashboard…</div>;
  }
  if (isError || !data) {
    return <div className="p-6 text-red-600">Failed to load dashboard.</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Executive Dashboard
        </h1>
        <p className="text-sm text-slate-500">
          Realtime sales performance · auto-refreshes every minute
        </p>
      </header>

      <KpiRow data={data} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <RevenueCard className="lg:col-span-2" series={data.monthlySeries} />
        <WonLostCard won={data.kpis.won} lost={data.kpis.lost} winRate={data.kpis.winRate} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <TopCustomersCard data={data.topCustomers} />
        <TopProductsCard data={data.topProducts} />
      </div>

      <LeaderboardCard data={data.leaderboard} />

      <RecentCard data={data.recent} />
    </div>
  );
}

/* ---------------------------------- KPI tiles --------------------------------- */

function KpiRow({ data }: { data: DashboardPayload }) {
  const { kpis } = data;
  const tiles: Array<{
    label: string;
    value: string;
    sub?: string;
    accent: string;
  }> = [
    {
      label: "Today's Quotations",
      value: String(kpis.todayQuotations),
      sub: formatRs(kpis.todayValue, { compact: true }),
      accent: "bg-blue-700",
    },
    {
      label: "Drafts Pending",
      value: String(kpis.draftPending),
      sub: "awaiting finalization",
      accent: "bg-amber-500",
    },
    {
      label: "This Month Value",
      value: formatRs(kpis.monthValue, { compact: true }),
      sub: `${kpis.quotationsThisMonth} quotations`,
      accent: "bg-indigo-600",
    },
    {
      label: "Win Rate",
      value: `${kpis.winRate.toFixed(1)}%`,
      sub: `${kpis.won} won · ${kpis.lost} lost`,
      accent: "bg-emerald-600",
    },
    {
      label: "Pipeline Value",
      value: formatRs(kpis.pipelineValue, { compact: true }),
      sub: "final + sent",
      accent: "bg-sky-600",
    },
    {
      label: "Open Inquiries",
      value: String(kpis.openInquiries),
      sub: `${kpis.activeCustomers} active customers`,
      accent: "bg-violet-600",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
      {tiles.map((t) => (
        <div
          key={t.label}
          className="relative overflow-hidden rounded-lg bg-white p-4 shadow-sm ring-1 ring-slate-200"
        >
          <div className={`absolute inset-y-0 left-0 w-1 ${t.accent}`} />
          <div className="ml-2">
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {t.label}
            </div>
            <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">
              {t.value}
            </div>
            {t.sub && <div className="mt-0.5 text-xs text-slate-500">{t.sub}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ----------------------------- Monthly revenue area --------------------------- */

function RevenueCard({ series, className = "" }: { series: MonthPoint[]; className?: string }) {
  const W = 720;
  const H = 220;
  const PAD_L = 48;
  const PAD_R = 16;
  const PAD_T = 16;
  const PAD_B = 28;

  const max = Math.max(1, ...series.map((s) => s.total));
  const niceMax = niceCeil(max);

  const xStep = (W - PAD_L - PAD_R) / Math.max(1, series.length - 1);
  const y = (v: number) => PAD_T + (H - PAD_T - PAD_B) * (1 - v / niceMax);

  const linePts = series.map((s, i) => `${PAD_L + i * xStep},${y(s.total)}`).join(" ");
  const areaPts =
    `${PAD_L},${H - PAD_B} ` + linePts + ` ${PAD_L + (series.length - 1) * xStep},${H - PAD_B}`;

  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className={`rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200 ${className}`}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Monthly Quotation Value</h2>
          <p className="text-xs text-slate-500">Last 6 months · all quotations</p>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Monthly value">
        <defs>
          <linearGradient id="revGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#1E40AF" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#1E40AF" stopOpacity="0" />
          </linearGradient>
        </defs>
        {gridLines.map((g) => {
          const gy = PAD_T + (H - PAD_T - PAD_B) * g;
          return (
            <g key={g}>
              <line
                x1={PAD_L}
                x2={W - PAD_R}
                y1={gy}
                y2={gy}
                stroke="#E2E8F0"
                strokeDasharray="3 3"
              />
              <text
                x={PAD_L - 8}
                y={gy + 3}
                textAnchor="end"
                fontSize="10"
                fill="#94A3B8"
              >
                {formatRs(niceMax * (1 - g), { compact: true }).replace("Rs. ", "")}
              </text>
            </g>
          );
        })}
        <polygon points={areaPts} fill="url(#revGrad)" />
        <polyline points={linePts} fill="none" stroke="#1E40AF" strokeWidth={2.5} />
        {series.map((s, i) => (
          <g key={s.month}>
            <circle
              cx={PAD_L + i * xStep}
              cy={y(s.total)}
              r={3.5}
              fill="#1E40AF"
              stroke="#fff"
              strokeWidth={1.5}
            />
            <text
              x={PAD_L + i * xStep}
              y={H - 8}
              textAnchor="middle"
              fontSize="11"
              fill="#64748B"
            >
              {formatMonthLabel(s.month)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ------------------------------- Won / Lost donut ----------------------------- */

function WonLostCard({
  won,
  lost,
  winRate,
}: {
  won: number;
  lost: number;
  winRate: number;
}) {
  const total = won + lost;
  const r = 56;
  const c = 2 * Math.PI * r;
  const wonLen = total > 0 ? (won / total) * c : 0;

  return (
    <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-sm font-semibold text-slate-900">Won vs Lost</h2>
      <p className="text-xs text-slate-500">All-time decided quotations</p>
      <div className="mt-4 flex items-center gap-6">
        <svg viewBox="0 0 160 160" className="h-40 w-40">
          <circle cx="80" cy="80" r={r} fill="none" stroke="#FEE2E2" strokeWidth="18" />
          <circle
            cx="80"
            cy="80"
            r={r}
            fill="none"
            stroke="#10B981"
            strokeWidth="18"
            strokeDasharray={`${wonLen} ${c - wonLen}`}
            strokeDashoffset={c / 4}
            transform="rotate(-90 80 80)"
            strokeLinecap="butt"
          />
          <text
            x="80"
            y="78"
            textAnchor="middle"
            fontSize="22"
            fontWeight="600"
            fill="#0F172A"
          >
            {winRate.toFixed(0)}%
          </text>
          <text x="80" y="96" textAnchor="middle" fontSize="11" fill="#64748B">
            win rate
          </text>
        </svg>
        <div className="space-y-3 text-sm">
          <LegendDot color="#10B981" label="Won" value={won} />
          <LegendDot color="#EF4444" label="Lost" value={lost} />
          <div className="text-xs text-slate-500">Total decided: {total}</div>
        </div>
      </div>
    </div>
  );
}

function LegendDot({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      <span className="text-slate-700">{label}</span>
      <span className="ml-auto font-semibold tabular-nums text-slate-900">{value}</span>
    </div>
  );
}

/* --------------------------------- Top customers ------------------------------ */

function TopCustomersCard({
  data,
}: {
  data: { id: number; name: string; total: number; quotations: number; won: number }[];
}) {
  const max = Math.max(1, ...data.map((d) => d.total));
  return (
    <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-sm font-semibold text-slate-900">Top Customers</h2>
      <p className="text-xs text-slate-500">By total quotation value</p>
      <ul className="mt-4 space-y-3">
        {data.length === 0 && <li className="text-sm text-slate-400">No data yet.</li>}
        {data.map((c) => (
          <li key={c.id}>
            <div className="flex items-baseline justify-between">
              <span className="truncate text-sm font-medium text-slate-800">{c.name}</span>
              <span className="text-sm font-semibold tabular-nums text-slate-900">
                {formatRs(c.total, { compact: true })}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-blue-600"
                style={{ width: `${(c.total / max) * 100}%` }}
              />
            </div>
            <div className="mt-1 text-xs text-slate-500">
              {c.quotations} quotations · {c.won} won
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* --------------------------------- Top products ------------------------------- */

function TopProductsCard({
  data,
}: {
  data: { name: string; qty: number; total: number }[];
}) {
  const max = Math.max(1, ...data.map((d) => d.total));
  return (
    <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-sm font-semibold text-slate-900">Top Products</h2>
      <p className="text-xs text-slate-500">By revenue (final / sent / won)</p>
      <ul className="mt-4 space-y-3">
        {data.length === 0 && <li className="text-sm text-slate-400">No data yet.</li>}
        {data.map((p) => (
          <li key={p.name}>
            <div className="flex items-baseline justify-between">
              <span className="truncate text-sm font-medium text-slate-800">{p.name}</span>
              <span className="text-sm font-semibold tabular-nums text-slate-900">
                {formatRs(p.total, { compact: true })}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full bg-slate-700"
                style={{ width: `${(p.total / max) * 100}%` }}
              />
            </div>
            <div className="mt-1 text-xs text-slate-500">Qty {p.qty}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------- Leaderboard --------------------------------- */

function LeaderboardCard({
  data,
}: {
  data: {
    id: number;
    name: string;
    email: string;
    quotations: number;
    total: number;
    won_value: number;
    won: number;
    lost: number;
  }[];
}) {
  return (
    <div className="rounded-lg bg-white shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Sales Leaderboard</h2>
          <p className="text-xs text-slate-500">Ranked by won-deal value</p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-2 text-left">#</th>
              <th className="px-5 py-2 text-left">Salesperson</th>
              <th className="px-5 py-2 text-right">Quotations</th>
              <th className="px-5 py-2 text-right">Quoted</th>
              <th className="px-5 py-2 text-right">Won Value</th>
              <th className="px-5 py-2 text-right">Win Rate</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-center text-slate-400">
                  No sales data yet.
                </td>
              </tr>
            )}
            {data.map((u, idx) => {
              const decided = u.won + u.lost;
              const rate = decided > 0 ? (u.won / decided) * 100 : 0;
              return (
                <tr key={u.id} className="border-t border-slate-100">
                  <td className="px-5 py-3 text-slate-500">{idx + 1}</td>
                  <td className="px-5 py-3">
                    <div className="font-medium text-slate-900">{u.name}</div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-slate-700">
                    {u.quotations}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-slate-700">
                    {formatRs(u.total, { compact: true })}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums font-semibold text-emerald-700">
                    {formatRs(u.won_value, { compact: true })}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full bg-emerald-500"
                          style={{ width: `${rate}%` }}
                        />
                      </div>
                      <span className="w-10 text-right text-xs tabular-nums text-slate-600">
                        {rate.toFixed(0)}%
                      </span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* --------------------------------- Recent feed -------------------------------- */

function RecentCard({
  data,
}: {
  data: {
    id: number;
    quotation_no: string;
    status: string;
    grand_total: number;
    updated_at: string;
    customer_name: string | null;
  }[];
}) {
  return (
    <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-sm font-semibold text-slate-900">Recent Activity</h2>
      <ul className="mt-3 divide-y divide-slate-100">
        {data.length === 0 && <li className="py-3 text-sm text-slate-400">No activity.</li>}
        {data.map((q) => (
          <li key={q.id} className="flex items-center justify-between py-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-slate-900">
                {q.quotation_no} · {q.customer_name ?? "—"}
              </div>
              <div className="text-xs text-slate-500">
                {new Date(q.updated_at).toLocaleString("en-IN")}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span
                className="rounded-full px-2 py-0.5 text-xs font-medium capitalize text-white"
                style={{ background: STATUS_COLORS[q.status] ?? "#64748B" }}
              >
                {q.status}
              </span>
              <span className="text-sm font-semibold tabular-nums text-slate-900">
                {formatRs(q.grand_total, { compact: true })}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ----------------------------------- helpers ---------------------------------- */

function niceCeil(n: number): number {
  if (n <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(n)));
  const f = n / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return nice * exp;
}
