import * as React from "react";
import { cn } from "@/lib/utils";

export function SectionShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={cn("min-h-0", className)}>{children}</section>;
}
