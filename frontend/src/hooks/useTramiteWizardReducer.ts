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

import { useReducer, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';
import { publicDraftOwner, resetPublicSubmission } from '../services/radicacionPublicaService';
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
interface PersistedWizardDraft {
  version: 1;
  ownerId: string;
  procedureId: string | null;
  state: Partial<TramiteWizardState>;
}

export function getPersistedWizardState(authenticatedUserId: string | null = null): TramiteWizardState {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return INITIAL_WIZARD_STATE;
  }

  try {
    const raw = window.sessionStorage.getItem(TRAMITE_WIZARD_STORAGE_KEY);
    if (!raw) {
      return INITIAL_WIZARD_STATE;
    }

    const parsed = JSON.parse(raw) as Partial<PersistedWizardDraft> & Partial<TramiteWizardState>;
    if (!parsed || typeof parsed !== 'object') {
      return INITIAL_WIZARD_STATE;
    }

    // Support both envelope format { version: 1, ownerId, state } and flat format { identificacion, documentos }
    const draftState = (parsed.state && typeof parsed.state === 'object') ? parsed.state : parsed;

    if (parsed.version === 1 && authenticatedUserId && parsed.ownerId && parsed.ownerId !== authenticatedUserId) {
      return INITIAL_WIZARD_STATE;
    }

    const persistedProcedureId = typeof parsed.procedureId === 'string' ? parsed.procedureId : null;
    const stateProcedureId = draftState.documentos?.tipoTramiteId || null;
    // A successful cargo is not a resumable draft, and the envelope must match
    // the selected procedure contained in its state.
    if (draftState.cargoEmitido || (persistedProcedureId && stateProcedureId && persistedProcedureId !== stateProcedureId)) {
      return INITIAL_WIZARD_STATE;
    }

    // Validación defensiva del paso canónico restaurado
    const validStep: WizardStep =
      draftState.currentStep === 1 ||
      draftState.currentStep === 2 ||
      draftState.currentStep === 3 ||
      draftState.currentStep === 4
        ? draftState.currentStep
        : 1;

    // Fusión defensiva con los estados iniciales canónicos
    return {
      currentStep: validStep,
      identificacion: {
        ...INITIAL_IDENTIFICACION,
        ...(draftState.identificacion ?? {}),
      },
      documentos: {
        ...INITIAL_DOCUMENTOS,
        ...(draftState.documentos ?? {}),
        archivos: Array.isArray(draftState.documentos?.archivos)
          ? draftState.documentos.archivos
          : [],
      },
      declaracionJurada: {
        ...INITIAL_DECLARACION,
        ...(draftState.declaracionJurada ?? {}),
      },
      cargoEmitido: null,
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
        ...((action.payload.numeroDocumento !== undefined && action.payload.numeroDocumento !== state.identificacion.numeroDocumento) ||
          (action.payload.tipoDocumento !== undefined && action.payload.tipoDocumento !== state.identificacion.tipoDocumento)
          ? { documentos: { ...state.documentos, archivos: [], numeroFolios: 1 }, declaracionJurada: INITIAL_DECLARACION, cargoEmitido: null } : {}),
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
          ...(action.payload.tipoTramiteId !== undefined &&
              action.payload.tipoTramiteId !== state.documentos.tipoTramiteId
            ? INITIAL_DOCUMENTOS
            : {}),
          ...action.payload,
        },
        ...(action.payload.tipoTramiteId !== undefined &&
            action.payload.tipoTramiteId !== state.documentos.tipoTramiteId
          ? { declaracionJurada: INITIAL_DECLARACION, cargoEmitido: null }
          : {}),
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
      resetPublicSubmission();
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
  const authenticatedUserId = useAuthStore((auth) =>
    auth.isAuthenticated ? auth.usuario?.id ?? null : publicDraftOwner(),
  );
  const [state, dispatch] = useReducer(
    wizardReducer,
    authenticatedUserId,
    getPersistedWizardState
  );
  const draftOwnerId = useRef(authenticatedUserId);
  // Mask the previous account's in-memory form immediately on the render
  // caused by an identity switch; the effect below then resets the reducer.
  const stateForAuthenticatedUser = draftOwnerId.current === authenticatedUserId
    ? state
    : INITIAL_WIZARD_STATE;

  // Sincronización defensiva con sessionStorage ante cualquier cambio de estado
  useEffect(() => {
    if (typeof window === 'undefined' || !window.sessionStorage) {
      return;
    }

    try {
      // If the active account changed, discard the previous account's in-memory
      // state before allowing any persistence under the new identity.
      if (draftOwnerId.current !== authenticatedUserId) {
        draftOwnerId.current = authenticatedUserId;
        window.sessionStorage.removeItem(TRAMITE_WIZARD_STORAGE_KEY);
        dispatch({ type: 'RESET' });
        return;
      }

      if (state.cargoEmitido) {
        window.sessionStorage.removeItem(TRAMITE_WIZARD_STORAGE_KEY);
        return;
      }

      // No persistir estados transitorios
      const toPersist = {
        version: 1,
        ownerId: authenticatedUserId || 'anonymous',
        procedureId: state.documentos.tipoTramiteId || null,
        ...state,
        isSubmitting: false,
        error: null,
        state: {
          ...state,
          isSubmitting: false,
          error: null,
        },
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
  }, [state, authenticatedUserId]);

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
    state: stateForAuthenticatedUser,
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
