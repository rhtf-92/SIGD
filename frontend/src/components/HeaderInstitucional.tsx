import { useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Mail, FileText, Search, ShieldCheck, User, Menu, X } from "lucide-react";
import { useAuthStore } from "../stores/authStore";
import SelectorContextoPill from "./auth/SelectorContextoPill";

export default function HeaderInstitucional() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, usuario, cerrarSesion } = useAuthStore();
  const [cerrando, setCerrando] = useState(false);
  const [errorCierre, setErrorCierre] = useState("");
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false);

  let roles: string[] = usuario?.roles ?? (usuario?.rol ? [usuario.rol] : []);
  if (roles.length === 0 && typeof window !== "undefined") {
    try {
      const stored = JSON.parse(window.localStorage.getItem("sigd_roles") ?? "null");
      if (Array.isArray(stored)) {
        roles = stored.filter((r): r is string => typeof r === "string");
      } else {
        const r = window.localStorage.getItem("sigd_rol");
        if (r) roles = [r];
      }
    } catch {
      // fallback
    }
  }

  const tienePermiso = (codigo: string, ambitoGlobalSolo = false): boolean => {
    let facultades = usuario?.permisos;
    if (!facultades && typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem("sigd_facultades");
        if (raw) facultades = JSON.parse(raw);
      } catch {
        facultades = [];
      }
    }
    if (!Array.isArray(facultades)) return false;
    return facultades.some(
      (p: any) =>
        p &&
        p.codigo === codigo &&
        (!ambitoGlobalSolo || (p.ambito === "GLOBAL" && p.areaId === null))
    );
  };

  const esAdmin =
    roles.includes("ADMINISTRADOR") ||
    roles.includes("SUPER_ADMIN") ||
    tienePermiso("ADMIN_USUARIOS", true);

  const puedeFirmar =
    roles.includes("DIRECTOR") ||
    tienePermiso("FIRMA_FIRMAR", true);

  const puedeReportes =
    esAdmin || puedeFirmar || tienePermiso("REPORTE_LEER", true);

  const esVentanilla = roles.includes("MESA_PARTES");
  const esTesorero = roles.includes("TESORERO");
  const esDocente = roles.includes("DOCENTE");
  const esSupervisora =
    roles.includes("COORDINADOR_AREA") ||
    roles.includes("JEFE_UNIDAD_ACADEMICA") ||
    roles.includes("DIRECTOR");

  const puedeProyectar =
    esAdmin ||
    roles.includes("SECRETARIO") ||
    roles.includes("COORDINADOR_AREA") ||
    roles.includes("JEFE_UNIDAD_ACADEMICA");

  const esPersonal =
    esAdmin ||
    puedeFirmar ||
    esVentanilla ||
    puedeProyectar ||
    roles.some((r) =>
      [
        "DOCENTE",
        "COORDINADOR_AREA",
        "JEFE_UNIDAD_ACADEMICA",
      ].includes(r)
    ) ||
    usuario?.capacidadActiva === "GESTOR_APOYO_AREA" ||
    usuario?.contextoActivo?.codigo === "GESTOR_APOYO_AREA" ||
    (Array.isArray(usuario?.capacidades) && usuario.capacidades.includes("GESTOR_APOYO_AREA"));

  const esCiudadano = roles.includes("CIUDADANO") || (!esPersonal && isAuthenticated);

  async function salir() {
    if (cerrando) return;
    setCerrando(true);
    setErrorCierre("");
    try {
      await cerrarSesion();
      setMenuMovilAbierto(false);
      navigate("/");
    } catch (error) {
      console.warn("[HeaderInstitucional] Error durante cierre de sesión, forzando limpieza local:", error);
      useAuthStore.getState().logout();
      setMenuMovilAbierto(false);
      navigate("/");
    } finally {
      setCerrando(false);
      setErrorCierre("");
    }
  }

  function irA(ruta: string) {
    setMenuMovilAbierto(false);
    navigate(ruta);
  }

  return (
    <header className="relative w-full bg-[#004D9E] text-white shadow-md print:hidden z-30">
      <div className="mx-auto flex h-24 w-[92%] max-w-[1600px] items-center justify-between px-2 sm:px-4 lg:px-6">
        {/* Identidad Institucional: Insignia y Nombre */}
        <div
          className="flex min-w-0 cursor-pointer items-center gap-3.5 max-[360px]:gap-2 select-none"
          onClick={() => irA("/")}
        >
          <img
            src="/images/insignia-suiza.png"
            alt="Insignia IESTP Suiza"
            className="h-[76px] w-[76px] max-[360px]:h-12 max-[360px]:w-12 object-contain shrink-0"
          />
          <div className="flex min-w-0 flex-col justify-center leading-tight">
            <span className="text-[11px] sm:text-[13px] lg:text-[14px] font-bold text-white tracking-wide uppercase font-sans">
              INSTITUTO DE EDUCACIÓN SUPERIOR
            </span>
            <span className="text-[11px] sm:text-[13px] lg:text-[14px] font-bold text-white tracking-wide uppercase font-sans">
              TECNOLÓGICO PÚBLICO “SUIZA”
            </span>
          </div>
        </div>

        {/* Navegación Desktop */}
        <nav className="flex items-center gap-3 xl:gap-5 text-[13px] xl:text-[14px] font-medium whitespace-nowrap">
          {!isAuthenticated ? (
            <>
              {/* 1. Casilla Electrónica */}
              <button
                type="button"
                onClick={() => irA("/casilla")}
                className="flex items-center gap-2 text-white hover:text-blue-200 transition cursor-pointer"
              >
                <Mail className="w-5 h-5 shrink-0" aria-hidden="true" />
                <span>Casilla Electrónica</span>
              </button>

              <div className="h-6 w-[1px] bg-white/30 hidden xl:block" />

              {/* 2. Mesa de Partes */}
              <button
                type="button"
                onClick={() => irA("/tramite")}
                className={`flex items-center gap-2 transition cursor-pointer ${
                  location.pathname.startsWith("/tramite") || location.pathname.startsWith("/mesa-partes")
                    ? "text-white font-bold border-b-2 border-white pb-0.5"
                    : "text-white hover:text-blue-200"
                }`}
              >
                <FileText className="w-5 h-5 shrink-0" aria-hidden="true" />
                <span>Mesa de Partes</span>
              </button>

              <div className="h-6 w-[1px] bg-white/30 hidden xl:block" />

              {/* 3. Consulta de Trámite */}
              <button
                type="button"
                onClick={() => irA("/consulta")}
                className={`flex items-center gap-2 transition cursor-pointer ${
                  location.pathname.startsWith("/consulta")
                    ? "text-white font-bold border-b-2 border-white pb-0.5"
                    : "text-white hover:text-blue-200"
                }`}
              >
                <Search className="w-5 h-5 shrink-0" aria-hidden="true" />
                <span>Consulta de Trámite</span>
              </button>

              <div className="h-6 w-[1px] bg-white/30 hidden xl:block" />

              {/* 4. Validador CVD */}
              <button
                type="button"
                onClick={() => irA("/validador-cvd")}
                className={`flex items-center gap-2 transition cursor-pointer ${
                  location.pathname.startsWith("/validador")
                    ? "text-white font-bold border-b-2 border-white pb-0.5"
                    : "text-white hover:text-blue-200"
                }`}
              >
                <ShieldCheck className="w-5 h-5 shrink-0" aria-hidden="true" />
                <span>Validador CVD</span>
              </button>

              <div className="h-6 w-[1px] bg-white/30 hidden xl:block" />

              {/* 5. Iniciar Sesión */}
              <button
                type="button"
                onClick={() => irA("/login")}
                className="flex items-center justify-center gap-2 bg-[#0073E6] hover:bg-[#005fb8] text-white font-semibold rounded-full px-6 h-12 shadow-sm transition cursor-pointer min-w-[168px]"
              >
                <User className="w-5 h-5 shrink-0" aria-hidden="true" />
                <span>Iniciar Sesión</span>
              </button>
            </>
          ) : (
            <>
              {esCiudadano && !esPersonal && (
                <>
                  <button
                    type="button"
                    onClick={() => irA("/casilla")}
                    className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-white hover:bg-white/20 transition cursor-pointer"
                  >
                    <Mail className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>Casilla Electrónica</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => irA("/tramite")}
                    className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-white hover:bg-white/20 transition cursor-pointer"
                  >
                    <FileText className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>Nuevo Trámite</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => irA("/consulta")}
                    className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-white hover:bg-white/20 transition cursor-pointer"
                  >
                    <Search className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>Consulta de Trámite</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => irA("/validador-cvd")}
                    className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-white hover:bg-white/20 transition cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>Validador CVD</span>
                  </button>
                </>
              )}

              {esPersonal && (
                <>
                  {esVentanilla && (
                    <button
                      type="button"
                      onClick={() => irA("/tramite/ventanilla-presencial")}
                      className="rounded-lg bg-white/10 px-3 py-1.5 text-white hover:bg-white/20 transition cursor-pointer"
                    >
                      Ventanilla Presencial
                    </button>
                  )}
                  {puedeProyectar && (
                    <button
                      type="button"
                      onClick={() => irA("/flujos/proyector-resoluciones")}
                      className="rounded-lg bg-white/10 px-3 py-1.5 text-white hover:bg-white/20 transition cursor-pointer"
                    >
                      Resoluciones
                    </button>
                  )}
                  {puedeFirmar && (
                    <button
                      type="button"
                      onClick={() => irA("/flujo-validez-legal/firma")}
                      className="rounded-lg bg-white/10 px-3 py-1.5 text-white hover:bg-white/20 transition cursor-pointer"
                    >
                      Firma Digital
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => irA("/expedientes")}
                    className="rounded-lg bg-white/10 px-3 py-1.5 text-white hover:bg-white/20 transition cursor-pointer"
                  >
                    Bandeja
                  </button>
                  {esDocente && (
                    <button
                      type="button"
                      onClick={() => irA("/expedientes/mis-evaluaciones")}
                      className="rounded-lg bg-white/10 px-3 py-1.5 text-white hover:bg-white/20 transition cursor-pointer"
                    >
                      Mis Evaluaciones
                    </button>
                  )}
                  {esSupervisora && (
                    <button
                      type="button"
                      onClick={() => irA("/expedientes/supervision")}
                      className="rounded-lg bg-white/10 px-3 py-1.5 text-white hover:bg-white/20 transition cursor-pointer"
                    >
                      Supervisión Académica
                    </button>
                  )}
                  {puedeReportes && (
                    <button
                      type="button"
                      onClick={() => irA("/reportes/dashboard")}
                      className="rounded-lg bg-white/10 px-3 py-1.5 text-white hover:bg-white/20 transition cursor-pointer"
                    >
                      Reportes
                    </button>
                  )}
                  {esAdmin && (
                    <button
                      type="button"
                      onClick={() => irA("/administracion")}
                      className="rounded-lg bg-white/10 px-3 py-1.5 text-white hover:bg-white/20 transition cursor-pointer"
                    >
                      Administración
                    </button>
                  )}
                </>
              )}

              {esTesorero && (
                <button
                  type="button"
                  onClick={() => irA("/tesoreria")}
                  className="rounded-lg bg-white/10 px-3 py-1.5 text-white hover:bg-white/20 transition cursor-pointer"
                >
                  Tesorería
                </button>
              )}

              <SelectorContextoPill />

              <button
                type="button"
                onClick={() => void salir()}
                disabled={cerrando}
                className="rounded-lg bg-white/15 px-3.5 py-1.5 text-white hover:bg-white/25 transition disabled:opacity-50 font-medium cursor-pointer"
              >
                {cerrando ? "Cerrando sesión…" : "Cerrar sesión"}
              </button>
            </>
          )}
        </nav>

        {/* Controles para Móviles y Tablets */}
        <div className="hidden shrink-0 items-center gap-2">
          {!isAuthenticated ? (
            <button
              type="button"
              onClick={() => irA("/login")}
              className="flex items-center justify-center gap-1.5 bg-[#0073E6] hover:bg-[#005fb8] text-white font-semibold rounded-full px-3.5 h-10 text-xs shadow-sm transition"
            >
              <User className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>Ingresar</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void salir()}
              disabled={cerrando}
              className="rounded-lg bg-white/15 px-3 py-1.5 text-white text-xs font-medium"
            >
              {cerrando ? "Cerrando…" : "Salir"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setMenuMovilAbierto(!menuMovilAbierto)}
            className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition cursor-pointer"
            aria-label={menuMovilAbierto ? "Cerrar menú" : "Abrir menú"}
          >
            {menuMovilAbierto ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Menú Desplegable Móvil */}
      {menuMovilAbierto && (
        <div className="hidden w-full bg-[#003b7a] border-t border-white/15 px-4 py-4 space-y-2 shadow-lg animate-in fade-in duration-150">
          {!isAuthenticated ? (
            <>
              <button
                type="button"
                onClick={() => irA("/casilla")}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white hover:bg-white/10 text-left font-medium text-[13px]"
              >
                <Mail className="w-5 h-5 text-blue-300" />
                <span>Casilla Electrónica</span>
              </button>
              <button
                type="button"
                onClick={() => irA("/tramite")}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white hover:bg-white/10 text-left font-medium text-[13px]"
              >
                <FileText className="w-5 h-5 text-blue-300" />
                <span>Mesa de Partes Virtual</span>
              </button>
              <button
                type="button"
                onClick={() => irA("/consulta")}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white hover:bg-white/10 text-left font-medium text-[13px]"
              >
                <Search className="w-5 h-5 text-blue-300" />
                <span>Consulta de Trámite</span>
              </button>
              <button
                type="button"
                onClick={() => irA("/validador-cvd")}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-white hover:bg-white/10 text-left font-medium text-[13px]"
              >
                <ShieldCheck className="w-5 h-5 text-blue-300" />
                <span>Validador CVD</span>
              </button>
              <button
                type="button"
                onClick={() => irA("/login")}
                className="w-full flex items-center justify-center gap-2 mt-2 bg-[#0073E6] hover:bg-[#005fb8] text-white font-semibold rounded-lg py-2.5 text-[13px]"
              >
                <User className="w-4 h-4" />
                <span>Iniciar Sesión</span>
              </button>
            </>
          ) : (
            <>
              {esCiudadano && !esPersonal && (
                <>
                  <button
                    type="button"
                    onClick={() => irA("/casilla")}
                    className="w-full flex items-center gap-3 px-3 py-2 text-white hover:bg-white/10 text-left text-sm"
                  >
                    <Mail className="w-4 h-4 text-blue-300" />
                    <span>Casilla Electrónica</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => irA("/tramite")}
                    className="w-full flex items-center gap-3 px-3 py-2 text-white hover:bg-white/10 text-left text-sm"
                  >
                    <FileText className="w-4 h-4 text-blue-300" />
                    <span>Nuevo Trámite</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => irA("/consulta")}
                    className="w-full flex items-center gap-3 px-3 py-2 text-white hover:bg-white/10 text-left text-sm"
                  >
                    <Search className="w-4 h-4 text-blue-300" />
                    <span>Consulta de Trámite</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => irA("/validador-cvd")}
                    className="w-full flex items-center gap-3 px-3 py-2 text-white hover:bg-white/10 text-left text-sm"
                  >
                    <ShieldCheck className="w-4 h-4 text-blue-300" />
                    <span>Validador CVD</span>
                  </button>
                </>
              )}
              {esPersonal && (
                <>
                  {esVentanilla && (
                    <button
                      type="button"
                      onClick={() => irA("/tramite/ventanilla-presencial")}
                      className="w-full px-3 py-2 text-white hover:bg-white/10 text-left text-sm"
                    >
                      Ventanilla Presencial
                    </button>
                  )}
                  {puedeProyectar && (
                    <button
                      type="button"
                      onClick={() => irA("/flujos/proyector-resoluciones")}
                      className="w-full px-3 py-2 text-white hover:bg-white/10 text-left text-sm"
                    >
                      Resoluciones
                    </button>
                  )}
                  {puedeFirmar && (
                    <button
                      type="button"
                      onClick={() => irA("/flujo-validez-legal/firma")}
                      className="w-full px-3 py-2 text-white hover:bg-white/10 text-left text-sm"
                    >
                      Firma Digital
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => irA("/expedientes")}
                    className="w-full px-3 py-2 text-white hover:bg-white/10 text-left text-sm"
                  >
                    Bandeja
                  </button>
                  {esDocente && (
                    <button
                      type="button"
                      onClick={() => irA("/expedientes/mis-evaluaciones")}
                      className="w-full px-3 py-2 text-white hover:bg-white/10 text-left text-sm"
                    >
                      Mis Evaluaciones
                    </button>
                  )}
                  {esSupervisora && (
                    <button
                      type="button"
                      onClick={() => irA("/expedientes/supervision")}
                      className="w-full px-3 py-2 text-white hover:bg-white/10 text-left text-sm"
                    >
                      Supervisión Académica
                    </button>
                  )}
                  {puedeReportes && (
                    <button
                      type="button"
                      onClick={() => irA("/reportes/dashboard")}
                      className="w-full px-3 py-2 text-white hover:bg-white/10 text-left text-sm"
                    >
                      Reportes
                    </button>
                  )}
                  {esAdmin && (
                    <button
                      type="button"
                      onClick={() => irA("/administracion")}
                      className="w-full px-3 py-2 text-white hover:bg-white/10 text-left text-sm"
                    >
                      Administración
                    </button>
                  )}
                </>
              )}
              {esTesorero && (
                <button
                  type="button"
                  onClick={() => irA("/tesoreria")}
                  className="w-full px-3 py-2 text-white hover:bg-white/10 text-left text-sm"
                >
                  Tesorería
                </button>
              )}
            </>
          )}
        </div>
      )}

      {errorCierre && (
        <div className="bg-red-950/70 border-t border-red-500/40 px-4 py-2 text-center text-xs text-red-200">
          <p role="alert" className="inline-flex items-center gap-2">
            <span>⚠️</span>
            <span>{errorCierre}</span>
          </p>
        </div>
      )}
    </header>
  );
}
