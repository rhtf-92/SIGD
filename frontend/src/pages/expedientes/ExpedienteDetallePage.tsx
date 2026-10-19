import { useNavigate, useParams } from "react-router-dom";
import { formatearFechaRadicacion, useDetalleRutaDoc, useTrazabilidadRutaDoc } from "../../hooks/useRutaDocExpedientes";
import CcdFoliadoConectado from "../../components/expedientes/CcdFoliadoConectado";
import { env } from "../../config/env";
import ExpedienteDetalleMockPage from "./ExpedienteDetalleMockPage";

export default function ExpedienteDetallePage() {
  return import.meta.env.VITE_ENABLE_MOCKS === "true"
    ? <ExpedienteDetalleMockPage />
    : <ExpedienteDetalleConectado />;
}

function ExpedienteDetalleConectado() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const consulta = useDetalleRutaDoc(id);
  const trazabilidad = useTrazabilidadRutaDoc(consulta.data ? id : undefined);
  const expediente = consulta.data;

  return <main className="min-h-screen bg-slate-100 p-6 text-slate-900"><div className="mx-auto max-w-4xl space-y-5">
    <button type="button" onClick={() => navigate("/expedientes")} className="text-sm text-blue-700">← Volver a la bandeja</button>
    <h1 className="text-2xl font-bold">{expediente?.cut ?? "Detalle de expediente"}</h1>
    {consulta.isPending && <p role="status">Cargando expediente…</p>}
    {consulta.isError && <div role="alert" className="rounded-xl bg-white p-5 text-red-700">
      No se pudo consultar el expediente o no tiene permiso para verlo. <button type="button" onClick={() => void consulta.refetch()} className="underline">Reintentar</button>
    </div>}
    {expediente && <section className="rounded-xl bg-white p-6"><h2 className="mb-4 text-lg font-semibold">Datos del expediente</h2>
      <dl className="grid gap-4 sm:grid-cols-2">
        <div><dt className="text-sm text-slate-500">Asunto</dt><dd>{expediente.asunto}</dd></div>
        <div><dt className="text-sm text-slate-500">Estado</dt><dd>{expediente.estadoActual}</dd></div>
        <div><dt className="text-sm text-slate-500">Fecha de radicación (UTC)</dt><dd>{formatearFechaRadicacion(expediente.fechaRadicacion)}</dd></div>
        <div><dt className="text-sm text-slate-500">Área actual</dt><dd>{expediente.areaActualId ?? "Sin dato"}</dd></div>
        <div><dt className="text-sm text-slate-500">Documentos</dt><dd>{expediente.resumenDocumentos?.cantidadDocumentos ?? "Sin dato"}</dd></div>
        <div><dt className="text-sm text-slate-500">Folios</dt><dd>{expediente.resumenDocumentos?.totalFolios ?? "Sin dato"}</dd></div>
      </dl>
      {expediente.ultimoMovimiento && <div className="mt-6 border-t pt-4">
        <h3 className="font-semibold">Último movimiento</h3>
        <p className="text-sm">{expediente.ultimoMovimiento.evento} · {new Date(expediente.ultimoMovimiento.fechaHora).toLocaleString("es-PE")}</p>
      </div>}
    </section>}
    {expediente && <section className="rounded-xl bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold">Hoja de ruta y trazabilidad</h2>
      {trazabilidad.isPending && <p role="status">Cargando trazabilidad…</p>}
      {trazabilidad.isError && <p role="alert" className="text-red-700">No se pudo cargar la trazabilidad del expediente.</p>}
      {trazabilidad.data?.length === 0 && <p role="status">Este expediente todavía no registra movimientos.</p>}
      {trazabilidad.data && <ol className="space-y-3">{trazabilidad.data.map((actuacion) => <li key={actuacion.movimientoId} className="border-l-2 border-blue-600 pl-3 text-sm">
        <strong>{actuacion.evento}</strong> · {new Date(actuacion.fechaHora).toLocaleString("es-PE")}
        <p>{actuacion.estadoAnterior} → {actuacion.estadoNuevo}</p>
      </li>)}</ol>}
    </section>}
    {expediente && id && <CcdFoliadoConectado baseUrl={env.apiBaseUrl} expedienteId={id} />}
  </div></main>;
}
