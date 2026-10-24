import { Link } from "react-router-dom";

const secciones = [
  {
    titulo: "Consulta Pública por CUT",
    subtitulo: "Seguimiento 24x7",
    descripcion:
      "Consulta el estado procesal y trazabilidad de tu trámite en tiempo real sin requerir inicio de sesión.",
    ruta: "/consulta",
    destacado: true,
  },
  {
    titulo: "Mesa de Partes Virtual",
    subtitulo: "ENT-M02 / TUPA",
    descripcion:
      "Presentación y radicación de trámites digitales, requisitos TUPA y anexos documentales.",
    ruta: "/tramite",
    destacado: true,
  },
  {
    titulo: "Mis Expedientes",
    subtitulo: "Portal Ciudadano",
    descripcion:
      "Consulta centralizada y seguimiento exclusivo de los trámites y expedientes de tu autoría.",
    ruta: "/mis-expedientes",
    destacado: true,
  },
  {
    titulo: "Casilla Electrónica",
    subtitulo: "ENT-M01-03",
    descripcion:
      "Consulta y recepción de notificaciones electrónicas institucionales con plena validez legal.",
    ruta: "/casilla",
    destacado: false,
  },
  {
    titulo: "Flujo y Validez Legal",
    subtitulo: "MOD-04 / Firma Digital",
    descripcion:
      "Demostración técnica del flujo de firma digital e integridad criptográfica.",
    ruta: "/flujo-validez-legal",
    destacado: false,
  },
  {
    titulo: "Validador CVD",
    subtitulo: "MOD-04 / Verificación",
    descripcion:
      "Valida la autenticidad e integridad de documentos firmados digitalmente mediante el Código de Verificación.",
    ruta: "/validador-cvd",
    destacado: false,
  },
  {
    titulo: "Registro Ciudadano",
    subtitulo: "ENT-M01-01 / ENT-M01-02",
    descripcion:
      "Registro de personas naturales y jurídicas con validación RENIEC / SUNAT y Ubigeo Ucayali.",
    ruta: "/registro",
    destacado: false,
  },
  {
    titulo: "Bandeja de Expedientes",
    subtitulo: "ENT-M05 / Institucional",
    descripcion:
      "Gestiona y consulta el estado, trazabilidad, providencias y foliado de expedientes institucionales.",
    ruta: "/expedientes",
    destacado: false,
  },
  {
    titulo: "Ventanilla Presencial",
    subtitulo: "Mesa de Partes Física",
    descripcion:
      "Recepción física de documentos en ventanilla y emisión de ticket térmico correlativo.",
    ruta: "/tramite/ventanilla-presencial",
    destacado: false,
  },
  {
    titulo: "Panel de Administración",
    subtitulo: "ENT-M05-01 / RBAC",
    descripcion:
      "Gestión de usuarios, roles, permisos, auditoría, tablas maestras y calendario laboral.",
    ruta: "/administracion",
    destacado: false,
  },
  {
    titulo: "Iniciar Sesión",
    subtitulo: "Acceso Institucional y Ciudadano",
    descripcion:
      "Ingreso al sistema SIGD con credenciales y verificación de perfil asignado.",
    ruta: "/login",
    destacado: false,
  },
  {
    titulo: "Reportes y Tableros de Control",
    subtitulo: "06_reportes-tablero-control",
    descripcion:
      "Consulta indicadores ejecutivos, tendencias, distribución de expedientes y cuellos de botella.",
    ruta: "/reportes/dashboard",
    destacado: false,
  },
];

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 py-12 text-slate-900">
      <div className="text-center space-y-2 max-w-2xl">
        <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">
          IESTP &quot;Suiza&quot; — Pucallpa
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          SIGD
        </h1>
        <p className="text-lg font-medium text-slate-700">
          Sistema Integral de Gestión Documentaria
        </p>
        <p className="text-sm text-slate-500">
          Plataforma Institucional y Notificación Electrónica con Validez Legal
        </p>
      </div>

      <div className="mt-10 grid w-full max-w-4xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {secciones.map((seccion) => (
          <Link
            key={seccion.ruta}
            to={seccion.ruta}
            className={`group rounded-xl border p-6 shadow-sm transition duration-200 ease-out hover:shadow-md motion-safe:hover:-translate-y-1 motion-reduce:transition-none ${
              seccion.destacado
                ? "border-blue-300 bg-blue-50/50 hover:border-blue-400"
                : "border-slate-200 bg-white hover:border-slate-300"
            }`}
          >
            {seccion.subtitulo && (
              <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">
                {seccion.subtitulo}
              </span>
            )}
            <h2 className="mt-1 text-lg font-bold text-slate-900 group-hover:text-blue-700">
              {seccion.titulo}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {seccion.descripcion}
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}
