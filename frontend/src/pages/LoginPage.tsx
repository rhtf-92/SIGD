// Página de inicio de sesión demo para los guardianes de ruta (ENT-M05-01)
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const CLAVE_TOKEN = "sigd_token";
const CLAVE_ROL = "sigd_rol";
const CLAVE_PERMISOS = "sigd_permisos";

const ROLES_DEMO = ["admin", "responsable", "operador", "consulta"];

export default function LoginPage() {
  const navigate = useNavigate();
  const [rol, setRol] = useState("admin");

  function iniciarSesionDemo() {
    window.localStorage.setItem(CLAVE_TOKEN, "demo-jwt-" + Date.now());
    window.localStorage.setItem(CLAVE_ROL, rol);
    if (!window.localStorage.getItem(CLAVE_PERMISOS)) {
      window.localStorage.removeItem(CLAVE_PERMISOS);
    }
    navigate("/administracion", { replace: true });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 text-slate-900">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-bold text-blue-700">SIGD</p>
        <h1 className="mt-1 text-2xl font-bold">Iniciar sesión</h1>
        <p className="mt-1 text-sm text-slate-500">
          Acceso demostrativo para validar los guardianes de ruta (RBAC).
        </p>

        <div className="mt-6">
          <label htmlFor="rol" className="mb-2 block text-sm font-semibold">
            Rol institucional
          </label>
          <select
            id="rol"
            value={rol}
            onChange={(event) => setRol(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          >
            {ROLES_DEMO.map((opcion) => (
              <option key={opcion} value={opcion}>
                {opcion}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={iniciarSesionDemo}
          className="mt-6 w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
        >
          Ingresar al panel
        </button>
      </section>
    </main>
  );
}