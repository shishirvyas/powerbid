"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Award,
  BarChart3,
  Bell,
  Brain,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Database,
  FileText,
  Globe,
  Inbox,
  Layers,
  Lock,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Shield,
  Smartphone,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ─── Slide Metadata ────────────────────────────────────────────────────────────

interface Slide {
  id: number;
  title: string;
  subtitle: string;
  category: string;
}

const SLIDES: Slide[] = [
  { id: 1, title: "LAN Engineering", subtitle: "Transforming Operations Through Intelligent Automation", category: "Title" },
  { id: 2, title: "Business Challenges", subtitle: "Pain points costing businesses every day", category: "Problem" },
  { id: 3, title: "Our Solution", subtitle: "A complete intelligent business operations platform", category: "Solution" },
  { id: 4, title: "Executive Dashboard", subtitle: "Real-time visibility across your entire business", category: "Product" },
  { id: 5, title: "Automation", subtitle: "Let the system work, so your team doesn't have to", category: "Features" },
  { id: 6, title: "SLA Monitoring", subtitle: "Every promise tracked, every deadline met", category: "Operations" },
  { id: 7, title: "ROI & Benefits", subtitle: "Measurable impact from day one", category: "Business" },
  { id: 8, title: "Security", subtitle: "Enterprise-grade protection built in", category: "Security" },
  { id: 9, title: "Roadmap 2026", subtitle: "Innovation roadmap for the next 12 months", category: "Roadmap" },
  { id: 10, title: "Why Choose Us", subtitle: "The platform built for your success", category: "Close" },
];

// ─── Animated Counter ──────────────────────────────────────────────────────────

