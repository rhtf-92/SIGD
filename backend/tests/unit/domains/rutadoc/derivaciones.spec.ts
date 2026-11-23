import { vi, describe, it, expect, beforeEach } from 'vitest';
// The economic guard has dedicated tests; this suite keeps its ordered FSM fixtures.
vi.mock('../../../../src/domains/tramicore/demoPago.js', () => ({ exigirSinPagoDemoPendiente: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../../../src/domains/tramicore/computoPlazo15Dias.service.js', () => ({ exigirExpedienteHabilitadoParaRecepcion: vi.fn().mockResolvedValue(undefined) }));
import type { PoolClient } from 'pg';
import {
  derivarExpediente,
  atenderExpediente,
  archivarExpediente,
  recepcionarExpediente,
} from '../../../../src/domains/rutadoc/derivaciones.service.js';
import {
  UnauthorizedError,
  NotFoundError,
  ConflictError,
  DomainError,
  ForbiddenError,
} from '../../../../src/shared/domain/errors/index.js';
import type { DerivarExpedienteDTO } from '../../../../src/domains/rutadoc/dto/derivarExpediente.dto.js';
import type { RequestContext } from '../../../../src/shared/request-context/request-context.js';

// Mocks de módulos externos
vi.mock('../../../../src/shared/request-context/request-context.js', () => ({
  getRequestContext: vi.fn(),
}));
import { getRequestContext } from '../../../../src/shared/request-context/request-context.js';

vi.mock('../../../../src/audit/evento-outbox.repository.js', () => ({
  insertarEvento: vi.fn(),
}));
import { insertarEvento } from '../../../../src/audit/evento-outbox.repository.js';

function mockContexto(usuario_id: string | null): RequestContext {
  return {
    usuario_id,
    correlation_id: 'c0000000-0000-4000-8000-000000000001',
    ip_origen: '127.0.0.1',
    user_agent: 'Vitest/Test',
  };
}

describe('T-BE-RD-06: derivaciones.service.ts (Modelo Oficial PostgreSQL 06_sigd_rut.sql)', () => {
  const mockQuery = vi.fn();
  const mockCliente = {
    query: mockQuery,
    release: vi.fn(),
  } as unknown as PoolClient;

  const mockExpedienteId = 'f2600000-0000-4000-8000-000000000001';
  const mockAreaOrigenId = 'a0000000-0000-4000-8000-000000000001';
  const mockAreaDestino1 = 'a0000000-0000-4000-8000-000000000002';
  const mockOperadorNumeric = '990000001';

  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockReset();
  });

  function setupMockDerivacion(opciones: {
    estadoActual?: string;
    areaOrigen?: string;
    columnaTipo?: 'bigint' | 'uuid';
    areaVigente?: boolean;
    areaExiste?: boolean;
  } = {}) {
    const {
      estadoActual = 'EN_CALIFICACION',
      areaOrigen = mockAreaOrigenId,
      columnaTipo = 'bigint',
      areaVigente = true,
      areaExiste = true,
    } = opciones;

    // 1. SELECT expediente y estado actual
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          expediente_id: mockExpedienteId,
          codigo_expediente: 'EXP-2026-000001',
          estado_actual: estadoActual,
          area_actual_id: areaOrigen,
          secuencia: '2',
        },
      ],
    });

    // 2. SELECT sigd_org.area (validar área de destino)
    if (!areaExiste) {
      mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] });
      return;
    }

    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          area_id: mockAreaDestino1,
          vigente: areaVigente,
          nombre: 'Secretaría Académica',
        },
      ],
    });

    if (!areaVigente) return;

    // 3. SELECT data_type de usuario_operador_id
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ data_type: columnaTipo }],
    });

    // 4. INSERT INTO sigd_rut.movimiento_tramite
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id_movimiento: 'm2600000-0000-4000-8000-000000000001', secuencia: '3' }],
    });
  }

  it('1. Debe rechazar la derivación si no hay usuario autenticado en el contexto', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce(undefined);
    const dto: DerivarExpedienteDTO = {
      destinos: [{ area_destino_id: mockAreaDestino1, es_copia: false }],
      proveido: 'Pase a calificación',
    };

    await expect(derivarExpediente(mockCliente, mockExpedienteId, dto))
      .rejects.toThrow(UnauthorizedError);

    expect(mockQuery).not.toHaveBeenCalled();
    expect(insertarEvento).not.toHaveBeenCalled();
  });

  it('2. Debe rechazar derivación si el expediente está en estado no derivable (ej. ARCHIVADO)', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce(mockContexto(mockOperadorNumeric));
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          expediente_id: mockExpedienteId,
          codigo_expediente: 'EXP-2026-000001',
          estado_actual: 'ARCHIVADO',
          area_actual_id: mockAreaOrigenId,
          secuencia: '1',
        },
      ],
    });

    const dto: DerivarExpedienteDTO = {
      destinos: [{ area_destino_id: mockAreaDestino1, es_copia: false }],
      proveido: 'Pase inválido',
    };

    await expect(derivarExpediente(mockCliente, mockExpedienteId, dto))
      .rejects.toThrow(ConflictError);
  });

  it('3. Debe rechazar derivación si el área de destino no existe en sigd_org.area', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce(mockContexto(mockOperadorNumeric));
    setupMockDerivacion({ areaExiste: false });

    const dto: DerivarExpedienteDTO = {
      destinos: [{ area_destino_id: mockAreaDestino1, es_copia: false }],
      proveido: 'Destino inexistente',
    };

    await expect(derivarExpediente(mockCliente, mockExpedienteId, dto))
      .rejects.toThrow(NotFoundError);
  });

  it('4. Debe rechazar derivación si el área de destino está inactiva', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce(mockContexto(mockOperadorNumeric));
    setupMockDerivacion({ areaVigente: false });

    const dto: DerivarExpedienteDTO = {
      destinos: [{ area_destino_id: mockAreaDestino1, es_copia: false }],
      proveido: 'Destino inactivo',
    };

    await expect(derivarExpediente(mockCliente, mockExpedienteId, dto))
      .rejects.toThrow(DomainError);
  });

  it('5. Debe rechazar derivación si el área de destino es idéntica al área de origen', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce(mockContexto(mockOperadorNumeric));

    // Expediente y área destino con el mismo ID
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          expediente_id: mockExpedienteId,
          codigo_expediente: 'EXP-2026-000001',
          estado_actual: 'EN_CALIFICACION',
          area_actual_id: mockAreaOrigenId,
          secuencia: '2',
        },
      ],
    });
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ area_id: mockAreaOrigenId, vigente: true, nombre: 'Mesa de Partes' }],
    });

    const dto: DerivarExpedienteDTO = {
      destinos: [{ area_destino_id: mockAreaOrigenId, es_copia: false }],
      proveido: 'Misma área',
    };

    await expect(derivarExpediente(mockCliente, mockExpedienteId, dto))
      .rejects.toThrow(ConflictError);
  });

  it('6. Debe señalar incompatibilidad de identidad cuando usuario es UUID y la columna física es BIGINT', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce(
      mockContexto('b095f590-482d-45db-b271-e7377dc76717'), // UUID legítimo de sesión JWT
    );
    setupMockDerivacion({ columnaTipo: 'bigint' });

    const dto: DerivarExpedienteDTO = {
      destinos: [{ area_destino_id: mockAreaDestino1, es_copia: false }],
      proveido: 'Pase formal',
    };

    await expect(derivarExpediente(mockCliente, mockExpedienteId, dto))
      .rejects.toThrow(DomainError);
  });

  it('7. Resuelve operador numérico mediante sigd_auth.operador_identidad cuando la sesión es UUID', async () => {
    const usuarioUuid = 'b095f590-482d-45db-b271-e7377dc76717';
    vi.mocked(getRequestContext).mockReturnValueOnce(mockContexto(usuarioUuid));

    // 1. SELECT expediente
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          expediente_id: mockExpedienteId,
          codigo_expediente: 'EXP-2026-000001',
          estado_actual: 'EN_CALIFICACION',
          area_actual_id: mockAreaOrigenId,
          secuencia: '2',
        },
      ],
    });
    // 2. SELECT sigd_org.area
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ area_id: mockAreaDestino1, vigente: true, nombre: 'Secretaría Académica' }],
    });
    // 3. SELECT data_type de usuario_operador_id
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ data_type: 'bigint' }],
    });
    // 4. SELECT operador_identidad (correspondencia institucional UUID -> BIGINT)
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ operador_id: '990000001' }],
    });
    // 5. INSERT movimiento_tramite
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id_movimiento: 'm2600000-0000-4000-8000-000000000001', secuencia: '3' }],
    });

    const dto: DerivarExpedienteDTO = {
      destinos: [{ area_destino_id: mockAreaDestino1, es_copia: false }],
      proveido: 'Pase con resolución de operador',
    };

    const resultado = await derivarExpediente(mockCliente, mockExpedienteId, dto);
    expect(resultado.nuevoEstado).toBe('DERIVADO');
    expect(resultado.derivacionId).toBe('m2600000-0000-4000-8000-000000000001');

    // Comprobar que en el INSERT de movimiento_tramite se envió el BIGINT resuelto
    const insertCall = mockQuery.mock.calls.find((call) =>
      typeof call[0] === 'string' && call[0].includes('INSERT INTO sigd_rut.movimiento_tramite'),
    );
    expect(insertCall).toBeDefined();
    expect(insertCall?.[1]?.[2]).toBe(990000001n);
  });

  it('8. Procesa exitosamente la derivación cuando la identidad es compatible y emite al Outbox', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce(mockContexto(mockOperadorNumeric));
    setupMockDerivacion();

    const dto: DerivarExpedienteDTO = {
      destinos: [{ area_destino_id: mockAreaDestino1, es_copia: false }],
      proveido: 'Pase a Secretaría Académica para revisión.',
    };

    const resultado = await derivarExpediente(mockCliente, mockExpedienteId, dto);

    expect(resultado.nuevoEstado).toBe('DERIVADO');
    expect(resultado.derivacionId).toBe('m2600000-0000-4000-8000-000000000001');

    // Comprobar emisión Outbox con atomicidad
    expect(insertarEvento).toHaveBeenCalledTimes(1);
    expect(insertarEvento).toHaveBeenCalledWith(mockCliente, expect.objectContaining({
      tipo_evento: 'ExpedienteDerivado',
      payload: expect.objectContaining({
        datos_especificos: expect.objectContaining({
          motivo: 'Pase a Secretaría Académica para revisión.',
          es_copia: false,
        }),
      }),
    }));
  });

  it('9. Cumplimiento WORM: Ningún query debe contener sentencias UPDATE o DELETE sobre historial', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce(mockContexto(mockOperadorNumeric));
    setupMockDerivacion();

    const dto: DerivarExpedienteDTO = {
      destinos: [{ area_destino_id: mockAreaDestino1, es_copia: false }],
      proveido: 'Auditoría WORM',
    };

    await derivarExpediente(mockCliente, mockExpedienteId, dto);

    const queries = mockQuery.mock.calls.map((call) => call[0].toString().toUpperCase());
    for (const query of queries) {
      expect(query).not.toMatch(/\bDELETE\b/);
      expect(query).not.toMatch(/UPDATE\s+SIGD_RUT\.MOVIMIENTO_TRAMITE/);
    }
  });

  it('10. Rechaza la derivación si la identidad no es ni numérico legacy ni UUID legítimo', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce(mockContexto('operador-invalido-123'));
    setupMockDerivacion({ columnaTipo: 'bigint' });

    const dto: DerivarExpedienteDTO = {
      destinos: [{ area_destino_id: mockAreaDestino1, es_copia: false }],
      proveido: 'Pase con identidad manipulada',
    };

    await expect(derivarExpediente(mockCliente, mockExpedienteId, dto))
      .rejects.toThrow(UnauthorizedError);
  });

  it('11. atenderExpediente: rechaza si el usuario pertenece a otra área distinta a la del expediente', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce({
      ...mockContexto(mockOperadorNumeric),
      unidad_organica_id: 'a0000000-0000-4000-8000-000000000099', // Área diferente
    });

    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{
        expediente_id: mockExpedienteId,
        estado_actual: 'DERIVADO',
        area_actual_id: mockAreaDestino1,
      }],
    });

    await expect(atenderExpediente(mockCliente, mockExpedienteId, { resultado_resumen: 'Resolución emitida' }))
      .rejects.toThrow(ForbiddenError);
  });

  it('12. atenderExpediente: rechaza por incompatibilidad de identidad cuando usuario es UUID y no existe mapeo', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce(mockContexto('b095f590-482d-45db-b271-e7377dc76717'));

    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{
        expediente_id: mockExpedienteId,
        estado_actual: 'DERIVADO',
        area_actual_id: mockAreaDestino1,
      }],
    });
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ data_type: 'bigint' }],
    });
    mockQuery.mockResolvedValueOnce({
      rowCount: 0,
      rows: [],
    });

    await expect(atenderExpediente(mockCliente, mockExpedienteId, { resultado_resumen: 'Resolución emitida' }))
      .rejects.toThrow(DomainError);
  });

  it('12b. atenderExpediente: en EN_REVISION envía a despacho de firma (EN_FIRMA) si existe resolución y PDF firmable', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce(mockContexto(mockOperadorNumeric));

    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{
        expediente_id: mockExpedienteId,
        estado_actual: 'EN_REVISION',
        area_actual_id: mockAreaDestino1,
      }],
    });
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ data_type: 'bigint' }],
    });
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{
        resolucion_id: 'r-12345',
        numero_borrador: 'RD-2026-000001',
        estado: 'BORRADOR_PENDIENTE_FIRMA',
        tiene_adjunto_pdf: true,
      }],
    });
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id_movimiento: 'm-env-firma-1' }],
    });
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id_evento: 'e-outbox-1' }],
    });

    await atenderExpediente(mockCliente, mockExpedienteId, { resultado_resumen: 'Aprobado pase a firma' });

    const callMovimiento = mockQuery.mock.calls.find(([sql]) => typeof sql === 'string' && sql.includes('sigd_rut.movimiento_tramite'));
    expect(callMovimiento).toBeDefined();
    expect(callMovimiento![1][1]).toBe('EN_REVISION');
    expect(callMovimiento![0]).toContain("'ENVIAR_A_FIRMA'");
    expect(callMovimiento![0]).toContain("'EN_FIRMA'");

    const callResuelto = mockQuery.mock.calls.find(([sql]) => typeof sql === 'string' && sql.includes("'RESUELTO'"));
    expect(callResuelto).toBeUndefined();
    const callUpdateExp = mockQuery.mock.calls.find(([sql]) => typeof sql === 'string' && sql.includes('UPDATE sigd_tra.expediente'));
    expect(callUpdateExp).toBeDefined();
    expect(callUpdateExp![0]).toContain("estado = 'EN_FIRMA'");
  });

  it('12b_1. atenderExpediente: en EN_REVISION rechaza si no existe borrador de resolución (ConflictError)', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce(mockContexto(mockOperadorNumeric));

    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{
        expediente_id: mockExpedienteId,
        estado_actual: 'EN_REVISION',
        area_actual_id: mockAreaDestino1,
      }],
    });
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ data_type: 'bigint' }],
    });
    mockQuery.mockResolvedValueOnce({
      rowCount: 0,
      rows: [],
    });

    await expect(
      atenderExpediente(mockCliente, mockExpedienteId, { resultado_resumen: 'Aprobado pase a firma' }),
    ).rejects.toThrow(ConflictError);
  });

  it('12b_2. atenderExpediente: en EN_REVISION rechaza si resolución no cuenta con PDF firmable (ConflictError)', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce(mockContexto(mockOperadorNumeric));

    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{
        expediente_id: mockExpedienteId,
        estado_actual: 'EN_REVISION',
        area_actual_id: mockAreaDestino1,
      }],
    });
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ data_type: 'bigint' }],
    });
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{
        resolucion_id: 'r-12345',
        numero_borrador: 'RD-2026-000001',
        estado: 'BORRADOR_PENDIENTE_FIRMA',
        tiene_adjunto_pdf: false,
      }],
    });

    await expect(
      atenderExpediente(mockCliente, mockExpedienteId, { resultado_resumen: 'Aprobado pase a firma' }),
    ).rejects.toThrow(ConflictError);
  });

  it('12b_3. atenderExpediente: en ATENDIDO envía a despacho de firma (EN_FIRMA) registrando estado anterior ATENDIDO y sincronizando expediente', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce(mockContexto(mockOperadorNumeric));

    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{
        expediente_id: mockExpedienteId,
        estado_actual: 'ATENDIDO',
        area_actual_id: mockAreaDestino1,
      }],
    });
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ data_type: 'bigint' }],
    });
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{
        resolucion_id: 'r-12345',
        numero_borrador: 'RD-2026-000001',
        estado: 'BORRADOR_PENDIENTE_FIRMA',
        tiene_adjunto_pdf: true,
      }],
    });
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id_movimiento: 'm-env-firma-atendido-1' }],
    });
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [],
    });

    await atenderExpediente(mockCliente, mockExpedienteId, { resultado_resumen: 'Aprobado pase a firma desde dictamen concluido' });

    const callMovimiento = mockQuery.mock.calls.find(([sql, params]) => typeof sql === 'string' && sql.includes('sigd_rut.movimiento_tramite') && params && params[1] === 'ATENDIDO');
    expect(callMovimiento).toBeDefined();
    expect(callMovimiento![1][1]).toBe('ATENDIDO');
    expect(callMovimiento![0]).toContain("'ENVIAR_A_FIRMA'");
    expect(callMovimiento![0]).toContain("'EN_FIRMA'");

    const callUpdateExp = mockQuery.mock.calls.find(([sql]) => typeof sql === 'string' && sql.includes('UPDATE sigd_tra.expediente') && sql.includes("estado = 'EN_FIRMA'"));
    expect(callUpdateExp).toBeDefined();

    expect(insertarEvento).toHaveBeenCalledWith(
      mockCliente,
      expect.objectContaining({
        agregado: 'Expediente',
        tipo_evento: 'ExpedienteEnviadoAFirma',
        payload: expect.objectContaining({
          datos_especificos: expect.objectContaining({
            resolucion_id: 'r-12345',
            numero_borrador: 'RD-2026-000001',
          }),
        }),
      }),
    );
  });

  it('12b_4. atenderExpediente: propaga error y no confirma si falla la actualización del expediente', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce(mockContexto(mockOperadorNumeric));

    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{
        expediente_id: mockExpedienteId,
        estado_actual: 'ATENDIDO',
        area_actual_id: mockAreaDestino1,
      }],
    });
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ data_type: 'bigint' }],
    });
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{
        resolucion_id: 'r-12345',
        numero_borrador: 'RD-2026-000001',
        estado: 'BORRADOR_PENDIENTE_FIRMA',
        tiene_adjunto_pdf: true,
      }],
    });
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id_movimiento: 'm-env-firma-fallo-1' }],
    });
    mockQuery.mockRejectedValueOnce(new Error('Fallo de conexión o bloqueo concurrente'));

    await expect(
      atenderExpediente(mockCliente, mockExpedienteId, { resultado_resumen: 'Aprobado pase a firma' }),
    ).rejects.toThrow('Fallo de conexión o bloqueo concurrente');
  });

  it('12b_5. atenderExpediente: genera clave de idempotencia única con prefijo ENV-FIRMA', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce(mockContexto(mockOperadorNumeric));

    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{
        expediente_id: mockExpedienteId,
        estado_actual: 'ATENDIDO',
        area_actual_id: mockAreaDestino1,
      }],
    });
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ data_type: 'bigint' }],
    });
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{
        resolucion_id: 'r-12345',
        numero_borrador: 'RD-2026-000001',
        estado: 'BORRADOR_PENDIENTE_FIRMA',
        tiene_adjunto_pdf: true,
      }],
    });
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id_movimiento: 'm-idemp-1' }],
    });
    mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [] });

    await atenderExpediente(mockCliente, mockExpedienteId, { resultado_resumen: 'Pase a firma' });

    const callMov = mockQuery.mock.calls.find(([sql]) => typeof sql === 'string' && sql.includes('sigd_rut.movimiento_tramite'));
    expect(callMov).toBeDefined();
    expect(callMov![1][4]).toMatch(/^ENV-FIRMA-/);
  });

  it('12c. atenderExpediente: en EN_FIRMA rechaza si no existe firma digital verificada (ConflictError)', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce(mockContexto(mockOperadorNumeric));

    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{
        expediente_id: mockExpedienteId,
        estado_actual: 'EN_FIRMA',
        area_actual_id: mockAreaDestino1,
      }],
    });
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ data_type: 'bigint' }],
    });
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ tiene_firma: false }],
    });

    await expect(atenderExpediente(mockCliente, mockExpedienteId, { resultado_resumen: 'Intento de resolver sin firma' }))
      .rejects.toThrow(ConflictError);
  });

  it('12d. atenderExpediente: en EN_FIRMA transiciona a RESUELTO si cuenta con firma digital verificada', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce(mockContexto(mockOperadorNumeric));

    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{
        expediente_id: mockExpedienteId,
        estado_actual: 'EN_FIRMA',
        area_actual_id: mockAreaDestino1,
      }],
    });
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ data_type: 'bigint' }],
    });
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ tiene_firma: true }],
    });
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id_movimiento: 'm-firma-resuelto-1' }],
    });
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id_evento: 'e-outbox-resuelto-1' }],
    });

    await atenderExpediente(mockCliente, mockExpedienteId, { resultado_resumen: 'Resolución suscrita' });

    const callResuelto = mockQuery.mock.calls.find(([sql]) => typeof sql === 'string' && sql.includes("'RESUELTO'"));
    expect(callResuelto).toBeDefined();
    expect(callResuelto![0]).toContain("'EN_FIRMA'");
    expect(callResuelto![0]).toContain("'FIRMA'");
    expect(callResuelto![0]).toContain("'RESUELTO'");
  });

  it('13. archivarExpediente: rechaza si el estado del expediente no es RESUELTO conforme a la FSM', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce(mockContexto(mockOperadorNumeric));
    mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{ expediente_id: mockExpedienteId }] });

    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{
        expediente_id: mockExpedienteId,
        estado_actual: 'EN_TRAMITE', // Estado inválido para archivar
        area_actual_id: mockAreaDestino1,
      }],
    });

    await expect(archivarExpediente(mockCliente, mockExpedienteId, { estante: 'E1', balda: 'B1', caja: 'C1' }))
      .rejects.toThrow(DomainError);
  });

  it('14. archivarExpediente: rechaza por incompatibilidad de identidad cuando usuario es UUID y no existe mapeo', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce(mockContexto('b095f590-482d-45db-b271-e7377dc76717'));
    mockQuery.mockResolvedValueOnce({ rowCount: 1, rows: [{ expediente_id: mockExpedienteId }] });

    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{
        expediente_id: mockExpedienteId,
        estado_actual: 'RESUELTO',
        area_actual_id: mockAreaDestino1,
      }],
    });
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ data_type: 'bigint' }],
    });
    mockQuery.mockResolvedValueOnce({
      rowCount: 0,
      rows: [],
    });

    await expect(archivarExpediente(mockCliente, mockExpedienteId, { estante: 'E1', balda: 'B1', caja: 'C1' }))
      .rejects.toThrow(DomainError);
  });

  it.each([['DERIVADO', 'EN_REVISION'], ['REGISTRADO', 'RECEPCIONADO']])('15. recepcionarExpediente: recepción válida transiciona de DERIVADO a EN_REVISION, inserta movimiento y emite Outbox', async (origen, esperado) => {
    vi.mocked(getRequestContext).mockReturnValueOnce({
      ...mockContexto(mockOperadorNumeric),
      unidad_organica_id: mockAreaDestino1,
    });

    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{
        expediente_id: mockExpedienteId,
        codigo_expediente: 'EXP-2026-000011',
        estado_actual: origen,
        area_actual_id: mockAreaDestino1,
        secuencia: '2',
      }],
    });
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ data_type: 'bigint' }],
    });
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{
        id_movimiento: 'm-recep-0001',
        secuencia: '3',
      }],
    });

    const resultado = await recepcionarExpediente(mockCliente, mockExpedienteId, {
      observaciones: 'Recepción formal en Secretaría Académica',
    });

    expect(resultado).toEqual({
      movimientoId: 'm-recep-0001',
      nuevoEstado: esperado,
      secuencia: '3',
    });

    expect(insertarEvento).toHaveBeenCalledWith(mockCliente, expect.objectContaining({
      agregado: 'Expediente',
      tipo_evento: 'ExpedienteRecepcionado',
      payload: expect.objectContaining({
        identidad: expect.objectContaining({
          expediente_id: mockExpedienteId,
          movimiento_id: 'm-recep-0001',
          cut: 'EXP-2026-000011',
        }),
        contexto: expect.objectContaining({
          usuario_actor_id: mockOperadorNumeric,
          area_id: mockAreaDestino1,
        }),
      }),
    }));
  });

  it('16. recepcionarExpediente: rechaza si no existe usuario en el contexto institucional (UnauthorizedError)', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce(mockContexto(null));

    await expect(recepcionarExpediente(mockCliente, mockExpedienteId))
      .rejects.toThrow(UnauthorizedError);
  });

  it('17. recepcionarExpediente: rechaza si el expediente no existe (NotFoundError)', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce(mockContexto(mockOperadorNumeric));

    mockQuery.mockResolvedValueOnce({
      rowCount: 0,
      rows: [],
    });

    await expect(recepcionarExpediente(mockCliente, mockExpedienteId))
      .rejects.toThrow(NotFoundError);
  });

  it('18. recepcionarExpediente: rechaza si el operador pertenece a otra unidad orgánica (ForbiddenError)', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce({
      ...mockContexto(mockOperadorNumeric),
      unidad_organica_id: 'otra-area-uuid',
    });

    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{
        expediente_id: mockExpedienteId,
        codigo_expediente: 'EXP-2026-000011',
        estado_actual: 'DERIVADO',
        area_actual_id: mockAreaDestino1,
        secuencia: '2',
      }],
    });

    await expect(recepcionarExpediente(mockCliente, mockExpedienteId))
      .rejects.toThrow(ForbiddenError);
  });

  it('19. recepcionarExpediente: rechaza si el expediente está en estado incompatible (ConflictError)', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce(mockContexto(mockOperadorNumeric));

    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{
        expediente_id: mockExpedienteId,
        codigo_expediente: 'EXP-2026-000011',
        estado_actual: 'EN_CALIFICACION',
        area_actual_id: mockAreaDestino1,
        secuencia: '1',
      }],
    });

    await expect(recepcionarExpediente(mockCliente, mockExpedienteId))
      .rejects.toThrow(ConflictError);
  });

  it('20. recepcionarExpediente: rechaza recepción duplicada si ya se encuentra en EN_REVISION (ConflictError)', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce(mockContexto(mockOperadorNumeric));

    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{
        expediente_id: mockExpedienteId,
        codigo_expediente: 'EXP-2026-000011',
        estado_actual: 'EN_REVISION',
        area_actual_id: mockAreaDestino1,
        secuencia: '3',
      }],
    });

    await expect(recepcionarExpediente(mockCliente, mockExpedienteId))
      .rejects.toThrow(ConflictError);
  });

  it('21. recepcionarExpediente: resuelve operador numérico mapeado desde tabla de identidad', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce({
      ...mockContexto('00000000-0000-0000-0000-000000000030'),
      unidad_organica_id: mockAreaDestino1,
    });

    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{
        expediente_id: mockExpedienteId,
        codigo_expediente: 'EXP-2026-000011',
        estado_actual: 'DERIVADO',
        area_actual_id: mockAreaDestino1,
        secuencia: '2',
      }],
    });
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ data_type: 'bigint' }],
    });
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ operador_id: '990000003' }],
    });
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{
        id_movimiento: 'm-recep-0002',
        secuencia: '3',
      }],
    });

    const resultado = await recepcionarExpediente(mockCliente, mockExpedienteId);
    expect(resultado.movimientoId).toBe('m-recep-0002');
    expect(resultado.nuevoEstado).toBe('EN_REVISION');
  });

  it('22. derivarExpediente desde REGISTRADO: encadena atómicamente RECEPCION -> INICIAR_CALIFICACION -> DERIVACION', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce(mockContexto(mockOperadorNumeric));

    // 1. SELECT expediente (REGISTRADO)
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          expediente_id: mockExpedienteId,
          codigo_expediente: 'EXP-2026-000001',
          estado_actual: 'REGISTRADO',
          area_actual_id: mockAreaOrigenId,
          secuencia: null,
        },
      ],
    });
    // 2. SELECT sigd_org.area
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ area_id: mockAreaDestino1, vigente: true, nombre: 'Secretaría Académica' }],
    });
    // 3. SELECT data_type de usuario_operador_id
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ data_type: 'bigint' }],
    });
    // 4. INSERT movimiento 1: RECEPCION
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id_movimiento: 'm-rec-1', secuencia: '1' }],
    });
    // 5. INSERT movimiento 2: INICIAR_CALIFICACION
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id_movimiento: 'm-cal-2', secuencia: '2' }],
    });
    // 6. INSERT movimiento 3: DERIVACION
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id_movimiento: 'm-der-3', secuencia: '3' }],
    });

    const dto: DerivarExpedienteDTO = {
      destinos: [{ area_destino_id: mockAreaDestino1, es_copia: false }],
      proveido: 'Pase inaugural a Secretaría Académica para calificación y trámite',
    };

    const resultado = await derivarExpediente(mockCliente, mockExpedienteId, dto);

    expect(resultado.nuevoEstado).toBe('DERIVADO');
    expect(resultado.derivacionId).toBe('m-der-3');

    // Comprobar que se ejecutaron exactamente 3 INSERTs en movimiento_tramite
    const insertCalls = mockQuery.mock.calls.filter((call) =>
      typeof call[0] === 'string' && call[0].includes('INSERT INTO sigd_rut.movimiento_tramite'),
    );
    expect(insertCalls).toHaveLength(3);

    // Movimiento 1: REGISTRADO + RECEPCION -> RECEPCIONADO
    expect(insertCalls[0][0]).toContain("'REGISTRADO'");
    expect(insertCalls[0][1][1]).toBe(990000001n);
    expect(insertCalls[0][0]).toContain("'RECEPCION'");
    expect(insertCalls[0][0]).toContain("'RECEPCIONADO'");

    // Movimiento 2: RECEPCIONADO + INICIAR_CALIFICACION -> EN_CALIFICACION
    expect(insertCalls[1][0]).toContain("'RECEPCIONADO'");
    expect(insertCalls[1][0]).toContain("'INICIAR_CALIFICACION'");
    expect(insertCalls[1][0]).toContain("'EN_CALIFICACION'");

    // Movimiento 3: EN_CALIFICACION + DERIVACION -> DERIVADO
    expect(insertCalls[2][1][1]).toBe('EN_CALIFICACION');
    expect(insertCalls[2][0]).toContain("'DERIVACION'");
    expect(insertCalls[2][0]).toContain("'DERIVADO'");
    expect(insertCalls[2][1][5]).toContain(mockAreaDestino1);

    // Comprobar eventos outbox
    expect(insertarEvento).toHaveBeenCalledWith(mockCliente, expect.objectContaining({
      tipo_evento: 'ExpedienteRecepcionado',
      payload: expect.objectContaining({
        identidad: expect.objectContaining({ cut: 'EXP-2026-000001' }),
      }),
    }));
    expect(insertarEvento).toHaveBeenCalledWith(mockCliente, expect.objectContaining({
      tipo_evento: 'ExpedienteDerivado',
      payload: expect.objectContaining({
        contexto: expect.objectContaining({
          area_destino_id: mockAreaDestino1,
        }),
      }),
    }));
  });

  it('23. derivarExpediente desde REGISTRADO: propaga error ante fallo intermedio para permitir rollback', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce(mockContexto(mockOperadorNumeric));

    // 1. SELECT expediente (REGISTRADO)
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          expediente_id: mockExpedienteId,
          codigo_expediente: 'EXP-2026-000001',
          estado_actual: 'REGISTRADO',
          area_actual_id: mockAreaOrigenId,
          secuencia: null,
        },
      ],
    });
    // 2. SELECT sigd_org.area
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ area_id: mockAreaDestino1, vigente: true, nombre: 'Secretaría Académica' }],
    });
    // 3. SELECT data_type de usuario_operador_id
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ data_type: 'bigint' }],
    });
    // 4. INSERT movimiento 1: RECEPCION (exitoso)
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id_movimiento: 'm-rec-1', secuencia: '1' }],
    });
    // 5. INSERT movimiento 2: INICIAR_CALIFICACION (falla simulada en BD)
    mockQuery.mockRejectedValueOnce(new Error('Fallo simulado en calificación de BD'));

    const dto: DerivarExpedienteDTO = {
      destinos: [{ area_destino_id: mockAreaDestino1, es_copia: false }],
      proveido: 'Pase que fallará',
    };

    await expect(derivarExpediente(mockCliente, mockExpedienteId, dto))
      .rejects.toThrow('Fallo simulado en calificación de BD');

    // Movimiento 3 no debe haberse ejecutado
    const insertCalls = mockQuery.mock.calls.filter((call) =>
      typeof call[0] === 'string' && call[0].includes('INSERT INTO sigd_rut.movimiento_tramite'),
    );
    expect(insertCalls).toHaveLength(2);
  });

  it('24. derivarExpediente desde RECEPCIONADO: genera exactamente 2 movimientos (INICIAR_CALIFICACION y DERIVACION)', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce(mockContexto(mockOperadorNumeric));

    // 1. SELECT expediente (RECEPCIONADO)
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          expediente_id: mockExpedienteId,
          codigo_expediente: 'EXP-2026-000001',
          estado_actual: 'RECEPCIONADO',
          area_actual_id: mockAreaOrigenId,
          secuencia: '1',
        },
      ],
    });
    // 2. SELECT sigd_org.area
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ area_id: mockAreaDestino1, vigente: true, nombre: 'Secretaría Académica' }],
    });
    // 3. SELECT data_type de usuario_operador_id
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ data_type: 'bigint' }],
    });
    // 4. INSERT movimiento: INICIAR_CALIFICACION
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id_movimiento: 'm-cal-1', secuencia: '2' }],
    });
    // 5. INSERT movimiento: DERIVACION
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id_movimiento: 'm-der-2', secuencia: '3' }],
    });

    const dto: DerivarExpedienteDTO = {
      destinos: [{ area_destino_id: mockAreaDestino1, es_copia: false }],
      proveido: 'Pase desde recepcionado',
    };

    const resultado = await derivarExpediente(mockCliente, mockExpedienteId, dto);

    expect(resultado.nuevoEstado).toBe('DERIVADO');
    const insertCalls = mockQuery.mock.calls.filter((call) =>
      typeof call[0] === 'string' && call[0].includes('INSERT INTO sigd_rut.movimiento_tramite'),
    );
    expect(insertCalls).toHaveLength(2);
    expect(insertCalls[0][0]).toContain("'INICIAR_CALIFICACION'");
    expect(insertCalls[1][0]).toContain("'DERIVACION'");
  });

  it('25. derivarExpediente desde EN_REVISION: genera exactamente 1 movimiento directo (DERIVACION)', async () => {
    vi.mocked(getRequestContext).mockReturnValueOnce(mockContexto(mockOperadorNumeric));

    // 1. SELECT expediente (EN_REVISION)
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [
        {
          expediente_id: mockExpedienteId,
          codigo_expediente: 'EXP-2026-000001',
          estado_actual: 'EN_REVISION',
          area_actual_id: mockAreaOrigenId,
          secuencia: '3',
        },
      ],
    });
    // 2. SELECT sigd_org.area
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ area_id: mockAreaDestino1, vigente: true, nombre: 'Secretaría Académica' }],
    });
    // 3. SELECT data_type de usuario_operador_id
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ data_type: 'bigint' }],
    });
    // 4. INSERT movimiento: DERIVACION
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id_movimiento: 'm-der-rev', secuencia: '4' }],
    });

    const dto: DerivarExpedienteDTO = {
      destinos: [{ area_destino_id: mockAreaDestino1, es_copia: false }],
      proveido: 'Segunda derivación desde revisión',
    };

    const resultado = await derivarExpediente(mockCliente, mockExpedienteId, dto);

    expect(resultado.nuevoEstado).toBe('DERIVADO');
    const insertCalls = mockQuery.mock.calls.filter((call) =>
      typeof call[0] === 'string' && call[0].includes('INSERT INTO sigd_rut.movimiento_tramite'),
    );
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0][1][1]).toBe('EN_REVISION');
    expect(insertCalls[0][0]).toContain("'DERIVACION'");
  });

});
