import { api } from "./api";

export interface DashboardKPIs {
  todayQuotations: number;
  todayValue: number;
  quotationsThisMonth: number;
  monthValue: number;
  draftPending: number;
  won: number;
  lost: number;
  winRate: number;
  activeCustomers: number;
  openInquiries: number;
  pipelineValue: number;
  monthRevenue: number;
}
export interface StatusBucket { status: string; n: number; total: number }
export interface TopProduct { name: string; qty: number; total: number }
export interface TopCustomer { id: number; name: string; quotations: number; total: number; won: number }
export interface LeaderboardEntry {
  id: number;
  name: string;
  email: string;
  quotations: number;
  total: number;
  won_value: number;
  won: number;
  lost: number;
}
export interface MonthPoint { month: string; quotations: number; total: number; wonValue: number }
export interface RecentQuotation {
  id: number;
  quotation_no: string;
  status: string;
  grand_total: number;
  updated_at: string;
  customer_name: string | null;
}

export interface DashboardPayload {
  kpis: DashboardKPIs;
  statusBreakdown: StatusBucket[];
  topProducts: TopProduct[];
  topCustomers: TopCustomer[];
  leaderboard: LeaderboardEntry[];
  monthlySeries: MonthPoint[];
  recent: RecentQuotation[];
}

export const dashboardApi = {
  get: () => api<DashboardPayload>("/api/dashboard"),
};
