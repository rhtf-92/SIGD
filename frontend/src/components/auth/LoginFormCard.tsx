import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  User,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  ExternalLink,
  AlertCircle,
  HelpCircle,
  X,
  ShieldAlert,
} from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import { autenticarCredenciales, destinoPorRol } from "../../services/authService";

export interface RolCanonico {
  id: string;
  label: string;
  destino: string;
}

export const ROLES_CANONICOS: RolCanonico[] = [
  { id: "SUPER_ADMIN", label: "SUPER_ADMIN — Super Administrador", destino: "/" },
  { id: "DIRECTOR", label: "DIRECTOR — Director General", destino: "/" },
  { id: "DOCENTE", label: "DOCENTE — Docente / Coordinador", destino: "/flujos/titulacion" },
  { id: "MESA_PARTES", label: "MESA_PARTES — Mesa de Partes / Ventanilla", destino: "/tramite/ventanilla-presencial" },
  { id: "ESTUDIANTE", label: "ESTUDIANTE — Estudiante / Administrado", destino: "/casilla" },
];

const CLAVE_TOKEN = "sigd_token";
const CLAVE_ROL = "sigd_rol";
const CLAVE_PERMISOS = "sigd_permisos";
const CLAVE_REMEMBER_USER = "sigd_remembered_user";

