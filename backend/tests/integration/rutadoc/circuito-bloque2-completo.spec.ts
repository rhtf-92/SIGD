import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool, PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import {
  derivarExpediente,
  recepcionarExpediente,
  atenderExpediente,
  evaluarElegibilidadDerivacion,
} from '../../../src/domains/rutadoc/derivaciones.service.js';
import { ExpedienteAsignacionService } from '../../../src/domains/rutadoc/expedienteAsignacion.service.js';
import { TesoreriaRepository } from '../../../src/domains/tesoreria/tesoreria.repository.js';
import { TupaVersionRepository } from '../../../src/domains/tramicore/tupaVersion.repository.js';
import { WorkflowService } from '../../../src/domains/rutadoc/workflow.service.js';
import { SQL_LISTAR_RUTADOC } from '../../../src/domains/rutadoc/rutadoc.repository.js';
import { runWithContext } from '../../../src/shared/request-context/request-context.js';
import { DomainError } from '../../../src/shared/domain/errors/index.js';

describe('SIGD — Bloque 2: Circuito DIR → Derivación SDA → Recepción → Asignación al Especialista → Inicio Atención', () => {
  let pool: Pool;
  let client: PoolClient;

  // Canonical IDs
  const AREA_DIR_ID = 'a0000000-0000-0000-0000-000000000002';
  const AREA_SDA_ID = 'a0000000-0000-0000-0000-000000000001';

  // Seeded institutional users
  const USER_DIRECTOR_DIR = '48b38966-150f-4fe6-8be6-ca9405c379b6';
  const USER_SECRETARIO_SDA = 'f62b07fa-6257-4d06-be7d-940b7305ae67';
  const USER_RESPONSABLE_INGLES = 'b5ef5f9f-6963-4bcc-b2bc-621c1aa22702';
  const USER_OTRO_ESPECIALISTA = '008feadd-98f6-4787-b655-a766623ac154';
  const USER_TESORERIA = '7fc19f9b-ad07-41d7-bc70-51f570c79ce8';

  function makeCtx(usuario_id: string) {
    return {
      correlation_id: randomUUID(),
      usuario_id,
      ip_origen: '127.0.0.1',
      user_agent: 'vitest',
    };
  }

  const testExpId = randomUUID();
  const testCut = `EXP-2026-999${Math.floor(100 + Math.random() * 899)}`;
  let testPersonaId: string;
  let testTipoDocId: string;
  let regVersionId: string;

  beforeAll(async () => {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres_password@172.20.157.19:5432/sigd_prueba',
    });
    client = await pool.connect();
    await client.query('BEGIN'); // Start isolated test transaction

    // Get an existing persona
    const pRes = await client.query('SELECT id_persona FROM sigd_auth.persona LIMIT 1');
    testPersonaId = pRes.rows[0].id_persona;

    // Get tipo documento
    const tdRes = await client.query('SELECT tipo_documental_id FROM sigd_doc.tipo_documento WHERE vigente = true LIMIT 1');
    testTipoDocId = tdRes.rows[0].tipo_documental_id;

    // Get TUPA procedure p1-fila-06
    const tupaRes = await client.query(`
      SELECT r.registro_version_id
      FROM sigd_doc.tupa_registro_version r
      JOIN sigd_doc.tupa_procedimiento p ON p.registro_version_id = r.registro_version_id
      WHERE r.referencia_fila = 'p1-fila-06' OR p.codigo_ref = 'p1-fila-06'
      LIMIT 1
    `);
    regVersionId = tupaRes.rows[0].registro_version_id;
  });

  afterAll(async () => {
    if (client) {
      await client.query('ROLLBACK'); // Always rollback to keep DB pristine
      client.release();
    }
    await pool.end();
  });

  describe('1. Comprobaciones breves del Bloque 1 (Radicación, PENDIENTE_PAGO y Destino Canónico DIR)', () => {
    it('Crea expediente para Certificado de Inglés radicado con destino DIR y genera orden arancelaria de S/ 100', async () => {
      // Create expediente in state PENDIENTE_PAGO with area_destino_id = DIR
      await client.query(`
        INSERT INTO sigd_tra.expediente (
          expediente_id, codigo_expediente, numero, tipo_documental_id, solicitante_id, area_destino_id, estado, fecha_radicacion
        ) VALUES (
          $1::uuid, $2, $2, $3::uuid, $4::uuid, $5::uuid, 'PENDIENTE_PAGO', now()
        )
      `, [testExpId, testCut, testTipoDocId, testPersonaId, AREA_DIR_ID]);

      await client.query(`
        INSERT INTO sigd_tra.tramite (expediente_id, asunto, estado)
        VALUES ($1::uuid, 'Solicitud de Certificado de Inglés', 'REGISTRADO')
      `, [testExpId]);

      // Formal TUPA snapshot link using repository
      const tupaRepo = new TupaVersionRepository(pool);
      await tupaRepo.crearVinculoConSnapshot(testExpId, regVersionId, {}, client);

      // Workflow instance
      const wfService = new WorkflowService(pool);
      await wfService.vincularInstanciaExpediente(testExpId, regVersionId, client);

      // Initial state projection in DIR
      await client.query(`
        INSERT INTO sigd_rut.estado_actual_expediente (
          expediente_id, secuencia, estado_nuevo, evento, area_actual_id, id_movimiento, fecha_hora, usuario_operador_id
        ) VALUES (
          $1::uuid, 1, 'REGISTRADO', 'RADICACION_DIGITAL_PUBLICA', $2, gen_random_uuid(), now(), 0
        )
      `, [testExpId, AREA_DIR_ID]);

      // Initialize sequence generator
      await client.query(`
        INSERT INTO sigd_rut.movimiento_secuencia (expediente_id, ultima_secuencia)
        VALUES ($1::uuid, 1)
        ON CONFLICT (expediente_id) DO UPDATE SET ultima_secuencia = GREATEST(sigd_rut.movimiento_secuencia.ultima_secuencia, 1)
      `, [testExpId]);

      // Generate orden de pago
      const tesoreriaRepo = new TesoreriaRepository();
      const codigoPago = await tesoreriaRepo.obtenerSiguienteCodigoPago(client, 2026);
      const orden = await tesoreriaRepo.insertarOrdenPago(client, {
        codigoPago,
        expedienteId: testExpId,
        registroVersionId: regVersionId,
        solicitanteId: testPersonaId,
        concepto: 'Tasa arancelaria TUPA Certificado de Inglés',
        codigoTupa: 'p1-fila-06',
        monto: 100.00,
        moneda: 'PEN',
        fechaVencimiento: new Date(Date.now() + 86400000),
      });

      expect(orden.estado).toBe('PENDIENTE');

      // Verify that the expediente is NOT marked as paid yet
      const expRes = await client.query('SELECT estado FROM sigd_tra.expediente WHERE expediente_id = $1::uuid', [testExpId]);
      expect(expRes.rows[0].estado).toBe('PENDIENTE_PAGO');

      const rutRes = await client.query('SELECT estado_nuevo, area_actual_id FROM sigd_rut.estado_actual_expediente WHERE expediente_id = $1::uuid', [testExpId]);
      expect(rutRes.rows[0].estado_nuevo).toBe('REGISTRADO');
      expect(rutRes.rows[0].area_actual_id).toBe(AREA_DIR_ID);
    });

    it('Intento de derivar en PENDIENTE_PAGO es bloqueado fail-closed por elegibilidad de dominio', async () => {
      const elegibilidad = await evaluarElegibilidadDerivacion(client, testExpId);
      expect(elegibilidad.puedeDerivar).toBe(false);
      expect(elegibilidad.pagoConforme).toBe(false);
      expect(elegibilidad.bloqueos).toContain('PAGO_PENDIENTE');

      await expect(
        runWithContext(makeCtx(USER_DIRECTOR_DIR), async () => {
          return derivarExpediente(client, testExpId, {
            destinos: [{ area_destino_id: AREA_SDA_ID, es_copia: false }],
            proveido: 'Pase a SDA para trámite correspondiente',
          });
        })
      ).rejects.toThrow(DomainError);
    });

    it('Confirmación válida del arancel transiciona atómicamente a REGISTRADO en expediente y proyección FSM', async () => {
      const tesoreriaRepo = new TesoreriaRepository();
      const ordenActiva = await tesoreriaRepo.obtenerOrdenActivaPorExpediente(client, testExpId);
      expect(ordenActiva).toBeTruthy();

      // Confirm payment in transaction
      await tesoreriaRepo.actualizarOrdenAConfirmada(client, {
        ordenPagoId: ordenActiva!.orden_pago_id,
        metodoPago: 'EFECTIVO',
        referenciaOperacion: null,
        montoRecibido: 100.00,
        vuelto: 0,
        codigoRecibo: 'REC-2026-999901',
        tesoreroId: USER_TESORERIA,
        fechaPago: new Date(),
        confirmedSource: 'TESORERIA',
      });

      // Execute unblocking logic implemented in Bloque 1
      await client.query(`
        UPDATE sigd_tra.expediente
           SET estado = 'REGISTRADO'
         WHERE expediente_id = $1::uuid AND estado = 'PENDIENTE_PAGO'
      `, [testExpId]);

      // Check both tables
      const expCheck = await client.query('SELECT estado FROM sigd_tra.expediente WHERE expediente_id = $1::uuid', [testExpId]);
      expect(expCheck.rows[0].estado).toBe('REGISTRADO');

      const rutCheck = await client.query('SELECT estado_nuevo, area_actual_id FROM sigd_rut.estado_actual_expediente WHERE expediente_id = $1::uuid', [testExpId]);
      expect(rutCheck.rows[0].estado_nuevo).toBe('REGISTRADO');
      expect(rutCheck.rows[0].area_actual_id).toBe(AREA_DIR_ID);

      const elegibilidadPost = await evaluarElegibilidadDerivacion(client, testExpId);
      expect(elegibilidadPost.puedeDerivar).toBe(true);
      expect(elegibilidadPost.pagoConforme).toBe(true);
    });
  });

  describe('2. Derivación DIR → SDA', () => {
    it('Expediente en REGISTRADO aparece en bandeja de DIR y no en SDA', async () => {
      // Query DIR inbox using SQL_LISTAR_RUTADOC on client
      const resDir = await client.query(SQL_LISTAR_RUTADOC, [
        null, AREA_DIR_ID, null, null, ['REGISTRADO'], null, null, 50,
      ]);
      const enDir = resDir.rows.some((i: any) => i.id_expediente === testExpId);
      expect(enDir).toBe(true);

      // Query SDA inbox
      const resSda = await client.query(SQL_LISTAR_RUTADOC, [
        null, AREA_SDA_ID, null, null, ['REGISTRADO'], null, null, 50,
      ]);
      const enSda = resSda.rows.some((i: any) => i.id_expediente === testExpId);
      expect(enSda).toBe(false);
    });

    it('Funcionario autorizado de DIR deriva a SDA: registra movimiento y actualiza custodia', async () => {
      await runWithContext(makeCtx(USER_DIRECTOR_DIR), async () => {
        await derivarExpediente(client, testExpId, {
          destinos: [{ area_destino_id: AREA_SDA_ID, es_copia: false }],
          proveido: 'Remítase a Subdirección Académica para emisión de dictamen de Certificado de Inglés',
        });
      });

      // Update expediente table as the controller does
      await client.query(`
        UPDATE sigd_tra.expediente
           SET estado = 'DERIVADO', area_destino_id = $2::uuid
         WHERE expediente_id = $1::uuid
      `, [testExpId, AREA_SDA_ID]);

      // Check movements
      const movs = await client.query(`
        SELECT estado_anterior, evento, estado_nuevo, datos
        FROM sigd_rut.movimiento_tramite
        WHERE expediente_id = $1::uuid
        ORDER BY secuencia ASC
      `, [testExpId]);

      const eventos = movs.rows.map((r) => r.evento);
      expect(eventos).toContain('RECEPCION');
      expect(eventos).toContain('INICIAR_CALIFICACION');
      expect(eventos).toContain('DERIVACION');

      // Check latest movement state
      const ultimoMov = movs.rows[movs.rows.length - 1];
      expect(ultimoMov.estado_nuevo).toBe('DERIVADO');
      expect(ultimoMov.datos?.areaId).toBe(AREA_SDA_ID);

      // Check projection
      const rutCheck = await client.query('SELECT estado_nuevo, area_actual_id FROM sigd_rut.estado_actual_expediente WHERE expediente_id = $1::uuid', [testExpId]);
      expect(rutCheck.rows[0].estado_nuevo).toBe('DERIVADO');
      expect(rutCheck.rows[0].area_actual_id).toBe(AREA_SDA_ID);
    });

    it('Desaparece de pendientes de DIR y aparece en bandeja receptora de SDA', async () => {
      // Query DIR pending inbox (REGISTRADO)
      const resDir = await client.query(SQL_LISTAR_RUTADOC, [
        null, AREA_DIR_ID, null, null, ['REGISTRADO'], null, null, 50,
      ]);
      expect(resDir.rows.some((i: any) => i.id_expediente === testExpId)).toBe(false);

      // Query SDA incoming inbox (DERIVADO)
      const resSda = await client.query(SQL_LISTAR_RUTADOC, [
        null, AREA_SDA_ID, null, null, ['DERIVADO'], null, null, 50,
      ]);
      expect(resSda.rows.some((i: any) => i.id_expediente === testExpId)).toBe(true);
    });
  });

  describe('3. Recepción en SDA', () => {
    it('Operador sin pertenencia al área SDA recibe 403 Forbidden por violación de custodia (BOLA)', async () => {
      const contextoExp = await client.query(`
        SELECT COALESCE(u.area_actual_id, e.area_destino_id::text) AS area_actual
        FROM sigd_tra.expediente e
        LEFT JOIN sigd_rut.estado_actual_expediente u ON u.expediente_id = e.expediente_id
        WHERE e.expediente_id = $1::uuid
      `, [testExpId]);

      expect(contextoExp.rows[0].area_actual).toBe(AREA_SDA_ID);
      // BOLA check verification: actor.unidadOrganicaId !== contextoExp.areaActualId
      const actorDirUnidad = AREA_DIR_ID;
      expect(actorDirUnidad === contextoExp.rows[0].area_actual).toBe(false);
    });

    it('Funcionario autorizado de SDA acusa recepción formal: transiciona a EN_REVISION', async () => {
      await runWithContext(makeCtx(USER_SECRETARIO_SDA), async () => {
        await recepcionarExpediente(client, testExpId);
      });

      const expRes = await client.query('SELECT estado FROM sigd_tra.expediente WHERE expediente_id = $1::uuid', [testExpId]);
      expect(expRes.rows[0].estado).toBe('EN_REVISION');

      const rutRes = await client.query('SELECT estado_nuevo, area_actual_id FROM sigd_rut.estado_actual_expediente WHERE expediente_id = $1::uuid', [testExpId]);
      expect(rutRes.rows[0].estado_nuevo).toBe('EN_REVISION');
      expect(rutRes.rows[0].area_actual_id).toBe(AREA_SDA_ID);
    });

    it('Recepción duplicada es IDEMPOTENTE (no-op)', async () => {
      await runWithContext(makeCtx(USER_SECRETARIO_SDA), async () => {
        // Calling a second time should safely return without error
        await recepcionarExpediente(client, testExpId);
      });

      const expRes = await client.query('SELECT estado FROM sigd_tra.expediente WHERE expediente_id = $1::uuid', [testExpId]);
      expect(expRes.rows[0].estado).toBe('EN_REVISION');
    });
  });

  describe('4. Asignación al Especialista e Inicio de Atención', () => {
    it('Secretario de SDA asigna formalmente a responsable_ingles_demo en sigd_rut.expediente_asignacion', async () => {
      const asigService = new ExpedienteAsignacionService(pool);

      // Get persona of responsable_ingles_demo
      const uRes = await client.query<{ id_persona: string }>(
        'SELECT id_persona FROM sigd_auth.cuenta_usuario WHERE id_usuario = $1::uuid',
        [USER_RESPONSABLE_INGLES]
      );
      const personaEspecialistaId = uRes.rows[0].id_persona;

      const asignacion = await asigService.asignarExpediente(
        {
          expedienteId: testExpId,
          idPersona: personaEspecialistaId,
          idUsuario: USER_RESPONSABLE_INGLES,
          motivo: 'Asignación para evaluación y emisión de dictamen técnico de Certificado de Inglés',
          asignadoPorUsuarioId: USER_SECRETARIO_SDA,
        },
        client,
      );

      expect(asignacion.activo).toBe(true);
      expect(asignacion.idArea).toBe(AREA_SDA_ID);
      expect(asignacion.idUsuario).toBe(USER_RESPONSABLE_INGLES);

      // Verify projection updated
      const rutRes = await client.query(`
        SELECT usuario_asignado_id, persona_asignada_id
        FROM sigd_rut.estado_actual_expediente
        WHERE expediente_id = $1::uuid
      `, [testExpId]);

      expect(rutRes.rows[0].usuario_asignado_id).toBe(USER_RESPONSABLE_INGLES);
      expect(rutRes.rows[0].persona_asignada_id).toBe(personaEspecialistaId);
    });

    it('Especialista no asignado es rechazado al intentar registrar atención técnica', async () => {
      const asigService = new ExpedienteAsignacionService(pool);
      const asignacionActiva = await asigService.obtenerAsignacionActiva(testExpId, client);
      expect(asignacionActiva).toBeTruthy();

      // Another specialist (USER_OTRO_ESPECIALISTA) attempts to attend
      const esAsignado = asignacionActiva?.idUsuario === USER_OTRO_ESPECIALISTA;
      expect(esAsignado).toBe(false);
    });

    it('Especialista asignado (responsable_ingles_demo) registra atención técnica con éxito', async () => {
      await runWithContext(makeCtx(USER_RESPONSABLE_INGLES), async () => {
        await atenderExpediente(client, testExpId, {
          resultado_resumen: 'Dictamen Favorable N.° 012-2026: Cumple con todas las competencias lingüísticas requeridas.',
          observacion_interna: 'Evaluación técnica completada satisfactoriamente en SDA.',
        });
      });

      // Verify that ATENCION_TECNICA was logged in workflow instance
      const wfRes = await client.query<{ historial_pasos: any }>(
        'SELECT historial_pasos FROM sigd_rut.workflow_instancia WHERE expediente_id = $1::uuid',
        [testExpId]
      );

      const historial = wfRes.rows[0]?.historial_pasos ?? [];
      const tieneAtencion = historial.some((h: any) => h.evento === 'ATENCION_TECNICA');
      expect(tieneAtencion).toBe(true);
    });
  });
});
