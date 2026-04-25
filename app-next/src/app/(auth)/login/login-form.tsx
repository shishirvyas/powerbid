"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

const DEMO = [
  { label: "Admin", email: "admin@powerbid.dev" },
  { label: "Sales", email: "sales@powerbid.dev" },
  { label: "Viewer", email: "viewer@powerbid.dev" },
];

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get("from") || "/dashboard";

  const [email, setEmail] = React.useState("admin@powerbid.dev");
  const [password, setPassword] = React.useState("demo1234");
  const [loading, setLoading] = React.useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Sign in failed");
      }
      toast.success("Welcome back!");
      router.push(from);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        Sign in
      </Button>

      <div className="pt-2 space-y-2">
        <div className="text-xs text-muted-foreground">Demo accounts</div>
        <div className="flex flex-wrap gap-2">
          {DEMO.map((d) => (
            <Button
              key={d.email}
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                setEmail(d.email);
                setPassword("demo1234");
              }}
            >
              {d.label}
            </Button>
          ))}
        </div>
        <div className="text-[11px] text-muted-foreground">
          Password for all demo accounts: <code>demo1234</code>
        </div>
      </div>
    </form>
  );
}
