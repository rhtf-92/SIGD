import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { apiClient } from '../../api/client';

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
  areaActual: string;
  pasoSiguiente: string;
  estadoPago: string;
  administrado: {
    documentoEnmascarado: string | null;
    nombreEnmascarado: string | null;
  };
  documentos: DtoDocumentoPublico[];
  proveidos: DtoProveidoPublico[];
  mensajeLegal: string;
}

export default function ConsultaPublicaPage() {
  const { cut } = useParams<{ cut: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [cutInput, setCutInput] = useState(cut ?? '');
  const [documentoInput, setDocumentoInput] = useState(searchParams.get('documento') ?? '');
  const [resultado, setResultado] = useState<DtoConsultaPublica | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cut) {
      setCutInput(cut);
      const docParam = searchParams.get('documento');
      if (docParam) {
        setDocumentoInput(docParam);
        consultar(cut, docParam);
      }
    }
  }, [cut, searchParams]);

  const consultar = async (codigoCut: string, documento: string) => {
    const trimmedCut = codigoCut.trim().toUpperCase();
    const trimmedDoc = documento.trim().replace(/[-\s]/g, '');

    if (!trimmedCut) {
      setError('Por favor, ingrese un código CUT válido (ejemplo: EXP-2026-000001).');
      return;
    }

    if (!trimmedDoc) {
      setError('Por protección de datos (Ley N° 29733), debe ingresar el documento de identidad del solicitante (DNI, CE o RUC).');
      return;
    }

    setCargando(true);
    setError(null);

    try {
      const res = await apiClient.get<DtoConsultaPublica>(
        `/api/v1/tramites/consulta-publica/${encodeURIComponent(trimmedCut)}`,
        {
          params: { documento: trimmedDoc },
        }
      );
      setResultado(res.data);
    } catch (err: unknown) {
      setResultado(null);
      setError(
        'No se encontró ningún expediente con los datos provistos o los datos de identidad no coinciden.'
      );
    } finally {
      setCargando(false);
    }
  };

  const handleBuscar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cutInput.trim()) {
      setError('Por favor, ingrese el código CUT del expediente.');
      return;
    }
    if (!documentoInput.trim()) {
      setError('Por favor, ingrese el número de documento de identidad del solicitante.');
      return;
    }

    const trimmedCut = cutInput.trim().toUpperCase();
    const trimmedDoc = documentoInput.trim().replace(/[-\s]/g, '');

    navigate(`/consulta/${encodeURIComponent(trimmedCut)}?documento=${encodeURIComponent(trimmedDoc)}`);
    consultar(trimmedCut, trimmedDoc);
  };

  const formatearEstadoPago = (estado: string) => {
    switch (estado) {
      case 'PAGADO':
      case 'CONFIRMADO':
        return { label: 'Tasa Pagada', badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
      case 'PENDIENTE':
      case 'PENDIENTE_PAGO':
        return { label: 'Pago Pendiente', badgeClass: 'bg-amber-100 text-amber-800 border-amber-300' };
      case 'EXONERADO':
      case 'NO_APLICA':
      default:
        return { label: 'Gratuito / No Aplica', badgeClass: 'bg-slate-100 text-slate-700 border-slate-300' };
    }
  };

  const infoPago = resultado ? formatearEstadoPago(resultado.estadoPago) : null;

  return (
    <main className="min-h-screen min-h-dvh bg-gradient-to-br from-slate-50 via-cyan-50/25 to-teal-50/15 py-10 px-4 sm:px-6 lg:px-8 text-slate-900">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Cabecera Institucional */}
        <section className="relative overflow-hidden rounded-3xl border border-white/80 bg-gradient-to-br from-white/90 via-cyan-50/40 to-teal-50/25 p-6 sm:p-8 shadow-[inset_0_1px_1px_0_rgba(255,255,255,0.95),inset_0_-1px_2px_0_rgba(6,182,212,0.06),0_16px_48px_-8px_rgba(6,182,212,0.14),0_2px_12px_-2px_rgba(0,0,0,0.02)] ring-1 ring-cyan-200/50 backdrop-blur-md space-y-6 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-[1.5px] before:bg-gradient-to-r before:from-transparent before:via-white before:to-transparent after:pointer-events-none after:absolute after:-top-24 after:-right-24 after:h-48 after:w-48 after:rounded-full after:bg-cyan-300/15 after:blur-2xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-100 pb-6 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Consulta Pública de Trámites y Expedientes
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                IESTP "Suiza" — Sede Digital y Transparencia Documentaria (Ley N° 27444 / Ley N° 29733)
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                to="/mesa-partes"
                className="text-xs font-semibold text-cyan-900 bg-white/90 border border-cyan-200/80 px-4 py-2 rounded-xl shadow-2xs hover:bg-cyan-50/80 hover:border-cyan-300 transition shrink-0"
              >
                Mesa de Partes Digital
              </Link>
              <Link
                to="/"
                className="text-xs font-semibold text-slate-700 bg-white/90 border border-slate-200 px-4 py-2 rounded-xl shadow-2xs hover:bg-slate-50 transition shrink-0"
              >
                ← Volver al Portal
              </Link>
            </div>
          </div>

          {/* Formulario de Búsqueda Seguro (CUT + Documento) */}
          <form onSubmit={handleBuscar} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="cut-input" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Código Único de Trámite (CUT) <span className="text-rose-500">*</span>
                </label>
                <input
                  id="cut-input"
                  type="text"
                  placeholder="Ejemplo: EXP-2026-000001"
                  value={cutInput}
                  onChange={(e) => setCutInput(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-cyan-200/90 bg-white/95 text-slate-800 placeholder-slate-400 font-mono text-sm uppercase shadow-xs focus:border-cyan-500 focus:ring-4 focus:ring-cyan-200/50 focus:outline-none transition"
                  required
                />
              </div>
              <div>
                <label htmlFor="doc-input" className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Documento del Solicitante (DNI / CE / RUC) <span className="text-rose-500">*</span>
                </label>
                <input
                  id="doc-input"
                  type="text"
                  placeholder="Ejemplo: 45678901"
                  value={documentoInput}
                  onChange={(e) => setDocumentoInput(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border border-cyan-200/90 bg-white/95 text-slate-800 placeholder-slate-400 font-mono text-sm shadow-xs focus:border-cyan-500 focus:ring-4 focus:ring-cyan-200/50 focus:outline-none transition"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
              <p className="text-xs text-slate-500">
                🔒 Por seguridad y confidencialidad (Ley N° 29733), se valida que el número de documento corresponda al titular del expediente.
              </p>
              <button
                type="submit"
                disabled={cargando}
                className="w-full sm:w-auto px-7 py-3 rounded-2xl bg-gradient-to-r from-teal-600 via-cyan-600 to-sky-600 hover:from-teal-700 hover:via-cyan-700 hover:to-sky-700 text-white font-bold shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98] shrink-0"
              >
                {cargando ? 'Consultando...' : 'Consultar Estado'}
              </button>
            </div>
          </form>

          {error && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-3">
              <span className="text-lg">⚠️</span>
              <div>
                <p className="font-semibold">Información de consulta</p>
                <p>{error}</p>
              </div>
            </div>
          )}
        </section>

        {/* Detalle del Expediente */}
        {resultado && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Header del Expediente */}
            <div className="bg-slate-900 px-6 py-5 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <span className="text-xs uppercase tracking-wider text-cyan-400 font-semibold">
                  Expediente Encontrado
                </span>
                <h2 className="text-2xl font-mono font-bold text-white tracking-wide">{resultado.cut}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-cyan-500/20 text-cyan-200 border border-cyan-400/30">
                  {resultado.estadoTramite}
                </span>
                {infoPago && (
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${infoPago.badgeClass}`}>
                    {infoPago.label}
                  </span>
                )}
              </div>
            </div>

            {/* Banner de Orientación y Próximo Paso */}
            <div className="bg-gradient-to-r from-cyan-50 via-teal-50/50 to-white p-6 border-b border-cyan-100">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border border-cyan-200/60 shadow-2xs">
                  <span className="text-xs font-bold uppercase tracking-wider text-cyan-800">Ubicación Actual</span>
                  <p className="text-base font-semibold text-slate-900 mt-1">{resultado.areaActual}</p>
                  <p className="text-xs text-slate-500 mt-0.5">Área institucional a cargo</p>
                </div>

                <div className="bg-white p-4 rounded-xl border border-cyan-200/60 shadow-2xs md:col-span-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-teal-800">Próximo Paso / Orientación</span>
                  <p className="text-sm font-medium text-slate-800 mt-1">{resultado.pasoSiguiente}</p>
                </div>
              </div>
            </div>

            {/* Datos Técnicos del Expediente */}
            <div className="p-6 sm:p-8 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
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
                    Foliación Oficial
                  </h3>
                  <p className="mt-1 text-slate-800 font-semibold">
                    {resultado.totalFolios} {resultado.totalFolios === 1 ? 'folio certificado' : 'folios certificados'}
                  </p>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Solicitante (Ley 29733)
                  </h3>
                  <p className="mt-1 text-slate-700 font-mono">
                    {resultado.administrado.nombreEnmascarado ?? 'Ciudadano Administrado'}
                  </p>
                  <p className="text-xs text-slate-400 font-mono">
                    Doc: {resultado.administrado.documentoEnmascarado ?? 'Reservado'}
                  </p>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Canal de Ingreso
                  </h3>
                  <p className="mt-1 text-slate-700 font-medium capitalize">
                    {resultado.canalRecepcion ? resultado.canalRecepcion.toLowerCase().replace(/_/g, ' ') : 'Mesa virtual'}
                  </p>
                  {resultado.fueraDeHorario && (
                    <span className="inline-block mt-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                      Corte Horario (Siguiente día hábil)
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Fecha Radicación Legal
                  </h3>
                  <p className="mt-1 text-slate-700">
                    {resultado.fechaRadicacionLegal
                      ? new Date(resultado.fechaRadicacionLegal).toLocaleString('es-PE')
                      : 'En trámite'}
                  </p>
                </div>
              </div>

              {/* Documentos Oficiales */}
              {resultado.documentos.length > 0 && (
                <div className="border-t border-slate-100 pt-6">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center justify-between">
                    <span>Documentos Oficiales Registrados</span>
                    <span className="text-xs text-slate-500 font-normal">{resultado.documentos.length} documento(s)</span>
                  </h3>
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                    {resultado.documentos.map((doc, idx) => (
                      <div key={idx} className="p-4 flex items-center justify-between text-sm bg-slate-50/50 hover:bg-slate-50 transition">
                        <div>
                          <p className="font-medium text-slate-800">{doc.nombreArchivo}</p>
                          <p className="text-xs text-slate-400 font-mono mt-0.5">
                            SHA-256: {doc.hashSha256.slice(0, 16)}...
                          </p>
                        </div>
                        <span className="text-xs bg-slate-200/70 text-slate-700 px-2.5 py-1 rounded-md font-mono">
                          {doc.contentType}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Proveídos Públicos */}
              {resultado.proveidos.length > 0 && (
                <div className="border-t border-slate-100 pt-6">
                  <h3 className="text-sm font-semibold text-slate-900 mb-3">
                    Actuaciones y Proveídos Institucionales
                  </h3>
                  <div className="space-y-3">
                    {resultado.proveidos.map((prov, idx) => (
                      <div key={idx} className="p-4 rounded-xl bg-teal-50/50 border border-teal-100">
                        <div className="flex justify-between items-center text-xs text-teal-800 font-semibold mb-1">
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
    </main>
  );
}
