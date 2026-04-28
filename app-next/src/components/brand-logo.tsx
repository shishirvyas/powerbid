import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  compact?: boolean;
  invert?: boolean;
};

export function BrandLogo({ className, invert = false }: BrandLogoProps) {
  return (
    <div className={cn("flex items-center", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/lan-logo.svg"
        alt="LAN Engineering & Technologies"
        style={{ height: 36, width: "auto", filter: invert ? "brightness(0) invert(1)" : undefined }}
      />
    </div>
  );
}
