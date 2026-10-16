import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { permisosIniciales } from "../hooks/useRbacConfig";
import { env } from "../config/env";
import { useAuthStore } from "../stores/authStore";
import axios from "axios";
import { ApiHttpError } from "../types/api";

const CLAVE_ROL = "sigd_rol";
const CLAVE_PERMISOS = "sigd_permisos";

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
  const login = useAuthStore((state) => state.login);
  const setToken = useAuthStore((state) => state.setToken);
  const [identificador, setIdentificador] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [rol, setRol] = useState("SUPER_ADMIN");

  function rutaDestino(): string {
    const desde = location.state?.from as
      | { pathname?: string; search?: string; hash?: string }
      | undefined;
    return desde?.pathname
      ? `${desde.pathname}${desde.search ?? ""}${desde.hash ?? ""}`
      : "/casilla";
  }

  async function iniciarSesion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!identificador.trim() || !password) {
      setError("Ingresa tu usuario o correo y tu contraseña.");
      return;
    }

    setCargando(true);
    try {
      await login({ identificador: identificador.trim(), password });
      navigate(rutaDestino(), { replace: true });
    } catch (cause) {
      const status =
        cause instanceof ApiHttpError
          ? cause.status
          : axios.isAxiosError(cause)
            ? cause.response?.status
            : undefined;
      const code =
        cause instanceof ApiHttpError
          ? cause.problemDetails.code.toUpperCase()
          : axios.isAxiosError(cause)
            ? String(cause.response?.data?.code ?? "").toUpperCase()
            : "";

      if (
        status === 423 ||
        code.includes("LOCKED") ||
        code.includes("BLOCKED")
      ) {
        setError("Tu cuenta está bloqueada. Contacta con soporte institucional.");
      } else if (
        code === "ACCOUNT_DISABLED" ||
        code.includes("INACTIVE") ||
        code.includes("DISABLED")
      ) {
        setError("Tu cuenta está inactiva. Contacta con soporte institucional.");
      } else if (status === 401) {
        setError("Usuario/correo o contraseña inválidos.");
      } else if (
        (cause instanceof ApiHttpError && code === "ERR_NETWORK") ||
        (axios.isAxiosError(cause) && !cause.response)
      ) {
        setError("No se pudo conectar con el servidor.");
      } else {
        setError("Ocurrió un error inesperado. Intenta nuevamente.");
      }
    } finally {
      setCargando(false);
    }
  }

  function iniciarSesionDemo() {
    if (!env.enableMocks) return;
    // Este acceso usa un token ficticio y solo existe para entornos de demostración.
    const tokenDemo = "demo-jwt-" + Date.now();
    setToken(tokenDemo);
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
          Ingresa con tu usuario o correo institucional.
        </p>

        <form className="mt-6 space-y-4" onSubmit={iniciarSesion} noValidate>
          <div>
            <label htmlFor="identificador" className="mb-2 block text-sm font-semibold">
              Usuario o correo
            </label>
            <input
              id="identificador"
              name="identificador"
              type="text"
              autoComplete="username"
              required
              value={identificador}
              onChange={(event) => setIdentificador(event.target.value)}
              disabled={cargando}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-semibold">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={cargando}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            />
          </div>
          {error && (
            <p role="alert" className="text-sm font-medium text-red-700">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={cargando}
            className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cargando ? "Ingresando..." : "Iniciar sesión"}
          </button>
        </form>

        {env.enableMocks && (
          <div className="mt-6 border-t border-slate-200 pt-5">
            <label htmlFor="rol-demo" className="mb-2 block text-sm font-semibold">
              Rol institucional para demostración
            </label>
            <select
              id="rol-demo"
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
              className="mt-3 w-full rounded-lg border border-blue-700 px-4 py-2.5 text-sm font-semibold text-blue-800 transition hover:bg-blue-50"
            >
              Entrar en modo demo
            </button>
          </div>
        )}
      </section>
    </main>
  );
}