import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  supervisarEvaluacionesArea,
  type EvaluacionSupervisionItem,
} from '../../api/evaluadoresApi';
import { useAuthStore } from '../../stores/authStore';

export default function SupervisionAreaPage() {
  const navigate = useNavigate();
  const { usuario } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [evaluaciones, setEvaluaciones] = useState<EvaluacionSupervisionItem[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<string>('TODOS');

  const cargarSupervision = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await supervisarEvaluacionesArea();
      setEvaluaciones(res.evaluaciones || []);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cargar supervisión de área.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void cargarSupervision();
  }, []);

  const metricas = useMemo(() => {
    const total = evaluaciones.length;
    const asignados = evaluaciones.filter((e) => e.estadoEvaluacion === 'ASIGNADO').length;
    const enRevision = evaluaciones.filter((e) => e.estadoEvaluacion === 'EN_EVALUACION' || e.estadoExpediente === 'EN_REVISION').length;
    const observados = evaluaciones.filter((e) => e.estadoExpediente === 'OBSERVADO').length;
    const concluidos = evaluaciones.filter((e) => e.estadoEvaluacion === 'CONCLUIDO').length;
    const enRiesgo = evaluaciones.filter((e) => e.diasTranscurridos > 5 && e.estadoEvaluacion !== 'CONCLUIDO').length;

    return { total, asignados, enRevision, observados, concluidos, enRiesgo };
  }, [evaluaciones]);

  const filtrados = useMemo(() => {
    return evaluaciones.filter((item) => {
      const matchBusqueda =
        busqueda === '' ||
        item.codigoExpediente.toLowerCase().includes(busqueda.toLowerCase()) ||
        item.asunto.toLowerCase().includes(busqueda.toLowerCase()) ||
        item.docenteNombre.toLowerCase().includes(busqueda.toLowerCase()) ||
        item.docenteEmail.toLowerCase().includes(busqueda.toLowerCase());

      const matchEstado =
        filtroEstado === 'TODOS' ||
        (filtroEstado === 'PENDIENTE' && (item.estadoEvaluacion === 'ASIGNADO' || item.estadoEvaluacion === 'EN_EVALUACION')) ||
        (filtroEstado === 'OBSERVADO' && item.estadoExpediente === 'OBSERVADO') ||
        (filtroEstado === 'CONCLUIDO' && item.estadoEvaluacion === 'CONCLUIDO') ||
        (filtroEstado === 'RIESGO' && item.diasTranscurridos > 5 && item.estadoEvaluacion !== 'CONCLUIDO');

      return matchBusqueda && matchEstado;
    });
  }, [evaluaciones, busqueda, filtroEstado]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-800">
      {/* Header Institucional de Supervisión */}
      <header className="border-b border-slate-200 bg-white shadow-xs">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-indigo-700 px-2.5 py-0.5 font-mono text-[11px] font-bold text-white uppercase tracking-wider">
                  SIGD • Supervisión Académica
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  IESTP «Suiza» — Pucallpa
                </span>
              </div>
              <h1 className="mt-1.5 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                Panel de Supervisión de Evaluaciones de Área
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Monitoreo del desempeño técnico de docentes evaluadores, cumplimiento de plazos institucionales y estado de dictámenes.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => void cargarSupervision()}
                disabled={loading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 disabled:opacity-50"
              >
                <span>🔄</span>
                <span>{loading ? 'Actualizando…' : 'Actualizar'}</span>
              </button>
              <button
                type="button"
                onClick={() => navigate('/expedientes')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50"
              >
                <span>← Bandeja General</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Contenido Principal */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-800">
            ⚠️ {error}
          </div>
        )}

        {/* Tarjetas de Métricas */}
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <p className="text-xs font-medium text-slate-500">Total Evaluaciones</p>
            <p className="mt-1 text-2xl font-black text-slate-900">{metricas.total}</p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 shadow-xs">
            <p className="text-xs font-medium text-blue-700">Por Iniciar</p>
            <p className="mt-1 text-2xl font-black text-blue-900">{metricas.asignados}</p>
          </div>
          <div className="rounded-xl border border-cyan-200 bg-cyan-50/50 p-4 shadow-xs">
            <p className="text-xs font-medium text-cyan-700">En Revisión</p>
            <p className="mt-1 text-2xl font-black text-cyan-900">{metricas.enRevision}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-xs">
            <p className="text-xs font-medium text-amber-700">Observados</p>
            <p className="mt-1 text-2xl font-black text-amber-900">{metricas.observados}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-xs">
            <p className="text-xs font-medium text-emerald-700">Concluidos</p>
            <p className="mt-1 text-2xl font-black text-emerald-900">{metricas.concluidos}</p>
          </div>
          <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 shadow-xs">
            <p className="text-xs font-medium text-rose-700">En Riesgo (&gt;5 días)</p>
            <p className="mt-1 text-2xl font-black text-rose-900">{metricas.enRiesgo}</p>
          </div>
        </section>

        {/* Filtros y Búsqueda */}
        <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por CUT, asunto, docente evaluador o correo…"
              className="w-full rounded-lg border border-slate-300 py-2 pl-3 pr-8 text-xs focus:border-indigo-500 focus:outline-hidden"
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda('')}
                className="absolute right-2.5 top-2 text-xs text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'TODOS', label: 'Todos' },
              { id: 'PENDIENTE', label: 'Pendientes' },
              { id: 'OBSERVADO', label: 'Observados' },
              { id: 'CONCLUIDO', label: 'Concluidos' },
              { id: 'RIESGO', label: 'En Riesgo (>5d)' },
            ].map((filtro) => (
              <button
                key={filtro.id}
                type="button"
                onClick={() => setFiltroEstado(filtro.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  filtroEstado === filtro.id
                    ? 'bg-indigo-700 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {filtro.label}
              </button>
            ))}
          </div>
        </section>

        {/* Tabla de Evaluaciones de Área */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900">
              Evaluaciones Asignadas en el Área ({filtrados.length})
            </h2>
            <span className="text-xs text-slate-500">
              Usuario supervisor: <span className="font-semibold text-slate-800">{usuario?.nombreCompleto || 'Supervisor'}</span>
            </span>
          </div>

          {loading ? (
            <p className="py-8 text-center text-xs text-slate-500 italic">
              Cargando evaluaciones del área…
            </p>
          ) : filtrados.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-xs text-slate-500">
              <p className="font-bold text-slate-700">No se encontraron expedientes con los criterios seleccionados</p>
              <p className="mt-1">Modifique los filtros o el término de búsqueda.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-semibold">
                    <th className="py-2.5 px-3">Código CUT</th>
                    <th className="py-2.5 px-3">Asunto</th>
                    <th className="py-2.5 px-3">Docente Evaluador</th>
                    <th className="py-2.5 px-3 text-center">Estado Evaluación</th>
                    <th className="py-2.5 px-3 text-center">Estado Trámite</th>
                    <th className="py-2.5 px-3 text-center">Asignado En</th>
                    <th className="py-2.5 px-3 text-center">Días Transcurridos</th>
                    <th className="py-2.5 px-3 text-center">Resultado</th>
                    <th className="py-2.5 px-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtrados.map((item) => (
                    <tr key={item.idAsignacion} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-blue-900 whitespace-nowrap">
                        {item.codigoExpediente}
                      </td>
                      <td className="py-3 px-3 max-w-xs truncate" title={item.asunto}>
                        {item.asunto}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-medium text-slate-900">{item.docenteNombre}</div>
                        <div className="text-[11px] text-slate-500">{item.docenteEmail}</div>
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            item.estadoEvaluacion === 'CONCLUIDO'
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.estadoEvaluacion === 'EN_EVALUACION'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {item.estadoEvaluacion}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            item.estadoExpediente === 'OBSERVADO'
                              ? 'bg-amber-100 text-amber-800'
                              : item.estadoExpediente === 'ATENDIDO'
                              ? 'bg-teal-100 text-teal-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {item.estadoExpediente}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center text-slate-500 font-mono text-[11px] whitespace-nowrap">
                        {new Date(item.asignadoEn).toLocaleDateString('es-PE')}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-sm font-mono text-xs font-bold ${
                            item.diasTranscurridos > 5 && item.estadoEvaluacion !== 'CONCLUIDO'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {item.diasTranscurridos} día(s)
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {item.resultadoEvaluacion ? (
                          <span
                            className={`inline-block px-2 py-0.5 rounded-sm text-[10px] font-bold ${
                              item.resultadoEvaluacion === 'FAVORABLE'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {item.resultadoEvaluacion}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => navigate(`/expedientes/${item.expedienteId}`)}
                          className="inline-flex items-center gap-1 font-bold text-indigo-700 hover:underline"
                        >
                          <span>Ver</span>
                          <span>→</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
