import {
  ArrowRight,
  CheckCircle2,
  FileSearch,
  Fingerprint,
  LogIn,
  ScanLine,
  Search,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import {
  filtrarModulosPorRol,
  ROLES_INTERNOS,
  useSesion,
  type RolCanonico,
} from "../config/accesoModulos";
import { elementoIconoModulo } from "../config/iconosModulos";
import { agruparPorFamilia } from "../config/taxonomiaModulos";
import HeroInstitucional from "../components/landing/HeroInstitucional";
import SeccionBienvenida from "../components/landing/SeccionBienvenida";
import LectorDniDigital from "../components/dni/LectorDniDigital";

const ACCESOS_RAPIDOS = [
  {
    id: "mesa-virtual",
    titulo: "Mesa de Partes Virtual",
    descripcion: "Presenta tu solicitud, adjunta requisitos y obtén tu CUT al instante.",
    ruta: "/tramite",
    icono: FileSearch,
    etiqueta: "Iniciar trámite",
    destacado: true,
  },
  {
    id: "consulta",
    titulo: "Consultar expediente",
    descripcion: "Sigue el estado de tu trámite en tiempo real con tu DNI y código CUT.",
    ruta: "/consulta",
    icono: Search,
    etiqueta: "Consultar con CUT",
  },
  {
    id: "registro",
    titulo: "Registro ciudadano",
    descripcion: "Crea tu cuenta con validación de identidad para operar en el SIGD.",
    ruta: "/registro",
    icono: UserRound,
    etiqueta: "Registrarme",
  },
  {
    id: "acceso",
    titulo: "Acceso institucional",
    descripcion: "Docentes, jefaturas y personal administrativo con roles habilitados.",
    ruta: "/login",
    icono: LogIn,
    etiqueta: "Ingresar",
  },
] as const;

function AccesosRapidos() {
  return (
    <section id="accesos" className="scroll-mt-28 border-b border-vault-papel-3 bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="section-title inline-flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Accesos rápidos
            </span>
            <h2 className="mt-3 max-w-xl text-3xl font-black tracking-[-0.035em] text-vault-tinta sm:text-4xl">
              ¿Qué necesitas hacer hoy?
            </h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-tinta-500">
            Cuatro rutas claras para iniciar, consultar y dar seguimiento a tus documentos
            sin pasar por ventanilla.
          </p>
        </div>

        <div className="mt-9 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ACCESOS_RAPIDOS.map(({ id, titulo, descripcion, ruta, icono: Icono, etiqueta, destacado }) => (
            <Link
              key={id}
              to={ruta}
              data-destacado={destacado ? "1" : undefined}
              className="ficha-modulo group flex flex-col p-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-vault-azul"
            >
              <span className="ficha-icono">
                <Icono className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="mt-4 block text-base font-bold text-vault-tinta">{titulo}</span>
              <span className="mt-1.5 flex-1 text-sm leading-relaxed text-tinta-500">{descripcion}</span>
              <span className="ficha-cta mt-4">
                {etiqueta}
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function BandaIdentidadDni() {
  return (
    <section className="border-b border-vault-papel-3 bg-vault-papel py-16 sm:py-20">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8">
        <div>
          <span className="section-title inline-flex items-center gap-2">
            <Fingerprint className="h-3.5 w-3.5" aria-hidden="true" />
            Identidad digital
          </span>
          <h2 className="mt-3 max-w-xl text-3xl font-black tracking-[-0.035em] text-vault-tinta sm:text-4xl">
            Tus datos, listos en segundos.
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-relaxed text-tinta-500 sm:text-base">
            El lector reconoce el código PDF417 del DNI electrónico y autocompleta tu
            identidad para agilizar el registro y los trámites. Los datos se conservan
            únicamente en tu dispositivo.
          </p>

          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {[
              "Lectura local del código PDF417",
              "Autocompletado de formularios",
              "Verificación con RENIEC",
              "Privacidad de tus datos",
            ].map((texto) => (
              <li key={texto} className="flex items-center gap-2 text-sm font-medium text-tinta-700">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-vault-azul" aria-hidden="true" />
                {texto}
              </li>
            ))}
          </ul>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <LectorDniDigital variant="solid" label="Escanear DNI ahora" />
            <Link to="/registro" className="btn-secondary">
              Ir al registro
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <p className="mt-5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-tinta-400">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Modo demostración · los datos se almacenan solo en este dispositivo
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-sm">
          <div className="pointer-events-none absolute -inset-5 rounded-[2rem] bg-vault-azul/10 blur-2xl" />
          <div className="relative overflow-hidden rounded-2xl border border-vault-papel-3 bg-white shadow-[0_24px_60px_-30px_rgba(18,32,46,0.45)]">
            <div className="h-2 bg-gradient-to-r from-vault-azul via-sky-500 to-cyan-400" />
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-tinta-400">
                    República del Perú
                  </p>
                  <p className="mt-0.5 text-sm font-black uppercase tracking-[0.08em] text-vault-tinta">
                    DNI electrónico
                  </p>
                </div>
                <span className="grid h-11 w-11 place-items-center rounded-xl border border-vault-papel-3 bg-vault-papel text-vault-azul">
                  <Fingerprint className="h-6 w-6" aria-hidden="true" />
                </span>
              </div>

              <p className="mt-5 font-mono text-2xl font-bold tracking-[0.24em] text-vault-tinta">
                7456 ••••
              </p>
              <p className="mt-1 text-sm font-semibold text-tinta-600">Ciudadano(a) identificado(a)</p>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-vault-papel-3 bg-vault-papel/70 p-2.5">
                  <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-tinta-400">
                    Verificación
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-vault-tinta">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                    RENIEC
                  </p>
                </div>
                <div className="rounded-lg border border-vault-papel-3 bg-vault-papel/70 p-2.5">
                  <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-tinta-400">
                    Estado
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-vault-tinta">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Datos listos
                  </p>
                </div>
              </div>

              <div
                aria-hidden="true"
                className="mt-5 h-10 rounded-md border border-vault-papel-3 bg-[repeating-linear-gradient(90deg,#12202e_0_2px,transparent_2px_4px,#12202e_4px_5px,transparent_5px_8px)] opacity-70"
              />
              <p className="mt-2 flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.14em] text-tinta-400">
                <span className="inline-flex items-center gap-1">
                  <ScanLine className="h-3 w-3" aria-hidden="true" />
                  PDF417
                </span>
                <span>Lectura local</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function AccesosModulosInternos() {
  const { rol, autenticado } = useSesion();
  const navigate = useNavigate();
  const visibles = filtrarModulosPorRol(rol, autenticado);
  const esInterno = Boolean(rol) && ROLES_INTERNOS.includes(rol as RolCanonico);

  if (!esInterno || visibles.length === 0) return null;

  const grupos = agruparPorFamilia(visibles);

  return (
    <section className="border-b border-vault-papel-3 bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="section-title inline-flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Panel institucional
            </span>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-vault-tinta sm:text-4xl">
              Tus módulos de trabajo
            </h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-tinta-500">
            Accesos filtrados según tu rol y agrupados por familia documental. Cada acción
            conserva trazabilidad y permisos granulares.
          </p>
        </div>

        <div className="mt-9 space-y-8">
          {grupos.map((grupo) => (
            <div key={grupo.familia}>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-tinta-400">
                {grupo.nombre}
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {grupo.modulos.map((modulo) => (
                  <button
                    key={modulo.id}
                    type="button"
                    onClick={() => navigate(modulo.ruta)}
                    className="ficha-modulo group flex items-center gap-3 p-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-vault-azul"
                  >
                    <span className="ficha-icono">
                      {elementoIconoModulo(modulo.id, "h-4 w-4")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-vault-tinta">
                        {modulo.titulo}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-tinta-500">
                        {modulo.descripcion}
                      </span>
                    </span>
                    <ArrowRight
                      className="h-4 w-4 shrink-0 text-tinta-300 transition group-hover:translate-x-0.5 group-hover:text-vault-azul"
                      aria-hidden="true"
                    />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  const { rol } = useSesion();
  const esInterno = Boolean(rol) && ROLES_INTERNOS.includes(rol as RolCanonico);

  return (
    <main className="relative bg-vault-papel text-vault-tinta">
      <HeroInstitucional />
      {esInterno ? <AccesosModulosInternos /> : <AccesosRapidos />}
      <BandaIdentidadDni />
      <SeccionBienvenida />
    </main>
  );
}
