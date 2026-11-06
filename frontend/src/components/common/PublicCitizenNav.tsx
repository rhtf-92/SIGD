import { Link, useLocation } from "react-router-dom";
import { Send, Search, ShieldCheck, UserCheck } from "lucide-react";

export interface PublicCitizenNavProps {
  currentPath?: string;
  className?: string;
}

export interface CitizenModuleItem {
  to: string;
  aliases: string[];
  label: string;
  shortLabel: string;
  icon: typeof Send;
  badge?: string;
}

export const CITIZEN_PUBLIC_MODULES: CitizenModuleItem[] = [
  {
    to: "/tramite",
    aliases: ["/tramite", "/tramite/mesa-partes-virtual", "/mesa-partes"],
    label: "Mesa de Partes Virtual",
    shortLabel: "Mesa de Partes",
    icon: Send,
    badge: "24x7",
  },
  {
    to: "/consulta",
    aliases: ["/consulta"],
    label: "Consulta Pública CUT",
    shortLabel: "Consulta CUT",
    icon: Search,
  },
  {
    to: "/validador-cvd",
    aliases: ["/validador-cvd", "/validador"],
    label: "Validador CVD / QR",
    shortLabel: "Validador CVD",
    icon: ShieldCheck,
  },
  {
    to: "/registro",
    aliases: ["/registro"],
    label: "Registro de Administrados",
    shortLabel: "Registro",
    icon: UserCheck,
  },
];

export default function PublicCitizenNav({
  currentPath,
  className = "",
}: PublicCitizenNavProps) {
  const location = useLocation();
  const activePath = currentPath ?? location.pathname;

  const isItemActive = (item: CitizenModuleItem): boolean => {
    return (
      item.aliases.some((alias) => activePath === alias || activePath.startsWith(`${alias}/`)) ||
      (item.to === "/tramite" && activePath.startsWith("/tramite") && !activePath.includes("ventanilla"))
    );
  };

  return (
    <nav
      aria-label="Servicios públicos a la ciudadanía"
      className={`w-full flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none ${className}`}
    >
      {CITIZEN_PUBLIC_MODULES.map((item) => {
        const Icon = item.icon;
        const active = isItemActive(item);

        return (
          <Link
            key={item.to}
            to={item.to}
            aria-current={active ? "page" : undefined}
            className={`inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold transition-all duration-150 shrink-0 ${
              active
                ? "bg-blue-700 text-white shadow-sm ring-1 ring-blue-700/20"
                : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:text-blue-700 hover:border-slate-300 shadow-2xs"
            }`}
          >
            <Icon className={`h-4 w-4 shrink-0 ${active ? "text-white" : "text-slate-500"}`} />
            <span>{item.label}</span>
            {item.badge && (
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                  active
                    ? "bg-blue-800 text-blue-100"
                    : "bg-blue-50 text-blue-700 border border-blue-200"
                }`}
              >
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
