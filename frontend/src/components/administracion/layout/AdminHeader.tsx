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
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white shadow-sm">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left: Hamburger (mobile) + Institutional Logo */}
        <div className="flex items-center gap-3 sm:gap-4">
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label={sidebarOpen ? "Cerrar menú lateral" : "Abrir menú lateral"}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-blue-800 hover:border-blue-300 lg:hidden transition"
          >
            {sidebarOpen ? (
              <X className="h-5 w-5 text-blue-700" />
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
                <span className="text-base sm:text-lg font-black tracking-tight text-slate-900">
                  SIGD <span className="text-blue-700 font-extrabold">SUIZA</span>
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  <CheckCircle2 className="w-2.5 h-2.5 text-blue-700" />
                  ADMIN
                </span>
              </div>
              <p className="hidden md:block text-[11px] text-slate-500 leading-none">
                IESTP &quot;Suiza&quot; • Pucallpa
              </p>
            </div>
          </div>

          {/* Module divider & title pill */}
          <div className="hidden lg:flex items-center gap-2 pl-4 ml-2 border-l border-slate-200">
            <span className="text-xs font-semibold text-slate-500">Módulo:</span>
            <span className="rounded-lg bg-blue-50 border border-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800">
              {currentTitle}
            </span>
          </div>
        </div>

        {/* Right: Status badge, Notifications, and Admin User Menu */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Status Online */}
          <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-200 text-xs font-medium text-slate-600">
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
              className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:text-blue-800 hover:border-blue-300 transition cursor-pointer"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-700 text-[9px] font-extrabold text-white">
                3
              </span>
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-slate-200 bg-white p-4 text-slate-800 shadow-xl animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-blue-700" />
                    <h4 className="text-sm font-bold text-slate-900">
                      Alertas Administrativas
                    </h4>
                  </div>
                  <span className="text-[10px] font-semibold rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 border border-blue-100">
                    3 activas
                  </span>
                </div>

                <div className="mt-3 space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  <div className="rounded-xl border border-blue-100 bg-blue-50 p-2.5">
                    <div className="flex items-start gap-2.5">
                      <Clock className="h-4 w-4 text-blue-700 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-blue-900">
                          Horario de Corte LPAG
                        </p>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          Recepción hasta las 16:30 hrs conforme a Ley 27444.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-2.5">
                    <div className="flex items-start gap-2.5">
                      <Shield className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-emerald-900">
                          Auditoría Inmutable Activa
                        </p>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          Trazabilidad WORM con sellos criptográficos.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-amber-100 bg-amber-50 p-2.5">
                    <div className="flex items-start gap-2.5">
                      <Shield className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-semibold text-amber-900">
                          Seguridad y Bloqueo Preventivo
                        </p>
                        <p className="text-[11px] text-slate-600 mt-0.5">
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
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-1.5 sm:px-3 sm:py-1.5 text-left text-slate-700 hover:border-blue-300 hover:text-blue-800 transition cursor-pointer"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-tr from-blue-600 to-cyan-500 text-white font-bold text-xs shadow-sm">
                AD
              </div>
              <div className="hidden sm:block">
                <span className="block text-xs font-bold text-slate-900 leading-tight">
                  {usuario?.nombreCompleto ?? "Administrador"}
                </span>
                <span className="block text-[10px] text-blue-700 font-mono">
                  {usuario?.rol ?? "SUPER_ADMIN"}
                </span>
              </div>
            </button>

            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-3 text-slate-800 shadow-xl animate-in fade-in zoom-in-95 duration-150">
                <div className="border-b border-slate-200 pb-3 px-1">
                  <p className="text-xs font-bold text-slate-900">
                    {usuario?.nombreCompleto ?? "Administrador Institucional"}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {usuario?.correo ?? "admin@iestpsuiza.edu.pe"}
                  </p>
                  <span className="mt-1.5 inline-block text-[10px] font-semibold rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 border border-blue-100">
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
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-800 transition text-left cursor-pointer"
                  >
                    <ExternalLink className="h-3.5 w-3.5 text-blue-700" />
                    <span>Ir al Portal Principal</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setShowUserMenu(false);
                      navigate("/casilla");
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-800 transition text-left cursor-pointer"
                  >
                    <Mail className="h-3.5 w-3.5 text-blue-400" />
                    <span>Casilla Electrónica</span>
                  </button>

                  <div className="border-t border-slate-200 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowUserMenu(false);
                        logout();
                      }}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 hover:text-rose-800 transition text-left cursor-pointer"
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
