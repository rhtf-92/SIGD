import React, { useCallback, useEffect, useId, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  FileCheck2,
  FileText,
  Fingerprint,
  Layers,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client';
import '../../styles/consulta-publica.css';

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

export interface ConsultaExpedientePublicoProps {
  initialCut?: string;
  syncUrl?: boolean;
  titulo?: string;
  subtitulo?: string;
  mostrarEnlacePortal?: boolean;
  asPageHeading?: boolean;
}

const ETAPAS_TRAMITE = [
  'Recepcionado',
  'En evaluación',
  'Resuelto',
  'Notificado / Archivado',
] as const;

export function calcularPasoEstado(estadoTramite: string): number {
  const normalizado = estadoTramite.trim().toUpperCase();
  if (
    ['NOTIFICADO', 'ARCHIVADO', 'CERRADO', 'ENTREGADO'].includes(normalizado)
  ) {
    return 3;
  }
  if (
    ['RESUELTO', 'APROBADO', 'FINALIZADO', 'ATENDIDO', 'CONCLUIDO'].includes(
      normalizado,
    )
  ) {
    return 2;
  }
  if (
    [
      'EN_TRAMITE',
      'EN_EVALUACION',
      'DERIVADO',
      'OBSERVADO',
      'SUBSANADO',
      'EN_REVISION',
      'EN_PROCESO',
    ].includes(normalizado)
  ) {
    return 1;
  }
  return 0;
}

export default function ConsultaExpedientePublico({
  initialCut,
  syncUrl = false,
  titulo = 'Consulta Pública de Trámites y Expedientes',
  subtitulo = 'IESTP "Suiza" — Sede Digital y Transparencia Documentaria (Ley N° 27444 / Ley N° 29733)',
  mostrarEnlacePortal = false,
  asPageHeading = false,
}: ConsultaExpedientePublicoProps) {
  const navigate = useNavigate();
  const inputId = useId();
  const [prevInitialCut, setPrevInitialCut] = useState(initialCut);
  const [cutInput, setCutInput] = useState(initialCut ?? '');
  const [resultado, setResultado] = useState<DtoConsultaPublica | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  if (initialCut !== prevInitialCut) {
    setPrevInitialCut(initialCut);
    setCutInput(initialCut ?? '');
  }

  const consultar = useCallback(async (codigoCut: string) => {
    const trimmed = codigoCut.trim().toUpperCase();
    if (!trimmed) {
      setError('Por favor, ingrese un código CUT válido.');
      return;
    }

    setCargando(true);
    setError(null);
    setCopiado(false);

    try {
      const res = await apiClient.get<DtoConsultaPublica>(
        `/api/v1/tramites/consulta-publica/${encodeURIComponent(trimmed)}`,
      );
      setResultado(res.data);
    } catch {
      setResultado(null);
      setError(
        'No se encontró ningún expediente con el código CUT ingresado o ocurrió un error en la consulta.',
      );
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (!initialCut) return undefined;
    const temporizador = window.setTimeout(() => void consultar(initialCut), 0);
    return () => window.clearTimeout(temporizador);
  }, [consultar, initialCut]);

  const handleBuscar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = cutInput.trim().toUpperCase();
    if (!trimmed) {
      setError('Por favor, ingrese un código CUT válido.');
      return;
    }
    if (syncUrl && trimmed !== (initialCut ?? '').trim().toUpperCase()) {
      navigate(`/consulta/${encodeURIComponent(trimmed)}`);
      return;
    }
    void consultar(trimmed);
  };

  const handleLimpiar = () => {
    setCutInput('');
    setError(null);
    setCopiado(false);
  };

  const handleCopiarCut = async () => {
    if (!resultado?.cut) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(resultado.cut);
      }
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  };

  const pasoActual = resultado ? calcularPasoEstado(resultado.estadoTramite) : 0;

  return (
    <div className="sigd-tracker">
      {/* Hero Holográfico de Búsqueda */}
      <section className="sigd-tracker-hero">
        <div className="sigd-tracker-hero-halo" aria-hidden="true" />

        <div className="sigd-tracker-hero-head">
          <div className="sigd-tracker-hero-intro">
            <div
              className="sigd-tracker-radar"
              data-searching={cargando ? 'true' : 'false'}
              aria-hidden="true"
            >
              <span className="sigd-tracker-radar-ring sigd-tracker-radar-ring--outer" />
              <span className="sigd-tracker-radar-ring sigd-tracker-radar-ring--inner" />
              <div className="sigd-tracker-radar-core">
                <FileCheck2 size={24} />
                <span className="sigd-tracker-radar-scan" />
              </div>
            </div>

            <div className="sigd-tracker-hero-text">
              <div className="sigd-tracker-eyebrow">
                <Sparkles size={13} aria-hidden="true" />
                <span>Seguimiento Digital en Línea</span>
              </div>
              {asPageHeading ? (
                <h1 className="sigd-tracker-title">{titulo}</h1>
              ) : (
                <h2 className="sigd-tracker-title">{titulo}</h2>
              )}
              <p className="sigd-tracker-subtitle">{subtitulo}</p>
            </div>
          </div>

          {mostrarEnlacePortal && (
            <Link to="/" className="sigd-public-back-btn">
              <ArrowLeft size={15} aria-hidden="true" />
              <span>Volver al Portal</span>
            </Link>
          )}
        </div>

        <form onSubmit={handleBuscar} className="sigd-tracker-search">
          <div className="sigd-tracker-input-wrap">
            <Search
              size={18}
              className="sigd-tracker-search-icon"
              aria-hidden="true"
            />
            <label htmlFor={inputId} className="sr-only">
              Código Único de Trámite (CUT)
            </label>
            <input
              id={inputId}
              type="text"
              placeholder="Ejemplo: EXP-2026-000003"
              value={cutInput}
              onChange={(e) => setCutInput(e.target.value)}
              className="sigd-tracker-input"
            />
            {cutInput.length > 0 && (
              <button
                type="button"
                onClick={handleLimpiar}
                aria-label="Limpiar código CUT"
                className="sigd-tracker-clear"
              >
                <X size={15} aria-hidden="true" />
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={cargando}
            className="sigd-tracker-submit"
          >
            {cargando ? (
              <>
                <span className="sigd-tracker-spinner" aria-hidden="true" />
                <span>Buscando...</span>
              </>
            ) : (
              <>
                <Search size={17} aria-hidden="true" />
                <span>Consultar Estado</span>
              </>
            )}
          </button>
        </form>

        {error && (
          <div role="alert" className="sigd-tracker-error">
            <AlertCircle size={18} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}
      </section>

      {/* Estado de carga animado */}
      {cargando && (
        <div className="sigd-tracker-skeleton" role="status" aria-live="polite">
          <div className="sigd-tracker-skeleton-status">
            <span className="sigd-tracker-spinner" aria-hidden="true" />
            <span>Consultando expediente en la sede digital...</span>
          </div>
          <div className="sigd-tracker-skeleton-bar is-wide" />
          <div className="sigd-tracker-skeleton-bar is-medium" />
          <div className="sigd-tracker-skeleton-bar is-short" />
        </div>
      )}

      {/* Guías rápidas iniciales (antes de mostrar resultados) */}
      {!cargando && !resultado && (
        <section
          className="sigd-tracker-guides"
          aria-label="Guía rápida de consulta"
        >
          <article className="sigd-tracker-guide-card">
            <span className="sigd-tracker-guide-num">01</span>
            <h3>Ingresa tu código CUT</h3>
            <p>
              Escribe el código único asignado al presentar tu solicitud (por ejemplo{' '}
              <code>EXP-2026-000003</code>).
            </p>
          </article>
          <article className="sigd-tracker-guide-card">
            <span className="sigd-tracker-guide-num">02</span>
            <h3>Avance en tiempo real</h3>
            <p>
              Visualiza la etapa actual de tu expediente, documentos oficiales adjuntos y proveídos públicos.
            </p>
          </article>
          <article className="sigd-tracker-guide-card">
            <span className="sigd-tracker-guide-num">03</span>
            <h3>Privacidad Ley N° 29733</h3>
            <p>
              Tu identidad se muestra enmascarada de forma automática para proteger tus datos personales.
            </p>
          </article>
        </section>
      )}

      {/* Dossier del Expediente Encontrado */}
      {!cargando && resultado && (
        <article className="sigd-tracker-dossier">
          <div className="sigd-tracker-panel sigd-tracker-reveal">
            <div className="sigd-tracker-dossier-head">
              <div>
                <div className="sigd-tracker-found-tag">
                  <CheckCircle2 size={15} aria-hidden="true" />
                  <span>Expediente Encontrado</span>
                </div>
                <div className="sigd-tracker-cut-row">
                  <h3 className="sigd-tracker-cut-code">{resultado.cut}</h3>
                  <button
                    type="button"
                    onClick={handleCopiarCut}
                    className={`sigd-tracker-copy-btn${copiado ? ' is-copied' : ''}`}
                  >
                    {copiado ? (
                      <>
                        <Check size={14} aria-hidden="true" />
                        <span>Copiado</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} aria-hidden="true" />
                        <span>Copiar CUT</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <span className="sigd-tracker-status-pill">
                <span className="sigd-tracker-live-dot" aria-hidden="true" />
                <span>{resultado.estadoTramite}</span>
              </span>
            </div>

            <div className="sigd-tracker-dossier-body">
              {resultado.fueraDeHorario && (
                <div className="sigd-tracker-notice">
                  <AlertCircle size={17} aria-hidden="true" />
                  <span>
                    Documento recibido fuera del horario de atención presencial; su radicación legal rige desde el siguiente día hábil.
                  </span>
                </div>
              )}

              {/* Línea de progreso animada en 4 etapas */}
              <div className="sigd-tracker-stepper-wrap sigd-tracker-reveal sigd-tracker-reveal--d1">
                <p className="sigd-tracker-stepper-heading">
                  <span>Estado del Flujo Documentario</span>
                  <span>Etapa {pasoActual + 1} de {ETAPAS_TRAMITE.length}</span>
                </p>
                <div className="sigd-tracker-stepper-stage">
                  <div className="sigd-tracker-stepper-track" aria-hidden="true">
                    <div
                      className="sigd-tracker-stepper-fill"
                      style={
                        {
                          '--tracker-progress': String(pasoActual / 3),
                        } as React.CSSProperties
                      }
                    />
                  </div>
                  <ol
                    aria-label="Progreso del trámite"
                    className="sigd-tracker-stepper"
                  >
                    {ETAPAS_TRAMITE.map((etapa, idx) => {
                      const completada = idx < pasoActual;
                      const actual = idx === pasoActual;
                      const estadoClase = completada
                        ? ' is-done'
                        : actual
                          ? ' is-current'
                          : '';
                      return (
                        <li
                          key={etapa}
                          aria-current={actual ? 'step' : undefined}
                          className={`sigd-tracker-step${estadoClase}`}
                        >
                          <span className="sigd-tracker-step-node" aria-hidden="true">
                            {completada ? <Check size={16} /> : idx + 1}
                          </span>
                          <span className="sigd-tracker-step-label">{etapa}</span>
                        </li>
                      );
                    })}
                  </ol>
                </div>
              </div>

              {/* Asunto / Petitorio destacado */}
              <div className="sigd-tracker-asunto sigd-tracker-reveal sigd-tracker-reveal--d1">
                <span className="sigd-tracker-field-label">Asunto / Petitorio</span>
                <p className="sigd-tracker-asunto-text">{resultado.asunto}</p>
              </div>

              {/* Bento Grid de Metadatos */}
              <div className="sigd-tracker-bento sigd-tracker-reveal sigd-tracker-reveal--d2">
                <div className="sigd-tracker-meta-card">
                  <span className="sigd-tracker-meta-icon" aria-hidden="true">
                    <FileText size={19} />
                  </span>
                  <div className="sigd-tracker-meta-body">
                    <span className="sigd-tracker-field-label">
                      Tipo de Procedimiento
                    </span>
                    <p className="sigd-tracker-meta-value">
                      {resultado.tipoTramite ?? 'Trámite General'}
                    </p>
                  </div>
                </div>

                <div className="sigd-tracker-meta-card">
                  <span className="sigd-tracker-meta-icon" aria-hidden="true">
                    <ShieldCheck size={19} />
                  </span>
                  <div className="sigd-tracker-meta-body">
                    <span className="sigd-tracker-field-label">
                      Solicitante (Protección de Datos - Ley 29733)
                    </span>
                    <p className="sigd-tracker-meta-value">
                      {resultado.administrado.nombreEnmascarado ??
                        'Ciudadano Administrado'}
                    </p>
                    <p className="sigd-tracker-meta-sub">
                      {resultado.administrado.documentoEnmascarado ??
                        'Documento Reservado'}
                    </p>
                  </div>
                </div>

                <div className="sigd-tracker-meta-card">
                  <span className="sigd-tracker-meta-icon" aria-hidden="true">
                    <Calendar size={19} />
                  </span>
                  <div className="sigd-tracker-meta-body">
                    <span className="sigd-tracker-field-label">
                      Fecha de Radicación Legal
                    </span>
                    <p className="sigd-tracker-meta-value">
                      {resultado.fechaRadicacionLegal
                        ? new Date(resultado.fechaRadicacionLegal).toLocaleString(
                            'es-PE',
                          )
                        : 'En trámite'}
                    </p>
                  </div>
                </div>

                <div className="sigd-tracker-meta-card">
                  <span className="sigd-tracker-meta-icon" aria-hidden="true">
                    <Layers size={19} />
                  </span>
                  <div className="sigd-tracker-meta-body">
                    <span className="sigd-tracker-field-label">
                      Canal y Folios Registrados
                    </span>
                    <p className="sigd-tracker-meta-value">
                      {resultado.canalRecepcion}
                    </p>
                    <p className="sigd-tracker-meta-sub">
                      Total de folios: {resultado.totalFolios}
                    </p>
                  </div>
                </div>
              </div>

              {/* Documentos Oficiales Adjuntos */}
              {resultado.documentos.length > 0 && (
                <section className="sigd-tracker-reveal sigd-tracker-reveal--d2">
                  <h4 className="sigd-tracker-section-title">
                    <FileText size={17} aria-hidden="true" />
                    <span>Documentos Oficiales Adjuntos</span>
                  </h4>
                  <div className="sigd-tracker-doc-list">
                    {resultado.documentos.map((doc, idx) => (
                      <div
                        key={`${doc.hashSha256}-${idx}`}
                        className="sigd-tracker-doc-item"
                      >
                        <div className="sigd-tracker-doc-left">
                          <span
                            className="sigd-tracker-doc-badge"
                            aria-hidden="true"
                          >
                            <FileCheck2 size={18} />
                          </span>
                          <div>
                            <p className="sigd-tracker-doc-name">
                              {doc.nombreArchivo}
                            </p>
                            <p className="sigd-tracker-doc-hash">
                              <Fingerprint size={13} aria-hidden="true" />
                              <span>SHA-256: {doc.hashSha256.slice(0, 16)}...</span>
                            </p>
                          </div>
                        </div>
                        <span className="sigd-tracker-mime-pill">
                          {doc.contentType}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Timeline de Actuaciones y Proveídos Públicos */}
              {resultado.proveidos.length > 0 && (
                <section className="sigd-tracker-reveal sigd-tracker-reveal--d3">
                  <h4 className="sigd-tracker-section-title">
                    <Clock size={17} aria-hidden="true" />
                    <span>Actuaciones y Proveídos Públicos</span>
                  </h4>
                  <div className="sigd-tracker-timeline">
                    {resultado.proveidos.map((prov, idx) => (
                      <div
                        key={`${prov.numero}-${idx}`}
                        className="sigd-tracker-timeline-item"
                      >
                        <div className="sigd-tracker-timeline-head">
                          <span>{prov.numero}</span>
                          <span>
                            {new Date(prov.fechaEmision).toLocaleDateString(
                              'es-PE',
                            )}
                          </span>
                        </div>
                        <p className="sigd-tracker-timeline-text">
                          {prov.resumen}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Franja Legal */}
              {resultado.mensajeLegal && (
                <div className="sigd-tracker-legal sigd-tracker-reveal sigd-tracker-reveal--d3">
                  <ShieldCheck size={16} aria-hidden="true" />
                  <span>{resultado.mensajeLegal}</span>
                </div>
              )}
            </div>
          </div>
        </article>
      )}
    </div>
  );
}
