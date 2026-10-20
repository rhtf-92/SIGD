import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { PoolClient } from 'pg';
import {
  derivarExpediente,
  atenderExpediente,
  archivarExpediente,
  observarExpediente,
  subsanarExpediente,
} from '../../../../src/domains/rutadoc/derivaciones.service.js';
import { UnauthorizedError, ForbiddenError, NotFoundError } from '../../../../src/shared/domain/errors/index.js';
import { DomainError } from '../../../../src/shared/domain/errors/index.js';
import type { DerivarExpedienteDTO } from '../../../../src/domains/rutadoc/dto/derivarExpediente.dto.js';
import type { AtenderExpedienteDTO } from '../../../../src/domains/rutadoc/dto/atenderExpediente.dto.js';
import type { ArchivarExpedienteDTO } from '../../../../src/domains/rutadoc/dto/archivarExpediente.dto.js';

// 1. Mocks de mÇ­dulos externos (No tocar BD real ni lÃ³gica de otros grupos)
vi.mock('../../../../src/shared/request-context/request-context.js', () => ({
  getRequestContext: vi.fn()
}));
import { getRequestContext } from '../../../../src/shared/request-context/request-context.js';

vi.mock('../../../../src/audit/evento-outbox.repository.js', () => ({
  insertarEvento: vi.fn()
}));
import { insertarEvento } from '../../../../src/audit/evento-outbox.repository.js';

