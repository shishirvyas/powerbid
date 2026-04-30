"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type TypeaheadOption = {
  value: string;
  label: string;
  secondary?: string;
};

export function Typeahead({
  value,
  inputValue,
  onInputValueChange,
  onSelect,
  options,
  placeholder,
  className,
  disabled,
}: {
  value: string;
  inputValue: string;
  onInputValueChange: (value: string) => void;
  onSelect: (option: TypeaheadOption) => void;
  options: TypeaheadOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const rootRef = React.useRef<HTMLDivElement | null>(null);

  const filtered = React.useMemo(() => {
    const q = inputValue.trim().toLowerCase();
    if (!q) return options.slice(0, 12);
    return options
      .filter((o) => o.label.toLowerCase().includes(q) || (o.secondary ?? "").toLowerCase().includes(q))
      .slice(0, 12);
  }, [inputValue, options]);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [inputValue]);

  React.useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  function pick(option: TypeaheadOption) {
    onSelect(option);
    setOpen(false);
  }

  return (
    <div
      ref={rootRef}
      className={cn("relative", open ? "z-[120]" : "z-0", className)}
    >
      <input
        value={inputValue}
        onChange={(e) => {
          onInputValueChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            setOpen(true);
            return;
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((i) => Math.min(filtered.length - 1, i + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((i) => Math.max(0, i - 1));
          } else if (e.key === "Enter") {
            if (open && filtered[activeIndex]) {
              e.preventDefault();
              pick(filtered[activeIndex]);
            }
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        autoComplete="off"
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
          "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2",
          "focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        )}
        disabled={disabled}
        data-selected-value={value}
      />
      {open ? (
        <div className="absolute z-[130] mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover text-popover-foreground p-1 shadow-md ring-1 ring-border/60">
          {filtered.length > 0 ? (
            filtered.map((option, idx) => {
              const active = idx === activeIndex;
              return (
                <button
                  key={option.value}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pick(option);
                  }}
                  onMouseEnter={() => setActiveIndex(idx)}
                  className={cn(
                    "flex w-full items-start justify-between rounded bg-popover px-2 py-1.5 text-left text-sm",
                    active ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
                  )}
                >
                  <span className="truncate">{option.label}</span>
                  {option.secondary ? (
                    <span className="ml-2 shrink-0 text-xs text-muted-foreground">{option.secondary}</span>
                  ) : null}
                </button>
              );
            })
          ) : (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">No matching data found</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
