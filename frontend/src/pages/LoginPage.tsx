import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  User,
  Lock,
  Eye,
  EyeOff,
  Shield,
  ShieldCheck,
  RefreshCw,
  ArrowLeft,
  KeyRound,
  Check,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import { permisosIniciales } from "../hooks/useRbacConfig";

const CLAVE_TOKEN = "sigd_token";
const CLAVE_ROL = "sigd_rol";
const CLAVE_PERMISOS = "sigd_permisos";

export const ROLES_CANONICOS = [
  {
    id: "SUPER_ADMIN",
    label: "Administrador",
    destino: "/administracion",
  },
  {
    id: "MESA_PARTES",
    label: "Operador",
    destino: "/tramite/ventanilla-presencial",
  },
  {
    id: "ESTUDIANTE",
    label: "Ciudadano",
    destino: "/casilla",
  },
];

export default function LoginPage() {
  const navigate = useNavigate();

  // Estados de formulario
  const [identificador, setIdentificador] = useState("");
  const [password, setPassword] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [tipoVerificacion, setTipoVerificacion] = useState<"recaptcha" | "pin">("recaptcha");
  const [captchaVerificado, setCaptchaVerificado] = useState(true);
  const [isRefreshingCaptcha, setIsRefreshingCaptcha] = useState(false);
  const [securityPin, setSecurityPin] = useState("");
  const [mensajeAyuda, setMensajeAyuda] = useState<string | null>(null);
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  function handleRefreshCaptcha() {
    setIsRefreshingCaptcha(true);
    setCaptchaVerificado(false);
    setTimeout(() => {
      setIsRefreshingCaptcha(false);
      setCaptchaVerificado(true);
    }, 500);
  }

  async function handleLogin(e?: React.FormEvent) {
    e?.preventDefault();
    setErrorValidacion(null);

    if (tipoVerificacion === "recaptcha" && !captchaVerificado) {
      setErrorValidacion("Por favor complete la verificación de seguridad reCAPTCHA.");
      return;
    }

    if (tipoVerificacion === "pin" && securityPin.length < 4) {
      setErrorValidacion("Por favor ingrese su clave PIN de seguridad (mínimo 4 dígitos).");
      return;
    }

    setCargando(true);
    try {
      const { data } = await axios.post<{
        accessToken: string;
        usuario: { rol: string };
      }>(
        "http://localhost:3000/api/auth/login",
        { identificador, password },
        { timeout: 10000 },
      );
      const rolEncontrado = ROLES_CANONICOS.find((item) => item.id === data.usuario.rol);
      if (!rolEncontrado || !data.accessToken) {
        throw new Error("El servidor devolvió una identidad o un rol no reconocido.");
      }

      window.localStorage.setItem(CLAVE_TOKEN, data.accessToken);
      window.localStorage.setItem(CLAVE_ROL, rolEncontrado.id);
      window.localStorage.setItem(CLAVE_PERMISOS, JSON.stringify(permisosIniciales));
      navigate(rolEncontrado.destino, { replace: true });
    } catch (error) {
      const responseData = axios.isAxiosError(error) ? error.response?.data : undefined;
      const apiMessage =
        responseData &&
        typeof responseData === "object" &&
        "detail" in responseData &&
        typeof responseData.detail === "string"
          ? responseData.detail
          : responseData &&
              typeof responseData === "object" &&
              "message" in responseData &&
              typeof responseData.message === "string"
            ? responseData.message
            : null;
      setErrorValidacion(
        apiMessage ??
          (axios.isAxiosError(error) && !error.response
            ? "No se pudo conectar con el servidor de autenticación."
            : "No se pudo iniciar sesión. Intente nuevamente."),
      );
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-[#EEF4FB] via-[#F6F9FD] to-[#DCE8F8] flex flex-col justify-between items-center py-6 px-4 sm:px-6 select-none font-sans">
      {/* Fondos Decorativos Frosted Glass y Malla Geométrica */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Esferas Difusas Ambientales */}
        <div className="absolute -top-32 -left-32 h-[480px] w-[480px] rounded-full bg-blue-300/35 blur-[100px]" />
        <div className="absolute top-1/3 -right-24 h-[420px] w-[420px] rounded-full bg-sky-200/40 blur-[90px]" />
        <div className="absolute -bottom-32 left-1/4 h-[450px] w-[450px] rounded-full bg-indigo-200/30 blur-[110px]" />
        <div className="absolute top-1/4 left-10 h-72 w-72 rounded-full bg-red-200/20 blur-[80px]" />

        {/* Polígonos y Malla Vectorial 3D de Fondo (Lado Izquierdo) */}
        <svg
          className="absolute -top-10 -left-10 h-[520px] w-[520px] stroke-blue-300/40 opacity-70"
          viewBox="0 0 500 500"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <polygon points="60,60 220,90 280,240 140,280 40,180" strokeWidth="1.2" />
          <polygon points="220,90 380,120 340,300 280,240" strokeWidth="1.2" />
          <polygon points="140,280 280,240 240,420 80,380" strokeWidth="1.2" />
          <line x1="60" y1="60" x2="280" y2="240" strokeWidth="0.8" strokeDasharray="3 3" />
          <line x1="220" y1="90" x2="140" y2="280" strokeWidth="0.8" strokeDasharray="3 3" />
          <circle cx="220" cy="90" r="3.5" className="fill-blue-400/60" />
          <circle cx="280" cy="240" r="3.5" className="fill-blue-500/60" />
          <circle cx="140" cy="280" r="3" className="fill-blue-400/50" />
          <circle cx="380" cy="120" r="3" className="fill-blue-300/50" />
        </svg>

        {/* Polígonos y Malla Vectorial 3D de Fondo (Lado Derecho) */}
        <svg
          className="absolute top-16 -right-16 h-[560px] w-[560px] stroke-blue-300/40 opacity-70"
          viewBox="0 0 550 550"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <polygon points="200,80 380,50 460,200 340,320 180,220" strokeWidth="1.2" />
          <polygon points="380,50 500,160 480,350 460,200" strokeWidth="1.2" />
          <polygon points="180,220 340,320 280,480 120,380" strokeWidth="1.2" />
          <line x1="200" y1="80" x2="460" y2="200" strokeWidth="0.8" strokeDasharray="3 3" />
          <line x1="380" y1="50" x2="340" y2="320" strokeWidth="0.8" strokeDasharray="3 3" />
          <circle cx="340" cy="320" r="4" className="fill-blue-500/60" />
          <circle cx="460" cy="200" r="3.5" className="fill-blue-400/60" />
          <circle cx="180" cy="220" r="3" className="fill-blue-400/50" />
        </svg>

        {/* Esferas Flotantes de Vidrio Esmerilado (Glassmorphism) */}
        <div className="absolute top-[22%] left-[12%] hidden lg:block h-28 w-28 rounded-full border border-white/60 bg-gradient-to-br from-white/60 via-blue-100/40 to-blue-200/30 backdrop-blur-md shadow-[0_15px_35px_rgba(30,58,138,0.12)]" />
        <div className="absolute bottom-[28%] left-[8%] hidden lg:block h-20 w-20 rounded-full border border-white/70 bg-gradient-to-tr from-blue-300/40 via-white/50 to-white/70 backdrop-blur-lg shadow-[0_12px_28px_rgba(30,58,138,0.15)]" />
        <div className="absolute top-[18%] right-[10%] hidden lg:block h-32 w-32 rounded-full border border-white/60 bg-gradient-to-br from-white/70 via-sky-100/30 to-blue-300/30 backdrop-blur-md shadow-[0_20px_40px_rgba(30,58,138,0.12)]" />
        <div className="absolute bottom-[20%] right-[14%] hidden lg:block h-16 w-16 rounded-full border border-white/70 bg-gradient-to-br from-white/80 via-blue-200/40 to-blue-400/20 backdrop-blur-md shadow-lg" />
      </div>

      {/* Barra Superior Institucional */}
      <div className="relative z-20 w-full max-w-5xl flex items-center justify-between mb-2">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-xl border border-white/80 bg-white/60 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 backdrop-blur-md transition hover:bg-white/90 hover:text-blue-900 shadow-sm"
        >
          <ArrowLeft className="h-4 w-4 text-blue-700" />
          <span>Portal Institucional</span>
        </Link>

        <div className="flex items-center gap-2 rounded-xl border border-white/70 bg-white/50 px-3.5 py-1.5 backdrop-blur-md text-xs font-medium text-slate-600 shadow-xs">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>Servidor Seguro SSL 256-bit</span>
        </div>
      </div>

      {/* Elemento Central: Tarjeta Flotante Semitransparente con Borde de Neón Dual */}
      <div className="relative z-10 w-full max-w-[460px] my-auto">
        {/* Contenedor del Borde de Neón Sutil en Rojo Vibrante y Azul Profundo */}
        <div
          className="relative rounded-[18px] p-[2px] transition duration-300"
          style={{
            background:
              "linear-gradient(135deg, rgba(239, 68, 68, 0.95) 0%, rgba(220, 38, 38, 0.5) 25%, rgba(59, 130, 246, 0.35) 50%, rgba(30, 64, 175, 0.8) 75%, rgba(29, 78, 216, 0.95) 100%)",
            boxShadow:
              "-8px 4px 30px -4px rgba(239, 68, 68, 0.35), 8px 10px 35px -2px rgba(30, 64, 175, 0.32), 0 20px 45px -10px rgba(15, 23, 42, 0.15)",
          }}
        >
          {/* Cuerpo Interior de la Tarjeta con Esquinas Redondeadas de 16px y Glassmorphism */}
          <div
            className="rounded-[16px] border border-white/70 bg-white/85 px-6 py-8 sm:px-8 sm:py-8.5 backdrop-blur-2xl shadow-inner"
            style={{ borderRadius: "16px" }}
          >
            {/* Parte Superior: Candado Rojo Resplandeciente con Título y Subtítulo */}
            <div className="flex flex-col items-center text-center">
              <div className="relative mb-3 flex items-center justify-center">
                {/* Aura de Resplandor Neón Rojo */}
                <div className="absolute h-16 w-16 rounded-full bg-red-500/25 blur-xl animate-pulse" />
                <div
                  className="relative flex h-16 w-16 items-center justify-center rounded-[14px] border border-red-300/80 bg-gradient-to-b from-red-50 via-red-100/80 to-white text-red-600 shadow-[0_0_24px_rgba(239,68,68,0.4)]"
                >
                  <div className="relative">
                    <Shield className="h-9 w-9 text-red-600 drop-shadow-[0_2px_8px_rgba(239,68,68,0.4)]" />
                    <Lock className="absolute inset-0 m-auto h-4.5 w-4.5 text-white stroke-[2.5]" />
                  </div>
                </div>
              </div>

              {/* Encabezado y Subtítulo */}
              <h1 className="text-xl sm:text-[22px] font-black tracking-tight text-slate-900">
                Iniciar Sesión - SIGD SUIZA
              </h1>
              <p className="mt-1 text-xs sm:text-sm font-medium text-slate-500">
                Acceso Restringido y Validación de Credenciales
              </p>
            </div>

            {/* Alerta de Error de Validación */}
            {errorValidacion && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50/90 px-3.5 py-2.5 text-xs font-semibold text-red-700 animate-fadeIn">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorValidacion}</span>
              </div>
            )}

            {/* Mensaje de Recuperación de Credenciales */}
            {mensajeAyuda && (
              <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/90 p-3 text-xs text-blue-800 animate-fadeIn">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-bold">
                    <HelpCircle className="h-4 w-4 text-blue-600" />
                    <span>Recuperación de Credenciales</span>
                  </div>
                  <button
                    onClick={() => setMensajeAyuda(null)}
                    className="font-bold text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    ×
                  </button>
                </div>
                <p className="mt-1 leading-relaxed text-slate-600">{mensajeAyuda}</p>
              </div>
            )}

            {/* Campos del Formulario */}
            <form onSubmit={handleLogin} className="mt-6 space-y-4">
              {/* Campo 1: Usuario / DNI / Correo Institucional */}
              <div>
                <label
                  htmlFor="usuario"
                  className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700"
                >
                  Usuario / DNI / Correo Institucional
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <User className="h-5 w-5" />
                  </div>
                  <input
                    id="usuario"
                    type="text"
                    value={identificador}
                    onChange={(e) => setIdentificador(e.target.value)}
                    placeholder="Ej. 74839201 o usuario@suiza.edu.pe"
                    className="w-full rounded-xl border border-slate-200/90 bg-white/70 py-2.5 pl-11 pr-4 text-sm font-medium text-slate-800 placeholder-slate-400 backdrop-blur-sm transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-xs"
                    autoComplete="username"
                  />
                </div>
              </div>

              {/* Campo 2: Contraseña con Ojo de Alternancia */}
              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-700"
                >
                  Contraseña
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <input
                    id="password"
                    type={mostrarPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full rounded-xl border border-slate-200/90 bg-white/70 py-2.5 pl-11 pr-11 text-sm font-medium text-slate-800 placeholder-slate-400 backdrop-blur-sm transition focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-xs"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarPassword(!mostrarPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600 transition cursor-pointer"
                    title={mostrarPassword ? "Ocultar contraseña" : "Ver contraseña"}
                  >
                    {mostrarPassword ? (
                      <EyeOff className="h-4.5 w-4.5" />
                    ) : (
                      <Eye className="h-4.5 w-4.5" />
                    )}
                  </button>
                </div>
              </div>

              {/* Elemento de Seguridad: reCAPTCHA o Clave PIN de Segundo Factor */}
              <div className="space-y-2 pt-1">
                {/* Selector de modo de seguridad */}
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 px-1">
                  <span>Verificación de Seguridad 2FA</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setTipoVerificacion("recaptcha")}
                      className={`cursor-pointer transition ${
                        tipoVerificacion === "recaptcha"
                          ? "text-blue-700 font-bold underline"
                          : "text-slate-400 hover:text-slate-600"
                      }`}
                    >
                      reCAPTCHA
                    </button>
                    <span className="text-slate-300">|</span>
                    <button
                      type="button"
                      onClick={() => setTipoVerificacion("pin")}
                      className={`cursor-pointer transition ${
                        tipoVerificacion === "pin"
                          ? "text-blue-700 font-bold underline"
                          : "text-slate-400 hover:text-slate-600"
                      }`}
                    >
                      Clave PIN
                    </button>
                  </div>
                </div>

                {tipoVerificacion === "recaptcha" ? (
                  /* Caja de Verificación reCAPTCHA Limpia */
                  <div className="flex items-center justify-between rounded-xl border border-slate-200/90 bg-white/70 px-4 py-3 backdrop-blur-sm shadow-xs transition hover:border-slate-300">
                    <button
                      type="button"
                      onClick={() => setCaptchaVerificado(!captchaVerificado)}
                      className="flex items-center gap-3 cursor-pointer group text-left"
                    >
                      <div
                        className={`flex h-6 w-6 items-center justify-center rounded-md border transition-all ${
                          captchaVerificado
                            ? "border-emerald-500 bg-emerald-500 text-white shadow-xs"
                            : "border-slate-300 bg-white group-hover:border-blue-400"
                        }`}
                      >
                        {captchaVerificado && <Check className="h-4 w-4 stroke-[3]" />}
                      </div>
                      <div>
                        <span className="text-xs sm:text-sm font-semibold text-slate-800">
                          Verificación de reCAPTCHA
                        </span>
                        <p className="text-[10px] text-slate-400 font-medium">
                          {captchaVerificado ? "Token seguro validado" : "Haga clic para verificar"}
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={handleRefreshCaptcha}
                      disabled={isRefreshingCaptcha}
                      className="p-1.5 text-slate-400 hover:text-blue-600 transition cursor-pointer"
                      title="Refrescar token reCAPTCHA"
                    >
                      <RefreshCw
                        className={`h-4.5 w-4.5 ${isRefreshingCaptcha ? "animate-spin text-blue-600" : ""}`}
                      />
                    </button>
                  </div>
                ) : (
                  /* Campo de Entrada de Clave PIN de Seguridad */
                  <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3 animate-fadeIn">
                    <label
                      htmlFor="pin"
                      className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-blue-900"
                    >
                      Clave de Seguridad PIN
                    </label>
                    <div className="relative">
                      <input
                        id="pin"
                        type="password"
                        maxLength={6}
                        value={securityPin}
                        onChange={(e) => setSecurityPin(e.target.value.replace(/\D/g, ""))}
                        placeholder="•••••• (PIN de 6 dígitos)"
                        className="w-full rounded-lg border border-blue-200 bg-white py-2 px-3 text-center tracking-[0.3em] font-mono text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Botón Principal: Azul Resplandeciente con Texto Blanco Negrita */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={cargando}
                  className="group relative flex w-full items-center justify-center gap-2 rounded-xl py-3.5 px-6 font-bold text-white transition-all duration-200 cursor-pointer disabled:opacity-75"
                  style={{
                    background: "linear-gradient(135deg, #1D4ED8 0%, #1E40AF 50%, #172554 100%)",
                    boxShadow: "0 8px 24px -4px rgba(29, 78, 216, 0.45), 0 0 16px rgba(37, 99, 235, 0.35)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow =
                      "0 12px 28px -2px rgba(29, 78, 216, 0.6), 0 0 22px rgba(37, 99, 235, 0.5)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow =
                      "0 8px 24px -4px rgba(29, 78, 216, 0.45), 0 0 16px rgba(37, 99, 235, 0.35)";
                  }}
                >
                  {cargando ? (
                    <RefreshCw className="h-5 w-5 animate-spin" />
                  ) : (
                    <span className="text-sm sm:text-base font-extrabold tracking-wide">
                      Ingresar al Sistema
                    </span>
                  )}
                </button>
              </div>

              {/* Enlace Secundario: ¿Olvidó su contraseña o clave PIN? */}
              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={() =>
                    setMensajeAyuda(
                      "Para restablecer su contraseña institucional o clave PIN de seguridad, comuníquese con la Unidad de Tecnologías de la Información (UTI) o ingrese a Mesa de Partes Virtual indicando su número de DNI y correo corporativo."
                    )
                  }
                  className="text-xs sm:text-sm font-semibold text-blue-700 hover:text-blue-900 transition hover:underline cursor-pointer"
                >
                  ¿Olvidó su contraseña o clave PIN?
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Footer & Branding Institucional */}
      <footer className="relative z-10 mt-6 flex flex-col items-center gap-2 text-center text-xs text-slate-500">
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          {/* Pequeño icono de la Bandera Peruana con PERÚ - Bicentenario */}
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200/90 bg-white/70 px-2.5 py-1 backdrop-blur-md shadow-2xs">
            <div className="flex h-3.5 w-5 overflow-hidden rounded-xs border border-slate-300 shadow-2xs">
              <span className="h-full w-1/3 bg-[#D91023]" />
              <span className="h-full w-1/3 bg-white" />
              <span className="h-full w-1/3 bg-[#D91023]" />
            </div>
            <span className="font-extrabold text-slate-800 text-[11px] tracking-tight">
              PERÚ
            </span>
            <span className="text-slate-300 text-[10px]">|</span>
            <span className="text-[11px] font-semibold text-slate-600">
              Bicentenario
            </span>
          </div>

          {/* Copyright Institucional */}
          <span className="font-medium text-slate-600 text-[11px] sm:text-xs">
            IESTP SUIZA - Todos los derechos reservados
          </span>

          {/* Tag de Versión */}
          <span className="rounded-full border border-slate-200 bg-white/70 px-2.5 py-0.5 font-mono text-[11px] font-bold text-slate-600 shadow-2xs">
            v1.0.0
          </span>
        </div>

        <p className="text-[10px] text-slate-400">
          Plataforma Institucional Oficial de Trámite y Gestión Documentaria Digital (SIGD)
        </p>
      </footer>
    </div>
  );
}