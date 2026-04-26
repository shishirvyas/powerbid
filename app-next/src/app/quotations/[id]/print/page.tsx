"use client";

import * as React from "react";

/**
 * Print page now mirrors the server-generated PDF (the same one downloaded via
 * "Download PDF") so Print output matches the canonical PDF format exactly.
 * It loads /api/quotations/[id]/pdf in an iframe and triggers the browser's
 * print dialog automatically once the PDF is ready.
 */
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);
  const [printed, setPrinted] = React.useState(false);

  const pdfUrl = `/api/quotations/${id}/pdf`;

  const triggerPrint = React.useCallback(() => {
    const frame = iframeRef.current;
    if (!frame) return;
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      setPrinted(true);
    } catch {
      // Fallback: open the PDF in a new tab if the iframe blocks print.
      window.open(pdfUrl, "_blank");
    }
  }, [pdfUrl]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#1f2937" }}>
      <style>{`
        @media print {
          .toolbar { display: none !important; }
        }
      `}</style>
      <div
        className="toolbar"
        style={{
          display: "flex",
          gap: 8,
          padding: "10px 16px",
          background: "#0f172a",
          color: "#f8fafc",
          alignItems: "center",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
          fontSize: 13,
        }}
      >
        <strong style={{ marginRight: "auto" }}>Print Quotation</strong>
        <button
          onClick={triggerPrint}
          style={{
            background: "#2563eb",
            color: "#ffffff",
            border: 0,
            padding: "6px 14px",
            borderRadius: 6,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          {printed ? "Print Again" : "Print"}
        </button>
        <button
          onClick={() => window.open(pdfUrl, "_blank")}
          style={{
            background: "transparent",
            color: "#f8fafc",
            border: "1px solid #475569",
            padding: "6px 14px",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Download PDF
        </button>
        <button
          onClick={() => window.close()}
          style={{
            background: "transparent",
            color: "#f8fafc",
            border: "1px solid #475569",
            padding: "6px 14px",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Close
        </button>
      </div>
      <iframe
        ref={iframeRef}
        src={pdfUrl}
        title="Quotation PDF"
        style={{ flex: 1, width: "100%", border: 0, background: "#ffffff" }}
        onLoad={() => {
          // Auto-open print dialog once the PDF is rendered.
          // Small delay lets the embedded PDF viewer initialise before print().
          setTimeout(() => {
            if (!printed) triggerPrint();
          }, 400);
        }}
      />
    </div>
  );
}
