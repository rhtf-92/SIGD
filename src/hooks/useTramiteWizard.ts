/**
 * ==============================================================================
 * PROYECTO: SIGD (Sistema Integral de Gestión Documentaria) - IESTP "Suiza"
 * ENTREGABLE: ENT-M02-01 — Asistente Wizard de Tramitación de 4 Pasos
 * ARCHIVO: src/hooks/useTramiteWizard.ts
 * RESPONSABLE: Anllely Melgarejo V. (F_ANLLELY)
 * COLABORADORAS: Lucy Panduro Ramos, Noelia Alva (Grupo 1)
 * 
 * DESCRIPCIÓN:
 * Custom hook reactivo para gobernar el flujo del Wizard de 4 pasos.
 * Mantiene la persistencia en memoria durante la sesión (sin pérdida de datos
 * al retroceder o avanzar) e implementa control estricto de navegación que
 * bloquea el avance si los campos obligatorios del paso actual no son válidos.
 * 100% TypeScript estricto (cero 'any').
 * ==============================================================================
 */

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import {
  type WizardStepId,
  type TramiteWizardFormData,
  type StepValidationResult,
  type UseTramiteWizardOptions,
  type UseTramiteWizardReturn,
  INITIAL_TRAMITE_WIZARD_DATA,
  WIZARD_STEPS,
} from "../types/tramiteWizard";
import {
  parseJsonSchema,
  validateFieldValue,
  mockTupaSchema,
} from "../utils/schemaFormParser";

const DEFAULT_STORAGE_KEY = "sigd_tramite_wizard_borrador_v1";

// =============================================================================
// VALIDACIONES POR DEFECTO POR PASO (ESTÁNDAR LPAG LEY N° 27444)
// =============================================================================

/**
 * Validador para el Paso 1: Identificación del Solicitante.
 */
