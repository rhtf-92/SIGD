import type { ReactNode } from "react";
import { Link } from "react-router-dom";

interface PageHeaderProps {
  kicker?: string;
  title: string;
  description?: string;
  backTo?: string;
  backLabel?: string;
  action?: ReactNode;
}

export default function PageHeader({
  kicker,
  title,
  description,
  backTo,
  backLabel = "Volver al inicio",
  action,
}: PageHeaderProps) {
  return (
    <header className="card-sigd overflow-hidden">
      <span className="header-bar" aria-hidden="true" />
      <div className="flex flex-col gap-4 p-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          {backTo ? (
            <Link to={backTo} className="btn-secondary mb-4 w-fit">
              <span aria-hidden="true">←</span>
              {backLabel}
            </Link>
          ) : null}
          {kicker ? (
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-sigd-blue">{kicker}</p>
          ) : null}
          <h1 className="mt-2 text-2xl font-bold text-slate-900 md:text-3xl">{title}</h1>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm text-slate-600">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}
