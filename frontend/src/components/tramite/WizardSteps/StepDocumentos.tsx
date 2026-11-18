/**
 * ==============================================================================
 * PROYECTO: SIGD (Sistema Integral de Gestión Documentaria) - IESTP "Suiza"
 * MÓDULO 2: Registro Documentario - Mesa de Partes Virtual
 * TAREA: T-FE-MPV-15 — Subvista Modular 2: Documentos del Trámite
 * ARCHIVO: src/components/tramite/WizardSteps/StepDocumentos.tsx
 * ==============================================================================
 * DESCRIPCIÓN:
 * Subvista desacoplada para la selección de trámite TUPA institucional, registro
 * del asunto o petitorio sucinto, conteo de folios y carga probatoria de PDFs
 * con cálculo de huella criptográfica SHA-256.
 *
 * Características:
 * - Validación reactiva de obligatoriedad, longitud mínima de asunto y archivos PDF.
 * - Validación de tamaño máximo de archivo (20 MiB según el contrato de radicación).
 * - Accesibilidad WCAG 2.1 AA con contraste reforzado y alertas de error en rojo.
 * - Cero 'any', 100% tipado estricto con contratos de tramiteWizardState.ts.
 * ==============================================================================
 */

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import type {
  DocumentosData,
  ArchivoTramite,
  WizardAction,
} from '../../../types/tramiteWizardState';
import { apiClient } from '../../../api/client';
import { usePresignedUpload } from '../../../hooks/usePresignedUpload';

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
}

// Referencias heredadas solo para rotular borradores antiguos; no se ofrecen para nuevas selecciones.
const CATALOGO_TUPA_INSTITUCIONAL = [
  {
    id: 'TUPA-01',
    nombre: 'Certificado Oficial de Estudios (Por Semestre o Ciclo Completo)',
    unidad: 'Secretaría Académica',
  },
  {
    id: 'TUPA-02',
    nombre: 'Constancia de Matrícula, Egresado y No Adeudo',
    unidad: 'Dirección de Asuntos Académicos',
  },
  {
    id: 'TUPA-03',
    nombre: 'Expedición de Título Profesional Técnico a Nombre de la Nación',
    unidad: 'Área de Titulación y Grados',
  },
  {
    id: 'TUPA-04',
    nombre: 'Rectificación de Matrícula o Reserva de Vacante Temporal',
    unidad: 'Jefatura de Unidad Académica',
  },
  {
    id: 'TUPA-05',
    nombre: 'Convalidación y Homologación de Unidades Didácticas (Módulos)',
    unidad: 'Coordinación de Programas de Estudio',
  },
  {
    id: 'LIBRE-01',
    nombre: 'Solicitud Formal General / Trámite Libre Institucional',
    unidad: 'Mesa de Partes General',
  },
] as const;

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // Límite del contrato de radicación.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface TipoTramiteFormal {
  id: string;
  codigo: string;
  denominacion: string;
  unidad_organica: string | null;
  descripcion?: string | null;
  vigente: true;
}

function validarTiposFormales(data: unknown): TipoTramiteFormal[] | null {
  if (!Array.isArray(data)) return null;
  const tipos: TipoTramiteFormal[] = [];
  const ids = new Set<string>();
  const codigos = new Set<string>();

  for (const item of data) {
    if (
      typeof item !== 'object' || item === null ||
      !('id' in item) || typeof item.id !== 'string' || !UUID_RE.test(item.id) ||
      !('codigo' in item) || typeof item.codigo !== 'string' || !item.codigo.trim() ||
      !('denominacion' in item) || typeof item.denominacion !== 'string' || !item.denominacion.trim() ||
      !('vigente' in item) || item.vigente !== true ||
      !('unidad_organica' in item) ||
      (item.unidad_organica !== null && typeof item.unidad_organica !== 'string') ||
      ('descripcion' in item && item.descripcion !== null && typeof item.descripcion !== 'string')
    ) return null;

    const id = item.id.toLowerCase();
    const codigo = item.codigo.trim();
    if (ids.has(id) || codigos.has(codigo)) return null;
    ids.add(id);
    codigos.add(codigo);
    tipos.push({
      id: item.id,
      codigo,
      denominacion: item.denominacion.trim(),
      unidad_organica: item.unidad_organica,
      descripcion: 'descripcion' in item ? item.descripcion as string | null : undefined,
      vigente: true,
    });
  }
  return tipos;
}

