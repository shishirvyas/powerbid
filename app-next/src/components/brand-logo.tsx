import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  compact?: boolean;
  invert?: boolean;
};

export function BrandLogo({ className, invert = false }: BrandLogoProps) {
  return (
    <div className={cn("flex shrink-0 items-center", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/lan-logo.png"
        alt="LAN Engineering & Technologies"
        className="block h-9 w-auto max-w-[140px] shrink-0 object-contain"
        style={{ height: 36, width: "auto", filter: invert ? "brightness(0) invert(1)" : undefined }}
      />
    </div>
  );
}
