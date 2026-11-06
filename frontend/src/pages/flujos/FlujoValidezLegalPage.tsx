import { Link } from "react-router-dom";
import FlujoPageHeader from "../../components/flujos/FlujoPageHeader";

interface TarjetaModulo {
  codigo: string;
  titulo: string;
  descripcion: string;
  responsables: string;
  ruta: string | null;
}

const MODULOS: TarjetaModulo[] = [
  {
    codigo: "Fase 1",
    titulo: "Workflow Académico de Titulación",
    descripcion:
      "Workflow de 5 etapas de la Secretaría Académica para titulación, grados, certificaciones, convalidaciones y trabajos de investigación (verificación, revisión de requisitos, observaciones, subsanación y emisión de resolución).",
    responsables: "Secretaría Académica",
    ruta: "/flujos/titulacion",
  },
  {
    codigo: "Fase 2",
    titulo: "Proyectos y Resoluciones Directorales",
    descripcion:
      "Gestión y redacción estructurada de resoluciones directorales, generación de correlativo institucional y previsualización oficial WYSIWYG.",
    responsables: "Dirección General",
    ruta: "/flujos/proyector-resoluciones",
  },
  {
    codigo: "Fase 3",
    titulo: "Pasarela de Firma Digital (Refirma RENIEC)",
    descripcion:
      "Invocación del agente local refirma://, secuencia PAdES-BES + TSA y suscripción de documentos en lote con plena validez jurídica.",
    responsables: "Dirección y Secretaría General",
    ruta: "/flujo-validez-legal/firma",
  },
  {
    codigo: "Fase 4",
    titulo: "Visor Documental y Códigos QR",
    descripcion:
      "Renderizado de copias auténticas A4 con estampa lateral CVD de 20mm y QR de cotejo fehaciente (D.S. N° 070-2013-PCM).",
    responsables: "Archivo y Mesa de Partes",
    ruta: "/flujo-validez-legal/visor-cvd",
  },
  {
    codigo: "Fase 5",
    titulo: "Portal Validador Público de CVD",
    descripcion:
      "Portal oficial para la verificación de Códigos de Verificación Digital (CVD), firmantes y sello de tiempo de documentos emitidos.",
    responsables: "Portal de Transparencia y Ciudadanía",
    ruta: "/validador-cvd",
  },
];

export default function FlujoValidezLegalPage() {
  return (
    <div className="flex-1 w-full bg-slate-100 text-slate-900">
      <FlujoPageHeader
        faseTag="Módulo 04 · Flujo y Validez Legal de Documentos Digitales"
        title="Centro de Coordinación Documental"
        description="Plataforma integral de firma digital, emisión y certificación de resoluciones y documentos institucionales con plena validez legal (Ley N° 27269 y D.S. N° 070-2013-PCM)."
      />

      <div className="header-bar" aria-hidden="true" />

      <section className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-6 sm:py-10">
        <div className="grid gap-4 sm:gap-6 xl:gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
          {MODULOS.map((modulo) => {
            const disponible = modulo.ruta !== null;
            return (
              <article
                key={modulo.codigo}
                className={`flex flex-col rounded-2xl border bg-white p-6 shadow-sm ${
                  disponible
                    ? "border-slate-200 transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
                    : "border-dashed border-slate-300 opacity-70"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="badge-sigd">{modulo.codigo}</span>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-wider ${
                      disponible
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-amber-200 bg-amber-50 text-amber-700"
                    }`}
                  >
                    {disponible ? "Disponible" : "En desarrollo"}
                  </span>
                </div>

                <h2 className="mt-4 text-base font-bold text-slate-900">
                  {modulo.titulo}
                </h2>
                <p className="mt-2 flex-1 text-sm leading-5 text-slate-600">
                  {modulo.descripcion}
                </p>

                <p className="mt-4 text-xs font-bold text-slate-400">
                  {modulo.responsables}
                </p>

                <div className="mt-5">
                  {disponible && modulo.ruta ? (
                    <Link
                      to={modulo.ruta}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800"
                    >
                      Acceder al servicio →
                    </Link>
                  ) : (
                    <span className="text-xs text-slate-500">
                      🔒 En proceso de habilitación
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}