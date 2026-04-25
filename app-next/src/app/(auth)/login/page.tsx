import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { Zap } from "lucide-react";

export const metadata: Metadata = { title: "Sign in · PowerBid" };

export default function LoginPage() {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between p-10 bg-sidebar text-sidebar-foreground overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.25),transparent_60%)]" />
        <div className="relative flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Zap className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold">PowerBid</span>
        </div>
        <div className="relative space-y-3 max-w-md">
          <h1 className="text-3xl font-semibold leading-tight">
            Quotations that close faster.
          </h1>
          <p className="text-sm text-sidebar-foreground/70">
            Manage inquiries, quotations and customers with a unified workspace
            built for India&apos;s industrial trade.
          </p>
        </div>
        <div className="relative text-xs text-sidebar-foreground/50">
          © {new Date().getFullYear()} PowerBid · Demo build
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
            <p className="text-sm text-muted-foreground">
              Sign in to your workspace to continue.
            </p>
          </div>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
