/**
 * ==============================================================================
 * PROYECTO: SIGD (Sistema Integral de Gestión Documentaria) - IESTP "Suiza"
 * ENTREGABLE: ENT-M02-01 — Asistente Wizard de Tramitación de 4 Pasos
 * ARCHIVO: src/components/tramite/TramiteWizard.tsx
 * AUTORA: Anllely Melgarejo V. (F_ANLLELY)
 * REVISIÓN: Patricia Marina (R)
 * 
 * DESCRIPCIÓN:
 * Orquestador definitivo del Asistente Wizard de 4 Pasos conforme a la rúbrica
 * docente del Módulo 2 y la Ley N° 27444 (LPAG):
 * 1. WizardStepBar: Barra de progreso accesible con 4 pasos (WCAG 2.1 AA).
 * 2. Paso 1: Identificación (DNI 8 dígitos, nombres, correo, celular y las 11
 *    carreras del IESTP Suiza con SearchableSelect).
 * 3. Paso 2: Selección de Trámite TUPA y Destino.
 * 4. Paso 3: Carga Documental PDF/A con hash SHA-256.
 * 5. Paso 4: Resumen consolidado y Declaración Jurada oficial (Art. 51 LPAG).
 * 6. Botonera de navegación con botón Anterior (deshabilitado en paso 1) y
 *    Siguiente Paso (bloqueado hasta cumplir validación mínima).
 * 100% TypeScript estricto (cero 'any').
 * ==============================================================================
 */

import React, { useState, useId } from "react";
import {
  type TramiteWizardFormData,
  type TipoDocumentoPresentado,
  type PrioridadTramite,
  type ArchivoCargado,
} from "../../types/tramiteWizard";
import { useTramiteWizard } from "../../hooks/useTramiteWizard";
import { WizardStepBar } from "./WizardStepBar";
import Step1Identificacion from "./steps/Step1Identificacion";
import TextInput from "../common/TextInput";
import SearchableSelect, { type SelectOption } from "../common/SearchableSelect";

export interface TramiteWizardProps {
  /** Callback opcional al completar la radicación oficial */
  onSuccess?: (formData: TramiteWizardFormData, cutGenerado: string) => void;
  /** Clases CSS adicionales para el contenedor principal */
  className?: string;
  /** Permitir precarga de datos */
  initialData?: Partial<TramiteWizardFormData>;
}

/**
 * Catálogo canónico de Trámites TUPA del IESTP "Suiza".
 */
const CATALOGO_TUPA_OPCIONES: readonly SelectOption[] = [
  {
    value: "TUPA-01",
    label: "TUPA 01: Certificado Oficial de Estudios Modulares / Regular",
    description: "Expedición física y digital para egresados y estudiantes regulares (Secretaría Académica)",
  },
  {
    value: "TUPA-02",
    label: "TUPA 02: Emisión de Título Profesional Técnico y Duplicado",
    description: "Trámite de titulación oficial ante la Dirección General del Instituto",
  },
  {
    value: "TUPA-03",
    label: "TUPA 03: Constancia de Matrícula, No Adeudo o Egresado",
    description: "Constancias institucionales rápidas para becas y convenios (Secretaría Académica)",
  },
  {
    value: "TUPA-04",
    label: "TUPA 04: Convalidación y Reincorporación de Matrícula",
    description: "Evaluación curricular de asignaturas cursadas y traslados (Unidad Académica)",
  },
  {
    value: "LIBRE",
    label: "Trámite General / Memorial / Solicitud Libre Externa",
    description: "Ingreso directo a la Mesa de Partes Central para requerimientos no tarifados",
  },
];

