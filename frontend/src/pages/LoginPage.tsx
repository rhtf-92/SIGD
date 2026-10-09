import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useAuthStore } from "../stores/authStore";
import { permisosIniciales } from "../hooks/useRbacConfig";

export const ROLES_CANONICOS = [
  { id: "SUPER_ADMIN", label: "SUPER_ADMIN — Super Administrador", destino: "/administracion" },
  { id: "DIRECTOR", label: "DIRECTOR — Director General", destino: "/administracion" },
  { id: "DOCENTE", label: "DOCENTE — Docente / Coordinador", destino: "/flujos/titulacion" },
  { id: "MESA_PARTES", label: "MESA_PARTES — Mesa de Partes / Ventanilla", destino: "/tramite/ventanilla-presencial" },
  { id: "ESTUDIANTE", label: "ESTUDIANTE — Estudiante / Administrado", destino: "/casilla" },
];

const ROL_DESTINO: Record<string, string> = {
  SUPER_ADMIN: "/administracion",
  DIRECTOR: "/administracion",
  DOCENTE: "/flujos/titulacion",
  MESA_PARTES: "/tramite/ventanilla-presencial",
  ESTUDIANTE: "/casilla",
};

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [rol, setRol] = useState("SUPER_ADMIN");
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
      const rolCanonico = useAuthStore.getState().usuario?.rol ?? "ESTUDIANTE";
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

  function iniciarSesionDemo() {
    const CLAVE_TOKEN = "sigd_token";
    const CLAVE_ROL = "sigd_rol";
    const CLAVE_PERMISOS = "sigd_permisos";
    window.localStorage.setItem(CLAVE_TOKEN, "demo-jwt-" + Date.now());
    window.localStorage.setItem(CLAVE_ROL, rol);
    window.localStorage.setItem(CLAVE_PERMISOS, JSON.stringify(permisosIniciales));
    const encontrado = ROLES_CANONICOS.find((item) => item.id === rol);
    const destino = encontrado ? encontrado.destino : "/administracion";
    navigate(destino, { replace: true });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 text-slate-900">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          ← Volver al inicio
        </Link>
        <p className="text-sm font-bold text-blue-700">SIGD IESTP "SUIZA"</p>
        <h1 className="mt-1 text-2xl font-bold">Iniciar sesión</h1>
        <p className="mt-1 text-sm text-slate-500">
          Acceso por roles institucionales canónicos para control de acceso (RBAC).
        </p>

        <form onSubmit={iniciarSesionReal} className="mt-6 space-y-4">
          <div>
            <label htmlFor="identificador" className="mb-2 block text-sm font-semibold">
              Usuario o correo institucional
            </label>
            <input
              id="identificador"
              type="text"
              autoComplete="username"
              value={identificador}
              onChange={(event) => setIdentificador(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-medium"
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-semibold">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-medium"
              required
              minLength={6}
            />
          </div>

          {error ? (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={enviando}
            className="mt-2 w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:opacity-60"
          >
            {enviando ? "Ingresando…" : "Ingresar al sistema"}
          </button>
        </form>

        <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          o
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <div className="space-y-3">
          <label htmlFor="rol" className="block text-sm font-semibold">
            Modo demostración — Rol institucional canónico
          </label>
          <select
            id="rol"
            value={rol}
            onChange={(event) => setRol(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-medium"
          >
            {ROLES_CANONICOS.map((opcion) => (
              <option key={opcion.id} value={opcion.id}>
                {opcion.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={iniciarSesionDemo}
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Entrar en modo demostración
          </button>
        </div>
      </section>
    </main>
  );
}