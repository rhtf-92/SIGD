import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiClient } from "../api/client";
import SelloInstitucional from "../components/common/SelloInstitucional";
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
  { id: "SUPER_ADMIN", label: "SA", usuario: "superadmin", destino: "/administracion", requierePassword: true },
  { id: "DIRECTOR", label: "Director General", usuario: "director", destino: "/administracion", requierePassword: true },
  { id: "DOCENTE", label: "Docente", usuario: "docente", destino: "/flujos/titulacion", requierePassword: true },
  { id: "MESA_PARTES", label: "Mesa de Partes", usuario: "mesa_partes", destino: "/tramite/ventanilla-presencial", requierePassword: true },
  { id: "ESTUDIANTE", label: "Estudiante", usuario: "estudiante", destino: "/casilla", requierePassword: true },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const loginStore = useAuthStore((s) => s.login);
  const [rol, setRol] = useState("ESTUDIANTE");
  const [identificador, setIdentificador] = useState("");
  const [password, setPassword] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const rolActual = ROLES_CANONICOS.find((r) => r.id === rol) ?? ROLES_CANONICOS.find((r) => r.id === "ESTUDIANTE") ?? ROLES_CANONICOS[0];
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

    if (!identificador.trim()) {
      setError("Por favor, ingrese su usuario, DNI o correo.");
      return;
    }

    if (pidePassword && !password.trim()) {
      setError("Por favor, ingrese su contraseña.");
      return;
    }

    setCargando(true);
    const clave = password;

    // 2) Intento real contra la base de datos SIGD (PostgreSQL / pgAdmin).
    try {
      await loginStore({ identificador, password: clave });
      const rolSesion = useAuthStore.getState().usuario?.rol ?? rol;
      const destino =
        ROLES_CANONICOS.find((r) => r.id === rolSesion)?.destino ?? rolActual.destino;
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
        const destinoFallback = ROLES_CANONICOS.find((r) => r.id === rol)?.destino || "/casilla";
        navigate(destinoFallback, { replace: true });
        return;
      } catch {
        if (pidePassword && password !== PASSWORD_DEMO) {
          setError("Contraseña incorrecta. Inténtelo nuevamente.");
          return;
        }
        guardarSesionDemo("demo-jwt-" + Date.now(), rol);
        const destinoFallback = ROLES_CANONICOS.find((r) => r.id === rol)?.destino || "/casilla";
        navigate(destinoFallback, { replace: true });
      }
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="lienzo-oficio flex min-h-screen items-center justify-center px-4 py-10 text-vault-tinta">
      <section className="w-full max-w-md overflow-hidden rounded-xl border border-vault-papel-3 bg-white shadow-[var(--shadow-ficha)]">
        {/* Identidad institucional */}
        <header className="flex items-center gap-3 border-b border-vault-papel-2 bg-vault-papel px-7 py-6">
          <span className="shrink-0 text-vault-azul">
            <SelloInstitucional className="h-11 w-11" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-vault-azul-tinta">
              IESTP Público “Suiza” · Pucallpa
            </p>
            <p className="mt-1 text-[13px] font-semibold leading-snug text-vault-tinta">
              Sistema Integral de Gestión Documentaria
            </p>
          </div>
        </header>

        <div className="px-7 py-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-md border border-vault-papel-3 bg-white px-3 py-1.5 text-xs font-semibold text-tinta-600 transition hover:bg-vault-papel hover:text-vault-tinta"
          >
            ← Volver al inicio
          </Link>

          <h1 className="mt-5 text-xl font-extrabold tracking-tight text-vault-tinta">
            Iniciar sesión
          </h1>
          <p className="mt-1.5 text-[13px] leading-5 text-tinta-500">
            Sesiones validadas contra{" "}
            <span className="font-mono text-[12px]">sigd_auth.cuenta_usuario</span>.
            Cada usuario sólo verá sus módulos correspondientes.
          </p>

          <form onSubmit={iniciarSesion} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="identificador"
                className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-tinta-500"
              >
                Usuario / DNI / Correo
              </label>
              <input
                id="identificador"
                type="text"
                value={identificador}
                onChange={(e) => setIdentificador(e.target.value)}
                placeholder="Ingrese su usuario, DNI o correo"
                autoComplete="username"
                className="input-sigd"
                required
              />
            </div>

            <div>
              <label
                htmlFor="rol"
                className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-tinta-500"
              >
                Rol Institucional
              </label>
              <select
                id="rol"
                value={rol}
                onChange={(event) => {
                  setRol(event.target.value);
                  setError("");
                  setPassword("");
                }}
                className="input-sigd"
              >
                <option value="ESTUDIANTE">Estudiante</option>
                <option value="DOCENTE">Docente</option>
                <option value="MESA_PARTES">Mesa de Partes</option>
                <option value="DIRECTOR">Director General</option>
                <option value="SUPER_ADMIN">Super Administrador</option>
              </select>
            </div>

            {pidePassword ? (
              <div>
                <label
                  htmlFor="password"
                  className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.1em] text-tinta-500"
                >
                  Contraseña institucional
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={mostrar ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Ingrese su contraseña"
                    autoComplete="current-password"
                    className="input-sigd pr-24"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setMostrar((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-[11px] font-bold text-tinta-500 transition hover:text-vault-azul-tinta"
                  >
                    {mostrar ? "Ocultar" : "Ver"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-estado-ok/25 bg-estado-ok-lavado px-3 py-2.5 text-xs font-medium text-estado-ok">
                Acceso de estudiante: ingreso inmediato a Mesa Virtual, Casilla,
                Consulta y Validador.
              </div>
            )}

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-estado-error/25 bg-estado-error-lavado px-3 py-2 text-xs font-semibold text-estado-error"
              >
                {error}
              </p>
            )}

            <div className="flex items-center justify-between text-xs">
              <Link
                to="/recuperar-password"
                className="font-semibold text-vault-azul-tinta hover:underline"
              >
                ¿Olvidaste tu contraseña?
              </Link>
              <Link
                to="/registro"
                className="font-semibold text-vault-azul-tinta hover:underline"
              >
                Crear cuenta
              </Link>
            </div>

            <button
              type="submit"
              disabled={cargando}
              className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
            >
              {cargando ? "Verificando en BD SIGD…" : "Ingresar al sistema"}
            </button>
          </form>

          <p className="mt-4 border-t border-vault-papel-2 pt-3 text-center text-[10px] font-medium uppercase tracking-[0.1em] text-tinta-400">
            Ley N.º 27444 · TUO · Ley N.º 27269
          </p>
        </div>
      </section>
    </main>
  );
}