function useAnimatedCounter(target: number, duration = 1400) {
  const [value, setValue] = React.useState(0);
  React.useEffect(() => {
    let start: number | null = null;
    const step = (ts: number) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    const raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

function AnimatedNumber({ value, suffix = "", className }: { value: number; suffix?: string; className?: string }) {
  const display = useAnimatedCounter(value);
  return <span className={className}>{display}{suffix}</span>;
}

// ─── Slides ────────────────────────────────────────────────────────────────────

function Slide1({ dark }: { dark: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8 gap-8">
      <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-white font-black text-3xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-2xl ring-4 ring-indigo-400/20">
        P
      </div>
      <div>
        <h1 className={cn("text-6xl md:text-7xl font-black tracking-tight leading-none", dark ? "text-white" : "text-gray-900")}>
          LAN <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Engineering</span>
        </h1>
        <p className={cn("mt-5 text-xl md:text-2xl font-medium max-w-2xl mx-auto leading-relaxed", dark ? "text-gray-300" : "text-gray-600")}>
          Transforming Operations Through Intelligent Automation
        </p>
      </div>
      <div className="flex flex-wrap gap-2 justify-center">
        {["Inquiry Management", "Quotation Engine", "SLA Tracking", "Analytics Dashboard"].map(tag => (
          <span key={tag} className={cn("px-4 py-1.5 rounded-full text-sm font-medium", dark ? "bg-white/10 text-white/80 border border-white/10" : "bg-indigo-50 text-indigo-700 border border-indigo-200")}>
            {tag}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 justify-center mt-2">
        <Link href="/dashboard">
          <Button size="lg" className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-0 shadow-lg hover:opacity-90 transition-opacity">
            Open Dashboard <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
        <Link href="/inquiries">
          <Button size="lg" variant="outline" className={cn(dark ? "border-white/30 text-white hover:bg-white/10" : "")}>
            View Inquiries
          </Button>
        </Link>
      </div>
    </div>
  );
}

function Slide2({ dark }: { dark: boolean }) {
  const challenges = [
    { icon: Clock, text: "Manual follow-ups consuming hours daily" },
    { icon: FileText, text: "Delayed quotations losing business opportunities" },
    { icon: Inbox, text: "Missed inquiries due to no central tracking" },
    { icon: AlertTriangle, text: "No SLA accountability or deadline visibility" },
    { icon: BarChart3, text: "Poor reporting — no real-time business view" },
    { icon: Layers, text: "Fragmented systems, data scattered everywhere" },
    { icon: Clock, text: "Slow approvals blocking critical operations" },
  ];
  return (
    <div className="flex flex-col h-full px-8 py-6 gap-5">
      <div>
        <span className="text-red-400 text-xs font-bold uppercase tracking-widest">The Problem</span>
        <h2 className={cn("text-4xl font-black mt-1", dark ? "text-white" : "text-gray-900")}>Current Business Challenges</h2>
        <p className={cn("mt-1 text-base", dark ? "text-gray-400" : "text-gray-500")}>Pain points that cost businesses time, money, and clients every single day</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1 content-start">
        {challenges.map((c, i) => (
          <div key={i} className={cn("flex items-center gap-4 p-4 rounded-xl border transition-all", dark ? "bg-red-950/20 border-red-900/30 hover:bg-red-950/30" : "bg-red-50 border-red-100 hover:bg-red-100/80")}>
            <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", dark ? "bg-red-900/40" : "bg-red-100")}>
              <c.icon className="h-4 w-4 text-red-400" />
            </div>
            <p className={cn("text-sm font-medium", dark ? "text-gray-200" : "text-gray-700")}>{c.text}</p>
          </div>
        ))}
      </div>
      <div className={cn("p-4 rounded-xl border-l-4 border-red-500", dark ? "bg-red-950/20" : "bg-red-50")}>
        <p className={cn("text-sm font-semibold", dark ? "text-red-300" : "text-red-700")}>
          These issues compound daily — without a unified system, businesses lose visibility, clients, and revenue.
        </p>
      </div>
    </div>
  );
}

function Slide3({ dark }: { dark: boolean }) {
  const modules = [
    { icon: Inbox, label: "Inquiry Management", desc: "Capture & track all leads centrally", color: "from-blue-500 to-cyan-500" },
    { icon: FileText, label: "Quotation Engine", desc: "Professional quotes in minutes", color: "from-purple-500 to-violet-500" },
    { icon: Users, label: "Customer Onboarding", desc: "Structured client management", color: "from-emerald-500 to-teal-500" },
    { icon: BarChart3, label: "Dashboard Analytics", desc: "Real-time business insights", color: "from-orange-500 to-amber-500" },
    { icon: Clock, label: "SLA Tracker", desc: "Every deadline, monitored", color: "from-red-500 to-rose-500" },
    { icon: Shield, label: "Role Based Access", desc: "Granular permission control", color: "from-slate-500 to-gray-600" },
    { icon: Globe, label: "Multi Tenant Ready", desc: "Scale across organizations", color: "from-pink-500 to-fuchsia-500" },
    { icon: Bell, label: "Communication Hub", desc: "Email & WhatsApp alerts", color: "from-yellow-500 to-amber-500" },
  ];
  return (
    <div className="flex flex-col h-full px-8 py-6 gap-5">
      <div>
        <span className="text-emerald-400 text-xs font-bold uppercase tracking-widest">The Solution</span>
        <h2 className={cn("text-4xl font-black mt-1", dark ? "text-white" : "text-gray-900")}>One Platform. Complete Control.</h2>
        <p className={cn("mt-1 text-base", dark ? "text-gray-400" : "text-gray-500")}>Every module purpose-built for business operations excellence</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 flex-1 content-start">
        {modules.map((m, i) => (
          <div key={i} className={cn("flex flex-col gap-3 p-4 rounded-xl border transition-all hover:scale-[1.02] cursor-default", dark ? "bg-white/5 border-white/10 hover:bg-white/10" : "bg-white border-gray-200 hover:shadow-md")}>
            <div className={cn("w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center", m.color)}>
              <m.icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className={cn("text-sm font-bold", dark ? "text-white" : "text-gray-900")}>{m.label}</p>
              <p className={cn("text-xs mt-0.5 leading-relaxed", dark ? "text-gray-400" : "text-gray-500")}>{m.desc}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <Link href="/inquiries">
          <Button size="sm" variant="outline" className={cn(dark ? "border-white/20 text-white hover:bg-white/10" : "")}>
            Explore Modules <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

function Slide4({ dark }: { dark: boolean }) {
  const kpis = [
    { label: "Open Inquiries", value: 47, suffix: "", color: "from-blue-600 to-cyan-500", icon: Inbox },
    { label: "Deals Closed", value: 128, suffix: "+", color: "from-emerald-600 to-teal-500", icon: CheckCircle2 },
    { label: "Pending Quotes", value: 23, suffix: "", color: "from-orange-600 to-amber-500", icon: FileText },
    { label: "Revenue (Lakh)", value: 94, suffix: "L", color: "from-purple-600 to-violet-500", icon: TrendingUp },
  ];
  const months = ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
  const vals = [62, 78, 55, 88, 71, 94];
  const max = Math.max(...vals);
  const prevVals = [55, 65, 48, 74, 62, 80];
  return (
    <div className="flex flex-col h-full px-8 py-6 gap-4">
      <div>
        <span className="text-blue-400 text-xs font-bold uppercase tracking-widest">Live View</span>
        <h2 className={cn("text-4xl font-black mt-1", dark ? "text-white" : "text-gray-900")}>Executive Dashboard</h2>
        <p className={cn("mt-1 text-base", dark ? "text-gray-400" : "text-gray-500")}>Real-time visibility across your entire business</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map((k, i) => (
          <div key={i} className={cn("rounded-xl p-4 text-white bg-gradient-to-br shadow-lg", k.color)}>
            <k.icon className="h-5 w-5 opacity-70 mb-2" />
            <div className="text-3xl font-black"><AnimatedNumber value={k.value} suffix={k.suffix} /></div>
            <div className="text-xs opacity-75 mt-1 font-medium">{k.label}</div>
          </div>
        ))}
      </div>
      <div className={cn("flex-1 rounded-xl p-4 border", dark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200")}>
        <p className={cn("text-sm font-semibold mb-4", dark ? "text-gray-200" : "text-gray-800")}>Revenue Trend — Current vs Previous Period</p>
        <div className="flex items-end gap-3 h-24">
          {months.map((m, i) => (
            <div key={m} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex gap-0.5 items-end h-20">
                <div className="flex-1 rounded-t-sm bg-gradient-to-t from-blue-700 to-blue-400 transition-all opacity-50"
                  style={{ height: `${(prevVals[i] / max) * 100}%` }} />
                <div className="flex-1 rounded-t-sm bg-gradient-to-t from-blue-600 to-cyan-400 transition-all"
                  style={{ height: `${(vals[i] / max) * 100}%` }} />
              </div>
              <span className={cn("text-[10px]", dark ? "text-gray-400" : "text-gray-500")}>{m}</span>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-2">
          <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-3 h-2 rounded-sm bg-blue-400 opacity-50 inline-block" />Previous</span>
          <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-3 h-2 rounded-sm bg-cyan-400 inline-block" />Current</span>
        </div>
      </div>
      <Link href="/dashboard" className="self-start">
        <Button size="sm" className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white border-0 shadow-sm">
          Open Dashboard Demo <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      </Link>
    </div>
  );
}

function Slide5({ dark }: { dark: boolean }) {
  const features = [
    { icon: Bell, title: "Auto Reminders", desc: "Scheduled follow-up reminders with smart contextual triggers — no manual tracking needed", color: "bg-violet-500" },
    { icon: AlertTriangle, title: "Escalation Engine", desc: "Auto-escalate overdue items to supervisors with configurable SLA breach thresholds", color: "bg-red-500" },
    { icon: Zap, title: "Smart Alerts", desc: "Real-time push notifications for critical business events and deadline breaches", color: "bg-yellow-500" },
    { icon: Globe, title: "Email / WhatsApp", desc: "Multi-channel communication integration for customers and internal teams", color: "bg-green-500" },
    { icon: Users, title: "Task Assignment", desc: "Route tasks automatically to the right team member based on rules and availability", color: "bg-blue-500" },
    { icon: CheckCircle2, title: "Approval Workflow", desc: "Structured multi-level approval chains with full audit trail and timestamps", color: "bg-emerald-500" },
  ];
  return (
    <div className="flex flex-col h-full px-8 py-6 gap-5">
      <div>
        <span className="text-violet-400 text-xs font-bold uppercase tracking-widest">Automation</span>
        <h2 className={cn("text-4xl font-black mt-1", dark ? "text-white" : "text-gray-900")}>Intelligent Automation</h2>
        <p className={cn("mt-1 text-base", dark ? "text-gray-400" : "text-gray-500")}>Eliminate manual effort — let the platform handle the repetitive work</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1 content-start">
        {features.map((f, i) => (
          <div key={i} className={cn("flex gap-4 p-4 rounded-xl border transition-all hover:scale-[1.01]", dark ? "bg-white/5 border-white/10 hover:bg-white/10" : "bg-white border-gray-200 shadow-sm hover:shadow-md")}>
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0", f.color)}>
              <f.icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className={cn("font-bold text-sm", dark ? "text-white" : "text-gray-900")}>{f.title}</p>
              <p className={cn("text-xs mt-0.5 leading-relaxed", dark ? "text-gray-400" : "text-gray-500")}>{f.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Slide6({ dark }: { dark: boolean }) {
  const statuses = [
    { label: "Open", count: 12, color: "bg-blue-500", pct: 24 },
    { label: "In Progress", count: 18, color: "bg-yellow-500", pct: 36 },
    { label: "Delayed", count: 7, color: "bg-red-500", pct: 14 },
    { label: "Closed", count: 10, color: "bg-green-500", pct: 20 },
    { label: "Escalated", count: 3, color: "bg-purple-500", pct: 6 },
  ];
  const aging = [
    { label: "0–3 days", pct: 45, color: "from-green-500 to-emerald-400", desc: "Healthy" },
    { label: "4–7 days", pct: 30, color: "from-yellow-500 to-amber-400", desc: "Watch" },
    { label: "8–14 days", pct: 15, color: "from-orange-500 to-red-400", desc: "At Risk" },
    { label: "15+ days", pct: 10, color: "from-red-600 to-red-700", desc: "Critical" },
  ];
  return (
    <div className="flex flex-col h-full px-8 py-6 gap-5">
      <div>
        <span className="text-amber-400 text-xs font-bold uppercase tracking-widest">SLA</span>
        <h2 className={cn("text-4xl font-black mt-1", dark ? "text-white" : "text-gray-900")}>SLA Monitoring</h2>
        <p className={cn("mt-1 text-base", dark ? "text-gray-400" : "text-gray-500")}>Every promise tracked — every deadline measured and enforced</p>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {statuses.map((s, i) => (
          <div key={i} className={cn("flex flex-col items-center p-3 rounded-xl border", dark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200")}>
            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-sm mb-2 shadow-lg", s.color)}>
              {s.count}
            </div>
            <p className={cn("text-xs font-semibold text-center", dark ? "text-gray-300" : "text-gray-700")}>{s.label}</p>
            <p className={cn("text-[10px] mt-0.5", dark ? "text-gray-500" : "text-gray-400")}>{s.pct}%</p>
          </div>
        ))}
      </div>
      <div className={cn("flex-1 rounded-xl p-5 border", dark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200")}>
        <p className={cn("text-sm font-semibold mb-4", dark ? "text-gray-200" : "text-gray-800")}>Inquiry Aging Heatmap</p>
        <div className="flex flex-col gap-4">
          {aging.map((a, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className={cn("text-xs w-20 shrink-0 font-medium", dark ? "text-gray-300" : "text-gray-700")}>{a.label}</span>
              <div className={cn("flex-1 rounded-full h-4 overflow-hidden", dark ? "bg-white/10" : "bg-gray-200")}>
                <div className={cn("h-full rounded-full bg-gradient-to-r", a.color)} style={{ width: `${a.pct}%` }} />
              </div>
              <span className={cn("text-xs w-16 text-right font-medium", dark ? "text-gray-400" : "text-gray-600")}>{a.pct}% · {a.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Slide7({ dark }: { dark: boolean }) {
  const metrics = [
    { label: "Faster Response Time", value: 68, suffix: "%", icon: Zap, color: "from-blue-500 to-cyan-500" },
    { label: "Higher Conversion Rate", value: 42, suffix: "%", icon: TrendingUp, color: "from-green-500 to-emerald-500" },
    { label: "Reduced Revenue Leakage", value: 35, suffix: "%", icon: Target, color: "from-purple-500 to-violet-500" },
    { label: "Better Accountability", value: 90, suffix: "%", icon: Award, color: "from-orange-500 to-amber-500" },
    { label: "Real-time Visibility", value: 100, suffix: "%", icon: BarChart3, color: "from-pink-500 to-rose-500" },
    { label: "Business Growth Multiplier", value: 3, suffix: "x", icon: Star, color: "from-indigo-500 to-blue-500" },
  ];
  return (
    <div className="flex flex-col h-full px-8 py-6 gap-5">
      <div>
        <span className="text-green-400 text-xs font-bold uppercase tracking-widest">Results</span>
        <h2 className={cn("text-4xl font-black mt-1", dark ? "text-white" : "text-gray-900")}>ROI & Measurable Impact</h2>
        <p className={cn("mt-1 text-base", dark ? "text-gray-400" : "text-gray-500")}>Quantified, proven results from day one of deployment</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 flex-1 content-start">
        {metrics.map((m, i) => (
          <div key={i} className={cn("flex flex-col items-center justify-center p-6 rounded-xl text-white bg-gradient-to-br shadow-lg", m.color)}>
            <m.icon className="h-6 w-6 opacity-80 mb-2" />
            <div className="text-4xl font-black">
              <AnimatedNumber value={m.value} suffix={m.suffix} />
            </div>
            <p className="text-xs text-white/75 mt-2 text-center font-medium leading-tight">{m.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Slide8({ dark }: { dark: boolean }) {
  const items = [
    { icon: Lock, title: "Role Based Access", desc: "Granular user permissions — each team member sees only what they need", color: "bg-slate-600" },
    { icon: Database, title: "Audit Logs", desc: "Complete immutable activity trail for compliance and governance", color: "bg-gray-700" },
    { icon: Globe, title: "Tenant Isolation", desc: "Complete data separation between organizations — zero bleed-through", color: "bg-zinc-600" },
    { icon: Database, title: "Automated Backups", desc: "Scheduled backups with point-in-time restore capability", color: "bg-neutral-600" },
    { icon: Shield, title: "Secure Authentication", desc: "Hashed credentials, session management, brute-force protection", color: "bg-stone-600" },
    { icon: CheckCircle2, title: "Compliance Ready", desc: "Built to meet enterprise governance and audit standards", color: "bg-slate-700" },
  ];
  return (
    <div className="flex flex-col h-full px-8 py-6 gap-5">
      <div>
        <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">Enterprise</span>
        <h2 className={cn("text-4xl font-black mt-1", dark ? "text-white" : "text-gray-900")}>Security & Governance</h2>
        <p className={cn("mt-1 text-base", dark ? "text-gray-400" : "text-gray-500")}>Enterprise-grade protection built in from the ground up</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1 content-start">
        {items.map((it, i) => (
          <div key={i} className={cn("flex gap-4 p-4 rounded-xl border", dark ? "bg-white/5 border-white/10 hover:bg-white/10" : "bg-white border-gray-200 shadow-sm hover:shadow-md")}>
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0", it.color)}>
              <it.icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className={cn("font-bold text-sm", dark ? "text-white" : "text-gray-900")}>{it.title}</p>
              <p className={cn("text-xs mt-0.5 leading-relaxed", dark ? "text-gray-400" : "text-gray-500")}>{it.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Slide9({ dark }: { dark: boolean }) {
  const quarters = [
    { q: "Q1 2026", items: ["AI-powered recommendations", "Advanced analytics BI module"], color: "border-indigo-500" },
    { q: "Q2 2026", items: ["Voice assistant integration", "Predictive sales pipeline scoring"], color: "border-purple-500" },
    { q: "Q3 2026", items: ["Mobile app — iOS & Android", "ERP system integrations"], color: "border-pink-500" },
    { q: "Q4 2026", items: ["Full BI analytics suite", "White-label & partner tier"], color: "border-fuchsia-500" },
  ];
  const future = [
    { icon: Brain, label: "AI Recommendations" },
    { icon: Sparkles, label: "Voice Assistant" },
    { icon: TrendingUp, label: "Predictive Sales" },
    { icon: Smartphone, label: "Mobile App" },
    { icon: Layers, label: "ERP Integrations" },
    { icon: BarChart3, label: "BI Analytics" },
  ];
  return (
    <div className="flex flex-col h-full px-8 py-6 gap-5">
      <div>
        <span className="text-fuchsia-400 text-xs font-bold uppercase tracking-widest">Roadmap</span>
        <h2 className={cn("text-4xl font-black mt-1", dark ? "text-white" : "text-gray-900")}>Future Roadmap 2026</h2>
        <p className={cn("mt-1 text-base", dark ? "text-gray-400" : "text-gray-500")}>Bold innovation planned for the next 12 months</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {quarters.map((q, i) => (
          <div key={i} className={cn("p-4 rounded-xl border-l-4 border", q.color, dark ? "bg-white/5 border-white/10" : "bg-white border-gray-100 shadow-sm")}>
            <p className={cn("text-xs font-bold uppercase tracking-wide mb-2", dark ? "text-gray-200" : "text-gray-900")}>{q.q}</p>
            {q.items.map((it, j) => (
              <p key={j} className={cn("text-xs flex items-start gap-1 mt-1.5", dark ? "text-gray-400" : "text-gray-600")}>
                <span className="mt-0.5 text-fuchsia-400 font-bold">▸</span>{it}
              </p>
            ))}
          </div>
        ))}
      </div>
      <div className={cn("flex-1 flex flex-col justify-center rounded-xl border p-5", dark ? "bg-white/5 border-white/10" : "bg-gray-50 border-gray-200")}>
        <p className={cn("text-xs font-semibold uppercase tracking-widest mb-4", dark ? "text-gray-400" : "text-gray-500")}>Upcoming Capabilities</p>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
          {future.map((f, i) => (
            <div key={i} className={cn("flex flex-col items-center gap-2 p-3 rounded-xl border", dark ? "bg-white/5 border-white/10" : "bg-white border-gray-200")}>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-500 flex items-center justify-center shadow-md">
                <f.icon className="h-5 w-5 text-white" />
              </div>
              <p className={cn("text-[11px] font-medium text-center leading-tight", dark ? "text-gray-300" : "text-gray-700")}>{f.label}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Slide10({ dark }: { dark: boolean }) {
  const reasons = [
    { icon: CheckCircle2, title: "Highly Customizable", desc: "Adapts to your exact workflows", color: "bg-indigo-500" },
    { icon: Zap, title: "Fast Deployment", desc: "Go live in days, not months", color: "bg-blue-500" },
    { icon: Shield, title: "Enterprise Ready", desc: "Security, scale & compliance built in", color: "bg-purple-500" },
    { icon: Star, title: "Affordable", desc: "Best value per feature on the market", color: "bg-emerald-500" },
    { icon: Sparkles, title: "Modern UI/UX", desc: "Loved by teams that use it daily", color: "bg-pink-500" },
    { icon: Globe, title: "Scalable Globally", desc: "Multi-tenant, multi-currency ready", color: "bg-orange-500" },
  ];
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 gap-6">
      <div className="text-center">
        <span className="text-indigo-400 text-xs font-bold uppercase tracking-widest">The Decision</span>
        <h2 className={cn("text-5xl font-black mt-2 leading-tight", dark ? "text-white" : "text-gray-900")}>Why Choose LAN Engineering?</h2>
        <p className={cn("mt-3 text-lg", dark ? "text-gray-300" : "text-gray-600")}>The platform built for your success</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 w-full max-w-3xl">
        {reasons.map((r, i) => (
          <div key={i} className={cn("flex flex-col items-center text-center gap-3 p-5 rounded-xl border transition-all hover:scale-[1.02]", dark ? "bg-white/5 border-white/10 hover:bg-white/10" : "bg-white border-gray-200 shadow-sm hover:shadow-md")}>
            <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shadow-lg", r.color)}>
              <r.icon className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className={cn("font-bold text-sm", dark ? "text-white" : "text-gray-900")}>{r.title}</p>
              <p className={cn("text-xs mt-1", dark ? "text-gray-400" : "text-gray-500")}>{r.desc}</p>
            </div>
          </div>
        ))}
      </div>
      <div className={cn("w-full max-w-3xl px-8 py-6 rounded-2xl border text-center", dark ? "bg-gradient-to-r from-indigo-900/50 to-purple-900/50 border-indigo-500/30" : "bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200")}>
        <p className={cn("text-2xl font-black", dark ? "text-white" : "text-gray-900")}>Ready for Rollout</p>
        <p className={cn("text-sm mt-1", dark ? "text-gray-400" : "text-gray-600")}>Let's build the future of your business operations together.</p>
        <div className="flex justify-center gap-3 mt-4">
          <Link href="/dashboard">
            <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-0 shadow-lg">
              Start Demo <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
          <Link href="/quotations">
            <Button variant="outline" className={cn(dark ? "border-white/30 text-white hover:bg-white/10" : "")}>
              View Quotations
            </Button>
          </Link>
          <Link href="/inquiries">
            <Button variant="outline" className={cn(dark ? "border-white/30 text-white hover:bg-white/10" : "")}>
              View Inquiries
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Slide Renderer ────────────────────────────────────────────────────────────

function SlideContent({ index, dark }: { index: number; dark: boolean }) {
  switch (index) {
    case 0: return <Slide1 dark={dark} />;
    case 1: return <Slide2 dark={dark} />;
    case 2: return <Slide3 dark={dark} />;
    case 3: return <Slide4 dark={dark} />;
    case 4: return <Slide5 dark={dark} />;
    case 5: return <Slide6 dark={dark} />;
    case 6: return <Slide7 dark={dark} />;
    case 7: return <Slide8 dark={dark} />;
    case 8: return <Slide9 dark={dark} />;
    case 9: return <Slide10 dark={dark} />;
    default: return null;
  }
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function ShowcaseClient() {
  const [currentSlide, setCurrentSlide] = React.useState(0);
  const [dark, setDark] = React.useState(true);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const [slideVisible, setSlideVisible] = React.useState(true);
  const [autoPlay, setAutoPlay] = React.useState(false);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const currentSlideRef = React.useRef(currentSlide);
  currentSlideRef.current = currentSlide;

  const totalSlides = SLIDES.length;

  const goToSlide = React.useCallback(
    (index: number) => {
      if (index < 0 || index >= totalSlides) return;
      setSlideVisible(false);
      setTimeout(() => {
        setCurrentSlide(index);
        setSlideVisible(true);
      }, 180);
    },
    [totalSlides],
  );

  // Keyboard navigation
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const cur = currentSlideRef.current;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") goToSlide(cur + 1);
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") goToSlide(cur - 1);
      else if (e.key === "Escape" && document.fullscreenElement) document.exitFullscreen();
      else if (e.key === "f" || e.key === "F") toggleFullscreen();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goToSlide]);

  // Auto-play
  React.useEffect(() => {
    if (!autoPlay) return;
    const timer = setInterval(() => {
      const next = currentSlideRef.current + 1;
      if (next >= totalSlides) {
        setAutoPlay(false);
        return;
      }
      goToSlide(next);
    }, 5000);
    return () => clearInterval(timer);
  }, [autoPlay, totalSlides, goToSlide]);

  // Fullscreen sync
  React.useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen();
    }
  };

  const slide = SLIDES[currentSlide];
  const progress = ((currentSlide + 1) / totalSlides) * 100;

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col overflow-hidden",
        isFullscreen ? "h-screen w-screen fixed inset-0 z-50" : "h-[calc(100vh-0px)]",
        dark ? "bg-gray-950 text-white" : "bg-gray-50 text-gray-900",
      )}
    >
      {/* ── Top Bar ─────────────────────────────────────────── */}
      <div className={cn("flex items-center justify-between px-4 h-12 border-b shrink-0 gap-3", dark ? "bg-gray-900/80 border-white/10 backdrop-blur-sm" : "bg-white border-gray-200")}>
        {/* Left */}
        <div className="flex items-center gap-3 min-w-0">
          <div className={cn("w-6 h-6 rounded flex items-center justify-center text-white text-xs font-black bg-gradient-to-br from-indigo-500 to-purple-600 shrink-0")}>P</div>
          <span className={cn("text-sm font-bold truncate", dark ? "text-white" : "text-gray-900")}>Executive Showcase</span>
          <span className={cn("text-xs px-2 py-0.5 rounded-full shrink-0", dark ? "bg-white/10 text-gray-300" : "bg-gray-100 text-gray-600")}>
            {slide.category}
          </span>
        </div>
        {/* Center — slide title */}
        <span className={cn("text-xs font-medium truncate hidden md:block", dark ? "text-gray-400" : "text-gray-500")}>
          {slide.title}
        </span>
        {/* Right */}
        <div className="flex items-center gap-1 shrink-0">
          <span className={cn("text-xs mr-2", dark ? "text-gray-400" : "text-gray-500")}>
            {currentSlide + 1}/{totalSlides}
          </span>
          <Button
            size="sm"
            variant="ghost"
            title={autoPlay ? "Pause auto-play" : "Start auto-play (5s/slide)"}
            onClick={() => setAutoPlay(!autoPlay)}
            className={cn("h-7 w-7 p-0", dark ? "text-gray-300 hover:text-white hover:bg-white/10" : "")}
          >
            {autoPlay ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            title="Toggle theme"
            onClick={() => setDark(!dark)}
            className={cn("h-7 w-7 p-0 text-sm", dark ? "text-gray-300 hover:text-white hover:bg-white/10" : "")}
          >
            {dark ? "☀" : "🌙"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            title={isFullscreen ? "Exit fullscreen (Esc)" : "Enter fullscreen (F)"}
            onClick={toggleFullscreen}
            className={cn("h-7 w-7 p-0", dark ? "text-gray-300 hover:text-white hover:bg-white/10" : "")}
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>

      {/* ── Progress Bar ─────────────────────────────────────── */}
      <div className={cn("h-0.5 shrink-0", dark ? "bg-white/10" : "bg-gray-200")}>
        <div
          className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* ── Body ─────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Slide Thumbnails Sidebar */}
        <div className={cn("hidden md:flex flex-col w-44 border-r shrink-0 overflow-y-auto", dark ? "bg-gray-900/60 border-white/10" : "bg-white border-gray-200")}>
          <div className={cn("px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest", dark ? "text-gray-500" : "text-gray-400")}>
            Slides
          </div>
          {SLIDES.map((s, i) => (
            <button
              key={s.id}
              onClick={() => goToSlide(i)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-left text-xs transition-all border-r-2",
                i === currentSlide
                  ? dark
                    ? "bg-indigo-600/25 text-white border-indigo-400"
                    : "bg-indigo-50 text-indigo-700 border-indigo-500"
                  : dark
                    ? "text-gray-400 hover:bg-white/5 hover:text-gray-200 border-transparent"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-800 border-transparent",
              )}
            >
              <span
                className={cn(
                  "w-5 h-5 rounded flex items-center justify-center shrink-0 text-[10px] font-bold",
                  i === currentSlide
                    ? "bg-indigo-500 text-white"
                    : dark
                      ? "bg-white/10 text-gray-500"
                      : "bg-gray-100 text-gray-500",
                )}
              >
                {i + 1}
              </span>
              <span className="truncate leading-tight">{s.title}</span>
            </button>
          ))}
        </div>

        {/* Main Slide Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Slide Content */}
          <div
            key={currentSlide}
            className="flex-1 overflow-y-auto"
            style={{
              opacity: slideVisible ? 1 : 0,
              transform: slideVisible ? "translateY(0)" : "translateY(10px)",
              transition: "opacity 220ms ease, transform 220ms ease",
            }}
          >
            <SlideContent index={currentSlide} dark={dark} />
          </div>

          {/* Navigation Footer */}
          <div className={cn("flex items-center justify-between px-6 py-2.5 border-t shrink-0", dark ? "bg-gray-900/60 border-white/10" : "bg-white border-gray-200")}>
            <Button
              onClick={() => goToSlide(currentSlide - 1)}
              disabled={currentSlide === 0}
              variant="outline"
              size="sm"
              className={cn("h-8", dark ? "border-white/20 text-white hover:bg-white/10 disabled:opacity-20" : "disabled:opacity-30")}
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Previous
            </Button>

            {/* Dot indicators */}
            <div className="flex gap-1.5 items-center">
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => goToSlide(i)}
                  className={cn(
                    "rounded-full transition-all duration-300",
                    i === currentSlide
                      ? "w-6 h-1.5 bg-indigo-500"
                      : dark
                        ? "w-1.5 h-1.5 bg-white/20 hover:bg-white/40"
                        : "w-1.5 h-1.5 bg-gray-300 hover:bg-gray-500",
                  )}
                />
              ))}
            </div>

            <Button
              onClick={() => goToSlide(currentSlide + 1)}
              disabled={currentSlide === totalSlides - 1}
              size="sm"
              className={cn("h-8 bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-0 disabled:opacity-30")}
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>

      {/* Keyboard hint */}
      <div className={cn("text-center text-[10px] py-1 shrink-0", dark ? "text-gray-700" : "text-gray-300")}>
        ← → Arrow keys to navigate · F for fullscreen · Esc to exit
      </div>
    </div>
  );
}
