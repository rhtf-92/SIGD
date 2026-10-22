import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Bell,
  Menu,
  X,
  ExternalLink,
  LogOut,
  Shield,
  Clock,
  Mail,
  CheckCircle2,
} from "lucide-react";
import { useAuthStore } from "../../../stores/authStore";
import { ETIQUETAS_ADMIN } from "../AdminBreadcrumbs";

interface AdminHeaderProps {
  onToggleSidebar?: () => void;
  sidebarOpen?: boolean;
}

export default function AdminHeader({
  onToggleSidebar,
  sidebarOpen,
}: AdminHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { usuario, logout } = useAuthStore();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        notifRef.current &&
        !notifRef.current.contains(event.target as Node)
      ) {
        setShowNotifications(false);
      }
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Determine current active section name
  const pathParts = location.pathname.split("/").filter(Boolean);
  const currentKey = pathParts[pathParts.length - 1] ?? "administracion";
  const currentTitle = ETIQUETAS_ADMIN[currentKey] ?? "Panel de Administración";

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Hamburger (mobile) + Institutional Logo */}
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label={sidebarOpen ? "Cerrar menú lateral" : "Abrir menú lateral"}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-700/70 bg-slate-900/80 text-slate-300 hover:text-white hover:border-cyan-500/50 lg:hidden transition"
          >
            {sidebarOpen ? (
              <X className="h-5 w-5 text-cyan-400" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>

          <div
            onClick={() => navigate("/")}
            className="flex items-center gap-3 cursor-pointer group"
          >
            {/* "S" Emblem */}
            <div className="relative">
              <div className="absolute -inset-0.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 opacity-60 blur-xs group-hover:opacity-100 transition duration-300" />
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500 text-white font-black text-xl shadow-inner border border-cyan-400/30">
                S
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg font-black tracking-tight text-white">
                  SIGD <span className="text-cyan-400 font-extrabold">SUIZA</span>
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  <CheckCircle2 className="w-2.5 h-2.5 text-cyan-400" />
                  ADMIN
                </span>
              </div>
              <p className="hidden md:block text-[11px] text-slate-400 leading-none">
                IESTP &quot;Suiza&quot; • Pucallpa
              </p>
            </div>
          </div>

          {/* Module divider & title pill */}
          <div className="hidden lg:flex items-center gap-2 pl-4 ml-2 border-l border-slate-800">
            <span className="text-xs font-semibold text-slate-400">Módulo:</span>
            <span className="rounded-lg bg-blue-500/15 border border-blue-400/25 px-2.5 py-1 text-xs font-semibold text-cyan-300 drop-shadow-[0_0_8px_rgba(6,182,212,0.3)]">
              {currentTitle}
            </span>
          </div>
        </div>

        {/* Right: Status badge, Notifications, and Admin User Menu */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Status Online */}
          <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-xs font-medium text-slate-300">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="text-[11px] text-emerald-400 font-semibold">
              En Línea
            </span>
          </div>

          {/* Notifications Dropdown */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => {
                setShowNotifications((prev) => !prev);
                setShowUserMenu(false);
              }}
              aria-label="Ver notificaciones del sistema"
              aria-expanded={showNotifications}
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/80 text-slate-300 hover:text-white hover:border-cyan-500/40 transition cursor-pointer"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-500 text-[9px] font-extrabold text-slate-950 shadow-[0_0_8px_rgba(6,182,212,0.8)]">
                3
              </span>
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-cyan-500/30 bg-slate-900/95 p-4 shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-cyan-400" />
                    <h4 className="text-sm font-bold text-white">
                      Alertas Administrativas
                    </h4>
                  </div>
                  <span className="text-[10px] font-semibold rounded-full bg-cyan-500/15 text-cyan-300 px-2 py-0.5 border border-cyan-500/30">
                    3 activas
                  </span>
                </div>

                <div className="mt-3 space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  <div className="rounded-xl border border-blue-500/25 bg-blue-950/30 p-2.5">
                    <div className="flex items-start gap-2.5">
                      <Clock className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-blue-200">
                          Horario de Corte LPAG
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Recepción hasta las 16:30 hrs conforme a Ley 27444.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/30 p-2.5">
                    <div className="flex items-start gap-2.5">
                      <Shield className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-emerald-200">
                          Auditoría Inmutable Activa
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Trazabilidad WORM con sellos criptográficos.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-amber-500/25 bg-amber-950/30 p-2.5">
                    <div className="flex items-start gap-2.5">
                      <Shield className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-amber-200">
                          Seguridad y Bloqueo Preventivo
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          3 intentos máximos permitidos antes de suspensión.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Dropdown */}
          <div className="relative" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => {
                setShowUserMenu((prev) => !prev);
                setShowNotifications(false);
              }}
              aria-label="Menú de perfil del administrador"
              aria-expanded={showUserMenu}
              className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 p-1.5 sm:px-3 sm:py-1.5 text-left text-slate-300 hover:border-cyan-500/40 hover:text-white transition cursor-pointer"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-blue-600 to-cyan-500 text-white font-bold text-xs shadow-sm">
                AD
              </div>
              <div className="hidden sm:block">
                <span className="block text-xs font-bold text-white leading-tight">
                  {usuario?.nombreCompleto ?? "Administrador"}
                </span>
                <span className="block text-[10px] text-cyan-400 font-mono">
                  {usuario?.rol ?? "SUPER_ADMIN"}
                </span>
              </div>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-cyan-500/30 bg-slate-900/95 p-3 shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-150">
                <div className="border-b border-slate-800 pb-3 px-1">
                  <p className="text-xs font-bold text-white">
                    {usuario?.nombreCompleto ?? "Administrador Institucional"}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">
                    {usuario?.correo ?? "admin@iestpsuiza.edu.pe"}
                  </p>
                  <span className="mt-1.5 inline-block text-[10px] font-semibold rounded-full bg-cyan-500/15 text-cyan-300 px-2 py-0.5 border border-cyan-500/30">
                    Rol: {usuario?.rol ?? "SUPER_ADMIN"}
                  </span>
                </div>

                <div className="mt-2 space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false);
                      navigate("/");
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition text-left cursor-pointer"
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-cyan-400" />
                    <span>Ir al Portal Principal</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false);
                      navigate("/casilla");
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 hover:text-white transition text-left cursor-pointer"
                  >
                    <Mail className="h-3.5 w-3.5 text-blue-400" />
                    <span>Casilla Electrónica</span>
                  </button>

                  <div className="border-t border-slate-800 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserMenu(false);
                        logout();
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition text-left cursor-pointer"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Cerrar Sesión</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
