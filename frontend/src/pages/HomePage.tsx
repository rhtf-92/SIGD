import { Link } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Check,
  FolderOpen,
  LogIn,
  Mail,
  Search,
  Send,
  Settings,
  ShieldCheck,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

interface Modulo {
  titulo: string;
  codigo: string;
  descripcion: string;
  ruta: string;
  icono: LucideIcon;
}

interface Categoria {
  grupo: string;
  descripcion: string;
  cat: string;
  modulos: Modulo[];
}

const CATEGORIAS: Categoria[] = [
  {
    grupo: "Gestión documentaria",
    descripcion: "Radicación, seguimiento y control de expedientes.",
    cat: "cat-doc",
    modulos: [
      {
        titulo: "Mesa de Partes Virtual",
        codigo: "ENT-M02 / TUPA",
        descripcion:
          "Presentación y radicación de trámites digitales, requisitos TUPA y anexos documentales.",
        ruta: "/tramite",
        icono: Send,
      },
      {
        titulo: "Bandeja de Expedientes",
        codigo: "ENT-M05",
        descripcion:
          "Estado, trazabilidad, providencias y foliado de expedientes.",
        ruta: "/expedientes",
        icono: FolderOpen,
      },
      {
        titulo: "Registro Ciudadano",
        codigo: "ENT-M01-01 / ENT-M01-02",
        descripcion:
          "Registro de personas naturales y jurídicas con validación RENIEC / SUNAT y Ubigeo Ucayali.",
        ruta: "/registro",
        icono: UserPlus,
      },
    ],
  },
  {
    grupo: "Validez legal y notificaciones",
    descripcion:
      "Firma digital, verificación de documentos y comunicación oficial.",
    cat: "cat-legal",
    modulos: [
      {
        titulo: "Flujo y Validez Legal",
        codigo: "MOD-04 / Firma Digital",
        descripcion:
          "Firma digital, re-firma, workflow académico y verificación pública de documentos (CVD).",
        ruta: "/flujo-validez-legal",
        icono: ShieldCheck,
      },
      {
        titulo: "Casilla Electrónica",
        codigo: "ENT-M01-03",
        descripcion:
          "Notificaciones electrónicas institucionales con plena validez legal.",
        ruta: "/casilla",
        icono: Mail,
      },
      {
        titulo: "Validador CVD",
        codigo: "MOD-04 / Verificación",
        descripcion:
          "Valida la autenticidad e integridad de documentos firmados digitalmente mediante el Código de Verificación.",
        ruta: "/validador-cvd",
        icono: BadgeCheck,
      },
    ],
  },
  {
    grupo: "Control y administración",
    descripcion: "Indicadores, seguridad y configuración institucional.",
    cat: "cat-admin",
    modulos: [
      {
        titulo: "Reportes y Tableros de Control",
        codigo: "06_reportes-tablero",
        descripcion:
          "Indicadores ejecutivos, tendencias, distribución de expedientes y áreas con cuellos de botella.",
        ruta: "/reportes/dashboard",
        icono: BarChart3,
      },
      {
        titulo: "Panel de Administración",
        codigo: "ENT-M05-01 / RBAC",
        descripcion:
          "Usuarios, roles, permisos, auditoría, tablas maestras y calendario laboral.",
        ruta: "/administracion",
        icono: Settings,
      },
      {
        titulo: "Iniciar Sesión",
        codigo: "Acceso Institucional",
        descripcion:
          "Ingreso al sistema SIGD con credenciales y verificación de perfil asignado.",
        ruta: "/login",
        icono: LogIn,
      },
    ],
  },
];

const PILARES = [
  "Trazabilidad de expedientes",
  "Firma digital con validez legal",
  "Notificación electrónica",
  "Control de acceso por roles (RBAC)",
];

