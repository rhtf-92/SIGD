import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  BarChart3,
  Bell,
  FileCheck2,
  FileSignature,
  FolderOpen,
  LogIn,
  Settings2,
  UserRoundPlus,
} from "lucide-react";

const secciones = [
  {
    titulo: "Flujo y Validez Legal",
    descripcion:
      "Tramitación con plena validez legal: firma digital, re-firma, workflow académico y verificación pública de documentos (CVD).",
    ruta: "/flujo-validez-legal",
    icono: FileSignature,
    color: "bg-indigo-200 text-indigo-800 ring-indigo-300",
    superficie: "border-indigo-200 bg-gradient-to-br from-indigo-100 via-indigo-50 to-indigo-200/80 hover:border-indigo-300",
    acento: "from-indigo-600 to-violet-400",
  },
  {
    titulo: "Casilla Electrónica",
    descripcion:
      "Consulta y recepción de notificaciones electrónicas institucionales con plena validez legal.",
    ruta: "/casilla",
    icono: Bell,
    color: "bg-sky-200 text-sky-800 ring-sky-300",
    superficie: "border-sky-200 bg-gradient-to-br from-sky-100 via-sky-50 to-sky-200/80 hover:border-sky-300",
    acento: "from-sky-600 to-cyan-400",
  },
  {
    titulo: "Mesa de Partes Virtual",
    descripcion:
      "Presentación y radicación de trámites digitales, requisitos TUPA y anexos documentales.",
    ruta: "/tramite",
    icono: FileCheck2,
    color: "bg-emerald-200 text-emerald-800 ring-emerald-300",
    superficie: "border-emerald-200 bg-gradient-to-br from-emerald-100 via-emerald-50 to-emerald-200/80 hover:border-emerald-300",
    acento: "from-emerald-600 to-teal-400",
  },
  {
    titulo: "Registro Ciudadano",
    descripcion:
      "Registro de personas naturales y jurídicas con validación RENIEC / SUNAT y Ubigeo Ucayali.",
    ruta: "/registro",
    icono: UserRoundPlus,
    color: "bg-amber-200 text-amber-800 ring-amber-300",
    superficie: "border-amber-200 bg-gradient-to-br from-amber-100 via-amber-50 to-amber-200/80 hover:border-amber-300",
    acento: "from-amber-600 to-orange-400",
  },
  {
    titulo: "Bandeja de Expedientes",
    descripcion:
      "Gestiona y consulta el estado, trazabilidad, providencias y foliado de expedientes.",
    ruta: "/expedientes",
    icono: FolderOpen,
    color: "bg-cyan-200 text-cyan-800 ring-cyan-300",
    superficie: "border-cyan-200 bg-gradient-to-br from-cyan-100 via-cyan-50 to-cyan-200/80 hover:border-cyan-300",
    acento: "from-cyan-600 to-sky-400",
  },
  {
    titulo: "Validador CVD",
    descripcion:
      "Valida la autenticidad e integridad de documentos firmados digitalmente mediante el Código de Verificación de Documentos.",
    ruta: "/validador-cvd",
    icono: FileCheck2,
    color: "bg-violet-200 text-violet-800 ring-violet-300",
    superficie: "border-violet-200 bg-gradient-to-br from-violet-100 via-violet-50 to-violet-200/80 hover:border-violet-300",
    acento: "from-violet-600 to-purple-400",
  },
  {
    titulo: "Panel de Administración",
    descripcion:
      "Gestión de usuarios, roles, permisos, auditoría, tablas maestras y calendario laboral.",
    ruta: "/administracion",
    icono: Settings2,
    color: "bg-rose-200 text-rose-800 ring-rose-300",
    superficie: "border-rose-200 bg-gradient-to-br from-rose-100 via-rose-50 to-rose-200/80 hover:border-rose-300",
    acento: "from-rose-600 to-pink-400",
  },
  {
    titulo: "Iniciar Sesión",
    descripcion:
      "Ingreso al sistema SIGD con credenciales y verificación de perfil asignado.",
    ruta: "/login",
    icono: LogIn,
    color: "bg-slate-200 text-slate-800 ring-slate-300",
    superficie: "border-slate-300 bg-gradient-to-br from-slate-200 via-slate-100 to-slate-300/80 hover:border-slate-400",
    acento: "from-slate-600 to-slate-400",
  },
  {
    titulo: "Reportes y Tableros de Control",
    descripcion:
      "Consulta indicadores ejecutivos, tendencias, distribución de expedientes y áreas con cuellos de botella.",
    ruta: "/reportes/dashboard",
    icono: BarChart3,
    color: "bg-blue-200 text-blue-800 ring-blue-300",
    superficie: "border-blue-200 bg-gradient-to-br from-blue-100 via-blue-50 to-blue-200/80 hover:border-blue-300",
    acento: "from-blue-600 to-cyan-400",
  },
];

