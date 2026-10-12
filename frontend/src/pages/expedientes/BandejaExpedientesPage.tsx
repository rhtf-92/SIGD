import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useBandejaRutaDoc, PESTANAS_RUTADOC, type PestanaRutaDoc } from '../../hooks/useBandejaRutaDoc';
import { useAuthStore } from '../../stores/authStore';
import { ApiHttpError } from '../../types/api';

export default function BandejaExpedientesPage() {
  const usuario = useAuthStore(s => s.usuario);
  const [pestana, setPestana] = useState<PestanaRutaDoc>('PENDIENTES');
  const [busqueda, setBusqueda] = useState('');
  const [termino, setTermino] = useState('');
  const [desde, setDesde] = useState(''), [hasta, setHasta] = useState('');
  const [cursores, setCursores] = useState<(string | undefined)[]>([undefined]);
  const consulta = useBandejaRutaDoc({ pestana, terminoBusqueda: termino || undefined,
    fechaDesde: desde || undefined, fechaHasta: hasta || undefined, cursor: cursores.at(-1) });
  function buscar(e: FormEvent) { e.preventDefault(); setTermino(busqueda.trim()); setCursores([undefined]); }
  function cambiarPestana(p: PestanaRutaDoc) { setPestana(p); setCursores([undefined]); }
  if (!usuario) return <main className="p-8"><h1>Bandeja de Trabajo Diario</h1><Link to="/login">Iniciar sesión</Link></main>;
  return <main className="min-h-screen bg-slate-100 text-slate-900">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto max-w-7xl px-6 py-5">
      <Link to="/" className="mb-4 inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">← Volver al inicio</Link><p className="text-sm font-bold text-blue-700">SIGD · IESTP "Suiza"</p>
      <h1 className="text-2xl font-bold">Bandeja de Trabajo Diario</h1><p className="mt-1 text-sm text-slate-500">Gestión operativa de expedientes y seguimiento de su tramitación.</p>
    </div></header><div className="mx-auto max-w-7xl space-y-5 px-6 py-8"><div className="grid gap-4 sm:grid-cols-3">{([ ["Volumen Activo", consulta.data ? ["PENDIENTES","EN_TRAMITE","DERIVADOS","POR_FIRMAR"].reduce((n,p)=>n+consulta.data!.contadores[p as PestanaRutaDoc],0) : undefined], ["Pendientes",consulta.data?.contadores.PENDIENTES], ["En trámite",consulta.data?.contadores.EN_TRAMITE] ] as const).map(([label,value])=><div key={label} className="rounded-xl border border-slate-200 bg-white p-5 text-center shadow-sm"><p className="text-3xl font-bold text-blue-700">{value ?? "—"}</p><p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p></div>)}</div>
      <form onSubmit={buscar} className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <label>Buscar por CUT o asunto<input type="search" maxLength={100} value={busqueda}
          onChange={e=>setBusqueda(e.target.value)} className="block rounded border p-2"/></label>
        <button className="rounded bg-blue-700 p-2 text-white">Buscar</button>
        <label>Fecha desde<input type="date" value={desde} max={hasta || undefined} onChange={e=>{setDesde(e.target.value);setCursores([undefined]);}} className="block rounded border p-2"/></label>
        <label>Fecha hasta<input type="date" value={hasta} min={desde || undefined} onChange={e=>{setHasta(e.target.value);setCursores([undefined]);}} className="block rounded border p-2"/></label>
        <button type="button" onClick={()=>{setBusqueda('');setTermino('');setDesde('');setHasta('');setCursores([undefined]);}} className="rounded border p-2">Limpiar filtros</button>
      </form>
      <div role="tablist" aria-label="Estados de la bandeja" className="flex flex-wrap gap-2">
        {(Object.keys(PESTANAS_RUTADOC) as PestanaRutaDoc[]).map(p=><button key={p} role="tab" aria-selected={p===pestana}
          onClick={()=>cambiarPestana(p)} className={p===pestana?'rounded-lg border border-blue-700 bg-blue-700 px-4 py-3 text-sm font-semibold text-white':'rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50'}>
          {PESTANAS_RUTADOC[p]} {consulta.data?.contadores[p] ?? '—'}
        </button>)}
      </div>
      {consulta.isPending && <p role="status">Cargando expedientes…</p>}
      {consulta.isError && <section role="alert" className="rounded border border-red-300 p-4">
        <p>Ocurrió un error al cargar los expedientes: {consulta.error.message}</p>
        {consulta.error instanceof ApiHttpError && <p>HTTP {consulta.error.status}. Referencia: {consulta.error.correlationId}</p>}
        <button onClick={()=>void consulta.refetch()} className="mt-2 rounded border p-2">Reintentar</button>
      </section>}
      {consulta.data && !consulta.isError && <section aria-label="Expedientes" className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>
          {['CUT','Asunto','Estado','Fecha de radicación','Acciones'].map(t=><th key={t} className="p-4">{t}</th>)}
        </tr></thead><tbody>{consulta.data.elementos.map(e=><tr key={e.idExpediente} className="border-t border-slate-100 hover:bg-slate-50">
          <td className="p-4 font-mono">{e.cut}</td><td className="p-4">{e.asunto}</td><td className="p-4">{e.estadoActual}</td>
          <td className="p-4">{new Date(e.fechaRadicacion).toLocaleString('es-PE')}</td>
          <td className="p-4"><Link className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 font-semibold text-blue-700" to={'/expedientes/'+e.idExpediente}>Ver expediente</Link></td>
        </tr>)}</tbody></table>
        {!consulta.data.elementos.length && <p className="p-6">No hay expedientes en esta pestaña con los filtros aplicados.</p>}
      </section>}
      <nav aria-label="Paginación" className="flex items-center gap-4">
        <button disabled={consulta.isFetching || cursores.length===1} onClick={()=>setCursores(c=>c.slice(0,-1))} className="rounded border p-2 disabled:opacity-50">Anterior</button>
        <span>Página {cursores.length}</span>
        <button disabled={consulta.isFetching || !consulta.data?.siguienteCursor} onClick={()=>{
          if(consulta.data?.siguienteCursor)setCursores(c=>[...c,consulta.data!.siguienteCursor!]);
        }} className="rounded border p-2 disabled:opacity-50">Siguiente</button>
      </nav>
    </div>
  </main>;
}
