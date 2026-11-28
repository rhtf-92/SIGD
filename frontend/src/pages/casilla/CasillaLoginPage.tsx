import { useState, useRef, useEffect, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  User,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  Mail,
  ArrowRight,
  KeyRound,
} from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import { ApiHttpError } from "../../types/api";

export default function CasillaLoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated, usuario, login } = useAuthStore();

  const [identificador, setIdentificador] = useState("");
  const [password, setPassword] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cuentaInactiva, setCuentaInactiva] = useState(false);
  const enviando = useRef(false);

  // Escenario B: Si el usuario ya cuenta con sesión activa y rol CIUDADANO, ingreso directo
  useEffect(() => {
    if (isAuthenticated && usuario) {
      const roles = usuario.roles ?? (usuario.rol ? [usuario.rol] : []);
      const esCiudadano = roles.includes("CIUDADANO") || usuario.rol === "CIUDADANO";
      if (esCiudadano) {
        navigate("/casilla", { replace: true });
      }
    }
  }, [isAuthenticated, usuario, navigate]);

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (enviando.current) return;
    enviando.current = true;
    setCargando(true);
    setError(null);
    setCuentaInactiva(false);

    try {
      await login({
        identificador: identificador.trim(),
        password,
      });

      const usuarioActual = useAuthStore.getState().usuario;
      const roles = usuarioActual?.roles ?? (usuarioActual?.rol ? [usuarioActual.rol] : []);
      const esCiudadano = roles.includes("CIUDADANO") || usuarioActual?.rol === "CIUDADANO";

      if (!esCiudadano) {
        useAuthStore.getState().logout();
        setError(
          "Su cuenta institucional no cuenta con rol CIUDADANO para acceder a la Ventanilla Electrónica. Este servicio es de uso exclusivo para ciudadanos y personas jurídicas administradas.",
        );
        return;
      }

      navigate("/casilla", { replace: true });
    } catch (err: unknown) {
      if (err instanceof ApiHttpError) {
        const detail = err.problemDetails?.detail ?? err.message;
        const code = err.problemDetails?.code;
        if (err.status === 401) {
          setError(
            "No fue posible iniciar sesión. Verifique sus credenciales o regístrese para continuar.",
          );
        } else if (
          err.status === 403 &&
          (code === "ACCOUNT_DISABLED" ||
            detail?.toLowerCase().includes("inactiv") ||
            detail?.toLowerCase().includes("suspendid"))
        ) {
          setCuentaInactiva(true);
          setError(
            "Su cuenta se encuentra registrada pero aún no ha completado la activación requerida. Debe ingresar el código de verificación enviado a su correo electrónico institucional o personal.",
          );
        } else {
          setError(
            detail || "No fue posible iniciar sesión. Verifique sus credenciales.",
          );
        }
      } else {
        setError(
          "No fue posible conectar con el servidor de autenticación. Verifique su conexión e inténtelo nuevamente.",
        );
      }
    } finally {
      enviando.current = false;
      setCargando(false);
    }
  }

  return (
    <div
      className="relative w-full flex-1 flex flex-col justify-between overflow-x-hidden bg-[#030d22] bg-cover bg-center bg-no-repeat selection:bg-[#0073E6]/20"
      style={{
        backgroundImage: "url('/fondo-casillaelectronic.png')",
        backgroundAttachment: "fixed",
      }}
    >
      {/* 1. Fondo fijo de respaldo con fondo-casillaelectronic.png */}
      <div
        className="pointer-events-none fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/fondo-casillaelectronic.png')",
        }}
        aria-hidden="true"
      />

      {/* 2. Botón "← Volver a la portada" en la parte superior izquierda */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-2.5 sm:pt-3 pb-1">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/90 hover:bg-white text-[#082F7C] hover:text-[#0052CC] border border-blue-200 shadow-xs hover:shadow-md text-xs sm:text-sm font-semibold transition-all w-fit cursor-pointer"
          aria-label="Volver a la portada principal"
        >
          <span>← Volver a la portada</span>
        </Link>
      </div>

      {/* 3. Área principal: Tarjeta de Ventanilla Electrónica centrada horizontal y verticalmente */}
      <main className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-5 flex-1 flex items-center justify-center">
        <div className="w-full flex justify-center items-center">
          <div className="w-full max-w-[480px] sm:max-w-lg bg-white rounded-[32px] border-2 border-blue-200/80 shadow-[0_20px_60px_rgba(8,47,124,0.25)] relative px-7 sm:px-9 lg:px-10 pt-5 sm:pt-6 pb-6 sm:pb-7 z-10 my-auto">
              
              {/* 1. Decoraciones suaves en tonos celeste y azul dentro del marco */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-[30px] z-0 select-none">
                {/* Esquina superior con ondas azul y celeste */}
                <div className="absolute -top-1 -left-1 -right-1 h-20 opacity-80 pointer-events-none">
                  <svg viewBox="0 0 500 80" fill="none" preserveAspectRatio="none" className="w-full h-full">
                    <path
                      d="M0,0 L500,0 L500,28 C410,55 330,12 250,38 C160,62 80,24 0,48 Z"
                      fill="url(#topBlueWave1)"
                    />
                    <path
                      d="M0,0 L500,0 L500,16 C390,40 310,8 210,26 C120,46 50,15 0,30 Z"
                      fill="url(#topBlueWave2)"
                    />
                    <defs>
                      <linearGradient id="topBlueWave1" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#0052CC" stopOpacity="0.16" />
                        <stop offset="50%" stopColor="#00A3FF" stopOpacity="0.22" />
                        <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.1" />
                      </linearGradient>
                      <linearGradient id="topBlueWave2" x1="100%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#0038A8" stopOpacity="0.22" />
                        <stop offset="100%" stopColor="#0073E6" stopOpacity="0.14" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>

                {/* Esquina inferior con ondas azul y celeste */}
                <div className="absolute -bottom-1 -left-1 -right-1 h-20 opacity-80 pointer-events-none">
                  <svg viewBox="0 0 500 80" fill="none" preserveAspectRatio="none" className="w-full h-full">
                    <path
                      d="M0,80 L500,80 L500,45 C410,20 330,65 240,35 C150,5 70,50 0,25 Z"
                      fill="url(#botBlueWave1)"
                    />
                    <path
                      d="M0,80 L500,80 L500,60 C390,35 310,70 210,50 C120,30 50,65 0,55 Z"
                      fill="url(#botBlueWave2)"
                    />
                    <defs>
                      <linearGradient id="botBlueWave1" x1="0%" y1="100%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#0052CC" stopOpacity="0.18" />
                        <stop offset="60%" stopColor="#00A3FF" stopOpacity="0.22" />
                        <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.1" />
                      </linearGradient>
                      <linearGradient id="botBlueWave2" x1="100%" y1="100%" x2="0%" y2="0%">
                        <stop offset="0%" stopColor="#0038A8" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#0073E6" stopOpacity="0.12" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              </div>

              {/* 2. Contenido interactivo relativo */}
              <div className="relative z-10">
                {/* Medallón superior del sobre con líneas horizontales a los lados */}
                <div className="relative flex items-center justify-center -mt-14 sm:-mt-16 mb-4 sm:mb-5">
                  {/* Línea horizontal delgada izquierda */}
                  <div className="h-[1.5px] bg-gradient-to-r from-transparent via-blue-200 to-blue-300 flex-1 mr-3" />

                  {/* Círculo azul intenso sobresaliendo con borde blanco grueso y sombra */}
                  <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-gradient-to-b from-[#0066FF] via-[#0047AB] to-[#002D88] border-[5px] border-white shadow-xl flex items-center justify-center text-white shrink-0">
                    <Mail className="w-7 h-7 sm:w-8 sm:h-8 text-white" aria-hidden="true" />
                  </div>

                  {/* Línea horizontal delgada derecha */}
                  <div className="h-[1.5px] bg-gradient-to-l from-transparent via-blue-200 to-blue-300 flex-1 ml-3" />
                </div>

                {/* 3. Encabezado interno: Título y texto de 2 líneas */}
                <div className="text-center mb-4 sm:mb-5">
                  <h2 className="text-2xl sm:text-[28px] font-extrabold text-[#002D88] tracking-tight">
                    Ventanilla Electrónica
                  </h2>
                  <p className="mt-1.5 text-xs sm:text-sm text-slate-600 max-w-[340px] mx-auto leading-relaxed">
                    Accede de manera segura a tus notificaciones y <br className="hidden sm:inline" />
                    documentos electrónicos institucionales
                  </p>
                </div>

                {/* Alerta de Error / Validación */}
                {error && (
                  <div
                    role="alert"
                    className={`mb-5 p-3.5 rounded-2xl border flex items-start gap-2.5 text-xs sm:text-sm leading-relaxed ${
                      cuentaInactiva
                        ? "bg-amber-50/95 border-amber-200 text-amber-900"
                        : "bg-red-50/95 border-red-200 text-red-800"
                    }`}
                  >
                    <AlertCircle
                      className={`w-4.5 h-4.5 shrink-0 mt-0.5 ${
                        cuentaInactiva ? "text-amber-600" : "text-red-600"
                      }`}
                    />
                    <div className="space-y-1 flex-1">
                      <p className="font-medium">{error}</p>
                      {cuentaInactiva && (
                        <Link
                          to="/activar-cuenta"
                          className="inline-flex items-center gap-1 font-bold text-amber-900 underline hover:text-amber-950 text-xs"
                        >
                          <span>Activar cuenta</span>
                          <ArrowRight className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                )}

                {/* 4. Campos de entrada tipo píldora (rounded-full) con separador fino */}
                <form onSubmit={handleLogin} className="space-y-3 sm:space-y-3.5" aria-busy={cargando}>
                  {/* Campo 1: Usuario o correo electrónico */}
                  <div className="relative flex items-center bg-white rounded-full border border-blue-200/90 hover:border-[#0073E6] focus-within:border-[#0073E6] focus-within:ring-3 focus-within:ring-[#0073E6]/15 transition-all shadow-xs px-4 py-1.5 sm:py-2">
                    <div className="text-slate-400 pl-1 shrink-0">
                      <User className="w-5 h-5 text-slate-400" aria-hidden="true" />
                    </div>
                    {/* Separador vertical fino */}
                    <div className="w-[1.5px] h-5 bg-slate-200/90 mx-3 shrink-0" />
                    <label htmlFor="identificador" className="sr-only">Usuario o correo electrónico</label>
                    <input
                      id="identificador"
                      name="identificador"
                      type="text"
                      autoComplete="username"
                      required
                      minLength={3}
                      maxLength={100}
                      value={identificador}
                      onChange={(e) => setIdentificador(e.target.value)}
                      disabled={cargando}
                      placeholder="Usuario o correo electrónico"
                      className="w-full py-2 text-sm sm:text-base font-medium text-slate-800 placeholder:text-slate-400 placeholder:font-normal bg-transparent outline-none disabled:cursor-not-allowed"
                    />
                  </div>

                  {/* Campo 2: Contraseña */}
                  <div className="relative flex items-center bg-white rounded-full border border-blue-200/90 hover:border-[#0073E6] focus-within:border-[#0073E6] focus-within:ring-3 focus-within:ring-[#0073E6]/15 transition-all shadow-xs px-4 py-1.5 sm:py-2">
                    <div className="text-slate-400 pl-1 shrink-0">
                      <Lock className="w-5 h-5 text-slate-400" aria-hidden="true" />
                    </div>
                    {/* Separador vertical fino */}
                    <div className="w-[1.5px] h-5 bg-slate-200/90 mx-3 shrink-0" />
                    <label htmlFor="password" className="sr-only">Contraseña</label>
                    <input
                      id="password"
                      name="password"
                      type={mostrarPassword ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      minLength={6}
                      maxLength={128}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={cargando}
                      placeholder="Contraseña"
                      className="w-full py-2 pr-9 text-sm sm:text-base font-medium text-slate-800 placeholder:text-slate-400 placeholder:font-normal bg-transparent outline-none disabled:cursor-not-allowed"
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarPassword(!mostrarPassword)}
                      disabled={cargando}
                      className="absolute right-4 text-slate-400 hover:text-slate-600 transition cursor-pointer p-1"
                      aria-label={mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                      {mostrarPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>

                  {/* 5. Botón principal: degradado azul intenso con bordes muy redondeados */}
                  <button
                    type="submit"
                    disabled={cargando}
                    className="w-full mt-2 flex items-center justify-center gap-2.5 rounded-full bg-gradient-to-r from-[#0038A8] via-[#0052CC] to-[#0073E6] hover:from-[#002D88] hover:via-[#0047AB] hover:to-[#005fb8] text-white py-3 sm:py-3.5 px-6 font-bold text-base sm:text-lg shadow-lg shadow-blue-600/30 hover:shadow-xl hover:shadow-blue-600/40 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-60 cursor-pointer"
                  >
                    {cargando ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Ingresando…</span>
                      </>
                    ) : (
                      <>
                        <span>Ingresar</span>
                        <ArrowRight className="w-5 h-5 ml-1" />
                      </>
                    )}
                  </button>
                </form>

                {/* 6. Pie inferior del cuadro: Línea sutil y dos enlaces con íconos específicos */}
                <div className="mt-5 sm:mt-6 pt-3.5 sm:pt-4 border-t border-slate-200/70 space-y-2 sm:space-y-2.5 text-xs sm:text-sm text-slate-600">
                  {/* Primera línea: círculo azul con ? y enlace Regístrate aquí */}
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-[#0073E6] text-white flex items-center justify-center text-[11px] font-bold shrink-0 shadow-2xs">
                      ?
                    </div>
                    <span>¿No tienes una cuenta?</span>
                    <Link
                      to="/registro"
                      className="font-bold text-[#0052CC] hover:text-[#0038A8] underline transition-colors"
                    >
                      Regístrate aquí
                    </Link>
                  </div>

                  {/* Segunda línea: ícono de llave en azul y enlace Activar cuenta */}
                  <div className="flex items-center justify-center gap-2 text-[11px] sm:text-xs text-slate-600">
                    <KeyRound className="w-4 h-4 text-[#0073E6] shrink-0" aria-hidden="true" />
                    <span>¿Ya te registraste pero no activaste tu cuenta?</span>
                    <Link
                      to="/activar-cuenta"
                      className="font-bold text-[#0052CC] hover:text-[#0038A8] underline transition-colors"
                    >
                      Activar cuenta
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
      </main>
    </div>
  );
}
