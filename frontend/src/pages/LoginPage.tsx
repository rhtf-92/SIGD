import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Lock, User, AlertCircle, ArrowLeft, ShieldCheck, KeyRound } from "lucide-react";
import { useAuthStore } from "../stores/authStore";

export const ROLES_CANONICOS = [
  { id: "SUPER_ADMIN", label: "SUPER_ADMIN — Super Administrador", destino: "/administracion" },
  { id: "DIRECTOR", label: "DIRECTOR — Director General", destino: "/administracion" },
  { id: "DOCENTE", label: "DOCENTE — Docente / Coordinador", destino: "/flujos/titulacion" },
  { id: "MESA_PARTES", label: "MESA_PARTES — Mesa de Partes / Ventanilla", destino: "/tramite/ventanilla-presencial" },
  { id: "ESTUDIANTE", label: "ESTUDIANTE — Estudiante / Administrado", destino: "/casilla" },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuthStore();

  const [identificador, setIdentificador] = useState("admin");
  const [password, setPassword] = useState("admin");
  const [cargando, setCargando] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleLoginReal(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setCargando(true);

    try {
      await login({ identificador: identificador.trim(), password });
      const fromPath = (location.state as { from?: { pathname?: string; search?: string; hash?: string } | string } | null)?.from;
      let rutaDestino: string | undefined;

      if (typeof fromPath === "string") {
        rutaDestino = fromPath;
      } else if (fromPath?.pathname) {
        rutaDestino = `${fromPath.pathname}${fromPath.search ?? ""}${fromPath.hash ?? ""}`;
      }

      if (!rutaDestino) {
        const usuario = useAuthStore.getState().usuario;
        const rolDestino = ROLES_CANONICOS.find((r) => r.id === usuario?.rol)?.destino;
        rutaDestino = rolDestino || "/administracion";
      }

      navigate(rutaDestino, { replace: true });
    } catch (err: unknown) {
      const errorObj = err as { response?: { data?: { detail?: string; title?: string } }; message?: string };
      const mensaje =
        errorObj.response?.data?.detail ||
        errorObj.response?.data?.title ||
        errorObj.message ||
        "Credenciales no válidas. Verifique su usuario y contraseña institucional.";
      setErrorMsg(mensaje);
    } finally {
      setCargando(false);
    }
  }

  return (
    <div className="flex-1 w-full flex items-center justify-center bg-slate-100 px-3 py-6 sm:px-6 sm:py-12 text-slate-900">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 sm:p-8 shadow-sm">
        <Link
          to="/"
          className="mb-5 inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Volver al inicio</span>
        </Link>

        <div className="flex items-center gap-2.5 mb-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-800 text-white font-black text-sm shadow-xs">
            S
          </div>
          <div>
            <p className="text-xs font-bold text-blue-800 uppercase tracking-wider">
              IESTP &quot;Suiza&quot; — Pucallpa
            </p>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900">
              Acceso al Sistema SIGD
            </h1>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-slate-500 mb-6">
          Autenticación institucional de personal directivo, docente y administrativo.
        </p>

        {errorMsg && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
            <div>
              <p className="font-bold">Error de autenticación</p>
              <p className="mt-0.5">{errorMsg}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleLoginReal} className="space-y-4">
          <div>
            <label
              htmlFor="identificador"
              className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1"
            >
              Usuario o Correo Institucional
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <User className="h-4 w-4" />
              </span>
              <input
                id="identificador"
                type="text"
                required
                value={identificador}
                onChange={(e) => setIdentificador(e.target.value)}
                placeholder="admin o usuario@iestpsuiza.edu.pe"
                className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-xs sm:text-sm font-medium text-slate-800 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1"
            >
              Contraseña
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Lock className="h-4 w-4" />
              </span>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-xs sm:text-sm font-medium text-slate-800 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={cargando}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-800 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-blue-900 transition disabled:opacity-50"
          >
            {cargando ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Verificando credenciales…</span>
              </>
            ) : (
              <>
                <KeyRound className="h-4 w-4" />
                <span>Ingresar con Credenciales Oficiales</span>
              </>
            )}
          </button>

          {/* Credenciales maestras institucionales */}
          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-xs text-slate-700">
            <p className="font-bold text-blue-900 flex items-center gap-1.5 mb-1">
              <ShieldCheck className="h-3.5 w-3.5 text-blue-700" />
              <span>Acceso administrativo institucional:</span>
            </p>
            <p className="text-[11px] text-slate-600 font-mono">
              Usuario: <strong>admin</strong> | Clave: <strong>admin</strong>
            </p>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              ¿Eres un ciudadano o administrado nuevo?{" "}
              <Link to="/registro" className="font-bold text-blue-700 hover:underline">
                Crear cuenta y casilla →
              </Link>
            </p>
          </div>
        </form>
      </section>
    </div>
  );
}