import { vi, describe, it, expect, beforeEach } from 'vitest';
import type { PoolClient } from 'pg';
import { derivarExpediente, atenderExpediente, archivarExpediente } from '../../../../src/domains/rutadoc/derivaciones.service.js';
import { UnauthorizedError, ForbiddenError, DomainError } from '../../../../src/shared/domain/errors/index.js';
import type { DerivarExpedienteDTO } from '../../../../src/domains/rutadoc/dto/derivarExpediente.dto.js';
import type { AtenderExpedienteDTO } from '../../../../src/domains/rutadoc/dto/atenderExpediente.dto.js';
import type { ArchivarExpedienteDTO } from '../../../../src/domains/rutadoc/dto/archivarExpediente.dto.js';

vi.mock('../../../../src/shared/request-context/request-context.js', () => ({
  getRequestContext: vi.fn(),
}));
import { getRequestContext } from '../../../../src/shared/request-context/request-context.js';

vi.mock('../../../../src/audit/evento-outbox.repository.js', () => ({
  insertarEvento: vi.fn(),
}));
import { insertarEvento } from '../../../../src/audit/evento-outbox.repository.js';

function contexto(sobreescribe: Partial<{ usuario_id: string | null; unidad_organica_id: string | null }> = {}) {
  return {
    correlation_id: 'c1',
    ip_origen: 'ip',
    user_agent: 'ua',
    usuario_id: 'usr-123',
    unidad_organica_id: 'area-origen-1',
    ...sobreescribe,
  };
}

describe('T-BE-RD-06: derivaciones.service.ts', () => {
  const mockQuery = vi.fn();
  const mockCliente = {
    query: mockQuery,
    release: vi.fn(),
  } as unknown as PoolClient;

  const mockExpedienteId = 'a3401043-807f-41f3-9de8-a042e4b312d4';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Simula las consultas del servicio FSM canónico: 1 estado actual, 1 arista
  // de transición, y 1 INSERT de movimiento por destino.
  function setupMockQueries(cantidadDestinos = 1) {
    mockQuery.mockReset();
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ existe: true, estado_nuevo: 'EN_CALIFICACION', area_actual_id: 'area-origen-1' }],
    });
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ estado_nuevo: 'DERIVADO' }],
    });
    for (let i = 0; i < cantidadDestinos; i++) {
      mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{ id_movimiento: `mov-${i}` }] });
    }
  }

  it('1. Debe rechazar la derivación si el usuario no está autenticado (Validación Contexto)', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce(undefined);
    const dto: DerivarExpedienteDTO = { destinos: [{ area_destino_id: 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a2', es_copia: false }], proveido: 'test' };

    await expect(derivarExpediente(mockCliente, mockExpedienteId, dto))
      .rejects.toThrow(UnauthorizedError);

    expect(mockQuery).not.toHaveBeenCalled();
    expect(insertarEvento).not.toHaveBeenCalled();
  });

  it('2. Debe procesar exitosamente una Derivación Simple y emitir al Outbox', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce(contexto());
    setupMockQueries(1);

    const dto: DerivarExpedienteDTO = {
      destinos: [{ area_destino_id: 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a2', es_copia: false }],
      proveido: 'Para atención requerida',
    };

    await derivarExpediente(mockCliente, mockExpedienteId, dto);

    // 2 SELECT (estado actual + arista FSM) + 1 INSERT de movimiento = 3
    expect(mockQuery).toHaveBeenCalledTimes(3);

    const queries = mockQuery.mock.calls.map((call) => call[0].toString().toUpperCase());
    expect(queries.filter((q) => q.includes('INSERT INTO SIGD_RUT.MOVIMIENTO_TRAMITE'))).toHaveLength(1);

    expect(insertarEvento).toHaveBeenCalledTimes(1);
    expect(insertarEvento).toHaveBeenCalledWith(mockCliente, expect.objectContaining({
      tipo_evento: 'ExpedienteDerivado',
      payload: expect.objectContaining({
        identidad: { expediente_id: mockExpedienteId, movimiento_id: 'mov-0' },
        datos_especificos: {
          motivo: 'Para atención requerida',
          es_copia: false,
          usuario_asignado_id: undefined,
        },
      }),
    }));
  });

  it('3. Debe procesar exitosamente una Derivación Múltiple', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce(contexto());
    setupMockQueries(3);

    const dto: DerivarExpedienteDTO = {
      destinos: [
        { area_destino_id: 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a2', es_copia: false },
        { area_destino_id: 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a3', es_copia: true },
        { area_destino_id: 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a4', es_copia: true, usuario_asignado_id: 'b2b2b2b2-b2b2-42b2-82b2-b2b2b2b2b2b2' },
      ],
      proveido: 'Pase a multiples areas',
    };

    await derivarExpediente(mockCliente, mockExpedienteId, dto);

    // 2 iniciales + 1 INSERT por destino (3) = 5 llamadas a la BD
    expect(mockQuery).toHaveBeenCalledTimes(5);
    // 3 eventos independientes al Outbox dentro de la misma transacción
    expect(insertarEvento).toHaveBeenCalledTimes(3);
  });

  it('4. Cumplimiento WORM: Ningún query ejecutado debe contener sentencias UPDATE o DELETE', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce(contexto());
    setupMockQueries(2);

    const dto: DerivarExpedienteDTO = {
      destinos: [
        { area_destino_id: 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a2', es_copia: false },
        { area_destino_id: 'a1a1a1a1-a1a1-41a1-81a1-a1a1a1a1a1a3', es_copia: true },
      ],
      proveido: 'Validación WORM',
    };

    await derivarExpediente(mockCliente, mockExpedienteId, dto);

    const queriesEjecutados = mockQuery.mock.calls.map((call) => call[0].toString().toUpperCase());
    for (const query of queriesEjecutados) {
      expect(query).not.toMatch(/\bUPDATE\b/);
      expect(query).not.toMatch(/\bDELETE\b/);
    }
  });
});

describe('T-BE-RD-07: Atención Resolutiva', () => {
  const mockQuery = vi.fn();
  const mockCliente = {
    query: mockQuery,
    release: vi.fn(),
  } as unknown as PoolClient;

  const mockExpedienteId = 'a3401043-807f-41f3-9de8-a042e4b312d4';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupMockQueriesAtencion(estado = 'EN_FIRMA', area = 'area-origen-1') {
    mockQuery.mockReset();
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ existe: true, estado_nuevo: estado, area_actual_id: area }],
    });
    mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{ estado_nuevo: 'RESUELTO' }] });
    mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{ id_movimiento: 'mov-atencion-1' }] });
  }

  it('1. Debe rechazar la atención si el usuario no está autenticado', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce(undefined);
    const dto: AtenderExpedienteDTO = { resultado_resumen: 'Prueba rechazo' };

    await expect(atenderExpediente(mockCliente, mockExpedienteId, dto))
      .rejects.toThrow(UnauthorizedError);

    expect(mockQuery).not.toHaveBeenCalled();
    expect(insertarEvento).not.toHaveBeenCalled();
  });

  it('2. Debe procesar exitosamente la atención y emitir al Outbox', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce(contexto());
    setupMockQueriesAtencion();

    const dto: AtenderExpedienteDTO = { resultado_resumen: 'Resolución Aprobada' };
    await atenderExpediente(mockCliente, mockExpedienteId, dto);

    // 2 SELECT (estado actual + arista FIRMA) + 1 INSERT = 3
    expect(mockQuery).toHaveBeenCalledTimes(3);

    const queries = mockQuery.mock.calls.map((call) => call[0].toString().toUpperCase());
    expect(queries.some((q) => q.includes('INSERT INTO SIGD_RUT.MOVIMIENTO_TRAMITE'))).toBe(true);
    expect(mockQuery.mock.calls[2][1]).toEqual(expect.arrayContaining(['FIRMA']));

    expect(insertarEvento).toHaveBeenCalledTimes(1);
    expect(insertarEvento).toHaveBeenCalledWith(mockCliente, expect.objectContaining({
      tipo_evento: 'ExpedienteAtendido',
      payload: expect.objectContaining({
        datos_especificos: { resultado_resumen: 'Resolución Aprobada' },
      }),
    }));
  });

  it('2.1. Debe lanzar ForbiddenError si el usuario no pertenece al area del expediente', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce(contexto({ unidad_organica_id: 'area-diferente' }));
    setupMockQueriesAtencion();

    const dto: AtenderExpedienteDTO = { resultado_resumen: 'Prueba Rechazo Area' };

    await expect(atenderExpediente(mockCliente, mockExpedienteId, dto))
      .rejects.toThrow(ForbiddenError);
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it('3. Cumplimiento WORM: Ningún query debe contener sentencias UPDATE o DELETE', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce(contexto());
    setupMockQueriesAtencion();

    const dto: AtenderExpedienteDTO = { resultado_resumen: 'Prueba WORM' };
    await atenderExpediente(mockCliente, mockExpedienteId, dto);

    const queriesEjecutados = mockQuery.mock.calls.map((call) => call[0].toString().toUpperCase());
    for (const query of queriesEjecutados) {
      expect(query).not.toMatch(/\bUPDATE\b/);
      expect(query).not.toMatch(/\bDELETE\b/);
    }
  });
});

