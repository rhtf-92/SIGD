import { Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
  current?: boolean;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  showHome?: boolean;
  className?: string;
}

// Detector de UUID canónico (v1 a v7) para evitar exponer identificadores crudos
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sanitizarEtiqueta(label: string): string {
  if (UUID_REGEX.test(label.trim())) {
    return "Detalle";
  }
  return label;
}

export function Breadcrumbs({
  items,
  showHome = true,
  className = "",
}: BreadcrumbsProps) {
  return (
    <nav
      aria-label="Migas de pan"
      className={`flex items-center text-xs text-slate-500 overflow-x-auto py-1 ${className}`}
    >
      <ol className="flex items-center gap-1.5 whitespace-nowrap">
        {showHome && (
          <li className="flex items-center gap-1.5">
            <Link
              to="/"
              className="inline-flex items-center gap-1 text-slate-600 hover:text-suiza-primary transition font-medium"
              title="Inicio"
            >
              <Home className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only">Inicio</span>
            </Link>
            <ChevronRight className="h-3 w-3 text-slate-400 shrink-0" aria-hidden="true" />
          </li>
        )}

        {items.map((item, idx) => {
          const isLast = idx === items.length - 1 || item.current;
          const cleanLabel = sanitizarEtiqueta(item.label);

          return (
            <li key={idx} className="flex items-center gap-1.5">
              {isLast || !item.href ? (
                <span
                  className="font-bold text-slate-900 truncate max-w-[200px] sm:max-w-none"
                  aria-current={isLast ? "page" : undefined}
                >
                  {cleanLabel}
                </span>
              ) : (
                <Link
                  to={item.href}
                  className="text-slate-600 hover:text-suiza-primary transition font-medium truncate max-w-[150px] sm:max-w-none"
                >
                  {cleanLabel}
                </Link>
              )}

              {!isLast && (
                <ChevronRight className="h-3 w-3 text-slate-400 shrink-0" aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default Breadcrumbs;
