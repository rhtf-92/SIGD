import { useNavigate, useLocation } from "react-router-dom";

import AdminBreadcrumbs from "./AdminBreadcrumbs";

interface AdminPageHeaderProps {
  title: string;
  description: string;
  backTo?: string;
  backLabel?: string;
}

export default function AdminPageHeader({
  title,
  description,
  backTo,
  backLabel = "← Volver",
}: AdminPageHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleVolver = () => {
    if (backTo) {
      navigate(backTo);
      return;
    }
    // Si estamos en un submódulo de administración (/administracion/xxx), regresar al hub
    if (
      location.pathname.startsWith("/administracion/") &&
      location.pathname !== "/administracion"
    ) {
      navigate("/administracion");
      return;
    }
    // Si hay historial de navegación previo dentro de la app
    if (typeof window !== "undefined" && window.history.length > 1 && window.history.state?.idx > 0) {
      navigate(-1);
      return;
    }
    // Fallback seguro a Inicio
    navigate("/");
  };

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-6 py-5">
        <AdminBreadcrumbs />

        <button
          type="button"
          onClick={handleVolver}
          className="mb-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          {backLabel}
        </button>

        <p className="text-sm font-bold text-blue-700">SIGD</p>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
    </header>
  );
}
