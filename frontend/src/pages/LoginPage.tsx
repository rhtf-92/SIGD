import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  BadgeCheck,
  GraduationCap,
  LogIn,
  Mail,
  ShieldCheck,
} from "lucide-react";
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

const BENEFICIOS = [
  { icono: ShieldCheck, texto: "Validez legal y firma digital institucional" },
  { icono: Mail, texto: "Casilla electrónica y notificaciones oficiales" },
  { icono: BadgeCheck, texto: "Trazabilidad completa de expedientes y trámites" },
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
    <main className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <section className="grid w-full max-w-4xl overflow-hidden rounded-lg border border-sigd-line bg-white shadow-elevated md:grid-cols-2">
        {/* ── Panel institucional ─────────────────────────────────────── */}
        <div className="relative hidden flex-col justify-between overflow-hidden bg-[linear-gradient(150deg,#071c34_0%,#0a2540_45%,#0059a8_100%)] p-10 text-white md:flex">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-[#006ec7]/40 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-16 -left-10 h-52 w-52 rounded-full bg-[#e6007e]/25 blur-3xl"
          />

          <div className="relative">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#006ec7] to-[#003a6b] ring-1 ring-white/25">
                <GraduationCap className="h-5 w-5 text-[#f9e000]" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-extrabold uppercase tracking-[0.16em]">
                  SIGD
                </p>
                <p className="text-[11px] font-medium text-white/70">
                  IESTP &quot;Suiza&quot; — Pucallpa
                </p>
              </div>
            </div>

            <h2 className="mt-8 text-2xl font-extrabold tracking-tight">
              Gestión documentaria con validez legal
            </h2>
            <p className="mt-3 text-sm leading-6 text-white/80">
              Sistema Integral de Gestión Documentaria del IESTP Suiza de
              Pucallpa.
            </p>

            <ul className="mt-9 space-y-4">
              {BENEFICIOS.map((item) => {
                const Icono = item.icono;
                return (
                  <li key={item.texto} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white ring-1 ring-white/15">
                      <Icono className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="text-sm font-medium text-white/90">
                      {item.texto}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="relative mt-10 flex h-1.5 w-full overflow-hidden rounded-full">
            <span className="flex-1 bg-[#006ec7]" />
            <span className="flex-1 bg-[#e6007e]" />
            <span className="flex-1 bg-[#f9e000]" />
          </div>
        </div>

        {/* ── Formulario ──────────────────────────────────────────────── */}
        <div className="p-8 sm:p-10">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-control text-sm font-semibold text-sigd-muted transition hover:text-sigd-blue-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sigd-blue"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Volver al inicio
          </Link>

          <div className="mt-8">
            <span className="inline-flex items-center gap-2">
              <GraduationCap
                className="h-5 w-5 text-sigd-blue"
                aria-hidden="true"
              />
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-sigd-blue-dark">
                SIGD IESTP &quot;Suiza&quot;
              </span>
            </span>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-sigd-text">
              Iniciar sesión
            </h1>
            <span
              className="mt-3 flex h-1 w-24 overflow-hidden rounded-full"
              aria-hidden="true"
            >
              <span className="flex-1 bg-[#006ec7]" />
              <span className="flex-1 bg-[#e6007e]" />
              <span className="flex-1 bg-[#f9e000]" />
            </span>
            <p className="mt-3 text-sm text-sigd-muted">
              Acceso por roles institucionales canónicos para control de acceso
              (RBAC).
            </p>
          </div>

          <div className="mt-6">
            <label htmlFor="rol" className="mb-2 block text-sm font-semibold">
              Rol institucional canónico
            </label>
            <select
              id="rol"
              value={rol}
              onChange={(event) => setRol(event.target.value)}
              className="input-sigd"
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
            className="btn-primary mt-6 w-full"
          >
            <LogIn className="h-4 w-4" aria-hidden="true" />
            Ingresar al sistema
          </button>

          <p className="mt-4 text-center text-xs text-sigd-muted">
            Acceso demostrativo — la sesión se establece por rol seleccionado.
          </p>
        </div>
      </section>
    </main>
  );
}
