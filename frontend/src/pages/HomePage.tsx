import {
  ArrowRight,
  FileSearch,
  LogIn,
  Search,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { filtrarModulosPorRol, useSesion } from "../config/accesoModulos";
import { elementoIconoModulo } from "../config/iconosModulos";
import { nombreFamilia } from "../config/taxonomiaModulos";
import HeroInstitucional from "../components/landing/HeroInstitucional";
import SeccionBienvenida from "../components/landing/SeccionBienvenida";

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
    destacado: false,
  },
  {
    id: "registro",
    titulo: "Registro ciudadano",
    descripcion: "Crea tu cuenta con validación de identidad para operar en el SIGD.",
    ruta: "/registro",
    icono: UserRound,
    etiqueta: "Registrarme",
    destacado: false,
  },
  {
    id: "acceso",
    titulo: "Acceso institucional",
    descripcion: "Docentes, jefaturas y personal administrativo con roles habilitados.",
    ruta: "/login",
    icono: LogIn,
    etiqueta: "Ingresar",
    destacado: false,
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

        <div className="mt-9 grid auto-rows-fr grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {ACCESOS_RAPIDOS.map(({ id, titulo, descripcion, ruta, icono: Icono, etiqueta, destacado }) => (
            <Link
              key={id}
              to={ruta}
              data-destacado={destacado ? "1" : undefined}
              className="ficha-modulo group flex h-full flex-col p-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-vault-azul"
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

function AccesosModulosPorRol() {
  const { rol, autenticado } = useSesion();
  const navigate = useNavigate();
  const visibles = filtrarModulosPorRol(rol, autenticado);
  const esEstudiante = rol === "ESTUDIANTE";

  if (!autenticado || !rol || visibles.length === 0) return null;

  return (
    <section className="border-b border-vault-papel-3 bg-white py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="section-title inline-flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              {esEstudiante ? "Panel del estudiante" : "Panel institucional"}
            </span>
            <h2 className="mt-3 text-3xl font-black tracking-[-0.035em] text-vault-tinta sm:text-4xl">
              {esEstudiante ? "Tus módulos de estudiante" : "Tus módulos de trabajo"}
            </h2>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-tinta-500">
            Accesos filtrados según tu rol. Cada módulo conserva trazabilidad y permisos
            granulares.
          </p>
        </div>

        <div className="mt-9 grid auto-rows-fr grid-cols-1 items-stretch gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibles.map((modulo) => (
            <button
              key={modulo.id}
              type="button"
              onClick={() => navigate(modulo.ruta)}
              className="ficha-modulo group flex h-full w-full items-start gap-3 p-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-vault-azul"
            >
              <span className="ficha-icono">
                {elementoIconoModulo(modulo.id, "h-4 w-4")}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[9px] font-bold uppercase tracking-[0.14em] text-tinta-400">
                  {nombreFamilia(modulo.familia)}
                </span>
                <span className="mt-1 block text-sm font-bold leading-5 text-vault-tinta">
                  {modulo.titulo}
                </span>
                <span className="mt-1 block text-xs leading-5 text-tinta-500">
                  {modulo.descripcion}
                </span>
              </span>
              <ArrowRight
                className="mt-1 h-4 w-4 shrink-0 text-tinta-300 transition group-hover:translate-x-0.5 group-hover:text-vault-azul"
                aria-hidden="true"
              />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  const { rol, autenticado } = useSesion();
  const tieneSesion = autenticado && Boolean(rol);

  return (
    <main className="relative bg-vault-papel text-vault-tinta">
      <HeroInstitucional />
      {tieneSesion ? <AccesosModulosPorRol /> : <AccesosRapidos />}
      <SeccionBienvenida />
    </main>
  );
}
