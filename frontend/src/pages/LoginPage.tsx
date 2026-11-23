import { useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AUTH_RETURN_TO_STORAGE_KEY, useAuthStore } from "../stores/authStore";
import { ApiHttpError } from "../types/api";
import SelectorContextoModal from "../components/auth/SelectorContextoModal";

const DESTINOS_POR_ROL: Record<string, string> = {
  ADMINISTRADOR: "/administracion",
  CIUDADANO: "/casilla",
  SECRETARIO: "/expedientes",
  SUPER_ADMIN: "/administracion",
  DIRECTOR: "/expedientes",
  JEFE_UNIDAD_ACADEMICA: "/expedientes",
  COORDINADOR_AREA: "/expedientes",
  DOCENTE: "/flujos/titulacion",
  MESA_PARTES: "/tramite/ventanilla-presencial",
  ESTUDIANTE: "/casilla",
  GESTOR_APOYO_AREA: "/expedientes",
  TESORERO: "/tesoreria",
};

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((state) => state.login);
  const [identificador, setIdentificador] = useState("");
  const [password, setPassword] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mostrarSelector, setMostrarSelector] = useState(false);
  const enviando = useRef(false);

  function redirigirSegunContexto() {
    const usuario = useAuthStore.getState().usuario;
    const codigoContexto = usuario?.rol || usuario?.capacidadActiva || usuario?.contextoActivo?.codigo || "";
    const esAdministrador = Boolean(
      usuario?.roles?.some((r) => r === "ADMINISTRADOR" || r === "SUPER_ADMIN") ||
      codigoContexto === "ADMINISTRADOR" ||
      codigoContexto === "SUPER_ADMIN" ||
      usuario?.permisos?.some(
        (p) => p.codigo === "ADMIN_USUARIOS" && p.ambito === "GLOBAL" && p.areaId === null,
      ),
    );
    const routeState = location.state as { from?: { pathname?: unknown; search?: unknown; hash?: unknown } } | null;
    const statePath = routeState?.from;
    const returnFromState = statePath && typeof statePath.pathname === "string"
      ? `${statePath.pathname}${typeof statePath.search === "string" ? statePath.search : ""}${typeof statePath.hash === "string" ? statePath.hash : ""}`
      : null;
    let storedReturn: string | null = null;
    try {
      storedReturn = window.sessionStorage.getItem(AUTH_RETURN_TO_STORAGE_KEY);
    } catch {
    }
    const returnTo = returnFromState ?? storedReturn;
    const safeReturnTo = returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") &&
      !returnTo.startsWith("/login") && !returnTo.includes("\\")
      ? returnTo
      : null;
    try {
      window.sessionStorage.removeItem(AUTH_RETURN_TO_STORAGE_KEY);
    } catch {
    }
    navigate(
      esAdministrador
        ? "/administracion"
        : safeReturnTo ?? (codigoContexto ? DESTINOS_POR_ROL[codigoContexto] ?? "/" : "/"),
      { replace: true },
    );
  }

  async function iniciarSesion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (enviando.current) return;
    enviando.current = true;
    setCargando(true);
    setError(null);

    try {
      await login({ identificador: identificador.trim(), password });
      const usuario = useAuthStore.getState().usuario;

      // Regla TSK-1.0A: Si la cuenta tiene múltiples asignaciones y no hay contexto activo,
      // exigir selección explícita mediante el modal bloqueante antes de ingresar.
      if (!usuario?.contextoActivo && usuario?.contextosDisponibles && usuario.contextosDisponibles.length > 1) {
        setMostrarSelector(true);
        return;
      }

      redirigirSegunContexto();
    } catch (errorLogin: unknown) {
      if (errorLogin instanceof ApiHttpError && errorLogin.status === 401) {
        setError("Credenciales incorrectas. Verifique su usuario y contraseña.");
      } else if (errorLogin instanceof ApiHttpError && errorLogin.status < 500) {
        setError(errorLogin.message);
      } else {
        setError("No se pudo iniciar sesión. Compruebe la conexión e inténtelo nuevamente.");
      }
    } finally {
      enviando.current = false;
      setCargando(false);
    }
  }

  return (
    <main className="relative flex-1 w-full min-h-[calc(100vh-6rem)] overflow-hidden flex items-center justify-center lg:justify-end select-none bg-[#E8F4FE]">
      {/* Botón accesible para volver al inicio, ubicado dentro del cuerpo visual debajo del encabezado */}
      <Link
        to="/"
        aria-label="Volver al inicio"
        className="absolute top-5 left-6 z-40 inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/75 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 backdrop-blur-md shadow-sm transition hover:bg-white/95 hover:text-[#0052CC] hover:shadow-md"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        <span>Volver al inicio</span>
      </Link>

      {/* =========================================================
          FONDO PANORÁMICO INSTITUCIONAL COMPLETO - PERSPECTIVA AMPLIA (ZOOM OUT)
          Fachada completa del IESTP Suiza con perspectiva amplia y alejada,
          letrero institucional elegante y proporcionado, alas con ventanas,
          jardines circundantes, banderas peruanas y los 6 estudiantes al frente.
          Configurado con object-top para garantizar visibilidad al 100%
          del nombre del instituto sin cortes superiores en ninguna resolución.
          ========================================================= */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none select-none">
        <img
          src="/images/login_suiza_fondo_zoomout.png"
          alt="Composición institucional: Fachada completa del IESTP Suiza y jóvenes estudiantes con perspectiva amplia"
          className="h-full w-full object-cover object-top"
        />
        {/* Sutil viñeta lateral para realzar el contraste de la tarjeta Glassmorphism */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/5 via-transparent to-blue-950/10" />
      </div>

      {/* Ondas decorativas institucionales en la parte inferior (Azul oscuro, azul eléctrico, blanco y celeste) */}
      <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none overflow-hidden h-[60px] sm:h-[80px] lg:h-[95px]">
        <svg
          viewBox="0 0 1600 185"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="waveDeepBlue" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#003BA8" />
              <stop offset="100%" stopColor="#001854" />
            </linearGradient>
            <linearGradient id="waveElectricCyan" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#0052CC" />
              <stop offset="45%" stopColor="#0077FF" />
              <stop offset="100%" stopColor="#0047AB" />
            </linearGradient>
            <linearGradient id="waveLightCyan" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#0284C7" stopOpacity="0.3" />
            </linearGradient>
          </defs>

          {/* Capa 1: Azul eléctrico inferior continuo */}
          <path
            d="M0,120 C240,65 520,165 860,115 C1200,65 1420,135 1600,105 L1600,185 L0,185 Z"
            fill="url(#waveElectricCyan)"
            opacity="0.95"
          />

          {/* Capa 2: Onda azul profundo curvada en la esquina izquierda */}
          <path
            d="M0,45 C190,20 330,135 560,145 C410,175 210,185 0,185 Z"
            fill="url(#waveDeepBlue)"
          />

          {/* Capa 3: Cinta blanca institucional elegante */}
          <path
            d="M0,78 C220,58 430,148 760,128 C1090,108 1360,148 1600,118 L1600,126 C1360,156 1090,116 760,136 C430,156 220,66 0,86 Z"
            fill="#FFFFFF"
          />

          {/* Capa 4: Trazo celeste superior suave */}
          <path
            d="M0,98 C180,82 350,152 640,142 C440,165 230,175 0,165 Z"
            fill="url(#waveLightCyan)"
          />
        </svg>
      </div>

      {/* =========================================================
          ZONA DERECHA: TARJETA DE INICIO DE SESIÓN CON GLASSMORPHISM (PROPORCIÓN Y ELEGANTE)
          ========================================================= */}
      <div className="relative z-30 w-full max-w-[540px] sm:max-w-[580px] lg:max-w-[620px] xl:max-w-[650px] px-4 sm:px-6 lg:mr-8 xl:mr-16 2xl:mr-24 my-auto py-6 sm:py-8">
        <section
          className="relative overflow-hidden rounded-[38px] sm:rounded-[44px] border border-white/90 bg-white/70 sm:bg-white/75 p-8 sm:p-10 lg:p-12 shadow-[0_28px_68px_rgba(0,35,110,0.24)] backdrop-blur-2xl transition-all"
          aria-labelledby="login-heading"
        >
          {/* Detalle decorativo de ondas azules superiores en la tarjeta de cristal */}
          <div className="absolute -top-[1px] right-8 w-56 sm:w-64 h-12 pointer-events-none overflow-hidden" aria-hidden="true">
            <svg viewBox="0 0 180 36" fill="none" className="w-full h-full">
              <path
                d="M0,20 C45,6 110,32 180,12 L180,0 L0,0 Z"
                fill="url(#cardWaveGradient)"
                opacity="0.45"
              />
              <path
                d="M20,18 C65,4 135,30 180,16"
                stroke="#0066FF"
                strokeWidth="2.2"
                strokeOpacity="0.65"
              />
              <defs>
                <linearGradient id="cardWaveGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#0066FF" />
                  <stop offset="100%" stopColor="#38BDF8" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          {/* Encabezado: Icono de computadora en recuadro azul y título Iniciar sesión */}
          <div className="flex items-center gap-4 sm:gap-5">
            <div
              className="flex h-15 w-15 sm:h-17 sm:w-17 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0052CC] to-[#0077FF] text-white shadow-lg shadow-blue-500/35"
              aria-hidden="true"
            >
              {/* Icono de computadora / laptop */}
              <svg className="h-8 w-8 sm:h-9 sm:w-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                <line x1="8" y1="21" x2="16" y2="21" />
                <line x1="12" y1="17" x2="12" y2="21" />
              </svg>
            </div>
            <div>
              <h1
                id="login-heading"
                className="text-3xl sm:text-4xl lg:text-[42px] font-extrabold tracking-tight text-[#0047AB] leading-none"
              >
                Iniciar sesión
              </h1>
            </div>
          </div>
          <p className="mt-3 text-base sm:text-lg font-medium text-slate-700 leading-normal">
            Acceda con sus credenciales institucionales.
          </p>

          {/* Formulario de Inicio de Sesión */}
          <form onSubmit={iniciarSesion} aria-busy={cargando} className="mt-7 sm:mt-8">
            {/* Campo 1: Usuario o correo institucional */}
            <div>
              <label htmlFor="identificador" className="sr-only">
                Usuario o correo institucional
              </label>
              <div className="group flex h-14 sm:h-16 items-center rounded-full border border-white/90 bg-white/90 px-5 sm:px-6 shadow-sm transition-all focus-within:border-[#0052CC] focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/30 hover:bg-white">
                <div className="flex items-center text-[#0052CC] shrink-0" aria-hidden="true">
                  {/* Icono de usuario */}
                  <svg className="h-6 w-6 fill-current" viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                  {/* Divisor vertical */}
                  <span className="mx-4 h-7 w-[1.5px] bg-slate-300" />
                </div>
                <input
                  id="identificador"
                  aria-label="Usuario o correo institucional"
                  type="text"
                  autoComplete="username"
                  required
                  minLength={3}
                  maxLength={100}
                  value={identificador}
                  onChange={(event) => setIdentificador(event.target.value)}
                  disabled={cargando}
                  placeholder="Usuario o correo institucional"
                  className="w-full bg-transparent text-base sm:text-lg font-medium text-slate-800 placeholder-slate-400 focus:outline-none"
                />
              </div>
            </div>

            {/* Campo 2: Contraseña con visualizador alternable */}
            <div className="mt-4 sm:mt-5">
              <label htmlFor="password" className="sr-only">
                Contraseña
              </label>
              <div className="group flex h-14 sm:h-16 items-center rounded-full border border-white/90 bg-white/90 px-5 sm:px-6 shadow-sm transition-all focus-within:border-[#0052CC] focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/30 hover:bg-white">
                <div className="flex items-center text-[#0052CC] shrink-0" aria-hidden="true">
                  {/* Icono de candado */}
                  <svg className="h-6 w-6 fill-current" viewBox="0 0 24 24">
                    <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
                  </svg>
                  {/* Divisor vertical */}
                  <span className="mx-4 h-7 w-[1.5px] bg-slate-300" />
                </div>
                <input
                  id="password"
                  aria-label="Contraseña"
                  type={mostrarPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  minLength={6}
                  maxLength={128}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={cargando}
                  placeholder="Contraseña"
                  className="w-full bg-transparent text-base sm:text-lg font-medium text-slate-800 placeholder-slate-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setMostrarPassword(!mostrarPassword)}
                  className="p-2 text-[#0052CC] hover:text-[#0038A8] transition-colors focus:outline-none cursor-pointer"
                  aria-label={mostrarPassword ? "Ocultar contraseña" : "Ver contraseña"}
                >
                  {mostrarPassword ? (
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Mensaje de error si la autenticación falla */}
            {error && (
              <div
                role="alert"
                className="mt-4 flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50/90 p-3.5 text-sm font-medium text-red-700 shadow-xs backdrop-blur-sm"
              >
                <span className="font-bold text-base leading-none">!</span>
                <span>{error}</span>
              </div>
            )}

            {/* Botón Principal: Ingresar al sistema */}
            <button
              type="submit"
              disabled={cargando}
              className="mt-7 sm:mt-8 flex h-14 sm:h-16 w-full cursor-pointer items-center justify-center gap-4 rounded-full bg-gradient-to-r from-[#0038A8] via-[#0055D4] to-[#0066FF] px-8 text-base sm:text-xl font-bold text-white shadow-xl shadow-blue-600/35 transition-all hover:from-[#002D88] hover:via-[#0047AB] hover:to-[#0052CC] hover:shadow-2xl hover:shadow-blue-600/45 disabled:opacity-60"
            >
              {cargando ? (
                <>
                  <svg className="h-6 w-6 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Ingresando…</span>
                </>
              ) : (
                <>
                  {/* Icono de ingreso con flecha */}
                  <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                  <span className="h-7 w-[1.5px] bg-white/40" aria-hidden="true" />
                  <span>Ingresar al sistema</span>
                </>
              )}
            </button>
          </form>

          {/* Sección inferior: ¿No tienes una cuenta? Crear cuenta */}
          <div className="mt-7 sm:mt-8 flex flex-wrap items-center justify-between sm:justify-center gap-3 pt-2 text-sm sm:text-base">
            <span className="font-semibold text-slate-800">¿No tienes una cuenta?</span>
            <Link
              to="/registro"
              className="inline-flex items-center gap-2 font-bold text-[#0052CC] hover:text-[#0038A8] transition-colors hover:underline text-sm sm:text-base"
            >
              {/* Icono de usuario con símbolo de añadir (+) */}
              <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              <span>Crear cuenta</span>
            </Link>
          </div>
        </section>
      </div>

      {/* Selector de Contexto Obligatorio para cuentas con múltiples roles */}
      <SelectorContextoModal
        abierto={mostrarSelector}
        alCerrar={() => {
          setMostrarSelector(false);
          redirigirSegunContexto();
        }}
        bloqueante
      />
    </main>
  );
}
