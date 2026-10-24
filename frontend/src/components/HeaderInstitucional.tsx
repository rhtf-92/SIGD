import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, X, LogOut, User } from "lucide-react";
import { useAuthStore } from "../stores/authStore";
import {
  NAV_ITEMS_PUBLICOS,
  NAV_ITEMS_POR_ROL,
  type RolCanonica,
  type NavItem,
} from "../config/navigation.config";

export default function HeaderInstitucional() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const usuario = useAuthStore((state) => state.usuario);
  const logout = useAuthStore((state) => state.logout);

  const navItems: readonly NavItem[] = isAuthenticated && usuario?.rol
    ? NAV_ITEMS_POR_ROL[usuario.rol as RolCanonica] || []
    : NAV_ITEMS_PUBLICOS;

  const handleLogout = () => {
    logout();
    setIsMobileMenuOpen(false);
    navigate("/login", { replace: true });
  };

  const handleNavigate = (ruta: string) => {
    setIsMobileMenuOpen(false);
    navigate(ruta);
  };

  return (
    <header className="header-sigd bg-gradient-to-r from-blue-800 to-blue-900 text-white shadow-md print:hidden">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-3 py-2.5 sm:px-6 sm:py-3 lg:px-8">
        {/* Identidad Institucional */}
        <Link
          to="/"
          onClick={() => setIsMobileMenuOpen(false)}
          className="flex cursor-pointer items-center gap-2.5 sm:gap-3 no-underline text-white hover:opacity-95 transition shrink-0"
        >
          <div className="flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl bg-white text-blue-800 font-black text-sm sm:text-base shadow-sm shrink-0">
            S
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-xs sm:text-sm font-black tracking-wider uppercase text-white truncate">
                SIGD SUIZA
              </span>
              <span className="rounded bg-blue-600/60 px-1 sm:px-1.5 py-0.5 font-mono text-[9px] sm:text-[10px] font-bold text-blue-100 shrink-0">
                v1.0
              </span>
            </div>
            <p className="text-[10px] sm:text-xs text-blue-100 font-medium truncate max-w-[190px] xs:max-w-[260px] sm:max-w-none">
              IESTP &quot;Suiza&quot; — Pucallpa
            </p>
          </div>
        </Link>

        {/* Navegación Desktop */}
        <nav aria-label="Navegación principal" className="hidden md:flex items-center gap-1.5 text-xs font-semibold">
          {navItems.map((item) => {
            const isActive = location.pathname === item.ruta;
            return (
              <button
                key={item.ruta}
                type="button"
                onClick={() => handleNavigate(item.ruta)}
                className={`rounded-lg px-2.5 lg:px-3 py-1.5 transition whitespace-nowrap ${
                  isActive
                    ? "bg-white text-blue-900 font-bold shadow-sm"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                {item.etiqueta}
              </button>
            );
          })}

          {isAuthenticated && usuario && (
            <div className="ml-2 flex items-center gap-2 border-l border-blue-700/60 pl-3">
              <div className="text-right">
                <p className="text-[11px] font-bold text-white leading-tight max-w-[140px] lg:max-w-none truncate">
                  {usuario.nombreCompleto}
                </p>
                <div className="flex items-center gap-1 justify-end">
                  <span className="inline-block rounded bg-amber-400/90 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-slate-900">
                    {usuario.rol}
                  </span>
                  {usuario.rol !== "CIUDADANO" && (
                    <span
                      className="rounded bg-blue-700 px-1.5 py-0.5 text-[9px] font-bold text-blue-100"
                      title="Uso estrictamente institucional. Prohibido compartir credenciales."
                    >
                      {usuario.areaId ?? "DIR"}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg bg-rose-600/80 hover:bg-rose-600 px-2.5 py-1 text-white transition text-[11px] whitespace-nowrap"
                title="Cerrar sesión"
              >
                Salir
              </button>
            </div>
          )}
        </nav>

        {/* Controles Mobile */}
        <div className="flex md:hidden items-center gap-1.5">
          {isAuthenticated && usuario && (
            <div className="flex items-center gap-1 rounded-lg bg-blue-700/60 px-2 py-1 text-white text-[11px]" title={`Sesión: ${usuario.rol}`}>
              <User className="h-3.5 w-3.5 text-amber-300" />
              <span className="font-bold text-[10px] truncate max-w-[90px]">{usuario.nombreCompleto.split(" ")[0]}</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="rounded-lg bg-white/10 p-2 text-white hover:bg-white/20 transition focus:outline-none focus:ring-2 focus:ring-white"
            aria-label={isMobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Menú Desplegable Mobile */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-blue-700/80 bg-blue-900/95 px-4 py-3 space-y-3 shadow-inner animate-in fade-in duration-150">
          {isAuthenticated && usuario && (
            <div className="rounded-xl border border-blue-700 bg-blue-800/60 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-white">{usuario.nombreCompleto}</p>
                  <p className="text-[10px] text-blue-200">{usuario.correo ?? "Usuario SIGD"}</p>
                </div>
                <div className="text-right">
                  <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-slate-900 block">
                    {usuario.rol}
                  </span>
                  {usuario.rol !== "CIUDADANO" && (
                    <span className="text-[9px] text-blue-200 font-mono block mt-0.5">
                      Área: {usuario.areaId ?? "DIR"}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-rose-600/90 hover:bg-rose-600 px-3 py-1.5 text-xs font-bold text-white transition shadow-xs"
              >
                <LogOut className="h-3.5 w-3.5" /> Cerrar sesión
              </button>
            </div>
          )}

          <nav aria-label="Menú móvil" className="space-y-1">
            {navItems.map((item) => {
              const isActive = location.pathname === item.ruta;
              return (
                <button
                  key={`mobile-${item.ruta}`}
                  type="button"
                  onClick={() => handleNavigate(item.ruta)}
                  className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold transition ${
                    isActive
                      ? "bg-white text-blue-900 font-bold shadow-xs"
                      : "text-blue-100 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <span>{item.etiqueta}</span>
                  {isActive && <span className="h-1.5 w-1.5 rounded-full bg-blue-900" />}
                </button>
              );
            })}
          </nav>
        </div>
      )}

      {/* Sub-banner de Sesión Institucional */}
      {isAuthenticated && usuario && usuario.rol !== "CIUDADANO" && (
        <div className="bg-slate-900/95 border-t border-blue-800/60 px-4 py-1.5 text-[11px] text-blue-200 print:hidden">
          <div className="mx-auto max-w-7xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shrink-0" />
              <span className="truncate">
                <strong>Sesión Institucional:</strong> Perfil habilitado: {usuario.rol} | Área asignada: {usuario.areaId ?? "Dirección / Operaciones"}
              </span>
            </div>
            <span className="text-[10px] text-amber-300 font-medium truncate">
              🔒 Uso estrictamente institucional • Prohibido el uso compartido de credenciales
            </span>
          </div>
        </div>
      )}
      <div className="h-1 w-full bg-gradient-to-r from-blue-400 via-rose-500 to-amber-400" />
    </header>
  );
}
