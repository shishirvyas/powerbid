import { Routes, Route, Link } from "react-router-dom";

export function App() {
  return (
    <div className="min-h-screen">
      <header className="border-b bg-white">
        <div className="container mx-auto px-4 py-3 flex items-center gap-6">
          <Link to="/" className="font-semibold">PowerBid</Link>
          <nav className="flex gap-4 text-sm text-slate-600">
            <Link to="/inquiries">Inquiries</Link>
            <Link to="/quotations">Quotations</Link>
            <Link to="/masters">Masters</Link>
          </nav>
        </div>
      </header>
      <main className="container mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<div>Dashboard</div>} />
          <Route path="/inquiries" element={<div>Inquiries</div>} />
          <Route path="/quotations" element={<div>Quotations</div>} />
          <Route path="/masters" element={<div>Masters</div>} />
        </Routes>
      </main>
    </div>
  );
}
