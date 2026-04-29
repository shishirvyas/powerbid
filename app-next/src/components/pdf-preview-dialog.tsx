"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Download, ExternalLink, Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogOverlay } from "@/components/ui/dialog";

interface PdfPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  /** Quotation (or other entity) number shown in the toolbar */
  label: string;
  /** Route that serves the PDF — e.g. /api/quotations/42/pdf */
  pdfRoute: string;
}

function useIsMobile() {
  const [mobile, setMobile] = React.useState(false);
  React.useEffect(() => {
    setMobile(/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent));
  }, []);
  return mobile;
}

export function PdfPreviewDialog({ open, onClose, label, pdfRoute }: PdfPreviewDialogProps) {
  const iframeRef = React.useRef<HTMLIFrameElement>(null);
  const inlineUrl = `${pdfRoute}?inline=1`;
  const isMobile = useIsMobile();

  function handlePrint() {
    try {
      iframeRef.current?.contentWindow?.focus();
      iframeRef.current?.contentWindow?.print();
    } catch {
      window.open(inlineUrl, "_blank");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogOverlay />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-50 flex flex-col -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-[92vw] h-[92vh] rounded-lg border bg-background shadow-xl overflow-hidden duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          {/* Toolbar */}
          <div className="flex items-center gap-2 px-4 py-2 bg-muted border-b shrink-0">
            <span className="text-sm font-semibold mr-auto truncate">{label}</span>

            {!isMobile && (
              <Button size="sm" variant="outline" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-1" />
                Print
              </Button>
            )}

            <Button size="sm" variant="outline" asChild>
              <a href={inlineUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4 mr-1" />
                Open
              </a>
            </Button>

            <Button size="sm" variant="outline" asChild>
              <a href={pdfRoute} download>
                <Download className="h-4 w-4 mr-1" />
                Download
              </a>
            </Button>

            <Button size="sm" variant="ghost" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* PDF Viewer — iframe works on desktop; mobile browsers open PDF natively via the Open button */}
          {isMobile ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6 text-center text-muted-foreground">
              <p className="text-sm">Mobile browsers cannot display PDFs inline.</p>
              <Button asChild>
                <a href={inlineUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open PDF
                </a>
              </Button>
            </div>
          ) : (
            <iframe
              ref={iframeRef}
              src={inlineUrl}
              title={`PDF Preview — ${label}`}
              className="flex-1 w-full border-0 bg-white"
            />
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </Dialog>
  );
}
