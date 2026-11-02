/**
 * ==============================================================================
 * PROYECTO: SIGD (Sistema Integral de Gestión Documentaria) - IESTP "Suiza"
 * MÓDULO 2: Registro Documentario - Mesa de Partes Virtual
 * TAREA: T-FE-MPV-15 — Subvista Modular 2: Documentos del Trámite
 * ARCHIVO: src/components/tramite/WizardSteps/StepDocumentos.tsx
 * ==============================================================================
 * DESCRIPCIÓN:
 * Subvista desacoplada para la selección de trámite TUPA institucional, registro
 * del asunto o petitorio sucinto, carga guiada de requisitos/anexos específicos
 * con cálculo automático de páginas físicas y foliación continua inmutable.
 *
 * Características:
 * - Detección y carga guiada de requisitos documentales específicos por TUPA.
 * - Validación reactiva de obligatoriedad de anexos digitales.
 * - Foliación automática basada en páginas físicas de PDF (1 pág = 1 folio).
 * - Validación de tamaño máximo de archivo (límite 25 MB según directiva LPAG).
 * - Accesibilidad WCAG 2.1 AA con contraste reforzado y alertas de error en rojo.
 * - Cero 'any', 100% tipado estricto con contratos de tramiteWizardState.ts.
 * ==============================================================================
 */

import React, { useId, useMemo, useRef, useState, useEffect } from 'react';
import type {
  DocumentosData,
  ArchivoTramite,
  WizardAction,
} from '../../../types/tramiteWizardState';
import { useProcedimientosTupa } from '../../../hooks/useProcedimientosTupa';
import SelectorTupaCategorias from '../SelectorTupaCategorias';
import {
  TupaCatalogoCargando,
  TupaCatalogoError,
  TupaCatalogoVacio,
} from '../TupaCatalogEstados';
import TupaDetalleProcedimiento from '../TupaDetalleProcedimiento';
import {
  obtenerRequisitosProcedimiento,
  type DtoRequisitosProcedimiento,
  type DtoRequisitoTupa,
} from '../../../services/procedimientosTupa.service';
import {
  contarPaginasPdfArchivo,
  recalcularRangosArchivos,
} from '../../../utils/foliacionPdf';