function validatePaso1(data: TramiteWizardFormData): StepValidationResult {
  const errors: Record<string, string[]> = {};
  const { solicitante } = data;

  // Validación de tipo de documento y número
  const numDoc = solicitante.numeroDocumento?.trim() || "";
  if (!numDoc) {
    errors.numeroDocumento = ["El número de documento de identidad es obligatorio."];
  } else if (solicitante.tipoDocumento === "DNI") {
    if (!/^[0-9]{8}$/.test(numDoc)) {
      errors.numeroDocumento = ["El DNI debe tener exactamente 8 dígitos numéricos."];
    }
  } else if (solicitante.tipoDocumento === "RUC") {
    if (!/^(10|20)[0-9]{9}$/.test(numDoc)) {
      errors.numeroDocumento = [
        "El RUC debe tener 11 dígitos y comenzar con 10 o 20.",
      ];
    }
  } else if (numDoc.length < 6 || numDoc.length > 15) {
    errors.numeroDocumento = [
      "El número de documento debe contener entre 6 y 15 caracteres.",
    ];
  }

  // Validación de nombres o razón social
  if (solicitante.tipoPersona === "JURIDICA") {
    if (!solicitante.razonSocial?.trim() && !solicitante.nombres?.trim()) {
      errors.razonSocial = [
        "Ingrese la Razón Social o el nombre de la institución solicitante.",
      ];
    }
  } else {
    if (!solicitante.nombres?.trim() || solicitante.nombres.trim().length < 2) {
      errors.nombres = ["Ingrese los nombres completos del administrado."];
    }
    if (!solicitante.apellidos?.trim() || solicitante.apellidos.trim().length < 2) {
      errors.apellidos = ["Ingrese los apellidos completos del administrado."];
    }
  }

  // Validación de correo electrónico (RFC 5322 simplificado)
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!solicitante.correo?.trim()) {
    errors.correo = [
      "El correo electrónico es obligatorio para recibir notificaciones legales.",
    ];
  } else if (!emailRegex.test(solicitante.correo.trim())) {
    errors.correo = [
      "Ingrese un formato de correo electrónico válido (ej. usuario@dominio.com).",
    ];
  }

  // Validación de celular (9 dígitos comenzando en 9 para Perú)
  const celular = solicitante.celular?.trim() || "";
  if (!celular) {
    errors.celular = [
      "El número de teléfono celular es obligatorio para alertas procesales.",
    ];
  } else if (!/^9[0-9]{8}$/.test(celular)) {
    errors.celular = [
      "El número de celular debe tener 9 dígitos y comenzar con el dígito 9.",
    ];
  }

  // Validación de programa de estudios (mandatorio para persona natural)
  if (solicitante.tipoPersona === "NATURAL" && !solicitante.programaEstudios?.trim()) {
    errors.programaEstudios = [
      "Seleccione el programa de estudios oficial del IESTP Suiza.",
    ];
  }

  // Ubicación básica
  if (!solicitante.departamento?.trim()) {
    errors.departamento = ["Seleccione el departamento."];
  }
  if (!solicitante.provincia?.trim()) {
    errors.provincia = ["Seleccione la provincia."];
  }
  if (!solicitante.distrito?.trim()) {
    errors.distrito = ["Seleccione el distrito."];
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validador para el Paso 2: Selección de Trámite TUPA y Destino.
 */
function validatePaso2(data: TramiteWizardFormData): StepValidationResult {
  const errors: Record<string, string[]> = {};
  const { tramite } = data;

  if (!tramite.tipoProcedimientoId?.trim()) {
    errors.tipoProcedimientoId = [
      "Debe seleccionar un procedimiento del catálogo TUPA o trámite libre.",
    ];
  }

  if (!tramite.tipoDocumentoPresentado) {
    errors.tipoDocumentoPresentado = [
      "Seleccione la tipología formal del documento a presentar.",
    ];
  }

  const asunto = tramite.asunto?.trim() || "";
  if (!asunto) {
    errors.asunto = ["El asunto o petitorio del trámite es obligatorio."];
  } else if (asunto.length < 10) {
    errors.asunto = [
      `El asunto debe contener al menos 10 caracteres (actual: ${asunto.length}).`,
    ];
  } else if (asunto.length > 250) {
    errors.asunto = [
      `El asunto no puede exceder los 250 caracteres (actual: ${asunto.length}).`,
    ];
  }

  if (!tramite.cantidadFolios || tramite.cantidadFolios < 1) {
    errors.cantidadFolios = [
      "La cantidad de folios debe ser un número entero mayor o igual a 1.",
    ];
  }

  if (!tramite.oficinaDestinoId?.trim()) {
    errors.oficinaDestinoId = [
      "Debe seleccionar la unidad orgánica o área administrativa de destino.",
    ];
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validador para el Paso 3: Carga Documental y Requisitos.
 */
function validatePaso3(data: TramiteWizardFormData): StepValidationResult {
  const errors: Record<string, string[]> = {};
  const { documentoPrincipal, datosFormulario } = data;

  // 1. Validación de campos del Formulario Dinámico JSON Schema
  const schemaFields = parseJsonSchema(mockTupaSchema);
  for (const field of schemaFields) {
    if (field.required) {
      const val = datosFormulario[field.name];
      const errorMsg = validateFieldValue(field, val);
      if (errorMsg) {
        errors[field.name] = [errorMsg];
      }
    }
  }

  // 2. Validación de documento probatorio principal en PDF/A
  if (!documentoPrincipal) {
    errors.documentoPrincipal = [
      "Es obligatorio adjuntar el documento principal firmado en formato PDF/A.",
    ];
  } else {
    if (!documentoPrincipal.nombreOriginal?.trim()) {
      errors.documentoPrincipal = ["El archivo adjunto no posee un nombre válido."];
    }
    // Límite estricto de 25 MB = 26,214,400 bytes
    const maxBytes = 25 * 1024 * 1024;
    if (documentoPrincipal.tamanoBytes <= 0) {
      errors.documentoPrincipal = ["El archivo no puede estar vacío (0 bytes)."];
    } else if (documentoPrincipal.tamanoBytes > maxBytes) {
      errors.documentoPrincipal = [
        "El archivo excede el tamaño máximo permitido de 25 MB.",
      ];
    }
    // Debe tener hash criptográfico SHA-256 verificado en cliente
    if (!documentoPrincipal.hashSha256?.trim()) {
      errors.documentoPrincipal = [
        "Falta el cálculo de integridad criptográfica SHA-256 del documento.",
      ];
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Validador para el Paso 4: Declaración Jurada y Resumen.
 */
function validatePaso4(data: TramiteWizardFormData): StepValidationResult {
  const errors: Record<string, string[]> = {};
  const { declaracionJurada } = data;

  if (!declaracionJurada.aceptada) {
    errors.declaracionJurada = [
      "Debe aceptar la Declaración Jurada de Veracidad de acuerdo al Art. 51 de la Ley N° 27444.",
    ];
  }

  // Verificar consistencia de los pasos previos
  const res1 = validatePaso1(data);
  const res2 = validatePaso2(data);
  const res3 = validatePaso3(data);

  if (!res1.isValid || !res2.isValid || !res3.isValid) {
    errors.consistenciaPrevia = [
      "Existen datos incompletos o inconsistentes en los pasos previos. Por favor revíselos.",
    ];
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

// =============================================================================
// HOOK PRINCIPAL: useTramiteWizard
// =============================================================================

export function useTramiteWizard(
  options: UseTramiteWizardOptions = {}
): UseTramiteWizardReturn {
  const {
    initialStep = 1,
    initialData,
    customValidators,
    storageKey = DEFAULT_STORAGE_KEY,
    persistInSession = true,
    onComplete,
  } = options;

  // 1. Estado inicial reactivo en memoria con soporte de persistencia de sesión
  const [formData, setFormData] = useState<TramiteWizardFormData>(() => {
    // Si la persistencia en sesión está activa, intentar hidratar borrador previo
    if (persistInSession && typeof window !== "undefined" && window.sessionStorage) {
      try {
        const stored = window.sessionStorage.getItem(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored) as Partial<TramiteWizardFormData>;
          return {
            ...INITIAL_TRAMITE_WIZARD_DATA,
            ...parsed,
            solicitante: {
              ...INITIAL_TRAMITE_WIZARD_DATA.solicitante,
              ...(parsed.solicitante || {}),
            },
            tramite: {
              ...INITIAL_TRAMITE_WIZARD_DATA.tramite,
              ...(parsed.tramite || {}),
            },
            datosFormulario: {
              ...INITIAL_TRAMITE_WIZARD_DATA.datosFormulario,
              ...(parsed.datosFormulario || {}),
            },
            declaracionJurada: {
              ...INITIAL_TRAMITE_WIZARD_DATA.declaracionJurada,
              ...(parsed.declaracionJurada || {}),
            },
            // Los archivos se restauran sus metadatos (el objeto File nativo vive en memoria)
            documentoPrincipal: parsed.documentoPrincipal ?? null,
            anexos: parsed.anexos ?? [],
          };
        }
      } catch (err) {
        // En caso de error de parseo, continuar con el estado inicial en memoria
        console.warn("[useTramiteWizard] No se pudo restaurar borrador de sessionStorage:", err);
      }
    }

    return {
      ...INITIAL_TRAMITE_WIZARD_DATA,
      ...(initialData || {}),
      solicitante: {
        ...INITIAL_TRAMITE_WIZARD_DATA.solicitante,
        ...(initialData?.solicitante || {}),
      },
      tramite: {
        ...INITIAL_TRAMITE_WIZARD_DATA.tramite,
        ...(initialData?.tramite || {}),
      },
      datosFormulario: {
        ...INITIAL_TRAMITE_WIZARD_DATA.datosFormulario,
        ...(initialData?.datosFormulario || {}),
      },
      declaracionJurada: {
        ...INITIAL_TRAMITE_WIZARD_DATA.declaracionJurada,
        ...(initialData?.declaracionJurada || {}),
      },
    };
  });

  // 2. Estados de navegación y ejecución
  const [currentStep, setCurrentStep] = useState<WizardStepId>(initialStep);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [completedSteps, setCompletedSteps] = useState<WizardStepId[]>([]);
  const [stepErrors, setStepErrors] = useState<Record<string, string[]>>({});

  // 3. Sincronización continua hacia sessionStorage para resiliencia ante F5
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (persistInSession && typeof window !== "undefined" && window.sessionStorage) {
      try {
        // Clonar el estado excluyendo referencias a objetos nativos File no serializables
        const serializableData: TramiteWizardFormData = {
          ...formData,
          documentoPrincipal: formData.documentoPrincipal
            ? { ...formData.documentoPrincipal, fileRef: undefined }
            : null,
          anexos: formData.anexos.map((a) => ({ ...a, fileRef: undefined })),
        };
        window.sessionStorage.setItem(storageKey, JSON.stringify(serializableData));
      } catch (err) {
        console.warn("[useTramiteWizard] Error al guardar borrador en sessionStorage:", err);
      }
    }
  }, [formData, persistInSession, storageKey]);

  // 4. Ejecutor central de validación por paso
  const runValidationForStep = useCallback(
    (step: WizardStepId, dataToValidate: TramiteWizardFormData): StepValidationResult => {
      // Si existe un validador personalizado inyectado en opciones, priorizarlo
      const customFn = customValidators?.[step];
      if (customFn) {
        const res = customFn(dataToValidate);
        if (typeof res === "boolean") {
          return { isValid: res, errors: res ? {} : { general: ["El paso no cumple con los requisitos."] } };
        }
        return res;
      }

      // Validadores predeterminados según el paso
      switch (step) {
        case 1:
          return validatePaso1(dataToValidate);
        case 2:
          return validatePaso2(dataToValidate);
        case 3:
          return validatePaso3(dataToValidate);
        case 4:
          return validatePaso4(dataToValidate);
        default:
          return { isValid: true, errors: {} };
      }
    },
    [customValidators]
  );

  // 5. Estado reactivo de validez del paso actual
  const currentStepValidation = useMemo(() => {
    return runValidationForStep(currentStep, formData);
  }, [currentStep, formData, runValidationForStep]);

  const isValidStep = currentStepValidation.isValid;

  // 6. Actualización modular reactiva del estado del borrador
  const updateStepData = useCallback(
    <K extends keyof TramiteWizardFormData>(
      section: K,
      data: Partial<TramiteWizardFormData[K]>
    ) => {
      setFormData((prev) => {
        const currentSection = prev[section];
        let updatedSection: TramiteWizardFormData[K];

        if (
          typeof currentSection === "object" &&
          currentSection !== null &&
          !Array.isArray(currentSection)
        ) {
          updatedSection = {
            ...currentSection,
            ...data,
          } as TramiteWizardFormData[K];
        } else {
          updatedSection = data as TramiteWizardFormData[K];
        }

        return {
          ...prev,
          [section]: updatedSection,
        };
      });

      // Limpiar errores visuales al modificar campos
      setStepErrors({});
    },
    []
  );

  // 7. Navegación hacia el siguiente paso con bloqueo estricto si es inválido
  const goToNextStep = useCallback((): boolean => {
    const validation = runValidationForStep(currentStep, formData);

    if (!validation.isValid) {
      setStepErrors(validation.errors);
      return false;
    }

    setStepErrors({});
    setCompletedSteps((prev) =>
      prev.includes(currentStep) ? prev : [...prev, currentStep]
    );

    if (currentStep < 4) {
      const nextStep = (currentStep + 1) as WizardStepId;
      setCurrentStep(nextStep);
      return true;
    }

    // Si nos encontramos en el paso 4 y se avanza, disparar onComplete
    if (onComplete) {
      setIsSubmitting(true);
      Promise.resolve(onComplete(formData))
        .catch((err: unknown) => {
          console.error("[useTramiteWizard] Error en callback onComplete:", err);
        })
        .finally(() => {
          setIsSubmitting(false);
        });
    }

    return true;
  }, [currentStep, formData, onComplete, runValidationForStep]);

  // 8. Navegación hacia el paso previo (sin pérdida de datos del borrador)
  const goToPrevStep = useCallback((): boolean => {
    if (currentStep > 1) {
      const prevStep = (currentStep - 1) as WizardStepId;
      setCurrentStep(prevStep);
      setStepErrors({});
      return true;
    }
    return false;
  }, [currentStep]);

  // 9. Salto directo a un paso arbitrario con validación de prerrequisitos
  const goToStep = useCallback(
    (targetStep: WizardStepId): boolean => {
      if (targetStep === currentStep) return true;

      // Hacia atrás siempre se permite sin validación bloqueante
      if (targetStep < currentStep) {
        setCurrentStep(targetStep);
        setStepErrors({});
        return true;
      }

      // Hacia adelante se verifica que cada paso intermedio sea válido
      for (let s = currentStep; s < targetStep; s++) {
        const validation = runValidationForStep(s as WizardStepId, formData);
        if (!validation.isValid) {
          setStepErrors(validation.errors);
          return false;
        }
      }

      // Registrar los pasos intermedios como completados
      setCompletedSteps((prev) => {
        const set = new Set(prev);
        for (let s = 1; s < targetStep; s++) {
          set.add(s as WizardStepId);
        }
        return Array.from(set);
      });

      setStepErrors({});
      setCurrentStep(targetStep);
      return true;
    },
    [currentStep, formData, runValidationForStep]
  );

  // 10. Reseteo del asistente y limpieza del borrador de sesión
  const resetWizard = useCallback(() => {
    setCurrentStep(1);
    setFormData(INITIAL_TRAMITE_WIZARD_DATA);
    setCompletedSteps([]);
    setStepErrors({});
    setIsSubmitting(false);

    if (persistInSession && typeof window !== "undefined" && window.sessionStorage) {
      try {
        window.sessionStorage.removeItem(storageKey);
      } catch (err) {
        console.warn("[useTramiteWizard] Error al limpiar sessionStorage:", err);
      }
    }
  }, [persistInSession, storageKey]);

  // 11. Ejecución manual de validación del paso actual
  const validateCurrentStep = useCallback((): boolean => {
    const res = runValidationForStep(currentStep, formData);
    if (!res.isValid) {
      setStepErrors(res.errors);
    } else {
      setStepErrors({});
    }
    return res.isValid;
  }, [currentStep, formData, runValidationForStep]);

  // 12. Metadatos del paso actual
  const stepConfig = useMemo(() => {
    return WIZARD_STEPS[currentStep - 1] ?? WIZARD_STEPS[0];
  }, [currentStep]);

  return {
    // Estados
    currentStep,
    formData,
    isValidStep,
    isSubmitting,
    completedSteps,
    stepErrors,

    // Métodos de navegación
    goToNextStep,
    goToPrevStep,
    goToStep,
    resetWizard,

    // Actualización y validación
    updateStepData,
    setFormData,
    setSubmitting: setIsSubmitting,
    validateCurrentStep,

    // Metadatos y utilidades
    isFirstStep: currentStep === 1,
    isLastStep: currentStep === 4,
    stepConfig,
    totalSteps: 4,
    canGoNext: isValidStep && !isSubmitting,
    canGoPrev: currentStep > 1 && !isSubmitting,
  };
}
