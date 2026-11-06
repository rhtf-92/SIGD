import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

interface RolOpcion {
  id: string;
  label: string;
  usuario: string;
  destino: string;
  icono: string;
  description: string;
}

const ROLES: RolOpcion[] = [
  {
    id: "SUPER_ADMIN",
    label: "Administrador",
    usuario: "admin",
    destino: "/administracion",
    icono: "⚙️",
    description: "Gestión total del sistema",
  },
  {
    id: "DIRECTOR",
    label: "Director General",
    usuario: "director",
    destino: "/administracion",
    icono: "👔",
    description: "Resoluciones y firma",
  },
  {
    id: "DOCENTE",
    label: "Docente",
    usuario: "docente",
    destino: "/flujos/titulacion",
    icono: "📘",
    description: "Evaluación académica",
  },
  {
    id: "MESA_PARTES",
    label: "Mesa de Partes",
    usuario: "mesa_partes",
    destino: "/tramite/ventanilla-presencial",
    icono: "🗂️",
    description: "Radicación y seguimiento",
  },
  {
    id: "ESTUDIANTE",
    label: "Estudiante",
    usuario: "estudiante",
    destino: "/casilla",
    icono: "🎓",
    description: "Casilla y trámites",
  },
];

const DESTINOS_POR_ROL: Record<string, string> = {
  SUPER_ADMIN: "/administracion",
  DIRECTOR: "/administracion",
  DOCENTE: "/flujos/titulacion",
  MESA_PARTES: "/tramite/ventanilla-presencial",
  ESTUDIANTE: "/casilla",
};

