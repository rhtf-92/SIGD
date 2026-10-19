import { ArrowLeft } from "lucide-react";
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
    <header className="relative border-b border-sigd-line bg-white">
      <span className="absolute inset-x-0 top-0 h-1 bg-sigd-blue" aria-hidden="true" />

      <div className="mx-auto max-w-7xl px-6 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <AdminBreadcrumbs />

          <button
            type="button"
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-sigd-line-strong bg-white px-3 py-1.5 text-sm font-semibold text-sigd-muted transition hover:border-sigd-blue hover:bg-sigd-surface hover:text-sigd-blue-deep focus-ring"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Volver al inicio
          </button>
        </div>

        <p className="mt-5 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-sigd-blue">
          <span className="h-2 w-2 rounded-full bg-sigd-yellow" aria-hidden="true" />
          SIGD
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-sigd-text md:text-3xl">
          {title}
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-sigd-muted">{description}</p>
      </div>
    </header>
  );
}
