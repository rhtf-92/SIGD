import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  listarMisEvaluaciones,
  iniciarEvaluacion,
  obtenerDetalleEvaluacion,
  marcarRequisitoEvaluacion,
  registrarObservacionEvaluacion,
  reanudarEvaluacionDocente,
  emitirDictamenDocente,
  type EvaluacionBandejaDocenteItem,
  type ResumenBandejaDocente,
  type DetalleEvaluacionRespuesta,
} from '../../api/evaluadoresApi';
import { useAuthStore } from '../../stores/authStore';

export default function BandejaDocentePage() {
  const navigate = useNavigate();
  const { usuario } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [evaluaciones, setEvaluaciones] = useState<EvaluacionBandejaDocenteItem[]>([]);
  const [resumen, setResumen] = useState<ResumenBandejaDocente>({
    nuevos: 0,
    enEvaluacion: 0,
    observados: 0,
    subsanados: 0,
    concluidos: 0,
  });

  const [filtroEstado, setFiltroEstado] = useState<string>('TODOS');
  const [busqueda, setBusqueda] = useState('');

  // Modal de Detalle / Evaluación Documental
  const [modalDetalleAbierto, setModalDetalleAbierto] = useState(false);
  const [detalleCargando, setDetalleCargando] = useState(false);
  const [detalleActivo, setDetalleActivo] = useState<DetalleEvaluacionRespuesta | null>(null);
  const [expedienteSeleccionadoId, setExpedienteSeleccionadoId] = useState<string | null>(null);

  // Modal de Observación
  const [modalObservarAbierto, setModalObservarAbierto] = useState(false);
  const [motivoObs, setMotivoObs] = useState('');
  const [sustentoObs, setSustentoObs] = useState('');
  const [plazoObs, setPlazoObs] = useState<number>(5);
  const [guardandoObs, setGuardandoObs] = useState(false);

  // Modal de Dictamen
  const [modalDictamenAbierto, setModalDictamenAbierto] = useState(false);
  const [resultadoDictamen, setResultadoDictamen] = useState<'FAVORABLE' | 'DESFAVORABLE'>('FAVORABLE');
  const [fundamentacionDictamen, setFundamentacionDictamen] = useState('');
  const [recomendacionesDictamen, setRecomendacionesDictamen] = useState('');
  const [guardandoDictamen, setGuardandoDictamen] = useState(false);

  const cargarBandeja = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await listarMisEvaluaciones({
        limite: 100,
        offset: 0,
      });
      setEvaluaciones(res.evaluaciones);
      setResumen(res.resumen);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cargar las evaluaciones asignadas.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void cargarBandeja();
  }, []);

  const evaluacionesFiltradas = useMemo(() => {
    return evaluaciones.filter((item) => {
      const matchBusqueda =
        busqueda === '' ||
        item.codigoExpediente.toLowerCase().includes(busqueda.toLowerCase()) ||
        item.asunto.toLowerCase().includes(busqueda.toLowerCase()) ||
        item.solicitanteNombre.toLowerCase().includes(busqueda.toLowerCase());

      if (!matchBusqueda) return false;

      if (filtroEstado === 'NUEVOS') return item.estadoEvaluacion === 'PENDIENTE';
      if (filtroEstado === 'EN_EVALUACION') return item.estadoEvaluacion === 'EN_EVALUACION';
      if (filtroEstado === 'OBSERVADOS') return item.estadoExpediente === 'OBSERVADO';
      if (filtroEstado === 'SUBSANADOS') return item.estadoExpediente === 'SUBSANADO';
      if (filtroEstado === 'CONCLUIDOS') return item.estadoEvaluacion === 'CONCLUIDA';
      return true;
    });
  }, [evaluaciones, filtroEstado, busqueda]);

  const handleIniciar = async (expedienteId: string) => {
    try {
      await iniciarEvaluacion(expedienteId);
      await cargarBandeja();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'No se pudo iniciar la evaluación.');
    }
  };

  const handleReanudar = async (expedienteId: string) => {
    try {
      await reanudarEvaluacionDocente(expedienteId);
      await cargarBandeja();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'No se pudo reanudar la evaluación.');
    }
  };

  const abrirDetalle = async (expedienteId: string) => {
    try {
      setExpedienteSeleccionadoId(expedienteId);
      setDetalleCargando(true);
      setModalDetalleAbierto(true);
      const res = await obtenerDetalleEvaluacion(expedienteId);
      setDetalleActivo(res);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'No se pudo cargar el detalle del expediente.');
      setModalDetalleAbierto(false);
    } finally {
      setDetalleCargando(false);
    }
  };

  const handleToggleRequisito = async (requisitoId: string, valorActual: boolean) => {
    if (!expedienteSeleccionadoId) return;
    try {
      await marcarRequisitoEvaluacion(expedienteSeleccionadoId, requisitoId, !valorActual);
      if (detalleActivo) {
        setDetalleActivo({
          ...detalleActivo,
          requisitos: detalleActivo.requisitos.map((r) =>
            r.idRequisito === requisitoId ? { ...r, cumplido: !valorActual } : r,
          ),
        });
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al actualizar el requisito.');
    }
  };

  const handleEnviarObservacion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expedienteSeleccionadoId) return;
    if (motivoObs.trim().length < 10) {
      alert('El motivo debe tener al menos 10 caracteres.');
      return;
    }
    try {
      setGuardandoObs(true);
      await registrarObservacionEvaluacion(expedienteSeleccionadoId, {
        motivo: motivoObs.trim(),
        sustentoTecnico: sustentoObs.trim() || undefined,
        plazoDias: plazoObs,
      });
      setModalObservarAbierto(false);
      setModalDetalleAbierto(false);
      setMotivoObs('');
      setSustentoObs('');
      await cargarBandeja();
      alert('Observación formal registrada con éxito.');
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al registrar la observación.');
    } finally {
      setGuardandoObs(false);
    }
  };

  const handleEnviarDictamen = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expedienteSeleccionadoId) return;
    if (fundamentacionDictamen.trim().length < 10) {
      alert('La fundamentación debe tener al menos 10 caracteres.');
      return;
    }
    try {
      setGuardandoDictamen(true);
      await emitirDictamenDocente(expedienteSeleccionadoId, {
        resultado: resultadoDictamen,
        fundamentacion: fundamentacionDictamen.trim(),
        recomendaciones: recomendacionesDictamen.trim() || undefined,
      });
      setModalDictamenAbierto(false);
      setModalDetalleAbierto(false);
      setFundamentacionDictamen('');
      setRecomendacionesDictamen('');
      await cargarBandeja();
      alert(`Dictamen ${resultadoDictamen} emitido exitosamente.`);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error al emitir el dictamen.');
    } finally {
      setGuardandoDictamen(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Cabecera */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Bandeja de Calificación Técnica Docente
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Gestión de expedientes asignados, revisión documental, formulación de observaciones y dictámenes técnicos.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
              Docente: {usuario?.nombreCompleto || usuario?.correo || 'Evaluador Asignado'}
            </span>
            <button
              type="button"
              onClick={cargarBandeja}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              🔄 Actualizar
            </button>
          </div>
        </div>

        {/* Tarjetas KPI de Resumen */}
        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
          <button
            type="button"
            onClick={() => setFiltroEstado('NUEVOS')}
            className={`rounded-xl border p-4 text-left shadow-sm transition ${
              filtroEstado === 'NUEVOS' ? 'border-amber-500 bg-amber-50' : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
          >
            <p className="text-2xl font-bold text-amber-700">{resumen.nuevos}</p>
            <p className="mt-1 text-xs font-semibold uppercase text-slate-600">Nuevos Asignados</p>
          </button>

          <button
            type="button"
            onClick={() => setFiltroEstado('EN_EVALUACION')}
            className={`rounded-xl border p-4 text-left shadow-sm transition ${
              filtroEstado === 'EN_EVALUACION' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
          >
            <p className="text-2xl font-bold text-blue-700">{resumen.enEvaluacion}</p>
            <p className="mt-1 text-xs font-semibold uppercase text-slate-600">En Evaluación</p>
          </button>

          <button
            type="button"
            onClick={() => setFiltroEstado('OBSERVADOS')}
            className={`rounded-xl border p-4 text-left shadow-sm transition ${
              filtroEstado === 'OBSERVADOS' ? 'border-orange-500 bg-orange-50' : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
          >
            <p className="text-2xl font-bold text-orange-700">{resumen.observados}</p>
            <p className="mt-1 text-xs font-semibold uppercase text-slate-600">Observados</p>
          </button>

          <button
            type="button"
            onClick={() => setFiltroEstado('SUBSANADOS')}
            className={`rounded-xl border p-4 text-left shadow-sm transition ${
              filtroEstado === 'SUBSANADOS' ? 'border-purple-500 bg-purple-50' : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
          >
            <p className="text-2xl font-bold text-purple-700">{resumen.subsanados}</p>
            <p className="mt-1 text-xs font-semibold uppercase text-slate-600">Subsanados</p>
          </button>

          <button
            type="button"
            onClick={() => setFiltroEstado('CONCLUIDOS')}
            className={`rounded-xl border p-4 text-left shadow-sm transition ${
              filtroEstado === 'CONCLUIDOS' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
          >
            <p className="text-2xl font-bold text-emerald-700">{resumen.concluidos}</p>
            <p className="mt-1 text-xs font-semibold uppercase text-slate-600">Concluidos</p>
          </button>
        </div>

        {/* Barra de Filtros y Búsqueda */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex-1 max-w-md">
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por CUT, asunto o solicitante..."
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm shadow-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setFiltroEstado('TODOS')}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                filtroEstado === 'TODOS'
                  ? 'bg-slate-800 text-white'
                  : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
              }`}
            >
              Todos ({evaluaciones.length})
            </button>
          </div>
        </div>

        {/* Tabla de Evaluaciones */}
        {loading ? (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500">
            Cargando bandeja de expedientes asignados...
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            {error}
          </div>
        ) : evaluacionesFiltradas.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500">
            No se encontraron expedientes en la vista actual.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="px-4 py-3">CUT / Expediente</th>
                  <th className="px-4 py-3">Asunto y Administrado</th>
                  <th className="px-4 py-3">Área</th>
                  <th className="px-4 py-3">Estado Trámite</th>
                  <th className="px-4 py-3">Estado Evaluación</th>
                  <th className="px-4 py-3">Asignado el</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {evaluacionesFiltradas.map((item) => (
                  <tr key={item.idAsignacion} className="hover:bg-slate-50/80 transition">
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-blue-900">
                      {item.codigoExpediente}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900 line-clamp-1">{item.asunto}</p>
                      <p className="text-xs text-slate-500">{item.solicitanteNombre}</p>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                      {item.areaNombre || 'Área'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          item.estadoExpediente === 'EN_REVISION'
                            ? 'bg-blue-100 text-blue-800'
                            : item.estadoExpediente === 'OBSERVADO'
                            ? 'bg-orange-100 text-orange-800'
                            : item.estadoExpediente === 'SUBSANADO'
                            ? 'bg-purple-100 text-purple-800'
                            : item.estadoExpediente === 'ATENDIDO'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {item.estadoExpediente}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          item.estadoEvaluacion === 'PENDIENTE'
                            ? 'bg-amber-100 text-amber-800'
                            : item.estadoEvaluacion === 'EN_EVALUACION'
                            ? 'bg-blue-100 text-blue-800'
                            : item.estadoEvaluacion === 'CONCLUIDA'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {item.estadoEvaluacion}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                      {new Date(item.asignadoEn).toLocaleDateString()}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {item.estadoEvaluacion === 'PENDIENTE' && (
                          <button
                            type="button"
                            onClick={() => handleIniciar(item.expedienteId)}
                            className="rounded bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm hover:bg-amber-700"
                          >
                            📥 Confirmar Recepción
                          </button>
                        )}

                        {item.estadoExpediente === 'SUBSANADO' && (
                          <button
                            type="button"
                            onClick={() => handleReanudar(item.expedienteId)}
                            className="rounded bg-purple-600 px-2.5 py-1 text-xs font-semibold text-white shadow-sm hover:bg-purple-700"
                          >
                            🔄 Reanudar Revisión
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => abrirDetalle(item.expedienteId)}
                          className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                        >
                          👁️ Evaluar / Requisitos
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Detalle y Revisión Documental */}
      {modalDetalleAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            {detalleCargando ? (
              <div className="py-12 text-center text-slate-500">Cargando expediente...</div>
            ) : detalleActivo ? (
              <div>
                <div className="mb-4 flex items-center justify-between border-b pb-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      Expediente {detalleActivo.expediente.codigo}
                    </h2>
                    <p className="text-xs text-slate-500">{detalleActivo.expediente.asunto}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/expedientes/${detalleActivo.expediente.id}`)}
                      className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      🔗 Ver Expediente
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalDetalleAbierto(false)}
                      className="text-slate-400 hover:text-slate-600 text-lg font-bold"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Checklist de Requisitos */}
                <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-700">
                    📋 Verificación de Requisitos TUPA Reglamentarios
                  </h3>
                  {detalleActivo.requisitos.length === 0 ? (
                    <p className="text-xs text-slate-500">No hay requisitos específicos registrados.</p>
                  ) : (
                    <div className="space-y-2">
                      {detalleActivo.requisitos.map((req) => (
                        <label
                          key={req.idRequisito}
                          className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-2.5 text-xs cursor-pointer hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            checked={req.cumplido}
                            onChange={() => handleToggleRequisito(req.idRequisito, req.cumplido)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className={req.cumplido ? 'text-slate-900 font-medium' : 'text-slate-600'}>
                            {req.descripcion}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Documentos Adjuntos */}
                <div className="mb-6 rounded-xl border border-slate-200 p-4">
                  <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-700">
                    📎 Documentos Adjuntos Presentados
                  </h3>
                  {detalleActivo.documentosAdjuntos.length === 0 ? (
                    <p className="text-xs text-slate-500">No hay documentos adjuntos registrados.</p>
                  ) : (
                    <div className="space-y-2">
                      {detalleActivo.documentosAdjuntos.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-xs"
                        >
                          <span className="font-medium text-slate-800">{doc.nombreOriginal}</span>
                          <span className="text-slate-500 text-[11px] font-mono">
                            {doc.hashSha256.slice(0, 12)}... ({Math.round(doc.tamanioBytes / 1024)} KB)
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Acciones Finales del Modal */}
                <div className="flex flex-wrap items-center justify-end gap-3 border-t pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setMotivoObs('');
                      setSustentoObs('');
                      setModalObservarAbierto(true);
                    }}
                    className="rounded-lg bg-orange-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-orange-700"
                  >
                    ⚠️ Formular Observación
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFundamentacionDictamen('');
                      setModalDictamenAbierto(true);
                    }}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
                  >
                    📜 Emitir Dictamen Técnico
                  </button>

                  <button
                    type="button"
                    onClick={() => setModalDetalleAbierto(false)}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Modal Formular Observación */}
      {modalObservarAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleEnviarObservacion}
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h3 className="mb-2 text-base font-bold text-slate-900">Formular Observación Técnica</h3>
            <p className="mb-4 text-xs text-slate-500">
              El expediente pasará a estado OBSERVADO y el estudiante será notificado formalmente.
            </p>

            <div className="mb-3">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Motivo Concreto de la Observación (Mínimo 10 caracteres)
              </label>
              <textarea
                required
                rows={3}
                value={motivoObs}
                onChange={(e) => setMotivoObs(e.target.value)}
                placeholder="Describa el defecto, requisito faltante o inconsistencia técnica..."
                className="w-full rounded-lg border border-slate-300 p-2.5 text-xs focus:border-orange-500 focus:outline-none"
              />
            </div>

            <div className="mb-3">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Sustento Técnico o Normativo
              </label>
              <input
                type="text"
                value={sustentoObs}
                onChange={(e) => setSustentoObs(e.target.value)}
                placeholder="Ej. Conforme al Art. 12 del Reglamento TUPA 2026..."
                className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-orange-500 focus:outline-none"
              />
            </div>

            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Plazo de Subsanación (Días Hábiles)
              </label>
              <input
                type="number"
                min={1}
                max={30}
                value={plazoObs}
                onChange={(e) => setPlazoObs(Number.parseInt(e.target.value, 10))}
                className="w-24 rounded-lg border border-slate-300 p-2 text-xs focus:border-orange-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalObservarAbierto(false)}
                className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardandoObs}
                className="rounded-lg bg-orange-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-orange-700 disabled:opacity-50"
              >
                {guardandoObs ? 'Registrando...' : 'Confirmar Observación'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Emitir Dictamen */}
      {modalDictamenAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <form
            onSubmit={handleEnviarDictamen}
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h3 className="mb-2 text-base font-bold text-slate-900">Emisión de Dictamen Técnico</h3>
            <p className="mb-4 text-xs text-slate-500">
              Concluye la etapa de calificación del docente y traslada el trámite a estado ATENDIDO para la siguiente etapa.
            </p>

            <div className="mb-3">
              <label className="block text-xs font-bold text-slate-700 mb-1">Resultado del Dictamen</label>
              <select
                value={resultadoDictamen}
                onChange={(e) => setResultadoDictamen(e.target.value as 'FAVORABLE' | 'DESFAVORABLE')}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-emerald-500 focus:outline-none"
              >
                <option value="FAVORABLE">FAVORABLE (Conformidad técnica acreditada)</option>
                <option value="DESFAVORABLE">DESFAVORABLE (No cumple requisitos)</option>
              </select>
            </div>

            <div className="mb-3">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Fundamentación Técnica Conclusiva (Mínimo 10 caracteres)
              </label>
              <textarea
                required
                rows={4}
                value={fundamentacionDictamen}
                onChange={(e) => setFundamentacionDictamen(e.target.value)}
                placeholder="Fundamente el cumplimiento o incumplimiento curricular, creditaje, EFSRT..."
                className="w-full rounded-lg border border-slate-300 p-2.5 text-xs focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-700 mb-1">Recomendaciones Finales</label>
              <input
                type="text"
                value={recomendacionesDictamen}
                onChange={(e) => setRecomendacionesDictamen(e.target.value)}
                placeholder="Ej. Proceder a emitir resolución de titulación..."
                className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalDictamenAbierto(false)}
                className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardandoDictamen}
                className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                {guardandoDictamen ? 'Emitiendo...' : 'Firmar y Emitir Dictamen'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
