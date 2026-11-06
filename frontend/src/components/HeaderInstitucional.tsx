import { useState, useEffect, useRef } from "react";
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
  ChevronDown,
  Search,
  UserCheck,
} from "lucide-react";
import { useAuthStore } from "../stores/authStore";

export default function HeaderInstitucional() {
  const navigate = useNavigate();
  const location = useLocation();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [tramitesDropdownOpen, setTramitesDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
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

  // Cerrar menús al cambiar de ruta
  useEffect(() => {
    setMenuAbierto(false);
    setTramitesDropdownOpen(false);
  }, [location.pathname]);

  // Cerrar menús con tecla Escape
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuAbierto(false);
        setTramitesDropdownOpen(false);
      }
    }
    if (menuAbierto || tramitesDropdownOpen) {
      window.addEventListener("keydown", handleKeyDown);
      if (menuAbierto) {
        document.body.style.overflow = "hidden";
      }
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [menuAbierto, tramitesDropdownOpen]);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setTramitesDropdownOpen(false);
      }
    }
    if (tramitesDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [tramitesDropdownOpen]);

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

          {/* MENÚ DESPLEGABLE DE TRÁMITES Y SERVICIOS CIUDADANOS */}
          <div
            ref={dropdownRef}
            className="relative"
            onMouseEnter={() => setTramitesDropdownOpen(true)}
            onMouseLeave={() => setTramitesDropdownOpen(false)}
          >
            <div className="flex items-center">
              <Link
                to="/tramite"
                className={`flex items-center gap-1.5 rounded-l-lg pl-2.5 pr-1.5 py-1.5 transition ${
                  isActive("/tramite") || isActive("/consulta") || isActive("/registro")
                    ? "bg-white/20 text-white shadow-xs font-bold"
                    : "text-blue-100 hover:bg-white/10 hover:text-white"
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                <span>Trámites</span>
              </Link>
              <button
                type="button"
                onClick={() => setTramitesDropdownOpen((prev) => !prev)}
                aria-expanded={tramitesDropdownOpen}
                aria-haspopup="menu"
                aria-label="Desplegar menú de trámites y servicios ciudadanos"
                className={`flex items-center rounded-r-lg pr-2 py-1.5 transition ${
                  isActive("/tramite") || isActive("/consulta") || isActive("/registro")
                    ? "bg-white/20 text-white"
                    : "text-blue-100 hover:bg-white/10 hover:text-white"
                }`}
              >
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform duration-200 ${
                    tramitesDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
            </div>

            {tramitesDropdownOpen && (
              <div
                role="menu"
                aria-label="Menú de Trámites y Servicios Ciudadanos"
                className="absolute left-0 top-full pt-2 w-[720px] lg:w-[760px] xl:w-[800px] max-w-[calc(100vw-3rem)] z-50 animate-in fade-in slide-in-from-top-2 duration-150"
              >
                <div className="rounded-2xl bg-white text-slate-800 shadow-2xl border border-slate-200/90 p-3.5 sm:p-4 overflow-hidden ring-1 ring-black/5">
                  {/* Cabecera del panel de opciones horizontales */}
                  <div className="flex items-center justify-between pb-2.5 mb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                        Servicios Públicos a la Ciudadanía
                      </p>
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium">
                      Opciones y trámites institucionales digitales
                    </span>
                  </div>

                  {/* Opciones organizadas de manera horizontal */}
                  <div className="grid grid-cols-4 gap-2.5 sm:gap-3">
                    {/* Opción 1: Mesa de Partes Virtual */}
                    <Link
                      to="/tramite"
                      role="menuitem"
                      onClick={() => setTramitesDropdownOpen(false)}
                      className={`flex flex-col justify-between rounded-xl p-3 border transition-all duration-150 group ${
                        isActive("/tramite")
                          ? "bg-blue-50/80 border-blue-300 shadow-xs"
                          : "bg-slate-50/60 border-slate-200/80 hover:bg-blue-50/40 hover:border-blue-200 hover:shadow-xs"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition">
                            <FileText className="h-4 w-4" />
                          </div>
                          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[9px] font-bold text-blue-800">
                            24x7
                          </span>
                        </div>
                        <h3 className="text-xs font-bold text-slate-900 group-hover:text-blue-700 transition leading-snug">
                          Mesa de Partes Virtual
                        </h3>
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                          Radicación de solicitudes y expedientes
                        </p>
                      </div>
                      <span className="mt-3 inline-flex items-center text-[10px] font-semibold text-blue-700 group-hover:translate-x-0.5 transition">
                        Ingresar al trámite →
                      </span>
                    </Link>

                    {/* Opción 2: Consulta Pública CUT */}
                    <Link
                      to="/consulta"
                      role="menuitem"
                      onClick={() => setTramitesDropdownOpen(false)}
                      className={`flex flex-col justify-between rounded-xl p-3 border transition-all duration-150 group ${
                        isActive("/consulta")
                          ? "bg-emerald-50/80 border-emerald-300 shadow-xs"
                          : "bg-slate-50/60 border-slate-200/80 hover:bg-emerald-50/40 hover:border-emerald-200 hover:shadow-xs"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition">
                            <Search className="h-4 w-4" />
                          </div>
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800">
                            CUT
                          </span>
                        </div>
                        <h3 className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 transition leading-snug">
                          Consulta Pública CUT
                        </h3>
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                          Seguimiento del estado de expediente
                        </p>
                      </div>
                      <span className="mt-3 inline-flex items-center text-[10px] font-semibold text-emerald-700 group-hover:translate-x-0.5 transition">
                        Consultar estado →
                      </span>
                    </Link>

                    {/* Opción 3: Validador CVD / QR */}
                    <Link
                      to="/validador-cvd"
                      role="menuitem"
                      onClick={() => setTramitesDropdownOpen(false)}
                      className={`flex flex-col justify-between rounded-xl p-3 border transition-all duration-150 group ${
                        isActive("/validador-cvd")
                          ? "bg-teal-50/80 border-teal-300 shadow-xs"
                          : "bg-slate-50/60 border-slate-200/80 hover:bg-teal-50/40 hover:border-teal-200 hover:shadow-xs"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-100 text-teal-700 group-hover:bg-teal-600 group-hover:text-white transition">
                            <ShieldCheck className="h-4 w-4" />
                          </div>
                          <span className="rounded bg-teal-100 px-1.5 py-0.5 text-[9px] font-bold text-teal-800">
                            QR
                          </span>
                        </div>
                        <h3 className="text-xs font-bold text-slate-900 group-hover:text-teal-700 transition leading-snug">
                          Validador CVD / QR
                        </h3>
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                          Cotejo de integridad y firma digital
                        </p>
                      </div>
                      <span className="mt-3 inline-flex items-center text-[10px] font-semibold text-teal-700 group-hover:translate-x-0.5 transition">
                        Verificar código →
                      </span>
                    </Link>

                    {/* Opción 4: Registro de Administrados */}
                    <Link
                      to="/registro"
                      role="menuitem"
                      onClick={() => setTramitesDropdownOpen(false)}
                      className={`flex flex-col justify-between rounded-xl p-3 border transition-all duration-150 group ${
                        isActive("/registro")
                          ? "bg-indigo-50/80 border-indigo-300 shadow-xs"
                          : "bg-slate-50/60 border-slate-200/80 hover:bg-indigo-50/40 hover:border-indigo-200 hover:shadow-xs"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 group-hover:bg-indigo-600 group-hover:text-white transition">
                            <UserCheck className="h-4 w-4" />
                          </div>
                          <span className="rounded bg-indigo-100 px-1.5 py-0.5 text-[9px] font-bold text-indigo-800">
                            Oficial
                          </span>
                        </div>
                        <h3 className="text-xs font-bold text-slate-900 group-hover:text-indigo-700 transition leading-snug">
                          Registro de Administrados
                        </h3>
                        <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                          Inscripción para casilla y notificaciones
                        </p>
                      </div>
                      <span className="mt-3 inline-flex items-center text-[10px] font-semibold text-indigo-700 group-hover:translate-x-0.5 transition">
                        Registrarse ahora →
                      </span>
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>

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