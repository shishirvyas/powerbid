import { Badge } from "@/components/ui/badge";

const QUOTATION_STATUS: Record<string, { label: string; variant: Parameters<typeof Badge>[0]["variant"] }> = {
  draft: { label: "Draft", variant: "muted" },
  sent: { label: "Sent", variant: "info" },
  won: { label: "Won", variant: "success" },
  lost: { label: "Lost", variant: "destructive" },
  expired: { label: "Expired", variant: "warning" },
  cancelled: { label: "Cancelled", variant: "secondary" },
};

const INQUIRY_STATUS: Record<string, { label: string; variant: Parameters<typeof Badge>[0]["variant"] }> = {
  new: { label: "New", variant: "info" },
  in_progress: { label: "In progress", variant: "warning" },
  quoted: { label: "Quoted", variant: "default" },
  won: { label: "Won", variant: "success" },
  lost: { label: "Lost", variant: "destructive" },
  closed: { label: "Closed", variant: "muted" },
};

const PRIORITY: Record<string, { label: string; variant: Parameters<typeof Badge>[0]["variant"] }> = {
  low: { label: "Low", variant: "muted" },
  medium: { label: "Medium", variant: "info" },
  high: { label: "High", variant: "warning" },
  urgent: { label: "Urgent", variant: "destructive" },
};

export function QuotationStatusBadge({ status }: { status: string }) {
  const cfg = QUOTATION_STATUS[status] ?? { label: status, variant: "secondary" };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

export function InquiryStatusBadge({ status }: { status: string }) {
  const cfg = INQUIRY_STATUS[status] ?? { label: status, variant: "secondary" };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  const cfg = PRIORITY[priority] ?? { label: priority, variant: "secondary" };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