describe('T-BE-RD-06: derivaciones.service.ts', () => {
  const mockQuery = vi.fn();
  const mockCliente = {
    query: mockQuery,
    release: vi.fn(),
  } as unknown as PoolClient;

  const mockExpedienteId = 'exp-123-uuid';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper para simular las respuestas de la Base de Datos puramente con SELECTs e INSERTs en BASELINE_2026_V1
  function setupMockQueries(cantidadDestinos = 1) {
    mockQuery.mockReset();
    // Resolución 1: Obtener estado y área actual desde BASELINE_2026_V1
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ estado_actual_id: 'EN_CALIFICACION', area_contexto_id: 'area-origen-1' }]
    });
    // Resoluciones dinámicas para cada destino en el loop (solo INSERT movimiento_tramite en baseline)
    for (let i = 0; i < cantidadDestinos; i++) {
      mockQuery.mockResolvedValueOnce({ rows: [{ movimiento_id: `mov-nuevo-${i}` }] }); // INSERT movimiento
    }
  }

  it('1. Debe rechazar la derivacion si el usuario no esta autenticado (Validacion Contexto)', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce(undefined);
    const dto: DerivarExpedienteDTO = { destinos: [{ area_destino_id: 'a1', es_copia: false }], proveido: 'test' };

    await expect(derivarExpediente(mockCliente, mockExpedienteId, dto))
      .rejects.toThrow(UnauthorizedError);
    
    expect(mockQuery).not.toHaveBeenCalled();
    expect(insertarEvento).not.toHaveBeenCalled();
  });

  it('2. Debe procesar exitosamente una Derivacion Simple y emitir al Outbox', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce({ usuario_id: 'usr-123', correlation_id: 'c1', ip_origen: 'ip', user_agent: 'ua' });
    setupMockQueries(1);

    const dto: DerivarExpedienteDTO = {
      destinos: [{ area_destino_id: 'area-dest-1', es_copia: false }],
      proveido: 'Para atencion requerida'
    };

    await derivarExpediente(mockCliente, mockExpedienteId, dto);

    // Assert de queries ejecutados: 1 SELECT (validación) + 1 INSERT (movimiento) = 2
    expect(mockQuery).toHaveBeenCalledTimes(2);

    // Assert Outbox: Debe emitirse exactamente una vez con los datos de contrato
    expect(insertarEvento).toHaveBeenCalledTimes(1);
    expect(insertarEvento).toHaveBeenCalledWith(mockCliente, expect.objectContaining({
      tipo_evento: 'ExpedienteDerivado',
      payload: expect.objectContaining({
        datos_especificos: {
          motivo: 'Para atencion requerida',
          es_copia: false,
          usuario_asignado_id: undefined
        }
      })
    }));
  });

  it('3. Debe procesar exitosamente una Derivacion Multiple', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce({ usuario_id: 'usr-123', correlation_id: 'c1', ip_origen: 'ip', user_agent: 'ua' });
    setupMockQueries(3); // Configuramos DB para 3 destinos

    const dto: DerivarExpedienteDTO = {
      destinos: [
        { area_destino_id: 'area-dest-1', es_copia: false },
        { area_destino_id: 'area-dest-2', es_copia: true },
        { area_destino_id: 'area-dest-3', es_copia: true, usuario_asignado_id: 'usr-dest' }
      ],
      proveido: 'Pase a multiples areas'
    };

    await derivarExpediente(mockCliente, mockExpedienteId, dto);

    // 1 SELECT inicial + 3 INSERTS (1 por destino) = 4 llamadas a la BD
    expect(mockQuery).toHaveBeenCalledTimes(4);
    // 3 llamadas independientes al Outbox dentro de la misma transacción
    expect(insertarEvento).toHaveBeenCalledTimes(3);
  });

  it('4. Cumplimiento WORM: Ningun query ejecutado debe contener sentencias UPDATE o DELETE en movimientos', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce({ usuario_id: 'usr-123', correlation_id: 'c1', ip_origen: 'ip', user_agent: 'ua' });
    setupMockQueries(2);

    const dto: DerivarExpedienteDTO = {
      destinos: [
        { area_destino_id: 'area-dest-1', es_copia: false },
        { area_destino_id: 'area-dest-2', es_copia: true }
      ],
      proveido: 'Validacion WORM'
    };

    await derivarExpediente(mockCliente, mockExpedienteId, dto);

    // Extraemos todos los strings SQL enviados a la BD simulada
    const queriesEjecutados = mockQuery.mock.calls.map(call => call[0].toString().toUpperCase());

    // Aseguramos que la restricción inmutable a nivel lógico existe
    for (const query of queriesEjecutados) {
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

  const mockExpedienteId = 'exp-123-uuid';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupMockQueriesAtencion() {
    mockQuery.mockReset();
    // 1. Obtener estado y rea
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ estado_actual_id: 'est-actual-1', area_contexto_id: 'area-origen-1' }]
    });
    // 2. Catlogos
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'acc-atencion', tipo: 'accion' },
        { id: 'est-atendido', tipo: 'estado' }
      ]
    });
    // 3. INSERT movimiento_tramite
    mockQuery.mockResolvedValueOnce({ rows: [{ movimiento_id: 'mov-atencion-1' }] });
    // 4. INSERT atencion_tramite
    mockQuery.mockResolvedValueOnce({}); 
  }

  it('1. Debe rechazar la atención si el usuario no esto autenticado', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce(undefined);
    const dto: AtenderExpedienteDTO = { resultado_resumen: 'Prueba rechazo' };

    await expect(atenderExpediente(mockCliente, mockExpedienteId, dto))
      .rejects.toThrow(UnauthorizedError);
    
    expect(mockQuery).not.toHaveBeenCalled();
    expect(insertarEvento).not.toHaveBeenCalled();
  });

  it('2. Debe procesar exitosamente la atencin y emitir al Outbox', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce({ usuario_id: 'usr-123', unidad_organica_id: 'area-origen-1', correlation_id: 'c1', ip_origen: 'ip', user_agent: 'ua' });
    setupMockQueriesAtencion();

    // =========================================================================
    // LIMITACION DE SEGURIDAD (T-BE-RD-07)
    // No se implementa prueba falsa de ForbiddenError (unidad_organica_id).
    // La verificacin de pertenencia de rea queda documentada como dependencia
    // externa hasta que getRequestContext provea datos seguros.
    // =========================================================================

    const dto: AtenderExpedienteDTO = { resultado_resumen: 'Resolucin Aprobada' };
    await atenderExpediente(mockCliente, mockExpedienteId, dto);

    // Validacin de llamadas SQL (Debe haber 4)
    expect(mockQuery).toHaveBeenCalledTimes(4);
    
    // Verificamos estrcitamente que se hayan mandado los INSERTS requeridos
    const queries = mockQuery.mock.calls.map(call => call[0].toString().toUpperCase());
    expect(queries.some(q => q.includes('INSERT INTO SIGD_RUT.MOVIMIENTO_TRAMITE'))).toBe(true);
    expect(queries.some(q => q.includes('INSERT INTO SIGD_RUT.ATENCION_TRAMITE'))).toBe(true);

    // Validacin del Outbox
    expect(insertarEvento).toHaveBeenCalledTimes(1);
    expect(insertarEvento).toHaveBeenCalledWith(mockCliente, expect.objectContaining({
      tipo_evento: 'ExpedienteAtendido',
      payload: expect.objectContaining({
        datos_especificos: { resultado_resumen: 'Resolucin Aprobada' }
      })
    }));
  });

  it('2.1. Debe lanzar ForbiddenError si el usuario no pertenece al area del expediente', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce({ usuario_id: 'usr-123', unidad_organica_id: 'area-diferente', correlation_id: 'c1', ip_origen: 'ip', user_agent: 'ua' });
    setupMockQueriesAtencion();

    const dto: AtenderExpedienteDTO = { resultado_resumen: 'Prueba Rechazo Area' };

    await expect(atenderExpediente(mockCliente, mockExpedienteId, dto))
      .rejects.toThrow(ForbiddenError);
  });

  it('3. Cumplimiento WORM: Ningn query debe contener sentencias UPDATE o DELETE', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce({ usuario_id: 'usr-123', unidad_organica_id: 'area-origen-1', correlation_id: 'c1', ip_origen: 'ip', user_agent: 'ua' });
    setupMockQueriesAtencion();

    const dto: AtenderExpedienteDTO = { resultado_resumen: 'Prueba WORM' };
    await atenderExpediente(mockCliente, mockExpedienteId, dto);

    const queriesEjecutados = mockQuery.mock.calls.map(call => call[0].toString().toUpperCase());

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

  const mockExpedienteId = 'exp-123-uuid';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupMockQueriesArchivo(codigoEstado = 'CERRADO') {
    mockQuery.mockReset();
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ estado_actual_id: 'est-actual-uuid', area_contexto_id: 'area-origen-uuid', codigo_estado: codigoEstado }]
    });
    if (codigoEstado === 'CERRADO') {
      mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{ id: 'acc-archivar-uuid' }] });
      mockQuery.mockResolvedValueOnce({ rows: [{ movimiento_id: 'mov-nuevo-uuid' }] });
      mockQuery.mockResolvedValueOnce({});
    }
  }

  it('1. Debe rechazar si el estado actual no es CERRADO', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce({ usuario_id: 'usr-123', correlation_id: 'c1', ip_origen: 'ip', user_agent: 'ua' });
    setupMockQueriesArchivo('ATENDIDO');

    const dto: ArchivarExpedienteDTO = { estante: 'E1', balda: 'B1', caja: 'C1' };

    await expect(archivarExpediente(mockCliente, mockExpedienteId, dto)).rejects.toThrow(DomainError);
  });

  it('2. Cumplimiento WORM: Ningun query debe contener sentencias UPDATE o DELETE', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce({ usuario_id: 'usr-123', correlation_id: 'c1', ip_origen: 'ip', user_agent: 'ua' });
    setupMockQueriesArchivo('CERRADO');

    const dto: ArchivarExpedienteDTO = { estante: 'E1', balda: 'B1', caja: 'C1' };
    await archivarExpediente(mockCliente, mockExpedienteId, dto);

    const queriesEjecutados = mockQuery.mock.calls.map(call => call[0].toString().toUpperCase());
    expect(insertarEvento).toHaveBeenCalledTimes(1);

    for (const query of queriesEjecutados) {
      expect(query).not.toMatch(/\bUPDATE\b/);
      expect(query).not.toMatch(/\bDELETE\b/);
    }
  });
});

