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
    titulo: "Flujo de expedientes",
    descripcion:
      "Workflow de 5 etapas de la Secretaría Académica para titulación, grados, certificaciones, convalidaciones y trabajos de investigación (verificación, revisión de requisitos, observaciones, subsanación y emisión de resolución).",
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
      "Renderizado de copias auténticas A4 con estampa lateral CVD de 20mm y QR de cotejo (D.S. 070-2013-PCM).",
    responsables: "Mayra (R)",
    ruta: "/flujo-validez-legal/visor-cvd",
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
    <div className="mx-auto max-w-7xl space-y-8 text-slate-900">
      <header className="bg-white/95 backdrop-blur-xl rounded-2xl p-6 sm:p-8 shadow-xl shadow-slate-950/20 border border-white/80">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200/60 px-3 py-1 text-xs font-bold tracking-wider text-blue-700 uppercase mb-2">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
              Módulo 04 · Flujo y Validez Legal de Documentos Digitales
            </span>
            <h1 className="mt-1 text-3xl font-black text-slate-900 tracking-tight">
              Centro de Coordinación
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600 leading-relaxed">
              Hub de navegación de la entrega 04 liderada por Adriano David
              Espinoza Ramírez (ADERRTX). Cada tarjeta corresponde a un artefacto
              evaluable del plan de trabajo.
            </p>
          </div>
          <Link
            to="/"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-100 self-start"
          >
            ← Volver al inicio
          </Link>
        </div>
      </header>

      <section>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {MODULOS.map((modulo) => {
            const disponible = modulo.ruta !== null;
            return (
              <article
                key={modulo.codigo}
                className={`flex flex-col bg-white/95 backdrop-blur-xl rounded-2xl p-6 border border-white/80 shadow-lg hover:shadow-2xl hover:border-cyan-400/40 transition-all duration-200 ${
                  disponible
                    ? "hover:-translate-y-1"
                    : "opacity-85"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200/60 px-3 py-1 font-mono text-[11px] font-bold text-blue-700 uppercase tracking-wider">
                    {modulo.codigo}
                  </span>
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wider ${
                      disponible
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-amber-200 bg-amber-50 text-amber-700"
                    }`}
                  >
                    {disponible ? "Disponible" : "En desarrollo"}
                  </span>
                </div>

                <h2 className="mt-4 text-lg font-extrabold text-slate-900 tracking-tight">
                  {modulo.titulo}
                </h2>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">
                  {modulo.descripcion}
                </p>

                <p className="mt-4 text-xs font-bold text-slate-500">
                  {modulo.responsables}
                </p>

                <div className="mt-5">
                  {disponible && modulo.ruta ? (
                    <Link
                      to={modulo.ruta}
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:from-blue-700 hover:to-indigo-700"
                    >
                      Ir al artefacto →
                    </Link>
                  ) : (
                    <span className="text-xs font-medium text-slate-500">
                      🔒 Pendiente del integrante responsable
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