export default function LoginFormCard(): React.JSX.Element {
  const navigate = useNavigate();

  // Estados controlados exigidos con inicializadores perezosos para evitar re-renderizados
  const [identificador, setIdentificador] = useState<string>(() => {
    try {
      return typeof window !== "undefined"
        ? window.localStorage.getItem(CLAVE_REMEMBER_USER) ?? ""
        : "";
    } catch {
      return "";
    }
  });

  const [password, setPassword] = useState<string>("");

  const [remember, setRemember] = useState<boolean>(() => {
    try {
      return typeof window !== "undefined"
        ? Boolean(window.localStorage.getItem(CLAVE_REMEMBER_USER))
        : false;
    } catch {
      return false;
    }
  });

  const [showPassword, setShowPassword] = useState<boolean>(false);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showForgotModal, setShowForgotModal] = useState<boolean>(false);

  const handleIdentificadorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIdentificador(e.target.value);
    if (errorMessage) setErrorMessage(null);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (errorMessage) setErrorMessage(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    const trimmedUser = identificador.trim();
    if (!trimmedUser) {
      setErrorMessage("Por favor, ingrese su usuario, DNI o correo institucional.");
      return;
    }
    if (!password) {
      setErrorMessage("Por favor, ingrese su contraseña de acceso.");
      return;
    }

    setIsSubmitting(true);
    try {
      const authResult = await autenticarCredenciales({
        identificador: trimmedUser,
        password,
      });

      if (!authResult.exito) {
        window.localStorage.removeItem(CLAVE_TOKEN);
        window.localStorage.removeItem("token");
        window.localStorage.removeItem(CLAVE_ROL);
        window.localStorage.removeItem(CLAVE_PERMISOS);
        window.localStorage.removeItem("sigd_usuario_nombre");
        window.localStorage.removeItem("sigd_usuario_correo");
        useAuthStore.setState({
          accessToken: null,
          refreshToken: null,
          usuario: null,
          isAuthenticated: false,
        });
        setErrorMessage(authResult.mensaje);
        return;
      }

      if (remember) {
        window.localStorage.setItem(CLAVE_REMEMBER_USER, trimmedUser);
      } else {
        window.localStorage.removeItem(CLAVE_REMEMBER_USER);
      }

      useAuthStore.getState().setSession(
        authResult.token,
        {
          id: authResult.usuario.id,
          nombreCompleto: authResult.usuario.nombreCompleto,
          correo: authResult.usuario.correo,
          rol: authResult.usuario.rol,
          areaId: authResult.usuario.areaId,
        },
        authResult.refreshToken,
      );

      navigate(destinoPorRol(authResult.usuario.rol), { replace: true });
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al verificar sus credenciales. Intente nuevamente.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      {/* Tarjeta institucional blanca con sombra sutil */}
      <section
        aria-labelledby="titulo-login"
        className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-9 shadow-sm"
      >
        {/* Encabezado del Formulario */}
        <div className="mb-6 space-y-1">
          <h2
            id="titulo-login"
            className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0c2340]"
          >
            Iniciar Sesión
          </h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            Ingrese sus credenciales institucionales para acceder a su casilla y bandeja de gestión.
          </p>
        </div>

        {errorMessage && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" aria-hidden="true" />
            <div className="flex-1 font-medium leading-relaxed">{errorMessage}</div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="text-red-500 hover:text-red-800 text-sm font-bold leading-none p-0.5"
              aria-label="Cerrar mensaje de error"
            >
              ×
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* Campo: Usuario, DNI o Correo Institucional */}
          <div>
            <label
              htmlFor="identificador"
              className="block text-xs font-bold uppercase tracking-wider text-slate-700"
            >
              Usuario, DNI o Correo Institucional
            </label>
            <div className="relative mt-1.5">
              <div
                className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400"
                aria-hidden="true"
              >
                <User className="h-4 w-4" />
              </div>
              <input
                id="identificador"
                name="identificador"
                type="text"
                value={identificador}
                onChange={handleIdentificadorChange}
                placeholder="Ej. 70123456 o usuario@iestpsuiza.edu.pe"
                autoComplete="username"
                required
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0c2340] focus:outline-none focus:ring-2 focus:ring-[#0c2340]/20 transition-all"
              />
            </div>
          </div>

          {/* Campo: Contraseña con Toggle Interactivo */}
          <div>
            <div className="flex items-center justify-between">
              <label
                htmlFor="password"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700"
              >
                Contraseña
              </label>
            </div>
            <div className="relative mt-1.5">
              <div
                className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400"
                aria-hidden="true"
              >
                <Lock className="h-4 w-4" />
              </div>
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={handlePasswordChange}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-11 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0c2340] focus:outline-none focus:ring-2 focus:ring-[#0c2340]/20 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-700 focus:outline-none transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {/* Fila: Recordar sesión y ¿Olvidó su clave? */}
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none text-xs sm:text-sm font-medium text-slate-600">
              <input
                type="checkbox"
                id="remember"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-[#0c2340] focus:ring-[#0c2340]/25"
              />
              <span>Recordar sesión</span>
            </label>

            <button
              type="button"
              onClick={() => setShowForgotModal(true)}
              className="text-xs sm:text-sm font-semibold text-[#0f3261] hover:text-[#0c2340] hover:underline focus:outline-none"
            >
              ¿Olvidó su clave?
            </button>
          </div>

          {/* Botón Principal "Ingresar" en Azul Marino Sólido */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full mt-2 rounded-xl bg-[#0c2340] hover:bg-[#0f3261] active:bg-[#081a30] text-white font-semibold py-3 px-4 shadow-sm hover:shadow transition-all duration-150 flex items-center justify-center gap-2 text-sm disabled:opacity-75 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <span
                  className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
                  aria-hidden="true"
                />
                <span>Validando credenciales...</span>
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4" aria-hidden="true" />
                <span>Ingresar</span>
              </>
            )}
          </button>
        </form>

        {/* Separador Institucional */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-slate-200" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white px-3 text-slate-400 uppercase tracking-wider font-semibold">
              Atención al Ciudadano
            </span>
          </div>
        </div>

        {/* Enlace Discreto a la Mesa de Partes Virtual */}
        <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 p-3.5 text-center text-xs text-slate-600">
          <p className="leading-relaxed">
            ¿Es ciudadano o no cuenta con usuario interno?
          </p>
          <Link
            to="/tramite/mesa-partes-virtual"
            className="mt-1 inline-flex items-center gap-1.5 font-bold text-[#0c2340] hover:text-[#0f3261] hover:underline transition-colors"
          >
            <span>Presentar solicitud en Mesa de Partes Virtual</span>
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </section>

      {/* Modal / Diálogo de Asistencia para ¿Olvidó su clave? */}
      {showForgotModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-recuperacion-titulo"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-[#0c2340]">
                <ShieldAlert className="h-5 w-5 text-[#0f3261]" aria-hidden="true" />
                <h3 id="modal-recuperacion-titulo" className="font-bold text-base">
                  Restablecimiento de Credenciales
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                aria-label="Cerrar ventana de ayuda"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Por razones de seguridad institucional y de acuerdo con la Directiva de Seguridad de la Información, las claves de acceso al SIGD no se envían por canales no verificados.
            </p>

            <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3.5 text-xs text-blue-900 space-y-2">
              <div className="flex items-start gap-2">
                <HelpCircle className="h-4 w-4 text-blue-700 shrink-0 mt-0.5" aria-hidden="true" />
                <p>
                  Para restablecer su contraseña, por favor contacte a la{" "}
                  <strong>Oficina de Tecnologías de la Información (OTI)</strong> del IESTP "Suiza" o envíe un correo desde su casilla institucional a:
                </p>
              </div>
              <p className="font-mono text-center font-bold text-blue-800 bg-white/70 py-1.5 rounded-lg border border-blue-200/60">
                soporte.sigd@iestpsuiza.edu.pe
              </p>
              <p className="text-[11px] text-blue-700">
                Indique su DNI, nombres completos y cargo o programa de estudio correspondiente.
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="rounded-xl bg-[#0c2340] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0f3261] transition"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
