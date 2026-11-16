import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { consultarCatalogo, informacionPublicada, type ProcedimientoOrientacion } from '../../features/asistente/catalogo';
import { normalizarPregunta } from '../../features/asistente/intenciones';

export default function CatalogoOrientacion() {
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'error'>('cargando');
  const [procedimientos, setProcedimientos] = useState<ProcedimientoOrientacion[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [seleccionado, setSeleccionado] = useState('');
  const [intento, setIntento] = useState(0);
  const id = useId();

  useEffect(() => {
    const controller = new AbortController();
    consultarCatalogo(controller.signal).then((datos) => {
      if (!controller.signal.aborted) { setProcedimientos(datos); setEstado('listo'); }
    }).catch(() => {
      if (!controller.signal.aborted) setEstado('error');
    });
    return () => controller.abort();
  }, [intento]);

  const visibles = procedimientos.filter((item) =>
    normalizarPregunta(`${item.codigo} ${item.denominacion}`).includes(normalizarPregunta(busqueda)));
  const procedimiento = procedimientos.find((item) => item.id === seleccionado);
  const info = procedimiento && informacionPublicada(procedimiento);

  if (estado === 'cargando') return <p role="status">Consultando el catálogo institucional…</p>;
  if (estado === 'error') return (
    <div role="alert">
      <p>No se pudo consultar el catálogo institucional. No mostraré procedimientos de reemplazo.</p>
      <button type="button" className="sigd-assistant-link" onClick={() => {
        setEstado('cargando'); setIntento((valor) => valor + 1);
      }}>Reintentar catálogo</button>
    </div>
  );
  if (!procedimientos.length) return <p role="status">El catálogo no informa procedimientos Suiza 2026 vigentes.</p>;

  return (
    <div className="sigd-assistant-catalogo">
      <label htmlFor={`${id}-buscar`}>Buscar procedimiento</label>
      <input id={`${id}-buscar`} type="search" maxLength={120} value={busqueda}
        placeholder="Nombre o código del trámite" onChange={(event) => setBusqueda(event.target.value)} />
      <label htmlFor={`${id}-seleccionar`}>Procedimiento TUPA vigente</label>
      <select id={`${id}-seleccionar`} value={seleccionado} onChange={(event) => setSeleccionado(event.target.value)}>
        <option value="">Selecciona un procedimiento</option>
        {visibles.map((item) => <option key={item.id} value={item.id}>{item.codigo} — {item.denominacion}</option>)}
      </select>
      {!visibles.length && <p role="status">No hay coincidencias en el catálogo formal.</p>}
      {procedimiento && info && (
        <div className="sigd-assistant-procedimiento" role="region" aria-label="Información del procedimiento" aria-live="polite">
          <strong>{procedimiento.codigo} — {procedimiento.denominacion}</strong>
          <p>{info.detalle}</p>
          <dl>
            <dt>Derecho de pago publicado</dt><dd>{info.costo}</dd>
            <dt>Plazo de atención</dt><dd>{info.plazo}</dd>
          </dl>
          <strong>Documentos clasificados en el catálogo</strong>
          {procedimiento.tipos_documentales?.length ? <ul>
            {procedimiento.tipos_documentales.map((documento, indice) => <li key={`${documento.codigo}-${indice}`}>
              {documento.nombre} — {documento.obligatorio === true ? 'obligatorio' : documento.obligatorio === false ? 'opcional' : 'obligatoriedad no informada'}
            </li>)}
          </ul> : <p>No hay clasificación documental publicada. Esto no significa que no existan requisitos; consulta al canal institucional antes de presentar la solicitud.</p>}
          <p>El pago de una tasa y la obligación de adjuntar su comprobante digital son condiciones distintas. No se deduce una de la otra.</p>
          <p className="sigd-assistant-fuente">Fuente: {info.fuente}</p>
          {info.pendienteInstitucional && <p>El catálogo indica que este procedimiento está pendiente de validación institucional. La orientación no acredita su aprobación.</p>}
          <Link className="sigd-assistant-link" to="/tramite">Ir a Mesa de Partes Virtual</Link>
        </div>
      )}
    </div>
  );
}