export default function LoginPage() {
  const navigate = useNavigate();
  const loginStore = useAuthStore((s) => s.login);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [rolSeleccionado, setRolSeleccionado] = useState<string | null>(null);
  const [identificador, setIdentificador] = useState("");
  const [password, setPassword] = useState("");

  async function iniciarSesion(usuario: string, clave: string, destino?: string) {
    setError("");
    setCargando(true);
    try {
      await loginStore({ identificador: usuario.trim(), password: clave });
      const rol = useAuthStore.getState().usuario?.rol;
      navigate(destino ?? (rol ? DESTINOS_POR_ROL[rol] : "/administracion") ?? "/administracion", {
        replace: true,
      });
    } catch {
      setError("No se pudo iniciar sesión. Verifica tus credenciales e intenta nuevamente.");
    } finally {
      setCargando(false);
      setRolSeleccionado(null);
    }
  }

  async function seleccionarRol(rol: RolOpcion) {
    setRolSeleccionado(rol.id);
    await iniciarSesion(rol.usuario, "123", rol.destino);
  }

  async function enviarManual(e: FormEvent) {
    e.preventDefault();
    if (!identificador.trim() || !password) return;
    await iniciarSesion(identificador, password);
  }

  return (
    <main className="sigd-fade-in min-h-screen flex items-center justify-center p-4 bg-transparent">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8 sigd-fade-in" style={{ animationDelay: "40ms" }}>
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center border border-cyan-400/40 bg-[rgba(15,23,42,0.55)] shadow-[0_0_15px_rgba(6,182,212,0.15)] backdrop-blur-[12px]">
            <span className="text-4xl" aria-hidden="true">🏛️</span>
          </div>
          <h1 className="text-4xl font-semibold text-slate-100 tracking-tight">SIGD</h1>
          <p className="text-cyan-300 mt-1.5 text-lg">Sistema Integral de Gestión Documentaria</p>
          <p className="text-slate-400 text-sm mt-1">IESTP Público &quot;Suiza&quot; · Pucallpa · Ucayali</p>
        </div>

        <div
          className="sigd-fade-in rounded-2xl border border-cyan-400/40 bg-[rgba(15,23,42,0.62)] shadow-[0_0_15px_rgba(6,182,212,0.15)] backdrop-blur-[12px] p-6 md:p-8 transition-all duration-300 ease-out"
          style={{ animationDelay: "80ms" }}
        >
          <h2 className="text-xl font-semibold text-slate-100 text-center mb-1">Acceso al sistema</h2>
          <p className="text-slate-300 text-center text-sm mb-6">Selecciona tu rol o ingresa tus credenciales.</p>

          {error && (
            <div className="mb-5 p-3 rounded-xl border border-red-500/30 bg-red-950/30 text-red-200 text-sm text-center sigd-fade-in">{error}</div>
          )}

          <form onSubmit={enviarManual} className="mb-7 grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-3 items-end">
            <label className="block">
              <span className="block text-xs font-medium text-slate-300 mb-1">Usuario</span>
              <input
                value={identificador}
                onChange={(e) => setIdentificador(e.target.value)}
                autoComplete="username"
                className="w-full rounded-xl border border-cyan-400/40 bg-slate-950/35 px-3 py-2.5 text-slate-100 placeholder:text-slate-500 transition-all duration-300 ease-out hover:brightness-110 hover:border-cyan-300/60 focus:outline-none focus:border-cyan-300/70 focus:shadow-[0_0_12px_rgba(6,182,212,0.18)]"
                placeholder="admin, director, docente..."
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-slate-300 mb-1">Contraseña</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full rounded-xl border border-cyan-400/40 bg-slate-950/35 px-3 py-2.5 text-slate-100 placeholder:text-slate-500 transition-all duration-300 ease-out hover:brightness-110 hover:border-cyan-300/60 focus:outline-none focus:border-cyan-300/70 focus:shadow-[0_0_12px_rgba(6,182,212,0.18)]"
                placeholder="••••••••"
              />
            </label>
            <button
              type="submit"
              disabled={cargando || !identificador.trim() || !password}
              className="rounded-xl border border-cyan-400/40 bg-cyan-500/15 px-5 py-2.5 text-sm font-medium text-cyan-50 shadow-[0_0_15px_rgba(6,182,212,0.12)] transition-all duration-300 ease-out hover:-translate-y-[1px] hover:brightness-125 hover:border-cyan-300/60 hover:shadow-[0_0_20px_rgba(6,182,212,0.22)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
            >
              Ingresar
            </button>
          </form>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {ROLES.map((rol) => (
              <button
                key={rol.id}
                type="button"
                onClick={() => seleccionarRol(rol)}
                disabled={cargando}
                className="group text-left rounded-xl p-4 border border-cyan-400/40 bg-[rgba(15,23,42,0.55)] shadow-[0_0_15px_rgba(6,182,212,0.10)] backdrop-blur-[12px] transition-all duration-300 ease-out hover:-translate-y-[2px] hover:brightness-110 hover:border-cyan-300/60 hover:shadow-[0_0_20px_rgba(6,182,212,0.20)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl leading-none" aria-hidden="true">{rol.icono}</span>
                  <div className="min-w-0">
                    <h3 className="font-medium text-slate-100 text-sm leading-snug">{rol.label}</h3>
                    <p className="text-[11px] text-cyan-300/80 mt-0.5">@{rol.usuario}</p>
                    <p className="text-[11px] text-slate-400 mt-1 leading-snug">{rol.description}</p>
                  </div>
                </div>
                {rolSeleccionado === rol.id && (
                  <div className="mt-3 h-0.5 w-full overflow-hidden rounded-full bg-slate-800/80">
                    <div className="h-full w-1/2 rounded-full bg-cyan-400/80 sigd-fade-in" />
                  </div>
                )}
              </button>
            ))}
          </div>

          <div className="mt-7 flex items-center justify-center gap-5 text-sm">
            <button type="button" onClick={() => navigate("/")} className="text-slate-400 hover:text-cyan-300 transition-all duration-300 ease-out">Volver al inicio</button>
            <span className="text-slate-700">|</span>
            <button type="button" onClick={() => navigate("/registro")} className="text-slate-400 hover:text-cyan-300 transition-all duration-300 ease-out">Crear cuenta</button>
          </div>

          <p className="mt-6 text-center text-[11px] text-slate-500 border-t border-cyan-400/15 pt-4">Ley N.º 27444 · TUO · Ley N.º 27269 · SIGD v2.0</p>
        </div>
      </div>
    </main>
  );
}
