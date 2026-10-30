import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiClient } from "../../api/client";
import { formatearFechaHoraLegible } from "../../utils/expedientePresentacion";
import { tesoreriaService, type DtoOrdenPago } from "../../services/tesoreria.service";

export interface DtoExpedienteCiudadano {
  expedienteId: string;
  cut: string;
  codigoExpediente: string;
  numero: string;
  asunto: string;
  tipoDocumento: string;
  tipoTramite: string | null;
  estado: string;
  fechaRadicacion: string;
  canalIngreso: string;
  totalFolios: number;
}


export interface PasoProgresoCiudadano {
  id: string;
  titulo: string;
  estado: 'COMPLETADO' | 'EN_CURSO' | 'PENDIENTE';
  icono: string;
  descripcion: string;
  badgeClase: string;
}

export function calcularProgresoCiudadano(estadoExpediente: string): PasoProgresoCiudadano[] {
  const norm = estadoExpediente.toUpperCase();
  const esArchivado = norm === 'ARCHIVADO';
  const esResuelto = norm === 'RESUELTO' || norm === 'ATENDIDO' || esArchivado;
  const esRevision = norm === 'EN_REVISION' || norm === 'RECEPCIONADO' || norm === 'EN_CALIFICACION' || esResuelto;
  const esDerivado = norm === 'DERIVADO' || esRevision;

  return [
    {
      id: 'paso-1',
      titulo: 'Solicitud recibida',
      estado: 'COMPLETADO',
      icono: '✓',
      descripcion: 'Ingreso formal en Mesa de Partes Virtual',
      badgeClase: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    },
    {
      id: 'paso-2',
      titulo: 'Pago confirmado',
      estado: esDerivado ? 'COMPLETADO' : 'EN_CURSO',
      icono: esDerivado ? '✓' : '●',
      descripcion: esDerivado ? 'Derecho de tramitación cancelado' : 'Validación transversal en Tesorería',
      badgeClase: esDerivado
        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
        : 'bg-blue-50 border-blue-200 text-blue-900 animate-pulse',
    },
    {
      id: 'paso-3',
      titulo: 'Derivado al área responsable',
      estado: esDerivado ? 'COMPLETADO' : 'PENDIENTE',
      icono: esDerivado ? '✓' : '○',
      descripcion: esDerivado ? 'Expediente remitido a la unidad técnica' : 'En Mesa de Partes para pase oficial',
      badgeClase: esDerivado
        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
        : 'bg-slate-50 border-slate-200 text-slate-500',
    },
    {
      id: 'paso-4',
      titulo: 'En evaluación',
      estado: esResuelto
        ? 'COMPLETADO'
        : norm === 'EN_REVISION' || norm === 'RECEPCIONADO' || norm === 'DERIVADO'
        ? 'EN_CURSO'
        : 'PENDIENTE',
      icono: esResuelto
        ? '✓'
        : norm === 'EN_REVISION' || norm === 'RECEPCIONADO' || norm === 'DERIVADO'
        ? '●'
        : '○',
      descripcion: esResuelto
        ? 'Evaluación y calificación finalizada'
        : norm === 'EN_REVISION' || norm === 'RECEPCIONADO' || norm === 'DERIVADO'
        ? 'Revisión técnica de requisitos por especialista'
        : 'En espera de turno de calificación',
      badgeClase: esResuelto
        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
        : norm === 'EN_REVISION' || norm === 'RECEPCIONADO' || norm === 'DERIVADO'
        ? 'bg-amber-50 border-amber-200 text-amber-900 animate-pulse'
        : 'bg-slate-50 border-slate-200 text-slate-500',
    },
    {
      id: 'paso-5',
      titulo: 'Respuesta / Notificación',
      estado: esResuelto ? 'COMPLETADO' : 'PENDIENTE',
      icono: esResuelto ? '✓' : '○',
      descripcion: esResuelto
        ? 'Documento oficial depositado en Casilla Electrónica'
        : 'Pendiente de emisión de acto administrativo',
      badgeClase: esResuelto
        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
        : 'bg-slate-50 border-slate-200 text-slate-500',
    },
    {
      id: 'paso-6',
      titulo: 'Finalizado',
      estado: esArchivado ? 'COMPLETADO' : 'PENDIENTE',
      icono: esArchivado ? '✓' : '○',
      descripcion: esArchivado
        ? 'Trámite concluido formalmente y archivado'
        : 'Expediente activo en el flujo documental',
      badgeClase: esArchivado
        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
        : 'bg-slate-50 border-slate-200 text-slate-500',
    },
  ];
}

