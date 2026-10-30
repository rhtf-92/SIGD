/**
 * ==============================================================================
 * PROYECTO: SIGD (Sistema Integral de Gestión Documentaria) - IESTP "Suiza"
 * ENTREGABLES:
 * - ENT-M02-01: Asistente Stepper Wizard MPV en 4 Pasos Canónicos (5 SP)
 * - ENT-M02-06: Cargo Digital con Generación Atómica de CUT y Código QR (3 SP)
 * TAREAS: T-FE-MPV-14, T-FE-MPV-15, T-FE-MPV-16
 * ARCHIVO: src/components/tramite/TramiteWizard.tsx
 * ==============================================================================
 * DESCRIPCIÓN:
 * Orquestador principal del Asistente Wizard de Tramitación de 4 Pasos.
 * Arquitectura basada en useTramiteWizardReducer y subvistas modulares:
 * - Paso 1: StepIdentificacion (DNI, CE, RUC, contacto y validación en tiempo real).
 * - Paso 2: StepDocumentos (Catálogo TUPA, asunto, folios y carga probatoria PDF con SHA-256).
 * - Paso 3: StepDeclaracionJurada (Veracidad Art. 51 LPAG y aceptación de términos).
 * - Paso 4: StepConfirmacion (Consolidado integral, radicación formal y CargoDigitalModal).
 * 100% TypeScript estricto (cero 'any').
 * ==============================================================================
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useTramiteWizardReducer, TRAMITE_WIZARD_STORAGE_KEY } from "../../hooks/useTramiteWizardReducer";
import {
  StepIdentificacion,
  StepDocumentos,
  StepDeclaracionJurada,
  StepConfirmacion,
} from "./WizardSteps";
import CargoDigitalModal from "./CargoDigitalModal";
import type {
  WizardStep,
  CargoDigitalResponse,
} from "../../types/tramiteWizardState";
import { useAuthStore } from "../../stores/authStore";

interface PerfilSolicitante {
  idPersona: string;
  tipoDocumento: 'DNI' | 'CE' | 'RUC';
  numeroDocumento: string;
  nombres: string;
  apellidos: string;
  correo: string;
  telefono: string | null;
  direccion: string | null;
}

export interface TramiteWizardProps {
  /** Callback opcional ejecutado al completar satisfactoriamente la radicación oficial */
  onSuccess?: (cargo: CargoDigitalResponse, cutGenerado: string) => void;
  /** Clases CSS adicionales para el contenedor principal */
  className?: string;
  /** Datos iniciales opcionales */
  initialData?: unknown;
  /** Fechas inhábiles opcionales */
  holidays?: readonly string[];
  /** Clave opcional para forzar reinicio limpio del wizard desde el contenedor */
  resetKey?: string | number;
}