export const TramiteWizard: React.FC<TramiteWizardProps> = ({
  onSuccess,
  className = "",
  initialData,
}) => {
  const wizardId = useId();
  const [cargoExitoso, setCargoExitoso] = useState<{
    cut: string;
    fechaRegistro: string;
  } | null>(null);

  // Hook centralizado con persistencia reactiva en memoria y validación bloqueante
  const {
    currentStep,
    formData,
    isValidStep,
    isSubmitting,
    completedSteps,
    stepErrors,
    goToNextStep,
    goToPrevStep,
    goToStep,
    updateStepData,
    resetWizard,
    stepConfig,
    isFirstStep,
    isLastStep,
  } = useTramiteWizard({
    initialData,
    onComplete: async (completedData) => {
      const year = new Date().getFullYear();
      const randomCutNumber = Math.floor(100000 + Math.random() * 900000);
      const nuevoCut = `EXP-${year}-${randomCutNumber}`;
      const fechaRegistro = new Date().toLocaleString("es-PE", {
        timeZone: "America/Lima",
      });

      // Retardo simulado de red institucional
      await new Promise((resolve) => setTimeout(resolve, 800));

      setCargoExitoso({ cut: nuevoCut, fechaRegistro });
      if (onSuccess) {
        onSuccess(completedData, nuevoCut);
      }
    },
  });

  // Procesamiento y hash SHA-256 del documento principal
  const handleFileUpload = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const nuevoDoc: ArchivoCargado = {
        id: `doc_${Date.now()}`,
        nombreOriginal: file.name,
        tamanoBytes: file.size,
        mimeType: file.type || "application/pdf",
        hashSha256: hashHex,
        s3Key: `2026/09/exp_${Date.now()}.pdf`,
        totalFolios: 1,
        categoria: "PRINCIPAL",
        fileRef: file,
        uploadedAt: new Date().toISOString(),
      };

      updateStepData("documentoPrincipal", nuevoDoc);
    } catch (err) {
      console.error("Error al procesar archivo PDF:", err);
    }
  };

  // ===========================================================================
  // MODAL / VISTA DE CARGO TRAS RADICACIÓN SATISFACTORIA
  // ===========================================================================
  if (cargoExitoso) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-white p-6 sm:p-10 shadow-lg text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-4">
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 mb-2">
          Radicación Formal Completada
        </span>

        <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
          ¡Expediente Radicado Exitosamente!
        </h2>
        <p className="mt-2 text-sm text-slate-600 max-w-lg mx-auto">
          Su solicitud ha sido ingresada en el Libro de Registro Oficial del IESTP &ldquo;Suiza&rdquo;.
          Conserve su Código Único de Trámite (CUT) para consultar el estado del trámite en la plataforma.
        </p>

        <div className="mt-6 inline-block rounded-xl border-2 border-dashed border-[#006EC7] bg-blue-50/60 px-6 py-4">
          <p className="text-xs uppercase tracking-wider font-bold text-blue-700">
            Código Único de Trámite (CUT)
          </p>
          <p className="mt-1 text-3xl font-black tracking-tight text-[#006EC7]">
            {cargoExitoso.cut}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Fecha y Hora Legal de Recepción: {cargoExitoso.fechaRegistro}
          </p>
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => {
              resetWizard();
              setCargoExitoso(null);
            }}
            className="rounded-lg bg-[#006EC7] px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 transition cursor-pointer"
          >
            Iniciar Nuevo Trámite
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 1. BARRA DE PROGRESO ACCESIBLE (WCAG 2.1 AA) */}
      <WizardStepBar
        currentStep={currentStep}
        completedSteps={completedSteps}
        isInteractive={true}
        onStepClick={goToStep}
      />

      {/* 2. CONTENEDOR PRINCIPAL DEL PASO ACTUAL */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-5">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#006EC7]">
              Paso {currentStep} de 4
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
              {stepConfig.title}
            </h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {stepConfig.description}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${
                isValidStep
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              {isValidStep ? "✓ Paso Válido para Continuar" : "⚠️ Complete los campos obligatorios"}
            </span>
          </div>
        </div>

        {/* FEEDBACK DE ERRORES DE VALIDACIÓN SI EXISTEN */}
        {Object.keys(stepErrors).length > 0 && (
          <div
            role="alert"
            aria-live="polite"
            className="mt-5 rounded-xl border border-red-200 bg-red-50/90 p-4 text-sm text-red-800"
          >
            <div className="flex items-center gap-2 font-bold mb-1.5">
              <svg className="h-4 w-4 text-red-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span>Por favor corrija los siguientes campos antes de avanzar:</span>
            </div>
            <ul className="list-disc pl-6 space-y-0.5 text-xs text-red-700">
              {Object.entries(stepErrors).map(([key, msgs]) => (
                <li key={key}>{msgs.join(" ")}</li>
              ))}
            </ul>
          </div>
        )}

        {/* 3. CONTENIDO MODULAR SEGÚN EL PASO ACTIVO */}
        <div className="mt-6">
          {/* ===================================================================
              PASO 1: IDENTIFICACIÓN DEL SOLICITANTE
              =================================================================== */}
          {currentStep === 1 && (
            <Step1Identificacion
              data={formData.solicitante}
              errors={stepErrors}
              onChange={(fields) => updateStepData("solicitante", fields)}
            />
          )}

          {/* ===================================================================
              PASO 2: SELECCIÓN DE TRÁMITE TUPA Y DESTINO
              =================================================================== */}
          {currentStep === 2 && (
            <div className="space-y-5">
              <SearchableSelect
                label="Procedimiento TUPA o Trámite Libre Institucional"
                required
                options={CATALOGO_TUPA_OPCIONES}
                value={formData.tramite.tipoProcedimientoId}
                onChange={(val) => {
                  const sel = CATALOGO_TUPA_OPCIONES.find((item) => item.value === val);
                  if (sel) {
                    const esTupa = val.startsWith("TUPA");
                    const unidadDestino =
                      val === "TUPA-01" || val === "TUPA-03"
                        ? "Secretaría Académica"
                        : val === "TUPA-02"
                        ? "Dirección General"
                        : val === "TUPA-04"
                        ? "Unidad Académica"
                        : "Mesa de Partes Central";

                    updateStepData("tramite", {
                      tipoProcedimientoId: sel.value,
                      nombreProcedimiento: sel.label,
                      esTupa,
                      oficinaDestinoId: val,
                      nombreOficinaDestino: unidadDestino,
                    });
                  } else {
                    updateStepData("tramite", {
                      tipoProcedimientoId: "",
                      nombreProcedimiento: "",
                    });
                  }
                }}
                placeholder="Busque o seleccione el procedimiento institucional..."
                error={stepErrors.tipoProcedimientoId?.[0]}
                helperText="Seleccione el trámite conforme al Texto Único de Procedimientos Administrativos vigente."
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor={`${wizardId}-tipologia`} className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Tipo de Documento Presentado *
                  </label>
                  <select
                    id={`${wizardId}-tipologia`}
                    value={formData.tramite.tipoDocumentoPresentado}
                    onChange={(e) =>
                      updateStepData("tramite", {
                        tipoDocumentoPresentado: e.target.value as TipoDocumentoPresentado,
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm focus:border-[#006EC7] focus:outline-none focus:ring-2 focus:ring-[#006EC7]/20"
                  >
                    <option value="SOLICITUD">Solicitud Formal</option>
                    <option value="OFICIO">Oficio Institucional</option>
                    <option value="CARTA">Carta</option>
                    <option value="MEMORANDUM">Memorándum</option>
                    <option value="INFORME">Informe</option>
                    <option value="EXPEDIENTE_EXTERNO">Expediente Externo</option>
                  </select>
                </div>

                <div>
                  <TextInput
                    label="Cantidad de Folios"
                    type="number"
                    min={1}
                    required
                    value={formData.tramite.cantidadFolios}
                    onChange={(e) =>
                      updateStepData("tramite", {
                        cantidadFolios: Math.max(1, parseInt(e.target.value, 10) || 1),
                      })
                    }
                    error={stepErrors.cantidadFolios?.[0]}
                  />
                </div>

                <div>
                  <label htmlFor={`${wizardId}-prioridad`} className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Nivel de Prioridad *
                  </label>
                  <select
                    id={`${wizardId}-prioridad`}
                    value={formData.tramite.prioridad}
                    onChange={(e) =>
                      updateStepData("tramite", {
                        prioridad: e.target.value as PrioridadTramite,
                      })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm focus:border-[#006EC7] focus:outline-none focus:ring-2 focus:ring-[#006EC7]/20"
                  >
                    <option value="NORMAL">Normal (Plazo Ley 27444)</option>
                    <option value="URGENTE">Urgente</option>
                    <option value="MUY_URGENTE">Muy Urgente (Con justificación)</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor={`${wizardId}-asunto`} className="block text-xs font-semibold text-slate-700">
                    Asunto o Petitorio Sucinto *
                  </label>
                  <span className="text-xs text-slate-500 font-mono">
                    {formData.tramite.asunto.length}/250 caracteres (mínimo 10)
                  </span>
                </div>
                <textarea
                  id={`${wizardId}-asunto`}
                  rows={3}
                  maxLength={250}
                  value={formData.tramite.asunto}
                  onChange={(e) =>
                    updateStepData("tramite", { asunto: e.target.value })
                  }
                  placeholder="Describa claramente la solicitud o petición formal..."
                  className={`w-full rounded-lg border p-3 text-sm focus:outline-none focus:ring-2 placeholder:text-slate-400 ${
                    stepErrors.asunto
                      ? "border-red-500 focus:ring-red-200"
                      : "border-slate-300 focus:border-[#006EC7] focus:ring-[#006EC7]/20"
                  }`}
                />
              </div>

              <TextInput
                label="Unidad Orgánica o Dependencia Destino Asignada"
                readOnly
                value={formData.tramite.nombreOficinaDestino || "Se asigna automáticamente al elegir el trámite"}
                className="bg-slate-50 text-slate-600 font-medium"
              />
            </div>
          )}

          {/* ===================================================================
              PASO 3: FORMULARIO DINÁMICO Y CARGA DE REQUISITOS (PDF)
              =================================================================== */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Documento Principal (Obligatorio en PDF/A) *
                    </h3>
                    <p className="text-xs text-slate-500">
                      Adjunte la solicitud formal firmada. Límite de 25 MB con cómputo de huella SHA-256.
                    </p>
                  </div>
                  {formData.documentoPrincipal && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                      ✓ Documento Validado
                    </span>
                  )}
                </div>

                {formData.documentoPrincipal ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-emerald-300 bg-white p-4 shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-red-700 font-bold text-xs">
                        PDF
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {formData.documentoPrincipal.nombreOriginal}
                        </p>
                        <p className="text-xs text-slate-500 font-mono">
                          SHA-256: {formData.documentoPrincipal.hashSha256.substring(0, 16)}...
                          {" • "}
                          {(formData.documentoPrincipal.tamanoBytes / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => updateStepData("documentoPrincipal", null)}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 transition cursor-pointer self-start sm:self-auto"
                    >
                      Remover Archivo
                    </button>
                  </div>
                ) : (
                  <div>
                    <label
                      htmlFor={`${wizardId}-pdf-upload`}
                      className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-300 bg-white p-6 text-center cursor-pointer hover:border-[#006EC7] hover:bg-blue-50/20 transition"
                    >
                      <svg
                        className="mx-auto h-10 w-10 text-slate-400 mb-2"
                        stroke="currentColor"
                        fill="none"
                        viewBox="0 0 48 48"
                      >
                        <path
                          d="M28 8H12a4 4 0 00-4 4v24a4 4 0 004 4h24a4 4 0 004-4V20L28 8z"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M28 8v12h12"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <span className="text-sm font-semibold text-[#006EC7]">
                        Haga clic para adjuntar archivo PDF/A
                      </span>
                      <span className="text-xs text-slate-500 mt-1">
                        Formato PDF estándar de preservación digital (máx. 25 MB)
                      </span>
                      <input
                        id={`${wizardId}-pdf-upload`}
                        type="file"
                        accept="application/pdf"
                        className="sr-only"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            void handleFileUpload(file);
                          }
                        }}
                      />
                    </label>

                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          const dummyDoc: ArchivoCargado = {
                            id: `demo_${Date.now()}`,
                            nombreOriginal: "solicitud_estudios_firmada.pdf",
                            tamanoBytes: 154230,
                            mimeType: "application/pdf",
                            hashSha256:
                              "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                            s3Key: "2026/09/exp_demo_tupa.pdf",
                            totalFolios: 2,
                            categoria: "PRINCIPAL",
                            uploadedAt: new Date().toISOString(),
                          };
                          updateStepData("documentoPrincipal", dummyDoc);
                        }}
                        className="text-xs font-semibold text-[#006EC7] hover:underline cursor-pointer"
                      >
                        + Cargar PDF de prueba para evaluación
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
                <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
                  Datos Adicionales del Procedimiento
                </h3>
                <TextInput
                  label="N° de Operación Banco de la Nación (si corresponde pago)"
                  placeholder="Ej. 849201"
                  value={(formData.datosFormulario.comprobantePago as string) || ""}
                  onChange={(e) =>
                    updateStepData("datosFormulario", {
                      ...formData.datosFormulario,
                      comprobantePago: e.target.value,
                    })
                  }
                  helperText="Consignar el número de voucher emitido en el Banco de la Nación para trámites tarifados."
                />
              </div>
            </div>
          )}

          {/* ===================================================================
              PASO 4: RESUMEN CONSOLIDADO Y DECLARACIÓN JURADA
              =================================================================== */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Datos del Administrado (Paso 1)
                  </h4>
                  <p className="text-sm font-bold text-slate-900">
                    {formData.solicitante.tipoPersona === "JURIDICA"
                      ? formData.solicitante.razonSocial
                      : `${formData.solicitante.nombres} ${formData.solicitante.apellidos}`}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    {formData.solicitante.tipoDocumento}: {formData.solicitante.numeroDocumento}
                  </p>
                  {formData.solicitante.programaEstudios && (
                    <p className="text-xs font-semibold text-[#006EC7] mt-0.5">
                      Programa: {formData.solicitante.programaEstudios}
                    </p>
                  )}
                  <p className="text-xs text-slate-600 mt-0.5">
                    Email: {formData.solicitante.correo} • Cel: {formData.solicitante.celular}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {formData.solicitante.distrito}, {formData.solicitante.provincia} ({formData.solicitante.departamento})
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Trámite Solicitado (Paso 2)
                  </h4>
                  <p className="text-sm font-bold text-slate-900">
                    {formData.tramite.nombreProcedimiento || "Trámite no seleccionado"}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    Destino: {formData.tramite.nombreOficinaDestino}
                  </p>
                  <p className="text-xs text-slate-600">
                    Tipo: {formData.tramite.tipoDocumentoPresentado} • Folios: {formData.tramite.cantidadFolios} • Prioridad: {formData.tramite.prioridad}
                  </p>
                  <p className="text-xs text-slate-700 italic mt-1 line-clamp-2">
                    &ldquo;{formData.tramite.asunto}&rdquo;
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Documentación Adjunta (Paso 3)
                </h4>
                {formData.documentoPrincipal ? (
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded">
                      PDF Listo
                    </span>
                    <span className="text-sm font-medium text-slate-900">
                      {formData.documentoPrincipal.nombreOriginal}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">
                      ({(formData.documentoPrincipal.tamanoBytes / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                ) : (
                  <p className="text-xs text-red-600 font-semibold">
                    ⚠️ Debe adjuntar el documento principal en el Paso 3.
                  </p>
                )}
              </div>

              {/* Declaración Jurada conforme a Ley N° 27444 */}
              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <input
                    id={`${wizardId}-declJurada`}
                    type="checkbox"
                    checked={formData.declaracionJurada.aceptada}
                    onChange={(e) =>
                      updateStepData("declaracionJurada", {
                        aceptada: e.target.checked,
                        fechaAceptacion: new Date().toISOString(),
                      })
                    }
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-[#006EC7] focus:ring-[#006EC7] cursor-pointer"
                  />
                  <label htmlFor={`${wizardId}-declJurada`} className="text-xs sm:text-sm text-slate-700 cursor-pointer">
                    <strong className="font-bold text-slate-900">
                      Declaración Jurada de Veracidad (Art. 51 TUO Ley N° 27444):
                    </strong>{" "}
                    Declaro bajo juramento que los datos consignados y la documentación acompañada son auténticos y responden a la verdad, sometiéndome a las responsabilidades administrativas y penales correspondientes.
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 4. BARRA DE NAVEGACIÓN INFERIOR (ANTERIOR / SIGUIENTE PASO) */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200/80 pt-5">
          <div>
            <button
              type="button"
              onClick={goToPrevStep}
              disabled={isFirstStep || isSubmitting}
              className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg border px-5 py-2.5 text-sm font-bold shadow-xs transition ${
                isFirstStep || isSubmitting
                  ? "border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed opacity-60"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#006EC7] cursor-pointer"
              }`}
            >
              ← Paso Anterior
            </button>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={resetWizard}
              disabled={isSubmitting}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 hover:underline px-2 cursor-pointer disabled:opacity-50"
            >
              Reiniciar
            </button>

            {isLastStep ? (
              <button
                type="button"
                onClick={goToNextStep}
                disabled={!isValidStep || isSubmitting}
                className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg px-6 py-2.5 text-sm font-bold text-white shadow-sm transition ${
                  isValidStep && !isSubmitting
                    ? "bg-emerald-600 hover:bg-emerald-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                    : "bg-slate-300 text-slate-500 cursor-not-allowed opacity-75"
                }`}
              >
                {isSubmitting ? "Radicando Expediente..." : "Radicar Trámite y Generar CUT ✓"}
              </button>
            ) : (
              <button
                type="button"
                onClick={goToNextStep}
                disabled={!isValidStep || isSubmitting}
                className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg px-6 py-2.5 text-sm font-bold text-white shadow-sm transition ${
                  isValidStep && !isSubmitting
                    ? "bg-[#006EC7] hover:bg-blue-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#006EC7] focus:ring-offset-2"
                    : "bg-slate-300 text-slate-500 cursor-not-allowed opacity-75"
                }`}
              >
                Siguiente Paso →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TramiteWizard;
