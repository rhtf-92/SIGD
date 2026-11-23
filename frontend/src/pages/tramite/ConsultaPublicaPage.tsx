import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { publicTrackingHeaders } from '../../services/radicacionPublicaService';
import { useAuthStore } from '../../stores/authStore';

export interface DtoDocumentoPublico {
  nombreArchivo: string;
  contentType: string;
  hashSha256: string;
}

export interface DtoProveidoPublico {
  numero: string;
  fechaEmision: string;
  resumen: string;
}

export interface DtoMovimientoPublico {
  secuencia: number;
  fechaHora: string;
  etapa: string;
  descripcion: string;
  unidadOrganica: string;
  estado: string;
  detallesPublicos?: {
    codigoVerificacion?: string;
    custodiaFisica?: boolean;
    observado?: boolean;
    subsanado?: boolean;
  };
}

export interface DtoConsultaPublica {
  cut: string;
  anioFiscal: number;
  estadoTramite: string;
  tipoTramite: string | null;
  asunto: string;
  fechaEnvioReal: string;
  fechaRadicacionLegal: string;
  fueraDeHorario: boolean;
  canalRecepcion: string;
  totalFolios: number;
  administrado: {
    documentoEnmascarado: string | null;
    nombreEnmascarado: string | null;
  };
  documentos: DtoDocumentoPublico[];
  proveidos: DtoProveidoPublico[];
  movimientos?: DtoMovimientoPublico[];
  mensajeLegal: string;
  condicionEconomica?: 'PENDIENTE DE PAGO' | 'PAGO VERIFICADO' | 'GRATUITO' | null;
  ordenPago?: {
    codigo: string;
    importe: string;
    moneda: string;
    fechaEmision: string;
    indicaciones: string;
    estado: string;
  } | null;
}

interface DtoExpedientePropio {
  cut: string;
  fecha_radicacion: string;
  estado: string;
  codigo_procedimiento: string | null;
  procedimiento: string | null;
  asunto: string;
}

export default function ConsultaPublicaPage() {
  const cuenta = useAuthStore(state => state.isAuthenticated ? state.usuario?.id ?? 'sin-identidad' : 'publico');
  const { cut } = useParams<{ cut: string }>();
  return <ConsultaPublicaContenido key={cuenta + ':' + (cut ?? '')} />;
}

