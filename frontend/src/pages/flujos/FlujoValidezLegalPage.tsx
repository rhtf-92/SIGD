import { Link } from "react-router-dom";

interface TarjetaModulo {
  codigo: string;
  titulo: string;
  descripcion: string;
  responsables: string;
  ruta: string | null;
}

const MODULOS: TarjetaModulo[] = [
  {
    codigo: "ENT-M04-01",
    titulo: "Flujo de Titulación / Trabajo de Investigación",
    descripcion:
      "Workflow académico de 5 etapas administrado por la Secretaría Académica (verificación, revisión de requisitos, observaciones, subsanación y emisión de resolución).",
    responsables: "Adriano D. Espinoza (R/A)",
    ruta: "/flujos/titulacion",
  },
  {
    codigo: "ENT-M04-02",
    titulo: "Proyectos y Resoluciones Académicas",
    descripcion:
      "Gestión de expedientes de proyectos y resoluciones del Director General (pendiente de implementación).",
    responsables: "Isaí (R)",
    ruta: null,
  },
  {
    codigo: "ENT-M04-03",
    titulo: "Pasarela de Despacho de Firma Digital (Refirma RENIEC)",
    descripcion:
      "Invocación del agente local refirma://, secuencia PAdES-BES + TSA y firma de documentos en lote desde la Secretaría Académica.",
    responsables: "Adriano D. Espinoza (R/A) · Mayra (R)",
    ruta: "/flujo-validez-legal/firma",
  },
  {
    codigo: "ENT-M04-04",
    titulo: "Visor Documental y Códigos QR",
    descripcion:
      "Renderizado de copias auténticas con estampado QR (pendiente de implementación).",
    responsables: "Mayra (R)",
    ruta: null,
  },
  {
    codigo: "ENT-M04-05",
    titulo: "Portal Validador Público de CVD",
    descripcion:
      "Servicio sin autenticación para verificar Códigos de Verificación Digital, firmantes y sello de tiempo de documentos emitidos.",
    responsables: "Adriano D. Espinoza (R/A) · Mayra (R)",
    ruta: "/validador-cvd",
  },
];

export default function FlujoValidezLegalPage() {
  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="header-sigd">
        <div className="mx-auto max-w-7xl px-6 py-8">
          <p className="text-sm font-bold tracking-[0.16em] text-white/80 uppercase">
            Módulo 04 · Flujo y Validez Legal de Documentos Digitales
          </p>
          <h1 className="mt-1 text-3xl font-black">Centro de Coordinación</h1>
          <p className="mt-2 max-w-3xl text-sm text-white/85">
            Hub de navegación de la entrega 04 liderada por Adriano David
            Espinoza Ramírez (ADERRTX). Cada tarjeta corresponde a un artefacto
            evaluable del plan de trabajo.
          </p>
        </div>
      </header>

      <div className="header-bar" aria-hidden="true" />

      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
                      Ir al artefacto →
                    </Link>
                  ) : (
                    <span className="text-xs text-slate-500">
                      🔒 Pendiente del integrante responsable
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}