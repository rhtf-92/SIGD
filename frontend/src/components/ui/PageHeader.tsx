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
    <header className="card-sigd overflow-hidden bg-[linear-gradient(135deg,#ffffff_0%,#f6f8fb_100%)]">
      <span className="header-bar" aria-hidden="true" />
      <div className="flex flex-col gap-4 p-4 md:flex-row md:items-end md:justify-between md:p-5">
        <div className="min-w-0">
          {backTo ? (
            <Link to={backTo} className="btn-secondary mb-4 w-fit">
              <span aria-hidden="true">←</span>
              {backLabel}
            </Link>
          ) : null}
          {kicker ? (
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-sigd-blue-dark">
              <span className="h-2 w-2 rounded-full bg-sigd-yellow" aria-hidden="true" />
              {kicker}
            </p>
          ) : null}
          <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-sigd-text md:text-3xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-sigd-muted">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}
