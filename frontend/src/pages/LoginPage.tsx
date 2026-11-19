import { useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AUTH_RETURN_TO_STORAGE_KEY, useAuthStore } from "../stores/authStore";
import { ApiHttpError } from "../types/api";

const DESTINOS_POR_ROL: Record<string, string> = {
  SUPER_ADMIN: "/administracion",
  ADMINISTRADOR: "/administracion",
  DIRECTOR: "/administracion",
  DOCENTE: "/flujos/titulacion",
  MESA_PARTES: "/tramite/ventanilla-presencial",
  ESTUDIANTE: "/casilla",
};

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const login = useAuthStore((state) => state.login);
  const [identificador, setIdentificador] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enviando = useRef(false);

  async function iniciarSesion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (enviando.current) return;
    enviando.current = true;
    setCargando(true);
    setError(null);

    try {
      await login({ identificador: identificador.trim(), password });
      const rol = useAuthStore.getState().usuario?.rol;
      const routeState = location.state as { from?: { pathname?: unknown; search?: unknown; hash?: unknown } } | null;
      const statePath = routeState?.from;
      const returnFromState = statePath && typeof statePath.pathname === "string"
        ? `${statePath.pathname}${typeof statePath.search === "string" ? statePath.search : ""}${typeof statePath.hash === "string" ? statePath.hash : ""}`
        : null;
      let storedReturn: string | null = null;
      try {
        storedReturn = window.sessionStorage.getItem(AUTH_RETURN_TO_STORAGE_KEY);
      } catch {
      }
      const returnTo = returnFromState ?? storedReturn;
      const safeReturnTo = returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") &&
        !returnTo.startsWith("/login") && !returnTo.includes("\\")
        ? returnTo
        : null;
      try {
        window.sessionStorage.removeItem(AUTH_RETURN_TO_STORAGE_KEY);
      } catch {
      }
      navigate(safeReturnTo ?? (rol ? DESTINOS_POR_ROL[rol] ?? "/" : "/"), { replace: true });
    } catch (errorLogin: unknown) {
      if (errorLogin instanceof ApiHttpError) {
        const mensajeServidor =
          errorLogin.problemDetails?.detail ||
          errorLogin.problemDetails?.title ||
          errorLogin.message ||
          "";
        const status = errorLogin.status;
        const code = errorLogin.problemDetails?.code ?? "";

        if (status === 401) {
          setError("Credenciales incorrectas. Verifique su usuario o contraseña institucional.");
        } else if (status === 403) {
          if (code === "ACCOUNT_DISABLED" || mensajeServidor.toLowerCase().includes("deshabilitada") || mensajeServidor.toLowerCase().includes("suspendida")) {
            setError("Su cuenta institucional se encuentra suspendida o deshabilitada.");
          } else if (code === "ACCOUNT_WITHOUT_ROLES" || mensajeServidor.toLowerCase().includes("sin roles")) {
            setError("Su cuenta institucional no tiene roles activos asignados en el sistema.");
          } else {
            setError(mensajeServidor || "Acceso denegado a la plataforma institucional.");
          }
        } else if (status === 503 || code === "DATABASE_UNAVAILABLE") {
          setError(
            mensajeServidor && !mensajeServidor.toLowerCase().includes("network")
              ? mensajeServidor
              : "El servicio de base de datos no está disponible. Compruebe que PostgreSQL esté iniciado."
          );
        } else if (status === 500) {
          if (mensajeServidor.toLowerCase().includes("base de datos") || mensajeServidor.toLowerCase().includes("econnrefused")) {
            setError("No se pudo conectar con la base de datos PostgreSQL. Compruebe el servicio.");
          } else {
            setError("Error interno en el servidor. Por favor, intente nuevamente más tarde.");
          }
        } else if (status < 500) {
          setError(mensajeServidor || "Solicitud de inicio de sesión no válida.");
        } else {
          setError("No se pudo conectar con el servidor backend (http://localhost:3000). Compruebe que el servicio esté iniciado.");
        }
      } else if (errorLogin instanceof Error) {
        if (
          errorLogin.message.toLowerCase().includes("network") ||
          errorLogin.message.toLowerCase().includes("econnrefused") ||
          errorLogin.message.toLowerCase().includes("failed to fetch")
        ) {
          setError("No se pudo conectar con el servidor backend (http://localhost:3000). Compruebe que el servicio esté iniciado.");
        } else {
          setError(errorLogin.message);
        }
      } else {
        setError("No se pudo conectar con el servidor backend (http://localhost:3000). Compruebe que el servicio esté iniciado.");
      }
    } finally {
      enviando.current = false;
      setCargando(false);
    }
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
          Acceda con sus credenciales institucionales.
        </p>

        <form onSubmit={iniciarSesion} aria-busy={cargando}>
          <div className="mt-6">
            <label htmlFor="identificador" className="mb-2 block text-sm font-semibold">
              Usuario o correo institucional
            </label>
            <input
              id="identificador"
              type="text"
              autoComplete="username"
              required
              minLength={3}
              maxLength={100}
              value={identificador}
              onChange={(event) => setIdentificador(event.target.value)}
              disabled={cargando}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-medium"
            />
          </div>
          <div className="mt-4">
            <label htmlFor="password" className="mb-2 block text-sm font-semibold">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={6}
              maxLength={128}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={cargando}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-medium"
            />
          </div>
          {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}

          <button
            type="submit"
            disabled={cargando}
            className="mt-6 w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 transition disabled:opacity-60"
          >
            {cargando ? "Ingresando…" : "Ingresar al sistema"}
          </button>
        </form>
      </section>
    </main>
  );
}
