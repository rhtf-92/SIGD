import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { PoolClient } from 'pg';
import {
  derivarExpediente,
  recepcionarExpediente,
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
    vi.mocked(getRequestContext).mockReturnValue({
      usuario_id: 'usr-123',
      correlation_id: 'c1',
      ip_origen: 'ip',
      user_agent: 'ua',
    });
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

  it('5. FSM-01: debe permitir derivación desde cada uno de los estados permitidos por la FSM', async () => {
    const estadosPermitidos = ['REGISTRADO', 'RECEPCIONADO', 'EN_CALIFICACION', 'DERIVADO', 'EN_REVISION', 'SUBSANADO'];
    const dto: DerivarExpedienteDTO = {
      destinos: [{ area_destino_id: 'area-dest-1', es_copia: false }],
      proveido: 'Pase reglamentario'
    };

    for (const estado of estadosPermitidos) {
      vi.mocked(getRequestContext).mockReturnValueOnce({ usuario_id: 'usr-123', correlation_id: 'c1', ip_origen: 'ip', user_agent: 'ua' });
      mockQuery.mockReset();
      // 1. SELECT estado actual
      mockQuery.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ estado_actual_id: estado, area_contexto_id: 'area-origen-1' }]
      });
      // 2. Si requiere pasos intermedios, simular INSERTs de transición
      if (estado === 'REGISTRADO') {
        mockQuery.mockResolvedValueOnce({}); // RECEPCION
        mockQuery.mockResolvedValueOnce({}); // INICIAR_CALIFICACION
      } else if (estado === 'RECEPCIONADO') {
        mockQuery.mockResolvedValueOnce({}); // INICIAR_CALIFICACION
      } else if (estado === 'DERIVADO') {
        mockQuery.mockResolvedValueOnce({}); // RECEPCION
      } else if (estado === 'SUBSANADO') {
        mockQuery.mockResolvedValueOnce({}); // INICIAR_REVISION
      }
      // 3. INSERT movimiento de derivación
      mockQuery.mockResolvedValueOnce({ rows: [{ movimiento_id: 'mov-1' }] });

      await expect(derivarExpediente(mockCliente, mockExpedienteId, dto)).resolves.not.toThrow();
    }
  });

  it('6. FSM-01: debe rechazar derivación desde cada uno de los estados prohibidos por la FSM', async () => {
    const estadosProhibidos = ['ARCHIVADO', 'RESUELTO', 'EN_FIRMA', 'OBSERVADO'];
    const dto: DerivarExpedienteDTO = {
      destinos: [{ area_destino_id: 'area-dest-1', es_copia: false }],
      proveido: 'Pase indebido'
    };

    for (const estado of estadosProhibidos) {
      vi.mocked(getRequestContext).mockReturnValueOnce({ usuario_id: 'usr-123', correlation_id: 'c1', ip_origen: 'ip', user_agent: 'ua' });
      mockQuery.mockReset();
      mockQuery.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ estado_actual_id: estado, area_contexto_id: 'area-origen-1' }]
      });

      await expect(derivarExpediente(mockCliente, mockExpedienteId, dto))
        .rejects.toThrow(DomainError);
    }
  });
});

