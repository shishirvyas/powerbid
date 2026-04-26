import { cn } from "@/lib/utils";
import { APP_NAME, COMPANY_NAME, COMPANY_TAGLINE } from "@/lib/branding";

type BrandLogoProps = {
  className?: string;
  compact?: boolean;
  invert?: boolean;
};

function Monogram({ invert = false }: { invert?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className="h-10 w-10 shrink-0">
      <defs>
        <linearGradient id="lan-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={invert ? "#f6e8be" : "#d6a83f"} />
          <stop offset="100%" stopColor={invert ? "#e0c97c" : "#b78318"} />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="14" fill="url(#lan-gold)" />
      <path
        d="M 16 33 A 16 16 0 1 1 34 49"
        fill="none"
        stroke={invert ? "#202020" : "#ffffff"}
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M 20 42 L 42 20"
        stroke={invert ? "#202020" : "#ffffff"}
        strokeWidth="6"
        strokeLinecap="round"
      />
      <circle cx="44" cy="44" r="6" fill={invert ? "#202020" : "#ffffff"} />
    </svg>
  );
}

export function BrandLogo({ className, compact = false, invert = false }: BrandLogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Monogram invert={invert} />
      <div className="leading-tight">
        <div className={cn("text-xl font-semibold tracking-tight", invert ? "text-white" : "text-foreground")}>
          {APP_NAME}
        </div>
        {!compact ? (
          <>
            <div className={cn("text-sm font-medium", invert ? "text-white/90" : "text-foreground")}>{COMPANY_NAME}</div>
            <div className={cn("text-[11px]", invert ? "text-white/75" : "text-muted-foreground")}>{COMPANY_TAGLINE}</div>
          </>
        ) : null}
      </div>
    </div>
  );
}
