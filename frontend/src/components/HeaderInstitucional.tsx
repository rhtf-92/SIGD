import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";
import { CasillaBadgeRealtime } from "./casilla/CasillaBadgeRealtime";

function getRolBadge(rol?: string) {
  switch (rol) {
    case "MESA_PARTES":
      return {
        label: "Mesa de Partes",
        className: "bg-emerald-600/80 text-white border border-emerald-400/40",
      };
    case "ADMINISTRADOR":
      return {
        label: "Administrador",
        className: "bg-purple-600/80 text-white border border-purple-400/40",
      };
    case "DIRECTOR":
      return {
        label: "Director",
        className: "bg-amber-600/80 text-white border border-amber-400/40",
      };
    case "SECRETARIO":
      return {
        label: "Secretario",
        className: "bg-indigo-600/80 text-white border border-indigo-400/40",
      };
    case "ESPECIALISTA":
      return {
        label: "Especialista",
        className: "bg-cyan-600/80 text-white border border-cyan-400/40",
      };
    case "CIUDADANO":
      return {
        label: "Ciudadano",
        className: "bg-blue-600/80 text-white border border-blue-400/40",
      };
    default:
      return null;
  }
}

export default function HeaderInstitucional() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, usuario, logout } = useAuthStore();
  const [menuAbierto, setMenuAbierto] = useState(true);

  const rol = usuario?.rol;
  const rolBadge = getRolBadge(rol);

  return (
    <header className="header-sigd bg-gradient-to-r from-blue-800 to-blue-900 text-white shadow-md print:hidden">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
        <div
          className="flex cursor-pointer items-center gap-3"
          onClick={() => navigate("/")}
        >
          <img
            alt="Escudo del Instituto Suiza"
            className="sigd-brand-logo"
            height={44}
            src="/img/logo.jpg"
            width={44}
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black tracking-wider uppercase text-white">
                SIGD SUIZA
              </span>
              <span className="rounded bg-blue-600/60 px-1.5 py-0.2 font-mono text-[10px] font-bold text-blue-100">
                v1.0
              </span>
            </div>
            <p className="text-xs text-blue-100 font-medium">
              Instituto de Educación Superior Tecnológico Público "Suiza"
            </p>
          </div>
        </div>

        <button
          type="button"
          className="header-menu-toggle"
          aria-label={menuAbierto ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={menuAbierto}
          onClick={() => setMenuAbierto((abierto) => !abierto)}
        >
          <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {menuAbierto ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M3 6h18M3 12h18M3 18h18" />}
          </svg>
        </button>
        <nav className={`header-nav text-xs font-semibold ${menuAbierto ? "" : "header-nav-collapsed"}`}>
          {isAuthenticated && (
            <div className="flex items-center gap-2 pr-1">
              <span className="hidden text-blue-100 sm:inline">
                {usuario?.nombreCompleto ?? "Sesión iniciada"}
              </span>
              {rolBadge && (
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${rolBadge.className}`}>
                  {rolBadge.label}
                </span>
              )}
            </div>
          )}

          {/* Menú adaptativo según rol */}
          {isAuthenticated && rol === "MESA_PARTES" ? (
            <>
              <button
                type="button"
                onClick={() => navigate("/expedientes")}
                className={`header-nav-link ${location.pathname.startsWith("/expedientes") ? "header-nav-active" : ""}`}
              >
                Bandeja de Expedientes
              </button>
              <button
                type="button"
                onClick={() => navigate("/ventanilla")}
                className={`header-nav-link ${location.pathname.startsWith("/ventanilla") || location.pathname.startsWith("/tramite/ventanilla-presencial") ? "header-nav-active" : ""}`}
              >
                Ventanilla Presencial
              </button>
              <button
                type="button"
                onClick={() => navigate("/administracion/atencion")}
                className={`header-nav-link ${location.pathname === "/administracion/atencion" ? "header-nav-active" : ""}`}
              >
                Atención de Trámites
              </button>
              <button
                type="button"
                onClick={() => navigate("/tramite/mesa-partes-virtual")}
                className={`header-nav-link ${location.pathname.startsWith("/tramite/mesa-partes") ? "header-nav-active" : ""}`}
              >
                Mesa Virtual
              </button>
              <button
                type="button"
                onClick={() => navigate("/tupa")}
                className={`header-nav-link ${location.pathname === "/tupa" ? "header-nav-active" : ""}`}
              >
                TUPA
              </button>
            </>
          ) : isAuthenticated && (rol === "ADMINISTRADOR" || rol === "DIRECTOR") ? (
            <>
              <button
                type="button"
                onClick={() => navigate("/expedientes")}
                className={`header-nav-link ${location.pathname.startsWith("/expedientes") ? "header-nav-active" : ""}`}
              >
                Expedientes
              </button>
              <button
                type="button"
                onClick={() => navigate("/administracion")}
                className={`header-nav-link ${location.pathname.startsWith("/administracion") ? "header-nav-active" : ""}`}
              >
                Administración
              </button>
              <button
                type="button"
                onClick={() => navigate("/tupa")}
                className={`header-nav-link ${location.pathname === "/tupa" ? "header-nav-active" : ""}`}
              >
                TUPA vigente
              </button>
              <button
                type="button"
                onClick={() => navigate("/casilla")}
                className={`header-nav-link ${location.pathname === "/casilla" || location.pathname === "/casilla-electronica" ? "header-nav-active" : ""}`}
              >
                Casilla Electrónica
              </button>
            </>
          ) : isAuthenticated && (rol === "SECRETARIO" || rol === "ESPECIALISTA") ? (
            <>
              <button
                type="button"
                onClick={() => navigate("/expedientes")}
                className={`header-nav-link ${location.pathname.startsWith("/expedientes") ? "header-nav-active" : ""}`}
              >
                Expedientes
              </button>
              <button
                type="button"
                onClick={() => navigate("/administracion/atencion")}
                className={`header-nav-link ${location.pathname === "/administracion/atencion" ? "header-nav-active" : ""}`}
              >
                Atención de Trámites
              </button>
              <button
                type="button"
                onClick={() => navigate("/tupa")}
                className={`header-nav-link ${location.pathname === "/tupa" ? "header-nav-active" : ""}`}
              >
                TUPA vigente
              </button>
              <button
                type="button"
                onClick={() => navigate("/casilla")}
                className={`header-nav-link ${location.pathname === "/casilla" || location.pathname === "/casilla-electronica" ? "header-nav-active" : ""}`}
              >
                Casilla Electrónica
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => navigate("/tupa")}
                className={`header-nav-link ${location.pathname === "/tupa" ? "header-nav-active" : ""}`}
              >
                TUPA vigente
              </button>
              <button
                type="button"
                onClick={() => navigate("/casilla")}
                className={`header-nav-link ${location.pathname === "/casilla" || location.pathname === "/casilla-electronica" ? "header-nav-active" : ""}`}
              >
                Casilla Electrónica
              </button>
              {!isAuthenticated && (
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className={`header-nav-link ${location.pathname === "/login" ? "header-nav-active" : ""}`}
                >
                  Iniciar sesión
                </button>
              )}
            </>
          )}

          {(location.pathname === "/casilla" || location.pathname === "/casilla-electronica") && (
            <CasillaBadgeRealtime />
          )}

          {isAuthenticated && (
            <button
              type="button"
              onClick={logout}
              className="header-nav-link text-red-200 hover:text-white"
            >
              Cerrar sesión
            </button>
          )}
        </nav>
      </div>
      <div className="header-accent-stripe" />
    </header>
  );
}