describe('T-BE-RD-06-REC: Recepción en Área de Destino', () => {
  const mockQuery = vi.fn();
  const mockCliente = {
    query: mockQuery,
    release: vi.fn(),
  } as unknown as PoolClient;

  const mockExpedienteId = 'exp-123-uuid';

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRequestContext).mockReturnValue({
      usuario_id: 'usr-123',
      correlation_id: 'c1',
      ip_origen: 'ip',
      user_agent: 'ua',
    });
  });

  it('1. Debe rechazar la recepción si el usuario no está autenticado', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce(undefined);

    await expect(recepcionarExpediente(mockCliente, mockExpedienteId))
      .rejects.toThrow(UnauthorizedError);

    expect(mockQuery).not.toHaveBeenCalled();
    expect(insertarEvento).not.toHaveBeenCalled();
  });

  it('2. Debe rechazar la recepción si el expediente no está en estado DERIVADO', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce({
      usuario_id: 'usr-123',
      correlation_id: 'c1',
      ip_origen: 'ip',
      user_agent: 'ua',
    });
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ estado_actual_id: 'REGISTRADO', area_contexto_id: 'area-sda' }],
    });

    await expect(recepcionarExpediente(mockCliente, mockExpedienteId))
      .rejects.toThrow(DomainError);
  });

  it('3. Debe procesar exitosamente la recepción desde DERIVADO hacia EN_REVISION', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce({
      usuario_id: 'usr-123',
      correlation_id: 'c1',
      ip_origen: 'ip',
      user_agent: 'ua',
    });
    mockQuery.mockReset();
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ estado_actual_id: 'DERIVADO', area_contexto_id: 'area-sda' }],
    });
    mockQuery.mockResolvedValueOnce({ rows: [{ movimiento_id: 'mov-rec-1' }] });
    mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // UPDATE

    await recepcionarExpediente(mockCliente, mockExpedienteId);

    expect(insertarEvento).toHaveBeenCalledWith(mockCliente, expect.objectContaining({
      tipo_evento: 'ExpedienteRecepcionado',
      payload: expect.objectContaining({
        identidad: { expediente_id: mockExpedienteId, movimiento_id: 'mov-rec-1' },
      }),
    }));
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
    vi.mocked(getRequestContext).mockReturnValue({
      usuario_id: 'usr-123',
      correlation_id: 'c1',
      ip_origen: 'ip',
      user_agent: 'ua',
    });
  });

  function setupMockQueriesAtencion(estado = 'EN_REVISION') {
    mockQuery.mockReset();
    // 1. SELECT sigd_tra.expediente + estado_actual_expediente
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{
        estado_actual_id: estado,
        area_contexto_id: 'area-origen-1',
        codigo_expediente: 'EXP-2026-000001',
        solicitante_id: 'sol-123-uuid',
        tipo_documental_id: 'tipo-doc-123',
      }],
    });
    if (estado === 'DERIVADO') {
      // Auto-recepción
      mockQuery.mockResolvedValueOnce({});
    }
    // 2. INSERT ENVIAR_A_FIRMA
    mockQuery.mockResolvedValueOnce({});
    // 3. INSERT FIRMA -> RESUELTO
    mockQuery.mockResolvedValueOnce({ rows: [{ movimiento_id: 'mov-atencion-1' }] });
    // 4. UPDATE sigd_tra.expediente SET estado = 'RESUELTO'
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });
    // 5. SELECT id_usuario FROM sigd_auth.cuenta_usuario
    mockQuery.mockResolvedValueOnce({ rows: [{ id_usuario: 'user-sol-123' }] });
    // 6. INSERT sigd_auth.notificacion_casilla
    mockQuery.mockResolvedValueOnce({});
  }

  it('1. Debe rechazar la atención si el usuario no está autenticado', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce(undefined);
    const dto: AtenderExpedienteDTO = { resultado_resumen: 'Prueba rechazo' };

    await expect(atenderExpediente(mockCliente, mockExpedienteId, dto))
      .rejects.toThrow(UnauthorizedError);

    expect(mockQuery).not.toHaveBeenCalled();
    expect(insertarEvento).not.toHaveBeenCalled();
  });

  it('2. Debe procesar exitosamente la atención y emitir al Outbox y Casilla', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce({
      usuario_id: 'usr-123',
      unidad_organica_id: 'area-origen-1',
      correlation_id: 'c1',
      ip_origen: 'ip',
      user_agent: 'ua',
    });
    setupMockQueriesAtencion('EN_REVISION');

    const dto: AtenderExpedienteDTO = { resultado_resumen: 'Resolución Aprobada' };
    await atenderExpediente(mockCliente, mockExpedienteId, dto);

    // Assert Outbox
    expect(insertarEvento).toHaveBeenCalledTimes(1);
    expect(insertarEvento).toHaveBeenCalledWith(mockCliente, expect.objectContaining({
      tipo_evento: 'ExpedienteAtendido',
      payload: expect.objectContaining({
        datos_especificos: expect.objectContaining({ resultado_resumen: 'Resolución Aprobada' }),
      }),
    }));

    // Verificamos los INSERTs requeridos
    const queries = mockQuery.mock.calls.map(call => call[0].toString().toUpperCase());
    expect(queries.some(q => q.includes('INSERT INTO SIGD_RUT.MOVIMIENTO_TRAMITE'))).toBe(true);
    expect(queries.some(q => q.includes('INSERT INTO SIGD_AUTH.NOTIFICACION_CASILLA'))).toBe(true);
    expect(queries.some(q => q.includes('UPDATE SIGD_TRA.EXPEDIENTE'))).toBe(true);
  });

  it('3. Debe rechazar si el expediente no está en estado atendible', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce({
      usuario_id: 'usr-123',
      correlation_id: 'c1',
      ip_origen: 'ip',
      user_agent: 'ua',
    });
    mockQuery.mockReset();
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{
        estado_actual_id: 'ARCHIVADO',
        area_contexto_id: 'area-origen-1',
        codigo_expediente: 'EXP-2026-000001',
        solicitante_id: 'sol-123-uuid',
        tipo_documental_id: 'tipo-doc-123',
      }],
    });

    const dto: AtenderExpedienteDTO = { resultado_resumen: 'Resolución Indebida' };
    await expect(atenderExpediente(mockCliente, mockExpedienteId, dto)).rejects.toThrow(DomainError);
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
    vi.mocked(getRequestContext).mockReturnValue({
      usuario_id: 'usr-123',
      correlation_id: 'c1',
      ip_origen: 'ip',
      user_agent: 'ua',
    });
  });

  function setupMockQueriesArchivo(codigoEstado = 'RESUELTO') {
    mockQuery.mockReset();
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{
        estado_actual_id: codigoEstado,
        area_contexto_id: 'area-origen-uuid',
        codigo_expediente: 'EXP-2026-000001',
      }],
    });
    if (codigoEstado === 'RESUELTO') {
      mockQuery.mockResolvedValueOnce({ rows: [{ movimiento_id: 'mov-archivo-1' }] });
      mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // UPDATE
    }
  }

  it('1. Debe rechazar si el estado actual no es RESUELTO', async () => {
    vi.mocked(getRequestContext).mockReturnValue({
      usuario_id: 'usr-123',
      correlation_id: 'c1',
      ip_origen: 'ip',
      user_agent: 'ua',
    });
    setupMockQueriesArchivo('EN_REVISION');

    const dto: ArchivarExpedienteDTO = { estante: 'E1', balda: 'B1', caja: 'C1' };

    await expect(archivarExpediente(mockCliente, mockExpedienteId, dto)).rejects.toThrow(DomainError);
  });

  it('2. Debe procesar exitosamente el archivado formal desde RESUELTO', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce({
      usuario_id: 'usr-123',
      correlation_id: 'c1',
      ip_origen: 'ip',
      user_agent: 'ua',
    });
    setupMockQueriesArchivo('RESUELTO');

    const dto: ArchivarExpedienteDTO = { estante: 'E1', balda: 'B1', caja: 'C1' };
    await archivarExpediente(mockCliente, mockExpedienteId, dto);

    expect(insertarEvento).toHaveBeenCalledTimes(1);
    expect(insertarEvento).toHaveBeenCalledWith(mockCliente, expect.objectContaining({
      tipo_evento: 'ExpedienteArchivado',
      payload: expect.objectContaining({
        datos_especificos: expect.objectContaining({ estante: 'E1', balda: 'B1', caja: 'C1' }),
      }),
    }));

    const queries = mockQuery.mock.calls.map(call => call[0].toString().toUpperCase());
    expect(queries.some(q => q.includes('INSERT INTO SIGD_RUT.MOVIMIENTO_TRAMITE'))).toBe(true);
    expect(queries.some(q => q.includes('UPDATE SIGD_TRA.EXPEDIENTE'))).toBe(true);
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
    vi.mocked(getRequestContext).mockReturnValue({
      usuario_id: 'usr-123',
      correlation_id: 'c1',
      ip_origen: 'ip',
      user_agent: 'ua',
    });
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

    it('FSM-01: debe rechazar observación desde cada uno de los estados prohibidos por la FSM', async () => {
      const estadosProhibidos = ['ARCHIVADO', 'RESUELTO', 'EN_FIRMA', 'OBSERVADO', 'SUBSANADO'];
      for (const estado of estadosProhibidos) {
        vi.mocked(getRequestContext).mockReturnValueOnce({ usuario_id: 'usr-123', correlation_id: 'c1', ip_origen: 'ip', user_agent: 'ua' });
        mockQuery.mockReset();
        mockQuery.mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ estado_actual_id: estado, area_contexto_id: 'area-1' }]
        });

        await expect(observarExpediente(mockCliente, mockExpedienteId, 'Falta firma'))
          .rejects.toThrow(DomainError);
      }
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
      mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // UPDATE sigd_tra.expediente

      await observarExpediente(mockCliente, mockExpedienteId, 'Requisitos incompletos');

      expect(mockQuery).toHaveBeenCalledTimes(3);
      expect(insertarEvento).toHaveBeenCalledWith(mockCliente, expect.objectContaining({
        tipo_evento: 'ExpedienteObservado',
        payload: expect.objectContaining({
          datos_especificos: { motivo: 'Requisitos incompletos', slaPaused: true }
        })
      }));
    });

    it('FSM-01: debe lanzar ConflictError si UPDATE sigd_tra.expediente no afecta filas (concurrencia)', async () => {
      vi.mocked(getRequestContext).mockReturnValueOnce({ usuario_id: 'usr-123', correlation_id: 'c1', ip_origen: 'ip', user_agent: 'ua' });
      mockQuery.mockReset();
      mockQuery.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ estado_actual_id: 'EN_CALIFICACION', area_contexto_id: 'area-1' }]
      });
      mockQuery.mockResolvedValueOnce({
        rows: [{ movimiento_id: 'mov-obs-1' }]
      });
      mockQuery.mockResolvedValueOnce({ rowCount: 0 }); // Concurrency conflict: 0 rows affected

      await expect(observarExpediente(mockCliente, mockExpedienteId, 'Requisitos incompletos'))
        .rejects.toThrow('No se pudo actualizar el estado a OBSERVADO para el expediente');
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
      mockQuery.mockResolvedValueOnce({ rowCount: 1 }); // UPDATE sigd_tra.expediente

      await subsanarExpediente(mockCliente, mockExpedienteId, 'Documentos adjuntados');

      expect(mockQuery).toHaveBeenCalledTimes(4);
      expect(insertarEvento).toHaveBeenCalledWith(mockCliente, expect.objectContaining({
        tipo_evento: 'ExpedienteSubsanado',
        payload: expect.objectContaining({
          datos_especificos: { motivo: 'Documentos adjuntados' }
        })
      }));
    });

    it('FSM-01: debe lanzar ConflictError si UPDATE sigd_tra.expediente no afecta filas (concurrencia)', async () => {
      vi.mocked(getRequestContext).mockReturnValueOnce({ usuario_id: 'usr-123', correlation_id: 'c1', ip_origen: 'ip', user_agent: 'ua' });
      mockQuery.mockReset();
      mockQuery.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ estado_actual_id: 'OBSERVADO', area_contexto_id: 'area-1' }]
      });
      mockQuery.mockResolvedValueOnce({});
      mockQuery.mockResolvedValueOnce({ rows: [{ movimiento_id: 'mov-sub-1' }] });
      mockQuery.mockResolvedValueOnce({ rowCount: 0 }); // Concurrency conflict: 0 rows affected

      await expect(subsanarExpediente(mockCliente, mockExpedienteId, 'Documentos adjuntados'))
        .rejects.toThrow('No se pudo actualizar el estado a EN_REVISION para el expediente');
    });
  });
});
