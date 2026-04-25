"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

export function Pagination({
  total,
  limit,
  offset,
  onPageChange,
  onLimitChange,
  pageSizes = [10, 25, 50, 100],
}: {
  total: number;
  limit: number;
  offset: number;
  onPageChange: (offset: number) => void;
  onLimitChange?: (limit: number) => void;
  pageSizes?: number[];
}) {
  if (total <= 0) return null;

  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, total);

  const goTo = (p: number) => {
    const clamped = Math.max(1, Math.min(totalPages, p));
    onPageChange((clamped - 1) * limit);
  };

  return (
    <div className="flex flex-col gap-2 border-t pt-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="text-muted-foreground">
        Showing <span className="tabular-nums font-medium text-foreground">{from}</span>–
        <span className="tabular-nums font-medium text-foreground">{to}</span> of{" "}
        <span className="tabular-nums font-medium text-foreground">{total}</span>
      </div>
      <div className="flex items-center gap-2">
        {onLimitChange ? (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">Rows</span>
            <Select
              value={String(limit)}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              className="h-8 w-[72px]"
            >
              {pageSizes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </div>
        ) : null}
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => goTo(1)}
            disabled={page <= 1}
            aria-label="First page"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => goTo(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2 tabular-nums text-xs text-muted-foreground">
            Page {page} / {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => goTo(page + 1)}
            disabled={page >= totalPages}
            aria-label="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => goTo(totalPages)}
            disabled={page >= totalPages}
            aria-label="Last page"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
