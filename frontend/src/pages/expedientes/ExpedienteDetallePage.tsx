import { useNavigate, useParams } from "react-router-dom";

import ExpedienteTimeline from "../../components/expedientes/ExpedienteTimeline";
import ExpedienteClasificacion from "../../components/expedientes/ExpedienteClasificacion";
import ExpedienteMetadatos from "../../components/expedientes/ExpedienteMetadatos";
import ExpedienteVersiones from "../../components/expedientes/ExpedienteVersiones";
import { useExpedientesBase } from "../../hooks/useBandejaExpedientes";
import { useExpedienteTimeline } from "../../hooks/useExpedienteTimeline";

export default function ExpedienteDetallePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: expedientes, isLoading: cargandoExpediente, isError: errorExpediente } =
    useExpedientesBase();
  const expediente = expedientes?.find((exp) => exp.id === id);

  const { data: eventos, isLoading: cargandoTimeline, isError: errorTimeline } =
    useExpedienteTimeline(id);

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-5">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="mb-4 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            ← Volver al inicio
          </button>

          <p className="text-sm font-bold text-blue-700">SIGD</p>
          <h1 className="break-words text-2xl font-bold">
            {expediente ? expediente.codigoExpediente : "Detalle de Expediente"}
          </h1>
          {expediente && (
            <p className="mt-1 text-sm text-slate-500">{expediente.asunto}</p>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        {cargandoExpediente && (
          <p className="text-sm text-slate-500">Cargando expediente…</p>
        )}

        {errorExpediente && <p role="alert" className="rounded-xl border border-red-200 bg-white p-6 text-sm text-red-800">No se pudo cargar el expediente. Vuelve a la bandeja e inténtalo nuevamente.</p>}

        {!cargandoExpediente && !errorExpediente && !expediente && (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
            No se encontró el expediente solicitado.
          </p>
        )}

        {expediente && (
          <>
            <ExpedienteMetadatos expediente={expediente} />
            <ExpedienteClasificacion clasificacion={expediente.clasificacionCCD} />
            <ExpedienteVersiones versiones={expediente.versionesDocumentos} />
            {errorTimeline ? <p role="alert" className="rounded-xl border border-red-200 bg-white p-6 text-sm text-red-800">No se pudo cargar la Hoja de Ruta y Trazabilidad.</p> : <ExpedienteTimeline eventos={eventos ?? []} cargando={cargandoTimeline} />}
          </>
        )}

      </div>
    </main>
  );
}
