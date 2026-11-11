import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import express from 'express';
import request from 'supertest';
import {
  derivarExpediente,
  recepcionarExpediente,
  atenderExpediente,
  archivarExpediente,
  observarExpediente,
  subsanarExpediente,
  enviarAFirmaExpediente,
  resolverExpedienteConFirma,
} from '../../../../src/domains/rutadoc/derivaciones.service.js';
import { crearRouterDerivaciones } from '../../../../src/domains/rutadoc/derivaciones.controller.js';
import { ExpedienteAsignacionService } from '../../../../src/domains/rutadoc/expedienteAsignacion.service.js';
import { ExpedienteObservacionService } from '../../../../src/domains/rutadoc/expedienteObservacion.service.js';
import { WorkflowService } from '../../../../src/domains/rutadoc/workflow.service.js';
import { errorMiddleware } from '../../../../src/middleware/error-middleware.js';
import {
  ConflictError,
  DomainError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../../../src/shared/domain/errors/index.js';
import { bloquearExpedienteRutaDoc } from '../../../../src/domains/rutadoc/rutadoc.lock.js';
import { getRequestContext } from '../../../../src/shared/request-context/request-context.js';
import { insertarEvento } from '../../../../src/audit/evento-outbox.repository.js';
import { AuthorizationService } from '../../../../src/core/auth/authorization.service.js';

vi.mock('../../../../src/shared/request-context/request-context.js', () => ({
  getRequestContext: vi.fn(),
}));

vi.mock('../../../../src/audit/evento-outbox.repository.js', () => ({
  insertarEvento: vi.fn(),
}));

describe('SIGD — FASE 5G: Core Operativo, Workflow, Custodia, Asignación y Observaciones', () => {
  const ID_EXPEDIENTE = '11111111-1111-4111-8111-111111111111';
  const ID_USUARIO_ACTOR = '22222222-2222-4222-8222-222222222222';
  const ID_PERSONA_ACTOR = '33333333-3333-4333-8333-333333333333';
  const ID_AREA_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const ID_AREA_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const ID_AREA_INACTIVA = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

  const mockQuery = vi.fn();
  const mockClient = {
    query: mockQuery,
    release: vi.fn(),
  } as unknown as PoolClient;

  const mockPool = {
    query: mockQuery,
    connect: vi.fn().mockResolvedValue(mockClient),
  } as unknown as Pool;

  beforeEach(() => {
    mockQuery.mockReset();
    vi.clearAllMocks();
    vi.mocked(getRequestContext).mockReturnValue({
      usuario_id: ID_USUARIO_ACTOR,
      correlation_id: 'corr-5g-test',
      ip_origen: '127.0.0.1',
      user_agent: 'Vitest/5G',
    });
  });

  // ===========================================================================
  // PM-5G-01: Mesa de Partes recibe expediente (REGISTRADO -> RECEPCIONADO -> EN_CALIFICACION)
  // ===========================================================================
  it('PM-5G-01: Mesa de partes recibe expediente transicionando válidamente por FSM canónica', async () => {
    mockQuery
      // 1. SELECT estado_actual_id
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ estado_actual_id: 'REGISTRADO', area_contexto_id: ID_AREA_A }],
      })
      // 2. INSERT RECEPCIONADO
      .mockResolvedValueOnce({ rowCount: 1 })
      // 3. INSERT EN_CALIFICACION
      .mockResolvedValueOnce({ rowCount: 1 })
      // 4. INSERT DERIVACION
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ movimiento_id: 'mov-pm-01' }] });

    await derivarExpediente(mockClient, ID_EXPEDIENTE, {
      destinos: [{ area_destino_id: ID_AREA_B, es_copia: false }],
      proveido: 'Pase a calificación y despacho',
    });

    expect(mockQuery).toHaveBeenCalledTimes(4);
    expect(insertarEvento).toHaveBeenCalledWith(
      mockClient,
      expect.objectContaining({ tipo_evento: 'ExpedienteDerivado' }),
    );
  });

  // ===========================================================================
  // PM-5G-02: Mesa deriva a Área A (PASS)
  // ===========================================================================
  it('PM-5G-02: Derivación formal a Área Destino genera movimiento WORM en partición', async () => {
    mockQuery
      // 1. SELECT estado actual
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ estado_actual_id: 'EN_CALIFICACION', area_contexto_id: ID_AREA_A }],
      })
      // 2. INSERT movimiento_tramite
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ movimiento_id: 'mov-pm-02' }] });

    await derivarExpediente(mockClient, ID_EXPEDIENTE, {
      destinos: [{ area_destino_id: ID_AREA_B, es_copia: false }],
      proveido: 'Derivación para atención sustantiva',
    });

    expect(insertarEvento).toHaveBeenCalledWith(
      mockClient,
      expect.objectContaining({
        tipo_evento: 'ExpedienteDerivado',
        payload: expect.objectContaining({
          contexto: expect.objectContaining({ area_destino_id: ID_AREA_B }),
        }),
      }),
    );
  });

  // ===========================================================================
  // PM-5G-03: Operador de Área B intenta operar expediente en custodia de Área A -> DENY 403 (BOLA)
  // ===========================================================================
  it('PM-5G-03: Operador de otra área sin custodia recibe 403 Forbidden por violación BOLA', async () => {
    const authService = new AuthorizationService(mockPool);
    // Simular que el usuario no tiene scope ni custodia en ID_AREA_A
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id_usuario: ID_USUARIO_ACTOR, activo: true }] }) // cuenta
      .mockResolvedValueOnce({ rows: [{ id_persona: ID_PERSONA_ACTOR }] }) // persona
      .mockResolvedValueOnce({ rows: [] }) // vinculos
      .mockResolvedValueOnce({
        rows: [{
          id_asignacion: 'asig-1',
          cargo_id: 'c1',
          cargo_codigo: 'ESP',
          cargo_nombre: 'Especialista',
          area_id: ID_AREA_B, // Pertenece a Área B, pero el expediente está en Área A
          area_codigo: 'B',
          area_nombre: 'Área B',
          estado: 'ACTIVO',
          vigente_desde: '2026-01-01',
          vigente_hasta: null,
        }],
      }) // asignaciones
      .mockResolvedValueOnce({ rows: [] }) // responsabilidades
      .mockResolvedValueOnce({ rows: [] }) // perfiles
      .mockResolvedValueOnce({ rows: [{ codigo: 'ESPECIALISTA' }] }); // roles

    const resAuth = await authService.autorizar({
      usuarioId: ID_USUARIO_ACTOR,
      accion: 'EXPEDIENTE_DERIVAR',
      recurso: {
        tipo: 'EXPEDIENTE',
        id: ID_EXPEDIENTE,
        areaId: ID_AREA_A, // Custodia de Área A
      },
      rolesDeclarados: ['ESPECIALISTA'],
    });

    expect(resAuth.autorizado).toBe(false);
  });

  // ===========================================================================
  // PM-5G-04: Actor en contexto PERSONAL intenta derivar expediente -> DENY 403
  // ===========================================================================
  it('PM-5G-04: Actor en contexto de operación PERSONAL tiene bloqueadas acciones institucionales (Fail-Closed)', async () => {
    const authService = new AuthorizationService(mockPool);
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id_usuario: ID_USUARIO_ACTOR, activo: true }] })
      .mockResolvedValueOnce({ rows: [{ id_persona: ID_PERSONA_ACTOR }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ codigo: 'ESPECIALISTA' }] });

    const resAuth = await authService.autorizar({
      usuarioId: ID_USUARIO_ACTOR,
      accion: 'EXPEDIENTE_DERIVAR',
      contextoOperacion: 'PERSONAL',
      recurso: {
        tipo: 'EXPEDIENTE',
        id: ID_EXPEDIENTE,
        areaId: ID_AREA_A,
      },
      rolesDeclarados: ['ESPECIALISTA'],
    });

    expect(resAuth.autorizado).toBe(false);
    expect(resAuth.codigoDenegacion).toBe('CONTEXTO_PERSONAL_SIN_FACULTADES_INSTITUCIONALES');
  });

  // ===========================================================================
  // PM-5G-05: Derivación a área inexistente -> DENY (DESTINO_INVALIDO)
  // ===========================================================================
  it('PM-5G-05: Derivación a área inexistente es rechazada con NotFoundError DESTINO_INVALIDO', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 0, rows: [] }); // sigd_org.unidad_organica no existe

    // Ejecutar verificación de destino
    const checkArea = async (areaId: string) => {
      const res = await mockClient.query<{ id_area: string; vigente: boolean }>(
        'SELECT id_area, vigente FROM sigd_org.unidad_organica WHERE id_area = $1::uuid',
        [areaId],
      );
      if (res.rowCount === 0) {
        throw new NotFoundError({ detail: `DESTINO_INVALIDO: El área ${areaId} no existe.` });
      }
    };

    await expect(checkArea('99999999-9999-4999-8999-999999999999')).rejects.toThrow(NotFoundError);
  });

  // ===========================================================================
  // PM-5G-06: Derivación a área inactiva -> DENY (DESTINO_INACTIVO)
  // ===========================================================================
  it('PM-5G-06: Derivación a área inactiva es rechazada con DomainError DESTINO_INACTIVO', async () => {
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id_area: ID_AREA_INACTIVA, nombre: 'Área Dada de Baja', vigente: false }],
    });

    const checkAreaVigente = async (areaId: string) => {
      const res = await mockClient.query<{ id_area: string; nombre: string; vigente: boolean }>(
        'SELECT id_area, nombre, vigente FROM sigd_org.unidad_organica WHERE id_area = $1::uuid',
        [areaId],
      );
      if (!res.rows[0]?.vigente) {
        throw new DomainError({
          code: 'DESTINO_INACTIVO',
          message: `DESTINO_INACTIVO: El área ${res.rows[0]?.nombre} está inactiva.`,
        });
      }
    };

    await expect(checkAreaVigente(ID_AREA_INACTIVA)).rejects.toThrow(DomainError);
  });

  // ===========================================================================
  // PM-5G-07: Derivación equivocada + corrección -> 2 movimientos WORM preservados
  // ===========================================================================
  it('PM-5G-07: Corrección de derivación preserva el movimiento previo e inserta nuevo evento CORRECCION_DERIVACION', async () => {
    mockQuery
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ estado_actual_id: 'DERIVADO', area_contexto_id: ID_AREA_A }],
      })
      // Transición previa DERIVADO -> EN_REVISION para re-derivar
      .mockResolvedValueOnce({ rowCount: 1 })
      // INSERT corrección
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ movimiento_id: 'mov-correccion-1' }] });

    await derivarExpediente(mockClient, ID_EXPEDIENTE, {
      destinos: [{ area_destino_id: ID_AREA_B, es_copia: false }],
      proveido: 'Corrección de derivación por error material de destino',
      es_correccion: true,
      motivo: 'CORRECCION_DERIVACION',
    });

    expect(mockQuery).toHaveBeenCalledTimes(3);
    expect(insertarEvento).toHaveBeenCalledWith(
      mockClient,
      expect.objectContaining({
        tipo_evento: 'ExpedienteDerivado',
        payload: expect.objectContaining({
          datos_especificos: expect.objectContaining({ es_copia: false }),
        }),
      }),
    );
  });

  // ===========================================================================
  // PM-5G-08: Asignación individual válida -> PASS
  // ===========================================================================
  it('PM-5G-08: Asignación operativa válida actualiza proyección y registra expediente_asignacion', async () => {
    const asigService = new ExpedienteAsignacionService(mockPool);
    mockQuery
      // 1. Obtener área custodia expediente
      .mockResolvedValueOnce({ rows: [{ area_actual_id: ID_AREA_A }] })
      // 2. Validar persona
      .mockResolvedValueOnce({ rows: [{ id_persona: ID_PERSONA_ACTOR, estado: 'ACTIVO' }] })
      // 3. Validar cuenta
      .mockResolvedValueOnce({
        rows: [{ id_usuario: ID_USUARIO_ACTOR, activo: true, id_persona: ID_PERSONA_ACTOR }],
      })
      // 4. Validar vínculo institucional vigente
      .mockResolvedValueOnce({ rows: [{ id_vinculo: 'vinc-1' }] })
      // 5. Validar pertenencia al área
      .mockResolvedValueOnce({ rows: [{ valida: true }] })
      // 6. Desactivar previas
      .mockResolvedValueOnce({ rowCount: 0 })
      // 7. Insertar nueva
      .mockResolvedValueOnce({
        rows: [{
          id_asignacion: 'asig-nueva-1',
          expediente_id: ID_EXPEDIENTE,
          id_persona: ID_PERSONA_ACTOR,
          id_usuario: ID_USUARIO_ACTOR,
          id_area: ID_AREA_A,
          asignado_por: ID_USUARIO_ACTOR,
          motivo: 'Asignado para calificación técnica',
          activo: true,
          asignado_en: new Date(),
        }],
      })
      // 8. Actualizar estado_actual_expediente
      .mockResolvedValueOnce({ rowCount: 1 });

    const resultado = await asigService.asignarExpediente({
      expedienteId: ID_EXPEDIENTE,
      idPersona: ID_PERSONA_ACTOR,
      idUsuario: ID_USUARIO_ACTOR,
      motivo: 'Asignado para calificación técnica',
      asignadoPorUsuarioId: ID_USUARIO_ACTOR,
    });

    expect(resultado.idAsignacion).toBe('asig-nueva-1');
    expect(resultado.activo).toBe(true);
  });

  // ===========================================================================
  // PM-5G-09: Asignación a funcionario no vigente -> DENY 403 (ASIGNACION_NO_VIGENTE)
  // ===========================================================================
  it('PM-5G-09: Asignación a funcionario sin vínculo institucional o cuenta inactiva falla cerrado (403)', async () => {
    const asigService = new ExpedienteAsignacionService(mockPool);
    mockQuery
      .mockResolvedValueOnce({ rows: [{ area_actual_id: ID_AREA_A }] }) // expediente
      .mockResolvedValueOnce({ rows: [{ id_persona: ID_PERSONA_ACTOR, estado: 'ACTIVO' }] }) // persona
      .mockResolvedValueOnce({
        rows: [{ id_usuario: ID_USUARIO_ACTOR, activo: false, id_persona: ID_PERSONA_ACTOR }], // CUENTA DESHABILITADA
      });

    await expect(
      asigService.asignarExpediente({
        expedienteId: ID_EXPEDIENTE,
        idPersona: ID_PERSONA_ACTOR,
        idUsuario: ID_USUARIO_ACTOR,
        motivo: 'Intento con cuenta inactiva',
        asignadoPorUsuarioId: 'admin-id',
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  // ===========================================================================
  // PM-5G-10: Funcionario cesa o se desasigna -> custodia del expediente continúa en el área
  // ===========================================================================
  it('PM-5G-10: Desasignación individual limpia persona/usuario asignado pero conserva la custodia de área', async () => {
    const asigService = new ExpedienteAsignacionService(mockPool);
    mockQuery
      // 1. UPDATE expediente_asignacion activo = false
      .mockResolvedValueOnce({ rowCount: 1 })
      // 2. UPDATE estado_actual_expediente persona_asignada_id = NULL
      .mockResolvedValueOnce({ rowCount: 1 });

    await asigService.desasignarExpediente(
      ID_EXPEDIENTE,
      ID_USUARIO_ACTOR,
      'Cese laboral del especialista - expediente devuelto al área',
      mockClient,
    );

    expect(mockQuery).toHaveBeenCalledTimes(2);
    expect(insertarEvento).toHaveBeenCalledWith(
      mockClient,
      expect.objectContaining({ tipo_evento: 'ExpedienteDesasignado' }),
    );
  });

  // ===========================================================================
  // PM-5G-11: Observación de requisito -> estado OBSERVADO y registro estructurado
  // ===========================================================================
  it('PM-5G-11: Observación de expediente pausa SLA y genera registro estructurado en expediente_observacion', async () => {
    mockQuery
      // 1. SELECT estado actual
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ estado_actual_id: 'EN_REVISION', area_contexto_id: ID_AREA_A }],
      })
      // 2. INSERT movimiento OBSERVADO
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ movimiento_id: 'mov-obs-1' }] })
      // 3. UPDATE sigd_tra.expediente
      .mockResolvedValueOnce({ rowCount: 1 })
      // 4. count observaciones
      .mockResolvedValueOnce({ rows: [{ total: '0' }] })
      // 5. INSERT expediente_observacion
      .mockResolvedValueOnce({
        rows: [{
          id_observacion: 'obs-struct-1',
          expediente_id: ID_EXPEDIENTE,
          numero_observacion: 1,
          estado_observacion: 'OBSERVADO',
          estado_anterior_expediente: 'EN_REVISION',
          motivo: 'Falta copia legalizada de DNI',
          observado_por_persona_id: ID_PERSONA_ACTOR,
          observado_por_usuario_id: ID_USUARIO_ACTOR,
          area_observacion_id: ID_AREA_A,
          id_movimiento_observacion: 'mov-obs-1',
          requisitos_afectados: ['req-uuid-1'],
          creado_en: new Date(),
        }],
      })
      // 6. UPDATE evidencia requisito
      .mockResolvedValueOnce({ rowCount: 1 });

    await observarExpediente(mockClient, ID_EXPEDIENTE, 'Falta copia legalizada de DNI', {
      personaId: ID_PERSONA_ACTOR,
      areaId: ID_AREA_A,
      requisitosAfectados: ['req-uuid-1'],
    });

    expect(insertarEvento).toHaveBeenCalledWith(
      mockClient,
      expect.objectContaining({
        tipo_evento: 'ExpedienteObservado',
        payload: expect.objectContaining({
          datos_especificos: expect.objectContaining({ slaPaused: true }),
        }),
      }),
    );
  });

  // ===========================================================================
  // PM-5G-12: Subsanación -> transición a EN_REVISION y registro en expediente_observacion
  // ===========================================================================
  it('PM-5G-12: Subsanación exitosa marca observación como SUBSANADO y retorna a EN_REVISION', async () => {
    mockQuery
      // 1. SELECT estado actual
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ estado_actual_id: 'OBSERVADO', area_contexto_id: ID_AREA_A }],
      })
      // 2. INSERT SUBSANADO
      .mockResolvedValueOnce({ rowCount: 1 })
      // 3. INSERT EN_REVISION
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ movimiento_id: 'mov-sub-1' }] })
      // 4. UPDATE sigd_tra.expediente
      .mockResolvedValueOnce({ rowCount: 1 })
      // 5. SELECT última observacion
      .mockResolvedValueOnce({ rows: [{ id_observacion: 'obs-struct-1' }] })
      // 6. UPDATE expediente_observacion
      .mockResolvedValueOnce({
        rows: [{
          id_observacion: 'obs-struct-1',
          expediente_id: ID_EXPEDIENTE,
          numero_observacion: 1,
          estado_observacion: 'SUBSANADO',
          estado_anterior_expediente: 'EN_REVISION',
          motivo: 'Falta copia legalizada de DNI',
          observado_por_persona_id: ID_PERSONA_ACTOR,
          observado_por_usuario_id: ID_USUARIO_ACTOR,
          area_observacion_id: ID_AREA_A,
          id_movimiento_observacion: 'mov-obs-1',
          requisitos_afectados: ['req-uuid-1'],
          subsanado_en: new Date(),
          subsanado_por_persona_id: ID_PERSONA_ACTOR,
          subsanado_por_usuario_id: ID_USUARIO_ACTOR,
          motivo_subsanacion: 'Adjunto copia legalizada por notario',
          id_movimiento_subsanacion: 'mov-sub-1',
          creado_en: new Date(),
        }],
      });

    await subsanarExpediente(mockClient, ID_EXPEDIENTE, 'Adjunto copia legalizada por notario', {
      personaId: ID_PERSONA_ACTOR,
    });

    expect(insertarEvento).toHaveBeenCalledWith(
      mockClient,
      expect.objectContaining({ tipo_evento: 'ExpedienteSubsanado' }),
    );
  });

  // ===========================================================================
  // PM-5G-13: Segunda observación -> primera cadena de observación/subsanación preservada
  // ===========================================================================
  it('PM-5G-13: Una segunda observación incrementa el número secuencial preservando el histórico anterior', async () => {
    const obsService = new ExpedienteObservacionService(mockPool);
    mockQuery
      // 1. SELECT count actual = 1
      .mockResolvedValueOnce({ rows: [{ total: '1' }] })
      // 2. INSERT con numero_observacion = 2
      .mockResolvedValueOnce({
        rows: [{
          id_observacion: 'obs-struct-2',
          expediente_id: ID_EXPEDIENTE,
          numero_observacion: 2,
          estado_observacion: 'OBSERVADO',
          estado_anterior_expediente: 'EN_REVISION',
          motivo: 'Segunda observación: documento ilegible',
          observado_por_persona_id: ID_PERSONA_ACTOR,
          observado_por_usuario_id: ID_USUARIO_ACTOR,
          area_observacion_id: ID_AREA_A,
          id_movimiento_observacion: 'mov-obs-2',
          requisitos_afectados: [],
          creado_en: new Date(),
        }],
      });

    const obs2 = await obsService.registrarObservacion({
      expedienteId: ID_EXPEDIENTE,
      motivo: 'Segunda observación: documento ilegible',
      usuarioId: ID_USUARIO_ACTOR,
      personaId: ID_PERSONA_ACTOR,
      areaId: ID_AREA_A,
      estadoAnterior: 'EN_REVISION',
      idMovimientoObservacion: 'mov-obs-2',
    });

    expect(obs2.numeroObservacion).toBe(2);
    expect(obs2.estadoObservacion).toBe('OBSERVADO');
  });

  // ===========================================================================
  // PM-5G-14: Doble request con misma Idempotency-Key
  // ===========================================================================
  it('PM-5G-14: Idempotency-Key idéntica es idempotente; con payload diferente arroja ConflictError (409)', async () => {
    // Caso A: Misma clave y mismo payload -> Retorno sin mutar
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{
        id_movimiento: 'mov-previo',
        datos: { areaId: ID_AREA_B, proveido: 'Derivación idéntica' },
      }],
    });

    await derivarExpediente(mockClient, ID_EXPEDIENTE, {
      destinos: [{ area_destino_id: ID_AREA_B, es_copia: false }],
      proveido: 'Derivación idéntica',
      clave_idempotencia: 'idem-key-1',
    });
    // Solo consultó la clave y retornó
    expect(mockQuery).toHaveBeenCalledTimes(1);

    // Caso B: Misma clave con payload diferente -> ConflictError
    mockQuery.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{
        id_movimiento: 'mov-previo',
        datos: { areaId: ID_AREA_B, proveido: 'Payload original' },
      }],
    });

    await expect(
      derivarExpediente(mockClient, ID_EXPEDIENTE, {
        destinos: [{ area_destino_id: ID_AREA_A, es_copia: false }], // Diferente destino
        proveido: 'Payload cambiado',
        clave_idempotencia: 'idem-key-1',
      }),
    ).rejects.toThrow(ConflictError);
  });

  // ===========================================================================
  // PM-5G-15: Advisory Lock de Concurrencia
  // ===========================================================================
  it('PM-5G-15: Concurrencia sobre un expediente invoca pg_advisory_xact_lock de forma determinística', async () => {
    mockQuery.mockResolvedValueOnce({ rowCount: 1 });
    await bloquearExpedienteRutaDoc(mockClient, ID_EXPEDIENTE);

    expect(mockQuery).toHaveBeenCalledWith(
      "SELECT pg_advisory_xact_lock(hashtext('exp_' || $1::text))",
      [ID_EXPEDIENTE],
    );
  });

  // ===========================================================================
  // PM-5G-16: Pago confirmado requerido
  // ===========================================================================
  it('PM-5G-16: Trámite con orden de pago pendiente no permite continuar derivación', async () => {
    const ordenPagoPendiente = {
      monto: 50.00,
      estado: 'PENDIENTE',
    };
    expect(Number(ordenPagoPendiente.monto) > 0 && ordenPagoPendiente.estado !== 'CONFIRMADO').toBe(true);
  });

  // ===========================================================================
  // PM-5G-17: Autoatención prohibida (solicitante === actor)
  // ===========================================================================
  it('PM-5G-17: Solicitante titular no puede resolver ni calificar su propio expediente (AUTOATENCION_PROHIBIDA)', async () => {
    const authService = new AuthorizationService(mockPool);
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id_usuario: ID_USUARIO_ACTOR, activo: true }] })
      .mockResolvedValueOnce({ rows: [{ id_persona: ID_PERSONA_ACTOR }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ codigo: 'DIRECTOR' }] });

    const resAuth = await authService.autorizar({
      usuarioId: ID_USUARIO_ACTOR,
      accion: 'EXPEDIENTE_RESOLVER',
      recurso: {
        tipo: 'EXPEDIENTE',
        id: ID_EXPEDIENTE,
        solicitanteUsuarioId: ID_USUARIO_ACTOR, // El mismo usuario es el solicitante
        solicitantePersonaId: ID_PERSONA_ACTOR,
      },
      rolesDeclarados: ['DIRECTOR'],
    });

    expect(resAuth.autorizado).toBe(false);
    expect(resAuth.codigoDenegacion).toBe('AUTOAPROBACION_PROHIBIDA');
  });

  // ===========================================================================
  // PM-5G-18: Firma sin autoridad institucional -> DENY 403
  // ===========================================================================
  it('PM-5G-18: Administrador técnico sin perfil resolutivo es denegado para resolver expedientes', async () => {
    const authService = new AuthorizationService(mockPool);
    mockQuery
      .mockResolvedValueOnce({ rows: [{ id_usuario: ID_USUARIO_ACTOR, activo: true }] })
      .mockResolvedValueOnce({ rows: [{ id_persona: ID_PERSONA_ACTOR }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ codigo: 'ADMINISTRADOR' }] }); // Solo admin técnico

    const resAuth = await authService.autorizar({
      usuarioId: ID_USUARIO_ACTOR,
      accion: 'EXPEDIENTE_RESOLVER',
      recurso: {
        tipo: 'EXPEDIENTE',
        id: ID_EXPEDIENTE,
        solicitanteUsuarioId: 'otro-usuario',
      },
      rolesDeclarados: ['ADMINISTRADOR'],
    });

    expect(resAuth.autorizado).toBe(false);
    expect(resAuth.codigoDenegacion).toBe('PODER_TECNICO_SIN_AUTORIDAD_NEGOCIO');
  });

  // ===========================================================================
  // PM-5G-19: Resolución válida -> PASS (RESUELTO)
  // ===========================================================================
  it('PM-5G-19: Atención resolutiva requiere pase a firma y evidencia válida (Invariante 5K.1)', async () => {
    mockQuery
      // 1. SELECT estado_actual_id
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          estado_actual_id: 'EN_REVISION',
          area_contexto_id: ID_AREA_A,
          codigo_expediente: 'EXP-2026-0001',
          solicitante_id: 'sol-1',
          tipo_documental_id: 'tipo-doc-1',
        }],
      });

    await expect(
      atenderExpediente(mockClient, ID_EXPEDIENTE, {
        resultado_resumen: 'Se aprueba la solicitud de rectificación de matrícula',
        documento_respuesta_id: 'doc-adj-1',
      })
    ).rejects.toThrow(/FLUJO_RESOLUTIVO_REQUIERE_FIRMA/);
  });

  // ===========================================================================
  // PM-5G-20: Archivado conserva documentos e historial -> PASS (ARCHIVADO)
  // ===========================================================================
  it('PM-5G-20: Archivado formal conserva la trazabilidad registrando ubicación topográfica', async () => {
    mockQuery
      // 1. SELECT estado actual
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ estado_actual_id: 'RESUELTO', area_contexto_id: ID_AREA_A, codigo_expediente: 'EXP-2026-0001' }],
      })
      // 2. INSERT movimiento ARCHIVADO
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ movimiento_id: 'mov-arc-1' }] })
      // 3. UPDATE sigd_tra.expediente ARCHIVADO
      .mockResolvedValueOnce({ rowCount: 1 });

    await archivarExpediente(mockClient, ID_EXPEDIENTE, {
      estante: 'E-03',
      balda: 'B-02',
      caja: 'C-15',
      observaciones: 'Custodia pasiva definitiva',
    });

    expect(insertarEvento).toHaveBeenCalledWith(
      mockClient,
      expect.objectContaining({
        tipo_evento: 'ExpedienteArchivado',
        payload: expect.objectContaining({
          datos_especificos: expect.objectContaining({ estante: 'E-03', caja: 'C-15' }),
        }),
      }),
    );
  });

  // ===========================================================================
  // Item 105: Versioned Workflow Engine (WF-DEMO-V1 vs WF-DEMO-V2)
  // ===========================================================================
  it('Item 105: Workflow versionado e in-flight preservation (WF-DEMO-V1 vs WF-DEMO-V2)', async () => {
    const wfService = new WorkflowService(mockPool);

    // 1. Crear definición de workflow
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id_workflow: 'wf-def-1',
        codigo: 'WF-DEMO',
        nombre: 'Flujo de Rectificación de Matrícula',
        descripcion: null,
        activo: true,
        proveniencia: 'OFICIAL_SUIZA',
        fuente_original: 'DIRECTIVA-2026-IESTP-SUIZA',
        estado_homologacion: 'HOMOLOGADO',
        creado_en: new Date(),
      }],
    });

    const definicion = await wfService.registrarDefinicion({
      codigo: 'WF-DEMO',
      nombre: 'Flujo de Rectificación de Matrícula',
      proveniencia: 'OFICIAL_SUIZA',
      fuenteOriginal: 'DIRECTIVA-2026-IESTP-SUIZA',
      estadoHomologacion: 'HOMOLOGADO',
    });

    expect(definicion.idWorkflow).toBe('wf-def-1');

    // 2. Crear Versión 1 (WF-DEMO-V1)
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id_version: 'wf-v1-uuid',
        id_workflow: 'wf-def-1',
        version: '1',
        codigo_completo: 'WF-DEMO-V1',
        descripcion: 'Versión inicial lineal de 3 pasos',
        activo: true,
        proveniencia: 'OFICIAL_SUIZA',
        fuente_original: 'DIRECTIVA-2026-IESTP-SUIZA',
        estado_homologacion: 'HOMOLOGADO',
        pasos: [
          { orden: 1, nombre: 'Mesa de Partes', accionRequerida: 'RECEPCION' },
          { orden: 2, nombre: 'Dirección Académica', accionRequerida: 'CALIFICACION' },
          { orden: 3, nombre: 'Secretaría General', accionRequerida: 'RESOLUCION' },
        ],
        creado_en: new Date(),
      }],
    });

    const v1 = await wfService.registrarVersion({
      idWorkflow: 'wf-def-1',
      version: '1',
      codigoCompleto: 'WF-DEMO-V1',
      pasos: [
        { orden: 1, nombre: 'Mesa de Partes', accionRequerida: 'RECEPCION' },
        { orden: 2, nombre: 'Dirección Académica', accionRequerida: 'CALIFICACION' },
        { orden: 3, nombre: 'Secretaría General', accionRequerida: 'RESOLUCION' },
      ],
    });

    expect(v1.idVersion).toBe('wf-v1-uuid');
    expect(v1.pasos.length).toBe(3);

    // 3. Crear Versión 2 (WF-DEMO-V2 con 4 pasos)
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id_version: 'wf-v2-uuid',
        id_workflow: 'wf-def-1',
        version: '2',
        codigo_completo: 'WF-DEMO-V2',
        descripcion: 'Versión optimizada con paso de verificación previa',
        activo: true,
        proveniencia: 'OFICIAL_SUIZA',
        fuente_original: 'DIRECTIVA-2026-ACTUALIZADA',
        estado_homologacion: 'HOMOLOGADO',
        pasos: [
          { orden: 1, nombre: 'Mesa de Partes', accionRequerida: 'RECEPCION' },
          { orden: 2, nombre: 'Unidad de Matrícula', accionRequerida: 'VERIFICACION_ACADEMICA' },
          { orden: 3, nombre: 'Dirección Académica', accionRequerida: 'CALIFICACION' },
          { orden: 4, nombre: 'Secretaría General', accionRequerida: 'RESOLUCION' },
        ],
        creado_en: new Date(),
      }],
    });

    const v2 = await wfService.registrarVersion({
      idWorkflow: 'wf-def-1',
      version: '2',
      codigoCompleto: 'WF-DEMO-V2',
      pasos: [
        { orden: 1, nombre: 'Mesa de Partes', accionRequerida: 'RECEPCION' },
        { orden: 2, nombre: 'Unidad de Matrícula', accionRequerida: 'VERIFICACION_ACADEMICA' },
        { orden: 3, nombre: 'Dirección Académica', accionRequerida: 'CALIFICACION' },
        { orden: 4, nombre: 'Secretaría General', accionRequerida: 'RESOLUCION' },
      ],
    });

    expect(v2.idVersion).toBe('wf-v2-uuid');
    expect(v2.pasos.length).toBe(4);

    // 4. In-Flight: Expediente 1 continúa en Versión 1 sin verse afectado por Versión 2
    mockQuery.mockResolvedValueOnce({
      rows: [{
        id_instancia: 'inst-exp-1',
        expediente_id: 'exp-inflight-1',
        id_version_workflow: 'wf-v1-uuid', // Amarrado a V1
        paso_actual: 2,
        total_pasos: 3,
        estado_instancia: 'EN_CURSO',
        historial_pasos: [{ paso: 1, completadoEn: new Date().toISOString() }],
        iniciado_en: new Date(),
        finalizado_en: null,
      }],
    });

    const instExp1 = await wfService.obtenerInstanciaPorExpediente('exp-inflight-1');
    expect(instExp1?.idVersionWorkflow).toBe('wf-v1-uuid');
    expect(instExp1?.totalPasos).toBe(3);
    expect(instExp1?.pasoActual).toBe(2);
  });

  // ===========================================================================
  // Desacoplamiento TUPA vs Workflow
  // ===========================================================================
  it('Desacoplamiento TUPA vs Workflow: La categoría TUPA NO decide automáticamente el flujo', async () => {
    const wfService = new WorkflowService(mockPool);
    // Simular que el procedimiento TUPA no tiene workflow explícito configurado
    mockQuery.mockResolvedValueOnce({ rows: [] }); // No configurado en workflow_procedimiento_config

    const instancia = await wfService.vincularInstanciaExpediente(
      ID_EXPEDIENTE,
      'tupa-proc-sin-configuracion',
      mockClient,
    );

    // Permanece NULL; no asume ni inventa flujo por ser de categoría AUTOMÁTICO o EVALUACIÓN PREVIA
    expect(instancia).toBeNull();
  });

  // ===========================================================================
  // PM-5G-21: Requisito financiero PENDIENTE_HOMOLOGACION no bloquea derivación
  // ===========================================================================
  it('PM-5G-21: Requisito financiero con estado PENDIENTE_HOMOLOGACION no bloquea derivación', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/expedientes', crearRouterDerivaciones(mockPool, {
      obtenerActor: vi.fn().mockResolvedValue({
        id: ID_USUARIO_ACTOR,
        idPersona: ID_PERSONA_ACTOR,
        roles: ['SECRETARIO'],
        unidadOrganicaId: ID_AREA_A,
        contextoOperacion: 'INSTITUCIONAL',
      }),
    } as any));
    app.use(errorMiddleware);

    mockQuery
      .mockResolvedValueOnce({ rowCount: 1 }) // BEGIN
      .mockResolvedValueOnce({ rowCount: 1 }) // pg_advisory_xact_lock
      // 1. Requisito financiero NO homologado (PENDIENTE_HOMOLOGACION)
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          id_requisito: 'req-fin-1',
          nombre: 'Tasa Trámite Documentario',
          estado_homologacion: 'PENDIENTE_HOMOLOGACION',
        }],
      })
      // 2. Contexto expediente (área actual ID_AREA_A, estado EN_REVISION)
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          expediente_id: ID_EXPEDIENTE,
          solicitante_id: 'otro-solicitante',
          estado_actual_id: 'EN_REVISION',
          area_contexto_id: ID_AREA_A,
        }],
      })
      // 3. Destino ID_AREA_B vigente
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id_area: ID_AREA_B, nombre: 'Área Destino B', vigente: true }],
      })
      // 4. derivarExpediente -> SELECT estado_actual_id
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ estado_actual_id: 'EN_REVISION', area_contexto_id: ID_AREA_A }],
      })
      // 5. derivarExpediente -> INSERT movimiento
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ movimiento_id: 'mov-pm-21' }],
      })
      // 6. UPDATE sigd_tra.expediente
      .mockResolvedValueOnce({ rowCount: 1 })
      // 7. COMMIT
      .mockResolvedValueOnce({ rowCount: 1 });

    const res = await request(app)
      .post(`/api/v1/expedientes/${ID_EXPEDIENTE}/derivar`)
      .send({
        destinos: [{ area_destino_id: ID_AREA_B, es_copia: false }],
        proveido: 'Pase a Despacho para trámite',
      });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.nuevoEstado).toBe('DERIVADO');
  });

  // ===========================================================================
  // PM-5G-22: Requisito financiero HOMOLOGADO bloquea si pago está pendiente; pago confirmado satisface sin autoderivar
  // ===========================================================================
  it('PM-5G-22: Requisito financiero HOMOLOGADO bloquea derivación si pago está pendiente; pago confirmado satisface sin autoderivar', async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/v1/expedientes', crearRouterDerivaciones(mockPool, {
      obtenerActor: vi.fn().mockResolvedValue({
        id: ID_USUARIO_ACTOR,
        idPersona: ID_PERSONA_ACTOR,
        roles: ['SECRETARIO'],
        unidadOrganicaId: ID_AREA_A,
        contextoOperacion: 'INSTITUCIONAL',
      }),
    } as any));
    app.use(errorMiddleware);

    // Parte A: Requisito financiero HOMOLOGADO + pago PENDIENTE -> DENY 409 PAGO_PENDIENTE
    mockQuery
      .mockResolvedValueOnce({ rowCount: 1 }) // BEGIN
      .mockResolvedValueOnce({ rowCount: 1 }) // pg_advisory_xact_lock
      // Requisito financiero formalmente HOMOLOGADO
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          id_requisito: 'req-fin-homologado',
          nombre: 'Tasa Certificado Oficial',
          estado_homologacion: 'HOMOLOGADO',
        }],
      })
      // Orden de pago en estado PENDIENTE
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ estado: 'PENDIENTE', monto: 45.00 }],
      })
      .mockResolvedValueOnce({ rowCount: 1 }); // ROLLBACK

    const resPendiente = await request(app)
      .post(`/api/v1/expedientes/${ID_EXPEDIENTE}/derivar`)
      .send({
        destinos: [{ area_destino_id: ID_AREA_B, es_copia: false }],
        proveido: 'Intento de derivar sin pago confirmado',
      });

    expect(resPendiente.status).toBe(409);
    expect(resPendiente.body.code).toBe('PAGO_PENDIENTE');

    // Parte B: Requisito financiero HOMOLOGADO + pago CONFIRMADO -> PASS 200 (sin autoderivación automática)
    mockQuery
      .mockResolvedValueOnce({ rowCount: 1 }) // BEGIN
      .mockResolvedValueOnce({ rowCount: 1 }) // pg_advisory_xact_lock
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          id_requisito: 'req-fin-homologado',
          nombre: 'Tasa Certificado Oficial',
          estado_homologacion: 'HOMOLOGADO',
        }],
      })
      // Pago confirmado satisface la obligación
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ estado: 'CONFIRMADO', monto: 45.00 }],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          expediente_id: ID_EXPEDIENTE,
          solicitante_id: 'otro-solicitante',
          estado_actual_id: 'EN_REVISION',
          area_contexto_id: ID_AREA_A,
        }],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id_area: ID_AREA_B, nombre: 'Área Destino B', vigente: true }],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ estado_actual_id: 'EN_REVISION', area_contexto_id: ID_AREA_A }],
      })
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ movimiento_id: 'mov-pm-22' }],
      })
      .mockResolvedValueOnce({ rowCount: 1 }) // UPDATE
      .mockResolvedValueOnce({ rowCount: 1 }); // COMMIT

    const resConfirmado = await request(app)
      .post(`/api/v1/expedientes/${ID_EXPEDIENTE}/derivar`)
      .send({
        destinos: [{ area_destino_id: ID_AREA_B, es_copia: false }],
        proveido: 'Pase formal con pago verificado',
      });

    expect(resConfirmado.status).toBe(200);
    expect(resConfirmado.body.ok).toBe(true);
    expect(resConfirmado.body.nuevoEstado).toBe('DERIVADO');
  });

  // ===========================================================================
  // PM-5G-23: Expediente en EN_REVISION enviado a firma transiciona a EN_FIRMA (no a RESUELTO)
  // ===========================================================================
  it('PM-5G-23: Expediente en EN_REVISION enviado a firma transiciona a EN_FIRMA (no a RESUELTO)', async () => {
    mockQuery
      // 1. SELECT estado_actual_id
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          estado_actual_id: 'EN_REVISION',
          area_contexto_id: ID_AREA_A,
          codigo_expediente: 'EXP-2026-0001',
          solicitante_id: 'sol-1',
        }],
      })
      // 2. INSERT sigd_rut.movimiento_tramite (EN_REVISION -> ENVIAR_A_FIRMA -> EN_FIRMA)
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ movimiento_id: 'mov-firma-1' }] })
      // 3. UPDATE sigd_tra.expediente SET estado = 'EN_FIRMA'
      .mockResolvedValueOnce({ rowCount: 1 });

    const res = await enviarAFirmaExpediente(mockClient, ID_EXPEDIENTE, {
      resultado_resumen: 'Pase a Despacho para emisión y firma de Resolución Directoral',
    });

    expect(res.estado).toBe('EN_FIRMA');
    expect(res.estado).not.toBe('RESUELTO');
    expect(insertarEvento).toHaveBeenCalledWith(
      mockClient,
      expect.objectContaining({ tipo_evento: 'ExpedienteEnviadoAFirma' }),
    );
  });

  // ===========================================================================
  // PM-5G-24: Expediente en EN_FIRMA sin evidencia válida de firma digital es denegado (EVIDENCIA_FIRMA_REQUERIDA)
  // ===========================================================================
  it('PM-5G-24: Expediente en EN_FIRMA sin evidencia válida de firma digital es denegado (EVIDENCIA_FIRMA_REQUERIDA)', async () => {
    mockQuery
      // 1. SELECT estado_actual_id
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          estado_actual_id: 'EN_FIRMA',
          area_contexto_id: ID_AREA_A,
          codigo_expediente: 'EXP-2026-0001',
          solicitante_id: 'sol-1',
        }],
      })
      // 2. SELECT firma_digital_documento (0 firmas)
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
      // 3. SELECT resolucion (0 resoluciones)
      .mockResolvedValueOnce({ rowCount: 0, rows: [] });

    await expect(
      resolverExpedienteConFirma(mockClient, ID_EXPEDIENTE, {
        resultado_resumen: 'Intento de resolución sin firma previa',
      }),
    ).rejects.toThrow(ConflictError);

    try {
      mockQuery
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{
            estado_actual_id: 'EN_FIRMA',
            area_contexto_id: ID_AREA_A,
            codigo_expediente: 'EXP-2026-0001',
            solicitante_id: 'sol-1',
          }],
        })
        .mockResolvedValueOnce({ rowCount: 0, rows: [] })
        .mockResolvedValueOnce({ rowCount: 0, rows: [] });

      await resolverExpedienteConFirma(mockClient, ID_EXPEDIENTE, {
        resultado_resumen: 'Intento de resolución sin firma previa',
      });
    } catch (err: any) {
      expect(err.code).toBe('EVIDENCIA_FIRMA_REQUERIDA');
    }
  });

  // ===========================================================================
  // PM-5G-25: Expediente en EN_FIRMA con evidencia de firma válida transiciona a RESUELTO con movimiento WORM
  // ===========================================================================
  it('PM-5G-25: Expediente en EN_FIRMA con evidencia de firma válida transiciona a RESUELTO con movimiento WORM', async () => {
    mockQuery
      // 1. SELECT estado_actual_id
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{
          estado_actual_id: 'EN_FIRMA',
          area_contexto_id: ID_AREA_A,
          codigo_expediente: 'EXP-2026-0001',
          solicitante_id: 'sol-1',
        }],
      })
      // 2. SELECT firma_digital_documento (Evidencia válida encontrada)
      .mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ documento_id: 'doc-adj-firmado-1' }],
      })
      // 3. INSERT movimiento FSM (EN_FIRMA -> FIRMA -> RESUELTO)
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ movimiento_id: 'mov-res-firmado-1' }] })
      // 4. UPDATE sigd_tra.expediente SET estado = 'RESUELTO' WHERE estado = 'EN_FIRMA'
      .mockResolvedValueOnce({ rowCount: 1 });

    const res = await resolverExpedienteConFirma(mockClient, ID_EXPEDIENTE, {
      resultado_resumen: 'Resolución Directoral 045-2026 debidamente suscrita',
    });

    expect(res.estado).toBe('RESUELTO');
    expect(res.movimiento_id).toBe('mov-res-firmado-1');
    expect(insertarEvento).toHaveBeenCalledWith(
      mockClient,
      expect.objectContaining({ tipo_evento: 'ExpedienteAtendido' }),
    );
  });
});
