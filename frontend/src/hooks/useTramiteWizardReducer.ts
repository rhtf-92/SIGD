/**
 * ==============================================================================
 * PROYECTO: SIGD (Sistema Integral de Gestión Documentaria) - IESTP "Suiza"
 * MÓDULO 2: Registro Documentario - Mesa de Partes Virtual
 * TAREA: T-FE-MPV-14 — Arquitectura de Máquina de Estados de UI y Persistencia Defensiva
 * ARCHIVO: src/hooks/useTramiteWizardReducer.ts
 * ==============================================================================
 * DESCRIPCIÓN:
 * Custom Hook que implementa una máquina de estados determinista basada en useReducer
 * para la tramitación asistida de 4 pasos canónicos:
 * 1. Identificación
 * 2. Documentos
 * 3. Declaración Jurada
 * 4. Confirmación / Cargo Digital
 *
 * Características principales:
 * - Acciones atómicas inmutables con discriminador tipado estricto.
 * - Persistencia defensiva sincronizada con sessionStorage para evitar pérdida
 *   accidental de datos ante recargas (F5) o cierres involuntarios.
 * - Lazy initialization defensiva con saneamiento estructural y recuperación segura.
 * - Cero 'any' (PEN-06), compatible con verbatimModuleSyntax y React 18 / 19.
 * ==============================================================================
 */

import { useReducer, useEffect, useCallback } from 'react';
import type {
  TramiteWizardState,
  WizardAction,
  WizardStep,
  IdentificacionData,
  DocumentosData,
  DeclaracionJuradaData,
  CargoDigitalResponse,
} from '../types/tramiteWizardState';
import {
  INITIAL_WIZARD_STATE,
  INITIAL_IDENTIFICACION,
  INITIAL_DOCUMENTOS,
  INITIAL_DECLARACION,
} from '../types/tramiteWizardState';

/**
 * Clave oficial en sessionStorage para la persistencia del borrador de trámite.
 */
export const TRAMITE_WIZARD_STORAGE_KEY = 'SIGD_TRAMITE_WIZARD_DRAFT';

/**
 * Recuperación segura y defensiva del estado persistido en sessionStorage.
 * Implementa lazy initialization para evitar lecturas sincrónicas innecesarias.
 */
export function getPersistedWizardState(): TramiteWizardState {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return INITIAL_WIZARD_STATE;
  }

  try {
    const raw = window.sessionStorage.getItem(TRAMITE_WIZARD_STORAGE_KEY);
    if (!raw) {
      return INITIAL_WIZARD_STATE;
    }

    const parsed = JSON.parse(raw) as Partial<TramiteWizardState>;
    if (!parsed || typeof parsed !== 'object') {
      return INITIAL_WIZARD_STATE;
    }

    // Validación defensiva del paso canónico restaurado
    const validStep: WizardStep =
      parsed.currentStep === 1 ||
      parsed.currentStep === 2 ||
      parsed.currentStep === 3 ||
      parsed.currentStep === 4
        ? parsed.currentStep
        : 1;

    // Fusión defensiva con los estados iniciales canónicos
    return {
      currentStep: validStep,
      identificacion: {
        ...INITIAL_IDENTIFICACION,
        ...(parsed.identificacion ?? {}),
      },
      documentos: {
        ...INITIAL_DOCUMENTOS,
        ...(parsed.documentos ?? {}),
        archivos: Array.isArray(parsed.documentos?.archivos)
          ? parsed.documentos.archivos
          : [],
      },
      declaracionJurada: {
        ...INITIAL_DECLARACION,
        ...(parsed.declaracionJurada ?? {}),
      },
      cargoEmitido: parsed.cargoEmitido ?? null,
      isSubmitting: false, // Estados transitorios se reinician siempre
      error: null,
    };
  } catch (err) {
    // Si el JSON está corrupto o la cuota está bloqueada, fallback silencioso y seguro
    console.warn(
      '[useTramiteWizardReducer] No se pudo restaurar el estado desde sessionStorage. Usando estado inicial.',
      err
    );
    return INITIAL_WIZARD_STATE;
  }
}

/**
 * Función reductora pura para la máquina de estados del TramiteWizard.
 * Procesa acciones atómicas garantizando inmutabilidad.
 */
