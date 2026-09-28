/**
 * ==============================================================================
 * PROYECTO: SIGD (Sistema Integral de Gestión Documentaria) - IESTP "Suiza"
 * MÓDULO 2: Registro Documentario - Mesa de Partes Virtual
 * TAREA: T-FE-MPV-14 — Pruebas Unitarias y de Integración de Máquina de Estados
 * ARCHIVO: src/tests/m2/tramiteWizard.test.tsx
 * ==============================================================================
 */

import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import {
  wizardReducer,
  getPersistedWizardState,
  useTramiteWizardReducer,
  TRAMITE_WIZARD_STORAGE_KEY,
} from '../../hooks/useTramiteWizardReducer';
import {
  INITIAL_WIZARD_STATE,
  type CargoDigitalResponse,
} from '../../types/tramiteWizardState';
import { TramiteWizard } from '../../components/tramite/TramiteWizard';

describe('T-FE-MPV-14: useTramiteWizardReducer y Máquina de Estados', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  describe('1. Reducer Puro (wizardReducer) y Acciones Atómicas', () => {
    it('SET_STEP: actualiza el paso canónico y limpia errores previos', () => {
      const stateWithError = { ...INITIAL_WIZARD_STATE, error: 'Error previo' };
      const nextState = wizardReducer(stateWithError, { type: 'SET_STEP', payload: 2 });

      expect(nextState.currentStep).toBe(2);
      expect(nextState.error).toBeNull();
    });

    it('SET_STEP: ignora pasos fuera del rango canónico (menor a 1 o mayor a 4)', () => {
      // @ts-expect-error Validación en tiempo de ejecución de paso inválido
      const invalidStepLow = wizardReducer(INITIAL_WIZARD_STATE, { type: 'SET_STEP', payload: 0 });
      expect(invalidStepLow.currentStep).toBe(1);

      // @ts-expect-error Validación en tiempo de ejecución de paso inválido
      const invalidStepHigh = wizardReducer(INITIAL_WIZARD_STATE, { type: 'SET_STEP', payload: 5 });
      expect(invalidStepHigh.currentStep).toBe(1);
    });

    it('UPDATE_IDENTIFICACION: actualiza campos de manera inmutable', () => {
      const nextState = wizardReducer(INITIAL_WIZARD_STATE, {
        type: 'UPDATE_IDENTIFICACION',
        payload: {
          numeroDocumento: '71234567',
          nombres: 'Carlos Alberto',
          apellidos: 'López Quispe',
        },
      });

      expect(nextState.identificacion.numeroDocumento).toBe('71234567');
      expect(nextState.identificacion.nombres).toBe('Carlos Alberto');
      expect(nextState.identificacion.apellidos).toBe('López Quispe');
      expect(nextState.identificacion.tipoDocumento).toBe('DNI'); // Mantiene defaults
    });

    it('UPDATE_DOCUMENTOS: actualiza los datos del trámite y archivos adjuntos', () => {
      const nextState = wizardReducer(INITIAL_WIZARD_STATE, {
        type: 'UPDATE_DOCUMENTOS',
        payload: {
          tipoTramiteId: 'TUPA-01',
          asunto: 'Solicitud formal de certificado oficial de estudios',
          numeroFolios: 4,
          archivos: [
            {
              nombre: 'solicitud.pdf',
              peso: 204800,
              hashSha256: 'abcd1234ef5678',
            },
          ],
        },
      });

      expect(nextState.documentos.tipoTramiteId).toBe('TUPA-01');
      expect(nextState.documentos.asunto).toContain('certificado oficial');
      expect(nextState.documentos.numeroFolios).toBe(4);
      expect(nextState.documentos.archivos).toHaveLength(1);
      expect(nextState.documentos.archivos[0].nombre).toBe('solicitud.pdf');
    });

    it('UPDATE_DECLARACION: actualiza el estado de las declaraciones juradas', () => {
      const nextState = wizardReducer(INITIAL_WIZARD_STATE, {
        type: 'UPDATE_DECLARACION',
        payload: {
          aceptaTerminos: true,
          declaracionVeracidad: true,
        },
      });

      expect(nextState.declaracionJurada.aceptaTerminos).toBe(true);
      expect(nextState.declaracionJurada.declaracionVeracidad).toBe(true);
      expect(nextState.declaracionJurada.autorizaNotificacionCasilla).toBe(true); // Default preservado
    });

    it('SET_CARGO: asigna el cargo emitido, avanza al paso 4 y desactiva isSubmitting', () => {
      const cargoMuestra: CargoDigitalResponse = {
        cut: 'EXP-2026-987654',
        fechaRadicacion: '24 de Septiembre de 2026, 17:00',
        fechaRecepcionOficial: '24 de Septiembre de 2026, 17:00',
        asunto: 'Constancia de Matrícula',
        remitente: 'Ana María Flores',
        hashTransaccion: '7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
        qrValidationUrl: 'https://sigd.iestpsuiza.edu.pe/consulta/EXP-2026-987654',
      };

      const intermediateState = { ...INITIAL_WIZARD_STATE, isSubmitting: true, currentStep: 3 as const };
      const nextState = wizardReducer(intermediateState, {
        type: 'SET_CARGO',
        payload: cargoMuestra,
      });

      expect(nextState.cargoEmitido).toEqual(cargoMuestra);
      expect(nextState.currentStep).toBe(4);
      expect(nextState.isSubmitting).toBe(false);
      expect(nextState.error).toBeNull();
    });

    it('SET_SUBMITTING y SET_ERROR: gestionan flags transitorios', () => {
      const submittingState = wizardReducer(INITIAL_WIZARD_STATE, {
        type: 'SET_SUBMITTING',
        payload: true,
      });
      expect(submittingState.isSubmitting).toBe(true);

      const errorState = wizardReducer(submittingState, {
        type: 'SET_ERROR',
        payload: 'Fallo de conexión con el servidor',
      });
      expect(errorState.error).toBe('Fallo de conexión con el servidor');
      expect(errorState.isSubmitting).toBe(false);
    });

    it('RESET: reinicia el estado a INITIAL_WIZARD_STATE y borra sessionStorage', () => {
      sessionStorage.setItem(TRAMITE_WIZARD_STORAGE_KEY, JSON.stringify({ currentStep: 3 }));
      const modifiedState = { ...INITIAL_WIZARD_STATE, currentStep: 3 as const };

      const resetState = wizardReducer(modifiedState, { type: 'RESET' });

      expect(resetState).toEqual(INITIAL_WIZARD_STATE);
      expect(sessionStorage.getItem(TRAMITE_WIZARD_STORAGE_KEY)).toBeNull();
    });
  });

  describe('2. Persistencia Defensiva en sessionStorage (Lazy Initialization)', () => {
    it('devuelve INITIAL_WIZARD_STATE si sessionStorage está vacío', () => {
      const state = getPersistedWizardState();
      expect(state).toEqual(INITIAL_WIZARD_STATE);
    });

    it('recupera y fusiona defensivamente los datos guardados en sessionStorage', () => {
      const savedDraft = {
        currentStep: 2,
        identificacion: {
          tipoDocumento: 'DNI',
          numeroDocumento: '44556677',
          nombres: 'María',
          apellidos: 'Rojas',
          correo: 'mrojas@iestpsuiza.edu.pe',
          telefono: '942001122',
        },
      };
      sessionStorage.setItem(TRAMITE_WIZARD_STORAGE_KEY, JSON.stringify(savedDraft));

      const state = getPersistedWizardState();
      expect(state.currentStep).toBe(2);
      expect(state.identificacion.numeroDocumento).toBe('44556677');
      expect(state.identificacion.nombres).toBe('María');
      expect(state.isSubmitting).toBe(false); // Siempre false
      expect(state.error).toBeNull(); // Siempre null
    });

    it('sanea el paso canónico ante corrupción de datos (ej. paso = 99 retorna 1)', () => {
      sessionStorage.setItem(
        TRAMITE_WIZARD_STORAGE_KEY,
        JSON.stringify({ currentStep: 99, identificacion: {} })
      );

      const state = getPersistedWizardState();
      expect(state.currentStep).toBe(1);
    });

    it('captura errores de JSON corrupto de forma defensiva sin colapsar', () => {
      sessionStorage.setItem(TRAMITE_WIZARD_STORAGE_KEY, '{ json_invalido: 123,, ');

      const state = getPersistedWizardState();
      expect(state).toEqual(INITIAL_WIZARD_STATE);
    });
  });

  describe('3. Custom Hook useTramiteWizardReducer', () => {
    it('inicializa con el estado por defecto y expone helpers atómicos', () => {
      const { result } = renderHook(() => useTramiteWizardReducer());

      expect(result.current.state.currentStep).toBe(1);

      act(() => {
        result.current.updateIdentificacion({
          numeroDocumento: '88776655',
          nombres: 'Pedro',
        });
      });

      expect(result.current.state.identificacion.numeroDocumento).toBe('88776655');
      expect(result.current.state.identificacion.nombres).toBe('Pedro');
    });

    it('permite avanzar y retroceder con nextStep y prevStep respetando límites', () => {
      const { result } = renderHook(() => useTramiteWizardReducer());

      // No retrocede más allá del paso 1
      act(() => {
        result.current.prevStep();
      });
      expect(result.current.state.currentStep).toBe(1);

      // Avanza al paso 2
      act(() => {
        result.current.nextStep();
      });
      expect(result.current.state.currentStep).toBe(2);

      // Retrocede al paso 1
      act(() => {
        result.current.prevStep();
      });
      expect(result.current.state.currentStep).toBe(1);
    });

    it('sincroniza automáticamente los cambios en sessionStorage', () => {
      const { result } = renderHook(() => useTramiteWizardReducer());

      act(() => {
        result.current.updateIdentificacion({
          nombres: 'Elena',
        });
      });

      const raw = sessionStorage.getItem(TRAMITE_WIZARD_STORAGE_KEY);
      expect(raw).not.toBeNull();
      const parsed = JSON.parse(raw!);
      expect(parsed.identificacion.nombres).toBe('Elena');
    });
  });

  describe('4. Componente Visual TramiteWizard.tsx', () => {
    it('renderiza el asistente en el Paso 1 con sus campos canónicos de identificación', () => {
      render(<TramiteWizard />);

      expect(
        screen.getByRole('heading', { name: /Identificación del Solicitante/i })
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/Tipo de Documento Oficial/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Número de Documento \*/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Nombres Completos \*/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^Siguiente/i })).toBeInTheDocument();
    });

    it('muestra el stepper con los 4 pasos canónicos accesibles', () => {
      render(<TramiteWizard />);

      const nav = screen.getByRole('navigation', { name: /Progreso del trámite/i });
      expect(nav).toBeInTheDocument();
      expect(within(nav).getByText(/Paso 1 de 4/i)).toBeInTheDocument();
      expect(within(nav).getByText(/Paso 2 de 4/i)).toBeInTheDocument();
      expect(within(nav).getByText(/Paso 3 de 4/i)).toBeInTheDocument();
      expect(within(nav).getByText(/Paso 4 de 4/i)).toBeInTheDocument();
    });

    it('el botón Siguiente Paso está deshabilitado si faltan campos obligatorios en el Paso 1', () => {
      render(<TramiteWizard />);

      const nextButton = screen.getByRole('button', { name: /^Siguiente/i });
      expect(nextButton).toBeDisabled();
    });

    it('habilita el botón Siguiente Paso al completar datos válidos en el Paso 1 y permite navegar al Paso 2', () => {
      render(<TramiteWizard />);

      const inputDoc = screen.getByLabelText(/Número de Documento \*/i);
      const inputNombres = screen.getByLabelText(/Nombres Completos \*/i);
      const inputApellidos = screen.getByLabelText(/Apellidos Completos \*/i);
      const inputCorreo = screen.getByLabelText(/Correo Electrónico Notificable \*/i);
      const inputTelefono = screen.getByLabelText(/Teléfono Celular o Fijo \*/i);

      fireEvent.change(inputDoc, { target: { value: '74123456' } });
      fireEvent.change(inputNombres, { target: { value: 'Jorge' } });
      fireEvent.change(inputApellidos, { target: { value: 'Sánchez' } });
      fireEvent.change(inputCorreo, { target: { value: 'jorge.sanchez@gmail.com' } });
      fireEvent.change(inputTelefono, { target: { value: '987123456' } });

      const nextButton = screen.getByRole('button', { name: /^Siguiente/i });
      expect(nextButton).not.toBeDisabled();

      fireEvent.click(nextButton);

      expect(
        screen.getByRole('heading', { name: /Documentos del Trámite/i })
      ).toBeInTheDocument();
    });
  });
});
