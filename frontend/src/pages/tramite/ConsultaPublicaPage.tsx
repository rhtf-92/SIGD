import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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
  const navigate = useNavigate();
  const [cutInput, setCutInput] = useState(cut ?? '');
  const [resultado, setResultado] = useState<DtoConsultaPublica | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cut) {
      setCutInput(cut);
      consultar(cut);
    }
  }, [cut]);

  const consultar = async (codigoCut: string) => {
    const trimmed = codigoCut.trim().toUpperCase();
    if (!trimmed) {
      setError('Por favor, ingrese un código CUT válido.');
      return;
    }

    setCargando(true);
    setError(null);

    try {
      const res = await apiClient.get<DtoConsultaPublica>(
        `/api/v1/tramites/consulta-publica/${encodeURIComponent(trimmed)}`
      );
      setResultado(res.data);
    } catch (err: unknown) {
      setResultado(null);
      setError(
        'No se encontró ningún expediente con el código CUT ingresado o ocurrió un error en la consulta.'
      );
    } finally {
      setCargando(false);
    }
  };

  const handleBuscar = (e: React.FormEvent) => {
    e.preventDefault();
    if (cutInput.trim()) {
      navigate(`/consulta/${encodeURIComponent(cutInput.trim().toUpperCase())}`);
    }
  };

  return (
    <div className="flex-1 w-full bg-slate-50 py-6 px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16">
      <div className="w-full max-w-6xl 2xl:max-w-7xl mx-auto space-y-6 sm:space-y-8">
        {/* Migajas de pan canónicas */}
        <nav
          aria-label="Migajas de pan de consulta pública"
          className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-500"
        >
          <Link to="/" className="hover:text-emerald-700 hover:underline transition-colors">
            Inicio
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-slate-600">Transparencia</span>
          <span className="text-slate-300">/</span>
          <span aria-current="page" className="font-semibold text-emerald-700">
            Consulta Pública CUT
          </span>
        </nav>

        {/* Cabecera Institucional */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5 sm:pb-6 mb-5 sm:mb-6">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                Consulta Pública de Trámites y Expedientes
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                IESTP "Suiza" — Sede Digital y Transparencia Documentaria (Ley N° 27444 / Ley N° 29733)
              </p>
            </div>
            <Link
              to="/"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-700 shadow-xs transition hover:bg-slate-100 hover:text-emerald-700 self-start sm:self-center"
            >
              ← Volver al Portal
            </Link>
          </div>

          {/* Formulario de Búsqueda */}
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
                className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-800 placeholder-slate-400 font-mono text-sm sm:text-base uppercase"
              />
            </div>
            <button
              type="submit"
              disabled={cargando}
              className="w-full sm:w-auto px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm transition disabled:opacity-50 flex items-center justify-center gap-2 text-sm sm:text-base"
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

        {/* Detalle del Expediente */}
        {resultado && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 px-6 py-5 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
              <div>
                <span className="text-xs uppercase tracking-wider text-emerald-400 font-semibold">
                  Expediente Encontrado
                </span>
                <h2 className="text-2xl font-mono font-bold">{resultado.cut}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {resultado.fueraDeHorario ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    ⏰ Fuera de Horario (Corte 4:30 PM)
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    ⏱️ En Horario Hábil
                  </span>
                )}
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {resultado.estadoTramite}
                </span>
              </div>
            </div>

            <div className="p-6 sm:p-8 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="sm:col-span-2 lg:col-span-3">
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
                    Solicitante (Ley N° 29733)
                  </h3>
                  <p className="mt-1 text-slate-700 font-mono">
                    {resultado.administrado.nombreEnmascarado ?? 'Ciudadano Administrado'} (
                    {resultado.administrado.documentoEnmascarado ?? 'Documento Reservado'})
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Canal y Folios
                  </h3>
                  <p className="mt-1 text-slate-700 font-medium">
                    {resultado.canalRecepcion === 'MESA_VIRTUAL' ? 'Mesa de Partes Virtual' : 'Ventanilla Presencial'} ({resultado.totalFolios} {resultado.totalFolios === 1 ? 'folio' : 'folios'})
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Fecha y Hora de Recepción Real
                  </h3>
                  <p className="mt-1 text-slate-700 font-medium">
                    {resultado.fechaEnvioReal
                      ? new Date(resultado.fechaEnvioReal).toLocaleString('es-PE')
                      : 'En trámite'}
                  </p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Fecha de Radicación Legal (Art. 138 LPAG)
                  </h3>
                  <p className="mt-1 text-slate-700 font-medium">
                    {resultado.fechaRadicacionLegal
                      ? new Date(resultado.fechaRadicacionLegal).toLocaleString('es-PE')
                      : 'En trámite'}
                  </p>
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
                <div className="border-t border-slate-100 pt-5">
                  <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                    resultado.fueraDeHorario
                      ? 'bg-amber-50/80 border-amber-200/90 text-amber-900'
                      : 'bg-emerald-50/80 border-emerald-200/90 text-emerald-900'
                  }`}>
                    <span className="text-lg leading-none mt-0.5">
                      {resultado.fueraDeHorario ? '⚖️' : 'ℹ️'}
                    </span>
                    <div className="text-xs space-y-1">
                      <p className="font-semibold text-slate-900">
                        Régimen de Recepción y Cómputo de Plazos (TUO Ley N° 27444 - LPAG)
                      </p>
                      <p className="leading-relaxed text-slate-700">
                        {resultado.mensajeLegal}
                      </p>
                      <p className="text-[11px] text-slate-500 pt-0.5">
                        Horario de atención institucional presencial: Lunes a Viernes de 08:00 a 16:30 hrs. Las radicaciones virtuales recibidas fuera de este rango inician su cómputo formal el día hábil inmediato siguiente a las 08:00 hrs.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