export function wizardReducer(
  state: TramiteWizardState,
  action: WizardAction
): TramiteWizardState {
  switch (action.type) {
    case 'SET_STEP': {
      const targetStep = action.payload;
      if (targetStep < 1 || targetStep > 4) {
        return state;
      }
      return {
        ...state,
        currentStep: targetStep,
        error: null,
      };
    }

    case 'UPDATE_IDENTIFICACION':
      return {
        ...state,
        identificacion: {
          ...state.identificacion,
          ...action.payload,
        },
        error: null,
      };

    case 'UPDATE_DOCUMENTOS':
      return {
        ...state,
        documentos: {
          ...state.documentos,
          ...action.payload,
        },
        error: null,
      };

    case 'UPDATE_DECLARACION':
      return {
        ...state,
        declaracionJurada: {
          ...state.declaracionJurada,
          ...action.payload,
        },
        error: null,
      };

    case 'SET_CARGO':
      return {
        ...state,
        cargoEmitido: action.payload,
        currentStep: 4,
        isSubmitting: false,
        error: null,
      };

    case 'SET_SUBMITTING':
      return {
        ...state,
        isSubmitting: action.payload,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isSubmitting: false,
      };

    case 'RESET': {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        try {
          window.sessionStorage.removeItem(TRAMITE_WIZARD_STORAGE_KEY);
        } catch {
          // Ignorar fallos de acceso en entornos restringidos
        }
      }
      return INITIAL_WIZARD_STATE;
    }

    default:
      return state;
  }
}

/**
 * Hook orquestador de la máquina de estados y persistencia del asistente.
 */
export function useTramiteWizardReducer() {
  const [state, dispatch] = useReducer(
    wizardReducer,
    undefined,
    getPersistedWizardState
  );

  // Sincronización defensiva con sessionStorage ante cualquier cambio de estado
  useEffect(() => {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return;
    }

    try {
      // No persistir estados transitorios
      const toPersist: TramiteWizardState = {
        ...state,
        isSubmitting: false,
        error: null,
      };
      window.sessionStorage.setItem(
        TRAMITE_WIZARD_STORAGE_KEY,
        JSON.stringify(toPersist)
      );
    } catch (err) {
      // Cuota excedida o almacenamiento en modo incógnito estricto
      console.warn(
        '[useTramiteWizardReducer] Error al sincronizar con sessionStorage:',
        err
      );
    }
  }, [state]);

  // Despachadores atómicos con useCallback para evitar re-renders en componentes hijos
  const setStep = useCallback((step: WizardStep) => {
    dispatch({ type: 'SET_STEP', payload: step });
  }, []);

  const nextStep = useCallback(() => {
    if (state.currentStep < 4) {
      const next = (state.currentStep + 1) as WizardStep;
      dispatch({ type: 'SET_STEP', payload: next });
    }
  }, [state.currentStep]);

  const prevStep = useCallback(() => {
    if (state.currentStep > 1) {
      const prev = (state.currentStep - 1) as WizardStep;
      dispatch({ type: 'SET_STEP', payload: prev });
    }
  }, [state.currentStep]);

  const updateIdentificacion = useCallback(
    (payload: Partial<IdentificacionData>) => {
      dispatch({ type: 'UPDATE_IDENTIFICACION', payload });
    },
    []
  );

  const updateDocumentos = useCallback((payload: Partial<DocumentosData>) => {
    dispatch({ type: 'UPDATE_DOCUMENTOS', payload });
  }, []);

  const updateDeclaracion = useCallback(
    (payload: Partial<DeclaracionJuradaData>) => {
      dispatch({ type: 'UPDATE_DECLARACION', payload });
    },
    []
  );

  const setCargo = useCallback((cargo: CargoDigitalResponse) => {
    dispatch({ type: 'SET_CARGO', payload: cargo });
  }, []);

  const setSubmitting = useCallback((isSubmitting: boolean) => {
    dispatch({ type: 'SET_SUBMITTING', payload: isSubmitting });
  }, []);

  const setError = useCallback((error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: error });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  return {
    state,
    dispatch,
    setStep,
    nextStep,
    prevStep,
    updateIdentificacion,
    updateDocumentos,
    updateDeclaracion,
    setCargo,
    setSubmitting,
    setError,
    reset,
  };
}