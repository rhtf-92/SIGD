import React from "react";
import { Link } from "react-router-dom";
import {
  Menu,
  Clock,
  Search,
} from "lucide-react";
import { useAuthStore } from "../../stores/authStore";

interface TopHeaderBarProps {
  onToggleSidebar: () => void;
}

export default function TopHeaderBar({
  onToggleSidebar,
}: TopHeaderBarProps): React.JSX.Element {
  const usuario = useAuthStore((s) => s.usuario);
  const rol =
    usuario?.rol ||
    (typeof window !== "undefined"
      ? window.localStorage.getItem("sigd_rol") || "SUPER_ADMIN"
      : "SUPER_ADMIN");

  // Formato oficial de fecha en español (Perú)
  const fechaHoy = new Date().toLocaleDateString("es-PE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const fechaFormateada = fechaHoy.charAt(0).toUpperCase() + fechaHoy.slice(1);

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/90 px-4 sm:px-6 lg:px-8 backdrop-blur-md print:hidden">
      {/* Botón de Menú Móvil y Título */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 lg:hidden focus:outline-none focus:ring-2 focus:ring-[#0c2340]/20"
          aria-label="Abrir menú de navegación"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="hidden sm:flex flex-col">
          <span className="text-xs font-bold uppercase tracking-wider text-[#0c2340]">
            Sistema Integral de Gestión Documentaria
          </span>
          <span className="text-[11px] text-slate-500 font-medium">
            {fechaFormateada}
          </span>
        </div>
      </div>

      {/* Indicadores Institucionales y Accesos Directos */}
      <div className="flex items-center gap-3 sm:gap-4 text-xs">
        {/* Horario de Corte */}
        <div className="hidden md:inline-flex items-center gap-1.5 rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-[11px] font-medium text-slate-600">
          <Clock className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
          <span>Corte diario: 16:30 hrs</span>
        </div>

        {/* Estado del Sistema */}
        <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[11px] font-medium text-emerald-800">
          <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
          <span className="hidden sm:inline">Servicios Operativos</span>
          <span className="sm:hidden">En línea</span>
        </div>

        {/* Acceso Rápido a Consulta CUT */}
        <Link
          to="/consulta"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-[#0c2340] transition-colors"
          title="Consultar expediente por CUT"
        >
          <Search className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
          <span className="hidden md:inline">Consultar CUT</span>
        </Link>

        {/* Badge de Rol Activo */}
        <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
          <div className="hidden lg:flex flex-col items-end">
            <span className="text-[10px] font-bold text-slate-400 uppercase">
              Sesión Activa
            </span>
            <span className="text-xs font-semibold text-slate-700">
              {rol}
            </span>
          </div>
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0c2340] text-white font-bold text-xs"
            title={`Rol: ${rol}`}
          >
            {rol.substring(0, 2)}
          </div>
        </div>
      </div>
    </header>
  );
}