function ConsultaPublicaContenido() {
  const { cut } = useParams<{ cut: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, usuario } = useAuthStore();
  const esCiudadano = Boolean(usuario && (usuario.rol === 'CIUDADANO' || usuario.roles?.includes('CIUDADANO')));
  const contexto = isAuthenticated ? usuario?.id ?? 'sin-identidad' : 'publico';
  const [cutInput, setCutInput] = useState(cut ?? '');
  const [resultado, setResultado] = useState<DtoConsultaPublica | null>(null);
  const [propietarioResultado, setPropietarioResultado] = useState<string | null>(null);
  const [cargando, setCargando] = useState(Boolean(cut));
  const [error, setError] = useState<string | null>(null);
  const [misExpedientes, setMisExpedientes] = useState<DtoExpedientePropio[]>([]);
  const [misExpedientesOwner, setMisExpedientesOwner] = useState<string | null>(null);
  const [cargandoMisExpedientes, setCargandoMisExpedientes] = useState(isAuthenticated && esCiudadano);
  const [errorMisExpedientes, setErrorMisExpedientes] = useState(false);
  const [paginaHistorial, setPaginaHistorial] = useState(1);
  const [hayMasHistorial, setHayMasHistorial] = useState(false);

  // Extracción inmediata del secreto desde el hash (#token=... o #constancia=...)
  // y limpieza de la barra de direcciones para proteger el secreto de referrers y logs
  const [tokenSeguimiento] = useState<string | null>(() => {
    try {
      if (typeof window !== 'undefined' && window.location.hash) {
        const hashStr = window.location.hash.slice(1);
        const params = new URLSearchParams(hashStr);
        const extraido = params.get('token') ?? params.get('constancia');
        if (extraido && /^[0-9a-f]{64}$/i.test(extraido)) {
          // Remover inmediatamente el secreto de la URL en el historial del navegador
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
          return extraido;
        }
      }
    } catch {
      // Ignorar fallos de parsing de fragmento en navegadores restringidos
    }
    return null;
  });

  useEffect(() => {
    if (!cut) return;
    let activo = true;
    const codigo = cut.trim().toUpperCase();

    const headers: Record<string, string> = {};
    if (tokenSeguimiento) {
      headers['X-SIGD-Public-Tracking-Token'] = tokenSeguimiento;
      headers['X-SIGD-Tracking-Token'] = tokenSeguimiento;
    } else {
      Object.assign(headers, publicTrackingHeaders(codigo));
    }

    apiClient.get<DtoConsultaPublica>(
      '/api/v1/tramites/consulta-publica/' + encodeURIComponent(codigo),
      { headers }
    ).then(({ data }) => {
      if (activo) {
        setResultado(data);
        setPropietarioResultado(contexto);
      }
    }).catch(() => {
      if (activo) {
        setError('No se encontró ningún expediente con el código CUT ingresado o el enlace de seguimiento no es válido.');
      }
    }).finally(() => {
      if (activo) setCargando(false);
    });

    return () => { activo = false; };
  }, [cut, contexto, tokenSeguimiento]);

  useEffect(() => {
    if (!isAuthenticated || !esCiudadano) return;
    let active = true;
    apiClient.get<{ items: DtoExpedientePropio[]; hayMas?: boolean }>(
      '/api/v1/tramites/mis-expedientes' + (paginaHistorial > 1 ? '?pagina=' + paginaHistorial : ''),
    ).then(({ data }) => {
      if (active) {
        setMisExpedientes(prev => paginaHistorial === 1 ? (Array.isArray(data.items) ? data.items : []) : [...prev, ...(Array.isArray(data.items) ? data.items : [])]);
        setMisExpedientesOwner(usuario?.id ?? null);
        setHayMasHistorial(data.hayMas === true);
      }
    }).catch(() => { if (active) setErrorMisExpedientes(true); })
      .finally(() => { if (active) setCargandoMisExpedientes(false); });
    return () => { active = false; };
  }, [isAuthenticated, esCiudadano, usuario?.id, paginaHistorial]);

  const handleBuscar = (e: React.FormEvent) => {
    e.preventDefault();
    if (cutInput.trim()) {
      navigate(`/consulta/${encodeURIComponent(cutInput.trim().toUpperCase())}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Cabecera Institucional */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-100 pb-6 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Consulta Pública de Trámites y Expedientes
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                IESTP «Suiza» — Sede Digital y Transparencia Documentaria (Ley N° 27444 / Ley N° 29733)
              </p>
            </div>
            <Link
              to="/"
              className="text-sm font-medium text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-4 py-2 rounded-lg transition"
            >
              ← Volver al Portal
            </Link>
          </div>

          {/* Formulario de Búsqueda */}
          <form onSubmit={handleBuscar} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Ingrese código CUT (ej. EXP-2026-000215)"
              value={cutInput}
              onChange={(e) => setCutInput(e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono text-sm"
              required
            />
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-6 py-2.5 rounded-lg transition text-sm shadow-sm"
            >
              Consultar Trámite
            </button>
          </form>

          {cargando && (
            <div className="mt-4 text-center py-4 text-slate-500 text-sm animate-pulse">
              Consultando estado procesal del expediente en la Sede Digital...
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Historial de trámites del ciudadano autenticado */}
        {isAuthenticated && esCiudadano && (
          <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sm:p-8">
            <h2 className="text-lg font-bold text-slate-900 mb-4">
              Mis Expedientes Radicados
            </h2>
            {cargandoMisExpedientes && (
              <p className="text-sm text-slate-500">Cargando trámites propios...</p>
            )}
            {errorMisExpedientes && (
              <p className="text-sm text-red-600">No se pudieron cargar sus expedientes.</p>
            )}
            {misExpedientesOwner === usuario?.id && misExpedientes.length > 0 && (
              <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                {misExpedientes.map((exp) => (
                  <li key={exp.cut} className="p-4 hover:bg-slate-50 transition flex items-center justify-between">
                    <div>
                      <Link to={`/consulta/${encodeURIComponent(exp.cut)}`} className="font-mono text-emerald-600 font-bold hover:underline">
                        {exp.cut}
                      </Link>
                      <p className="text-sm text-slate-700 mt-0.5">{exp.asunto}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {exp.procedimiento ?? 'Trámite General'} — {new Date(exp.fecha_radicacion).toLocaleDateString('es-PE')}
                      </p>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-100 text-slate-700 border">
                      {exp.estado}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {misExpedientesOwner === usuario?.id && hayMasHistorial && (
              <button
                type="button"
                disabled={cargandoMisExpedientes}
                onClick={() => {
                  setCargandoMisExpedientes(true);
                  setErrorMisExpedientes(false);
                  setPaginaHistorial((p) => p + 1);
                }}
                className="mt-4 text-sm font-semibold text-[#006EC7] disabled:opacity-50"
              >
                Cargar más expedientes
              </button>
            )}
          </section>
        )}

        {/* Detalle del Expediente */}
        {resultado && propietarioResultado === contexto && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 px-6 py-5 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <span className="text-xs uppercase tracking-wider text-emerald-400 font-semibold">
                  Expediente Encontrado
                </span>
                <h2 className="text-2xl font-mono font-bold">{resultado.cut}</h2>
              </div>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {resultado.estadoTramite}
              </span>
            </div>

            <div className="p-6 sm:p-8 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Asunto / Petitorio
                  </h3>
                  <p className="mt-1 text-slate-800 font-medium">{resultado.asunto}</p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Tipo de Procedimiento
                  </h3>
                  <p className="mt-1 text-slate-800 font-medium">
                    {resultado.tipoTramite ?? 'Trámite General'}
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Solicitante (Protección de Datos - Ley N° 29733)
                  </h3>
                  <p className="mt-1 text-slate-700 font-mono">
                    {resultado.administrado.nombreEnmascarado ?? 'Ciudadano Administrado'} (
                    {resultado.administrado.documentoEnmascarado ?? 'Documento Reservado'})
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Fecha de Radicación Legal
                  </h3>
                  <p className="mt-1 text-slate-700">
                    {resultado.fechaRadicacionLegal
                      ? new Date(resultado.fechaRadicacionLegal).toLocaleString('es-PE')
                      : 'En trámite'}
                  </p>
                </div>
              </div>

              {/* Condición Económica y Orden de Pago */}
              {resultado.condicionEconomica === 'PENDIENTE DE PAGO' && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-900">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold uppercase tracking-wider text-amber-800 flex items-center gap-2">
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                      PENDIENTE DE PAGO EN TESORERÍA
                    </span>
                    {resultado.ordenPago?.codigo && (
                      <span className="font-mono text-xs font-semibold bg-amber-200/80 text-amber-900 px-2 py-1 rounded">
                        Orden: {resultado.ordenPago.codigo}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-slate-800">
                    Este trámite se encuentra registrado con derechos de tramitación pendientes de abono en caja por un importe de <strong>S/ {resultado.ordenPago?.importe ?? '0.00'} {resultado.ordenPago?.moneda ?? 'PEN'}</strong> ({resultado.tipoTramite}).
                  </p>
                  <div className="mt-3 rounded border border-amber-200 bg-white/80 p-3 text-xs text-amber-900">
                    <p className="font-semibold">Indicaciones para el pago presencial en Tesorería:</p>
                    <p className="mt-1">{resultado.ordenPago?.indicaciones ?? 'Acérquese a la caja de Tesorería del IESTP Público «Suiza» y abone en efectivo indicando su CUT o número de orden.'}</p>
                  </div>
                </div>
              )}
              {resultado.condicionEconomica === 'PAGO VERIFICADO' && (
                <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-emerald-900">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold uppercase tracking-wider text-emerald-800">
                      PAGO VERIFICADO EN CAJA
                    </span>
                    {resultado.ordenPago?.codigo && (
                      <span className="font-mono text-xs font-semibold bg-emerald-200 text-emerald-900 px-2 py-1 rounded">
                        Orden: {resultado.ordenPago.codigo}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-slate-800">
                    El pago por <strong>S/ {resultado.ordenPago?.importe ?? '0.00'}</strong> fue recibido y verificado por Tesorería. El expediente se encuentra plenamente habilitado para calificación y derivación institucional.
                  </p>
                </div>
              )}
              {resultado.condicionEconomica === 'GRATUITO' && (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-blue-900 text-sm">
                  <span className="font-semibold">Trámite Gratuito:</span> Procedimiento sin derecho de tramitación conforme al TUPA 2026.
                </div>
              )}

              {/* LÍNEA DE TIEMPO INSTITUCIONAL DE MOVIMIENTOS PÚBLICOS */}
              <div className="border-t border-slate-100 pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>Línea de Tiempo del Procedimiento Administrativo</span>
                  </h3>
                  <span className="text-xs text-slate-500">
                    Trazabilidad institucional (LPAG Art. 66)
                  </span>
                </div>

                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
                  {(resultado.movimientos && resultado.movimientos.length > 0
                    ? resultado.movimientos
                    : [
                        {
                          secuencia: 1,
                          fechaHora: resultado.fechaRadicacionLegal,
                          etapa: 'RADICACION',
                          descripcion: 'Trámite presentado formalmente en Mesa de Partes Virtual',
                          unidadOrganica: 'Mesa de Partes Virtual',
                          estado: resultado.estadoTramite,
                        },
                      ]
                  ).map((mov, idx) => (
                    <div key={idx} className="relative group">
                      {/* Círculo indicador */}
                      <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full border-2 border-white bg-emerald-500 shadow-sm"></div>

                      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200/80 shadow-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                          <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider bg-emerald-100/60 px-2 py-0.5 rounded w-fit">
                            {mov.unidadOrganica}
                          </span>
                          <span className="text-xs text-slate-400 font-mono">
                            {new Date(mov.fechaHora).toLocaleString('es-PE')}
                          </span>
                        </div>

                        <p className="text-sm font-medium text-slate-800 mt-1">
                          {mov.descripcion}
                        </p>

                        {/* Badges de evidencias y estado */}
                        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
                          <span className="px-2 py-0.5 rounded bg-slate-200/80 text-slate-700 font-mono font-medium">
                            Estado: {mov.estado}
                          </span>

                          {mov.detallesPublicos?.codigoVerificacion && (
                            <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-mono font-semibold border border-blue-200 flex items-center gap-1">
                              <span>✓ Firma PAdES CVD:</span>
                              <span>{mov.detallesPublicos.codigoVerificacion}</span>
                            </span>
                          )}

                          {mov.detallesPublicos?.custodiaFisica && (
                            <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-semibold border border-purple-200">
                              Custodia Física en Archivo Central
                            </span>
                          )}

                          {mov.detallesPublicos?.observado && (
                            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold border border-amber-200">
                              Observación Formal Notificada
                            </span>
                          )}

                          {mov.detallesPublicos?.subsanado && (
                            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold border border-emerald-200">
                              Subsanación Presentada
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Documentos */}
              {resultado.documentos.length > 0 && (
                <div className="border-t border-slate-100 pt-6">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">
                    Documentos Oficiales Adjuntos
                  </h3>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                    {resultado.documentos.map((doc, idx) => (
                      <div key={idx} className="p-4 flex items-center justify-between text-sm bg-slate-50/50">
                        <div>
                          <p className="font-medium text-slate-800">{doc.nombreArchivo}</p>
                          <p className="text-xs text-slate-400 font-mono">
                            SHA-256: {doc.hashSha256.slice(0, 16)}...
                          </p>
                        </div>
                        <span className="text-xs bg-slate-200 text-slate-700 px-2 py-1 rounded">
                          {doc.contentType}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actuaciones y Proveídos */}
              {resultado.proveidos.length > 0 && (
                <div className="border-t border-slate-100 pt-6">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">
                    Actuaciones y Proveídos Institucionales
                  </h3>
                  <div className="space-y-3">
                    {resultado.proveidos.map((prov, idx) => (
                      <div key={idx} className="p-4 rounded-lg bg-emerald-50/50 border border-emerald-100">
                        <div className="flex justify-between items-center text-xs text-emerald-800 font-semibold mb-1">
                          <span>{prov.numero}</span>
                          <span>{new Date(prov.fechaEmision).toLocaleDateString('es-PE')}</span>
                        </div>
                        <p className="text-sm text-slate-700">{prov.resumen}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Mensaje Legal */}
              {resultado.mensajeLegal && (
                <div className="border-t border-slate-100 pt-4 text-xs text-slate-500 italic">
                  {resultado.mensajeLegal}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
