import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { PoolClient } from 'pg';
import { derivarExpediente } from '../../../../src/domains/rutadoc/derivaciones.service.js';
import { atenderExpediente } from '../../../../src/domains/rutadoc/derivaciones.service.js';
import { archivarExpediente } from '../../../../src/domains/rutadoc/derivaciones.service.js';
import { UnauthorizedError, ForbiddenError } from '../../../../src/shared/domain/errors/index.js';
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

  // Helper para simular las respuestas de la Base de Datos puramente con SELECTs e INSERTs
  function setupMockQueries(cantidadDestinos = 1) {
    mockQuery.mockReset();
    // Resolucin 1: Obtener estado y Ç­rea actual
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ estado_actual_id: 'est-actual-1', area_contexto_id: 'area-origen-1' }]
    });
    // Resolucin 2: CatÇ­logos
    mockQuery.mockResolvedValueOnce({
      rows: [
        { id: 'acc-derivacion', tipo: 'accion' },
        { id: 'est-pendiente', tipo: 'estado' }
      ]
    });
    // Resoluciones dinÇ­micas para cada destino en el loop
    for (let i = 0; i < cantidadDestinos; i++) {
      mockQuery.mockResolvedValueOnce({ rows: [{ movimiento_id: `mov-nuevo-${i}` }] }); // INSERT movimiento
      mockQuery.mockResolvedValueOnce({}); // INSERT derivacion_tramite
    }
  }

  it('1. Debe rechazar la derivacin si el usuario no estÇ­ autenticado (Validacin Contexto)', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce(undefined);
    const dto: DerivarExpedienteDTO = { destinos: [{ area_destino_id: 'a1', es_copia: false }], proveido: 'test' };

    await expect(derivarExpediente(mockCliente, mockExpedienteId, dto))
      .rejects.toThrow(UnauthorizedError);
    
    expect(mockQuery).not.toHaveBeenCalled();
    expect(insertarEvento).not.toHaveBeenCalled();
  });

  it('2. Debe procesar exitosamente una Derivacin Simple y emitir al Outbox', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce({ usuario_id: 'usr-123', correlation_id: 'c1', ip_origen: 'ip', user_agent: 'ua' });
    setupMockQueries(1);

    const dto: DerivarExpedienteDTO = {
      destinos: [{ area_destino_id: 'area-dest-1', es_copia: false }],
      proveido: 'Para atencin requerida'
    };

    await derivarExpediente(mockCliente, mockExpedienteId, dto);

    // Assert de queries ejecutados: 2 SELECT (validacin) + 2 INSERT (movimiento y derivacin) = 4
    expect(mockQuery).toHaveBeenCalledTimes(4);

    // Assert Outbox: Debe emitirse exactamente una vez con los datos de contrato
    expect(insertarEvento).toHaveBeenCalledTimes(1);
    expect(insertarEvento).toHaveBeenCalledWith(mockCliente, expect.objectContaining({
      tipo_evento: 'ExpedienteDerivado',
      payload: expect.objectContaining({
        datos_especificos: {
          motivo: 'Para atencin requerida',
          es_copia: false,
          usuario_asignado_id: undefined
        }
      })
    }));
  });

  it('3. Debe procesar exitosamente una Derivacin Mltiple', async () => {
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

    // 2 iniciales + (2 INSERTS * 3 destinos) = 8 llamadas a la BD
    expect(mockQuery).toHaveBeenCalledTimes(8);
    // 3 llamadas independientes al Outbox dentro de la misma transaccin
    expect(insertarEvento).toHaveBeenCalledTimes(3);
  });

  it('4. Cumplimiento WORM: Ningn query ejecutado debe contener sentencias UPDATE o DELETE', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce({ usuario_id: 'usr-123', correlation_id: 'c1', ip_origen: 'ip', user_agent: 'ua' });
    setupMockQueries(2);

    const dto: DerivarExpedienteDTO = {
      destinos: [
        { area_destino_id: 'area-dest-1', es_copia: false },
        { area_destino_id: 'area-dest-2', es_copia: true }
      ],
      proveido: 'Validacin WORM'
    };

    await derivarExpediente(mockCliente, mockExpedienteId, dto);

    // Extraemos todos los strings SQL enviados a la BD simulada
    const queriesEjecutados = mockQuery.mock.calls.map(call => call[0].toString().toUpperCase());

    // Aseguramos que la restriccin inmutable a nivel lgico existe
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