const PASOS = [
  {
    titulo: "Presenta tu trámite",
    descripcion:
      "Radica solicitudes y anexos en línea mediante la Mesa de Partes Virtual.",
    ruta: "/tramite",
    icono: Send,
  },
  {
    titulo: "Da seguimiento",
    descripcion:
      "Consulta el estado y la trazabilidad de tu expediente con tu código CUT.",
    ruta: "/consulta",
    icono: Search,
  },
  {
    titulo: "Recibe tus notificaciones",
    descripcion:
      "Accede a la Casilla Electrónica para comunicaciones con validez legal.",
    ruta: "/casilla",
    icono: Mail,
  },
];

export default function HomePage() {
  return (
    <main>
      {/* ── Bienvenida ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[linear-gradient(135deg,#071c34_0%,#0a2540_45%,#0059a8_100%)] text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.12] [background-image:linear-gradient(#ffffff_1px,transparent_1px),linear-gradient(90deg,#ffffff_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[#006ec7]/40 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 top-6 h-72 w-72 rounded-full bg-[#e6007e]/25 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-[#f9e000]/20 blur-3xl"
        />

        <div className="relative mx-auto max-w-7xl px-6 py-16 text-center sm:py-24 lg:px-8">
          <span className="rise-in inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-white/90 backdrop-blur-sm">
            <ShieldCheck className="h-4 w-4 text-[#f9e000]" aria-hidden="true" />
            IESTP &quot;Suiza&quot; — Pucallpa
          </span>

          <h1
            className="rise-in mt-6 bg-gradient-to-r from-white via-white to-[#f9e000] bg-clip-text text-5xl font-black tracking-tight text-transparent sm:text-7xl"
            style={{ animationDelay: "0.05s" }}
          >
            SIGD
          </h1>
          <p
            className="rise-in mt-3 text-lg font-bold text-white sm:text-2xl"
            style={{ animationDelay: "0.1s" }}
          >
            Sistema Integral de Gestión Documentaria
          </p>
          <p
            className="rise-in mx-auto mt-4 max-w-2xl text-sm leading-6 text-white/80 sm:text-base"
            style={{ animationDelay: "0.15s" }}
          >
            Plataforma institucional y notificación electrónica con validez
            legal para la gestión de documentos, expedientes y trámites del
            IESTP Suiza de Pucallpa.
          </p>

          <div
            className="rise-in mt-9 flex flex-wrap items-center justify-center gap-3"
            style={{ animationDelay: "0.2s" }}
          >
            <Link
              to="/login"
              className="btn-accent px-6 py-3 text-base shadow-lg shadow-black/25"
            >
              <LogIn className="h-5 w-5" aria-hidden="true" />
              Ingresar al sistema
            </Link>
            <Link
              to="/tramite"
              className="inline-flex items-center justify-center gap-2 rounded-control border border-white/30 bg-white/10 px-6 py-3 text-base font-semibold text-white backdrop-blur-sm transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              <Send className="h-5 w-5" aria-hidden="true" />
              Mesa de Partes Virtual
            </Link>
          </div>

          <ul className="mx-auto mt-12 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-4">
            {PILARES.map((pilar, indice) => (
              <li
                key={pilar}
                className="rise-in flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-4 text-center backdrop-blur-sm"
                style={{ animationDelay: `${0.25 + indice * 0.05}s` }}
              >
                <Check className="h-5 w-5 text-[#f9e000]" aria-hidden="true" />
                <span className="text-xs font-semibold leading-snug text-white/90">
                  {pilar}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex h-1.5 w-full" aria-hidden="true">
          <span className="flex-1 bg-[#006ec7]" />
          <span className="flex-1 bg-[#e6007e]" />
          <span className="flex-1 bg-[#f9e000]" />
        </div>
      </section>

      {/* ── Catálogo de módulos ────────────────────────────────────────── */}
      <div className="mx-auto max-w-7xl px-6 py-14 sm:py-16 lg:px-8">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-extrabold tracking-tight text-sigd-text sm:text-3xl">
            Módulos del sistema
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-sigd-muted">
            Accede a cada servicio institucional agrupado por área de gestión.
          </p>
        </div>

        {CATEGORIAS.map((categoria, indice) => (
          <section
            key={categoria.grupo}
            className={`${categoria.cat} ${indice > 0 ? "mt-12" : ""}`}
          >
            <div className="mb-5 flex items-center gap-3">
              <span
                className="h-10 w-1.5 shrink-0 rounded-full"
                style={{ background: "var(--accent)" }}
                aria-hidden="true"
              />
              <div>
                <h3 className="text-lg font-bold text-sigd-text">
                  {categoria.grupo}
                </h3>
                <p className="mt-0.5 text-sm text-sigd-muted">
                  {categoria.descripcion}
                </p>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {categoria.modulos.map((modulo) => {
                const Icono = modulo.icono;
                return (
                  <Link
                    key={modulo.ruta}
                    to={modulo.ruta}
                    className="module-card group"
                  >
                    <span className="module-icon">
                      <Icono className="h-6 w-6" aria-hidden="true" />
                    </span>

                    <span className="module-code mt-4">{modulo.codigo}</span>
                    <h4 className="mt-1.5 text-base font-bold text-sigd-text">
                      {modulo.titulo}
                    </h4>
                    <p className="mt-2 flex-1 text-sm leading-6 text-sigd-muted">
                      {modulo.descripcion}
                    </p>

                    <span className="module-cta mt-5">
                      Ingresar
                      <ArrowRight
                        className="h-4 w-4 transition group-hover:translate-x-0.5 motion-reduce:transition-none"
                        aria-hidden="true"
                      />
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* ── ¿Cómo funciona? ────────────────────────────────────────────── */}
      <section className="border-y border-sigd-line bg-white">
        <div className="mx-auto max-w-7xl px-6 py-14 sm:py-16 lg:px-8">
          <div className="mb-10 text-center">
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-sigd-blue">
              Cómo funciona
            </span>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-sigd-text sm:text-3xl">
              Tu trámite en tres pasos
            </h2>
          </div>

          <ol className="relative grid gap-8 sm:grid-cols-3">
            <span
              aria-hidden="true"
              className="absolute left-0 right-0 top-7 hidden h-0.5 bg-gradient-to-r from-sigd-blue/20 via-sigd-blue/40 to-sigd-blue/20 sm:block"
            />
            {PASOS.map((paso, indice) => {
              const Icono = paso.icono;
              return (
                <li key={paso.titulo} className="relative flex flex-col items-center text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#006ec7] to-[#003a6b] text-white shadow-lg shadow-sigd-blue/30">
                    <Icono className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <span className="mt-3 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#f9e000] text-xs font-black text-sigd-navy">
                    {indice + 1}
                  </span>
                  <h3 className="mt-3 text-base font-bold text-sigd-text">
                    {paso.titulo}
                  </h3>
                  <p className="mt-2 max-w-xs text-sm leading-6 text-sigd-muted">
                    {paso.descripcion}
                  </p>
                  <Link
                    to={paso.ruta}
                    className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-sigd-blue transition hover:text-sigd-blue-dark"
                  >
                    Ir ahora
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* ── Llamada a la acción ────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[linear-gradient(120deg,#0a2540_0%,#0059a8_100%)] text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-[#f9e000]/15 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-[#e6007e]/20 blur-3xl"
        />
        <div className="relative mx-auto flex max-w-7xl flex-col items-center gap-6 px-6 py-14 text-center lg:px-8">
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            Comienza tu gestión documentaria en línea
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-white/80 sm:text-base">
            Ingresa con tu perfil institucional o consulta el estado de tu
            expediente en cualquier momento.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link to="/login" className="btn-accent px-6 py-3 text-base">
              <LogIn className="h-5 w-5" aria-hidden="true" />
              Ingresar al sistema
            </Link>
            <Link
              to="/consulta"
              className="inline-flex items-center justify-center gap-2 rounded-control border border-white/30 bg-white/10 px-6 py-3 text-base font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
            >
              <Search className="h-5 w-5" aria-hidden="true" />
              Consultar expediente
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
