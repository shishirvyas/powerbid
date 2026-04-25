import { Routes, Route, Link, NavLink } from "react-router-dom";
import { QuotationListPage } from "../pages/Quotations/QuotationListPage";
import { QuotationFormPage } from "../pages/Quotations/QuotationFormPage";
import { QuotationDetailPage } from "../pages/Quotations/QuotationDetailPage";
import DashboardPage from "../pages/Dashboard/DashboardPage";

const navClass = ({ isActive }: { isActive: boolean }) =>
  `text-sm transition ${isActive ? "text-blue-700 font-semibold" : "text-slate-600 hover:text-slate-900"}`;

export function App() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="container mx-auto flex items-center gap-6 px-4 py-3">
          <Link to="/" className="text-base font-bold tracking-tight text-blue-700">PowerBid</Link>
          <nav className="flex gap-5">
            <NavLink to="/" end className={navClass}>Dashboard</NavLink>
            <NavLink to="/quotations" className={navClass}>Quotations</NavLink>
            <NavLink to="/inquiries" className={navClass}>Inquiries</NavLink>
            <NavLink to="/customers" className={navClass}>Customers</NavLink>
            <NavLink to="/products" className={navClass}>Products</NavLink>
          </nav>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/quotations" element={<QuotationListPage />} />
          <Route path="/quotations/new" element={<QuotationFormPage />} />
          <Route path="/quotations/:id" element={<QuotationDetailPage />} />
          <Route path="/quotations/:id/edit" element={<QuotationFormPage />} />
          <Route path="/inquiries" element={<div className="text-slate-500">Inquiries (coming)</div>} />
          <Route path="/customers" element={<div className="text-slate-500">Customers (coming)</div>} />
          <Route path="/products" element={<div className="text-slate-500">Products (coming)</div>} />
        </Routes>
      </main>
    </div>
  );
}
