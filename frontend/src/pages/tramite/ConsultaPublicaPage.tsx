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
            <Link
              to="/"
              className="text-xs font-semibold text-cyan-900 bg-white/90 border border-cyan-200/80 px-4 py-2 rounded-xl shadow-2xs hover:bg-cyan-50/80 hover:border-cyan-300 transition shrink-0"
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
                className="w-full px-4.5 py-3 rounded-2xl border border-cyan-200/90 bg-white/95 text-slate-800 placeholder-slate-400 font-mono text-base uppercase shadow-[inset_0_2px_4px_rgba(0,0,0,0.03),0_2px_6px_rgba(6,182,212,0.06)] focus:border-cyan-500 focus:ring-4 focus:ring-cyan-200/50 focus:outline-none transition"
              />
            </div>
            <button
              type="submit"
              disabled={cargando}
              className="px-7 py-3 rounded-2xl bg-gradient-to-r from-teal-600 via-cyan-600 to-sky-600 hover:from-teal-700 hover:via-cyan-700 hover:to-sky-700 text-white font-bold shadow-[0_4px_16px_rgba(6,182,212,0.35),inset_0_1px_1px_rgba(255,255,255,0.4)] transition hover:shadow-[0_6px_20px_rgba(6,182,212,0.45)] disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              {cargando ? 'Buscando...' : 'Consultar Estado'}
            </button>
          </form>

          {error && (
            <div className="mt-4 p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm">
              {error}
            </div>
          )}
        </section>

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
    </main>
  );
}
