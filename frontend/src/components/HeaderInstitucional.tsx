import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Menu,
  X,
  FileText,
  Inbox,
  Mail,
  ShieldCheck,
  BarChart3,
  Settings,
  LogIn,
  LogOut,
  User,
  Home,
  CheckCircle2,
  Clock,
  ChevronRight,
  Search,
  UserCheck,
} from "lucide-react";
import { useAuthStore } from "../stores/authStore";

export default function HeaderInstitucional() {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const { usuario, isAuthenticated, logout } = useAuthStore();

  const userRole = usuario?.rol;

  // Permisos reactivos según el rol de usuario autenticado
  const canAccessExpedientes =
    isAuthenticated &&
    Boolean(
      userRole &&
        ["SUPER_ADMIN", "DIRECTOR", "DOCENTE", "MESA_PARTES"].includes(userRole)
    );

  const canAccessCasilla = isAuthenticated;

  const canAccessReportes =
    isAuthenticated &&
    Boolean(userRole && ["DIRECTOR", "SUPER_ADMIN"].includes(userRole));

  const canAccessAdmin =
    isAuthenticated &&
    Boolean(userRole && ["SUPER_ADMIN", "DIRECTOR"].includes(userRole));

  const canAccessVentanilla =
    isAuthenticated &&
    Boolean(userRole && ["MESA_PARTES", "SUPER_ADMIN"].includes(userRole));

  const canAccessFlujoLegal =
    isAuthenticated &&
    Boolean(
      userRole &&
        ["SUPER_ADMIN", "DIRECTOR", "DOCENTE", "MESA_PARTES"].includes(userRole)
    );

  // Cerrar menú al cambiar de ruta
  useEffect(() => {
    setMenuAbierto(false);
  }, [location.pathname]);

  // Cerrar menú con tecla Escape
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuAbierto(false);
      }
    }
    if (menuAbierto) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [menuAbierto]);

  function isActive(path: string): boolean {
    if (path === "/" && location.pathname === "/") return true;
    if (path !== "/" && location.pathname.startsWith(path)) return true;
    return false;
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <header className="header-sigd w-full sticky top-0 z-40 bg-gradient-to-r from-blue-900 via-blue-800 to-slate-900 text-white shadow-md print:hidden">
      <div className="w-full flex items-center justify-between px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-2.5">
        {/* LOGO & TITULO INSTITUCIONAL */}
        <Link
          to="/"
          className="flex items-center gap-2.5 sm:gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 rounded-lg p-1"
          aria-label="Ir al inicio de SIGD IESTP Suiza"
        >
          <div className="flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-white text-blue-900 font-black text-base shadow-sm transition group-hover:scale-105">
            S
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm sm:text-base font-black tracking-wider uppercase text-white truncate">
                SIGD SUIZA
              </span>
              <span className="rounded bg-blue-600/70 px-1.5 py-0.5 font-mono text-[10px] font-bold text-blue-100">
                v1.0
              </span>
            </div>
            <p className="hidden sm:block text-[11px] text-blue-100 font-medium truncate max-w-xs md:max-w-md">
              IESTP "Suiza" • Pucallpa
            </p>
          </div>
        </Link>

        {/* NAVEGACIÓN DESKTOP (lg:flex) */}
        <nav
          className="hidden lg:flex items-center gap-1 xl:gap-2 text-xs font-semibold"
          aria-label="Navegación principal de escritorio"
        >
          <Link
            to="/"
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition ${
              isActive("/") && location.pathname === "/"
                ? "bg-white/20 text-white shadow-xs font-bold"
                : "text-blue-100 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Home className="h-3.5 w-3.5" />
            <span>Inicio</span>
          </Link>

          <Link
            to="/tramite"
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition ${
              isActive("/tramite")
                ? "bg-white/20 text-white shadow-xs font-bold"
                : "text-blue-100 hover:bg-white/10 hover:text-white"
            }`}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Trámites</span>
          </Link>

          <Link
            to="/consulta"
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition ${
              isActive("/consulta")
                ? "bg-white/20 text-white shadow-xs font-bold"
                : "text-blue-100 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Search className="h-3.5 w-3.5" />
            <span>Consulta CUT</span>
          </Link>

          <Link
            to="/validador-cvd"
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition ${
              isActive("/validador-cvd")
                ? "bg-white/20 text-white shadow-xs font-bold"
                : "text-blue-100 hover:bg-white/10 hover:text-white"
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Validador</span>
          </Link>

          <Link
            to="/registro"
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition ${
              isActive("/registro")
                ? "bg-white/20 text-white shadow-xs font-bold"
                : "text-blue-100 hover:bg-white/10 hover:text-white"
            }`}
          >
            <UserCheck className="h-3.5 w-3.5" />
            <span>Registro</span>
          </Link>

          {canAccessExpedientes && (
            <Link
              to="/expedientes"
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition ${
                isActive("/expedientes")
                  ? "bg-white/20 text-white shadow-xs font-bold"
                  : "text-blue-100 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Inbox className="h-3.5 w-3.5" />
              <span>Expedientes</span>
            </Link>
          )}

          {canAccessCasilla && (
            <Link
              to="/casilla"
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition ${
                isActive("/casilla")
                  ? "bg-white/20 text-white shadow-xs font-bold"
                  : "text-blue-100 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Mail className="h-3.5 w-3.5" />
              <span>Casilla</span>
            </Link>
          )}

          {canAccessReportes && (
            <Link
              to="/reportes"
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition ${
                isActive("/reportes")
                  ? "bg-white/20 text-white shadow-xs font-bold"
                  : "text-blue-100 hover:bg-white/10 hover:text-white"
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              <span>Reportes MGD</span>
            </Link>
          )}

          {canAccessAdmin && (
            <Link
              to="/administracion"
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition ${
                isActive("/administracion")
                  ? "bg-white/20 text-white shadow-xs font-bold"
                  : "text-blue-100 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Settings className="h-3.5 w-3.5" />
              <span>Administración</span>
            </Link>
          )}
        </nav>

        {/* ACCIONES Y PERFIL DERECHA */}
        <div className="flex items-center gap-2 sm:gap-3">
          {isAuthenticated && usuario ? (
            <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-blue-700/60">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-700 font-bold text-xs text-white">
                {usuario.nombreCompleto ? usuario.nombreCompleto[0].toUpperCase() : "U"}
              </div>
              <div className="hidden md:block text-left text-xs">
                <p className="font-bold text-white truncate max-w-[140px]">
                  {usuario.nombreCompleto}
                </p>
                <span className="rounded bg-blue-600/80 px-1 py-0.2 text-[9px] font-semibold text-blue-100 uppercase">
                  {usuario.rol}
                </span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                title="Cerrar sesión"
                className="ml-1 rounded-lg p-1.5 text-blue-200 hover:bg-white/10 hover:text-white transition"
              >
                <LogOut className="h-4 w-4" />
                <span className="sr-only">Cerrar sesión</span>
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-blue-600/70 hover:bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition shadow-xs"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>Ingresar</span>
            </Link>
          )}

          {/* BOTÓN HAMBURGUESA MÓVIL / TABLET */}
          <button
            type="button"
            onClick={() => setMenuAbierto(!menuAbierto)}
            className="lg:hidden inline-flex items-center justify-center rounded-xl p-2 text-blue-100 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-300 transition"
            aria-expanded={menuAbierto}
            aria-controls="menu-movil"
            aria-label={menuAbierto ? "Cerrar menú principal" : "Abrir menú principal"}
          >
            {menuAbierto ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* LÍNEA DECORATIVA BICOLOR */}
      <div className="h-1 w-full bg-gradient-to-r from-blue-400 via-rose-500 to-amber-400" />

      {/* DRAWER MÓVIL / TABLET CON BACKDROP */}
      {menuAbierto && (
        <div
          id="menu-movil"
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 lg:hidden"
        >
          {/* Backdrop con desenfoque suave */}
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity duration-300"
            onClick={() => setMenuAbierto(false)}
            aria-hidden="true"
          />

          {/* Panel Lateral Desplegable */}
          <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col bg-white text-slate-900 shadow-2xl animate-in slide-in-from-right duration-250">
            {/* Cabecera del Drawer */}
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-900 px-5 py-4 text-white">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-700 font-black text-sm text-white shadow-sm">
                  S
                </div>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-white">
                    SIGD IESTP SUIZA
                  </h2>
                  <p className="text-[11px] text-slate-300">
                    Navegación Móvil Adaptativa
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMenuAbierto(false)}
                className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white transition"
                aria-label="Cerrar panel de navegación"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Estado de Usuario en Móvil */}
            {isAuthenticated && usuario ? (
              <div className="border-b border-slate-200 bg-blue-50/70 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-800 font-bold text-white shadow-xs">
                    {usuario.nombreCompleto ? usuario.nombreCompleto[0].toUpperCase() : "U"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {usuario.nombreCompleto}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {usuario.correo}
                    </p>
                    <span className="mt-0.5 inline-block rounded bg-blue-200 px-1.5 py-0.2 text-[10px] font-bold text-blue-900 uppercase">
                      {usuario.rol}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border-b border-slate-200 bg-slate-50 p-4">
                <Link
                  to="/login"
                  onClick={() => setMenuAbierto(false)}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-800 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-900 transition"
                >
                  <LogIn className="h-4 w-4" />
                  <span>Acceso Institucional (Iniciar Sesión)</span>
                </Link>
              </div>
            )}

            {/* Lista de Módulos y Enlaces */}
            <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
              {/* Sección 1: Servicios Públicos a la Ciudadanía (Accesibles siempre) */}
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-2">
                  Servicios Públicos a la Ciudadanía
                </p>
                <div className="space-y-1">
                  <Link
                    to="/"
                    onClick={() => setMenuAbierto(false)}
                    className="flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                  >
                    <div className="flex items-center gap-3">
                      <Home className="h-4 w-4 text-blue-600" />
                      <span>Portal Principal</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-300" />
                  </Link>

                  <Link
                    to="/tramite/mesa-partes-virtual"
                    onClick={() => setMenuAbierto(false)}
                    className="flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-blue-600" />
                      <span>Mesa de Partes Virtual 24x7</span>
                    </div>
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800">
                      LPAG
                    </span>
                  </Link>

                  <Link
                    to="/consulta"
                    onClick={() => setMenuAbierto(false)}
                    className="flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                  >
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      <span>Consulta Pública CUT</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-300" />
                  </Link>

                  <Link
                    to="/validador-cvd"
                    onClick={() => setMenuAbierto(false)}
                    className="flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                  >
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="h-4 w-4 text-teal-600" />
                      <span>Validador Público CVD</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-300" />
                  </Link>

                  <Link
                    to="/registro"
                    onClick={() => setMenuAbierto(false)}
                    className="flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                  >
                    <div className="flex items-center gap-3">
                      <User className="h-4 w-4 text-indigo-600" />
                      <span>Registro de Administrados</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-300" />
                  </Link>
                </div>
              </div>

              {/* Sección 2: Gestión Operativa (Condicionada a roles autorizados) */}
              {(canAccessVentanilla ||
                canAccessExpedientes ||
                canAccessCasilla ||
                canAccessFlujoLegal) && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-2">
                    Gestión Operativa
                  </p>
                  <div className="space-y-1">
                    {canAccessVentanilla && (
                      <Link
                        to="/tramite/ventanilla-presencial"
                        onClick={() => setMenuAbierto(false)}
                        className="flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                      >
                        <div className="flex items-center gap-3">
                          <Clock className="h-4 w-4 text-amber-600" />
                          <span>Ventanilla Presencial</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-300" />
                      </Link>
                    )}

                    {canAccessExpedientes && (
                      <Link
                        to="/expedientes"
                        onClick={() => setMenuAbierto(false)}
                        className="flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                      >
                        <div className="flex items-center gap-3">
                          <Inbox className="h-4 w-4 text-blue-600" />
                          <span>Bandeja de Expedientes</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-300" />
                      </Link>
                    )}

                    {canAccessCasilla && (
                      <Link
                        to="/casilla"
                        onClick={() => setMenuAbierto(false)}
                        className="flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                      >
                        <div className="flex items-center gap-3">
                          <Mail className="h-4 w-4 text-rose-600" />
                          <span>Casilla Electrónica</span>
                        </div>
                        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-800">
                          Oficial
                        </span>
                      </Link>
                    )}

                    {canAccessFlujoLegal && (
                      <Link
                        to="/flujo-validez-legal"
                        onClick={() => setMenuAbierto(false)}
                        className="flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                      >
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="h-4 w-4 text-indigo-600" />
                          <span>Flujo y Validez Legal</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-300" />
                      </Link>
                    )}
                  </div>
                </div>
              )}

              {/* Sección 3: Dirección & Reportes (Condicionada a roles autorizados) */}
              {(canAccessReportes || canAccessAdmin) && (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-2">
                    Dirección & Analítica MGD
                  </p>
                  <div className="space-y-1">
                    {canAccessReportes && (
                      <Link
                        to="/reportes"
                        onClick={() => setMenuAbierto(false)}
                        className="flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                      >
                        <div className="flex items-center gap-3">
                          <BarChart3 className="h-4 w-4 text-amber-600" />
                          <span>Tablero Ejecutivo MGD</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-300" />
                      </Link>
                    )}

                    {canAccessAdmin && (
                      <Link
                        to="/administracion"
                        onClick={() => setMenuAbierto(false)}
                        className="flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
                      >
                        <div className="flex items-center gap-3">
                          <Settings className="h-4 w-4 text-slate-700" />
                          <span>Panel de Administración</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-slate-300" />
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Pie del Drawer */}
            <div className="border-t border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                <span>Horario de corte LPAG:</span>
                <span className="font-mono font-bold text-slate-800">16:30 hrs</span>
              </div>
              {isAuthenticated && (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-bold text-red-700 hover:bg-red-100 transition"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Cerrar Sesión</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}