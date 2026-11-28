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
  MESA_PARTES: "/expedientes",
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
    const codigoContexto =
      usuario?.rol ||
      usuario?.capacidadActiva ||
      usuario?.contextoActivo?.codigo ||
      usuario?.roles?.find((r) => DESTINOS_POR_ROL[r]) ||
      usuario?.roles?.[0] ||
      "";
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
          {/* Capa 1: Azul marino profundo / sombra base */}
          <path
            d="M0 185H1600V80C1400 120 1250 50 1050 75C850 100 700 150 450 115C250 85 120 130 0 145V185Z"
            fill="#002D88"
            fillOpacity="0.95"
          />
          {/* Capa 2: Azul Suiza institucional */}
          <path
            d="M0 185H1600V105C1380 145 1200 85 980 110C760 135 620 75 380 125C180 165 80 120 0 135V185Z"
            fill="#0052CC"
          />
          {/* Capa 3: Filete blanco de alto contraste */}
          <path
            d="M0 185H1600V125C1350 95 1180 145 920 115C680 85 540 140 300 105C150 80 60 130 0 140V185Z"
            fill="#FFFFFF"
            fillOpacity="0.85"
          />
          {/* Capa 4: Celeste cielo brillante frontal */}
          <path
            d="M0 185H1600V138C1420 120 1280 155 1080 130C860 105 740 148 520 125C320 105 160 145 0 152V185Z"
            fill="#4C9AFF"
            fillOpacity="0.9"
          />
        </svg>
      </div>

      {/* Contenedor del Formulario: Tarjeta Glassmorphism alineada a la derecha con proporción de alto impacto */}
      <div className="relative z-30 w-full max-w-[500px] lg:max-w-[520px] px-4 sm:px-6 py-6 lg:py-8 lg:mr-14 xl:mr-24 my-auto">
        <section
          aria-labelledby="titulo-login"
          className="rounded-[36px] border border-white/70 bg-white/80 p-7 sm:p-10 md:p-12 shadow-[0_25px_60px_-15px_rgba(0,35,110,0.30)] backdrop-blur-2xl transition-all"
        >
          {/* Encabezado: Título y Bienvenida */}
          <div className="text-center sm:text-left">
            <h1
              id="titulo-login"
              className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[#0038A8]"
            >
              Iniciar sesión
            </h1>
            <p className="mt-2 text-sm sm:text-base font-medium text-slate-700">
              Bienvenido al Sistema de Gestión Documentaria
            </p>
          </div>

          {/* Formulario de autenticación */}
          <form onSubmit={iniciarSesion} aria-busy={cargando} className="mt-7 sm:mt-8 space-y-4 sm:space-y-5">
            {/* Campo: Usuario / Identificador */}
            <div className="space-y-1.5">
              <label
                htmlFor="identificador"
                className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-800"
              >
                Usuario
              </label>
              <div className="flex h-13 sm:h-14 items-center rounded-2xl border border-blue-200/90 bg-white/95 px-4 shadow-inner shadow-slate-100 transition-all focus-within:border-[#0052CC] focus-within:ring-3 focus-within:ring-[#0052CC]/20 hover:border-blue-300">
                <input
                  id="identificador"
                  type="text"
                  required
                  autoComplete="username"
                  value={identificador}
                  onChange={(e) => setIdentificador(e.target.value)}
                  placeholder="Ingrese su usuario o correo"
                  className="w-full bg-transparent text-base sm:text-lg font-medium text-slate-800 placeholder-slate-400 focus:outline-none"
                />
              </div>
            </div>

            {/* Campo: Contraseña con botón de Ver/Ocultar */}
            <div className="space-y-1.5">
              <label
                htmlFor="password"
                className="block text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-800"
              >
                Contraseña
              </label>
              <div className="flex h-13 sm:h-14 items-center rounded-2xl border border-blue-200/90 bg-white/95 px-4 shadow-inner shadow-slate-100 transition-all focus-within:border-[#0052CC] focus-within:ring-3 focus-within:ring-[#0052CC]/20 hover:border-blue-300">
                <input
                  id="password"
                  type={mostrarPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
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
