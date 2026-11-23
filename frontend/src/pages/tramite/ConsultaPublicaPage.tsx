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
    <div
      className="relative w-full min-h-[calc(100vh-96px)] text-slate-800 flex flex-col overflow-x-hidden bg-[#eef4fb] bg-cover bg-center bg-no-repeat"
      style={{
        backgroundImage: "url('/images/fondo-consuttramite.png')",
        backgroundAttachment: "fixed",
      }}
    >
      {/* 1. Fondo fijo de respaldo continuo con fondo-consuttramite.png */}
      <div
        className="pointer-events-none fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: "url('/images/fondo-consuttramite.png')",
        }}
        aria-hidden="true"
      />

      {/* 2. Área principal de contenido */}
      <main className="relative z-10 w-full pt-6 sm:pt-10 pb-16 px-4 sm:px-6 lg:px-8 flex-1">
        <div className="mx-auto w-[94%] max-w-[1180px] space-y-8">
          {/* Tarjeta Principal de Consulta Pública */}
          <div className="rounded-3xl border border-sky-100/80 bg-white shadow-[0_16px_40px_-8px_rgba(2,30,80,0.1),0_4px_16px_-2px_rgba(2,30,80,0.05)] overflow-hidden transition-all duration-300">
            {/* Cabecera Superior: Ícono + Título en 2 líneas + Botón Volver al Portal */}
            <div className="p-6 sm:p-8 lg:p-10 flex flex-col md:flex-row md:items-start md:justify-between gap-6">
              <div className="flex items-start gap-5 sm:gap-6 min-w-0">
                {/* Círculo / Ícono suave con documento y lupa */}
                <div className="flex h-16 w-16 sm:h-20 sm:w-20 shrink-0 items-center justify-center rounded-full bg-blue-50/90 border border-blue-200/80 text-[#0073E6] shadow-xs">
                  <svg
                    className="w-8 h-8 sm:w-10 sm:h-10 text-[#0073E6]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.75}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                    <circle cx="15.5" cy="15.5" r="3.5" strokeWidth={1.75} />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.75}
                      d="M18 18l3 3"
                    />
                  </svg>
                </div>

                {/* Separador vertical fino */}
                <div className="hidden sm:block h-16 sm:h-20 w-px bg-slate-200 shrink-0" />

                {/* Título en dos líneas + subtítulo + subrayado azul */}
                <div className="min-w-0">
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#082F7C] tracking-tight leading-tight">
                    Consulta Pública de <br className="hidden sm:inline" />
                    Trámites y Expedientes
                  </h1>
                  <p className="mt-1.5 text-sm sm:text-base text-slate-500 font-normal leading-relaxed">
                    Conozca el estado de sus trámites y expedientes en línea.
                  </p>
                  <div className="w-14 sm:w-16 h-1 bg-[#0073E6] rounded-full mt-3" />
                </div>
              </div>

              {/* Botón superior derecho "← Volver al Portal" con borde azul redondeado */}
              <Link
                to="/"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full border-2 border-[#0073E6] text-[#0073E6] hover:bg-[#0073E6] hover:text-white font-semibold text-xs sm:text-sm transition-all duration-200 shadow-2xs group shrink-0 self-start"
              >
                <span className="transition-transform group-hover:-translate-x-0.5 font-bold">←</span>
                <span>Volver al Portal</span>
              </Link>
            </div>

            {/* Barra Inferior de Consulta de Expediente */}
            <div className="border-t border-slate-100 bg-[#f8fafc]/95 px-6 sm:px-8 py-5 sm:py-6">
              <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
                {/* A la izquierda: Ícono azul "i" + etiqueta "Ejemplo:" + píldora "EXP-2026-000104" */}
                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0073E6] text-white text-xs font-serif font-bold shadow-xs">
                    i
                  </span>
                  <span className="text-xs sm:text-sm font-semibold text-slate-600">
                    Ejemplo:
                  </span>
                  <button
                    type="button"
                    onClick={() => setCutInput("EXP-2026-000104")}
                    className="inline-flex items-center px-2.5 py-1 rounded-md bg-blue-100 text-[#0073E6] font-mono text-xs font-bold hover:bg-blue-200 transition cursor-pointer select-all shadow-2xs"
                    title="Hacer clic para usar el código de ejemplo"
                  >
                    EXP-2026-000104
                  </button>
                </div>

                {/* Formulario de Búsqueda: Input con ícono a la derecha y Botón Verde sólido */}
                <form onSubmit={handleBuscar} className="flex-1 flex flex-col sm:flex-row items-center gap-3 w-full">
                  <div className="relative w-full flex-1">
                    <label htmlFor="cut-input" className="sr-only">
                      Código Único de Trámite (CUT)
                    </label>
                    <input
                      id="cut-input"
                      type="text"
                      placeholder="Ingrese el número de expediente... (EXP-2026-000104)"
                      value={cutInput}
                      onChange={(e) => setCutInput(e.target.value)}
                      className="w-full pl-4 pr-11 py-3 sm:py-3.5 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 font-mono text-sm sm:text-base uppercase shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#0073E6]/30 focus:border-[#0073E6] transition"
                    />
                    {/* Ícono de documento/lupa dentro del input a la derecha */}
                    <div className="pointer-events-none absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400">
                      <svg
                        className="w-5 h-5 text-slate-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>
                  </div>

                  {/* A la derecha: Botón verde sólido redondeado con lupa y texto "Consultar Estado >" */}
                  <button
                    type="submit"
                    disabled={cargando}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl bg-[#008744] hover:bg-[#007338] text-white font-bold text-sm sm:text-base shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    <svg
                      className="w-4 h-4 text-white shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2.5}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                    <span>{cargando ? 'Buscando...' : 'Consultar Estado >'}</span>
                  </button>
                </form>
              </div>

              {/* Mensaje de Error */}
              {error && (
                <div className="mt-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-3 animate-fadeIn">
                  <svg
                    className="w-5 h-5 text-rose-600 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                  <span>{error}</span>
                </div>
              )}
            </div>
          </div>

          {/* Detalle del Expediente Resultante */}
          {resultado && (
            <div className="rounded-3xl border border-sky-100/90 bg-white shadow-[0_16px_40px_-8px_rgba(2,30,80,0.09)] overflow-hidden transition-all duration-300">
              {/* Cabecera del expediente en azul institucional */}
              <div className="bg-gradient-to-r from-[#05224a] via-[#072a5a] to-[#0a356e] px-6 sm:px-8 py-5 text-white flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shadow-sm">
                <div>
                  <span className="text-xs uppercase tracking-wider text-sky-300 font-bold block">
                    Expediente Encontrado
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-mono font-black text-white tracking-wide">
                    {resultado.cut}
                  </h2>
                </div>
                <span className="inline-flex items-center px-4 py-1.5 rounded-full text-xs font-bold bg-[#1877f2]/30 text-sky-200 border border-sky-400/30 shadow-xs">
                  {resultado.estadoTramite}
                </span>
              </div>

              {/* Información y Datos del Expediente */}
              <div className="p-6 sm:p-8 space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="bg-slate-50/70 rounded-xl p-4 border border-slate-100">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Asunto / Petitorio
                    </h3>
                    <p className="mt-1 text-slate-900 font-medium leading-relaxed">
                      {resultado.asunto}
                    </p>
                  </div>
                  <div className="bg-slate-50/70 rounded-xl p-4 border border-slate-100">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Tipo de Procedimiento
                    </h3>
                    <p className="mt-1 text-slate-900 font-medium">
                      {resultado.tipoTramite ?? 'Trámite General'}
                    </p>
                  </div>
                  <div className="bg-slate-50/70 rounded-xl p-4 border border-slate-100">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Solicitante (Protección de Datos - Ley 29733)
                    </h3>
                    <p className="mt-1 text-slate-800 font-mono">
                      {resultado.administrado.nombreEnmascarado ?? 'Ciudadano Administrado'} (
                      {resultado.administrado.documentoEnmascarado ?? 'Documento Reservado'})
                    </p>
                  </div>
                  <div className="bg-slate-50/70 rounded-xl p-4 border border-slate-100">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Fecha de Radicación Legal
                    </h3>
                    <p className="mt-1 text-slate-800">
                      {resultado.fechaRadicacionLegal
                        ? new Date(resultado.fechaRadicacionLegal).toLocaleString('es-PE')
                        : 'En trámite'}
                    </p>
                  </div>
                </div>

                {/* Documentos Adjuntos */}
                {resultado.documentos.length > 0 && (
                  <div className="border-t border-slate-100 pt-6">
                    <h3 className="text-sm font-bold text-[#082F7C] uppercase tracking-wide mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4 text-[#0073E6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                      </svg>
                      <span>Documentos Oficiales Adjuntos</span>
                    </h3>
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                      {resultado.documentos.map((doc, idx) => (
                        <div key={idx} className="p-4 flex items-center justify-between text-sm bg-slate-50/40 hover:bg-slate-50 transition">
                          <div>
                            <p className="font-semibold text-slate-800">{doc.nombreArchivo}</p>
                            <p className="text-xs text-slate-400 font-mono mt-0.5">
                              SHA-256: {doc.hashSha256.slice(0, 16)}...
                            </p>
                          </div>
                          <span className="text-xs bg-slate-200 text-slate-700 px-2.5 py-1 rounded-md font-medium">
                            {doc.contentType}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actuaciones y Proveídos Públicos */}
                {resultado.proveidos.length > 0 && (
                  <div className="border-t border-slate-100 pt-6">
                    <h3 className="text-sm font-bold text-[#082F7C] uppercase tracking-wide mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4 text-[#0073E6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <span>Actuaciones y Proveídos Públicos</span>
                    </h3>
                    <div className="space-y-3">
                      {resultado.proveidos.map((prov, idx) => (
                        <div key={idx} className="p-4 rounded-xl bg-blue-50/40 border border-blue-100/80 shadow-2xs">
                          <div className="flex justify-between items-center text-xs text-[#082F7C] font-bold mb-1">
                            <span>{prov.numero}</span>
                            <span>{new Date(prov.fechaEmision).toLocaleDateString('es-PE')}</span>
                          </div>
                          <p className="text-sm text-slate-700 leading-relaxed">{prov.resumen}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mensaje Legal */}
                {resultado.mensajeLegal && (
                  <div className="border-t border-slate-100 pt-4 text-xs text-slate-500 italic bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                    {resultado.mensajeLegal}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
