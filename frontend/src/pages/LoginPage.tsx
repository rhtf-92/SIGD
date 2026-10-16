import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Lock, LogIn, ShieldCheck, User } from "lucide-react";

import { useAuthStore } from "../stores/authStore";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [identificador, setIdentificador] = useState("admin");
  const [password, setPassword] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const destinoDesdeEstado = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;

  async function iniciarSesionReal(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await useAuthStore.getState().login({ identificador, password });
      const rolCanonico = useAuthStore.getState().usuario?.rol ?? "CIUDADANO";
      const ROL_DESTINO: Record<string, string> = {
        ADMINISTRADOR: "/administracion",
        DIRECTOR: "/administracion",
        SECRETARIO: "/flujos/titulacion",
        ESPECIALISTA: "/flujos/titulacion",
        MESA_PARTES: "/tramite/ventanilla-presencial",
        CIUDADANO: "/casilla",
      };
      navigate(destinoDesdeEstado ?? ROL_DESTINO[rolCanonico] ?? "/", { replace: true });
    } catch (causa) {
      const detalle =
        (causa as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Credenciales inválidas o servicio no disponible.";
      setError(detalle);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-[#F8FAFC] px-4 py-12 text-slate-900 sm:px-6">
      {/* Ambient background glow */}
      <div 
        aria-hidden="true" 
        className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center overflow-hidden"
      >
        <div className="h-96 w-96 rounded-full bg-blue-600/10 blur-3xl" />
        <div className="h-80 w-80 -translate-x-40 translate-y-20 rounded-full bg-indigo-500/10 blur-3xl" />
      </div>

      <section className="relative w-full max-w-md overflow-hidden rounded-3xl border border-slate-200/90 bg-white/90 p-8 shadow-xl shadow-slate-200/50 backdrop-blur-xl sm:p-10">
        <Link
          to="/"
          className="mb-6 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Volver al inicio</span>
        </Link>

        {/* Brand Crest */}
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-md shadow-blue-500/20">
            <svg
              className="h-6 w-6 text-white drop-shadow-sm"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 2L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-3zm1 14h-2v-3H8v-2h3V8h2v3h3v2h-3v3z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-extrabold uppercase tracking-wider text-blue-700">
              SIGD IESTP &quot;SUIZA&quot;
            </p>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              Iniciar sesión
            </h1>
          </div>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-slate-500 font-medium">
          Acceso institucional con control por roles canónicos (RBAC) para el Sistema Integral de Gestión Documentaria.
        </p>

        <form onSubmit={iniciarSesionReal} className="mt-6 space-y-4">
          <div>
            <label htmlFor="identificador" className="mb-1.5 block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Usuario o correo institucional
            </label>
            <div className="relative flex items-center">
              <User className="absolute left-3.5 h-4 w-4 text-slate-400" />
              <input
                id="identificador"
                type="text"
                autoComplete="username"
                value={identificador}
                onChange={(event) => setIdentificador(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-xs font-medium text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Contraseña
            </label>
            <div className="relative flex items-center">
              <Lock className="absolute left-3.5 h-4 w-4 text-slate-400" />
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-xs font-medium text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all"
                required
                minLength={6}
              />
            </div>
          </div>

          {error ? (
            <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={enviando}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-xs font-bold text-white shadow-md shadow-blue-500/20 transition-all hover:from-blue-500 hover:to-indigo-500 hover:shadow-lg hover:shadow-blue-500/30 active:scale-[0.99] disabled:opacity-60"
          >
            {enviando ? (
              <span>Ingresando…</span>
            ) : (
              <>
                <LogIn className="h-4 w-4" />
                <span>Ingresar al sistema</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-400 border-t border-slate-100 pt-4">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          <span>Canal Cifrado y Protegido • D.L. 1412</span>
        </div>
      </section>
    </main>
  );
}