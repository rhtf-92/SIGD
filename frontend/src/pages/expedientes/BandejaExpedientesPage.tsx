import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import BandejaTabFilter from "../../components/expedientes/BandejaTabFilter";
import ExpedienteTable from "../../components/expedientes/ExpedienteTable";
import { useBandejaExpedientes } from "../../hooks/useBandejaExpedientes";
import type { Filtros } from "./rutadoc/rutadoc.dto";
import RutaDocEstado from "./rutadoc/RutaDocEstado";

export default function BandejaExpedientesPage() {
  const navigate = useNavigate();
  const [filtros, setFiltros] = useState<Filtros>({ pestana: "PENDIENTES", limite: 20 });
  const [anteriores, setAnteriores] = useState<(string | undefined)[]>([]);
  const consulta = useBandejaExpedientes(filtros);
  function filtrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const datos = new FormData(event.currentTarget);
    const texto = (nombre: string) => String(datos.get(nombre) ?? "").trim() || undefined;
    setAnteriores([]);
    setFiltros({ pestana: filtros.pestana, limite: Number(datos.get("limite")),
      terminoBusqueda: texto("terminoBusqueda"), areaId: texto("areaId"),
      fechaDesde: texto("fechaDesde"), fechaHasta: texto("fechaHasta") });
  }

  const handleVolver = () => {
    if (typeof window !== "undefined" && window.history.length > 1 && window.history.state?.idx > 0) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  return <main className="mx-auto max-w-7xl space-y-6 p-6">
    <button type="button" className="rounded px-2 py-1 text-blue-800 underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700" onClick={handleVolver}>← Volver</button>
    <h1 className="text-2xl font-bold">Bandeja de expedientes</h1>
    <form onSubmit={filtrar} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 [&_label]:flex [&_label]:min-w-0 [&_label]:flex-col [&_label]:gap-1 [&_input]:min-w-0 [&_input]:w-full [&_input]:rounded [&_input]:border [&_input]:border-slate-500 [&_input]:bg-white [&_input]:px-3 [&_input]:py-2 [&_select]:w-full [&_select]:rounded [&_select]:border [&_select]:border-slate-500 [&_select]:bg-white [&_select]:px-3 [&_select]:py-2 [&_input:focus-visible]:outline-2 [&_input:focus-visible]:outline-offset-2 [&_input:focus-visible]:outline-blue-700 [&_select:focus-visible]:outline-2 [&_select:focus-visible]:outline-offset-2 [&_select:focus-visible]:outline-blue-700">
      <label>Buscar CUT o asunto<input name="terminoBusqueda" maxLength={100} type="search" /></label>
      <label>Área UUID<input name="areaId" /></label>
      <label>Desde<input name="fechaDesde" type="date" /></label>
      <label>Hasta<input name="fechaHasta" type="date" /></label>
      <label>Por página<select name="limite" defaultValue="20"><option>1</option><option>20</option><option>50</option><option>100</option></select></label>
      <button type="submit" className="self-end rounded border border-blue-800 bg-blue-800 px-4 py-2 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">Aplicar filtros</button>
    </form>
    <BandejaTabFilter estadoActivo={filtros.pestana} conteos={consulta.data?.contadores}
      estadoConteos={consulta.isPending ? "cargando" : consulta.isError ? "error" : "disponible"}
      onCambiarEstado={pestana => { setAnteriores([]); setFiltros(f => ({ ...f, pestana, cursor: undefined })); }} />
    <RutaDocEstado pendiente={consulta.isPending} error={consulta.error} reintentar={() => { void consulta.refetch(); }}>
      {consulta.data && <>
        <ExpedienteTable expedientes={consulta.data.elementos}
          onVerExpediente={e => navigate(`/expedientes/${encodeURIComponent(e.idExpediente)}`)} />
        <nav aria-label="Paginación" className="flex gap-4 [&_button]:rounded [&_button]:border [&_button]:border-slate-500 [&_button]:px-3 [&_button]:py-2 [&_button]:text-slate-900 [&_button:disabled]:cursor-not-allowed [&_button:disabled]:bg-slate-100 [&_button:disabled]:text-slate-600 [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-offset-2 [&_button:focus-visible]:outline-blue-700">
          <button type="button" disabled={!anteriores.length} onClick={() => {
            const copia = [...anteriores]; const cursor = copia.pop();
            setAnteriores(copia); setFiltros(f => ({ ...f, cursor }));
          }}>Anterior</button>
          <button type="button" disabled={!consulta.data.tieneMas || consulta.isFetching} onClick={() => {
            const cursor = consulta.data?.siguienteCursor;
            if (!cursor) return;
            setAnteriores(a => [...a, filtros.cursor]); setFiltros(f => ({ ...f, cursor }));
          }}>Siguiente</button>
        </nav>
      </>}
    </RutaDocEstado>
  </main>;
}