describe('T-BE-RD-08: Archivado Formal', () => {
  const mockQuery = vi.fn();
  const mockCliente = {
    query: mockQuery,
    release: vi.fn(),
  } as unknown as PoolClient;

  const mockExpedienteId = 'a3401043-807f-41f3-9de8-a042e4b312d4';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupMockQueriesArchivo(conArcoCierre = true) {
    mockQuery.mockReset();
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ existe: true, estado_nuevo: 'RESUELTO', area_actual_id: 'area-origen-1' }],
    });
    if (conArcoCierre) {
      mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{ estado_nuevo: 'ARCHIVADO' }] });
      mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{ id_movimiento: 'mov-archivo-1' }] });
    } else {
      mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });
    }
  }

  it('1. Debe rechazar el archivado si el estado actual no permite CIERRE', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce(contexto());
    setupMockQueriesArchivo(false);

    const dto: ArchivarExpedienteDTO = { estante: 'E1', balda: 'B1', caja: 'C1' };

    await expect(archivarExpediente(mockCliente, mockExpedienteId, dto))
      .rejects.toThrow(DomainError);
    expect(insertarEvento).not.toHaveBeenCalled();
  });

  it('2. Cumplimiento WORM: Ningun query debe contener sentencias UPDATE o DELETE', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce(contexto());
    setupMockQueriesArchivo(true);

    const dto: ArchivarExpedienteDTO = { estante: 'E1', balda: 'B1', caja: 'C1' };
    await archivarExpediente(mockCliente, mockExpedienteId, dto);

    expect(mockQuery).toHaveBeenCalledTimes(3);
    expect(insertarEvento).toHaveBeenCalledTimes(1);
    expect(insertarEvento).toHaveBeenCalledWith(mockCliente, expect.objectContaining({
      tipo_evento: 'ExpedienteArchivado',
    }));

    const queriesEjecutados = mockQuery.mock.calls.map((call) => call[0].toString().toUpperCase());
    for (const query of queriesEjecutados) {
      expect(query).not.toMatch(/\bUPDATE\b/);
      expect(query).not.toMatch(/\bDELETE\b/);
    }
  });
});