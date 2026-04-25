"use client";

import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * Reusable form field wrapper with built-in support for:
 *  - required marker (red asterisk)
 *  - inline error message under the control
 *  - aria-invalid on children automatically when error is present
 */
export function FormField({
  label,
  required,
  error,
  hint,
  children,
  className,
  htmlFor,
}: {
  label?: string;
  required?: boolean;
  error?: string | null;
  hint?: string;
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  const id = React.useId();
  const inputId = htmlFor ?? id;
  const errId = error ? `${inputId}-err` : undefined;

  // Inject aria-invalid + id into the first child input/select/textarea if it accepts them.
  const enhanced = React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) return child;
    const c = child as React.ReactElement<Record<string, unknown>>;
    return React.cloneElement(c, {
      id: (c.props.id as string | undefined) ?? inputId,
      "aria-invalid": error ? true : c.props["aria-invalid"],
      "aria-describedby": errId ?? (c.props["aria-describedby"] as string | undefined),
      className: cn(
        c.props.className as string | undefined,
        error
          ? "border-destructive focus-visible:ring-destructive"
          : undefined,
      ),
    });
  });

  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? (
        <Label
          htmlFor={inputId}
          className="text-xs uppercase tracking-wide text-muted-foreground"
        >
          {label}
          {required ? <RequiredStar /> : null}
        </Label>
      ) : null}
      {enhanced}
      {error ? (
        <p id={errId} className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function RequiredStar({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn("ml-0.5 text-destructive", className)}
      title="Required"
    >
      *
    </span>
  );
}

/* ------------------------ form-error helpers ------------------------- */

export type FieldErrors = Record<string, string | undefined>;

/** Flatten a Zod field-error map ({field: string[]}) to {field: string}. */
export function flattenZodFieldErrors(
  raw: Record<string, string[] | undefined> | undefined,
): FieldErrors {
  const out: FieldErrors = {};
  if (!raw) return out;
  for (const [k, v] of Object.entries(raw)) {
    if (Array.isArray(v) && v.length) out[k] = v[0];
  }
  return out;
}

/** Pull field errors from an ApiClientError-like object. */
export function getServerFieldErrors(err: unknown): FieldErrors {
  if (
    !err ||
    typeof err !== "object" ||
    !("data" in err) ||
    typeof (err as { data: unknown }).data !== "object" ||
    !(err as { data: unknown }).data
  ) {
    return {};
  }
  const data = (err as { data: { details?: { fieldErrors?: Record<string, string[] | undefined> } } }).data;
  return flattenZodFieldErrors(data?.details?.fieldErrors);
}

/**
 * Build a friendly toast message from a field-error map.
 * Returns null if nothing to say.
 */
export function summarizeFieldErrors(errors: FieldErrors, labelMap?: Record<string, string>): string | null {
  const entries = Object.entries(errors).filter(([, v]) => v);
  if (entries.length === 0) return null;
  const names = entries.map(([k]) => labelMap?.[k] ?? k);
  if (entries.length === 1) {
    const [k, v] = entries[0];
    return `${labelMap?.[k] ?? k}: ${v}`;
  }
  return `Please fix: ${names.join(", ")}`;
}

/** Hook for managing field errors with reset/set helpers. */
export function useFieldErrors() {
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const reset = React.useCallback(() => setErrors({}), []);
  const set = React.useCallback((next: FieldErrors) => setErrors(next), []);
  const setOne = React.useCallback(
    (k: string, v: string | undefined) =>
      setErrors((p) => ({ ...p, [k]: v })),
    [],
  );
  return { errors, reset, set, setOne, setErrors };
}
