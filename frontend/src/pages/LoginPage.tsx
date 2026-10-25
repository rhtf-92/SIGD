import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuthStore } from "../stores/authStore";
import { ApiHttpError } from "../types/api";
import { DESTINO_POR_ROL, type RolCanonica } from "../config/navigation.config";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((state) => state.login);
  const [identificador, setIdentificador] = useState("");
  const [password, setPassword] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function iniciarSesion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setError(null);
    try {
      await login({ identificador: identificador.trim(), password });
      const rol = useAuthStore.getState().usuario?.rol;
      const destinoPrevio = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname;
      navigate(destinoPrevio || (rol ? DESTINO_POR_ROL[rol as RolCanonica] : undefined) || "/", { replace: true });
    } catch (cause) {
      setError(cause instanceof ApiHttpError
        ? cause.problemDetails.detail || "No fue posible iniciar sesión."
        : "No se pudo conectar con el servicio de autenticación.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="relative flex min-h-screen min-h-dvh items-center justify-center bg-gradient-to-br from-slate-50 via-cyan-50/25 to-teal-50/15 px-3.5 py-6 text-slate-900">
      {/* Halo ambiental suave estilo Liquid Glass */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 h-80 w-80 rounded-full bg-cyan-200/25 blur-3xl opacity-80" />
      </div>

      <section className="relative overflow-hidden w-full max-w-md rounded-3xl border border-white/85 bg-gradient-to-br from-white/92 via-cyan-50/40 to-sky-50/25 p-6 sm:p-8 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.95),inset_0_-1px_2px_0_rgba(6,182,212,0.06),0_16px_48px_-8px_rgba(6,182,212,0.14),0_2px_12px_-2px_rgba(0,0,0,0.02)] ring-1 ring-cyan-200/50 backdrop-blur-md before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-[1.5px] before:bg-gradient-to-r before:from-transparent before:via-white before:to-transparent after:pointer-events-none after:absolute after:-top-24 after:-right-24 after:h-48 after:w-48 after:rounded-full after:bg-cyan-300/15 after:blur-2xl">
        <Link to="/" className="mb-4 inline-flex items-center gap-1.5 rounded-xl border border-cyan-200/80 bg-white/90 px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-cyan-50/80 hover:border-cyan-300 transition">
          ← Volver al inicio
        </Link>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-cyan-500 animate-pulse shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
          <p className="text-xs font-bold uppercase tracking-wider text-cyan-800">SIGD IESTP &quot;Suiza&quot;</p>
        </div>
        <h1 className="mt-1 text-2xl font-bold">Iniciar sesión</h1>
        <p className="mt-1 text-sm text-slate-500">Ingrese con su cuenta institucional o ciudadana.</p>
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/80 p-2.5 text-xs text-amber-900 flex items-start gap-2 shadow-2xs">
          <span>⚠️ <strong>Aviso de seguridad:</strong> No compartas tus credenciales. Cierra sesión en equipos compartidos.</span>
        </div>
        <form onSubmit={iniciarSesion} className="mt-6 space-y-4">
          <div>
            <label htmlFor="identificador" className="mb-2 block text-sm font-semibold">Usuario o correo</label>
            <input id="identificador" name="identificador" autoComplete="username" required value={identificador}
              onChange={(event) => setIdentificador(event.target.value)}
              className="w-full rounded-xl border border-cyan-200/90 bg-white px-3 py-2.5 text-sm shadow-inner focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500 transition" />
          </div>
          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-semibold">Contraseña</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-cyan-200/90 bg-white px-3 py-2.5 text-sm shadow-inner focus:outline-none focus:ring-2 focus:ring-cyan-500/40 focus:border-cyan-500 transition" />
          </div>
          {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={enviando}
            className="w-full rounded-xl bg-gradient-to-r from-teal-600 via-cyan-600 to-sky-600 hover:from-teal-700 hover:via-cyan-700 hover:to-sky-700 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-cyan-600/20 transition hover:shadow-cyan-600/30 disabled:opacity-60 active:scale-[0.99]">
            {enviando ? "Ingresando…" : "Ingresar al sistema"}
          </button>
        </form>
      </section>
    </main>
  );
}
