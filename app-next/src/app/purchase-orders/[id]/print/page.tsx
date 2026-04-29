"use client";

import * as React from "react";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = React.use(params);
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);
  const [printed, setPrinted] = React.useState(false);

  const pdfUrl = `/api/purchase-orders/${id}/pdf`;

  const triggerPrint = React.useCallback(() => {
    const frame = iframeRef.current;
    if (!frame) return;
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      setPrinted(true);
    } catch {
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
        <strong style={{ marginRight: "auto" }}>Print Purchase Order</strong>
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
        title="Purchase Order PDF"
        style={{ flex: 1, width: "100%", border: 0, background: "#ffffff" }}
        onLoad={() => {
          setTimeout(() => {
            if (!printed) triggerPrint();
          }, 400);
        }}
      />
    </div>
  );
}
