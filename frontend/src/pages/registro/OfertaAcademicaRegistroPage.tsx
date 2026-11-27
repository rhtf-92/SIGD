import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  GraduationCap,
  ShieldCheck,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  PROGRAMAS_ESTUDIO_CATALOGO,
  type ProgramaEstudioCodigo,
} from "../../types/tramiteWizard";

interface InformacionCarrera {
  readonly aprenderas: string;
  readonly areas: readonly string[];
  readonly salidas: readonly string[];
}

const INFORMACION_CARRERAS: Record<ProgramaEstudioCodigo, InformacionCarrera> = {
  ADE: {
    aprenderas:
      "Organizar las operaciones de una empresa, apoyar la gestión del talento humano y analizar información financiera y comercial para tomar decisiones.",
    areas: ["Gestión empresarial", "Finanzas y costos", "Marketing y ventas"],
    salidas: [
      "Asistente administrativo o de gerencia",
      "Apoyo en áreas comerciales y de ventas",
      "Asistente en gestión de pequeñas empresas",
    ],
  },
  AOT: {
    aprenderas:
      "Planificar servicios turísticos, orientar a visitantes y participar en la operación de alojamientos, restaurantes y actividades de turismo.",
    areas: ["Atención al visitante", "Operación hotelera", "Diseño de servicios turísticos"],
    salidas: [
      "Agencias y operadores turísticos",
      "Hoteles y establecimientos de hospedaje",
      "Servicios de información y orientación turística",
    ],
  },
  ASAD: {
    aprenderas:
      "Brindar soporte a equipos de trabajo, gestionar documentos y archivos, coordinar comunicaciones y utilizar herramientas de oficina.",
    areas: ["Asistencia ejecutiva", "Gestión documental", "Atención y comunicación"],
    salidas: [
      "Asistencia administrativa y de gerencia",
      "Oficinas de trámite documentario y archivo",
      "Recepción y atención al usuario",
    ],
  },
  CONT: {
    aprenderas:
      "Registrar operaciones contables, organizar documentación financiera y apoyar la preparación de reportes, costos y obligaciones tributarias.",
    areas: ["Registro contable", "Tributación", "Costos y reportes financieros"],
    salidas: [
      "Estudios y oficinas contables",
      "Áreas de contabilidad y tesorería",
      "Asistencia en costos y administración financiera",
    ],
  },
  CCIV: {
    aprenderas:
      "Apoyar el levantamiento topográfico, interpretar planos y colaborar en la planificación, ejecución y control técnico de obras civiles.",
    areas: ["Topografía y dibujo técnico", "Edificaciones", "Obras viales y saneamiento"],
    salidas: [
      "Empresas constructoras y contratistas",
      "Apoyo técnico en supervisión de obras",
      "Oficinas de proyectos y levantamientos topográficos",
    ],
  },
  DSI: {
    aprenderas:
      "Analizar necesidades de usuarios y construir, probar y mantener soluciones de software, bases de datos y servicios informáticos.",
    areas: ["Programación y desarrollo web", "Bases de datos", "Soporte y redes informáticas"],
    salidas: [
      "Equipos de desarrollo de software",
      "Áreas de soporte técnico y redes",
      "Gestión y mantenimiento de bases de datos",
    ],
  },
  EIND: {
    aprenderas:
      "Instalar, revisar y mantener equipos eléctricos industriales, interpretar planos y participar en sistemas de control y automatización.",
    areas: ["Instalaciones eléctricas", "Control y automatización", "Mantenimiento industrial"],
    salidas: [
      "Áreas de mantenimiento de plantas y talleres",
      "Empresas de instalaciones y servicios eléctricos",
      "Apoyo técnico en sistemas de automatización",
    ],
  },
  ENF: {
    aprenderas:
      "Brindar cuidados básicos de enfermería, apoyar acciones de promoción y prevención de la salud y colaborar con el equipo de atención.",
    areas: ["Cuidados integrales", "Promoción y prevención", "Salud comunitaria"],
    salidas: [
      "Establecimientos y servicios de salud",
      "Programas comunitarios de promoción de la salud",
      "Apoyo en cuidados y atención al paciente",
    ],
  },
  MFOR: {
    aprenderas:
      "Participar en el manejo sostenible de recursos forestales, inventarios, viveros, reforestación y acciones de conservación ambiental.",
    areas: ["Manejo de bosques", "Viveros y reforestación", "Conservación y aprovechamiento forestal"],
    salidas: [
      "Proyectos de manejo y conservación forestal",
      "Viveros, reforestación y producción de plantones",
      "Empresas y organizaciones del sector forestal",
    ],
  },
  MAUT: {
    aprenderas:
      "Inspeccionar y mantener vehículos, identificar fallas en motores y sistemas mecánicos, y utilizar herramientas de diagnóstico automotriz.",
    areas: ["Motores y transmisión", "Electricidad y electrónica automotriz", "Mantenimiento y diagnóstico"],
    salidas: [
      "Talleres de mecánica y mantenimiento vehicular",
      "Concesionarios y servicios posventa",
      "Empresas con flotas de transporte",
    ],
  },
  PAGR: {
    aprenderas:
      "Participar en la producción de cultivos y la crianza de animales, aplicando prácticas de manejo, sanidad y aprovechamiento agropecuario.",
    areas: ["Producción de cultivos", "Manejo pecuario", "Sanidad y gestión agropecuaria"],
    salidas: [
      "Unidades y empresas de producción agropecuaria",
      "Viveros, fundos y proyectos agrícolas",
      "Asistencia técnica en producción y sanidad",
    ],
  },
};

