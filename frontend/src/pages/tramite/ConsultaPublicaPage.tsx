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
