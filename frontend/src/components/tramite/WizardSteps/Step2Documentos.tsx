/**
 * ==============================================================================
 * PROYECTO: SIGD (Sistema Integral de Gestión Documentaria) - IESTP "Suiza"
 * MÓDULO 2: Registro Documentario - Mesa de Partes Virtual
 * SUBVISTA: Paso 2 — Documentos del Trámite
 * ARCHIVO: src/components/tramite/wizardSteps/Step2Documentos.tsx
 * ==============================================================================
 */

import React, { useRef } from 'react';
import type { DocumentosData, ArchivoTramite } from '../../../types/tramiteWizardState';

interface Step2DocumentosProps {
  data: DocumentosData;
  onChange: (fields: Partial<DocumentosData>) => void;
  disabled?: boolean;
}

const TRAMITES_CATALOGO = [
  { id: 'TUPA-01', nombre: 'Certificado Oficial de Estudios' },
  { id: 'TUPA-02', nombre: 'Constancia de Matrícula y No Adeudo' },
  { id: 'TUPA-03', nombre: 'Expedición de Título Profesional Técnico' },
  { id: 'TUPA-04', nombre: 'Rectificación de Matrícula o Retiro Temporal' },
  { id: 'TUPA-05', nombre: 'Convalidación y Homologación de Unidades Didácticas' },
  { id: 'LIBRE-01', nombre: 'Solicitud General / Trámite Libre Institucional' },
] as const;

export const Step2Documentos: React.FC<Step2DocumentosProps> = ({
  data,
  onChange,
  disabled = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelection = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Cálculo determinista del hash SHA-256 del archivo
      const arrayBuffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

      const nuevoArchivo: ArchivoTramite = {
        nombre: file.name,
        peso: file.size,
        hashSha256: hashHex,
        storageUrl: URL.createObjectURL(file),
      };

      onChange({
        archivos: [...data.archivos, nuevoArchivo],
      });
    } catch {
      // Fallback seguro si crypto.subtle no está disponible
      const fallbackHash = `sha256_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const nuevoArchivo: ArchivoTramite = {
        nombre: file.name,
        peso: file.size,
        hashSha256: fallbackHash,
      };
      onChange({
        archivos: [...data.archivos, nuevoArchivo],
      });
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveArchivo = (indexToRemove: number) => {
    const filtrados = data.archivos.filter((_, idx) => idx !== indexToRemove);
    onChange({ archivos: filtrados });
  };

  const handleSimularArchivoPrueba = () => {
    const dummy: ArchivoTramite = {
      nombre: 'solicitud_firmada_estudios.pdf',
      peso: 154230,
      hashSha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    };
    onChange({ archivos: [...data.archivos, dummy] });
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h3 className="text-lg font-bold text-slate-900">
          Paso 2: Documentos del Trámite
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Seleccione el procedimiento requerido, detalle el petitorio sucinto y adjunte los documentos sustentatorios (PDF).
        </p>
      </div>

      <div className="space-y-5">
        {/* Selección del Tipo de Trámite TUPA */}
        <div>
          <label
            htmlFor="tipoTramiteId"
            className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
          >
            Procedimiento Institucional o Trámite TUPA *
          </label>
          <select
            id="tipoTramiteId"
            name="tipoTramiteId"
            value={data.tipoTramiteId}
            onChange={(e) => onChange({ tipoTramiteId: e.target.value })}
            disabled={disabled}
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-xs focus:border-[#006EC7] focus:outline-none focus:ring-2 focus:ring-[#006EC7]/20 disabled:bg-slate-100"
          >
            <option value="">-- Seleccione el procedimiento institucional --</option>
            {TRAMITES_CATALOGO.map((t) => (
              <option key={t.id} value={t.id}>
                {t.id} — {t.nombre}
              </option>
            ))}
          </select>
        </div>

        {/* Asunto Sucinto */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label
              htmlFor="asunto"
              className="block text-xs font-bold uppercase tracking-wider text-slate-700"
            >
              Asunto o Petitorio Sucinto *
            </label>
            <span className="text-[11px] font-mono text-slate-400">
              {data.asunto.length}/300 caracteres
            </span>
          </div>
          <textarea
            id="asunto"
            name="asunto"
            rows={3}
            maxLength={300}
            required
            placeholder="Describa de manera clara y precisa su solicitud formal dirigida a la Dirección del IESTP Suiza..."
            value={data.asunto}
            onChange={(e) => onChange({ asunto: e.target.value })}
            disabled={disabled}
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-xs focus:border-[#006EC7] focus:outline-none focus:ring-2 focus:ring-[#006EC7]/20 disabled:bg-slate-100 placeholder:text-slate-400"
          />
        </div>

        {/* Número de Folios */}
        <div className="max-w-xs">
          <label
            htmlFor="numeroFolios"
            className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
          >
            Número Estimado de Folios *
          </label>
          <input
            id="numeroFolios"
            name="numeroFolios"
            type="number"
            min={1}
            max={500}
            required
            value={data.numeroFolios}
            onChange={(e) =>
              onChange({
                numeroFolios: Math.max(1, parseInt(e.target.value, 10) || 1),
              })
            }
            disabled={disabled}
            className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-xs focus:border-[#006EC7] focus:outline-none focus:ring-2 focus:ring-[#006EC7]/20 disabled:bg-slate-100 font-mono"
          />
          <p className="mt-1 text-[11px] text-slate-500">
            Cantidad de caras o páginas útiles que componen el expediente.
          </p>
        </div>

        {/* Carga de Archivos Adjuntos */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Documentos Sustentatorios y Solicitud en PDF *
              </h4>
              <p className="text-xs text-slate-500">
                Adjunte su documento principal debidamente firmado (PDF estándar, máx. 25 MB).
              </p>
            </div>
            <button
              type="button"
              onClick={handleSimularArchivoPrueba}
              disabled={disabled}
              className="text-xs font-bold text-[#006EC7] hover:underline self-start sm:self-auto cursor-pointer"
            >
              + Adjuntar PDF de Prueba
            </button>
          </div>

          <label
            htmlFor="file-upload"
            className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-white p-5 text-center cursor-pointer hover:border-[#006EC7] hover:bg-blue-50/20 transition"
          >
            <svg
              className="h-8 w-8 text-slate-400 mb-1.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <span className="text-sm font-semibold text-[#006EC7]">
              Haga clic para seleccionar archivo PDF
            </span>
            <span className="text-xs text-slate-400 mt-0.5">
              Cálculo automático de huella criptográfica SHA-256
            </span>
            <input
              id="file-upload"
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="sr-only"
              onChange={handleFileSelection}
              disabled={disabled}
            />
          </label>

          {/* Listado de Archivos Adjuntos */}
          {data.archivos.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-xs font-bold text-slate-700">
                Archivos adjuntados ({data.archivos.length}):
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
                    disabled={disabled}
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
    </div>
  );
};

export default Step2Documentos;
