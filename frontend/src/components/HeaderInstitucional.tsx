import { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Menu,
  X,
  LogOut,
  ChevronDown,
  Phone,
  Mail,
  MapPin,
  HelpCircle,
  User,
} from "lucide-react";
import { useAuthStore, type ContextoOperativo } from "../stores/authStore";
import { obtenerInfoArea } from "../utils/areaPresentacion";
import logoSuiza from "../assets/sigd/logo-suiza.webp";
import {
  NAV_ITEMS_PUBLICOS,
  NAV_ITEMS_POR_ROL,
  canAccessRoute,
  type RolCanonica,
  type NavItem,
} from "../config/navigation.config";

export const NAV_ITEMS_PERSONAL: readonly NavItem[] = [
  { etiqueta: "Inicio", ruta: "/" },
  { etiqueta: "Nuevo Trámite", ruta: "/mesa-partes" },
  { etiqueta: "Mis Expedientes", ruta: "/mis-expedientes" },
  { etiqueta: "Casilla Electrónica", ruta: "/casilla" },
  { etiqueta: "Catálogo TUPA", ruta: "/tupa" },
  { etiqueta: "Consulta CUT", ruta: "/consulta" },
];

function getIniciales(nombre?: string | null): string {
  if (!nombre) return "GS";
  const parts = nombre.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "GS";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export default function HeaderInstitucional() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [switchingContext, setSwitchingContext] = useState(false);
  const moreDropdownRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const usuario = useAuthStore((state) => state.usuario);
  const contextoActivo = useAuthStore((state) => state.contextoActivo);
  const contextosDisponibles = useAuthStore((state) => state.contextosDisponibles);
  const cambiarContexto = useAuthStore((state) => state.cambiarContexto);
  const logout = useAuthStore((state) => state.logout);

  const tieneMultiplesContextos = isAuthenticated && contextosDisponibles.length > 1;
  const esContextoInstitucional =
    usuario?.contexto === "INSTITUCIONAL" ||
    contextoActivo === "INSTITUCIONAL" ||
    Boolean(usuario && usuario.rol !== "CIUDADANO" && !tieneMultiplesContextos);

  let navItems: readonly NavItem[] = NAV_ITEMS_PUBLICOS;
  if (isAuthenticated && usuario?.rol) {
    if (usuario.rol === "CIUDADANO" || !esContextoInstitucional) {
      navItems = NAV_ITEMS_PERSONAL;
    } else {
      const baseItems = [...(NAV_ITEMS_POR_ROL[usuario.rol as RolCanonica] || [])];
      if (usuario.perfiles?.includes("GESTOR_TESORERIA") && !baseItems.some((i) => i.ruta === "/tesoreria")) {
        baseItems.push({ etiqueta: "Módulo Tesorería", ruta: "/tesoreria" });
      }
      navItems = baseItems.filter((item) =>
        canAccessRoute(usuario.rol as RolCanonica, item.ruta, {
          contexto: "INSTITUCIONAL",
          perfiles: usuario.perfiles,
        })
      );
    }
  }

  const itemsSecundarios = isAuthenticated && navItems.length > 3 ? navItems.slice(3) : [];
  const tieneSecundarios = itemsSecundarios.length > 0;

  useEffect(() => {
    if (!isMoreOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (moreDropdownRef.current && !moreDropdownRef.current.contains(event.target as Node)) {
        setIsMoreOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMoreOpen]);

  useEffect(() => {
    if (!isUserMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isUserMenuOpen]);

  const handleSwitchContext = async (nuevo: ContextoOperativo) => {
    if (nuevo === contextoActivo || switchingContext) return;
    try {
      setSwitchingContext(true);
      await cambiarContexto(nuevo);
      setIsUserMenuOpen(false);
      setIsMobileMenuOpen(false);
      if (nuevo === "INSTITUCIONAL") {
        navigate("/expedientes");
      } else {
        navigate("/mesa-partes");
      }
    } catch (err) {
      console.error("Error al cambiar contexto operativo:", err);
    } finally {
      setSwitchingContext(false);
    }
  };

  const handleLogout = () => {
    logout();
    setIsMobileMenuOpen(false);
    setIsMoreOpen(false);
    navigate("/login", { replace: true });
  };

  const handleNavigate = (ruta: string) => {
    setIsMobileMenuOpen(false);
    setIsMoreOpen(false);
    if (ruta === "/tramite" || ruta === "/mesa-partes") {
      navigate("/mesa-partes", { state: { nuevoTramite: true, t: Date.now() } });
    } else {
      navigate(ruta);
    }
  };

  const infoArea = usuario && usuario.rol !== "CIUDADANO"
    ? obtenerInfoArea(usuario.areaId, null, usuario.rol)
    : null;

  return (
    <header className="header-sigd sticky top-0 z-40 bg-white border-b border-slate-200 shadow-2xs print:hidden">
      {/* 0. Barra Superior de Contacto Institucional Oficial (Diseño Aprobado SIGD — Traslado de index.html) */}
      <div className="sigd-top-contact">
        <div className="sigd-contacts">
          <a className="sigd-contact" href="tel:061280665">
            <Phone className="h-3.5 w-3.5 text-sky-300 shrink-0" />
            <span>061-280665</span>
          </a>
          <span className="sigd-separator" aria-hidden="true" />
          <a className="sigd-contact" href="mailto:suiza@iestpsuiza.edu.pe">
            <Mail className="h-3.5 w-3.5 text-sky-300 shrink-0" />
            <span>suiza@iestpsuiza.edu.pe</span>
          </a>
          <span className="sigd-separator" aria-hidden="true" />
          <span className="sigd-contact">
            <MapPin className="h-3.5 w-3.5 text-sky-300 shrink-0" />
            <span>Av. Tupac Amaru s/n, Pucallpa – Ucayali</span>
          </span>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1640px] items-center justify-between px-3 sm:px-6 lg:px-8 py-1.5 sm:py-2">
        {/* 1. Identidad Institucional Oficial (Logo + IESTP SUIZA -> SIGD) */}
        <Link
          to="/"
          onClick={() => setIsMobileMenuOpen(false)}
          className="flex cursor-pointer items-center gap-2.5 sm:gap-3.5 no-underline text-slate-900 hover:opacity-95 transition shrink-0 py-0.5"
        >
          <img
            src={logoSuiza}
            alt="IESTP Suiza"
            width={52}
            height={53}
            loading="eager"
            decoding="async"
            fetchPriority="high"
            className="h-11 w-auto sm:h-12 lg:h-[50px] shrink-0 object-contain aspect-[256/261]"
          />
          <div className="flex items-center gap-2 sm:gap-3 lg:gap-3.5 shrink-0">
            <div className="shrink-0">
              <span className="text-sm sm:text-base lg:text-[18px] font-black tracking-tight text-[#062348] block leading-none uppercase whitespace-nowrap">
                IESTP SUIZA
              </span>
              <div className="mt-1 leading-[1.22] text-[10.5px] sm:text-[11px] lg:text-[11.5px] text-[#1c3d69] font-semibold whitespace-nowrap">
                <span className="block whitespace-nowrap">Instituto de Educación Superior</span>
                <span className="block whitespace-nowrap">Tecnológico Público</span>
              </div>
            </div>
            <div className="hidden min-[1380px]:block h-9 w-[1.5px] bg-[#0c66be] shrink-0 self-center mx-1.5 lg:mx-2.5" aria-hidden="true" />
            <div className="hidden min-[1380px]:block w-[145px] lg:w-[152px] leading-[1.2] shrink-0">
              <span className="text-[12.5px] lg:text-[13px] font-extrabold text-[#062348] block tracking-tight">
                Sistema Integral de Gestión Documentaria
              </span>
            </div>
          </div>
        </Link>

        {/* 2. Navegación Desktop */}
        <nav
          aria-label="Navegación principal"
          className="hidden min-[700px]:flex items-center gap-1 min-[960px]:gap-1.5 lg:gap-2 text-[12.5px] min-[960px]:text-[13px] lg:text-[13.5px]"
        >
          {navItems.map((item, index) => {
            const isActive = location.pathname === item.ruta;
            const esSecundario = tieneSecundarios && index >= 3;
            const responsiveClass = esSecundario ? "hidden min-[1280px]:inline-flex" : "inline-flex";

            if (item.etiqueta === "Ingresar") {
              return (
                <div key={item.ruta} className={`items-center ${responsiveClass}`}>
                  <div className="h-6 w-[1.5px] bg-slate-300 mx-1.5 min-[960px]:mx-2.5 lg:mx-3" aria-hidden="true" />
                  <button
                    type="button"
                    onClick={() => handleNavigate(item.ruta)}
                    className="sigd-btn-ingresar !px-3 min-[960px]:!px-4.5 !py-1.5 min-[960px]:!py-2 !min-h-[36px] min-[960px]:!min-h-[40px] !text-xs min-[960px]:!text-[13.5px]"
                  >
                    <User className="h-3.5 w-3.5 min-[960px]:h-4 min-[960px]:w-4 shrink-0" />
                    <span>Ingresar</span>
                  </button>
                </div>
              );
            }
            if (item.etiqueta === "Ayuda") {
              return (
                <button
                  key={item.ruta}
                  type="button"
                  onClick={() => handleNavigate(item.ruta)}
                  className={`group rounded-xl px-2.5 min-[960px]:px-3.5 lg:px-4 py-1.5 min-[960px]:py-2 text-[12.5px] min-[960px]:text-[13px] lg:text-[13.5px] transition-all duration-150 whitespace-nowrap cursor-pointer items-center gap-1 min-[960px]:gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${responsiveClass} ${
                    isActive
                      ? "bg-[#e0f2fe] text-[#025cae] font-bold border border-sky-200/80 shadow-2xs"
                      : "text-[#082752] font-semibold hover:bg-[#e0f2fe] hover:text-[#025cae] hover:font-bold border border-transparent"
                  }`}
                >
                  <HelpCircle className={`h-3.5 w-3.5 min-[960px]:h-4 min-[960px]:w-4 transition-colors ${
                    isActive ? "text-[#025cae]" : "text-[#082752] group-hover:text-[#025cae]"
                  }`} />
                  <span>{item.etiqueta}</span>
                </button>
              );
            }
            return (
              <button
                key={item.ruta}
                type="button"
                onClick={() => handleNavigate(item.ruta)}
                className={`rounded-xl px-2.5 min-[960px]:px-3.5 lg:px-4 py-1.5 min-[960px]:py-2 text-[12.5px] min-[960px]:text-[13px] lg:text-[13.5px] transition-all duration-150 whitespace-nowrap cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${responsiveClass} ${
                  isActive
                    ? "bg-[#e0f2fe] text-[#025cae] font-bold border border-sky-200/80 shadow-2xs"
                    : "text-[#082752] font-semibold hover:bg-[#e0f2fe] hover:text-[#025cae] hover:font-bold border border-transparent"
                }`}
              >
                {item.etiqueta}
              </button>
            );
          })}

          {/* Menú Desplegable "Más trámites" para Pantallas Intermedias (700px a 1279px) */}
          {tieneSecundarios && (
            <div className="relative inline-flex min-[1280px]:hidden" ref={moreDropdownRef}>
              <button
                type="button"
                onClick={() => setIsMoreOpen((prev) => !prev)}
                aria-expanded={isMoreOpen}
                aria-haspopup="true"
                className={`rounded-xl px-2.5 min-[960px]:px-3 py-1.5 min-[960px]:py-2 text-[12.5px] min-[960px]:text-[13px] font-semibold transition-all duration-150 whitespace-nowrap cursor-pointer inline-flex items-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                  isMoreOpen || itemsSecundarios.some((it) => location.pathname === it.ruta)
                    ? "bg-[#e0f2fe] text-[#025cae] font-bold border border-sky-200/80 shadow-2xs"
                    : "text-[#082752] hover:bg-[#e0f2fe] hover:text-[#025cae] hover:font-bold border border-transparent"
                }`}
                title="Más opciones de trámite"
              >
                <span>Más</span>
                <ChevronDown
                  className={`h-3.5 w-3.5 transition-transform duration-200 ${
                    isMoreOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {isMoreOpen && (
                <div
                  role="menu"
                  aria-orientation="vertical"
                  className="absolute right-0 top-full mt-1.5 w-52 rounded-xl bg-white border border-slate-200 shadow-lg py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150"
                >
                  <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
                    Trámites adicionales
                  </div>
                  {itemsSecundarios.map((item) => {
                    const isActive = location.pathname === item.ruta;
                    return (
                      <button
                        key={`dropdown-${item.ruta}`}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setIsMoreOpen(false);
                          handleNavigate(item.ruta);
                        }}
                        className={`w-full text-left px-3.5 py-2 text-xs font-semibold flex items-center justify-between transition cursor-pointer ${
                          isActive
                            ? "bg-blue-50 text-blue-700 font-bold"
                            : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                        }`}
                      >
                        <span>{item.etiqueta}</span>
                        {isActive && <span className="h-1.5 w-1.5 rounded-full bg-blue-600 shrink-0 ml-2" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Bloque de Usuario Autenticado / Menú "Mi cuenta" */}
          {isAuthenticated && usuario && (
            <div ref={userMenuRef} className="relative ml-2 flex items-center gap-2.5 border-l border-slate-200 pl-3">
              {!tieneMultiplesContextos && usuario.rol === "CIUDADANO" ? (
                /* Un solo contexto y CIUDADANO: link directo oficial a Mi cuenta */
                <div className="flex items-center gap-2">
                  <div
                    className="h-7 w-7 rounded-full bg-blue-100 border border-blue-300 text-blue-700 font-bold text-[11px] flex items-center justify-center shrink-0 shadow-2xs select-none"
                    aria-hidden="true"
                  >
                    {getIniciales(usuario.nombreCompleto)}
                  </div>
                  <Link
                    to="/mi-perfil"
                    className="text-xs font-bold text-slate-900 leading-tight hover:text-blue-700 hover:underline"
                  >
                    Mi cuenta
                  </Link>
                </div>
              ) : !tieneMultiplesContextos ? (
                /* Un solo contexto institucional: datos sobrios sin selector */
                <div className="flex items-center gap-2">
                  <div
                    className="h-7 w-7 rounded-full bg-blue-100 border border-blue-300 text-blue-700 font-bold text-[11px] flex items-center justify-center shrink-0 shadow-2xs select-none"
                    aria-hidden="true"
                  >
                    {getIniciales(usuario.nombreCompleto)}
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-900 leading-tight max-w-[140px] lg:max-w-none truncate">
                      {usuario.nombreCompleto}
                    </p>
                    <p className="text-[11px] text-slate-500 font-medium leading-tight">
                      <span className="font-semibold text-slate-700">{usuario.rol}</span>
                      {infoArea?.nombre && <> · {infoArea.nombre}</>}
                    </p>
                  </div>
                </div>
              ) : (
                /* Varios contextos autorizados: trigger accesible para desplegar "Mi cuenta" / Modo de operación */
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  aria-haspopup="true"
                  aria-expanded={isUserMenuOpen}
                  aria-label="Menú de cuenta y modo de operación"
                  className="flex items-center gap-2 rounded-lg p-1 -m-1 hover:bg-slate-50 transition cursor-pointer group text-left"
                >
                  <div
                    className="h-7 w-7 rounded-full bg-blue-100 border border-blue-300 text-blue-700 font-bold text-[11px] flex items-center justify-center shrink-0 shadow-2xs select-none"
                    aria-hidden="true"
                  >
                    {getIniciales(usuario.nombreCompleto)}
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <span className="text-xs font-bold text-slate-900 leading-tight max-w-[140px] lg:max-w-none truncate group-hover:text-blue-700">
                        {usuario.nombreCompleto || "Mi cuenta"}
                      </span>
                      <ChevronDown className={`h-3 w-3 text-slate-400 group-hover:text-slate-600 transition-transform ${isUserMenuOpen ? "rotate-180" : ""}`} />
                    </div>
                    <p className="text-[10px] text-slate-500 font-medium leading-tight">
                      {contextoActivo === "INSTITUCIONAL" ? (
                        <>
                          <span className="font-semibold text-slate-700">{usuario.rol}</span>
                          {infoArea?.nombre && <> · {infoArea.nombre}</>}
                        </>
                      ) : (
                        <span className="font-semibold text-slate-600">Mis trámites personales</span>
                      )}
                    </p>
                  </div>
                </button>
              )}

              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 px-2.5 py-1 text-xs font-semibold transition cursor-pointer shadow-2xs"
              >
                Salir
              </button>

              {/* Menú Flotante "Mi cuenta" y Modo de Operación (Solo cuando tiene múltiples contextos) */}
              {isUserMenuOpen && tieneMultiplesContextos && (
                <div
                  role="menu"
                  aria-orientation="vertical"
                  className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-slate-200 bg-white py-2 shadow-lg z-50 animate-in fade-in duration-100 divide-y divide-slate-100"
                >
                  <div className="px-3 py-2">
                    <p className="text-xs font-bold text-slate-900 truncate">{usuario.nombreCompleto}</p>
                    <p className="text-[11px] text-slate-500 truncate">{usuario.correo ?? "Usuario SIGD"}</p>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-slate-600">
                        Rol: <span className="font-bold text-slate-900">{usuario.rol}</span>
                      </span>
                      <Link
                        to="/mi-perfil"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="text-[11px] font-bold text-blue-700 hover:underline"
                        role="menuitem"
                      >
                        Ver perfil
                      </Link>
                    </div>
                  </div>

                  {/* Sección Modo de Operación */}
                  <div className="px-2 py-1.5">
                    <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Modo de operación
                    </div>
                    <div className="space-y-1">
                      {contextosDisponibles.map((ctx) => {
                        const esActivo = ctx.tipo === contextoActivo;
                        const etiqueta = ctx.tipo === "INSTITUCIONAL" ? "Funciones de mi cargo" : "Mis trámites personales";
                        const subtexto = ctx.tipo === "INSTITUCIONAL"
                          ? (ctx.rol ? `${ctx.rol}${infoArea?.nombre ? ` · ${infoArea.nombre}` : ''}` : ctx.descripcion)
                          : "Gestión de mis solicitudes y casilla electrónica";
                        return (
                          <button
                            key={`dropdown-ctx-${ctx.tipo}`}
                            type="button"
                            role="menuitem"
                            disabled={switchingContext}
                            onClick={() => handleSwitchContext(ctx.tipo)}
                            className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-semibold flex items-center justify-between transition cursor-pointer ${
                              esActivo
                                ? "bg-blue-50 text-blue-700 border border-blue-200/80 font-bold"
                                : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                            }`}
                          >
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span>{etiqueta}</span>
                                {esActivo && (
                                  <span className="rounded bg-blue-200/70 text-blue-800 text-[9px] px-1.5 py-0.2 font-bold uppercase">
                                    Activo
                                  </span>
                                )}
                              </div>
                              <p className="text-[10px] font-normal text-slate-500 mt-0.5 line-clamp-1">
                                {subtexto}
                              </p>
                            </div>
                            {esActivo && <span className="h-2 w-2 rounded-full bg-blue-600 shrink-0 ml-2" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="px-2 pt-1.5 pb-0.5">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleLogout}
                      className="w-full text-left px-2.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 rounded-lg flex items-center gap-2 transition cursor-pointer"
                    >
                      <LogOut className="h-3.5 w-3.5" />
                      <span>Cerrar sesión</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </nav>

        {/* 4. Acciones Mobile (< 700px, Touch target >= 44x44px) */}
        <div className="flex min-[700px]:hidden items-center gap-2">
          {isAuthenticated && usuario && (
            <div
              className="flex items-center gap-1.5 rounded-lg bg-slate-100 border border-slate-200 px-2 py-1 text-slate-800 text-xs"
              title={`Sesión: ${usuario.rol}`}
            >
              <div
                className="h-5 w-5 rounded-full bg-blue-100 border border-blue-300 text-blue-700 font-bold text-[10px] flex items-center justify-center shrink-0 select-none"
                aria-hidden="true"
              >
                {getIniciales(usuario.nombreCompleto)}
              </div>
              {!tieneMultiplesContextos && usuario.rol === "CIUDADANO" ? (
                <Link to="/mi-perfil" className="font-bold text-[11px] text-slate-900 hover:underline">
                  Mi cuenta
                </Link>
              ) : (
                <span className="font-semibold text-[11px] truncate max-w-[90px]">
                  {usuario.nombreCompleto?.split(" ")[0] || "Mi cuenta"}
                </span>
              )}
            </div>
          )}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            aria-label={isMobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={isMobileMenuOpen}
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* 5. Menú Desplegable Mobile (< 700px) */}
      {isMobileMenuOpen && (
        <div className="min-[700px]:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-3 shadow-inner animate-in fade-in duration-150">
          {isAuthenticated && usuario && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-900">{usuario.nombreCompleto}</p>
                  <p className="text-[11px] text-slate-500">{usuario.correo ?? "Usuario SIGD"}</p>
                </div>
                <div className="text-right">
                  {contextoActivo === "INSTITUCIONAL" && (
                    <>
                      <span className="rounded bg-blue-100 border border-blue-200 px-1.5 py-0.5 text-[9px] font-bold text-blue-800 uppercase block">
                        {usuario.rol}
                      </span>
                      {infoArea && (
                        <span className="text-[10px] text-slate-500 block mt-0.5" title={infoArea.descripcion}>
                          {infoArea.nombre}
                        </span>
                      )}
                    </>
                  )}
                  {contextoActivo === "PERSONAL" && (
                    <span className="text-[10px] text-slate-500 block font-medium">
                      Mis trámites personales
                    </span>
                  )}
                </div>
              </div>

              {/* Modo de operación Móvil (solo si tiene múltiples contextos) */}
              {tieneMultiplesContextos && (
                <div className="rounded-lg border border-slate-200 bg-white p-2.5 space-y-1.5">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-0.5">
                    Modo de operación
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {contextosDisponibles.map((ctx) => {
                      const esActivo = ctx.tipo === contextoActivo;
                      const etiqueta = ctx.tipo === "INSTITUCIONAL" ? "Funciones de mi cargo" : "Mis trámites personales";
                      const subtexto = ctx.tipo === "INSTITUCIONAL" ? (ctx.rol ?? "Gestión") : "Personal";
                      return (
                        <button
                          key={`mobile-ctx-${ctx.tipo}`}
                          type="button"
                          disabled={switchingContext}
                          onClick={() => handleSwitchContext(ctx.tipo)}
                          className={`min-h-[44px] px-2 py-1.5 rounded-lg text-xs font-bold transition flex flex-col items-center justify-center cursor-pointer ${
                            esActivo
                              ? "bg-blue-600 text-white shadow-2xs"
                              : "bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          <span>{etiqueta}</span>
                          <span className={`text-[9px] font-normal ${esActivo ? "text-blue-100" : "text-slate-400"}`}>
                            {subtexto}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleLogout}
                className="w-full min-h-[44px] flex items-center justify-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-700 px-3 py-2 text-xs font-bold text-white transition shadow-2xs cursor-pointer"
              >
                <LogOut className="h-4 w-4" /> Cerrar sesión
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
                  className={`w-full min-h-[44px] flex items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold transition cursor-pointer ${
                    isActive
                      ? "bg-blue-50 text-blue-700 border border-blue-200 font-bold shadow-2xs"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <span>{item.etiqueta}</span>
                  {isActive && <span className="h-2 w-2 rounded-full bg-blue-600" />}
                </button>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}
