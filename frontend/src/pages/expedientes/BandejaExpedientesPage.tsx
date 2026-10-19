import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatearFechaRadicacion, NOMBRES_PESTANA, PESTANAS_RUTADOC, useBandejaRutaDoc, type PestanaRutaDoc } from "../../hooks/useRutaDocExpedientes";
import BandejaExpedientesMockPage from "./BandejaExpedientesMockPage";

export default function BandejaExpedientesPage() {
  return import.meta.env.VITE_ENABLE_MOCKS === "true"
    ? <BandejaExpedientesMockPage />
    : <BandejaExpedientesConectada />;
}

function BandejaExpedientesConectada() {
  const navigate = useNavigate();
  const [pestana, setPestana] = useState<PestanaRutaDoc>("PENDIENTES");
  const [busqueda, setBusqueda] = useState("");
  const [termino, setTermino] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [cursores, setCursores] = useState<(string | undefined)[]>([undefined]);

  useEffect(() => {
    const temporizador = window.setTimeout(() => setTermino(busqueda.trim()), 300);
    return () => window.clearTimeout(temporizador);
  }, [busqueda]);

  const fechasInvalidas = Boolean(fechaDesde && fechaHasta && fechaDesde > fechaHasta);
  const consulta = useBandejaRutaDoc({
    pestana, limite: 20,
    ...(termino ? { terminoBusqueda: termino } : {}),
    ...(fechaDesde ? { fechaDesde } : {}),
    ...(fechaHasta ? { fechaHasta } : {}),
    ...(cursores.at(-1) ? { cursor: cursores.at(-1) } : {}),
  }, !fechasInvalidas);

  function cambiarFiltro(actualizar: () => void) {
    actualizar();
    setCursores([undefined]);
  }

  return <main className="min-h-screen bg-slate-100 p-6 text-slate-900"><div className="mx-auto max-w-7xl space-y-5">
    <header><button type="button" onClick={() => navigate("/")} className="text-sm text-blue-700">← Inicio</button>
      <h1 className="mt-3 text-2xl font-bold">Bandeja de expedientes</h1></header>
    <div role="tablist" aria-label="Bandejas de expedientes" className="flex flex-wrap gap-2">
      {PESTANAS_RUTADOC.map((opcion) => <button key={opcion} type="button" role="tab" aria-selected={pestana === opcion}
        onClick={() => cambiarFiltro(() => setPestana(opcion))}
        className={`rounded-lg px-4 py-2 text-sm ${pestana === opcion ? "bg-blue-700 text-white" : "bg-white text-slate-700"}`}>
        {NOMBRES_PESTANA[opcion]} ({consulta.data?.contadores[opcion] ?? 0})</button>)}
    </div>
    <section aria-label="Filtros de expedientes" className="flex flex-wrap gap-3 rounded-xl bg-white p-4">
      <label className="flex flex-col gap-1 text-sm">CUT o asunto<input type="search" value={busqueda}
        onChange={(evento) => cambiarFiltro(() => setBusqueda(evento.target.value))} className="rounded border px-3 py-2" /></label>
      <label className="flex flex-col gap-1 text-sm">Desde<input type="date" value={fechaDesde}
        onChange={(evento) => cambiarFiltro(() => setFechaDesde(evento.target.value))} className="rounded border px-3 py-2" /></label>
      <label className="flex flex-col gap-1 text-sm">Hasta<input type="date" value={fechaHasta}
        onChange={(evento) => cambiarFiltro(() => setFechaHasta(evento.target.value))} className="rounded border px-3 py-2" /></label>
    </section>
    {fechasInvalidas && <p role="alert" className="text-sm text-red-700">La fecha final debe ser igual o posterior a la inicial.</p>}
    {!fechasInvalidas && consulta.isPending && <p role="status">Cargando expedientes…</p>}
    {!fechasInvalidas && consulta.isError && <div role="alert" className="rounded-xl bg-white p-5 text-red-700">
      No se pudo cargar la bandeja. <button type="button" onClick={() => void consulta.refetch()} className="underline">Reintentar</button></div>}
    {!fechasInvalidas && consulta.data && !consulta.isError && <>
      {consulta.data.elementos.length === 0 ? <p role="status" className="rounded-xl bg-white p-8">No hay expedientes con estos filtros.</p> :
        <div className="overflow-x-auto rounded-xl bg-white"><table className="min-w-full text-left text-sm">
          <thead><tr className="border-b"><th className="p-3">CUT</th><th className="p-3">Asunto</th><th className="p-3">Estado</th><th className="p-3">Radicación</th><th className="p-3">Acción</th></tr></thead>
          <tbody>{consulta.data.elementos.map((expediente) => <tr key={expediente.idExpediente} className="border-b">
            <td className="p-3 font-mono">{expediente.cut}</td><td className="p-3">{expediente.asunto}</td>
            <td className="p-3">{expediente.estadoActual}</td><td className="p-3">{formatearFechaRadicacion(expediente.fechaRadicacion)}</td>
            <td className="p-3"><button type="button" className="text-blue-700 underline" onClick={() => navigate(`/expedientes/${expediente.idExpediente}`)}>Ver detalle</button></td>
          </tr>)}</tbody></table></div>}
      <nav aria-label="Paginación de expedientes" className="flex items-center gap-3 text-sm">
        <button type="button" disabled={cursores.length === 1} onClick={() => setCursores((actuales) => actuales.slice(0, -1))}>Anterior</button>
        <span>Página {cursores.length}</span>
        <button type="button" disabled={!consulta.data.tieneMas || !consulta.data.siguienteCursor}
          onClick={() => setCursores((actuales) => [...actuales, consulta.data!.siguienteCursor!])}>Siguiente</button>
      </nav>
    </>}
  </div></main>;
}
