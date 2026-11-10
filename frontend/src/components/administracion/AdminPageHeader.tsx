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
    <header className="sigd-fade-in border-b border-[#d7e9f7] bg-white/90 backdrop-blur-[12px]">
      <div className="mx-auto max-w-7xl px-6 py-5">
        <AdminBreadcrumbs />

        <button
          type="button"
          onClick={() => navigate("/")}
          className="mb-4 inline-flex items-center gap-2 rounded-lg border border-[#bfe0f7] bg-white px-4 py-2 text-sm font-semibold text-[#0b2a4a] transition-all duration-300 ease-out hover:border-[#006ec7] hover:bg-[#e8f4ff]"
        >
          ← Volver al inicio
        </button>

        <p className="text-sm font-bold text-[#006ec7]">SIGD</p>
        <h1 className="text-2xl font-bold text-[#0b2a4a]">{title}</h1>
        <p className="mt-1 text-sm text-[#4b6b85]">{description}</p>
      </div>
    </header>
  );
}