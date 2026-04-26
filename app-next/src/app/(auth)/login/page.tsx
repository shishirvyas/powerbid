import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";
import { BrandLogo } from "@/components/brand-logo";
import { APP_NAME } from "@/lib/branding";

export const metadata: Metadata = { title: `Sign in · ${APP_NAME}` };

export default function LoginPage() {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between p-10 bg-sidebar text-sidebar-foreground overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.25),transparent_60%)]" />
        <BrandLogo className="relative" invert compact />
        <div className="relative space-y-3 max-w-md">
          <h1 className="text-3xl font-semibold leading-tight">
            Enterprise quotations in LAN business format.
          </h1>
          <p className="text-sm text-sidebar-foreground/70">
            Build and track professional quotations, inquiries, and customer
            workflows in one unified industrial sales workspace.
          </p>
        </div>
        <div className="relative text-xs text-sidebar-foreground/50">
          © {new Date().getFullYear()} {APP_NAME}
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
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