export default function HomePage() {
  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-slate-50 px-4 py-10 text-slate-900 sm:px-6 sm:py-14">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -right-32 -top-36 h-96 w-96 rounded-full bg-blue-200/40 blur-3xl" />
        <div className="absolute -left-40 top-[34rem] h-96 w-96 rounded-full bg-cyan-100/60 blur-3xl" />
      </div>

      <div className="mx-auto w-full max-w-6xl">
        <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-blue-950 to-blue-800 px-6 py-10 text-white shadow-2xl shadow-blue-950/20 sm:px-10 sm:py-14 lg:px-14">
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-28 h-80 w-80 rounded-full border border-white/10 sm:h-[28rem] sm:w-[28rem]" />
          <div aria-hidden="true" className="pointer-events-none absolute -right-4 -top-16 h-64 w-64 rounded-full border border-white/10 sm:h-80 sm:w-80" />
          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-200/20 bg-white/10 px-3 py-1.5 text-xs font-semibold tracking-wide text-blue-100 backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
              IESTP &quot;Suiza&quot; <span className="text-blue-200/60">•</span> Pucallpa
            </div>
            <div className="mt-6 flex items-start gap-4 sm:gap-5">
              <div className="hidden rounded-2xl border border-white/15 bg-white/10 p-3.5 shadow-lg backdrop-blur sm:block">
                <FileSignature aria-hidden="true" className="h-9 w-9 text-cyan-200" />
              </div>
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.22em] text-cyan-200">
                  Plataforma institucional
                </p>
                <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
                  SIGD
                </h1>
                <p className="mt-3 text-lg font-semibold text-white sm:text-xl">
                  Sistema Integral de Gestión Documentaria
                </p>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100/80 sm:text-base">
                  Gestiona trámites, documentos y notificaciones institucionales
                  desde un solo lugar, con trazabilidad y validez legal.
                </p>
              </div>
            </div>
          </div>
          <div aria-hidden="true" className="pointer-events-none absolute bottom-0 right-0 h-48 w-1/2 bg-gradient-to-tl from-cyan-400/15 to-transparent blur-2xl" />
        </section>

        <div className="mb-5 mt-10 flex flex-wrap items-end justify-between gap-3 sm:mt-12">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
              Servicios digitales
            </p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              ¿A dónde deseas ir?
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-6 text-slate-500">
            Selecciona un módulo para iniciar o continuar tu gestión.
          </p>
        </div>

        <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {secciones.map((seccion) => (
          <Link
            key={seccion.ruta}
            to={seccion.ruta}
            className={`group relative flex min-h-48 flex-col overflow-hidden rounded-2xl border p-5 shadow-sm shadow-slate-900/[0.03] transition duration-300 ease-out hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-950/[0.08] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/25 motion-reduce:transition-none sm:p-6 ${seccion.superficie}`}
          >
            <div className="flex items-start justify-between gap-4">
              <span className={`inline-flex rounded-xl p-3 ring-1 ring-inset ${seccion.color}`}>
                <seccion.icono aria-hidden="true" className="h-5 w-5" />
              </span>
              <span className="rounded-full border border-slate-200 p-2 text-slate-400 transition duration-200 group-hover:border-blue-200 group-hover:bg-blue-50 group-hover:text-blue-700">
                <ArrowUpRight aria-hidden="true" className="h-4 w-4" />
              </span>
            </div>
            <h3 className="mt-5 text-lg font-bold tracking-tight text-slate-900 transition-colors group-hover:text-blue-800">
              {seccion.titulo}
            </h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {seccion.descripcion}
            </p>
            <span aria-hidden="true" className={`absolute inset-x-0 bottom-0 h-1 origin-left scale-x-0 bg-gradient-to-r transition-transform duration-300 group-hover:scale-x-100 ${seccion.acento}`} />
          </Link>
        ))}
        </div>
      </div>
    </main>
  );
}