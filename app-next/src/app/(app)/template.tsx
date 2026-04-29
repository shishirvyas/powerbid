"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

export default function AppRouteTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="app-route-fade">
      {children}
    </div>
  );
}
