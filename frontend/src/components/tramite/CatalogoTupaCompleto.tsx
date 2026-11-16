import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '../../api/client';
import type { ConceptoTupaMesaPartes } from '../../data/catalogoTupaMesaPartes';

/** Catálogo de consulta. No habilita por sí mismo un servicio para radicación formal. */
export function CatalogoTupaCompleto({
  codigosRadicables,
  onSeleccionarRadicable,
}: {
  codigosRadicables: ReadonlySet<string>;
  onSeleccionarRadicable: (codigoInterno: string) => void;
}) {
  const [catalogo, setCatalogo] = useState<ConceptoTupaMesaPartes[]>([]);
  const [errorCatalogo, setErrorCatalogo] = useState(false);
  const [cargandoCatalogo, setCargandoCatalogo] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState('Todos');
  const [seleccion, setSeleccion] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    apiClient.get<unknown>('/api/v1/tramites/catalogo-tupa-2026', { signal: controller.signal })
      .then(({ data }) => {
        if (!Array.isArray(data) || data.length !== 72 || data.some((item) => !item || typeof item !== 'object' ||
          !('codigoInterno' in item) || typeof item.codigoInterno !== 'string' ||
          !('nombre' in item) || typeof item.nombre !== 'string' ||
          !('rubro' in item) || typeof item.rubro !== 'string' ||
          !('paginaFuente' in item) || typeof item.paginaFuente !== 'number' ||
          !('costoFuente' in item) || typeof item.costoFuente !== 'string')) {
          throw new Error('Catálogo TUPA inválido');
        }
        setCatalogo(data as ConceptoTupaMesaPartes[]);
      })
      .catch(() => { if (!controller.signal.aborted) setErrorCatalogo(true); })
      .finally(() => { if (!controller.signal.aborted) setCargandoCatalogo(false); });
    return () => controller.abort();
  }, []);
  const categorias = useMemo(() => ['Todos', ...new Set(catalogo.map((item) => item.rubro))], [catalogo]);
  const items = useMemo(() => {
    const normalizar = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es-PE');
    const query = normalizar(busqueda.trim());
    return catalogo.filter((item) =>
      (categoria === 'Todos' || item.rubro === categoria) &&
      (!query || normalizar(`${item.nombre} ${item.codigoVisible ?? ""} ${item.numeroVisible ?? ""} ${item.codigoInterno} ${item.rubro}`).includes(query)));
  }, [catalogo, busqueda, categoria]);
  const seleccionado = catalogo.find((item) => item.codigoInterno === seleccion);

  return (
    <section aria-labelledby="catalogo-tupa-title" className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id="catalogo-tupa-title" className="text-base font-bold text-slate-900">Catálogo TUPA 2026</h3>
          <p className="mt-1 text-xs text-slate-600">72 filas del tarifario institucional, organizadas por rubro. Los códigos mostrados son referencias internas.</p>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">{items.length} conceptos</span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,0.7fr)]">
        <label className="block text-xs font-semibold text-slate-700">
          Buscar por nombre o código interno
          <input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal" placeholder="Ej. certificado, traslado, SUZ26-001, 072" />
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          Rubro
          <select value={categoria} onChange={(event) => setCategoria(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal">
            {categorias.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
      </div>
      {cargandoCatalogo && <p role="status" className="mt-3 text-sm text-slate-600">Cargando catálogo TUPA…</p>}
      {errorCatalogo && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">No se pudo consultar el catálogo TUPA. Reintente más tarde.</p>}
      {!cargandoCatalogo && !errorCatalogo && <div className="mt-3 max-h-64 overflow-auto rounded-lg border border-slate-200 bg-white" role="listbox" aria-label="72 conceptos del TUPA Suiza 2026">
        {items.map((item) => (
          <button key={item.codigoInterno} type="button" role="option" aria-selected={seleccion === item.codigoInterno}
            onClick={() => setSeleccion(item.codigoInterno)}
            className={`flex w-full items-start justify-between gap-3 border-b border-slate-100 px-3 py-2.5 text-left last:border-b-0 hover:bg-blue-50 ${seleccion === item.codigoInterno ? 'bg-blue-50' : ''}`}>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-slate-900">{item.nombre}</span>
              <span className="mt-0.5 block text-xs text-slate-500">{item.rubro} · {item.codigoVisible ?? item.codigoInterno}</span>
            </span>
            <span className="shrink-0 text-right text-xs font-semibold text-slate-700">{item.costoFuente}</span>
          </button>
        ))}
        {items.length === 0 && <p className="p-4 text-sm text-slate-600">No hay coincidencias para esta búsqueda.</p>}
      </div>}
      {seleccionado && (
        <div className="mt-3 rounded-lg border border-blue-100 bg-white p-3 text-sm" aria-live="polite">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h4 className="font-semibold text-slate-900">{seleccionado.nombre}</h4>
              <p className="mt-1 text-xs text-slate-600">Fuente: TUPA 2026 del IESTP Suiza, página {seleccionado.paginaFuente}. La fuente no imprime códigos SUZ26; la referencia es interna.</p>
            </div>
            {codigosRadicables.has(seleccionado.codigoInterno) && <button type="button" onClick={() => onSeleccionarRadicable(seleccionado.codigoInterno)} className="rounded-lg bg-[#006EC7] px-3 py-2 text-xs font-semibold text-white">Usar en radicación formal</button>}
          </div>
          {seleccionado.detallesTarifa.length > 0 && <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-700">{seleccionado.detallesTarifa.map((detail) => <li key={detail}>{detail}</li>)}</ul>}
          {!codigosRadicables.has(seleccionado.codigoInterno) && <p className="mt-2 rounded-md bg-amber-50 p-2 text-xs text-amber-900">Este concepto está disponible para consulta en el catálogo, pero no tiene configuración de radicación formal en el backend. Su modalidad debe ser validada institucionalmente antes de crear expedientes, requisitos u órdenes de pago.</p>}
          {seleccionado.codigoInterno === 'SUZ26-068' && <p className="mt-2 rounded-md bg-amber-50 p-2 text-xs text-amber-900">La fuente presenta S/ 10.50 en la columna de monto y S/ 10.00 por hoja en el concepto; no se determina su relación. No se habilita como orden de pago hasta aclaración institucional.</p>}
        </div>
      )}
    </section>
  );
}
