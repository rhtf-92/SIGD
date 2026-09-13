import { useNavigate, useParams } from "react-router-dom";

import ExpedienteTimeline from "../../components/expedientes/ExpedienteTimeline";
import { useExpedientesBase } from "../../hooks/useBandejaExpedientes";
import { useExpedienteTimeline } from "../../hooks/useExpedienteTimeline";
import { ETIQUETAS_ESTADO_FLUJO } from "../../types/expediente";

export default function ExpedienteDetallePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: expedientes, isLoading: cargandoExpediente } =
    useExpedientesBase();
  const expediente = expedientes?.find((exp) => exp.id === id);

  const { data: eventos, isLoading: cargandoTimeline } =
    useExpedienteTimeline(id);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-5">
          <button
            type="button"
            onClick={() => navigate("/expedientes")}
            className="mb-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            ← Volver a la bandeja
          </button>

          <p className="text-sm font-bold text-blue-700">SIGD</p>
          <h1 className="text-2xl font-bold">
            {expediente ? expediente.codigoExpediente : "Detalle de Expediente"}
          </h1>
          {expediente && (
            <p className="mt-1 text-sm text-slate-500">{expediente.asunto}</p>
          )}
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-8">
        {cargandoExpediente && (
          <p className="text-sm text-slate-500">Cargando expediente…</p>
        )}

        {!cargandoExpediente && !expediente && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            No se encontró el expediente solicitado.
          </p>
        )}

        {expediente && (
          <div className="mb-8 grid gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Solicitante
              </p>
              <p className="text-sm text-slate-800">
                {expediente.solicitante.nombreOrazonSocial} (
                {expediente.solicitante.tipoDocumento}{" "}
                {expediente.solicitante.numeroDocumento})
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Estado actual
              </p>
              <p className="text-sm text-slate-800">
                {ETIQUETAS_ESTADO_FLUJO[expediente.estadoFlujo]}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Serie CCD
              </p>
              <p className="text-sm text-slate-800">
                {expediente.clasificacionCCD.serieDocumental}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Área actual
              </p>
              <p className="text-sm text-slate-800">{expediente.areaActual}</p>
            </div>
          </div>
        )}

        <ExpedienteTimeline eventos={eventos ?? []} cargando={cargandoTimeline} />
      </section>
    </main>
  );
}
