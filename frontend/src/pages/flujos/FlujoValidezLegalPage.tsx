import { useState, type FormEvent } from "react";
import { ArrowRight, FilePlus2, Search } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

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
  const navigate = useNavigate();
  const [cut, setCut] = useState("");

  function buscarExpediente(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const codigo = cut.trim().toUpperCase();
    if (codigo) {
      navigate(`/consulta/${encodeURIComponent(codigo)}`);
    }
  }

  return (
    <main className="centro-control-documental-page min-h-screen text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-start justify-between gap-4 px-6 py-8">
          <div>
            <p className="text-sm font-bold tracking-[0.16em] text-slate-900 uppercase">
              Módulo 04 · Flujo y Validez Legal de Documentos Digitales
            </p>
            <h1 className="mt-1 text-3xl font-black text-slate-900">
              Centro de Control Documental
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-700">
              Inicia trámites, consulta su avance y gestiona documentos digitales,
              códigos QR y validación de autenticidad desde un solo lugar.
            </p>
          </div>
          <Link
            to="/"
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            ← Volver al inicio
          </Link>
        </div>
      </header>

      <div className="header-bar" aria-hidden="true" />

      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex-1">
              <p className="text-xs font-bold uppercase tracking-wider text-blue-700">
                Seguimiento de expedientes
              </p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">
                ¿En qué etapa está tu trámite?
              </h2>
              <form
                onSubmit={buscarExpediente}
                className="mt-4 flex flex-col gap-3 sm:flex-row"
              >
                <label className="sr-only" htmlFor="cut-seguimiento">
                  Código Único de Trámite
                </label>
                <input
                  id="cut-seguimiento"
                  value={cut}
                  onChange={(event) => setCut(event.target.value)}
                  placeholder="Ingresa el código CUT"
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm uppercase text-slate-900 placeholder:normal-case placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
                <button
                  type="submit"
                  disabled={!cut.trim()}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Search aria-hidden="true" className="h-4 w-4" />
                  Consultar estado
                </button>
              </form>
            </div>
            <Link
              to="/tramite"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-800"
            >
              <FilePlus2 aria-hidden="true" className="h-4 w-4" />
              Iniciar trámite
              <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-7 border-t border-slate-100 pt-5">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
              Etapas del trámite académico
            </p>
            <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {["Registro", "Verificación", "Revisión", "Subsanación", "Emisión"].map(
                (etapa, index) => (
                  <li
                    key={etapa}
                    className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-800">
                      {index + 1}
                    </span>
                    {etapa}
                  </li>
                ),
              )}
            </ol>
          </div>
        </div>

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