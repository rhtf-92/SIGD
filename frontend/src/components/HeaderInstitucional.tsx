import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown,
  LayoutDashboard,
  LogIn,
  LogOut,
  Settings,
  ShieldCheck,
} from "lucide-react";

import { useAuthStore } from "../stores/authStore";
import { useAutenticado, useRolActual } from "../hooks/useModulosVisibles";
import { puedeAcceder } from "../config/modulos";
import { ETIQUETA_ROL } from "../utils/etiquetaRol";
import { inicialesNombre } from "../utils/iniciales";
import AjustesUsuarioModal from "./ajustes/AjustesUsuarioModal";

export default function HeaderInstitucional() {
  const navigate = useNavigate();
  const autenticado = useAutenticado();
  const rol = useRolActual();
  const usuario = useAuthStore((state) => state.usuario);
  const cerrarSesion = useAuthStore((state) => state.logout);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [ajustesAbierto, setAjustesAbierto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuAbierto) return;

    function handleClickExterno(evento: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(evento.target as Node)) {
        setMenuAbierto(false);
      }
    }

    document.addEventListener("mousedown", handleClickExterno);
    return () => document.removeEventListener("mousedown", handleClickExterno);
  }, [menuAbierto]);

  const administraSeguridad = puedeAcceder(rol, "administracion");
  const etiquetaRol = rol ? ETIQUETA_ROL[rol] : "Sesión activa";

  return (
    <header className="header-sigd sticky top-0 z-40 bg-[#0A1128]/95 backdrop-blur-xl text-white border-b border-white/[0.08] shadow-[0_4px_25px_-4px_rgba(10,17,40,0.4)] print:hidden">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        {/* Brand identity & emblem */}
        <div
          className="group flex cursor-pointer items-center gap-3.5 transition-opacity hover:opacity-95"
          onClick={() => navigate("/")}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") navigate("/");
          }}
          aria-label="Ir al inicio de SIGD Suiza"
        >
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-900 p-0.5 shadow-lg shadow-blue-500/20 ring-1 ring-white/20 transition-transform duration-200 group-hover:scale-105">
            {/* Custom SVG Shield Emblem with Swiss Cross */}
            <svg
              className="h-6 w-6 text-white drop-shadow-sm"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 2L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-3zm1 14h-2v-3H8v-2h3V8h2v3h3v2h-3v3z" />
            </svg>
            <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0A1128] bg-emerald-400" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-wider text-white text-base leading-none">
                SIGD <span className="text-blue-400">SUIZA</span>
              </span>
              <span className="rounded-full bg-blue-500/20 border border-blue-400/30 px-2 py-0.5 font-mono text-[10px] font-bold text-blue-300">
                v1.0
              </span>
              <span className="hidden items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-400/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 lg:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LPAG Ley 27444
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-300 font-medium">
              Instituto de Educación Superior Tecnológico Público &quot;Suiza&quot;
            </p>
          </div>
        </div>

        {/* User navigation & actions */}
        <nav className="flex items-center gap-3 text-xs font-semibold">
          {autenticado ? (
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuAbierto((previo) => !previo)}
                aria-haspopup="menu"
                aria-expanded={menuAbierto}
                className="flex items-center gap-2.5 rounded-full border border-white/15 bg-white/5 py-1.5 pl-1.5 pr-3 text-white backdrop-blur-sm transition-all duration-200 hover:border-white/30 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-slate-900"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 text-xs font-black text-white shadow-sm ring-1 ring-white/30">
                  {inicialesNombre(usuario?.nombreCompleto)}
                </span>
                <div className="hidden text-left sm:block">
                  <span className="block max-w-[9rem] truncate text-xs font-semibold leading-none text-white">
                    {usuario?.nombreCompleto ?? "Mi cuenta"}
                  </span>
                  <span className="mt-0.5 block text-[10px] font-medium text-blue-300 leading-none">
                    {etiquetaRol}
                  </span>
                </div>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-slate-300 transition-transform duration-200 ${
                    menuAbierto ? "rotate-180" : ""
                  }`}
                  aria-hidden="true"
                />
              </button>

              {menuAbierto ? (
                <div
                  role="menu"
                  className="absolute right-0 mt-2.5 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white/95 text-slate-800 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
                >
                  <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-3.5">
                    <p className="truncate text-sm font-bold text-slate-900">
                      {usuario?.nombreCompleto ?? "Usuario"}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {usuario?.correo}
                    </p>
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-bold text-blue-700">
                      <ShieldCheck className="h-3 w-3" />
                      {etiquetaRol}
                    </div>
                  </div>

                  <div className="p-1.5">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuAbierto(false);
                        setAjustesAbierto(true);
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100/80"
                    >
                      <Settings className="h-4 w-4 text-slate-500" aria-hidden="true" />
                      Mis preferencias
                    </button>

                    {administraSeguridad ? (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenuAbierto(false);
                          navigate("/administracion");
                        }}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100/80"
                      >
                        <LayoutDashboard
                          className="h-4 w-4 text-slate-500"
                          aria-hidden="true"
                        />
                        Panel de Administración
                      </button>
                    ) : null}

                    <div className="my-1 border-t border-slate-100" />

                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuAbierto(false);
                        cerrarSesion();
                      }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-semibold text-rose-600 transition hover:bg-rose-50"
                    >
                      <LogOut className="h-4 w-4" aria-hidden="true" />
                      Cerrar sesión
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 font-bold text-white shadow-md shadow-blue-500/20 transition-all duration-200 hover:from-blue-500 hover:to-indigo-500 hover:shadow-lg hover:shadow-blue-500/30 active:scale-95"
            >
              <LogIn className="h-4 w-4" />
              <span>Iniciar sesión</span>
            </button>
          )}
        </nav>
      </div>

      {/* Modern micro-ribbon border in IESTP Suiza institutional colors */}
      <div 
        className="header-bar h-[2.5px] w-full bg-gradient-to-r from-blue-500 via-rose-500 via-50% to-amber-400" 
      />

      <AjustesUsuarioModal
        isOpen={ajustesAbierto}
        onClose={() => setAjustesAbierto(false)}
      />
    </header>
  );
}