export interface StepDocumentosProps {
  /** Datos reactivos del paso de documentos */
  data: DocumentosData;
  /** Despachador de acciones atómicas hacia el reducer del wizard */
  dispatch: React.Dispatch<WizardAction>;
  /** Callback para avanzar al siguiente paso del asistente */
  onNext: () => void;
  /** Callback para retroceder al paso anterior */
  onBack: () => void;
  /** Indicador de procesamiento asíncrono o bloqueo de formulario */
  isSubmitting?: boolean;
  radicacionPendiente?: boolean;
}

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export const StepDocumentos: React.FC<StepDocumentosProps> = ({
  data,
  dispatch,
  onNext,
  onBack,
  isSubmitting = false,
  radicacionPendiente = false,
}) => {
  const formId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [fileError, setFileError] = useState<string | null>(null);
  const [procesandoArchivo, setProcesandoArchivo] = useState(false);

  // Requisitos estructurados por procedimiento TUPA
  const [requisitosEstructurados, setRequisitosEstructurados] = useState<DtoRequisitosProcedimiento | null>(null);
  const [cargandoRequisitos, setCargandoRequisitos] = useState(false);
  const [errorRequisitos, setErrorRequisitos] = useState<string | null>(null);

  // Catálogo TUPA versionado publicado por el backend definitivo.
  const {
    procedimientos,
    cargando,
    error: errorCatalogo,
    estaVacio,
    recargar,
  } = useProcedimientosTupa();

  const procedimientoSeleccionado = useMemo(
    () => procedimientos.find((p) => p.registroVersionId === data.tipoTramiteId),
    [procedimientos, data.tipoTramiteId],
  );

  const catalogoNoDisponible = cargando || Boolean(errorCatalogo) || estaVacio;

  // Cargar requisitos estructurados reactivamente cuando cambia el procedimiento TUPA
  useEffect(() => {
    if (!data.tipoTramiteId || data.tipoTramiteId === 'NO_TUPA') {
      setRequisitosEstructurados(null);
      setErrorRequisitos(null);
      setCargandoRequisitos(false);
      return;
    }

    const controller = new AbortController();
    setCargandoRequisitos(true);
    setErrorRequisitos(null);

    obtenerRequisitosProcedimiento(data.tipoTramiteId, controller.signal)
      .then((res) => {
        if (!controller.signal.aborted && res && Array.isArray(res.requisitos)) {
          setRequisitosEstructurados(res);
        } else if (!controller.signal.aborted) {
          setRequisitosEstructurados(null);
        }
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          console.warn('[StepDocumentos] Error al cargar requisitos TUPA:', err);
          setErrorRequisitos(err?.message || 'No se pudieron cargar los requisitos del procedimiento.');
          setRequisitosEstructurados(null);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setCargandoRequisitos(false);
        }
      });

    return () => controller.abort();
  }, [data.tipoTramiteId]);

  // Identificar requisitos documentales obligatorios faltantes
  const requisitosObligatoriosFaltantes = useMemo(() => {
    if (!requisitosEstructurados || !Array.isArray(requisitosEstructurados.anexosDigitales)) return [];
    const obligatorios = requisitosEstructurados.anexosDigitales.filter((r) => r && r.obligatorio);
    return obligatorios.filter(
      (req) => !(data.archivos ?? []).some((doc) => doc.idRequisito === req.idRequisito),
    );
  }, [requisitosEstructurados, data.archivos]);

  const requisitosFinancieros = useMemo(() => {
    if (!requisitosEstructurados || !Array.isArray(requisitosEstructurados.requisitos)) return [];
    return requisitosEstructurados.requisitos.filter((r) => r && r.tipoRequisito === 'FINANCIERO');
  }, [requisitosEstructurados]);

  const requisitosInternos = useMemo(() => {
    if (!requisitosEstructurados || !Array.isArray(requisitosEstructurados.requisitos)) return [];
    return requisitosEstructurados.requisitos.filter((r) => r && r.tipoRequisito === 'INTERNO');
  }, [requisitosEstructurados]);

  // ===========================================================================
  // VALIDACIÓN REACTIVA EN TIEMPO REAL
  // ===========================================================================
  const errors = useMemo(() => {
    const errs: Record<string, string> = {};

    // 1. Procedimiento Institucional
    if (!data.tipoTramiteId.trim()) {
      errs.tipoTramiteId = 'Debe seleccionar un procedimiento institucional o trámite TUPA.';
    } else if (data.tipoTramiteId !== 'NO_TUPA' && !procedimientoSeleccionado) {
      errs.tipoTramiteId = 'Seleccione un procedimiento vigente del catálogo oficial.';
    }

    // 2. Asunto / Petitorio sucinto
    const asuntoTrim = data.asunto.trim();
    if (!asuntoTrim) {
      errs.asunto = 'El asunto o petitorio sucinto es obligatorio.';
    } else if (asuntoTrim.length < 10) {
      errs.asunto = `El asunto debe contener al menos 10 caracteres (actual: ${asuntoTrim.length}).`;
    }

    // 3. Cantidad de Folios
    if (!data.numeroFolios || data.numeroFolios < 1) {
      errs.numeroFolios = 'La cantidad de folios debe ser al menos 1 folio útil.';
    } else if (data.numeroFolios > 500) {
      errs.numeroFolios = 'La cantidad máxima estimada por expediente es de 500 folios.';
    }

    // 4. Archivos adjuntos obligatorios
    if (data.archivos.length === 0) {
      errs.archivos = 'Debe adjuntar al menos un documento probatorio principal en formato PDF.';
    }

    // 5. Requisitos documentales obligatorios faltantes
    if (requisitosObligatoriosFaltantes.length > 0) {
      errs.requisitos = `Falta adjuntar ${requisitosObligatoriosFaltantes.length} anexo(s) obligatorio(s): ${requisitosObligatoriosFaltantes.map((r) => r.nombre).join(', ')}`;
    }

    return errs;
  }, [data, procedimientoSeleccionado, requisitosObligatoriosFaltantes]);

  const isValid = Object.keys(errors).length === 0;

  const markTouched = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleFieldChange = (field: keyof DocumentosData, value: unknown) => {
    if (radicacionPendiente) return;
    dispatch({
      type: 'UPDATE_DOCUMENTOS',
      payload: { [field]: value },
    });
  };

  // El valor TUPA es el registroVersionId real; NO_TUPA solo identifica el flujo libre en la UI.
  const handleSeleccionProcedimiento = (registroVersionId: string) => {
    if (radicacionPendiente) return;
    const seleccion = procedimientos.find((p) => p.registroVersionId === registroVersionId);
    dispatch({
      type: 'UPDATE_DOCUMENTOS',
      payload: {
        tipoTramiteId: registroVersionId,
        tipoTramiteCodigo: seleccion?.codigo,
        tipoTramiteDenominacion: registroVersionId === 'NO_TUPA'
          ? 'Trámite no TUPA / documentación general'
          : seleccion?.denominacion,
      },
    });
  };

  // Procesamiento binario de archivo PDF con conteo real de páginas y SHA-256
  const procesarYAdjuntarPdf = async (file: File, requisito?: DtoRequisitoTupa) => {
    setFileError(null);

    // Validación de tipo de archivo
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setFileError('Solo se permiten archivos en formato PDF (Estándar PDF/A).');
      return;
    }

    // Validación de tamaño máximo (25 MB)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFileError(
        `El archivo excede el tamaño máximo permitido de 25 MB (tamaño actual: ${(
          file.size /
          (1024 * 1024)
        ).toFixed(2)} MB).`
      );
      return;
    }

    setProcesandoArchivo(true);
    try {
      const paginas = await contarPaginasPdfArchivo(file);
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

      const nuevoArchivo: ArchivoTramite = {
        nombre: file.name,
        peso: file.size,
        hashSha256: hashHex,
        file,
        paginas,
        idRequisito: requisito?.idRequisito ?? null,
        nombreRequisito: requisito?.nombre ?? (requisito ? 'Requisito TUPA' : 'Documento Sustentatorio'),
      };

      if (
        radicacionPendiente &&
        !data.archivos.some(
          (archivo) =>
            archivo.hashSha256 === hashHex &&
            archivo.peso === file.size &&
            archivo.nombre === file.name
        )
      ) {
        setFileError('El expediente ya fue creado. Seleccione exactamente el PDF original para reintentar la carga.');
        return;
      }

      if (
        !radicacionPendiente &&
        data.archivos.some(
          (archivo) =>
            archivo.hashSha256 === hashHex &&
            (!requisito || archivo.idRequisito !== requisito.idRequisito)
        )
      ) {
        setFileError('Este PDF ya está adjunto. Seleccione un documento diferente.');
        return;
      }

      // Si se cargó para un requisito específico, reemplazar el archivo anterior de ese requisito
      const otrosArchivos = requisito
        ? data.archivos.filter((a) => a.idRequisito !== requisito.idRequisito)
        : data.archivos.filter((a) => a.hashSha256 !== hashHex);

      const listaActualizada = [...otrosArchivos, nuevoArchivo];
      const { archivosConFolios, totalFolios } = recalcularRangosArchivos(listaActualizada);

      dispatch({
        type: 'UPDATE_DOCUMENTOS',
        payload: {
          archivos: archivosConFolios,
          numeroFolios: Math.max(1, totalFolios),
        },
      });
    } catch (err: unknown) {
      console.error('[StepDocumentos] Error al procesar archivo PDF:', err);
      setFileError('No se pudo procesar el archivo PDF: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setProcesandoArchivo(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleGeneralFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await procesarYAdjuntarPdf(file);
    }
  };

  const handleRemoveArchivo = (indexToRemove: number) => {
    if (radicacionPendiente) return;
    const filtrados = data.archivos.filter((_, idx) => idx !== indexToRemove);
    const { archivosConFolios, totalFolios } = recalcularRangosArchivos(filtrados);
    dispatch({
      type: 'UPDATE_DOCUMENTOS',
      payload: {
        archivos: archivosConFolios,
        numeroFolios: totalFolios > 0 ? totalFolios : 1,
      },
    });
  };

  const handleRemovePorRequisito = (idRequisito: string) => {
    if (radicacionPendiente) return;
    const filtrados = data.archivos.filter((a) => a.idRequisito !== idRequisito);
    const { archivosConFolios, totalFolios } = recalcularRangosArchivos(filtrados);
    dispatch({
      type: 'UPDATE_DOCUMENTOS',
      payload: {
        archivos: archivosConFolios,
        numeroFolios: totalFolios > 0 ? totalFolios : 1,
      },
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({
      tipoTramiteId: true,
      asunto: true,
      numeroFolios: true,
      archivos: true,
      requisitos: true,
    });

    if (isValid && !isSubmitting) {
      onNext();
    }
  };

  return (
    <form
      id={`${formId}-form`}
      onSubmit={handleSubmit}
      noValidate
      className="space-y-6"
    >
      <header className="border-b border-slate-200 pb-4">
        <span className="text-xs font-bold uppercase tracking-wider text-[#006EC7]">
          Paso 2 de 4
        </span>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
          Documentos del Trámite
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Seleccione el procedimiento TUPA formal, describa el petitorio y adjunte los documentos probatorios escaneados en PDF.
        </p>
      </header>

      <div className="space-y-5">
        {/* 1. Selección de Procedimiento TUPA */}
        <div>
          <label
            htmlFor={`${formId}-tipoTramiteId`}
            className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
          >
            Procedimiento Institucional o Trámite TUPA <span className="text-red-600">*</span>
          </label>
          {/* Selector TUPA por Categorías y Búsqueda */}
          {!catalogoNoDisponible && (
            <div className="mb-2">
              <SelectorTupaCategorias
                procedimientos={procedimientos}
                value={data.tipoTramiteId}
                onChange={handleSeleccionProcedimiento}
                disabled={isSubmitting || radicacionPendiente}
                error={touched.tipoTramiteId ? errors.tipoTramiteId : undefined}
                permitirNoTupa={true}
                onBlur={() => markTouched('tipoTramiteId')}
              />
            </div>
          )}

          {/* Selector accesible para lectores de pantalla y compatibilidad de formulario */}
          <select
            id={`${formId}-tipoTramiteId`}
            name="tipoTramiteId"
            required
            aria-required="true"
            aria-invalid={touched.tipoTramiteId && Boolean(errors.tipoTramiteId)}
            aria-describedby={
              touched.tipoTramiteId && errors.tipoTramiteId
                ? `${formId}-tipoTramiteId-error`
                : undefined
            }
            value={data.tipoTramiteId}
            onChange={(e) => handleSeleccionProcedimiento(e.target.value)}
            onBlur={() => markTouched('tipoTramiteId')}
            disabled={isSubmitting || radicacionPendiente}
            className="sr-only"
            tabIndex={-1}
          >
            <option value="">-- Seleccione un procedimiento oficial --</option>
            <option value="NO_TUPA">Trámite no TUPA / documentación general</option>
            {procedimientos.map((t) => (
              <option key={t.registroVersionId} value={t.registroVersionId}>
                {t.denominacion}
              </option>
            ))}
          </select>

          {cargando && <TupaCatalogoCargando />}
          {!cargando && errorCatalogo && (
            <TupaCatalogoError error={errorCatalogo} onRetry={recargar} />
          )}
          {estaVacio && <TupaCatalogoVacio />}

          {touched.tipoTramiteId && errors.tipoTramiteId && !catalogoNoDisponible && (
            <p
              id={`${formId}-tipoTramiteId-error`}
              role="alert"
              className="mt-1.5 text-xs text-red-600 font-medium"
            >
              {errors.tipoTramiteId}
            </p>
          )}

          {procedimientoSeleccionado && (
            <div className="mt-3">
              <TupaDetalleProcedimiento procedimiento={procedimientoSeleccionado} />
            </div>
          )}
        </div>

        {/* 2. Asunto / Petitorio Sucinto */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label
              htmlFor={`${formId}-asunto`}
              className="block text-xs font-bold uppercase tracking-wider text-slate-700"
            >
              Asunto o Petitorio Sucinto <span className="text-red-600">*</span>
            </label>
            <span
              className={`text-[11px] font-mono ${
                data.asunto.trim().length < 10 && touched.asunto
                  ? 'text-red-600 font-bold'
                  : 'text-slate-400'
              }`}
            >
              {data.asunto.length}/300 caracteres (mínimo 10)
            </span>
          </div>
          <textarea
            id={`${formId}-asunto`}
            name="asunto"
            rows={3}
            maxLength={300}
            required
            aria-required="true"
            aria-invalid={touched.asunto && Boolean(errors.asunto)}
            aria-describedby={
              touched.asunto && errors.asunto ? `${formId}-asunto-error` : undefined
            }
            placeholder="Describa claramente su solicitud dirigida a la Dirección del Instituto de Educación Superior Tecnológico Público Suiza..."
            value={data.asunto}
            onChange={(e) => handleFieldChange('asunto', e.target.value)}
            readOnly={radicacionPendiente}
            onBlur={() => markTouched('asunto')}
            disabled={isSubmitting || radicacionPendiente}
            className={`w-full rounded-lg border px-3.5 py-2.5 text-sm shadow-xs focus:outline-none focus:ring-2 transition ${
              touched.asunto && errors.asunto
                ? 'border-red-500 bg-red-50/30 text-red-900 focus:border-red-500 focus:ring-red-200'
                : 'border-slate-300 bg-white text-slate-900 focus:border-[#006EC7] focus:ring-[#006EC7]/20'
            } disabled:bg-slate-100 placeholder:text-slate-400`}
          />
          {touched.asunto && errors.asunto && (
            <p
              id={`${formId}-asunto-error`}
              role="alert"
              className="mt-1.5 text-xs text-red-600 font-medium"
            >
              {errors.asunto}
            </p>
          )}
        </div>

        {/* Cantidad de Folios */}
        <div className="max-w-xs">
          <label
            htmlFor={`${formId}-numeroFolios`}
            className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
          >
            Cantidad Estimada de Folios <span className="text-red-600">*</span>
          </label>
          <input
            id={`${formId}-numeroFolios`}
            name="numeroFolios"
            type="number"
            min={1}
            max={500}
            required
            aria-required="true"
            aria-invalid={touched.numeroFolios && Boolean(errors.numeroFolios)}
            aria-describedby={
              touched.numeroFolios && errors.numeroFolios
                ? `${formId}-numeroFolios-error`
                : undefined
            }
            value={data.numeroFolios}
            onChange={(e) =>
              handleFieldChange('numeroFolios', parseInt(e.target.value, 10) || 1)
            }
            onBlur={() => markTouched('numeroFolios')}
            disabled={isSubmitting}
            className={`w-full rounded-lg border px-3.5 py-2.5 text-sm font-mono shadow-xs focus:outline-none focus:ring-2 transition ${
              touched.numeroFolios && errors.numeroFolios
                ? 'border-red-500 bg-red-50/30 text-red-900 focus:border-red-500 focus:ring-red-200'
                : 'border-slate-300 bg-white text-slate-900 focus:border-[#006EC7] focus:ring-[#006EC7]/20'
            } disabled:bg-slate-100`}
          />
          {touched.numeroFolios && errors.numeroFolios ? (
            <p
              id={`${formId}-numeroFolios-error`}
              role="alert"
              className="mt-1.5 text-xs text-red-600 font-medium"
            >
              {errors.numeroFolios}
            </p>
          ) : (
            <p className="mt-1 text-[11px] text-slate-500">
              Número de caras numeradas o páginas útiles que componen el expediente.
            </p>
          )}
        </div>

        {/* 3. Panel de Requisitos Estructurados TUPA */}
        {cargandoRequisitos && (
          <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
            <svg className="animate-spin h-4 w-4 text-blue-600" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            <span>Cargando requisitos específicos y anexos obligatorios del procedimiento...</span>
          </div>
        )}

        {errorRequisitos && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
            ⚠️ {errorRequisitos}
          </div>
        )}

        {requisitosEstructurados && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Requisitos Específicos del Trámite ({requisitosEstructurados.codigoRef})
                </h3>
                <p className="text-xs text-slate-500">
                  Cargue los anexos solicitados. La foliación se calculará de manera automática por página física.
                </p>
              </div>
              <div className="flex gap-2">
                <span className="text-[11px] px-2 py-0.5 rounded font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  {requisitosEstructurados.totalRequisitos} en catálogo
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                  {requisitosEstructurados.anexosDigitales.length} anexos documentales
                </span>
              </div>
            </div>

            {/* Lista de Anexos Digitales / Documentales */}
            {requisitosEstructurados.anexosDigitales.length > 0 ? (
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Anexos Documentales Requeridos:
                </p>
                <div className="grid gap-3 sm:grid-cols-1">
                  {requisitosEstructurados.anexosDigitales.map((req, idx) => {
                    const docCargado = data.archivos.find((a) => a.idRequisito === req.idRequisito);
                    return (
                      <div
                        key={req.idRequisito}
                        className={`rounded-lg border p-4 transition ${
                          docCargado
                            ? 'border-emerald-300 bg-emerald-50/40'
                            : req.obligatorio
                            ? 'border-amber-300 bg-amber-50/30'
                            : 'border-slate-200 bg-slate-50/50'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-700">
                                #{idx + 1}
                              </span>
                              <span className="text-xs font-semibold text-slate-900">
                                {req.nombre}
                              </span>
                              {req.obligatorio ? (
                                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-red-100 text-red-700 border border-red-200">
                                  Obligatorio
                                </span>
                              ) : (
                                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                  Opcional
                                </span>
                              )}
                            </div>
                            {req.descripcion && (
                              <p className="text-xs text-slate-500">
                                {req.descripcion}
                              </p>
                            )}
                          </div>

                          <div className="shrink-0 flex items-center gap-2">
                            {docCargado ? (
                              <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1 rounded bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800 border border-emerald-300">
                                  ✓ Folios {docCargado.folioInicio} al {docCargado.folioFin} ({docCargado.paginas} {docCargado.paginas === 1 ? 'pág' : 'págs'})
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRemovePorRequisito(req.idRequisito)}
                                  disabled={isSubmitting || radicacionPendiente}
                                  className="text-xs font-bold text-red-600 hover:text-red-800 hover:underline px-2 py-1 cursor-pointer"
                                  title="Quitar anexo"
                                >
                                  Quitar
                                </button>
                              </div>
                            ) : (
                              <label className="inline-flex items-center gap-1.5 rounded-lg border border-[#006EC7] bg-white px-3 py-1.5 text-xs font-bold text-[#006EC7] hover:bg-blue-50 transition cursor-pointer shadow-2xs">
                                <span>Cargar PDF</span>
                                <input
                                  type="file"
                                  accept=".pdf,application/pdf"
                                  className="sr-only"
                                  disabled={isSubmitting || radicacionPendiente || procesandoArchivo}
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      await procesarYAdjuntarPdf(file, req);
                                    }
                                  }}
                                />
                              </label>
                            )}
                          </div>
                        </div>

                        {docCargado && (
                          <div className="mt-2 pt-2 border-t border-emerald-200 flex flex-wrap items-center justify-between text-[11px] text-slate-600">
                            <span className="font-mono truncate max-w-xs sm:max-w-md">
                              📄 {docCargado.nombre} ({(docCargado.peso / 1024).toFixed(1)} KB)
                            </span>
                            <span className="font-mono text-slate-400 text-[10px]">
                              SHA-256: {docCargado.hashSha256.substring(0, 16)}...
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600">
                ℹ️ Este procedimiento no requiere anexos documentales obligatorios conforme al TUPA oficial vigente. Puede adjuntar su solicitud o petitorio general a continuación.
              </div>
            )}

            {/* Requisitos Financieros e Internos Informativos */}
            {(requisitosFinancieros.length > 0 ||
              requisitosInternos.length > 0) && (
              <div className="pt-2 border-t border-slate-100 grid gap-3 sm:grid-cols-2 text-xs">
                {requisitosFinancieros.length > 0 && (
                  <div className="rounded-lg bg-blue-50/50 border border-blue-100 p-3">
                    <p className="font-bold text-blue-900 mb-1">
                      💳 Requisito Financiero:
                    </p>
                    <ul className="list-disc list-inside text-slate-600 space-y-0.5">
                      {requisitosFinancieros.map((rf: DtoRequisitoTupa) => (
                        <li key={rf.idRequisito}>{rf.nombre}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {requisitosInternos.length > 0 && (
                  <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                    <p className="font-bold text-slate-800 mb-1">
                      🏛️ Verificación Interna / De Oficio:
                    </p>
                    <ul className="list-disc list-inside text-slate-600 space-y-0.5">
                      {requisitosInternos.map((ri: DtoRequisitoTupa) => (
                        <li key={ri.idRequisito}>{ri.nombre}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Alerta de Requisitos Obligatorios Faltantes */}
        {touched.requisitos && errors.requisitos && (
          <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-red-700">
            ⚠️ {errors.requisitos}
          </div>
        )}

        {/* 4. Resumen de Foliación Automática */}
        <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
                Foliación Automática Inmutable (Regla 1 Pág = 1 Folio)
              </span>
              <p className="text-xs text-slate-600 mt-0.5">
                Total de folios útiles calculados para el expediente documental:
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-baseline gap-1 bg-white border border-blue-300 rounded-lg px-4 py-2 shadow-2xs">
                <span className="text-2xl font-black text-blue-900 font-mono">
                  {data.numeroFolios || 1}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  {data.numeroFolios === 1 ? 'folio útil' : 'folios útiles'}
                </span>
              </div>
            </div>
          </div>

          {/* Desglose secuencial continuo */}
          {data.archivos.length > 0 && (
            <div className="mt-3 pt-3 border-t border-blue-100">
              <p className="text-[11px] font-bold text-blue-900 mb-1.5">
                Secuencia continua de foliatura:
              </p>
              <div className="flex flex-wrap gap-2 text-xs">
                {data.archivos.map((a, i) => (
                  <span
                    key={`${a.nombre}-${i}`}
                    className="inline-flex items-center gap-1.5 rounded bg-white px-2.5 py-1 text-[11px] border border-blue-200 font-mono text-slate-700 shadow-2xs"
                  >
                    <span className="font-bold text-blue-700">#{i + 1}</span>
                    <span className="truncate max-w-[140px]">{a.nombre}</span>
                    <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                      f. {a.folioInicio}-{a.folioFin} ({a.paginas}p)
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 5. Carga Documentaria General o Adicional en PDF */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Documentación Sustentatoria / Solicitud Libre en PDF <span className="text-red-600">*</span>
              </h3>
              <p className="text-xs text-slate-500">
                Adjunte su formulario, solicitud o documento probatorio en formato PDF (máximo 25 MB por archivo).
              </p>
            </div>
          </div>

          {/* Zona de Drop / Carga de Archivo */}
          <label
            htmlFor={`${formId}-file-upload`}
            className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-white p-5 text-center cursor-pointer hover:border-[#006EC7] hover:bg-blue-50/20 transition"
          >
            <svg
              className="h-8 w-8 text-slate-400 mb-1.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <span className="text-sm font-semibold text-[#006EC7]">
              {procesandoArchivo ? 'Analizando páginas y foliación...' : 'Haga clic aquí para seleccionar su archivo PDF'}
            </span>
            <span className="text-xs text-slate-400 mt-0.5">
              Cálculo de integridad criptográfica SHA-256 y foliación física en navegador
            </span>
            <input
              id={`${formId}-file-upload`}
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="sr-only"
              onChange={handleGeneralFileChange}
              disabled={isSubmitting || procesandoArchivo}
            />
          </label>

          {/* Error de archivo */}
          {fileError && (
            <p role="alert" className="text-xs font-semibold text-red-600">
              ⚠️ {fileError}
            </p>
          )}

          {/* Alerta si no hay archivos y el paso fue tocado */}
          {touched.archivos && errors.archivos && (
            <p role="alert" className="text-xs font-semibold text-red-600">
              ⚠️ {errors.archivos}
            </p>
          )}

          {/* Listado de archivos cargados */}
          {data.archivos.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-xs font-bold text-slate-700">
                Archivos adjuntados al expediente ({data.archivos.length}):
              </p>
              {data.archivos.map((archivo, index) => (
                <div
                  key={`${archivo.nombre}-${index}`}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-xs"
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <span className="shrink-0 rounded bg-red-100 px-2 py-0.5 font-bold text-red-700">
                      PDF
                    </span>
                    <div className="truncate">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900 truncate">
                          {archivo.nombre}
                        </p>
                        {archivo.nombreRequisito && (
                          <span className="shrink-0 rounded bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.2 text-[10px] font-semibold">
                            {archivo.nombreRequisito}
                          </span>
                        )}
                        <span className="shrink-0 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.2 text-[10px] font-mono font-bold">
                          Folios {archivo.folioInicio} - {archivo.folioFin} ({archivo.paginas}p)
                        </span>
                      </div>
                      <p className="text-slate-400 font-mono text-[10px] truncate">
                        SHA-256: {archivo.hashSha256.substring(0, 24)}... •{' '}
                        {(archivo.peso / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveArchivo(index)}
                    disabled={isSubmitting || radicacionPendiente}
                    className="ml-3 shrink-0 rounded px-2 py-1 font-bold text-red-600 hover:bg-red-50 cursor-pointer"
                  >
                    Eliminar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* BOTONERA DE NAVEGACIÓN ACCESIBLE */}
      <footer className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200 pt-5">
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting || radicacionPendiente}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 cursor-pointer"
        >
          ← Anterior
        </button>

        <button
          type="submit"
          disabled={!isValid || isSubmitting}
          className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg px-6 py-2.5 text-xs font-bold text-white shadow-xs transition ${
            isValid && !isSubmitting
              ? 'bg-[#006EC7] hover:bg-[#005ba3] cursor-pointer'
              : 'bg-slate-300 text-slate-500 cursor-not-allowed'
          }`}
        >
          Siguiente →
        </button>
      </footer>
    </form>
  );
};

export default StepDocumentos;
