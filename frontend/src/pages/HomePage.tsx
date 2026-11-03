import {
  ArrowUpRight,
  BarChart3,
  BellRing,
  Boxes,
  FileCheck2,
  FileInput,
  Fingerprint,
  LogIn,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuthStore } from "../stores/authStore";

const secciones = [
  {
    titulo: "Flujo y Validez Legal",
    subtitulo: "MOD-04 / Firma Digital",
    descripcion: "Firma digital, re-firma, workflow académico y verificación pública de documentos.",
    ruta: "/flujo-validez-legal",
    icono: FileCheck2,
    destacado: true,
    permisos: ["EXPEDIENTE_LEER", "FIRMA_FIRMAR"],
  },
  {
    titulo: "Casilla Electrónica",
    subtitulo: "ENT-M01-03",
    descripcion: "Consulta y recepción de notificaciones institucionales con plena validez legal.",
    ruta: "/casilla",
    icono: BellRing,
    destacado: true,
  },
  {
    titulo: "Mesa de Partes Virtual",
    subtitulo: "ENT-M02 / TUPA",
    descripcion: "Presentación y radicación de trámites digitales, requisitos TUPA y anexos.",
    ruta: "/tramite",
    icono: FileInput,
    destacado: true,
  },
  {
    titulo: "Registro Ciudadano",
    subtitulo: "ENT-M01-01 / ENT-M01-02",
    descripcion: "Registro de personas naturales y jurídicas con validaciones institucionales.",
    ruta: "/registro",
    icono: Fingerprint,
    destacado: false,
  },
  {
    titulo: "Bandeja de Expedientes",
    subtitulo: "ENT-M05",
    descripcion: "Gestión de estados, trazabilidad, providencias y foliado de expedientes.",
    ruta: "/expedientes",
    icono: Boxes,
    destacado: false,
    permisos: ["EXPEDIENTE_LEER"],
  },
  {
    titulo: "Validador CVD",
    subtitulo: "MOD-04 / Verificación",
    descripcion: "Validación pública de autenticidad e integridad de documentos firmados.",
    ruta: "/validador-cvd",
    icono: ShieldCheck,
    destacado: false,
  },
  {
    titulo: "Panel de Administración",
    subtitulo: "ENT-M05-01 / RBAC",
    descripcion: "Usuarios, roles, permisos, auditoría, catálogos y calendario laboral.",
    ruta: "/administracion",
    icono: Boxes,
    destacado: false,
    permisos: ["ADMIN_USUARIOS"],
  },
  {
    titulo: "Reportes y Tableros",
    subtitulo: "Control de gestión",
    descripcion: "Indicadores ejecutivos, tendencias, distribución y cuellos de botella.",
    ruta: "/reportes/dashboard",
    icono: BarChart3,
    destacado: false,
    permisos: ["REPORTE_LEER"],
  },
] as const;

export default function HomePage() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const permisosUsuario = useAuthStore((state) => state.usuario?.permisos) ?? [];

  return (
    <main className="sigd-home-page">
      <section className="sigd-home-hero" aria-labelledby="home-title">
        <div className="sigd-home-eyebrow">
          <span /> IESTP “Suiza” · Pucallpa
        </div>
        <h1 id="home-title">Gestión documental<br /><em>conectada y segura.</em></h1>
        <p>
          Una plataforma institucional para administrar el ciclo completo de cada documento,
          desde su registro hasta su archivo y verificación legal.
        </p>
        {!isAuthenticated && (
          <Link to="/login" className="sigd-access-link mt-6 w-fit">
            <LogIn aria-hidden="true" size={17} />
            <span>Iniciar sesión</span>
          </Link>
        )}
        <div className="sigd-home-metrics" aria-label="Capacidades principales">
          <span><strong>360°</strong> Trazabilidad</span>
          <span><strong>24/7</strong> Servicios digitales</span>
          <span><strong>CVD</strong> Validez documental</span>
        </div>
      </section>

      <section className="sigd-module-section" aria-labelledby="modules-title">
        <div className="sigd-section-heading">
          <div>
            <span className="sigd-section-kicker">Ecosistema SIGD</span>
            <h2 id="modules-title">Módulos institucionales</h2>
          </div>
          <p>Selecciona un módulo para comenzar.</p>
        </div>

        <div className="sigd-module-grid">
          {secciones
            .filter((seccion) => !("permisos" in seccion) || seccion.permisos.some((permiso) => permisosUsuario.includes(permiso)))
            .map(({ titulo, subtitulo, descripcion, ruta, icono: Icono, destacado }) => (
              <Link
                key={ruta}
                to={ruta}
                className={`sigd-module-card${destacado ? " is-featured" : ""}`}
              >
                <span className="sigd-module-icon"><Icono aria-hidden="true" size={23} /></span>
                <span className="sigd-module-code">{subtitulo}</span>
                <h3>{titulo}</h3>
                <p>{descripcion}</p>
                <span className="sigd-module-action">Abrir módulo <ArrowUpRight aria-hidden="true" size={16} /></span>
              </Link>
            ))}
        </div>
      </section>
    </main>
  );
}