export default function MisExpedientesPage() {
  const navigate = useNavigate();
  const [expedientes, setExpedientes] = useState<DtoExpedienteCiudadano[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [modalPago, setModalPago] = useState<{
    cargando: boolean;
    error: string | null;
    cut: string;
    orden: DtoOrdenPago | null;
    tieneOrden: boolean;
  } | null>(null);

  const [copiado, setCopiado] = useState(false);
  const [expandido, setExpandido] = useState<Record<string, boolean>>({});

  const toggleProgreso = (expId: string) => {
    setExpandido((prev) => ({ ...prev, [expId]: !prev[expId] }));
  };

  const abrirModalPago = async (expedienteId: string, cut: string) => {
    setModalPago({ cargando: true, error: null, cut, orden: null, tieneOrden: false });
    try {
      const resp = await tesoreriaService.obtenerPagoExpediente(expedienteId);
      setModalPago({
        cargando: false,
        error: null,
        cut,
        orden: resp.pago,
        tieneOrden: resp.tieneOrden,
      });
    } catch (err: unknown) {
      setModalPago({
        cargando: false,
        error: err instanceof Error ? err.message : "Error al consultar estado de pago.",
        cut,
        orden: null,
        tieneOrden: false,
      });
    }
  };

  const cargarExpedientes = async () => {
    setCargando(true);
    setError(null);
    try {
      const response = await apiClient.get<DtoExpedienteCiudadano[]>(
        "/api/v1/tramites/mis-expedientes"
      );
      setExpedientes(response.data);
    } catch (err: unknown) {
      const mensaje =
        err instanceof Error ? err.message : "Error al cargar sus expedientes.";
      setError(mensaje);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    void cargarExpedientes();
  }, []);

  const formatFecha = (isoString: string) => formatearFechaHoraLegible(isoString);

  const getBadgeEstado = (estado: string) => {
    const norm = estado.toUpperCase();
    if (norm.includes("REGISTRADO") || norm.includes("INICIADO")) {
      return "bg-gradient-to-b from-white via-blue-50/80 to-blue-100/60 text-blue-900 border-blue-200/80 shadow-[0_1px_3px_rgba(59,130,246,0.1),inset_0_1px_1px_rgba(255,255,255,0.9)]";
    }
    if (norm.includes("TRAMITE") || norm.includes("REVISION") || norm.includes("DERIVADO")) {
      return "bg-gradient-to-b from-white via-amber-50/80 to-amber-100/60 text-amber-900 border-amber-200/80 shadow-[0_1px_3px_rgba(245,158,11,0.1),inset_0_1px_1px_rgba(255,255,255,0.9)]";
    }
    if (norm.includes("ATENDIDO") || norm.includes("RESUELTO") || norm.includes("FINALIZADO") || norm.includes("CONCLUIDO") || norm.includes("ARCHIVADO")) {
      return "bg-gradient-to-b from-white via-emerald-50/80 to-emerald-100/60 text-emerald-900 border-emerald-200/80 shadow-[0_1px_3px_rgba(16,185,129,0.1),inset_0_1px_1px_rgba(255,255,255,0.9)]";
    }
    if (norm.includes("OBSERVADO")) {
      return "bg-gradient-to-b from-white via-rose-50/80 to-rose-100/60 text-rose-900 border-rose-200/80 shadow-[0_1px_3px_rgba(244,63,94,0.1),inset_0_1px_1px_rgba(255,255,255,0.9)]";
    }
    return "bg-gradient-to-b from-white via-slate-50/80 to-slate-100/60 text-slate-800 border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04),inset_0_1px_1px_rgba(255,255,255,0.9)]";
  };

  return (
    <main className="min-h-screen bg-slate-50 py-6 px-3.5 sm:px-6 sm:py-8 lg:px-8 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Cabecera del Portal Ciudadano */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200/80 bg-gradient-to-b from-white via-sky-50/80 to-blue-50/60 px-3 py-1 text-xs font-bold text-sky-950 shadow-[0_2px_6px_rgba(14,165,233,0.12),inset_0_1px_1px_rgba(255,255,255,0.9)] mb-1">
              Portal del Ciudadano
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Mis Expedientes
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-slate-500">
              Bienvenido(a), <span className="font-semibold text-slate-700">Mi cuenta</span>. Aquí puedes consultar y dar seguimiento a todos tus trámites registrados.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 shrink-0">
            <Link
              to="/casilla"
              className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition"
            >
              Casilla Electrónica
            </Link>
            <Link
              to="/tramite"
              state={{ nuevoTramite: true }}
              className="inline-flex items-center rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 transition"
            >
              + Nuevo Trámite
            </Link>
          </div>
        </div>

        {/* Estados de carga y error */}
        {cargando && (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
            <p className="mt-3 text-sm text-slate-600 font-medium">Cargando tus expedientes...</p>
          </div>
        )}

        {error && !cargando && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm">No se pudieron cargar los expedientes</h3>
                <p className="text-xs mt-1 text-rose-700">{error}</p>
              </div>
              <button
                type="button"
                onClick={() => void cargarExpedientes()}
                className="rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-800 transition"
              >
                Reintentar
              </button>
            </div>
          </div>
        )}

        {/* Contenido principal: listado o estado vacío */}
        {!cargando && !error && (
          <>
            {expedientes.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600 text-2xl font-bold">
                  📄
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-900">
                  Aún no tienes expedientes radicados
                </h3>
                <p className="mt-1 text-sm text-slate-500 max-w-md mx-auto">
                  Todos los trámites que presentes a través de la Mesa de Partes Virtual aparecerán aquí con su estado y seguimiento en vivo.
                </p>
                <div className="mt-6">
                  <Link
                    to="/tramite"
                    state={{ nuevoTramite: true }}
                    className="inline-flex items-center rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 transition"
                  >
                    Presentar Primer Trámite
                  </Link>
                </div>
              </div>
            ) : (
              <div className="relative overflow-hidden rounded-2xl border border-sky-200/70 bg-white/90 shadow-[0_4px_20px_-4px_rgba(14,165,233,0.08)] backdrop-blur-xs before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-[1px] before:bg-gradient-to-r before:from-transparent before:via-white before:to-transparent">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-600">
                    <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase font-semibold text-slate-700">
                      <tr>
                        <th scope="col" className="px-5 py-3.5">CUT</th>
                        <th scope="col" className="px-5 py-3.5">Fecha</th>
                        <th scope="col" className="px-5 py-3.5">Asunto / Tipo</th>
                        <th scope="col" className="px-5 py-3.5 text-center">Folios</th>
                        <th scope="col" className="px-5 py-3.5">Canal</th>
                        <th scope="col" className="px-5 py-3.5">Estado</th>
                        <th scope="col" className="px-5 py-3.5 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {expedientes.map((exp) => (
                        <React.Fragment key={exp.expedienteId}>
                          <tr className="hover:bg-slate-50/70 transition">
                          <td className="px-5 py-4 font-mono font-bold text-blue-700 whitespace-nowrap">
                            {exp.cut}
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap text-xs text-slate-500">
                            {formatFecha(exp.fechaRadicacion)}
                          </td>
                          <td className="px-5 py-4 max-w-xs">
                            <p className="font-semibold text-slate-800 line-clamp-1">{exp.asunto}</p>
                            <p className="text-xs text-slate-500 line-clamp-1">
                              {exp.tipoTramite || exp.tipoDocumento}
                            </p>
                          </td>
                          <td className="px-5 py-4 text-center whitespace-nowrap font-mono text-xs">
                            {exp.totalFolios}
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <span className="inline-block rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                              {exp.canalIngreso}
                            </span>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <span
                              className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getBadgeEstado(
                                exp.estado
                              )}`}
                            >
                              {exp.estado}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right whitespace-nowrap space-x-2">
                            <button
                              type="button"
                              onClick={() => toggleProgreso(exp.expedienteId)}
                              className="rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition inline-flex items-center gap-1"
                              aria-expanded={Boolean(expandido[exp.expedienteId])}
                              aria-label="Ver progreso del trámite"
                            >
                              <span>{expandido[exp.expedienteId] ? "▲ Ocultar" : "▼ Progreso"}</span>
                            </button>
                            {(exp.estado === 'RESUELTO' || exp.estado === 'ATENDIDO' || exp.estado === 'ARCHIVADO') && (
                              <Link
                                to="/casilla"
                                className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition inline-flex items-center gap-1 shadow-2xs"
                              >
                                <span>📫</span> Casilla
                              </Link>
                            )}
                            <button
                              type="button"
                              onClick={() => void abrirModalPago(exp.expedienteId, exp.cut)}
                              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                            >
                              Pago
                            </button>
                            <button
                              type="button"
                              onClick={() => navigate(`/consulta/${encodeURIComponent(exp.cut)}`)}
                              className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 transition"
                            >
                              Seguimiento →
                            </button>
                          </td>
                        </tr>
                        {/* Sub-fila de Progreso Humano Transparente */}
                        {expandido[exp.expedienteId] && (
                          <tr className="bg-slate-50/90 border-b border-slate-200">
                            <td colSpan={7} className="px-5 py-4">
                              <div className="space-y-3">
                                <div className="flex flex-wrap items-center justify-between text-xs gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-base" aria-hidden="true">📈</span>
                                    <span className="font-bold uppercase tracking-wider text-slate-800">
                                      Progreso del Trámite: <span className="font-mono text-blue-800">{exp.cut}</span>
                                    </span>
                                  </div>
                                  <span className="text-slate-500 text-[11px]">
                                    Seguimiento en línea conforme a la LPAG (sin datos sensibles expuestos)
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5 pt-1">
                                  {calcularProgresoCiudadano(exp.estado).map((paso) => (
                                    <div
                                      key={paso.id}
                                      className={`p-3 rounded-xl border flex flex-col justify-between space-y-1.5 shadow-2xs ${paso.badgeClase}`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold">{paso.titulo}</span>
                                        <span className="text-xs font-bold">{paso.icono}</span>
                                      </div>
                                      <p className="text-[11px] leading-tight text-slate-600">
                                        {paso.descripcion}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-3 text-xs text-slate-500 flex items-center justify-between">
                  <span>Total de expedientes: <strong>{expedientes.length}</strong></span>
                  <span>Actualizado en tiempo real</span>
                </div>
              </div>
            )}
          </>
        )}

        {/* MODAL ORDEN DE PAGO CIUDADANO */}
        {modalPago && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800">Estado de Recaudación</span>
                  <h3 className="text-base font-bold text-slate-900">
                    Orden de Pago — {modalPago.cut}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setModalPago(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
                >
                  ✕
                </button>
              </div>

              {modalPago.cargando ? (
                <div className="p-8 text-center text-slate-500">
                  <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-blue-600 border-r-transparent" />
                  <p className="mt-2 text-xs">Consultando estado en Tesorería...</p>
                </div>
              ) : modalPago.error ? (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
                  {modalPago.error}
                </div>
              ) : !modalPago.tieneOrden || !modalPago.orden ? (
                <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-xs text-slate-600 text-center">
                  <p className="font-semibold text-slate-800">Trámite sin orden de pago requerida</p>
                  <p className="mt-1 text-slate-500">
                    Este trámite es gratuito o aún no se ha generado una orden de pago en ventanilla.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 text-xs">
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Código de Pago:</span>
                      <span className="font-mono font-bold text-blue-900">{modalPago.orden.codigoPago}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Concepto:</span>
                      <span className="font-medium text-slate-800">{modalPago.orden.concepto}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Total Arancel:</span>
                      <span className="font-mono font-bold text-slate-900">
                        {modalPago.orden.moneda} {modalPago.orden.monto.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                      <span className="text-slate-500">Estado:</span>
                      <span className="font-bold text-slate-800">
                        {modalPago.orden.estado}
                      </span>
                    </div>
                  </div>

                  {modalPago.orden.estado === "CONFIRMADO" ? (
                    <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-emerald-900 space-y-1">
                      <p className="font-bold flex items-center gap-1">✓ Pago Confirmado en Tesorería</p>
                      <p className="text-[11px] font-mono">
                        Comprobante Oficial: <strong>{modalPago.orden.codigoRecibo}</strong>
                      </p>
                      <p className="text-[11px] text-emerald-800">
                        Su expediente se encuentra habilitado para su prosecución regular.
                      </p>
                    </div>
                  ) : modalPago.orden.estado === "PENDIENTE" ? (
                    <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-amber-900 space-y-1">
                      <p className="font-bold">Pendiente de Cancelación</p>
                      <p className="text-[11px] text-amber-800">
                        Acérquese a la caja institucional o abone por Yape indicando el código{" "}
                        <strong className="font-mono">{modalPago.orden.codigoPago}</strong>.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard.writeText(modalPago.orden!.codigoPago);
                          setCopiado(true);
                          setTimeout(() => setCopiado(false), 2000);
                        }}
                        className="mt-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100 transition"
                      >
                        {copiado ? "✓ Código copiado" : "Copiar código de pago"}
                      </button>
                    </div>
                  ) : modalPago.orden.estado === "RECHAZADO" ? (
                    <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-rose-900 space-y-1">
                      <p className="font-bold">Orden de Pago Rechazada</p>
                      <p className="text-[11px] text-rose-800">
                        {modalPago.orden.motivoRechazo || "El pago no pudo ser confirmado por Tesorería. Solicite una nueva orden en Mesa de Partes."}
                      </p>
                    </div>
                  ) : modalPago.orden.estado === "VENCIDO" ? (
                    <div className="rounded-xl bg-orange-50 border border-orange-200 p-3 text-orange-900 space-y-1">
                      <p className="font-bold">Orden de Pago Vencida</p>
                      <p className="text-[11px] text-orange-800">
                        El plazo establecido para abonar esta orden ha expirado. Solicite la reemisión en Mesa de Partes.
                      </p>
                    </div>
                  ) : null}
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setModalPago(null)}
                  className="rounded-xl border border-slate-300 bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
