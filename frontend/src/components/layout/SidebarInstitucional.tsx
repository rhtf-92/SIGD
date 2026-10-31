import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Send,
  Mail,
  ShieldCheck,
  UserCheck,
  FolderKanban,
  FileSignature,
  BarChart3,
  Sliders,
  LogOut,
  X,
  User as UserIcon,
} from "lucide-react";
import { useAuthStore } from "../../stores/authStore";

export interface ModuloNavegacion {
  id: string;
  nombre: string;
  ruta: string;
  icono: React.ElementType;
  badge?: string;
  exact?: boolean;
}

export const MODULOS_SIDEBAR: ModuloNavegacion[] = [
  {
    id: "inicio",
    nombre: "Tablero Principal",
    ruta: "/",
    icono: LayoutDashboard,
    exact: true,
  },
  {
    id: "mesa-partes",
    nombre: "Mesa de Partes Virtual",
    ruta: "/tramite/mesa-partes-virtual",
    icono: Send,
    badge: "TUPA",
  },
  {
    id: "casilla",
    nombre: "Casilla Electrónica",
    ruta: "/casilla",
    icono: Mail,
  },
  {
    id: "validador-cvd",
    nombre: "Validador CVD",
    ruta: "/validador-cvd",
    icono: ShieldCheck,
  },
  {
    id: "registro",
    nombre: "Registro Ciudadano",
    ruta: "/registro",
    icono: UserCheck,
  },
  {
    id: "expedientes",
    nombre: "Bandeja de Expedientes",
    ruta: "/expedientes",
    icono: FolderKanban,
  },
  {
    id: "firma-digital",
    nombre: "Flujo y Firma Digital",
    ruta: "/flujo-validez-legal",
    icono: FileSignature,
  },
  {
    id: "reportes",
    nombre: "Reportes & Métricas",
    ruta: "/reportes/dashboard",
    icono: BarChart3,
  },
  {
    id: "administracion",
    nombre: "Panel de Administración",
    ruta: "/administracion",
    icono: Sliders,
    badge: "RBAC",
  },
];

