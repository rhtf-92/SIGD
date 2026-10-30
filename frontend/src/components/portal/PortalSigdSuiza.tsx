import { Link, useLocation } from "react-router-dom";
import {
  BadgeCheck,
  Building,
  ChartColumn,
  Expand,
  FolderOpen,
  LogIn,
  Mail,
  MapPin,
  MonitorUp,
  Settings,
  Signature,
  UserPlus,
  Users,
} from "lucide-react";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import vistaPreviaPortal from "../../assets/vista-previa-portal.png";
import AutenticacionMesaPartesModal from "./AutenticacionMesaPartesModal";

interface Servicio {
  titulo: string;
  descripcion: string;
  ruta: string;
  icono: LucideIcon;
  fondo: string;
  requiereAuth?: boolean;
}

const servicios: Servicio[] = [
  {
    titulo: "Firma Digital",
    descripcion:
      "Firma, re-firma y verificación de documentos con plena validez legal.",
    ruta: "/flujo-validez-legal/firma",
    icono: Signature,
    fondo: "bg-blue-600",
  },
  {
    titulo: "Casilla Electrónica",
    descripcion:
      "Recepción y consulta de notificaciones electrónicas institucionales.",
    ruta: "/casilla",
    icono: Mail,
    fondo: "bg-amber-600",
  },
  {
    titulo: "Mesa de Partes Virtual",
    descripcion:
      "Presentación y radicación de trámites digitales con requisitos TUPA.",
    ruta: "/tramite/mesa-partes-virtual",
    icono: Building,
    fondo: "bg-blue-700",
    requiereAuth: true,
  },
  {
    titulo: "Registro Ciudadano",
    descripcion:
      "Alta de personas naturales y jurídicas con validación de identidad.",
    ruta: "/registro",
    icono: UserPlus,
    fondo: "bg-purple-600",
  },
  {
    titulo: "Bandeja de Expedientes",
    descripcion:
      "Estado, trazabilidad, providencias y foliado de tus expedientes.",
    ruta: "/expedientes",
    icono: FolderOpen,
    fondo: "bg-amber-800",
  },
  {
    titulo: "Validador CVD",
    descripcion:
      "Verifica la autenticidad e integridad de documentos firmados.",
    ruta: "/validador-cvd",
    icono: BadgeCheck,
    fondo: "bg-teal-600",
  },
  {
    titulo: "Panel de Administración",
    descripcion:
      "Usuarios, roles, permisos, auditoría y tablas maestras del sistema.",
    ruta: "/administracion",
    icono: Settings,
    fondo: "bg-violet-800",
  },
  {
    titulo: "Iniciar Sesión",
    descripcion:
      "Acceso al SIGD con credenciales institucionales y perfil asignado.",
    ruta: "/login",
    icono: LogIn,
    fondo: "bg-[#DC143C]",
  },
  {
    titulo: "Reportes y Tableros de Control",
    descripcion:
      "Indicadores ejecutivos, tendencias y áreas con cuellos de botella.",
    ruta: "/reportes/dashboard",
    icono: ChartColumn,
    fondo: "bg-blue-900",
  },
];

const enlacesMovil = [
  { etiqueta: "Inicio", ruta: "/" },
  { etiqueta: "Casilla Electrónica", ruta: "/casilla" },
  { etiqueta: "Mesa de Partes", ruta: "/tramite/mesa-partes-virtual" },
  { etiqueta: "Expedientes", ruta: "/expedientes" },
  { etiqueta: "Administración", ruta: "/administracion" },
  { etiqueta: "Reportes", ruta: "/reportes/dashboard" },
];

