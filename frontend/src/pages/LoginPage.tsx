import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

const DESTINOS: Record<string, string> = {
  ADMINISTRADOR: "/administracion",
  DIRECTOR: "/administracion",
  SECRETARIO: "/flujos/titulacion",
  ESPECIALISTA: "/expedientes",
  MESA_PARTES: "/tramite/ventanilla-presencial",
  CIUDADANO: "/casilla",
};

function mensajeError(error: unknown): string {
  if (typeof error === "object" && error !== null) {
    const posible = error as { message?: string; problem?: { detail?: string }; detail?: string };
    return posible.problem?.detail ?? posible.detail ?? posible.message ?? "No fue posible iniciar sesión.";
  }
  return "No fue posible iniciar sesión.";
}

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const seleccionarPerfil = useAuthStore((state) => state.seleccionarPerfil);
  const rolesDisponibles = useAuthStore((state) => state.rolesDisponibles);
  const [identificador, setIdentificador] = useState("");
  const [password, setPassword] = useState("");
  const [rolId, setRolId] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function autenticar(event: FormEvent) {
    event.preventDefault();
    setProcesando(true);
    setError(null);
    try {
      const ingresoDirecto = await login({ identificador, password });
      if (ingresoDirecto) {
        const rol = useAuthStore.getState().usuario?.rol ?? "";
        navigate(DESTINOS[rol] ?? "/", { replace: true });
      } else {
        const primerRol = useAuthStore.getState().rolesDisponibles[0];
        setRolId(primerRol?.id ?? "");
      }
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setProcesando(false);
    }
  }

  async function confirmarPerfil(event: FormEvent) {
    event.preventDefault();
    setProcesando(true);
    setError(null);
    try {
      await seleccionarPerfil(rolId);
      const rol = useAuthStore.getState().usuario?.rol ?? "";
      navigate(DESTINOS[rol] ?? "/", { replace: true });
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setProcesando(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 text-slate-900">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <Link to="/" className="mb-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
          ← Volver al inicio
        </Link>
        <p className="text-sm font-bold text-blue-700">SIGD IESTP &quot;SUIZA&quot;</p>
        <h1 className="mt-1 text-2xl font-bold">{rolesDisponibles.length ? "Seleccionar perfil" : "Iniciar sesión"}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {rolesDisponibles.length
            ? "Elige uno de tus perfiles institucionales activos."
            : "Ingresa con tus credenciales institucionales."}
        </p>

        {error && <div role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        {rolesDisponibles.length ? (
          <form className="mt-6 space-y-5" onSubmit={confirmarPerfil}>
            <div>
              <label htmlFor="perfil" className="mb-2 block text-sm font-semibold">Perfil activo</label>
              <select id="perfil" value={rolId} onChange={(event) => setRolId(event.target.value)} required
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-medium">
                {rolesDisponibles.map((rol) => <option key={rol.id} value={rol.id}>{rol.codigo} — {rol.nombre}</option>)}
              </select>
            </div>
            <button type="submit" disabled={procesando || !rolId}
              className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60">
              {procesando ? "Validando perfil…" : "Continuar"}
            </button>
          </form>
        ) : (
          <form className="mt-6 space-y-5" onSubmit={autenticar}>
            <div>
              <label htmlFor="identificador" className="mb-2 block text-sm font-semibold">Usuario o correo</label>
              <input id="identificador" value={identificador} onChange={(event) => setIdentificador(event.target.value)}
                autoComplete="username" required minLength={3}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
            </div>
            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-semibold">Contraseña</label>
              <input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password" required minLength={6}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm" />
            </div>
            <button type="submit" disabled={procesando}
              className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60">
              {procesando ? "Ingresando…" : "Ingresar al sistema"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
