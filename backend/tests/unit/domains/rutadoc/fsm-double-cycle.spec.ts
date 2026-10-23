import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PoolClient } from 'pg';
import { DomainError } from '../../../../src/shared/domain/errors/index.js';
import { observarExpediente, subsanarExpediente } from '../../../../src/domains/rutadoc/derivaciones.service.js';
vi.mock('../../../../src/shared/request-context/request-context.js', () => ({
  getRequestContext: vi.fn(),
}));
import { getRequestContext } from '../../../../src/shared/request-context/request-context.js';

vi.mock('../../../../src/audit/evento-outbox.repository.js', () => ({
  insertarEvento: vi.fn().mockResolvedValue(undefined),
}));

describe('FSM Doble Ciclo: Observación y Subsanación Canónica (F-06)', () => {
  let mockCliente: PoolClient;
  let mockQuery: ReturnType<typeof vi.fn>;
  const mockExpedienteId = 'e2b34927-4c07-4e76-8e5c-74b8686d1a10';

  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery = vi.fn();
    mockCliente = { query: mockQuery } as unknown as PoolClient;
    vi.mocked(getRequestContext).mockReturnValue({
      usuario_id: 'usr-operador-1',
      correlation_id: 'corr-fsm-1',
      ip_origen: '127.0.0.1',
      user_agent: 'vitest-fsm-runner',
    });
  });

  it('rechaza observar un expediente si su estado es EN_TRAMITE (estado no canónico retirado)', async () => {
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ estado_actual_id: 'EN_TRAMITE', area_contexto_id: 'area-1' }],
    });

    await expect(observarExpediente(mockCliente, mockExpedienteId, 'Falta firma digital'))
      .rejects.toThrow(DomainError);
  });

  it('ejecuta 2 ciclos completos de observación y subsanación sin romper FSM', async () => {
    // === CICLO 1 ===
    // 1.1 Estado inicial: EN_REVISION -> Observar
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ estado_actual_id: 'EN_REVISION', area_contexto_id: 'area-sistemas' }],
    });
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ movimiento_id: 'mov-obs-1' }],
    }); // INSERT OBSERVACION -> OBSERVADO
    mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // UPDATE sigd_tra.expediente SET estado = 'OBSERVADO'

    await observarExpediente(mockCliente, mockExpedienteId, 'Observación ciclo 1: requisitos incompletos');

    // Verificar queries de observación ciclo 1
    expect(mockQuery).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("SET estado = 'OBSERVADO'"),
      [mockExpedienteId]
    );

    // 1.2 Estado resultante: OBSERVADO -> Subsanar
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ estado_actual_id: 'OBSERVADO', area_contexto_id: 'area-sistemas' }],
    });
    mockQuery.mockResolvedValueOnce({}); // INSERT CORRECCION -> SUBSANADO
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ movimiento_id: 'mov-sub-1' }],
    }); // INSERT INICIAR_REVISION -> EN_REVISION
    mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // UPDATE sigd_tra.expediente SET estado = 'EN_REVISION'

    await subsanarExpediente(mockCliente, mockExpedienteId, 'Subsanación ciclo 1: adjunto requisitos');

    // Verificar que subsanar actualiza a EN_REVISION (NO EN_TRAMITE)
    expect(mockQuery).toHaveBeenNthCalledWith(
      7,
      expect.stringContaining("SET estado = 'EN_REVISION'"),
      [mockExpedienteId]
    );

    // === CICLO 2 ===
    // 2.1 Estado posterior: EN_REVISION -> Observar nuevamente
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ estado_actual_id: 'EN_REVISION', area_contexto_id: 'area-sistemas' }],
    });
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ movimiento_id: 'mov-obs-2' }],
    }); // INSERT OBSERVACION -> OBSERVADO
    mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // UPDATE sigd_tra.expediente SET estado = 'OBSERVADO'

    await observarExpediente(mockCliente, mockExpedienteId, 'Observación ciclo 2: firma ilegible');

    expect(mockQuery).toHaveBeenNthCalledWith(
      10,
      expect.stringContaining("SET estado = 'OBSERVADO'"),
      [mockExpedienteId]
    );

    // 2.2 Estado resultante: OBSERVADO -> Subsanar nuevamente
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ estado_actual_id: 'OBSERVADO', area_contexto_id: 'area-sistemas' }],
    });
    mockQuery.mockResolvedValueOnce({}); // INSERT CORRECCION -> SUBSANADO
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ movimiento_id: 'mov-sub-2' }],
    }); // INSERT INICIAR_REVISION -> EN_REVISION
    mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // UPDATE sigd_tra.expediente SET estado = 'EN_REVISION'

    await subsanarExpediente(mockCliente, mockExpedienteId, 'Subsanación ciclo 2: reenvío firma legible');

    expect(mockQuery).toHaveBeenNthCalledWith(
      14,
      expect.stringContaining("SET estado = 'EN_REVISION'"),
      [mockExpedienteId]
    );

    // Ambos ciclos se completaron exitosamente sin errores de estado o concurrencia
    expect(mockQuery).toHaveBeenCalledTimes(14);
  });
});
