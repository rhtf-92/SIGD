import { useState, useRef, useEffect, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  User,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  Loader2,
  Mail,
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
        // La cuenta existe pero no posee rol CIUDADANO para la Casilla
        useAuthStore.getState().logout();
        setError(
          "Su cuenta institucional no cuenta con rol CIUDADANO para acceder a la Casilla Electrónica. Este servicio es de uso exclusivo para ciudadanos y personas jurídicas administradas.",
        );
        return;
      }

      // Acceso concedido: Redirigir directamente a su casilla personal
      navigate("/casilla", { replace: true });
    } catch (err: unknown) {
      if (err instanceof ApiHttpError) {
        const detail = err.problemDetails?.detail ?? err.message;
        const code = err.problemDetails?.code;
        if (err.status === 401) {
          // Escenario C: Usuario no registrado o credenciales incorrectas (no revelar si existe o no)
          setError(
            "No fue posible iniciar sesión. Verifique sus credenciales o regístrese para continuar.",
          );
        } else if (
          err.status === 403 &&
          (code === "ACCOUNT_DISABLED" ||
            detail?.toLowerCase().includes("inactiv") ||
            detail?.toLowerCase().includes("suspendid"))
        ) {
          // Escenario D: Cuenta registrada pero aún inactiva
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
    <div className="min-h-screen bg-[#F0F6FD] text-slate-900 flex flex-col justify-between selection:bg-[#0073E6]/20">
      {/* Barra superior institucional simplificada */}
      <header className="w-full bg-[#082F7C] border-b border-[#005bb5]/30 text-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center font-bold text-white tracking-wider text-sm border border-white/20 group-hover:bg-white/20 transition">
              IS
            </div>
            <div>
              <p className="text-[11px] font-semibold text-blue-200 uppercase tracking-widest leading-none">
                IESTP «Suiza» — Pucallpa
              </p>
              <h1 className="text-sm font-bold text-white tracking-tight leading-snug">
                SIGD RENATO
              </h1>
            </div>
          </Link>
          <Link
            to="/"
            className="text-xs font-semibold text-blue-100 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition"
          >
            ← Volver a la portada
          </Link>
        </div>
      </header>

      {/* Contenedor central con tarjeta de autenticación */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-[480px]">
          {/* Tarjeta principal */}
          <div className="bg-white rounded-2xl border border-[#D7E8F8] shadow-[0_8px_30px_rgba(8,47,124,0.08)] overflow-hidden">
            {/* Encabezado visual de la tarjeta con franja institucional */}
            <div className="bg-gradient-to-r from-[#082F7C] to-[#0A3D9E] p-6 text-white text-center relative">
              <div className="mx-auto w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mb-3 shadow-inner border border-white/20">
                <Mail className="w-6 h-6 text-blue-200" aria-hidden="true" />
              </div>
              <span className="inline-block px-2.5 py-0.5 rounded-full bg-blue-500/30 text-blue-100 text-[11px] font-bold tracking-wider uppercase mb-1">
                Acceso Autenticado
              </span>
              <h2 className="text-2xl font-black tracking-tight text-white uppercase">
                CASILLA ELECTRÓNICA
              </h2>
              <p className="mt-1.5 text-xs text-blue-100/90 max-w-[340px] mx-auto leading-relaxed">
                Accede de manera segura a tus notificaciones y documentos electrónicos institucionales
              </p>
            </div>

            {/* Formulario */}
            <div className="p-6 sm:p-8">
              {/* Alerta de Error / Validación */}
              {error && (
                <div
                  role="alert"
                  className={`mb-5 p-3.5 rounded-xl border flex items-start gap-3 text-xs sm:text-sm leading-relaxed ${
                    cuentaInactiva
                      ? "bg-amber-50 border-amber-200 text-amber-900"
                      : "bg-red-50 border-red-200 text-red-800"
                  }`}
                >
                  <AlertCircle
                    className={`w-5 h-5 shrink-0 mt-0.5 ${
                      cuentaInactiva ? "text-amber-600" : "text-red-600"
                    }`}
                  />
                  <div className="space-y-2">
                    <p className="font-medium">{error}</p>
                    {cuentaInactiva && (
                      <div>
                        <Link
                          to="/activar-cuenta"
                          className="inline-flex items-center gap-1.5 font-bold text-amber-800 underline hover:text-amber-950 mt-1"
                        >
                          <span>Proceder a la activación de mi cuenta</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <form onSubmit={handleLogin} className="space-y-4.5" aria-busy={cargando}>
                {/* Campo 1: Usuario o correo */}
                <div>
                  <label
                    htmlFor="identificador"
                    className="block text-xs font-bold text-[#082F7C] uppercase tracking-wider mb-1.5"
                  >
                    Usuario o correo electrónico
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <User className="w-4.5 h-4.5" aria-hidden="true" />
                    </div>
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
                      placeholder="DNI, RUC o correo registrado"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 focus:border-[#0073E6] focus:ring-2 focus:ring-[#0073E6]/20 text-sm font-medium text-slate-800 placeholder:text-slate-400 transition outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                    />
                  </div>
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Ingrese el DNI/RUC registrado o la dirección de correo de su cuenta.
                  </span>
                </div>

                {/* Campo 2: Contraseña */}
                <div>
                  <label
                    htmlFor="password"
                    className="block text-xs font-bold text-[#082F7C] uppercase tracking-wider mb-1.5"
                  >
                    Contraseña
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4.5 h-4.5" aria-hidden="true" />
                    </div>
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
                      placeholder="••••••••"
                      className="w-full pl-10 pr-11 py-2.5 rounded-xl border border-slate-300 focus:border-[#0073E6] focus:ring-2 focus:ring-[#0073E6]/20 text-sm font-medium text-slate-800 placeholder:text-slate-400 transition outline-none disabled:bg-slate-100 disabled:cursor-not-allowed"
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarPassword(!mostrarPassword)}
                      disabled={cargando}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition cursor-pointer"
                      aria-label={mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    >
                      {mostrarPassword ? (
                        <EyeOff className="w-4.5 h-4.5" />
                      ) : (
                        <Eye className="w-4.5 h-4.5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Botón principal «Ingresar a mi Casilla» */}
                <button
                  type="submit"
                  disabled={cargando}
                  className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-[#0073E6] hover:bg-[#005bb5] text-white py-3 px-4 font-bold text-sm shadow-[0_4px_12px_rgba(0,115,230,0.25)] hover:shadow-[0_6px_16px_rgba(0,115,230,0.35)] hover:-translate-y-0.5 active:translate-y-0 transition duration-150 disabled:opacity-60 disabled:pointer-events-none cursor-pointer"
                >
                  {cargando ? (
                    <>
                      <Loader2 className="w-4.5 h-4.5 animate-spin" />
                      <span>Validando credenciales…</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4.5 h-4.5" />
                      <span>Ingresar a mi Casilla</span>
                      <ArrowRight className="w-4 h-4 ml-0.5" />
                    </>
                  )}
                </button>
              </form>

              {/* Separador y enlaces complementarios */}
              <div className="mt-6 pt-5 border-t border-slate-100 space-y-3 text-center text-xs text-slate-600">
                <p>
                  ¿No tienes una cuenta?{" "}
                  <Link
                    to="/registro"
                    className="font-bold text-[#0073E6] hover:text-[#005bb5] hover:underline"
                  >
                    Regístrate aquí
                  </Link>
                </p>

                <p className="text-[11px] text-slate-500">
                  ¿Ya te registraste pero no activaste tu cuenta?{" "}
                  <Link
                    to="/activar-cuenta"
                    className="font-semibold text-slate-700 hover:text-[#005bb5] underline"
                  >
                    Activar cuenta
                  </Link>
                </p>
              </div>
            </div>

            {/* Pie de tarjeta con nota legal institucional */}
            <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-100 flex items-center justify-center gap-2 text-[11px] text-slate-500 text-center">
              <ShieldCheck className="w-3.5 h-3.5 text-[#0073E6] shrink-0" />
              <span>
                Notificación administrativa con validez legal según la Ley N.º 31736
              </span>
            </div>
          </div>
        </div>
      </main>

      {/* Pie institucional */}
      <footer className="w-full py-4 text-center text-xs text-slate-500 border-t border-slate-200 bg-white">
        <p>
          Instituto de Educación Superior Tecnológico Público «Suiza» • Av. Centenario Km 4.5, Pucallpa
        </p>
      </footer>
    </div>
  );
}
