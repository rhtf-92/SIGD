/**
 * ==============================================================================
 * PROYECTO: SIGD (Sistema Integral de Gestión Documentaria) - IESTP "Suiza"
 * MÓDULO 2: Registro Documentario - Mesa de Partes Virtual
 * TAREA: T-FE-MPV-15 — Subvista Modular 2: Documentos del Trámite
 * ARCHIVO: src/components/tramite/WizardSteps/StepDocumentos.tsx
 * ==============================================================================
 * DESCRIPCIÓN:
 * Subvista desacoplada para la selección de trámite TUPA institucional, registro
 * del asunto o petitorio sucinto, conteo de folios y carga probatoria de documentos
 * institucionales (PDF, Word .doc/.docx e imágenes .png/.jpg) con cálculo de
 * huella criptográfica SHA-256 y subida a almacenamiento institucional.
 *
 * Características:
 * - Aceptación flexible de formatos comunes (.pdf, .doc, .docx, .png, .jpg/.jpeg).
 * - Validación de tamaño máximo de archivo (límite 25 MB según directiva LPAG).
 * - Mensajes de orientación claros, empáticos y en lenguaje ciudadano accesible.
 * - Accesibilidad WCAG 2.1 AA con contraste reforzado.
 * - Cero 'any', 100% tipado estricto con contratos de tramiteWizardState.ts.
 * ==============================================================================
 */

import React, { useId, useMemo, useRef, useState } from 'react';
import type {
  DocumentosData,
  ArchivoTramite,
  WizardAction,
} from '../../../types/tramiteWizardState';
import { PROCEDIMIENTOS_TUPA_2026 } from '../../../data/tupaPasco2026';
import { SearchableSelect } from '../../common/SearchableSelect';
import type { SelectOption } from '../../common/SearchableSelect';
import {
  getFileExtension,
  validateInstitutionalFile,
} from '../../../utils/fileValidation';
import {
  extractDetailedUploadError,
  usePresignedUpload,
  type UploadErrorKind,
} from '../../../hooks/usePresignedUpload';

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

interface FriendlyFileErrorState {
  title: string;
  message: string;
}

const CATALOGO_TUPA_INSTITUCIONAL = [
  {
    id: 'TUPA-01',
    nombre: 'Expedición de Título Profesional Técnico',
    unidad: 'Dirección General',
  },
  {
    id: 'TUPA-02',
    nombre: 'Certificado de Estudios Superiores (6 Semestres)',
    unidad: 'Secretaría Académica',
  },
  {
    id: 'TUPA-03',
    nombre: 'Visación de Certificado de Estudios Superiores',
    unidad: 'Secretaría Académica',
  },
  {
    id: 'TUPA-04',
    nombre: 'Constancia de No Adeudar (Para Fines de Titulación)',
    unidad: 'Unidad Administrativa',
  },
  {
    id: 'TUPA-05',
    nombre: 'Constancia de Egresado',
    unidad: 'Secretaría Académica',
  },
  {
    id: 'TUPA-06',
    nombre: 'Constancias Varias (Título, Estudios o Matrícula)',
    unidad: 'Secretaría Académica',
  },
  {
    id: 'TUPA-07',
    nombre: 'Certificado Modular (I, II, III y IV)',
    unidad: 'Secretaría Académica',
  },
  {
    id: 'TUPA-08',
    nombre: 'Certificado de Bachillerato',
    unidad: 'Secretaría Académica',
  },
  {
    id: 'TUPA-09',
    nombre: 'Derecho de Duplicado de Título',
    unidad: 'Dirección General',
  },
  {
    id: 'TUPA-10',
    nombre: 'Modificación de Datos del Título',
    unidad: 'Dirección General',
  },
  {
    id: 'TUPA-11',
    nombre: 'Convalidación entre Planes de Estudios',
    unidad: 'Jefatura de Unidad Académica',
  },
  {
    id: 'TUPA-12',
    nombre: 'Convalidación por Unidades de Competencia',
    unidad: 'Jefatura de Unidad Académica',
  },
  {
    id: 'TUPA-13',
    nombre: 'Traslado Interno',
    unidad: 'Secretaría Académica',
  },
  {
    id: 'TUPA-14',
    nombre: 'Traslado Externo',
    unidad: 'Dirección General',
  },
  {
    id: 'TUPA-15',
    nombre: 'Reserva de Matrícula - Ingresantes',
    unidad: 'Secretaría Académica',
  },
  {
    id: 'TUPA-16',
    nombre: 'Licencia de Estudios - Estudiantes Antiguos',
    unidad: 'Secretaría Académica',
  },
  {
    id: 'TUPA-17',
    nombre: 'Derecho de Reincorporación (Reingreso)',
    unidad: 'Secretaría Académica',
  },
  {
    id: 'TUPA-18',
    nombre: 'Examen de Recuperación / Subsanación con Jurado',
    unidad: 'Jefatura de Unidad Académica',
  },
  {
    id: 'TUPA-19',
    nombre: 'Evaluación Extraordinaria',
    unidad: 'Jefatura de Unidad Académica',
  },
  {
    id: 'TUPA-20',
    nombre: 'Prueba de Suficiencia Académica',
    unidad: 'Jefatura de Unidad Académica',
  },
  {
    id: 'TUPA-21',
    nombre: 'Devolución de Expediente',
    unidad: 'Mesa de Partes',
  },
  {
    id: 'TUPA-22',
    nombre: 'Acceso a la Información Pública',
    unidad: 'Dirección General',
  },
  {
    id: 'TUPA-23',
    nombre: 'Búsqueda y Duplicados de Boletas / Sílabos',
    unidad: 'Secretaría Académica',
  },
  {
    id: 'LIBRE-01',
    nombre: 'Solicitud Formal General / Trámite Libre Institucional',
    unidad: 'Mesa de Partes General',
  },
] as const;

