"use client";

import * as React from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export function TableSkeleton({
  cols,
  rows = 5,
  align,
}: {
  cols: number;
  rows?: number;
  /** Per-column text alignment hints, matches Table cells */
  align?: ("left" | "right" | "center")[];
}) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <TableRow key={r} className="animate-pulse">
          {Array.from({ length: cols }).map((__, c) => {
            const a = align?.[c] ?? "left";
            return (
              <TableCell key={c}>
                <div
                  className={cn(
                    "h-3 rounded bg-muted/70",
                    a === "right" && "ml-auto",
                    a === "center" && "mx-auto",
                    c === 0 ? "w-16" : c === cols - 1 ? "w-20" : "w-24",
                  )}
                  style={{ width: 40 + ((c * 19 + r * 7) % 60) }}
                />
              </TableCell>
            );
          })}
        </TableRow>
      ))}
    </>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "h-24 animate-pulse rounded-lg border bg-card/40 p-4",
        className,
      )}
    >
      <div className="h-3 w-24 rounded bg-muted/80" />
      <div className="mt-3 h-6 w-32 rounded bg-muted/80" />
    </div>
  );
}