export default function PortalSigdSuiza() {
  const { pathname } = useLocation();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [accesoMpAbierto, setAccesoMpAbierto] = useState(false);

  return (
    <div className="min-h-screen bg-slate-200 text-slate-900">
      <header className="border-b border-gray-300 bg-gray-100 print:hidden">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-700 text-xl font-black text-white shadow-md shadow-blue-900/30">
              S
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-black tracking-wide text-slate-900 uppercase">
                  SIGD SUIZA
                </span>
                <span className="rounded-md bg-sky-400 px-2 py-0.5 text-[10px] font-black tracking-widest text-white">
                  OFICIAL
                </span>
              </span>
              <span className="hidden truncate text-xs font-medium text-gray-600 md:block">
                IESTP Suiza • Pucallpa, Ucayali — Gestión Documentaria Digital
              </span>
            </span>
          </Link>

          <div className="hidden items-center gap-2 lg:flex">
            <Link
              to="/casilla"
              className={`rounded-lg px-3 py-2 text-xs font-bold transition hover:bg-gray-200 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${
                pathname === "/casilla"
                  ? "bg-gray-200 text-blue-700"
                  : "text-gray-700"
              }`}
            >
              Casilla Electrónica
            </Link>
            <Link
              to="/administracion"
              className={`rounded-lg px-3 py-2 text-xs font-bold transition hover:bg-gray-200 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${
                pathname === "/administracion"
                  ? "bg-gray-200 text-blue-700"
                  : "text-gray-700"
              }`}
            >
              Administración
            </Link>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-100 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
            >
              <MonitorUp size={14} aria-hidden="true" />
              Render HD
            </button>
            <span className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-sm">
              <Users size={14} aria-hidden="true" />
              Administrador (Conectado)
            </span>
          </div>

          <button
            type="button"
            onClick={() => setMenuAbierto((abierto) => !abierto)}
            aria-label={menuAbierto ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={menuAbierto}
            className="rounded-lg border border-slate-300 bg-white p-2 text-gray-700 transition hover:bg-slate-200 lg:hidden"
          >
            {menuAbierto ? (
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            ) : (
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            )}
          </button>
        </div>

        {menuAbierto && (
          <div className="border-t border-gray-200 bg-gray-100 px-4 py-3 sm:px-6 lg:hidden">
            <ul className="flex flex-col gap-1">
              {enlacesMovil.map((enlace) => (
                <li key={enlace.ruta}>
                  <Link
                    to={enlace.ruta}
                    onClick={() => setMenuAbierto(false)}
                    className={`block rounded-lg px-3 py-2.5 text-sm font-bold transition ${
                      pathname === enlace.ruta
                        ? "bg-blue-50 text-blue-700"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {enlace.etiqueta}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-gray-200 pt-3">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-100"
              >
                <MonitorUp size={14} aria-hidden="true" />
                Render HD
              </button>
              <span className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-3 py-2 text-xs font-bold text-white">
                <Users size={14} aria-hidden="true" />
                Administrador (Conectado)
              </span>
            </div>
          </div>
        )}
      </header>

      <section className="bg-[#0a1931] print:hidden">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.5fr_1fr] lg:px-8">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold tracking-widest text-sky-300 uppercase">
              Portal Institucional
            </span>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
              SIGD
              <span className="mt-1 block text-2xl font-bold text-blue-100 sm:text-3xl lg:text-4xl">
                Sistema Integral de Gestión Documentaria
              </span>
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">
              Un único portal para firmar, notificar, radicar y consultar tus
              trámites institucionales con trazabilidad, seguridad y plena
              validez legal.
            </p>
            <p className="mt-5 border-l-4 border-cyan-400 pl-4 text-lg font-semibold text-cyan-300 italic sm:text-xl">
              Formación que transforma
            </p>
          </div>

          <div className="rounded-2xl border border-white/25 bg-white/10 p-4 shadow-2xl shadow-black/50 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold tracking-widest text-white/80 uppercase">
                Vista previa
              </span>
              <span className="rounded-full border border-cyan-400/40 bg-cyan-400/15 px-2 py-0.5 text-[10px] font-bold text-cyan-200">
                En vivo
              </span>
            </div>

            <div className="relative mt-3 h-40 overflow-hidden rounded-xl border border-white/20 bg-slate-900">
              <img
                src={vistaPreviaPortal}
                alt="Vista previa del portal institucional SIGD SUIZA"
                className="h-full w-full object-cover object-top"
              />
              <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-3 pt-8 pb-3 text-center text-sm font-semibold text-cyan-200 italic">
                Formación que transforma
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-slate-200">
                <MapPin size={13} className="shrink-0 text-cyan-300" />
                <span className="truncate">Sede Institucional Pucallpa</span>
              </span>
              <button
                type="button"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-500 px-3 py-2 text-[11px] font-bold text-white shadow-lg shadow-blue-950/40 transition hover:bg-blue-400 focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:outline-none"
              >
                <Expand size={13} aria-hidden="true" />
                Ampliación HD
              </button>
            </div>
          </div>
        </div>
      </section>

      <main className="w-full px-6 py-12">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
            Servicios Digitales Institucionales
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base">
            Acceso directo a todos los módulos y ventanillas del ecosistema
            digital SIGD Suiza.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {servicios.map((servicio) => {
            const Icono = servicio.icono;
            const clasesTarjeta = `group flex flex-col rounded-2xl p-7 text-white shadow-lg shadow-slate-900/15 transition duration-200 hover:-translate-y-1 hover:shadow-2xl hover:shadow-slate-900/25 focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:p-8 ${servicio.fondo}`;
            const contenido = (
              <>
                <span className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-white/20">
                  <Icono size={24} aria-hidden="true" />
                </span>

                <h3 className="text-xl font-bold">{servicio.titulo}</h3>
                <p className="mt-3 text-sm leading-6 text-white/85">
                  {servicio.descripcion}
                </p>

                <span className="mt-auto flex justify-end pt-6">
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-500 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-blue-950/40 transition group-hover:bg-blue-400">
                    Ingresar →
                  </span>
                </span>
              </>
            );

            if (servicio.requiereAuth) {
              return (
                <button
                  key={servicio.ruta}
                  type="button"
                  aria-haspopup="dialog"
                  onClick={() => setAccesoMpAbierto(true)}
                  className={`${clasesTarjeta} w-full cursor-pointer text-left`}
                >
                  {contenido}
                </button>
              );
            }

            return (
              <Link
                key={servicio.ruta}
                to={servicio.ruta}
                className={clasesTarjeta}
              >
                {contenido}
              </Link>
            );
          })}
        </div>
      </main>

      <AutenticacionMesaPartesModal
        abierto={accesoMpAbierto}
        onCerrar={() => setAccesoMpAbierto(false)}
      />

      <footer className="border-t border-slate-300 bg-slate-100 print:hidden">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-5 sm:px-6 lg:flex-row lg:px-8">
          <div className="flex items-center gap-3">
            <span
              role="img"
              aria-label="Bandera del Perú"
              className="flex h-5 w-8 shrink-0 flex-col overflow-hidden rounded-[3px] border border-slate-300 shadow-sm"
            >
              <span className="flex-1 bg-red-700" />
              <span className="flex-1 bg-white" />
              <span className="flex-1 bg-red-700" />
            </span>
            <span className="text-xs font-semibold text-gray-700">
              IESTP Suiza • Dirección Regional de Educación de Ucayali
            </span>
          </div>

          <span className="text-xs font-medium text-slate-500">
            Pucallpa, Coronel Portillo, Ucayali
          </span>

          <span className="rounded-md border border-slate-300 bg-white px-2.5 py-1 font-mono text-[11px] font-bold text-slate-600">
            SIGD v1.0
          </span>
        </div>
      </footer>
    </div>
  );
}
