import { useState, type FormEvent } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { useAuth } from "../../lib/auth";

const DEMO_ACCOUNTS = [
  { label: "Admin",  email: "admin@powerbid.dev",  password: "demo1234" },
  { label: "Sales",  email: "sales@powerbid.dev",  password: "demo1234" },
  { label: "Viewer", email: "viewer@powerbid.dev", password: "demo1234" },
];

export function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const [email, setEmail] = useState("admin@powerbid.dev");
  const [password, setPassword] = useState("demo1234");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) return <Navigate to={from} replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="relative grid min-h-screen grid-cols-1 lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 p-12 text-white lg:flex lg:flex-col">
        <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -right-10 bottom-10 h-96 w-96 rounded-full bg-indigo-400/20 blur-3xl" />
        <div className="relative">
          <div className="text-2xl font-bold tracking-tight">PowerBid</div>
          <div className="mt-1 text-sm text-blue-100">Quotations. Inquiries. Pipeline.</div>
        </div>
        <div className="relative mt-auto space-y-6">
          <h1 className="text-4xl font-bold leading-tight tracking-tight animate-fade-in-up">
            Send beautiful quotations<br />in under a minute.
          </h1>
          <p className="max-w-md text-blue-100 animate-fade-in-up" style={{ animationDelay: "120ms" }}>
            Built for Indian electrical distributors and project shops — GST-aware, branded PDFs, customer pipeline,
            and automatic follow-ups.
          </p>
          <ul className="space-y-2 text-sm text-blue-100 animate-fade-in-up" style={{ animationDelay: "240ms" }}>
            <li>✓ Quotation cloning &amp; inquiry conversion</li>
            <li>✓ Multi-contact customers with notes timeline</li>
            <li>✓ Excel export, audit log, branded PDF</li>
          </ul>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center bg-slate-50 p-6">
        <div className="w-full max-w-sm space-y-6 animate-fade-in-up">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">Sign in</h2>
            <p className="mt-1 text-sm text-slate-500">Use a demo account or your own credentials.</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input mt-1"
                autoComplete="email"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Password</span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input mt-1"
                autoComplete="current-password"
              />
            </label>
            {error && (
              <div className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-700 ring-1 ring-red-200">
                {error}
              </div>
            )}
            <button type="submit" disabled={pending} className="btn-primary w-full">
              {pending ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="rounded-lg bg-white p-4 ring-1 ring-slate-200">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Demo accounts</p>
            <div className="mt-3 space-y-2">
              {DEMO_ACCOUNTS.map((a) => (
                <button
                  key={a.email}
                  type="button"
                  onClick={() => {
                    setEmail(a.email);
                    setPassword(a.password);
                  }}
                  className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition hover:bg-slate-50"
                >
                  <span className="font-medium text-slate-700">{a.label}</span>
                  <span className="font-mono text-xs text-slate-500">{a.email}</span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-400">Password: <span className="font-mono">demo1234</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
