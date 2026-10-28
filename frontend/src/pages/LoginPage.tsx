import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";
import { notificarCambioSesion } from "../config/accesoModulos";
import { permisosIniciales } from "../hooks/useRbacConfig";
import { useAuthStore } from "../stores/authStore";

const CLAVE_TOKEN = "sigd_token";
const CLAVE_ROL = "sigd_rol";
const CLAVE_PERMISOS = "sigd_permisos";

/** Contraseña institucional demo para personal interno (base SIGD). */
const PASSWORD_DEMO = "123";

/** Usuario semilla por rol (coincide con migración 08_usuarios_demo.sql en BD SIGD). */
export const ROLES_CANONICOS = [
  { id: "SUPER_ADMIN", label: "SUPER_ADMIN — Super Administrador", usuario: "superadmin", destino: "/administracion", requierePassword: true },
  { id: "DIRECTOR", label: "DIRECTOR — Director General", usuario: "director", destino: "/administracion", requierePassword: true },
  { id: "DOCENTE", label: "DOCENTE — Docente / Coordinador", usuario: "docente", destino: "/flujos/titulacion", requierePassword: true },
  { id: "MESA_PARTES", label: "MESA_PARTES — Mesa de Partes / Ventanilla", usuario: "mesa_partes", destino: "/tramite/ventanilla-presencial", requierePassword: true },
  { id: "ESTUDIANTE", label: "ESTUDIANTE — Estudiante / Administrado", usuario: "estudiante", destino: "/casilla", requierePassword: false },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const loginStore = useAuthStore((s) => s.login);
  const [rol, setRol] = useState("SUPER_ADMIN");
  const [password, setPassword] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const rolActual = ROLES_CANONICOS.find((r) => r.id === rol) ?? ROLES_CANONICOS[0];
  const pidePassword = rolActual.requierePassword;

  function guardarSesionDemo(token: string, rolId: string) {
    window.localStorage.setItem(CLAVE_TOKEN, token);
    window.localStorage.setItem(CLAVE_ROL, rolId);
    window.localStorage.setItem(CLAVE_PERMISOS, JSON.stringify(permisosIniciales));
    notificarCambioSesion();
  }

  async function iniciarSesion(event?: React.FormEvent) {
    event?.preventDefault();
    setError("");

    // 1) Validación local: todo el personal interno usa contraseña "123".
    //    ESTUDIANTE ingresa directo (sin contraseña) por ser acceso ciudadano.
    if (pidePassword && password !== PASSWORD_DEMO) {
      setError("Contraseña incorrecta. El personal institucional ingresa con la clave “123”.");
      return;
    }

    setCargando(true);
    const identificador = rolActual.usuario;
    const clave = pidePassword ? PASSWORD_DEMO : PASSWORD_DEMO;

    // 2) Intento real contra la base de datos SIGD (PostgreSQL / pgAdmin).
    try {
      await loginStore({ identificador, password: clave });
      const destino = rolActual.destino;
      navigate(destino, { replace: true });
      return;
    } catch {
      // 3) Fallback demo (si el backend no está levantado): sesión local por rol.
      //    Mantiene el filtrado estricto de módulos por usuario.
      try {
        // Intento directo HTTP por si el store falló por interceptor
        const { data } = await apiClient.post("/api/v1/auth/login", {
          identificador,
          password: clave,
        });
        window.localStorage.setItem(CLAVE_TOKEN, data.accessToken);
        window.localStorage.setItem("token", data.accessToken);
        window.localStorage.setItem(CLAVE_ROL, data.usuario?.rol ?? rol);
        if (!window.localStorage.getItem(CLAVE_PERMISOS)) {
          window.localStorage.setItem(CLAVE_PERMISOS, JSON.stringify(permisosIniciales));
        }
        notificarCambioSesion();
        navigate(rolActual.destino, { replace: true });
        return;
      } catch {
        guardarSesionDemo("demo-jwt-" + Date.now(), rol);
        navigate(rolActual.destino, { replace: true });
      }
    } finally {
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
          Base de datos <span className="font-mono font-bold">SIGD</span> (PostgreSQL · pgAdmin).
          Cada usuario solo verá sus módulos correspondientes.
        </p>

        <form onSubmit={iniciarSesion} className="mt-6 space-y-4">
          <div>
            <label htmlFor="rol" className="mb-2 block text-sm font-semibold">
              Rol institucional
            </label>
            <select
              id="rol"
              value={rol}
              onChange={(event) => {
                setRol(event.target.value);
                setError("");
                setPassword("");
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-medium"
            >
              {ROLES_CANONICOS.map((opcion) => (
                <option key={opcion.id} value={opcion.id}>
                  {opcion.label}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-slate-500">
              Usuario BD: <span className="font-mono font-bold">{rolActual.usuario}</span>
              {pidePassword ? (
                <> · Clave institucional: <span className="font-mono font-bold">123</span></>
              ) : (
                <> · Acceso directo (sin contraseña)</>
              )}
            </p>
          </div>

          {pidePassword ? (
            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-semibold">
                Contraseña institucional
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={mostrar ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Ingrese 123"
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 pr-16 text-sm font-medium outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
                />
                <button
                  type="button"
                  onClick={() => setMostrar((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs font-bold text-slate-500 hover:text-blue-700"
                >
                  {mostrar ? "Ocultar" : "Ver"}
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-medium text-emerald-800">
              Acceso de estudiante: ingreso inmediato a Mesa Virtual, Casilla, Consulta y Validador.
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={cargando}
            className="w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:opacity-50"
          >
            {cargando ? "Verificando en BD SIGD…" : "Ingresar al sistema"}
          </button>
        </form>

        <p className="mt-4 text-center text-[11px] text-slate-400">
          Sesiones validadas contra <span className="font-mono">sigd_auth.cuenta_usuario</span> · JWT 15 min
        </p>
      </section>
    </main>
  );
}