export const TramiteWizard: React.FC<TramiteWizardProps> = ({
  onSuccess,
  className = "",
  resetKey,
}) => {
  const { state, dispatch } = useTramiteWizardReducer();
  const token = useAuthStore((auth) => auth.accessToken);
  const borradorInicial = useRef(state.identificacion);
  const [perfilEstado, setPerfilEstado] = useState<'cargando' | 'listo' | 'error'>(token ? 'cargando' : 'listo');
  const [perfilError, setPerfilError] = useState<string | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);

  const cargarPerfil = useCallback(
    async (signal?: AbortSignal, forzarLimpio = false) => {
      if (!token) {
        setPerfilEstado('listo');
        return;
      }
      setPerfilEstado('cargando');
      setPerfilError(null);
      try {
        const response = await fetch('/api/v1/auth/me', {
          headers: { Authorization: `Bearer ${token}` },
          signal,
        });
        if (!response.ok) {
          throw new Error('No se pudo consultar el perfil de la cuenta.');
        }
        const perfil = (await response.json()) as PerfilSolicitante;
        if (
          !perfil.idPersona ||
          !perfil.numeroDocumento ||
          !perfil.nombres ||
          !['DNI', 'CE', 'RUC'].includes(perfil.tipoDocumento) ||
          (perfil.tipoDocumento !== 'RUC' && !perfil.apellidos)
        ) {
          throw new Error('La cuenta no tiene datos de identidad completos para radicar.');
        }

        const borrador = borradorInicial.current;
        const usarBorrador = !forzarLimpio && borrador.idPersona === perfil.idPersona;

        dispatch({
          type: 'UPDATE_IDENTIFICACION',
          payload: {
            idPersona: perfil.idPersona,
            tipoDocumento: perfil.tipoDocumento,
            numeroDocumento: perfil.numeroDocumento,
            nombres: perfil.nombres,
            apellidos: perfil.apellidos,
            correo: usarBorrador ? borrador.correo || perfil.correo : perfil.correo,
            telefono: usarBorrador ? borrador.telefono || perfil.telefono || '' : perfil.telefono || '',
            direccion: usarBorrador ? borrador.direccion || perfil.direccion || '' : perfil.direccion || '',
          },
        });
        setPerfilEstado('listo');
        setPerfilError(null);
      } catch (error: unknown) {
        if (signal?.aborted) return;
        setPerfilError(error instanceof Error ? error.message : 'No se pudo cargar el perfil.');
        setPerfilEstado('error');
      }
    },
    [token, dispatch]
  );

  // Carga inicial del perfil al montar con token
  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    void cargarPerfil(controller.signal, false);
    return () => controller.abort();
  }, [token, cargarPerfil]);

  // Auto-recuperación: Si el token existe y el número de documento está vacío pero perfilEstado no está cargando ni en error,
  // recargar identidad desde auth/me para evitar campos bloqueados vacíos tras un RESET.
  useEffect(() => {
    if (token && perfilEstado === 'listo' && !state.identificacion.numeroDocumento) {
      void cargarPerfil(undefined, true);
    }
  }, [token, perfilEstado, state.identificacion.numeroDocumento, cargarPerfil]);

  const handleIniciarNuevoTramite = useCallback(() => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        window.sessionStorage.removeItem(TRAMITE_WIZARD_STORAGE_KEY);
      } catch {
        // Ignorar fallos de acceso en entornos restringidos
      }
    }
    borradorInicial.current = {
      idPersona: '',
      tipoDocumento: 'DNI',
      numeroDocumento: '',
      nombres: '',
      apellidos: '',
      correo: '',
      telefono: '',
      direccion: '',
    };
    dispatch({ type: 'RESET' });
    setModalAbierto(false);
    if (token) {
      void cargarPerfil(undefined, true);
    }
  }, [dispatch, token, cargarPerfil]);

  // Reinicio reactivo si el contenedor envía un cambio de resetKey
  const prevResetKey = useRef(resetKey);
  useEffect(() => {
    if (resetKey !== undefined && resetKey !== prevResetKey.current) {
      prevResetKey.current = resetKey;
      handleIniciarNuevoTramite();
    }
  }, [resetKey, handleIniciarNuevoTramite]);

  // Apertura automática del modal institucional de cargo cuando se asienta el trámite
  useEffect(() => {
    if (state.cargoEmitido) {
      setModalAbierto(true);
    }
  }, [state.cargoEmitido]);

  const handleNext = useCallback(() => {
    if (state.currentStep < 4) {
      dispatch({
        type: "SET_STEP",
        payload: state.radicacionPendiente ? 4 : ((state.currentStep + 1) as WizardStep),
      });
    }
  }, [state.currentStep, state.radicacionPendiente, dispatch]);

  const handleBack = useCallback(() => {
    if (state.radicacionPendiente && state.currentStep <= 2) return;
    if (state.currentStep > 1) {
      dispatch({
        type: "SET_STEP",
        payload: ((state.currentStep - 1) as WizardStep),
      });
    }
  }, [state.currentStep, state.radicacionPendiente, dispatch]);

  const handleGoToStep = useCallback(
    (step: WizardStep) => {
      if (state.radicacionPendiente && step !== 2) return;
      dispatch({ type: "SET_STEP", payload: step });
    },
    [dispatch, state.radicacionPendiente],
  );

  const handleSuccess = useCallback(
    (cargo: CargoDigitalResponse, cut: string) => {
      setModalAbierto(true);
      if (onSuccess) {
        onSuccess(cargo, cut);
      }
    },
    [onSuccess],
  );

  return (
    <div className={`space-y-6 ${className}`}>
      {perfilEstado === 'cargando' && (
        <div role="status" className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xs">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-[#006EC7] border-r-transparent mb-3" />
          <p className="text-sm font-semibold text-slate-700">Cargando datos de tu cuenta...</p>
          <p className="text-xs text-slate-500 mt-1">Recuperando tu identidad oficial para el trámite...</p>
        </div>
      )}
      {perfilEstado === 'error' && (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
          <h3 className="text-sm font-bold">No se pudo consultar el perfil de la cuenta</h3>
          <p className="text-xs mt-1 text-rose-700">{perfilError}. Vuelve a iniciar sesión si el problema continúa.</p>
        </div>
      )}
      {perfilEstado === 'listo' && (
        <>
          {/* 1. RENDERIZADO MODULAR SEGÚN EL PASO ACTIVO */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
            {state.currentStep === 1 && (
              <StepIdentificacion
                data={state.identificacion}
                dispatch={dispatch}
                onNext={handleNext}
                onBack={handleBack}
                isSubmitting={state.isSubmitting}
                identityLocked={Boolean(token)}
              />
            )}

            {state.currentStep === 2 && (
              <StepDocumentos
                data={state.documentos}
                dispatch={dispatch}
                onNext={handleNext}
                onBack={handleBack}
                isSubmitting={state.isSubmitting}
                radicacionPendiente={Boolean(state.radicacionPendiente)}
              />
            )}

            {state.currentStep === 3 && (
              <StepDeclaracionJurada
                data={state.declaracionJurada}
                dispatch={dispatch}
                onNext={handleNext}
                onBack={handleBack}
                isSubmitting={state.isSubmitting}
              />
            )}

            {state.currentStep === 4 && (
              <StepConfirmacion
                state={state}
                dispatch={dispatch}
                onBack={handleBack}
                onGoToStep={handleGoToStep}
                onSuccess={handleSuccess}
                onIniciarNuevoTramite={handleIniciarNuevoTramite}
              />
            )}
          </div>

          {/* 2. MODAL FORMAL DE CARGO DIGITAL CONMEMORATIVO Y PROBATORIO */}
          {state.cargoEmitido && (
            <CargoDigitalModal
              isOpen={modalAbierto}
              onClose={() => setModalAbierto(false)}
              cargo={state.cargoEmitido}
            />
          )}
        </>
      )}
    </div>
  );
};

export default TramiteWizard;
