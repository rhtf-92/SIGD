import { useNavigate } from "react-router-dom";

import AdminBreadcrumbs from "./AdminBreadcrumbs";

interface AdminPageHeaderProps {
  title: string;
  description: string;
}

export default function AdminPageHeader({
  title,
  description,
}: AdminPageHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="sigd-fade-in border-b border-cyan-400/25 bg-[rgba(15,23,42,0.62)] backdrop-blur-[12px]">
      <div className="mx-auto max-w-7xl px-6 py-5">
        <AdminBreadcrumbs />

        <button
          type="button"
          onClick={() => navigate("/")}
          className="mb-4 inline-flex items-center gap-2 rounded-lg border border-cyan-400/40 bg-slate-900/40 px-4 py-2 text-sm font-semibold text-slate-200 transition-all duration-300 ease-out hover:brightness-110 hover:border-cyan-400/50"
        >
          ← Volver al inicio
        </button>

        <p className="text-sm font-bold text-cyan-400">SIGD</p>
        <h1 className="text-2xl font-bold text-slate-100">{title}</h1>
        <p className="mt-1 text-sm text-slate-400">{description}</p>
      </div>
    </header>
  );
}