export default function OfertaAcademicaRegistroPage() {
  const [carrerasAbiertas, setCarrerasAbiertas] = useState<Set<ProgramaEstudioCodigo>>(
    () => new Set(),
  );

  const alternarInformacionCarrera = (codigo: ProgramaEstudioCodigo) => {
    setCarrerasAbiertas((abiertas) => {
      const actualizadas = new Set(abiertas);
      if (actualizadas.has(codigo)) {
        actualizadas.delete(codigo);
      } else {
        actualizadas.add(codigo);
      }
      return actualizadas;
    });
  };

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[#edf4fc] text-slate-900">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center bg-fixed"
        style={{ backgroundImage: "url('/graduacion-carreras.jpg')" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage:
            "linear-gradient(135deg, rgba(239, 246, 255, 0.56) 0%, rgba(232, 242, 255, 0.48) 48%, rgba(224, 245, 242, 0.58) 100%), radial-gradient(ellipse at 8% 18%, rgba(59, 130, 246, 0.08), transparent 30%), radial-gradient(ellipse at 92% 43%, rgba(20, 184, 166, 0.08), transparent 31%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-[1] opacity-[0.16]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(12, 35, 64, 0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(12, 35, 64, 0.07) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
          maskImage: "linear-gradient(to bottom, transparent, black 28%, black 80%, transparent)",
        }}
      />
      <GraduationCap
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 top-[34rem] z-[2] h-[28rem] w-[28rem] rotate-[-18deg] text-blue-950/[0.035]"
        strokeWidth={0.65}
      />
      <BookOpenCheck
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 bottom-24 z-[2] h-[24rem] w-[24rem] rotate-[12deg] text-teal-900/[0.04]"
        strokeWidth={0.65}
      />

      <header className="relative z-10 border-b border-white/70 bg-white/75 shadow-sm shadow-blue-950/[0.03] backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/login" className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0c2340] font-serif text-2xl font-black text-white shadow-sm">
              S
            </span>
            <span>
              <span className="block text-sm font-extrabold tracking-wide text-[#0c2340]">
                IESTP “SUIZA”
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">
                Pucallpa · Ucayali
              </span>
            </span>
          </Link>
          <nav aria-label="Navegación principal" className="flex items-center gap-2 sm:gap-4">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-[#0c2340]"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Volver al acceso</span>
              <span className="sm:hidden">Acceso</span>
            </Link>
            <Link
              to="/registro"
              className="inline-flex items-center gap-2 rounded-lg bg-[#0c2340] px-3 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#12365f] sm:px-4"
            >
              <span>Crear usuario</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative z-10 isolate overflow-hidden bg-[#0c2340]/90 text-white shadow-xl shadow-blue-950/15">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_rgba(59,130,246,0.3),_transparent_55%),linear-gradient(120deg,_#0c2340,_#12365f)]"
        />
        <div
          aria-hidden="true"
          className="absolute -right-24 -top-32 -z-10 h-96 w-96 rounded-full border border-white/10"
        />
        <div
          aria-hidden="true"
          className="absolute -right-10 -top-16 -z-10 h-64 w-64 rounded-full border border-white/10"
        />
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:px-8">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-200/20 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-blue-100">
              <GraduationCap className="h-4 w-4" aria-hidden="true" />
              Oferta académica institucional
            </div>
            <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Encuentra el programa que impulsa tu futuro
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-blue-100 sm:text-lg">
              Explora los 11 programas de estudio del IESTP “Suiza”. Crea tu
              usuario externo para acceder a los servicios y trámites digitales
              de la institución.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/registro"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-extrabold text-[#0c2340] shadow-lg transition hover:-translate-y-0.5 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-white/40"
              >
                Crear usuario externo
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <a
                href="#carreras"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/5 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10"
              >
                <BookOpenCheck className="h-4 w-4" aria-hidden="true" />
                Ver las 11 carreras
              </a>
            </div>
          </div>

          <div className="rounded-3xl border border-white/15 bg-white/10 p-6 shadow-2xl shadow-slate-950/20 backdrop-blur-sm sm:p-8">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-[#0c2340]">
                <BookOpenCheck className="h-7 w-7" aria-hidden="true" />
              </div>
              <div>
                <p className="text-4xl font-black tracking-tight">11</p>
                <p className="text-sm font-semibold text-blue-100">programas de estudio</p>
              </div>
            </div>
            <div className="my-6 h-px bg-white/15" />
            <ul className="space-y-4 text-sm text-blue-50">
              <li className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" aria-hidden="true" />
                Formación técnica para responder a las necesidades de la región.
              </li>
              <li className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" aria-hidden="true" />
                Información oficial del catálogo institucional de carreras.
              </li>
              <li className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-200" aria-hidden="true" />
                Portal institucional para servicios y trámites digitales.
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section id="carreras" className="relative z-10 mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-blue-700">
              Formación profesional técnica
            </p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-[#0c2340] sm:text-4xl">
              Nuestros programas de estudio
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              Conoce las áreas de formación disponibles en el IESTP “Suiza”.
            </p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-bold text-blue-900">
            <GraduationCap className="h-4 w-4" aria-hidden="true" />
            11 carreras
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PROGRAMAS_ESTUDIO_CATALOGO.map((programa, index) => (
            (() => {
              const informacion = INFORMACION_CARRERAS[programa.value];
              const estaAbierta = carrerasAbiertas.has(programa.value);
              const idInformacion = `informacion-carrera-${programa.value}`;

              return (
                <article
                  key={programa.value}
                  className="group flex flex-col rounded-2xl border border-white/90 bg-white/90 p-5 shadow-lg shadow-blue-950/[0.08] backdrop-blur-md transition duration-200 hover:-translate-y-1 hover:border-blue-200 hover:bg-white/95 hover:shadow-xl hover:shadow-blue-950/15 sm:p-6"
                >
                  <div className="mb-5 flex items-center justify-between">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-800 transition group-hover:bg-[#0c2340] group-hover:text-white">
                      <GraduationCap className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="font-mono text-xs font-bold tracking-wider text-slate-400">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="text-lg font-extrabold leading-snug text-[#0c2340]">
                    {programa.label}
                  </h3>
                  <p className="mt-2 min-h-12 text-sm leading-6 text-slate-600">
                    {programa.description}
                  </p>

                  <div
                    id={idInformacion}
                    hidden={!estaAbierta}
                    className="mt-5 space-y-5 border-t border-blue-100 pt-5"
                  >
                      <div>
                        <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-[#0c2340]">
                          <BookOpenCheck className="h-4 w-4 text-blue-700" aria-hidden="true" />
                          Qué aprenderás
                        </h4>
                        <p className="text-sm leading-6 text-slate-600">
                          {informacion.aprenderas}
                        </p>
                        <ul className="mt-3 space-y-2">
                          {informacion.areas.map((area) => (
                            <li key={area} className="flex items-start gap-2 text-sm text-slate-700">
                              <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" aria-hidden="true" />
                              {area}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-[#0c2340]">
                          <BriefcaseBusiness className="h-4 w-4 text-blue-700" aria-hidden="true" />
                          Dónde podrás trabajar
                        </h4>
                        <ul className="space-y-2">
                          {informacion.salidas.map((salida) => (
                            <li key={salida} className="flex items-start gap-2 text-sm leading-5 text-slate-600">
                              <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-600" />
                              {salida}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <p className="text-xs leading-5 text-slate-500">
                        Las funciones y oportunidades dependen de la experiencia
                        y los requisitos de cada entidad empleadora.
                      </p>
                  </div>

                  <button
                    type="button"
                    aria-expanded={estaAbierta}
                    aria-controls={idInformacion}
                    onClick={() => alternarInformacionCarrera(programa.value)}
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50/80 px-4 py-2.5 text-sm font-bold text-blue-900 transition hover:border-blue-300 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/20"
                  >
                    {estaAbierta ? "Ocultar información" : "Ver información"}
                    {estaAbierta ? (
                      <ChevronUp className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </article>
              );
            })()
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-blue-100 bg-blue-50/70 p-5 sm:mt-12 sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-7">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-800" aria-hidden="true" />
            <p className="text-sm leading-6 text-slate-700">
              El usuario externo permite realizar trámites institucionales. Su
              creación no constituye una postulación al proceso de admisión.
            </p>
          </div>
          <Link
            to="/registro"
            className="mt-5 inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#0c2340] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#12365f] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-500/25 sm:mt-0"
          >
            Continuar al registro
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/80 bg-white/75 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span className="font-semibold text-slate-700">IESTP “Suiza” · Pucallpa, Ucayali</span>
          <span>Portal de información y servicios institucionales</span>
        </div>
      </footer>
    </main>
  );
}
