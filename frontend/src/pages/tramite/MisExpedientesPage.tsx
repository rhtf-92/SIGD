import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { useAuthStore } from '../../stores/authStore';
import { registrarSubsanacionEstudiante } from '../../api/evaluadoresApi';

interface ExpedienteVinculado {
  id: string;
  cut: string;
  asunto: string;
  estado: string;
  fechaIngreso: string;
  foliosTotales: number;
  procedimientoNombre?: string;
  origenVinculacion?: string;
}

interface SolicitudVinculacion {
  id: string;
  expedienteId: string;
  cut: string;
  asuntoExpediente: string;
  estado: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';
  motivoSolicitud: string | null;
  observacionResolucion: string | null;
  fechaSolicitud: string;
  fechaResolucion: string | null;
}

export default function MisExpedientesPage() {
  const { usuario } = useAuthStore();
  const [expedientes, setExpedientes] = useState<ExpedienteVinculado[]>([]);
  const [solicitudes, setSolicitudes] = useState<SolicitudVinculacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal para solicitar vinculación
  const [modalAbierto, setModalAbierto] = useState(false);
  const [cutInput, setCutInput] = useState('');
  const [motivoInput, setMotivoInput] = useState('');
  const [enviandoSolicitud, setEnviandoSolicitud] = useState(false);
  const [errorSolicitud, setErrorSolicitud] = useState<string | null>(null);
  const [exitoSolicitud, setExitoSolicitud] = useState<string | null>(null);

  // Modal para subsanación formal de observaciones
  const [modalSubsanarAbierto, setModalSubsanarAbierto] = useState(false);
  const [expedienteSubsanar, setExpedienteSubsanar] = useState<ExpedienteVinculado | null>(null);
  const [motivoSubsanacion, setMotivoSubsanacion] = useState('');
  const [sustentoSubsanacion, setSustentoSubsanacion] = useState('');
  const [enviandoSubsanacion, setEnviandoSubsanacion] = useState(false);
  const [errorSubsanacion, setErrorSubsanacion] = useState<string | null>(null);
  const [exitoSubsanacion, setExitoSubsanacion] = useState<string | null>(null);

  const cargarDatos = async () => {
    setCargando(true);
    setError(null);
    try {
      const [resExpedientes, resSolicitudes] = await Promise.all([
        apiClient.get<ExpedienteVinculado[]>('/api/v1/tramites/mis-expedientes'),
        apiClient.get<SolicitudVinculacion[]>('/api/v1/tramites/mis-expedientes/solicitudes-vinculacion'),
      ]);
      setExpedientes(resExpedientes.data);
      setSolicitudes(resSolicitudes.data);
    } catch (err: any) {
      setError(
        err.response?.data?.problemDetails?.detail ||
          err.response?.data?.message ||
          'No se pudieron cargar sus expedientes vinculados.'
      );
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const handleSolicitarVinculacion = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorSolicitud(null);
    setExitoSolicitud(null);
    const cutLimpio = cutInput.trim().toUpperCase();

    if (!/^EXP-\d{4}-\d{6}$/.test(cutLimpio)) {
      setErrorSolicitud('El formato del CUT debe ser EXP-YYYY-XXXXXX (ejemplo: EXP-2026-000001).');
      return;
    }

    setEnviandoSolicitud(true);
    try {
      const res = await apiClient.post<{ mensaje: string; solicitud: SolicitudVinculacion }>(
        '/api/v1/tramites/mis-expedientes/solicitar-vinculacion',
        {
          cut: cutLimpio,
          motivo: motivoInput.trim() || undefined,
        }
      );
      setExitoSolicitud(
        res.data.mensaje ||
          'Solicitud de vinculación enviada exitosamente. Estado: PENDIENTE de revisión por Mesa de Partes.'
      );
      setCutInput('');
      setMotivoInput('');
      cargarDatos();
      setTimeout(() => {
        setModalAbierto(false);
        setExitoSolicitud(null);
      }, 2500);
    } catch (err: any) {
      setErrorSolicitud(
        err.response?.data?.problemDetails?.detail ||
          err.response?.data?.problemDetails?.invalidParams?.[0]?.reason ||
          err.response?.data?.message ||
          'No se pudo registrar la solicitud de vinculación.'
      );
    } finally {
      setEnviandoSolicitud(false);
    }
  };

  const handleAbrirSubsanacion = (exp: ExpedienteVinculado) => {
    setExpedienteSubsanar(exp);
    setMotivoSubsanacion('');
    setSustentoSubsanacion('');
    setErrorSubsanacion(null);
    setExitoSubsanacion(null);
    setModalSubsanarAbierto(true);
  };

  const handleEnviarSubsanacion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expedienteSubsanar) return;
    if (!motivoSubsanacion.trim()) {
      setErrorSubsanacion('Debe ingresar el motivo o descargo de la subsanación.');
      return;
    }
    setEnviandoSubsanacion(true);
    setErrorSubsanacion(null);
    setExitoSubsanacion(null);
    try {
      await registrarSubsanacionEstudiante(expedienteSubsanar.id, {
        motivo: motivoSubsanacion.trim(),
        sustentoSubsanacion: sustentoSubsanacion.trim() || undefined,
      });
      setExitoSubsanacion('Subsanación registrada con éxito. El expediente retornó a evaluación técnica.');
      void cargarDatos();
      setTimeout(() => {
        setModalSubsanarAbierto(false);
        setExitoSubsanacion(null);
        setExpedienteSubsanar(null);
      }, 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'No se pudo registrar la subsanación.';
      setErrorSubsanacion(msg);
    } finally {
      setEnviandoSubsanacion(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      {/* Cabecera institucional */}
      <header className="border-b border-slate-200 bg-white shadow-xs">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-blue-700 px-2 py-0.5 font-mono text-[11px] font-bold text-white uppercase tracking-wider">
                  SIGD • Trámites Ciudadanos
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  IESTP "Suiza" — Pucallpa
                </span>
              </div>
              <h1 className="mt-1.5 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
                Mis Expedientes Oficiales
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Consulte sus trámites formalmente vinculados a su cuenta y gestione solicitudes de vinculación institucional.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setErrorSolicitud(null);
                  setExitoSolicitud(null);
                  setModalAbierto(true);
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-[#006EC7] px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#005ba3]"
              >
                <span>＋</span>
                <span>Vincular Expediente Histórico</span>
              </button>

              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                ← Volver al inicio
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Contenido principal */}
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {/* Aviso de seguridad institucional */}
        <div className="rounded-xl border border-blue-200 bg-blue-50/90 p-4 text-xs text-blue-950 flex items-start gap-3">
          <svg className="w-5 h-5 text-[#006EC7] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="leading-relaxed">
            <p className="font-bold">Política de Privacidad y Seguridad Documental (Ley N° 27444 y Ley N° 29733):</p>
            <p className="mt-0.5 text-blue-900">
              Por razones de integridad y protección de datos personales, los trámites presentados previamente mediante radicación digital pública (sin inicio de sesión) <strong>no se incorporan de manera automática</strong> al crear una cuenta ciudadana, aun cuando coincida el número de DNI. Para vincular un trámite histórico a su panel, pulse «Vincular Expediente Histórico» e indique el CUT correspondiente para revisión y aprobación por Mesa de Partes.
            </p>
          </div>
        </div>

        {error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-800">
            ⚠️ {error}
          </div>
        )}

        {/* Sección 1: Expedientes Oficiales Vinculados */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-lg font-black text-slate-900">
                Expedientes Vinculados ({expedientes.length})
              </h2>
              <p className="text-xs text-slate-500">
                Expedientes activos o concluidos formalmente asociados a {usuario?.nombreCompleto || 'su cuenta'}
              </p>
            </div>
          </div>

          {cargando ? (
            <p role="status" className="py-8 text-center text-xs text-slate-500 italic">
              Consultando expedientes vinculados…
            </p>
          ) : expedientes.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-xs text-slate-500">
              <p className="font-bold text-slate-700">No tiene expedientes vinculados en este momento</p>
              <p className="mt-1">
                Si radicó un trámite digital previo sin cuenta, puede solicitar su vinculación utilizando el botón superior.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-semibold">
                    <th className="py-2.5 px-3">Código Único (CUT)</th>
                    <th className="py-2.5 px-3">Asunto / Petitorio</th>
                    <th className="py-2.5 px-3">Procedimiento</th>
                    <th className="py-2.5 px-3 text-center">Folios</th>
                    <th className="py-2.5 px-3 text-center">Estado</th>
                    <th className="py-2.5 px-3 text-center">Fecha Ingreso</th>
                    <th className="py-2.5 px-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {expedientes.map((exp) => (
                    <tr key={exp.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-blue-900">
                        {exp.cut}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-medium text-slate-900 max-w-xs truncate">
                          {exp.asunto}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-600 max-w-xs truncate">
                        {exp.procedimientoNombre || 'Procedimiento Institucional'}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-semibold text-slate-700">
                        {exp.foliosTotales}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            exp.estado === 'OBSERVADO'
                              ? 'bg-amber-100 text-amber-800'
                              : exp.estado === 'SUBSANADO'
                              ? 'bg-indigo-100 text-indigo-800'
                              : exp.estado === 'ATENDIDO'
                              ? 'bg-teal-100 text-teal-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {exp.estado}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center text-slate-500 font-mono text-[11px]">
                        {new Date(exp.fechaIngreso).toLocaleDateString('es-PE')}
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap space-x-2">
                        {exp.estado === 'OBSERVADO' && (
                          <button
                            type="button"
                            onClick={() => handleAbrirSubsanacion(exp)}
                            className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-2.5 py-1 text-xs font-bold text-white shadow-xs hover:bg-amber-700 transition"
                          >
                            <span>📝 Subsanar</span>
                          </button>
                        )}
                        <Link
                          to={`/consulta/${exp.cut}`}
                          className="inline-flex items-center gap-1 font-bold text-[#006EC7] hover:underline"
                        >
                          <span>Ver Trazabilidad</span>
                          <span>→</span>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Sección 2: Solicitudes de Vinculación */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h2 className="text-base font-black text-slate-900">
              Solicitudes de Vinculación Registradas ({solicitudes.length})
            </h2>
            <p className="text-xs text-slate-500">
              Estado de sus pedidos de incorporación de expedientes históricos a su cuenta
            </p>
          </div>

          {solicitudes.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-400 italic">
              No registra solicitudes de vinculación pendientes ni resueltas.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-semibold">
                    <th className="py-2 px-3">CUT Solicitado</th>
                    <th className="py-2 px-3">Asunto del Expediente</th>
                    <th className="py-2 px-3">Motivo Declarado</th>
                    <th className="py-2 px-3 text-center">Estado</th>
                    <th className="py-2 px-3">Detalle / Observación</th>
                    <th className="py-2 px-3 text-center">Fecha Solicitud</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {solicitudes.map((sol) => (
                    <tr key={sol.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                        {sol.cut}
                      </td>
                      <td className="py-2.5 px-3 max-w-xs truncate text-slate-700">
                        {sol.asuntoExpediente}
                      </td>
                      <td className="py-2.5 px-3 max-w-xs truncate text-slate-500">
                        {sol.motivoSolicitud || 'Sin motivo especificado'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            sol.estado === 'APROBADA'
                              ? 'bg-emerald-100 text-emerald-800'
                              : sol.estado === 'RECHAZADA'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {sol.estado === 'APROBADA'
                            ? '✓ APROBADA'
                            : sol.estado === 'RECHAZADA'
                            ? '✕ RECHAZADA'
                            : '⏳ PENDIENTE'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                        {sol.observacionResolucion || (sol.estado === 'PENDIENTE' ? 'En evaluación por Mesa de Partes' : '—')}
                      </td>
                      <td className="py-2.5 px-3 text-center text-slate-500 font-mono text-[11px]">
                        {new Date(sol.fechaSolicitud).toLocaleDateString('es-PE')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* MODAL: Solicitar Vinculación de Expediente */}
      {modalAbierto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-vinculacion-titulo"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
                  Trámite Institucional
                </span>
                <h3 id="modal-vinculacion-titulo" className="text-base font-bold text-slate-900">
                  Solicitar Vinculación de Expediente
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalAbierto(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Indique el Código Único de Trámite (CUT) emitido en su cargo digital. Mesa de Partes validará la titularidad del trámite antes de habilitar el acceso.
            </p>

            {errorSolicitud && (
              <div role="alert" className="rounded-lg bg-red-50 border border-red-200 p-2.5 text-xs text-red-700 font-semibold">
                ⚠️ {errorSolicitud}
              </div>
            )}

            {exitoSolicitud && (
              <div role="status" className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-800 font-semibold">
                ✓ {exitoSolicitud}
              </div>
            )}

            <form onSubmit={handleSolicitarVinculacion} className="space-y-4">
              <div>
                <label htmlFor="cut-input" className="block text-xs font-bold text-slate-700 mb-1">
                  Código Único de Trámite (CUT) *
                </label>
                <input
                  id="cut-input"
                  type="text"
                  required
                  placeholder="EXP-2026-000001"
                  value={cutInput}
                  onChange={(e) => setCutInput(e.target.value.toUpperCase())}
                  disabled={enviandoSolicitud}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-mono tracking-wider focus:border-blue-600 focus:outline-none uppercase"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  Formato exacto: EXP-YYYY-XXXXXX
                </p>
              </div>

              <div>
                <label htmlFor="motivo-input" className="block text-xs font-bold text-slate-700 mb-1">
                  Motivo de la Solicitud (Opcional)
                </label>
                <textarea
                  id="motivo-input"
                  rows={2}
                  maxLength={250}
                  placeholder="Ejemplo: Radicación digital realizada antes de registrar mi cuenta..."
                  value={motivoInput}
                  onChange={(e) => setMotivoInput(e.target.value)}
                  disabled={enviandoSolicitud}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  disabled={enviandoSolicitud}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={enviandoSolicitud}
                  className="rounded-lg bg-[#006EC7] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#005ba3] disabled:bg-slate-300"
                >
                  {enviandoSolicitud ? 'Enviando…' : 'Enviar Solicitud'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal para subsanar expediente observado */}
      {modalSubsanarAbierto && expedienteSubsanar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  Subsanar Observación Técnica
                </h3>
                <p className="text-xs font-mono font-bold text-blue-800">
                  Expediente: {expedienteSubsanar.cut}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalSubsanarAbierto(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Presente su descargo y documentación aclaratoria para subsanar las observaciones formuladas por el docente evaluador.
            </p>

            {errorSubsanacion && (
              <div role="alert" className="rounded-lg bg-red-50 border border-red-200 p-2.5 text-xs text-red-700 font-semibold">
                ⚠️ {errorSubsanacion}
              </div>
            )}

            {exitoSubsanacion && (
              <div role="status" className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-800 font-semibold">
                ✓ {exitoSubsanacion}
              </div>
            )}

            <form onSubmit={handleEnviarSubsanacion} className="space-y-4">
              <div>
                <label htmlFor="motivo-subsanacion" className="block text-xs font-bold text-slate-700 mb-1">
                  Motivo / Descargo de la Subsanación *
                </label>
                <textarea
                  id="motivo-subsanacion"
                  required
                  rows={3}
                  maxLength={500}
                  placeholder="Detalle de forma clara y precisa cómo se atienden las observaciones del evaluador..."
                  value={motivoSubsanacion}
                  onChange={(e) => setMotivoSubsanacion(e.target.value)}
                  disabled={enviandoSubsanacion}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs focus:border-amber-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label htmlFor="sustento-subsanacion" className="block text-xs font-bold text-slate-700 mb-1">
                  Sustento Complementario o Explicativo (Opcional)
                </label>
                <textarea
                  id="sustento-subsanacion"
                  rows={2}
                  maxLength={500}
                  placeholder="Referencias a documentos, fechas, números de recibo o aclaraciones adicionales..."
                  value={sustentoSubsanacion}
                  onChange={(e) => setSustentoSubsanacion(e.target.value)}
                  disabled={enviandoSubsanacion}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs focus:border-amber-600 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalSubsanarAbierto(false)}
                  disabled={enviandoSubsanacion}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={enviandoSubsanacion}
                  className="rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-amber-700 disabled:bg-slate-300 cursor-pointer"
                >
                  {enviandoSubsanacion ? 'Registrando Subsanación…' : 'Enviar Subsanación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
