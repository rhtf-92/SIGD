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
  // Account and CUT changes create an independent state scope, including in-flight requests.
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

  useEffect(() => {
    if (!cut) return;
    let activo = true;
    const codigo = cut.trim().toUpperCase();
    apiClient.get<DtoConsultaPublica>(
      '/api/v1/tramites/consulta-publica/' + encodeURIComponent(codigo), { headers: publicTrackingHeaders(codigo) },
    ).then(({ data }) => {
      if (activo) { setResultado(data); setPropietarioResultado(contexto); }
    }).catch(() => {
      if (activo) setError('No se encontr\u00f3 ning\u00fan expediente con el c\u00f3digo CUT ingresado o ocurri\u00f3 un error en la consulta.');
    }).finally(() => { if (activo) setCargando(false); });
    return () => { activo = false; };
  }, [cut, contexto]);

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
                IESTP "Suiza" — Sede Digital y Transparencia Documentaria (Ley N° 27444 / Ley N° 29733)
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
          {isAuthenticated && esCiudadano && <Link to="/tesoreria" className="mb-4 inline-block text-sm font-semibold text-[#006EC7] underline">Mis pagos y devoluciones</Link>}
          <form onSubmit={handleBuscar} className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label htmlFor="cut-input" className="sr-only">
                Código Único de Trámite (CUT)
              </label>
              <input
                id="cut-input"
                type="text"
                placeholder="Ejemplo: EXP-2026-000104"
                value={cutInput}
                onChange={(e) => setCutInput(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-800 placeholder-slate-400 font-mono text-base uppercase"
              />
            </div>
            <button
              type="submit"
              disabled={cargando}
              className="px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {cargando ? 'Buscando...' : 'Consultar Estado'}
            </button>
          </form>

          {error && (
            <div className="mt-4 p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">
              {error}
            </div>
          )}
        </div>

        {isAuthenticated && esCiudadano && (
          <section aria-labelledby="mis-expedientes-title" className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="mis-expedientes-title" className="text-lg font-bold text-slate-900">Mis expedientes</h2>
                <p className="text-sm text-slate-500 mt-1">Registros asociados al titular de su sesión autenticada.</p>
              </div>
              {cargandoMisExpedientes && <span role="status" className="text-xs text-slate-500">Cargando...</span>}
            </div>
            {errorMisExpedientes && <p role="alert" className="mt-4 rounded-lg bg-rose-50 border border-rose-200 p-3 text-sm text-rose-700">No fue posible cargar sus expedientes. Vuelva a intentarlo más tarde.</p>}
            {!cargandoMisExpedientes && !errorMisExpedientes && misExpedientesOwner === usuario?.id && misExpedientes.length === 0 && <p className="mt-4 text-sm text-slate-500">No se encontraron expedientes asociados a su cuenta.</p>}
            {misExpedientesOwner === usuario?.id && misExpedientes.length > 0 && (
              <ul className="mt-4 divide-y divide-slate-100">
                {misExpedientes.map((item) => (
                  <li key={item.cut} className="py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono font-semibold text-slate-900">{item.cut}</p>
                      <p className="text-sm text-slate-700">{item.procedimiento ?? item.codigo_procedimiento ?? 'Trámite institucional'}</p>
                      {item.asunto && <p className="text-xs text-slate-500 truncate">{item.asunto}</p>}
                      <p className="text-xs text-slate-500">Ingresó: {new Date(item.fecha_radicacion).toLocaleString('es-PE', { timeZone: 'America/Lima' })}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="rounded-full bg-blue-50 text-blue-800 border border-blue-100 px-3 py-1 text-xs font-semibold">{item.estado}</span>
                      <Link to={`/consulta/${encodeURIComponent(item.cut)}`} className="text-sm font-semibold text-[#006EC7] hover:underline">Ver seguimiento</Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {misExpedientesOwner === usuario?.id && hayMasHistorial && <button type="button"
              disabled={cargandoMisExpedientes} onClick={() => { setCargandoMisExpedientes(true); setErrorMisExpedientes(false); setPaginaHistorial(p => p + 1); }}
              className="mt-4 text-sm font-semibold text-[#006EC7] disabled:opacity-50">Cargar más expedientes</button>}
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
                    Solicitante (Protección de Datos - Ley 29733)
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
                    <p className="mt-1">{resultado.ordenPago?.indicaciones ?? 'Acérquese a la caja de Tesorería del IESTP Público «Suiza» y abone en efectivo indicando su CUT o número de orden. Su expediente mantendrá los documentos ingresados y este mismo código CUT.'}</p>
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

              {/* Proveídos */}
              {resultado.proveidos.length > 0 && (
                <div className="border-t border-slate-100 pt-6">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">
                    Actuaciones y Proveídos Públicos
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