export const StepDocumentos: React.FC<StepDocumentosProps> = ({
  data,
  dispatch,
  onNext,
  onBack,
  isSubmitting = false,
}) => {
  const formId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [fileError, setFileError] = useState<string | null>(null);
  const subida = usePresignedUpload({ diferirRegistroAdjunto: true });
  const cargandoArchivo = !['idle', 'success', 'cancelled', 'error'].includes(subida.status);
  useEffect(() => () => subida.cancel(), [subida.cancel]);
  const [tiposFormales, setTiposFormales] = useState<TipoTramiteFormal[]>([]);
  const [cargandoCatalogo, setCargandoCatalogo] = useState(true);
  const [errorCatalogo, setErrorCatalogo] = useState<string | null>(null);
  const [intentoCatalogo, setIntentoCatalogo] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setCargandoCatalogo(true);
    setErrorCatalogo(null);

    apiClient.get<unknown>('/api/v1/tramites/tipos', { signal: controller.signal })
      .then((respuesta) => {
        if (controller.signal.aborted) return;
        const tipos = validarTiposFormales(respuesta.data);
        if (!tipos) {
          setTiposFormales([]);
          setErrorCatalogo('El catálogo formal devolvió datos incompletos o ambiguos. No se puede seleccionar un procedimiento para radicar.');
          return;
        }
        setTiposFormales(tipos);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setTiposFormales([]);
          setErrorCatalogo('No se pudo consultar el catálogo formal de trámites. Reintente antes de continuar.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setCargandoCatalogo(false);
      });

    return () => controller.abort();
  }, [intentoCatalogo]);

  // ===========================================================================
  // VALIDACIÓN REACTIVA EN TIEMPO REAL
  // ===========================================================================
  const errors = useMemo(() => {
    const errs: Record<string, string> = {};

    // 1. Procedimiento Institucional
    if (cargandoCatalogo || errorCatalogo) {
      errs.tipoTramiteId = 'Debe verificarse el catálogo formal antes de continuar.';
    } else if (!data.tipoTramiteId.trim()) {
      errs.tipoTramiteId = 'Debe seleccionar un procedimiento institucional o trámite TUPA.';
    } else if (!tiposFormales.some((tipo) => tipo.id === data.tipoTramiteId)) {
      errs.tipoTramiteId = 'La selección guardada no pertenece al catálogo formal vigente. Seleccione nuevamente un tipo disponible.';
    }

    // 2. Asunto / Petitorio sucinto
    const asuntoTrim = data.asunto.trim();
    if (!asuntoTrim) {
      errs.asunto = 'El asunto o petitorio sucinto es obligatorio.';
    } else if (asuntoTrim.length < 10) {
      errs.asunto = `El asunto debe contener al menos 10 caracteres (actual: ${asuntoTrim.length}).`;
    } else if (asuntoTrim.length > 500) {
      errs.asunto = 'El asunto no puede superar los 500 caracteres.';
    }

    // 3. Cantidad de Folios
    if (!Number.isInteger(data.numeroFolios) || data.numeroFolios < 1) {
      errs.numeroFolios = 'La cantidad de folios debe ser al menos 1 folio útil.';
    } else if (data.numeroFolios > 5000) {
      errs.numeroFolios = 'La cantidad máxima por expediente es de 5000 folios.';
    }

    // 4. Archivos adjuntos obligatorios
    if (data.archivos.length === 0) {
      errs.archivos = 'El contrato de envío requiere al menos un archivo PDF.';
    } else if (data.archivos.some((archivo) =>
      !archivo.storageUrl || !/^expedientes\/\d{4}\/[0-9a-f-]+\.pdf$/i.test(archivo.storageUrl) ||
      !/^[0-9a-f]{64}$/i.test(archivo.hashSha256) ||
      !Number.isInteger(archivo.peso) || archivo.peso <= 0 || archivo.peso > MAX_FILE_SIZE_BYTES
    )) {
      errs.archivos = 'Hay archivos sin una referencia de almacenamiento válida. Retire los archivos locales o de demostración y cargue el documento antes de continuar.';
    }

    return errs;
  }, [data, cargandoCatalogo, errorCatalogo, tiposFormales]);

  const isValid = Object.keys(errors).length === 0;
  const tipoSeleccionado = tiposFormales.find((tipo) => tipo.id === data.tipoTramiteId);

  const markTouched = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleFieldChange = (field: keyof DocumentosData, value: unknown) => {
    dispatch({
      type: 'UPDATE_DOCUMENTOS',
      payload: { [field]: value },
    });
  };

  // Carga y validación binaria de archivos PDF con SHA-256
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (cargandoArchivo) return;
    setFileError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Validación de tipo de archivo
    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setFileError('Solo se permiten archivos en formato PDF (Estándar PDF/A).');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Validación de tamaño máximo del endpoint de radicación (20 MiB).
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFileError(
        `El archivo excede el tamaño máximo permitido de 20 MB (tamaño actual: ${(
          file.size /
          (1024 * 1024)
        ).toFixed(2)} MB).`
      );
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    try {
      const archivoSubido = await subida.upload(file);
      if (!archivoSubido) return;

      const nuevoArchivo: ArchivoTramite = {
        nombre: file.name,
        peso: file.size,
        hashSha256: archivoSubido.sha256,
        storageUrl: archivoSubido.s3Key,
      };

      dispatch({
        type: 'UPDATE_DOCUMENTOS',
        payload: {
          archivos: [...data.archivos, nuevoArchivo],
        },
      });
    } catch (error) {
      setFileError(error instanceof Error ? error.message : 'No se pudo completar la carga del archivo seleccionado. Reintente antes de continuar.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveArchivo = (indexToRemove: number) => {
    const filtrados = data.archivos.filter((_, idx) => idx !== indexToRemove);
    dispatch({
      type: 'UPDATE_DOCUMENTOS',
      payload: { archivos: filtrados },
    });
  };

  const handleSimularArchivoPrueba = () => {
    const dummy: ArchivoTramite = {
      nombre: 'solicitud_firmada_estudios_2026.pdf',
      peso: 154230,
      hashSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    };
    dispatch({
      type: 'UPDATE_DOCUMENTOS',
      payload: { archivos: [...data.archivos, dummy] },
    });
    setFileError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({
      tipoTramiteId: true,
      asunto: true,
      numeroFolios: true,
      archivos: true,
    });

    if (isValid && !isSubmitting && !cargandoArchivo) {
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
            onChange={(e) => handleFieldChange('tipoTramiteId', e.target.value)}
            onBlur={() => markTouched('tipoTramiteId')}
            disabled={isSubmitting}
            className={`w-full rounded-lg border px-3.5 py-2.5 text-sm shadow-xs focus:outline-none focus:ring-2 transition cursor-pointer ${
              touched.tipoTramiteId && errors.tipoTramiteId
                ? 'border-red-500 bg-red-50/30 text-red-900 focus:border-red-500 focus:ring-red-200'
                : 'border-slate-300 bg-white text-slate-900 focus:border-[#006EC7] focus:ring-[#006EC7]/20'
            } disabled:bg-slate-100`}
          >
            <option value="">{cargandoCatalogo ? 'Cargando tipos formales…' : '-- Seleccione un tipo disponible --'}</option>
            {data.tipoTramiteId && !tiposFormales.some((tipo) => tipo.id === data.tipoTramiteId) && (
              <option value={data.tipoTramiteId} disabled>
                Selección guardada pendiente de revalidación: {CATALOGO_TUPA_INSTITUCIONAL.find((tipo) => tipo.id === data.tipoTramiteId)?.nombre ?? data.tipoTramiteId}
              </option>
            )}
            {tiposFormales.map((tipo) => (
              <option key={tipo.id} value={tipo.id}>
                {tipo.codigo} — {tipo.denominacion}{tipo.unidad_organica ? ` (${tipo.unidad_organica})` : ''}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-slate-600">
            Se muestran los procedimientos vigentes del catálogo formal del backend. Los 75 conceptos informativos de Ventanilla no constituyen automáticamente trámites radicables ni acreditan aprobación institucional.
          </p>
          {tipoSeleccionado && (
            <div className="mt-2 space-y-1 text-xs text-slate-600">
              {tipoSeleccionado.descripcion && <p>{tipoSeleccionado.descripcion}</p>}
              <p>La API disponible no informa los requisitos documentales ni su obligatoriedad para este procedimiento. La descripción no constituye una lista de adjuntos exigibles.</p>
            </div>
          )}
          {cargandoCatalogo && <p role="status" className="mt-1 text-xs text-slate-500">Consultando tipos formales…</p>}
          {!cargandoCatalogo && !errorCatalogo && tiposFormales.length === 0 && (
            <p role="status" className="mt-1 text-xs text-slate-600">El backend no informa tipos formales vigentes disponibles.</p>
          )}
          {errorCatalogo && (
            <div role="alert" className="mt-1.5 text-xs text-red-700">
              <p>{errorCatalogo}</p>
              <button type="button" className="mt-1 font-bold underline" onClick={() => setIntentoCatalogo((valor) => valor + 1)} disabled={cargandoCatalogo}>
                Reintentar consulta
              </button>
            </div>
          )}
          {touched.tipoTramiteId && errors.tipoTramiteId && (
            <p
              id={`${formId}-tipoTramiteId-error`}
              role="alert"
              className="mt-1.5 text-xs text-red-600 font-medium"
            >
              {errors.tipoTramiteId}
            </p>
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
            onBlur={() => markTouched('asunto')}
            disabled={isSubmitting}
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

        {/* 3. Cantidad de Folios */}
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
            max={5000}
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
              handleFieldChange('numeroFolios', Number(e.target.value))
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

        {/* 4. Carga Documentaria con cálculo de SHA-256 */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Archivos adjuntos en PDF <span className="text-red-600">*</span>
              </h3>
              <p className="text-xs text-slate-500">
                El envío requiere al menos un archivo PDF (máximo 20 MB por archivo). Esta exigencia técnica no determina qué documentos son requisitos institucionales del procedimiento.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSimularArchivoPrueba}
              disabled={isSubmitting || cargandoArchivo}
              className="text-xs font-bold text-[#006EC7] hover:underline self-start sm:self-auto cursor-pointer"
            >
              + Cargar PDF de prueba
            </button>
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
              Haga clic aquí para seleccionar su archivo PDF
            </span>
            <span className="text-xs text-slate-400 mt-0.5">
              Cálculo de integridad criptográfica SHA-256 en navegador
            </span>
            <input
              id={`${formId}-file-upload`}
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="sr-only"
              onChange={handleFileChange}
              disabled={isSubmitting || cargandoArchivo}
            />
          </label>

          {/* Error de archivo */}
          {cargandoArchivo && <p role="status">Subiendo archivo: {subida.progress}%</p>}
          {(fileError || subida.error) && (
            <p role="alert" className="text-xs font-semibold text-red-600">
              ⚠️ {fileError ?? subida.error?.message}
            </p>
          )}

          {/* Alerta si no hay archivos y el paso fue tocado */}
          {(touched.archivos || data.archivos.length > 0) && errors.archivos && (
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
                      <p className="font-semibold text-slate-900 truncate">
                        {archivo.nombre}
                      </p>
                      <p className="text-slate-400 font-mono text-[10px] truncate">
                        SHA-256: {archivo.hashSha256.substring(0, 24)}... •{' '}
                        {(archivo.peso / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveArchivo(index)}
                    disabled={isSubmitting}
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
          disabled={isSubmitting || cargandoArchivo}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 cursor-pointer"
        >
          ← Anterior
        </button>

        <button
          type="submit"
          disabled={!isValid || isSubmitting || cargandoArchivo}
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
