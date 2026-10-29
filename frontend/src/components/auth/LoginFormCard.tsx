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
  ShieldCheck,
  KeyRound,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { permisosIniciales } from "../../hooks/useRbacConfig";
import { useAuthStore } from "../../stores/authStore";
import {
  autenticarCredenciales,
  sincronizarRolPorIdentificador,
  USUARIOS_AUTORIZADOS,
  type RolCanonicoId,
  type UsuarioAutorizado,
} from "../../services/authService";

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

  // Rol institucional canónico y estados de interacción
  const [rol, setRol] = useState<string>("SUPER_ADMIN");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sugerenciaRol, setSugerenciaRol] = useState<RolCanonicoId | null>(null);
  const [showForgotModal, setShowForgotModal] = useState<boolean>(false);
  const [showDemoAccounts, setShowDemoAccounts] = useState<boolean>(false);

  // Sincronización proactiva del rol según el identificador ingresado
  const handleIdentificadorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nuevoValor = e.target.value;
    setIdentificador(nuevoValor);
    if (errorMessage) {
      setErrorMessage(null);
      setSugerenciaRol(null);
    }
    const rolDetectado = sincronizarRolPorIdentificador(nuevoValor);
    if (rolDetectado) {
      setRol(rolDetectado);
    }
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
    if (errorMessage) {
      setErrorMessage(null);
      setSugerenciaRol(null);
    }
  };

  const handleRolChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setRol(e.target.value);
    if (errorMessage) {
      setErrorMessage(null);
      setSugerenciaRol(null);
    }
  };

  const aplicarUsuarioDemo = (usuarioDemo: UsuarioAutorizado) => {
    setIdentificador(usuarioDemo.dni);
    setPassword(usuarioDemo.password);
    setRol(usuarioDemo.rol);
    setErrorMessage(null);
    setSugerenciaRol(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSugerenciaRol(null);

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
      // Validación estricta con el servicio institucional mock (simulando BD segura)
      const authResult = await autenticarCredenciales({
        identificador: trimmedUser,
        password,
        rolSeleccionado: rol,
      });

      if (!authResult.exito) {
        // Bloqueo de acceso indebido: limpiar cualquier token y credencial residual
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
        if (authResult.sugerenciaRol) {
          setSugerenciaRol(authResult.sugerenciaRol);
        }
        return;
      }

      // Autenticación Exitosa: Persistencia de usuario recordado
      if (remember) {
        window.localStorage.setItem(CLAVE_REMEMBER_USER, trimmedUser);
      } else {
        window.localStorage.removeItem(CLAVE_REMEMBER_USER);
      }

      // Persistir variables de sesión en localStorage únicamente tras autenticación válida
      window.localStorage.setItem(CLAVE_TOKEN, authResult.token);
      window.localStorage.setItem("token", authResult.token);
      window.localStorage.setItem(CLAVE_ROL, authResult.usuario.rol);
      window.localStorage.setItem(CLAVE_PERMISOS, JSON.stringify(permisosIniciales));
      window.localStorage.setItem("sigd_usuario_nombre", authResult.usuario.nombreCompleto);
      window.localStorage.setItem("sigd_usuario_correo", authResult.usuario.correo);

      // Sincronizar en el almacén reactivo useAuthStore
      useAuthStore.setState({
        accessToken: authResult.token,
        refreshToken: `sigd-refresh-${Date.now()}`,
        usuario: {
          id: authResult.usuario.id,
          nombreCompleto: authResult.usuario.nombreCompleto,
          correo: authResult.usuario.correo,
          rol: authResult.usuario.rol,
        },
        isAuthenticated: true,
      });

      // Redirección al panel institucional correspondiente según su rol RBAC
      navigate(authResult.destino, { replace: true });
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error
          ? err.message
          : "Ocurrió un error al verificar sus credenciales. Intente nuevamente.";
      setErrorMessage(errorMsg);
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

        {/* Mensaje de error accesible y alerta visual RBAC */}
        {errorMessage && (
          <div
            role="alert"
            className="mb-5 flex flex-col gap-2 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800"
          >
            <div className="flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" aria-hidden="true" />
              <div className="flex-1 font-medium leading-relaxed">{errorMessage}</div>
              <button
                type="button"
                onClick={() => {
                  setErrorMessage(null);
                  setSugerenciaRol(null);
                }}
                className="text-red-500 hover:text-red-800 text-sm font-bold leading-none p-0.5"
                aria-label="Cerrar mensaje de error"
              >
                ×
              </button>
            </div>

            {sugerenciaRol && (
              <div className="mt-1 flex items-center justify-between border-t border-red-200/60 pt-2">
                <span className="text-[11px] text-red-700">
                  ¿Desea cambiar el selector al rol autorizado?
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setRol(sugerenciaRol);
                    setSugerenciaRol(null);
                    setErrorMessage(null);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold px-2.5 py-1 text-[11px] transition shadow-xs"
                >
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Ajustar a {sugerenciaRol}</span>
                </button>
              </div>
            )}
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

          {/* Selector de Rol Institucional Canónico (Gobernanza RBAC) */}
          <div>
            <label
              htmlFor="rol"
              className="block text-xs font-bold uppercase tracking-wider text-slate-700"
            >
              Perfil / Rol Institucional Canónico
            </label>
            <div className="relative mt-1.5">
              <select
                id="rol"
                name="rol"
                value={rol}
                onChange={handleRolChange}
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 px-3 text-sm font-medium text-slate-800 focus:border-[#0c2340] focus:outline-none focus:ring-2 focus:ring-[#0c2340]/20 transition-all"
              >
                {ROLES_CANONICOS.map((opcion) => (
                  <option key={opcion.id} value={opcion.id}>
                    {opcion.label}
                  </option>
                ))}
              </select>
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

        {/* Panel Desplegable: Credenciales de Prueba Autorizadas (Asistente RBAC) */}
        <div className="mt-4 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setShowDemoAccounts((prev) => !prev)}
            className="w-full flex items-center justify-between text-[11px] font-semibold text-slate-500 hover:text-[#0c2340] transition py-1"
          >
            <span className="flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5 text-[#0c2340]" />
              Ver usuarios de prueba autorizados (5 Roles RBAC)
            </span>
            {showDemoAccounts ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>

          {showDemoAccounts && (
            <div className="mt-2.5 space-y-1.5 rounded-xl bg-slate-50 p-2.5 text-[11px] border border-slate-200/80">
              <p className="text-slate-600 font-medium pb-1">
                Haga clic sobre un rol para cargar automáticamente sus credenciales autorizadas:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {USUARIOS_AUTORIZADOS.filter((u) => u.activo).map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    aria-label={`Cargar credenciales ${u.rol}`}
                    onClick={() => aplicarUsuarioDemo(u)}
                    className="flex flex-col items-start p-2 rounded-lg bg-white border border-slate-200 hover:border-[#0c2340] hover:bg-slate-100/60 text-left transition"
                  >
                    <span className="font-bold text-[#0c2340]">{u.rol}</span>
                    <span className="text-[10px] text-slate-500 truncate w-full">
                      DNI: {u.dni} | Clave: {u.password}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

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
