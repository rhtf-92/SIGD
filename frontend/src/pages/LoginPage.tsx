import {
  AlertTriangle,
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  IdCard,
  Inbox,
  KeyRound,
  Loader2,
  LogIn,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

import Logo3D from "../components/common/Logo3D";
import { useAuthStore } from "../stores/authStore";

interface RolOpcion {
  id: string;
  label: string;
  usuario: string;
  destino: string;
  icono: LucideIcon;
  description: string;
}

const ROLES: RolOpcion[] = [
  {
    id: "SUPER_ADMIN",
    label: "Administrador",
    usuario: "admin",
    destino: "/administracion",
    icono: Settings,
    description: "Gestión total del sistema",
  },
  {
    id: "DIRECTOR",
    label: "Director General",
    usuario: "director",
    destino: "/administracion",
    icono: BriefcaseBusiness,
    description: "Resoluciones y firma",
  },
  {
    id: "DOCENTE",
    label: "Docente",
    usuario: "docente",
    destino: "/flujos/titulacion",
    icono: GraduationCap,
    description: "Evaluación académica",
  },
  {
    id: "MESA_PARTES",
    label: "Mesa de Partes",
    usuario: "mesa_partes",
    destino: "/tramite/ventanilla-presencial",
    icono: Inbox,
    description: "Radicación y seguimiento",
  },
  {
    id: "ESTUDIANTE",
    label: "Estudiante",
    usuario: "estudiante",
    destino: "/casilla",
    icono: UserRound,
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

const CAPACIDADES = [
  "Identidad digital con lectura de DNIe",
  "Firma digital con validez legal",
  "Trazabilidad documental en tiempo real",
];

export default function LoginPage() {
  const navigate = useNavigate();
  const loginStore = useAuthStore((s) => s.login);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [rolSeleccionado, setRolSeleccionado] = useState<string | null>(null);
  const [identificador, setIdentificador] = useState("");
  const [password, setPassword] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);

  async function iniciarSesion(usuario: string, clave: string, destino?: string) {
    setError("");
    setCargando(true);
    try {
      await loginStore({ identificador: usuario.trim(), password: clave });
      const rol = useAuthStore.getState().usuario?.rol;
      const ruta = destino ?? (rol ? DESTINOS_POR_ROL[rol] : undefined) ?? "/";
      navigate(ruta, { replace: true });
    } catch (err) {
      const mensaje =
        err instanceof Error && err.message
          ? err.message
          : "No se pudo iniciar sesión. Verifica tus credenciales e intenta nuevamente.";
      setError(mensaje);
    } finally {
      setCargando(false);
      setRolSeleccionado(null);
    }
  }

  async function seleccionarRol(rol: RolOpcion) {
    setRolSeleccionado(rol.id);
    setIdentificador(rol.usuario);
    setPassword("123");
    await iniciarSesion(rol.usuario, "123", rol.destino);
  }

  async function enviarManual(event: FormEvent) {
    event.preventDefault();
    if (!identificador.trim() || !password) return;
    await iniciarSesion(identificador, password);
  }

  return (
    <main className="sigd-fade-in relative min-h-[calc(100vh-91px)] overflow-hidden px-4 py-10 sm:px-6 lg:py-16">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(56,189,248,0.18),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_85%_20%,rgba(0,110,199,0.1),transparent_50%)]" />
        <div className="cyber-grid absolute inset-0 opacity-35" />
      </div>

      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        {/* Columna de marca */}
        <section className="animate-fade-up text-center lg:text-left">
          <div className="flex justify-center lg:justify-start">
            <Logo3D size={240} className="drop-shadow-[0_18px_45px_rgba(0,110,199,0.25)]" />
          </div>

          <span className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#bfe0f7] bg-white px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.24em] text-[#00539b] shadow-sm">
            <Sparkles className="h-3.5 w-3.5" />
            Plataforma institucional
          </span>

          <h1 className="mt-5 text-4xl font-black tracking-[-0.045em] text-ink sm:text-5xl">
            SIGD
            <span className="mt-2 block bg-gradient-to-r from-[#00539b] via-[#006ec7] to-[#38bdf8] bg-clip-text text-2xl font-bold text-transparent sm:text-3xl">
              Gestión documentaria del futuro
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-lg text-sm leading-relaxed text-slate-600 sm:text-base lg:mx-0">
            Identidad digital, mesa de partes, expedientes y firma electrónica en un
            solo sistema trazable, seguro y disponible para toda la comunidad del
            IESTP Público “Suiza”.
          </p>

          <ul className="mx-auto mt-7 max-w-lg space-y-3 text-left lg:mx-0">
            {CAPACIDADES.map((capacidad) => (
              <li key={capacidad} className="flex items-start gap-3 text-sm text-slate-600">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-[#bfe0f7] bg-[#e8f4ff] text-[#006ec7]">
                  <CheckCircle2 className="h-3 w-3" />
                </span>
                {capacidad}
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 lg:justify-start">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-[#006ec7]" />
              Ley N.º 27269
            </span>
            <span className="h-3 w-px bg-[#d7e9f7]" />
            <span>Ley N.º 27444 · TUO</span>
            <span className="h-3 w-px bg-[#d7e9f7]" />
            <span>Pucallpa · Ucayali</span>
          </div>
        </section>

        {/* Columna de acceso */}
        <section
          className="animate-fade-up rounded-2xl border border-[#d7e9f7] bg-white p-6 shadow-[0_30px_80px_-40px_rgba(0,110,199,0.45)] sm:p-8"
          style={{ animationDelay: "120ms" }}
        >
          <div className="mb-6 text-center">
            <h2 className="text-xl font-bold tracking-tight text-ink">Acceso al sistema</h2>
            <p className="mt-1 text-sm text-slate-500">
              Ingresa tus credenciales institucionales o usa un acceso demo.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="animate-fade-in mb-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-left text-sm text-red-700"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={enviarManual} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Usuario institucional
              </span>
              <span className="relative block">
                <IdCard className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={identificador}
                  onChange={(event) => setIdentificador(event.target.value)}
                  autoComplete="username"
                  spellCheck={false}
                  className="w-full rounded-xl border border-[#c9deef] bg-white py-2.5 pl-10 pr-3 text-sm text-ink outline-none transition-all duration-200 placeholder:text-slate-400 hover:border-[#8cc8f0] focus:border-[#006ec7] focus:shadow-[0_0_0_3px_rgba(0,110,199,0.14)]"
                  placeholder="admin, director, docente…"
                />
              </span>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Contraseña
              </span>
              <span className="relative block">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type={mostrarPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-[#c9deef] bg-white py-2.5 pl-10 pr-11 text-sm text-ink outline-none transition-all duration-200 placeholder:text-slate-400 hover:border-[#8cc8f0] focus:border-[#006ec7] focus:shadow-[0_0_0_3px_rgba(0,110,199,0.14)]"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setMostrarPassword((valor) => !valor)}
                  aria-label={mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-slate-400 transition hover:bg-[#e8f4ff] hover:text-[#006ec7]"
                >
                  {mostrarPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </span>
            </label>

            <button
              type="submit"
              disabled={cargando || !identificador.trim() || !password}
              className="btn-primary group w-full px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {cargando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verificando credenciales…
                </>
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  Ingresar al sistema
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-[#bfe0f7] to-transparent" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
              Acceso demo
            </span>
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-[#bfe0f7] to-transparent" />
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {ROLES.map((rol) => {
              const Icono = rol.icono;
              const activo = rolSeleccionado === rol.id;
              return (
                <button
                  key={rol.id}
                  type="button"
                  onClick={() => seleccionarRol(rol)}
                  disabled={cargando}
                  title={`${rol.label} · @${rol.usuario}`}
                  className={`group flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
                    activo
                      ? "border-[#006ec7] bg-[#e8f4ff] shadow-[0_12px_28px_-18px_rgba(0,110,199,0.65)]"
                      : "border-[#d7e9f7] bg-white hover:-translate-y-0.5 hover:border-[#8cc8f0] hover:bg-[#f4f8fb]"
                  }`}
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#bfe0f7] bg-[#e8f4ff] text-[#006ec7]">
                    {activo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icono className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] font-semibold text-ink">
                      {rol.label}
                    </span>
                    <span className="block truncate text-[10px] text-slate-500">
                      @{rol.usuario}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <p className="mt-4 rounded-lg border border-[#bfe0f7] bg-[#e8f4ff] px-3 py-2 text-center text-[11px] text-slate-600">
            Contraseña demo para todas las cuentas:{" "}
            <span className="font-mono font-bold text-[#00539b]">123</span>
          </p>

          <div className="mt-6 flex items-center justify-center gap-4 text-sm">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="text-slate-500 transition hover:text-[#006ec7]"
            >
              Volver al inicio
            </button>
            <span className="text-slate-300">|</span>
            <button
              type="button"
              onClick={() => navigate("/registro")}
              className="text-slate-500 transition hover:text-[#006ec7]"
            >
              Crear cuenta
            </button>
          </div>

          <p className="mt-5 border-t border-[#eaf3fb] pt-4 text-center text-[10px] uppercase tracking-[0.18em] text-slate-400">
            SIGD v2.0 · Conexión cifrada · IESTP “Suiza”
          </p>
        </section>
      </div>
    </main>
  );
}