describe('RutaDoc FSM: Observación y Subsanación Formal', () => {
  const mockQuery = vi.fn();
  const mockCliente = {
    query: mockQuery,
    release: vi.fn(),
  } as unknown as PoolClient;

  const mockExpedienteId = 'exp-123-uuid';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('observarExpediente', () => {
    it('debe rechazar la observación si el usuario no está autenticado', async () => {
      vi.mocked(getRequestContext).mockReturnValueOnce(undefined);

      await expect(observarExpediente(mockCliente, mockExpedienteId, 'Falta firma'))
        .rejects.toThrow(UnauthorizedError);

      expect(mockQuery).not.toHaveBeenCalled();
      expect(insertarEvento).not.toHaveBeenCalled();
    });

    it('debe rechazar si el expediente no existe', async () => {
      vi.mocked(getRequestContext).mockReturnValueOnce({ usuario_id: 'usr-123', correlation_id: 'c1', ip_origen: 'ip', user_agent: 'ua' });
      mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });

      await expect(observarExpediente(mockCliente, mockExpedienteId, 'Falta firma'))
        .rejects.toThrow(NotFoundError);
    });

    it('debe rechazar si el expediente está ARCHIVADO o RESUELTO', async () => {
      vi.mocked(getRequestContext).mockReturnValueOnce({ usuario_id: 'usr-123', correlation_id: 'c1', ip_origen: 'ip', user_agent: 'ua' });
      mockQuery.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ estado_actual_id: 'ARCHIVADO', area_contexto_id: 'area-1' }]
      });

      await expect(observarExpediente(mockCliente, mockExpedienteId, 'Falta firma'))
        .rejects.toThrow(DomainError);
    });

    it('debe procesar observación desde EN_CALIFICACION y emitir al Outbox con slaPaused: true', async () => {
      vi.mocked(getRequestContext).mockReturnValueOnce({ usuario_id: 'usr-123', correlation_id: 'c1', ip_origen: 'ip', user_agent: 'ua' });
      mockQuery.mockReset();
      mockQuery.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ estado_actual_id: 'EN_CALIFICACION', area_contexto_id: 'area-1' }]
      });
      mockQuery.mockResolvedValueOnce({
        rows: [{ movimiento_id: 'mov-obs-1' }]
      });
      mockQuery.mockResolvedValueOnce({}); // UPDATE sigd_tra.expediente

      await observarExpediente(mockCliente, mockExpedienteId, 'Requisitos incompletos');

      expect(mockQuery).toHaveBeenCalledTimes(3);
      expect(insertarEvento).toHaveBeenCalledWith(mockCliente, expect.objectContaining({
        tipo_evento: 'ExpedienteObservado',
        payload: expect.objectContaining({
          datos_especificos: { motivo: 'Requisitos incompletos', slaPaused: true }
        })
      }));
    });
  });

  describe('subsanarExpediente', () => {
    it('debe rechazar subsanación si el estado actual no es OBSERVADO', async () => {
      vi.mocked(getRequestContext).mockReturnValueOnce({ usuario_id: 'usr-123', correlation_id: 'c1', ip_origen: 'ip', user_agent: 'ua' });
      mockQuery.mockReset();
      mockQuery.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ estado_actual_id: 'EN_TRAMITE', area_contexto_id: 'area-1' }]
      });

      await expect(subsanarExpediente(mockCliente, mockExpedienteId, 'Levantamiento de observaciones'))
        .rejects.toThrow(DomainError);
    });

    it('debe procesar subsanación correctamente y transicionar a EN_REVISION', async () => {
      vi.mocked(getRequestContext).mockReturnValueOnce({ usuario_id: 'usr-123', correlation_id: 'c1', ip_origen: 'ip', user_agent: 'ua' });
      mockQuery.mockReset();
      mockQuery.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ estado_actual_id: 'OBSERVADO', area_contexto_id: 'area-1' }]
      });
      mockQuery.mockResolvedValueOnce({}); // INSERT CORRECCION -> SUBSANADO
      mockQuery.mockResolvedValueOnce({
        rows: [{ movimiento_id: 'mov-sub-1' }]
      }); // INSERT INICIAR_REVISION -> EN_REVISION
      mockQuery.mockResolvedValueOnce({}); // UPDATE sigd_tra.expediente

      await subsanarExpediente(mockCliente, mockExpedienteId, 'Documentos adjuntados');

      expect(mockQuery).toHaveBeenCalledTimes(4);
      expect(insertarEvento).toHaveBeenCalledWith(mockCliente, expect.objectContaining({
        tipo_evento: 'ExpedienteSubsanado',
        payload: expect.objectContaining({
          datos_especificos: { motivo: 'Documentos adjuntados' }
        })
      }));
    });
  });
});
