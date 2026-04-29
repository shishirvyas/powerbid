import * as React from "react";
import { SectionShell } from "@/components/section-shell";

export default function PurchaseOrdersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <SectionShell>{children}</SectionShell>;
}
