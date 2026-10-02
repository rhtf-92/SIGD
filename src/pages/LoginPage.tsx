import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { permisosIniciales } from "../hooks/useRbacConfig";

const CLAVE_TOKEN = "sigd_token";
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
  const [rol, setRol] = useState("SUPER_ADMIN");

  function iniciarSesionDemo() {
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

        <div className="mt-6">
          <label htmlFor="rol" className="mb-2 block text-sm font-semibold">
            Rol institucional canónico
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
        </div>

        <button
          type="button"
          onClick={iniciarSesionDemo}
          className="mt-6 w-full rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 transition"
        >
          Ingresar al sistema
        </button>
      </section>
    </main>
  );
}