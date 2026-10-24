import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuthStore } from "../stores/authStore";
import { ApiHttpError } from "../types/api";

const DESTINO_POR_ROL: Record<string, string> = {
  ADMINISTRADOR: "/administracion",
  CIUDADANO: "/tramite",
  DIRECTOR: "/reportes",
  ESPECIALISTA: "/expedientes",
  MESA_PARTES: "/tramite/ventanilla-presencial",
  SECRETARIO: "/expedientes",
};

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
      navigate(destinoPrevio || DESTINO_POR_ROL[rol ?? ""] || "/", { replace: true });
    } catch (cause) {
      setError(cause instanceof ApiHttpError
        ? cause.problemDetails.detail || "No fue posible iniciar sesión."
        : "No se pudo conectar con el servicio de autenticación.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 text-slate-900">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <Link to="/" className="mb-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
          ← Volver al inicio
        </Link>
        <p className="text-sm font-bold text-blue-700">SIGD IESTP "SUIZA"</p>
        <h1 className="mt-1 text-2xl font-bold">Iniciar sesión</h1>
        <p className="mt-1 text-sm text-slate-500">Ingrese con su cuenta institucional o ciudadana.</p>
        <form onSubmit={iniciarSesion} className="mt-6 space-y-4">
          <div>
            <label htmlFor="identificador" className="mb-2 block text-sm font-semibold">Usuario o correo</label>
            <input id="identificador" name="identificador" autoComplete="username" required value={identificador}
              onChange={(event) => setIdentificador(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
          </div>
          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-semibold">Contraseña</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
          </div>
          {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={enviando}
            className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60">
            {enviando ? "Ingresando…" : "Ingresar al sistema"}
          </button>
        </form>
      </section>
    </main>
  );
}
