import '@testing-library/jest-dom/vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  getPersistedWizardState,
  TRAMITE_WIZARD_STORAGE_KEY,
  useTramiteWizardReducer,
  wizardReducer,
} from '@/hooks/useTramiteWizardReducer';
import { useAuthStore } from '@/stores/authStore';
import { INITIAL_WIZARD_STATE } from '@/types/tramiteWizardState';

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const TUPA_035 = '33333333-3333-4333-8333-333333333333';
const TUPA_034 = '44444444-4444-4444-8444-444444444444';

function draft(ownerId: string, procedureId: string | null) {
  return {
    version: 1,
    ownerId,
    procedureId,
    state: {
      ...INITIAL_WIZARD_STATE,
      currentStep: 2,
      documentos: {
        ...INITIAL_WIZARD_STATE.documentos,
        tipoTramiteId: procedureId ?? '',
        asunto: 'Solicitud de prueba independiente',
        archivos: [{ nombre: 'solicitud.pdf', peso: 100, hashSha256: 'a'.repeat(64) }],
      },
    },
  };
}

afterEach(() => {
  sessionStorage.clear();
  useAuthStore.setState({
    accessToken: null,
    refreshToken: null,
    usuario: null,
    isAuthenticated: false,
  });
});

describe('borradores aislados del TramiteWizard', () => {
  it('restaura un borrador solo para la misma cuenta y el procedimiento guardado', () => {
    sessionStorage.setItem(TRAMITE_WIZARD_STORAGE_KEY, JSON.stringify(draft(USER_A, TUPA_035)));

    expect(getPersistedWizardState(USER_A).documentos.tipoTramiteId).toBe(TUPA_035);
    expect(getPersistedWizardState(USER_A).documentos.archivos).toHaveLength(1);
    expect(getPersistedWizardState(USER_B)).toEqual(INITIAL_WIZARD_STATE);
  });

  it('rechaza borradores antiguos sin propietario y metadatos de procedimiento inconsistentes', () => {
    sessionStorage.setItem(TRAMITE_WIZARD_STORAGE_KEY, JSON.stringify(INITIAL_WIZARD_STATE));
    expect(getPersistedWizardState(USER_A)).toEqual(INITIAL_WIZARD_STATE);

    sessionStorage.setItem(TRAMITE_WIZARD_STORAGE_KEY, JSON.stringify({
      ...draft(USER_A, TUPA_035), procedureId: TUPA_034,
    }));
    expect(getPersistedWizardState(USER_A)).toEqual(INITIAL_WIZARD_STATE);
  });

  it('descarta archivos, asunto y declaración al cambiar de procedimiento', () => {
    const before = {
      ...INITIAL_WIZARD_STATE,
      documentos: {
        ...INITIAL_WIZARD_STATE.documentos,
        tipoTramiteId: TUPA_035,
        asunto: 'Solicitud anterior',
        archivos: [{ nombre: 'certificado.pdf', peso: 100, hashSha256: 'b'.repeat(64) }],
      },
      declaracionJurada: { ...INITIAL_WIZARD_STATE.declaracionJurada, aceptaTerminos: true },
    };

    const after = wizardReducer(before, {
      type: 'UPDATE_DOCUMENTOS',
      payload: { tipoTramiteId: TUPA_034 },
    });

    expect(after.documentos).toEqual({ ...INITIAL_WIZARD_STATE.documentos, tipoTramiteId: TUPA_034 });
    expect(after.declaracionJurada).toEqual(INITIAL_WIZARD_STATE.declaracionJurada);
  });

  it('permite una segunda solicitud independiente del mismo procedimiento mediante RESET', () => {
    const first = wizardReducer(INITIAL_WIZARD_STATE, {
      type: 'UPDATE_DOCUMENTOS', payload: { tipoTramiteId: TUPA_035 },
    });
    const submitted = wizardReducer(first, {
      type: 'SET_CARGO',
      payload: {
        cut: 'EXP-2026-000001', fechaRadicacion: '2026-10-30T12:00:00Z',
        fechaRecepcionOficial: '2026-10-30T12:00:00Z', asunto: 'Solicitud', remitente: 'Titular',
        hashTransaccion: 'a'.repeat(64), qrValidationUrl: '/consulta/EXP-2026-000001',
      },
    });
    const next = wizardReducer(submitted, { type: 'RESET' });
    const second = wizardReducer(next, {
      type: 'UPDATE_DOCUMENTOS', payload: { tipoTramiteId: TUPA_035 },
    });

    expect(second.documentos.tipoTramiteId).toBe(TUPA_035);
    expect(second.documentos.archivos).toEqual([]);
    expect(second.cargoEmitido).toBeNull();
  });

  it('borra el borrador de la cuenta anterior al cambiar de ciudadano en la misma pestaña', async () => {
    useAuthStore.setState({ isAuthenticated: true, usuario: {
      id: USER_A, nombreCompleto: 'Ciudadana A', correo: 'a@example.test', rol: 'CIUDADANO',
    } });
    const { result } = renderHook(() => useTramiteWizardReducer());

    act(() => result.current.dispatch({ type: 'UPDATE_DOCUMENTOS', payload: { tipoTramiteId: TUPA_035 } }));
    await waitFor(() => expect(JSON.parse(sessionStorage.getItem(TRAMITE_WIZARD_STORAGE_KEY)!).ownerId).toBe(USER_A));

    act(() => useAuthStore.setState({ usuario: {
      id: USER_B, nombreCompleto: 'Ciudadano B', correo: 'b@example.test', rol: 'CIUDADANO',
    } }));

    await waitFor(() => expect(result.current.state).toEqual(INITIAL_WIZARD_STATE));
    await waitFor(() => expect(JSON.parse(sessionStorage.getItem(TRAMITE_WIZARD_STORAGE_KEY)!).ownerId).toBe(USER_B));
    expect(result.current.state.documentos.tipoTramiteId).toBe('');
  });

  it('elimina la persistencia al emitir el cargo y conserva el resultado en memoria', async () => {
    useAuthStore.setState({ isAuthenticated: true, usuario: {
      id: USER_A, nombreCompleto: 'Ciudadana A', correo: 'a@example.test', rol: 'CIUDADANO',
    } });
    const { result } = renderHook(() => useTramiteWizardReducer());
    act(() => result.current.dispatch({ type: 'SET_CARGO', payload: {
      cut: 'EXP-2026-000002', fechaRadicacion: '2026-10-30T12:00:00Z',
      fechaRecepcionOficial: '2026-10-30T12:00:00Z', asunto: 'Solicitud', remitente: 'Titular',
      hashTransaccion: 'b'.repeat(64), qrValidationUrl: '/consulta/EXP-2026-000002',
    } }));

    await waitFor(() => expect(sessionStorage.getItem(TRAMITE_WIZARD_STORAGE_KEY)).toBeNull());
    expect(result.current.state.cargoEmitido?.cut).toBe('EXP-2026-000002');
  });
});