interface SidebarInstitucionalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function SidebarInstitucional({
  isOpen = false,
  onClose,
}: SidebarInstitucionalProps): React.JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const usuario = useAuthStore((s) => s.usuario);
  const logout = useAuthStore((s) => s.logout);

  // Obtener rol y datos de sesión institucional con fallback seguro
  const rolActivo =
    usuario?.rol ||
    (typeof window !== "undefined"
      ? window.localStorage.getItem("sigd_rol") || "SUPER_ADMIN"
      : "SUPER_ADMIN");

  const nombreUsuario =
    usuario?.nombreCompleto ||
    (typeof window !== "undefined"
      ? window.localStorage.getItem("sigd_usuario_nombre") || "Usuario Institucional"
      : "Usuario Institucional");

  const correoUsuario =
    usuario?.correo ||
    (typeof window !== "undefined"
      ? window.localStorage.getItem("sigd_usuario_correo") || "soporte.sigd@iestpsuiza.edu.pe"
      : "soporte.sigd@iestpsuiza.edu.pe");

  const handleCerrarSesion = () => {
    logout();
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("sigd_token");
      window.localStorage.removeItem("sigd_rol");
      window.localStorage.removeItem("sigd_permisos");
      window.localStorage.removeItem("sigd_usuario_nombre");
      window.localStorage.removeItem("sigd_usuario_correo");
    }
    navigate("/login", { replace: true });
  };

  const isRutaActiva = (modulo: ModuloNavegacion): boolean => {
    if (modulo.exact) {
      return location.pathname === modulo.ruta;
    }
    return location.pathname.startsWith(modulo.ruta);
  };

  return (
    <>
      {/* Backdrop en pantallas móviles */}
      {isOpen && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Cerrar menú lateral"
          onClick={onClose}
          onKeyDown={(e) => {
            if (e.key === "Escape" || e.key === "Enter") onClose?.();
          }}
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs lg:hidden transition-opacity"
        />
      )}

      {/* Contenedor del Sidebar */}
      <aside
        aria-label="Menú principal de navegación SIGD"
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col justify-between bg-[#0c2340] text-white shadow-xl lg:static lg:z-auto lg:h-screen lg:shrink-0 lg:translate-x-0 lg:shadow-none transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Parte Superior: Branding Institucional */}
        <div className="flex flex-col border-b border-[#0f3261] px-5 py-5">
          <div className="flex items-center justify-between">
            <Link
              to="/"
              onClick={() => onClose?.()}
              className="flex items-center gap-3 group focus:outline-none"
              title="Ir al inicio del sistema SIGD"
            >
              {/* Logotipo S Institucional */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#0c2340] font-black text-xl shadow-md border border-white/20 select-none">
                S
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-black tracking-wider uppercase text-white font-sans">
                  SIGD SUIZA
                </span>
                <span className="text-[10px] font-semibold tracking-widest text-slate-300 uppercase">
                  PUCALLPA • UCAYALI
                </span>
              </div>
            </Link>

            {/* Botón de cierre en móvil */}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-300 hover:bg-white/10 hover:text-white lg:hidden transition-colors focus:outline-none"
                aria-label="Cerrar barra lateral"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Portal Oficial v1.0
            </span>

            <span className="text-[10px] text-slate-400 font-medium">
              MINEDU • Licenciado
            </span>
          </div>
        </div>

        {/* Parte Central: Módulos del Sistema */}
        <nav
          className="flex-1 overflow-y-auto px-3 py-4 space-y-1 text-xs"
          aria-label="Módulos del Sistema"
        >
          <div className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Módulos del Sistema
          </div>

          {MODULOS_SIDEBAR.map((modulo) => {
            const activo = isRutaActiva(modulo);
            const Icono = modulo.icono;

            return (
              <Link
                key={modulo.id}
                to={modulo.ruta}
                onClick={() => onClose?.()}
                aria-current={activo ? "page" : undefined}
                className={`group flex items-center justify-between rounded-xl px-3.5 py-2.5 font-medium transition-all duration-150 ${
                  activo
                    ? "bg-[#0f3261] text-white font-bold border-l-4 border-amber-400 shadow-sm"
                    : "text-slate-200 hover:bg-white/10 hover:text-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icono
                    className={`h-4 w-4 shrink-0 transition-colors ${
                      activo
                        ? "text-amber-300"
                        : "text-slate-300 group-hover:text-white"
                    }`}
                    aria-hidden="true"
                  />
                  <span className="truncate">{modulo.nombre}</span>
                </div>

                {modulo.badge && (
                  <span
                    className={`ml-2 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                      activo
                        ? "bg-amber-400/20 text-amber-200 border border-amber-300/40"
                        : "bg-white/10 text-slate-300 group-hover:text-white"
                    }`}
                  >
                    {modulo.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Parte Inferior: Tarjeta de Usuario Activo y Logout */}
        <div className="border-t border-[#0f3261] bg-[#091b31] p-3.5">
          {/* Tarjeta de Perfil de Usuario Activo */}
          <div
            aria-label="Información del usuario activo"
            className="mb-3 rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur-xs"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white font-bold">
                <UserIcon className="h-4 w-4 text-blue-200" aria-hidden="true" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-white">
                  {nombreUsuario}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="inline-block rounded bg-blue-500/20 px-1.5 py-0.2 font-mono text-[9px] font-extrabold text-blue-200 border border-blue-400/30 uppercase">
                    {rolActivo}
                  </span>
                </div>
                <p className="truncate text-[10px] text-slate-400 mt-0.5">
                  {correoUsuario}
                </p>
              </div>
            </div>
          </div>

          {/* Botón de Cerrar Sesión (Logout) */}
          <button
            type="button"
            onClick={handleCerrarSesion}
            className="w-full flex items-center justify-center gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200 hover:bg-red-600 hover:text-white hover:border-red-600 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-red-400/30"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>
    </>
  );
}
