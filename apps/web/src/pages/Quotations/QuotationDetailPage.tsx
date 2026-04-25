import { Link, useParams } from "react-router-dom";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { quotationsApi, timelineApi } from "../../lib/quotations";

export function QuotationDetailPage() {
  const { id } = useParams();
  const qid = Number(id);
  const qc = useQueryClient();
  const detail = useQuery({ queryKey: ["quotation", id], queryFn: () => quotationsApi.get(qid) });

  const [emailOpen, setEmailOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);

  const finalizeMut = useMutation({
    mutationFn: () => quotationsApi.finalize(qid),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["quotation", id] }),
  });
  const generatePdfMut = useMutation({
    mutationFn: () => quotationsApi.generatePdf(qid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["quotation", id] });
      setPdfOpen(true);
    },
  });
  const cloneMut = useMutation({
    mutationFn: () => quotationsApi.clone(qid),
    onSuccess: (r) => (window.location.href = `/quotations/${r.id}/edit`),
  });

  if (detail.isLoading || !detail.data) {
    return <div className="py-16 text-center text-slate-400">Loading…</div>;
  }
  const { quotation: q, customer, items } = detail.data;

  const fmt = (n: number) =>
    n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-mono text-2xl font-bold text-blue-700">{q.quotationNo}</h1>
          <p className="text-sm text-slate-500">
            {customer?.name ?? "—"} · {q.quotationDate} · valid {q.validityDays} days
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {q.status === "draft" && (
            <>
              <Link to={`/quotations/${qid}/edit`} className="btn-secondary">Edit</Link>
              <button onClick={() => finalizeMut.mutate()} className="btn-primary" disabled={finalizeMut.isPending}>
                Finalize
              </button>
            </>
          )}
          <button onClick={() => cloneMut.mutate()} className="btn-secondary">Clone</button>
          <button onClick={() => generatePdfMut.mutate()} className="btn-secondary" disabled={generatePdfMut.isPending}>
            {q.pdfR2Key ? "Re-generate PDF" : "Generate PDF"}
          </button>
          {q.pdfR2Key && (
            <a href={quotationsApi.pdfUrl(qid)} target="_blank" rel="noreferrer" className="btn-secondary">
              View PDF
            </a>
          )}
          <button
            onClick={() => setEmailOpen(true)}
            className="btn-primary"
            disabled={q.status === "draft"}
            title={q.status === "draft" ? "Finalize first" : ""}
          >
            Email…
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-lg bg-white ring-1 ring-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">Item</th>
                  <th className="px-4 py-2 text-right">Qty</th>
                  <th className="px-4 py-2 text-right">Rate</th>
                  <th className="px-4 py-2 text-right">Disc</th>
                  <th className="px-4 py-2 text-right">GST</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-t border-slate-100">
                    <td className="px-4 py-2">
                      <div className="font-medium">{it.productName}</div>
                      {it.description && <div className="text-xs text-slate-500">{it.description}</div>}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmt(it.qty)} {it.unitName ?? ""}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmt(it.unitPrice)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{it.discountPercent}%</td>
                    <td className="px-4 py-2 text-right tabular-nums">{it.gstRate}%</td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums">₹ {fmt(it.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {q.termsConditions && (
            <div className="rounded-lg bg-white p-4 ring-1 ring-slate-200">
              <h3 className="text-xs uppercase tracking-wider text-slate-500">Terms &amp; Conditions</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm">{q.termsConditions}</p>
            </div>
          )}

          {(q.paymentTerms || q.deliverySchedule) && (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {q.paymentTerms && (
                <div className="rounded-lg bg-white p-4 ring-1 ring-slate-200">
                  <h3 className="text-xs uppercase tracking-wider text-slate-500">Payment Terms</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{q.paymentTerms}</p>
                </div>
              )}
              {q.deliverySchedule && (
                <div className="rounded-lg bg-white p-4 ring-1 ring-slate-200">
                  <h3 className="text-xs uppercase tracking-wider text-slate-500">Delivery Schedule</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{q.deliverySchedule}</p>
                </div>
              )}
            </div>
          )}

          <TimelinePanel quotationId={qid} />
        </div>

        <aside className="space-y-3 self-start lg:sticky lg:top-4">
          <div className="rounded-lg bg-white p-4 ring-1 ring-slate-200">
            <h3 className="text-sm font-semibold">Summary</h3>
            <dl className="mt-3 space-y-1 text-sm">
              <Row label="Status" value={<span className="capitalize font-medium text-slate-900">{q.status}</span>} />
              <Row label="Subtotal" value={`₹ ${fmt(q.subtotal)}`} />
              <Row label="Discount" value={`- ₹ ${fmt(q.discountAmount)}`} />
              <Row label="Taxable" value={`₹ ${fmt(q.taxableAmount)}`} />
              <Row label="GST" value={`₹ ${fmt(q.gstAmount)}`} />
              <Row label="Freight" value={`₹ ${fmt(q.freightAmount)}`} />
            </dl>
            <div className="mt-3 flex items-center justify-between rounded-md bg-blue-700 px-3 py-2 text-white">
              <span className="text-xs uppercase tracking-wider">Grand Total</span>
              <span className="text-base font-bold tabular-nums">₹ {fmt(q.grandTotal)}</span>
            </div>
          </div>
        </aside>
      </div>

      {emailOpen && (
        <EmailDialog
          quotationId={qid}
          defaultTo={customer?.email ?? ""}
          quotationNo={q.quotationNo}
          onClose={() => setEmailOpen(false)}
          onSent={() => {
            setEmailOpen(false);
            qc.invalidateQueries({ queryKey: ["quotation", id] });
          }}
        />
      )}
      {pdfOpen && q.pdfR2Key && (
        <iframe
          className="fixed inset-4 z-50 rounded-lg ring-1 ring-slate-300 bg-white shadow-xl"
          src={quotationsApi.pdfUrl(qid)}
          title="PDF preview"
          onLoad={() => undefined}
        />
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

function TimelinePanel({ quotationId }: { quotationId: number }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const tl = useQuery({
    queryKey: ["timeline", "quotation", quotationId],
    queryFn: () => timelineApi.list("quotation", quotationId),
  });
  const addNote = useMutation({
    mutationFn: (body: string) => timelineApi.addNote("quotation", quotationId, body),
    onSuccess: () => {
      setDraft("");
      qc.invalidateQueries({ queryKey: ["timeline", "quotation", quotationId] });
    },
  });

  return (
    <div className="rounded-lg bg-white p-4 ring-1 ring-slate-200">
      <h3 className="text-xs uppercase tracking-wider text-slate-500">Notes &amp; Activity</h3>

      <div className="mt-3 flex gap-2">
        <textarea
          rows={2}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a note (visible to your team)…"
          className="form-input flex-1 resize-y text-sm"
        />
        <button
          onClick={() => draft.trim() && addNote.mutate(draft.trim())}
          disabled={!draft.trim() || addNote.isPending}
          className="btn-primary self-start"
        >
          Add
        </button>
      </div>

      <ul className="mt-4 space-y-3">
        {tl.isLoading && <li className="text-sm text-slate-400">Loading…</li>}
        {tl.data?.items.length === 0 && (
          <li className="text-sm text-slate-400">No activity yet.</li>
        )}
        {tl.data?.items.map((e) => (
          <li key={`${e.kind}-${e.id}`} className="flex gap-3">
            <span
              className={`mt-1.5 h-2 w-2 flex-none rounded-full ${
                e.kind === "note" ? "bg-blue-600" : "bg-slate-300"
              }`}
            />
            <div className="flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-xs font-medium text-slate-700">
                  {e.kind === "note" ? e.author ?? "Team" : formatActivityTitle(e.title)}
                </span>
                <span className="text-xs text-slate-400">
                  {new Date(e.created_at).toLocaleString("en-IN")}
                </span>
              </div>
              {e.body && (
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">
                  {e.kind === "note" ? e.body : formatActivityBody(e.body)}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatActivityTitle(action: string): string {
  return action.replace(/^quotation\./, "").replace(/\./g, " · ").replace(/_/g, " ");
}

function formatActivityBody(body: string | null): string {
  if (!body) return "";
  try {
    const o = JSON.parse(body) as Record<string, unknown>;
    return Object.entries(o)
      .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
      .join("  ·  ");
  } catch {
    return body;
  }
}

function EmailDialog(props: {
  quotationId: number;
  defaultTo: string;
  quotationNo: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const [to, setTo] = useState(props.defaultTo);
  const [cc, setCc] = useState("");
  const [subject, setSubject] = useState(`Quotation ${props.quotationNo}`);
  const [body, setBody] = useState(
    `<p>Dear customer,</p><p>Please find attached our quotation <b>${props.quotationNo}</b>.</p><p>Regards,<br/>PowerBid</p>`,
  );
  const send = useMutation({
    mutationFn: () =>
      quotationsApi.email(props.quotationId, {
        to,
        cc: cc || undefined,
        subject,
        body,
      }),
    onSuccess: props.onSent,
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-5 ring-1 ring-slate-200 shadow-xl">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Email quotation</h3>
          <button onClick={props.onClose} className="text-slate-400 hover:text-slate-600">×</button>
        </div>
        <div className="mt-4 space-y-3 text-sm">
          <input className="form-input w-full" placeholder="To" value={to} onChange={(e) => setTo(e.target.value)} />
          <input className="form-input w-full" placeholder="Cc (optional)" value={cc} onChange={(e) => setCc(e.target.value)} />
          <input className="form-input w-full" placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          <textarea className="form-input w-full resize-y" rows={6} value={body} onChange={(e) => setBody(e.target.value)} />
          {send.isError && <p className="text-xs text-red-600">{(send.error as Error).message}</p>}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button onClick={props.onClose} className="btn-secondary">Cancel</button>
          <button onClick={() => send.mutate()} disabled={send.isPending} className="btn-primary">
            {send.isPending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