function getFriendlyTitleByKind(kind: UploadErrorKind): string {
  switch (kind) {
    case 'invalid-file':
    case 'invalid-magic-bytes':
      return 'Revisa el archivo seleccionado';
    case 'hash':
      return 'No pudimos procesar el archivo';
    case 'presigned-url':
    case 'upload':
    case 'confirm':
      return 'Inconveniente temporal al adjuntar tu documento';
    case 'cancelled':
      return 'Subida cancelada';
  }
}

function getFileFormatBadge(fileName: string): { label: string; classes: string } {
  const ext = getFileExtension(fileName);
  switch (ext) {
    case '.pdf':
      return { label: 'PDF', classes: 'bg-red-100 text-red-700' };
    case '.doc':
    case '.docx':
      return { label: 'WORD', classes: 'bg-blue-100 text-blue-700' };
    case '.png':
    case '.jpg':
    case '.jpeg':
      return { label: 'IMG', classes: 'bg-emerald-100 text-emerald-700' };
    default:
      return { label: 'DOC', classes: 'bg-slate-100 text-slate-700' };
  }
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
  const [fileError, setFileError] = useState<FriendlyFileErrorState | null>(null);

  const {
    upload: uploadToMinio,
    cancel: cancelUpload,
    clearError: clearUploadHookError,
    getLastError,
    status: uploadStatus,
    progress: uploadProgress,
    error: uploadHookError,
  } = usePresignedUpload({ categoria: 'EXPEDIENTE_INGRESO' });

  const isUploading =
    uploadStatus === 'validating' ||
    uploadStatus === 'hashing' ||
    uploadStatus === 'requesting-url' ||
    uploadStatus === 'uploading';

  const tupaOptions: SelectOption[] = useMemo(() => {
    return CATALOGO_TUPA_INSTITUCIONAL.map((item) => ({
      value: item.id,
      label: `${item.id} — ${item.nombre}`,
      description: item.unidad ? `Área: ${item.unidad}` : undefined,
    }));
  }, []);

  const infoTupaSeleccionado = useMemo(() => {
    if (!data.tipoTramiteId) return null;
    if (data.tipoTramiteId === 'LIBRE-01') {
      return {
        esLibre: true,
        nombre: 'Solicitud Formal General / Trámite Libre Institucional',
        dependencia: 'Mesa de Partes General',
        plazo: '30 días hábiles (TUO Ley N° 27444)',
        costo: 'Gratuito',
        requisitos: [
          'FUT o solicitud formal firmada dirigida a la institución',
          'Documentos sustentatorios que fundamenten el petitorio (PDF, Word o imagen legible)',
        ],
      };
    }
    const cod = data.tipoTramiteId.replace('TUPA-', '');
    const proc = PROCEDIMIENTOS_TUPA_2026.find((p) => p.codigo === cod);
    if (!proc) return null;
    return {
      esLibre: false,
      nombre: proc.nombre,
      dependencia: proc.dependencia || 'Secretaría Académica / Dirección',
      plazo: proc.tiempoMaximo || '30 días hábiles',
      costo: proc.derechoPago || 'Gratuito',
      requisitos:
        proc.requisitos && proc.requisitos.length > 0
          ? proc.requisitos
          : ['FUT debidamente llenado y firmado'],
    };
  }, [data.tipoTramiteId]);

  // ===========================================================================
  // VALIDACIÓN REACTIVA EN TIEMPO REAL
  // ===========================================================================
  const errors = useMemo(() => {
    const errs: Record<string, string> = {};

    // 1. Procedimiento Institucional
    if (!data.tipoTramiteId.trim()) {
      errs.tipoTramiteId = 'Por favor, selecciona un procedimiento o trámite de la lista.';
    }

    // 2. Asunto / Petitorio sucinto
    const asuntoTrim = data.asunto.trim();
    if (!asuntoTrim) {
      errs.asunto = 'El asunto o motivo de tu solicitud es obligatorio.';
    } else if (asuntoTrim.length < 10) {
      errs.asunto = `Describe un poco más tu solicitud (mínimo 10 caracteres, actual: ${asuntoTrim.length}).`;
    }

    // 3. Cantidad de Folios
    if (!data.numeroFolios || data.numeroFolios < 1) {
      errs.numeroFolios = 'Indica al menos 1 folio o página útil.';
    } else if (data.numeroFolios > 500) {
      errs.numeroFolios = 'La cantidad máxima permitida por trámite es de 500 folios.';
    }

    // 4. Archivos adjuntos obligatorios
    if (data.archivos.length === 0) {
      errs.archivos = 'Debes adjuntar al menos un documento sustentatorio (PDF, Word o imagen).';
    }

    return errs;
  }, [data]);

  const isValid = Object.keys(errors).length === 0 && !isUploading;

  const markTouched = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleFieldChange = (field: keyof DocumentosData, value: unknown) => {
    dispatch({
      type: 'UPDATE_DOCUMENTOS',
      payload: { [field]: value },
    });
  };

  const handleDismissError = () => {
    setFileError(null);
    clearUploadHookError();
  };

  // Carga flexible de archivos institucionales (.pdf, .doc, .docx, .png, .jpg)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    clearUploadHookError();
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. Validación flexible de formato, tamaño (máximo 25 MB) e integridad básica
    const validation = await validateInstitutionalFile(file);
    if (!validation.valid) {
      setFileError({
        title: 'Revisa el archivo seleccionado',
        message: validation.reason,
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // 2. Evitar archivos con el mismo nombre en el mismo expediente
    const yaExisteNombre = data.archivos.some(
      (a) => a.nombre.toLowerCase() === file.name.toLowerCase(),
    );
    if (yaExisteNombre) {
      setFileError({
        title: 'Documento ya adjuntado',
        message: `El archivo "${file.name}" ya se encuentra en la lista de documentos de tu solicitud.`,
      });
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    try {
      const resultadoS3 = await uploadToMinio(file);

      if (!resultadoS3) {
        const detailedErr = getLastError() ?? uploadHookError;
        if (detailedErr && detailedErr.kind !== 'cancelled') {
          setFileError({
            title: getFriendlyTitleByKind(detailedErr.kind),
            message: detailedErr.message,
          });
        } else if (!detailedErr) {
          setFileError({
            title: 'Inconveniente temporal al adjuntar tu documento',
            message:
              'No pudimos guardar tu archivo debido a un problema temporal de comunicación. Por favor, inténtalo de nuevo en unos segundos.',
          });
        }
        return;
      }

      const nuevoArchivo: ArchivoTramite = {
        nombre: file.name,
        peso: file.size,
        hashSha256: resultadoS3.sha256,
        s3Key: resultadoS3.s3Key,
        storageUrl: resultadoS3.s3Key,
        idDocumentoAdjunto: resultadoS3.idDocumentoAdjunto,
      };

      dispatch({
        type: 'UPDATE_DOCUMENTOS',
        payload: {
          archivos: [...data.archivos, nuevoArchivo],
        },
      });
    } catch (err: unknown) {
      const parsedError = extractDetailedUploadError(err, 'upload');
      setFileError({
        title: getFriendlyTitleByKind(parsedError.kind),
        message: parsedError.message,
      });
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

  const handleLimpiarTodo = () => {
    if (isUploading) {
      cancelUpload();
    }
    dispatch({ type: 'RESET_WIZARD' });
    setTouched({});
    setFileError(null);
    clearUploadHookError();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({
      tipoTramiteId: true,
      asunto: true,
      numeroFolios: true,
      archivos: true,
    });

    if (isValid && !isSubmitting) {
      onNext();
    }
  };

  const statusLabel = useMemo(() => {
    switch (uploadStatus) {
      case 'validating':
        return 'Verificando tu documento...';
      case 'hashing':
        return 'Generando código de seguridad del archivo...';
      case 'requesting-url':
        return 'Preparando envío seguro...';
      case 'uploading':
        return `Subiendo tu documento (${uploadProgress}%)...`;
      default:
        return '';
    }
  }, [uploadStatus, uploadProgress]);

  const activeErrorDetails: FriendlyFileErrorState | null = useMemo(() => {
    if (fileError) return fileError;
    if (uploadHookError && uploadHookError.kind !== 'cancelled') {
      return {
        title: getFriendlyTitleByKind(uploadHookError.kind),
        message: uploadHookError.message,
      };
    }
    return null;
  }, [fileError, uploadHookError]);

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
          Selecciona el procedimiento TUPA, describe brevemente tu solicitud y adjunta tus documentos sustentatorios.
        </p>
      </header>

      <div className="space-y-5">
        {/* 1. Tipo de Procedimiento / Trámite TUPA */}
        <div onBlur={() => markTouched('tipoTramiteId')}>
          <SearchableSelect
            id={`${formId}-tipoTramiteId`}
            label="Tipo de Procedimiento / Trámite TUPA *"
            placeholder="Buscar por código, trámite o área responsable..."
            options={tupaOptions}
            value={data.tipoTramiteId}
            onChange={(val) => {
              handleFieldChange('tipoTramiteId', val);
              markTouched('tipoTramiteId');
            }}
            error={touched.tipoTramiteId ? errors.tipoTramiteId : undefined}
            helperText="Selecciona el trámite específico o elige Solicitud Formal General para otros trámites."
            clearable={false}
            disabled={isSubmitting || isUploading}
          />
        </div>

        {infoTupaSeleccionado && (
          <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs transition-all animate-fadeIn">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2 mb-2">
              <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                📋 Ficha Oficial del Trámite ({data.tipoTramiteId})
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-100 text-blue-800">
                {infoTupaSeleccionado.costo}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-slate-600 mb-2.5">
              <div>
                <span className="font-medium text-slate-700">Área Responsable: </span>
                {infoTupaSeleccionado.dependencia}
              </div>
              <div>
                <span className="font-medium text-slate-700">Plazo Estimado: </span>
                {infoTupaSeleccionado.plazo}
              </div>
            </div>

            <div>
              <span className="font-medium text-slate-700 block mb-1">
                Requisitos documentarios sugeridos:
              </span>
              <ul className="list-disc list-inside space-y-0.5 text-slate-600 pl-1">
                {infoTupaSeleccionado.requisitos.map((req, idx) => (
                  <li key={idx}>{req}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

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
            placeholder="Describe claramente tu solicitud dirigida a la Dirección del Instituto de Educación Superior Tecnológico Público Suiza..."
            value={data.asunto}
            onChange={(e) => handleFieldChange('asunto', e.target.value)}
            onBlur={() => markTouched('asunto')}
            disabled={isSubmitting || isUploading}
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
            disabled={isSubmitting || isUploading}
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
              Número de páginas o caras útiles que componen tu documentación.
            </p>
          )}
        </div>

        {/* 4. Carga Documentaria Flexible (PDF, Word, Imágenes) */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Documentación Sustentatoria <span className="text-red-600">*</span>
              </h3>
              <p className="text-xs text-slate-500">
                Adjunta tu solicitud o anexos en formato PDF, Word (.doc, .docx) o imagen (.png, .jpg) de hasta 25 MB.
              </p>
            </div>
          </div>

          {/* Zona de Drop / Carga de Archivo */}
          <label
            htmlFor={`${formId}-file-upload`}
            className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-5 text-center transition ${
              isUploading || isSubmitting
                ? 'border-blue-300 bg-blue-50/30 cursor-wait'
                : 'border-slate-300 bg-white cursor-pointer hover:border-[#006EC7] hover:bg-blue-50/20'
            }`}
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
              {isUploading
                ? statusLabel
                : 'Haz clic aquí para seleccionar tu documento o imagen'}
            </span>
            <span className="text-xs text-slate-400 mt-0.5">
              Formatos admitidos: PDF, Word (.doc, .docx), PNG y JPG (máx. 25 MB)
            </span>
            <input
              id={`${formId}-file-upload`}
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,application/pdf,image/png,image/jpeg,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="sr-only"
              onChange={handleFileChange}
              disabled={isSubmitting || isUploading}
            />
          </label>

          {/* Barra de progreso de subida */}
          {isUploading && (
            <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-blue-800">{statusLabel}</span>
                <button
                  type="button"
                  onClick={cancelUpload}
                  className="text-red-600 hover:underline font-bold cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
              <div className="w-full h-2 rounded-full bg-blue-100 overflow-hidden">
                <div
                  className="h-full bg-[#006EC7] transition-all duration-150"
                  style={{ width: `${Math.max(10, uploadProgress)}%` }}
                />
              </div>
            </div>
          )}

          {/* Panel amigable de orientación al ciudadano en caso de error */}
          {activeErrorDetails && (
            <div
              role="alert"
              aria-live="assertive"
              className="rounded-xl border border-amber-300 bg-amber-50/95 p-4 text-xs text-amber-950 shadow-xs space-y-1.5"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-bold text-amber-900 flex items-center gap-1.5 text-sm">
                  <span aria-hidden="true">ℹ️</span>
                  <span>{activeErrorDetails.title}</span>
                </span>
                <button
                  type="button"
                  onClick={handleDismissError}
                  className="text-amber-700 hover:text-amber-950 font-bold px-1.5 py-0.5 rounded hover:bg-amber-100 cursor-pointer"
                  aria-label="Cerrar aviso"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs leading-relaxed text-amber-900">
                {activeErrorDetails.message}
              </p>
            </div>
          )}

          {/* Alerta si no hay archivos y el paso fue tocado */}
          {touched.archivos && errors.archivos && !activeErrorDetails && (
            <p role="alert" className="text-xs font-semibold text-red-600">
              ⚠️ {errors.archivos}
            </p>
          )}

          {/* Listado de archivos cargados */}
          {data.archivos.length > 0 && (
            <div className="space-y-2 pt-2">
              <p className="text-xs font-bold text-slate-700">
                Documentos adjuntados a tu solicitud ({data.archivos.length}):
              </p>
              {data.archivos.map((archivo, index) => {
                const badge = getFileFormatBadge(archivo.nombre);
                return (
                  <div
                    key={`${archivo.nombre}-${index}`}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-xs"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      <span
                        className={`shrink-0 rounded px-2 py-0.5 font-bold ${badge.classes}`}
                      >
                        {badge.label}
                      </span>
                      <div className="truncate">
                        <p className="font-semibold text-slate-900 truncate">
                          {archivo.nombre}{' '}
                          <span className="text-slate-400 font-normal">
                            ({(archivo.peso / 1024).toFixed(1)} KB)
                          </span>
                        </p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 text-slate-700 border border-slate-200"
                            title={archivo.hashSha256}
                          >
                            <span className="text-emerald-600 font-bold">🔒 Código SHA-256:</span>
                            <span>
                              {archivo.hashSha256.substring(0, 14)}...
                              {archivo.hashSha256.substring(archivo.hashSha256.length - 6)}
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => navigator.clipboard.writeText(archivo.hashSha256)}
                            className="text-[10px] text-[#006EC7] hover:text-[#005ba3] font-semibold underline cursor-pointer"
                            title="Copiar código de integridad SHA-256"
                          >
                            Copiar código
                          </button>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveArchivo(index)}
                      disabled={isSubmitting || isUploading}
                      className="ml-3 shrink-0 rounded px-2 py-1 font-bold text-red-600 hover:bg-red-50 cursor-pointer"
                    >
                      Quitar
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* BOTONERA DE NAVEGACIÓN ACCESIBLE */}
      <footer className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200/80 pt-6">
        {/* Botón Izquierdo: Anterior */}
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting || isUploading}
          className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 shadow-xs transition-all duration-200 hover:bg-slate-50 hover:border-slate-400 active:scale-[0.98] disabled:opacity-50 cursor-pointer"
        >
          <span className="transition-transform duration-200 group-hover:-translate-x-1 group-active:-translate-x-1.5">
            ←
          </span>
          <span>Anterior</span>
        </button>

        {/* Grupo Derecho: Limpiar datos + Siguiente */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleLimpiarTodo}
            disabled={isSubmitting}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600 shadow-xs transition-all duration-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 active:scale-[0.98] cursor-pointer"
          >
            <span aria-hidden="true">🗑️</span>
            <span>Limpiar datos</span>
          </button>

          <button
            type="submit"
            disabled={!isValid || isSubmitting}
            className={`group w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-xl px-7 py-2.5 text-xs font-bold text-white transition-all duration-200 ${
              isValid && !isSubmitting
                ? 'bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 shadow-md shadow-blue-600/20 hover:shadow-lg hover:shadow-blue-600/30 active:scale-[0.98] cursor-pointer'
                : 'bg-slate-300 text-slate-500 cursor-not-allowed'
            }`}
          >
            <span>Siguiente</span>
            <span className="transition-transform duration-200 group-hover:translate-x-1 group-active:translate-x-1.5">
              →
            </span>
          </button>
        </div>
      </footer>
    </form>
  );
};

export default StepDocumentos;
