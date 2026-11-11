import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool, PoolClient } from 'pg';
import { randomUUID } from 'node:crypto';
import {
  resolverExpedienteConFirma,
  atenderExpediente,
  observarExpediente,
} from '../../src/domains/rutadoc/derivaciones.service.js';
import { OutboxWorker, type EventoPendiente } from '../../src/audit/outbox-worker.js';
import { DestinoCasilla, crearDespachadorPorDefecto } from '../../src/audit/despachador-notificaciones.js';
import { runWithContext } from '../../src/shared/request-context/request-context.js';
import { BusSse } from '../../src/modules/corelink/sseStream.service.js';
import { DomainError, ConflictError } from '../../src/shared/domain/errors/index.js';

describe('Fase 5K.1 — Suite E2E Real: Circuito RutaDoc → Outbox → Casilla Electrónica', () => {
  let pool: Pool;
  let tipoDocId: string;
  let areaId: string;
  let usuarioActorId: string;
  let personaActorId: string;

  const idsCreados = {
    personas: new Set<string>(),
    cuentas: new Set<string>(),
    expedientes: new Set<string>(),
    documentos: new Set<string>(),
    notificaciones: new Set<string>(),
    eventosOutbox: new Set<string>(),
  };

  beforeAll(async () => {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres_password@172.20.157.19:5432/sigd_prueba',
    });

    // Validar conexión
    const resConn = await pool.query('SELECT current_database(), current_user');
    expect(resConn.rows[0].current_database).toBe('sigd_prueba');

    // Obtener catálogo base
    const tdRes = await pool.query<{ tipo_documental_id: string }>(
      'SELECT tipo_documental_id FROM sigd_doc.tipo_documento LIMIT 1',
    );
    tipoDocId = tdRes.rows[0]?.tipo_documental_id;
    if (!tipoDocId) {
      throw new Error('No se encontró tipo documental en sigd_doc.tipo_documento');
    }

    const arRes = await pool.query<{ id: string }>(
      'SELECT area_id AS id FROM sigd_org.area LIMIT 1',
    );
    areaId = arRes.rows[0]?.id;
    if (!areaId) {
      throw new Error('No se encontró unidad orgánica en sigd_org.area');
    }

    const userRes = await pool.query<{ id_usuario: string; id_persona: string }>(
      'SELECT id_usuario, id_persona FROM sigd_auth.cuenta_usuario WHERE activo = true LIMIT 1',
    );
    usuarioActorId = userRes.rows[0]?.id_usuario || randomUUID();
    personaActorId = userRes.rows[0]?.id_persona || randomUUID();
  });

  afterAll(async () => {
    // Limpieza segura en orden inverso de dependencias FK
    if (idsCreados.notificaciones.size > 0) {
      const arr = Array.from(idsCreados.notificaciones);
      await pool.query('DELETE FROM sigd_auth.notificacion_trazabilidad_evento WHERE notificacion_id = ANY($1::uuid[])', [arr]).catch(() => {});
      await pool.query('DELETE FROM sigd_auth.notificacion_casilla WHERE id = ANY($1::uuid[])', [arr]).catch(() => {});
    }

    if (idsCreados.eventosOutbox.size > 0) {
      const arr = Array.from(idsCreados.eventosOutbox);
      await pool.query('DELETE FROM sigd_audit.evento_outbox WHERE id_evento = ANY($1::uuid[])', [arr]).catch(() => {});
    }

    if (idsCreados.documentos.size > 0) {
      const arr = Array.from(idsCreados.documentos);
      await pool.query('DELETE FROM sigd_doc.firma_digital_documento WHERE documento_id = ANY($1::uuid[])', [arr]).catch(() => {});
      await pool.query('DELETE FROM sigd_doc.documento_adjunto WHERE documento_adjunto_id = ANY($1::uuid[])', [arr]).catch(() => {});
    }

    if (idsCreados.expedientes.size > 0) {
      const arr = Array.from(idsCreados.expedientes);
      await pool.query('DELETE FROM sigd_rut.expediente_observacion WHERE expediente_id = ANY($1::uuid[])', [arr]).catch(() => {});
      await pool.query('DELETE FROM sigd_rut.movimiento_tramite WHERE expediente_id = ANY($1::uuid[])', [arr]).catch(() => {});
      await pool.query('DELETE FROM sigd_rut.estado_actual_expediente WHERE expediente_id = ANY($1::uuid[])', [arr]).catch(() => {});
      await pool.query('DELETE FROM sigd_tra.expediente WHERE expediente_id = ANY($1::uuid[])', [arr]).catch(() => {});
    }

    if (idsCreados.cuentas.size > 0) {
      const arr = Array.from(idsCreados.cuentas);
      await pool.query('DELETE FROM sigd_auth.cuenta_usuario WHERE id_usuario = ANY($1::uuid[])', [arr]).catch(() => {});
    }

    if (idsCreados.personas.size > 0) {
      const arr = Array.from(idsCreados.personas);
      await pool.query('DELETE FROM sigd_auth.persona_natural WHERE id_persona = ANY($1::uuid[])', [arr]).catch(() => {});
      await pool.query('DELETE FROM sigd_auth.persona WHERE id_persona = ANY($1::uuid[])', [arr]).catch(() => {});
    }

    await pool.end();
  });

  // Helpers de fixtures
  async function crearPersonaTest(sufijo: string): Promise<string> {
    const personaId = randomUUID();
    const dni = String(Math.floor(10000000 + Math.random() * 90000000));
    await pool.query(
      `INSERT INTO sigd_auth.persona (id_persona, tipo, id_documento, creado_en)
       VALUES ($1, 'NATURAL', $2, now())`,
      [personaId, dni],
    );
    await pool.query(
      `INSERT INTO sigd_auth.persona_natural (id_persona, nombres, apellidos, nombre_completo, correo)
       VALUES ($1, $2, $3, $4, $5)`,
      [personaId, `Ciudadano_${sufijo}`, `Prueba_${sufijo}`, `Ciudadano_${sufijo} Prueba_${sufijo}`, `ciudadano_${sufijo}@test.pe`],
    );
    idsCreados.personas.add(personaId);
    return personaId;
  }

  async function crearCuentaTest(personaId: string, username: string): Promise<string> {
    const usuarioId = randomUUID();
    const usuarioValido = username.substring(0, 50);
    await pool.query(
      `INSERT INTO sigd_auth.cuenta_usuario (id_usuario, id_persona, usuario, correo, password_hash, activo, creado_en)
       VALUES ($1, $2, $3, $4, '$argon2id$v=19$m=65536,t=3,p=4$fake_hash_for_test', true, now())`,
      [usuarioId, personaId, usuarioValido, `${usuarioValido}@test.pe`],
    );
    idsCreados.cuentas.add(usuarioId);
    return usuarioId;
  }

  async function crearExpedienteTest(solicitanteId: string, estadoInicial: string, cutPersonalizado?: string): Promise<{ expedienteId: string; cut: string }> {
    const expedienteId = randomUUID();
    const cut = cutPersonalizado || `EXP-2026-${Math.floor(100000 + Math.random() * 900000)}`;
    await pool.query(
      `INSERT INTO sigd_tra.expediente (
         expediente_id, codigo_expediente, numero, tipo_documental_id, solicitante_id,
         area_destino_id, estado, fecha_radicacion
       ) VALUES ($1, $2, $2, $3, $4, $5, $6, now())`,
      [expedienteId, cut, tipoDocId, solicitanteId, areaId, estadoInicial],
    );
    idsCreados.expedientes.add(expedienteId);
    return { expedienteId, cut };
  }

  async function crearEvidenciaFirmaTest(expedienteId: string, solicitanteId: string): Promise<{ documentoId: string; cvd: string }> {
    const documentoId = randomUUID();
    const cvd = `CVD-5K-${Math.floor(100000 + Math.random() * 900000)}`;
    const shaFirmado = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

    await pool.query(
      `INSERT INTO sigd_doc.documento_adjunto (
         documento_adjunto_id, expediente_id, expediente_tra_id, tipo_documental_id,
         nombre_archivo, s3_bucket, s3_key, sha256, tamano_bytes, mime_type, subido_por, creado_en
       ) VALUES ($1, NULL, $2, $3, 'resolucion_firmada.pdf', 'sigd-expedientes', $4, $5, 2048, 'application/pdf', $6, now())`,
      [documentoId, expedienteId, tipoDocId, `expedientes/test/${documentoId}.pdf`, shaFirmado, solicitanteId],
    );

    await pool.query(
      `INSERT INTO sigd_doc.firma_digital_documento (
         documento_id, cvd, sha256_firmado, firmante, estado, fecha_registro,
         fecha_sello_tsa, s3_bucket, s3_key, algoritmo_firma, proveedor_firma, documento_version
       ) VALUES ($1, $2, $3, 'Director General IESTP Suiza', 'FIRMADO_DIGITALMENTE', now(), now(), 'sigd-expedientes', $4, 'SHA256withRSA', 'DNIE_TEST', 1)`,
      [documentoId, cvd, shaFirmado, `expedientes/test/${documentoId}.pdf`],
    );

    idsCreados.documentos.add(documentoId);
    return { documentoId, cvd };
  }

  // ===========================================================================
  // TC-5K-01: Expediente EN_FIRMA + firma válida -> resolver -> COMMIT
  // ===========================================================================
  it('TC-5K-01: Expediente en EN_FIRMA con firma válida resuelve y commitea exitosamente', async () => {
    const personaId = await crearPersonaTest('tc01');
    const { expedienteId, cut } = await crearExpedienteTest(personaId, 'EN_FIRMA');
    const { documentoId, cvd } = await crearEvidenciaFirmaTest(expedienteId, personaId);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const res = await runWithContext(
        { correlation_id: randomUUID(), usuario_id: usuarioActorId, ip_origen: '127.0.0.1', user_agent: 'vitest-5k' },
        async () => {
          return await resolverExpedienteConFirma(client, expedienteId, {
            resultado_resumen: 'Se aprueba expedición de diploma técnico profesional',
          });
        },
      );
      await client.query('COMMIT');
      expect(res.estado).toBe('RESUELTO');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }

    const checkExp = await pool.query<{ estado: string }>(
      'SELECT estado FROM sigd_tra.expediente WHERE expediente_id = $1::uuid',
      [expedienteId],
    );
    expect(checkExp.rows[0].estado).toBe('RESUELTO');
  });

  // ===========================================================================
  // TC-5K-02: Evento Outbox generado con subtipo = RESOLUCION_FIRMADA, estado = PENDIENTE, cut y persona_id
  // ===========================================================================
  it('TC-5K-02: Genera evento Outbox ExpedienteAtendido con subtipo RESOLUCION_FIRMADA, cut y persona_id', async () => {
    const personaId = await crearPersonaTest('tc02');
    const { expedienteId, cut } = await crearExpedienteTest(personaId, 'EN_FIRMA');
    const { documentoId, cvd } = await crearEvidenciaFirmaTest(expedienteId, personaId);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await runWithContext(
        { correlation_id: randomUUID(), usuario_id: usuarioActorId, ip_origen: '127.0.0.1', user_agent: 'vitest-5k' },
        async () => {
          await resolverExpedienteConFirma(client, expedienteId, {
            resultado_resumen: 'Aprobación de convalidación académica',
          });
        },
      );
      await client.query('COMMIT');
    } finally {
      client.release();
    }

    const resOutbox = await pool.query<{ id_evento: string; estado: string; payload: any }>(
      `SELECT id_evento, estado, payload
         FROM sigd_audit.evento_outbox
        WHERE (payload->'identidad'->>'expediente_id' = $1 OR payload->>'expediente_id' = $1)
          AND tipo_evento = 'ExpedienteAtendido'
        ORDER BY creado_en DESC LIMIT 1`,
      [expedienteId],
    );

    expect(resOutbox.rowCount).toBe(1);
    const evento = resOutbox.rows[0];
    idsCreados.eventosOutbox.add(evento.id_evento);

    expect(evento.estado).toBe('PENDIENTE');
    expect(evento.payload.subtipo).toBe('RESOLUCION_FIRMADA');
    expect(evento.payload.cut).toBe(cut);
    expect(evento.payload.persona_id).toBe(personaId);
    expect(evento.payload.cvd).toBe(cvd);
    expect(evento.payload.tipo_acto).toBe('RESOLUCION');
    // Confirma que no se filtró observacion_interna en payload ciudadano
    expect(evento.payload.observacion_interna).toBeUndefined();
  });

  // ===========================================================================
  // TC-5K-03: Procesamiento Worker Outbox PENDIENTE -> PROCESADO y creación de notificacion_casilla
  // ===========================================================================
  it('TC-5K-03: Worker procesa evento a PROCESADO y genera notificacion_casilla con estado PUESTA_A_DISPOSICION', async () => {
    const personaId = await crearPersonaTest('tc03');
    const usuarioId = await crearCuentaTest(personaId, `user_tc03_${Date.now()}`);
    const { expedienteId, cut } = await crearExpedienteTest(personaId, 'EN_FIRMA');
    const { documentoId, cvd } = await crearEvidenciaFirmaTest(expedienteId, personaId);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await runWithContext(
        { correlation_id: randomUUID(), usuario_id: usuarioActorId, ip_origen: '127.0.0.1', user_agent: 'vitest-5k' },
        async () => {
          await resolverExpedienteConFirma(client, expedienteId, {
            resultado_resumen: 'Resolución de trámite regular',
          });
        },
      );
      await client.query('COMMIT');
    } finally {
      client.release();
    }

    // Ejecutar ciclo del worker con DestinoCasilla real
    const despachador = new DestinoCasilla(pool);
    const worker = new OutboxWorker(pool, despachador, { lote: 10, maxIntentos: 3 });
    const procesados = await worker.ciclo();
    expect(procesados).toBeGreaterThanOrEqual(1);

    // Verificar en BD que la notificación fue creada en sigd_auth.notificacion_casilla
    const resNotif = await pool.query<{
      id: string;
      cut: string;
      usuario_id: string;
      persona_id: string;
      estado: string;
      tipo_acto: string;
    }>(
      `SELECT id, cut, usuario_id, persona_id, estado, tipo_acto
         FROM sigd_auth.notificacion_casilla
        WHERE cut = $1
        ORDER BY creado_en DESC LIMIT 1`,
      [cut],
    );

    expect(resNotif.rowCount).toBe(1);
    const notif = resNotif.rows[0];
    idsCreados.notificaciones.add(notif.id);

    expect(notif.cut).toBe(cut);
    expect(notif.persona_id).toBe(personaId);
    expect(notif.usuario_id).toBe(usuarioId);
    expect(notif.estado).toBe('PUESTA_A_DISPOSICION');
    expect(notif.tipo_acto).toBe('RESOLUCION');
  });

  // ===========================================================================
  // TC-5K-04: Trazabilidad WORM registrada exactamente una vez
  // ===========================================================================
  it('TC-5K-04: Trazabilidad WORM en notificacion_trazabilidad_evento registrada exactamente una vez', async () => {
    const personaId = await crearPersonaTest('tc04');
    const { expedienteId, cut } = await crearExpedienteTest(personaId, 'EN_FIRMA');
    await crearEvidenciaFirmaTest(expedienteId, personaId);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await runWithContext(
        { correlation_id: randomUUID(), usuario_id: usuarioActorId, ip_origen: '127.0.0.1', user_agent: 'vitest-5k' },
        async () => {
          await resolverExpedienteConFirma(client, expedienteId, {
            resultado_resumen: 'Resolución para auditoría WORM',
          });
        },
      );
      await client.query('COMMIT');
    } finally {
      client.release();
    }

    const worker = new OutboxWorker(pool, new DestinoCasilla(pool), { lote: 10 });
    await worker.ciclo();

    const notifRes = await pool.query<{ id: string }>(
      'SELECT id FROM sigd_auth.notificacion_casilla WHERE cut = $1 LIMIT 1',
      [cut],
    );
    expect(notifRes.rowCount).toBe(1);
    const notifId = notifRes.rows[0].id;
    idsCreados.notificaciones.add(notifId);

    const wormRes = await pool.query<{ tipo_evento: string; canal: string; estado: string }>(
      `SELECT tipo_evento, canal, estado
         FROM sigd_auth.notificacion_trazabilidad_evento
        WHERE notificacion_id = $1::uuid`,
      [notifId],
    );

    expect(wormRes.rowCount).toBe(1);
    expect(wormRes.rows[0].tipo_evento).toBe('PUESTA_A_DISPOSICION');
    expect(wormRes.rows[0].canal).toBe('CASILLA');
    expect(wormRes.rows[0].estado).toBe('REGISTRADO');
  });

  // ===========================================================================
  // TC-5K-05: Idempotencia - Reintento del mismo evento no duplica notificación ni trazabilidad
  // ===========================================================================
  it('TC-5K-05: Reintento del mismo evento Outbox no duplica filas en notificacion_casilla ni en trazabilidad WORM', async () => {
    const personaId = await crearPersonaTest('tc05');
    const cut = `CUT-IDEM-${Math.floor(100000 + Math.random() * 900000)}`;
    const idEvento = randomUUID();
    idsCreados.eventosOutbox.add(idEvento);

    const eventoFake: EventoPendiente = {
      id_evento: idEvento,
      correlation_id: randomUUID(),
      agregado: 'Expediente',
      tipo_evento: 'ExpedienteAtendido',
      payload: {
        cut,
        persona_id: personaId,
        tipo_acto: 'RESOLUCION',
        subtipo: 'RESOLUCION_FIRMADA',
        asunto: `Resolución Idempotente ${cut}`,
        resultado_resumen: 'Prueba de idempotencia estricta',
      },
      intentos: 0,
    };

    const destino = new DestinoCasilla(pool);

    // Primer despacho
    await destino.despachar(eventoFake);

    // Segundo despacho con idéntico evento (simulando reintento del worker)
    await destino.despachar(eventoFake);

    // Tercer despacho
    await destino.despachar(eventoFake);

    const resNotif = await pool.query<{ id: string }>(
      'SELECT id FROM sigd_auth.notificacion_casilla WHERE cut = $1',
      [cut],
    );
    expect(resNotif.rowCount).toBe(1);
    const notifId = resNotif.rows[0].id;
    idsCreados.notificaciones.add(notifId);

    const resWorm = await pool.query(
      'SELECT id FROM sigd_auth.notificacion_trazabilidad_evento WHERE notificacion_id = $1::uuid',
      [notifId],
    );
    expect(resWorm.rowCount).toBe(1);
  });

  // ===========================================================================
  // TC-5K-06: Persona sin cuenta -> persona_id válido y usuario_id = NULL
  // ===========================================================================
  it('TC-5K-06: Notificación para persona sin cuenta se crea con persona_id válido y usuario_id = NULL', async () => {
    const personaId = await crearPersonaTest('tc06_sin_cuenta');
    const cut = `CUT-NOC-${Math.floor(100000 + Math.random() * 900000)}`;
    const idEvento = randomUUID();
    idsCreados.eventosOutbox.add(idEvento);

    const evento: EventoPendiente = {
      id_evento: idEvento,
      correlation_id: randomUUID(),
      agregado: 'Expediente',
      tipo_evento: 'ExpedienteAtendido',
      payload: {
        cut,
        persona_id: personaId,
        tipo_acto: 'RESOLUCION',
        subtipo: 'RESOLUCION_FIRMADA',
        resultado_resumen: 'Resolución emitida para administrado sin cuenta',
      },
      intentos: 0,
    };

    const destino = new DestinoCasilla(pool);
    await destino.despachar(evento);

    const resNotif = await pool.query<{ id: string; persona_id: string; usuario_id: string | null }>(
      'SELECT id, persona_id, usuario_id FROM sigd_auth.notificacion_casilla WHERE cut = $1',
      [cut],
    );

    expect(resNotif.rowCount).toBe(1);
    const notif = resNotif.rows[0];
    idsCreados.notificaciones.add(notif.id);

    expect(notif.persona_id).toBe(personaId);
    expect(notif.usuario_id).toBeNull();
  });

  // ===========================================================================
  // TC-5K-07: Vinculación posterior de cuenta -> titular consulta notificación histórica
  // ===========================================================================
  it('TC-5K-07: Usuario que activa cuenta posteriormente consulta su notificación histórica vía persona_id', async () => {
    // 1. Notificación creada previamente cuando la persona no tenía cuenta
    const personaId = await crearPersonaTest('tc07_tardia');
    const cut = `CUT-HIST-${Math.floor(100000 + Math.random() * 900000)}`;
    const idEvento = randomUUID();
    idsCreados.eventosOutbox.add(idEvento);

    const evento: EventoPendiente = {
      id_evento: idEvento,
      correlation_id: randomUUID(),
      agregado: 'Expediente',
      tipo_evento: 'ExpedienteAtendido',
      payload: {
        cut,
        persona_id: personaId,
        tipo_acto: 'RESOLUCION',
        subtipo: 'RESOLUCION_FIRMADA',
        resultado_resumen: 'Resolución previa a creación de cuenta',
      },
      intentos: 0,
    };

    await new DestinoCasilla(pool).despachar(evento);

    // 2. Persona activa cuenta posteriormente
    const usuarioId = await crearCuentaTest(personaId, `user_tardio_${Date.now()}`);

    // 3. Ejecutar consulta canónica de Casilla Electrónica protegida
    const resConsulta = await pool.query<{ id: string; cut: string; usuario_id: string | null }>(
      `SELECT id, cut, usuario_id
         FROM sigd_auth.notificacion_casilla
        WHERE cut = $1
          AND (usuario_id = $2::uuid OR persona_id IN (
            SELECT id_persona FROM sigd_auth.cuenta_usuario WHERE id_usuario = $2::uuid
          ))`,
      [cut, usuarioId],
    );

    expect(resConsulta.rowCount).toBe(1);
    expect(resConsulta.rows[0].cut).toBe(cut);
    expect(resConsulta.rows[0].usuario_id).toBeNull(); // Inmutabilidad WORM del registro original
    idsCreados.notificaciones.add(resConsulta.rows[0].id);
  });

  // ===========================================================================
  // TC-5K-08: BOLA - Usuario B no puede acceder a notificación de Persona A
  // ===========================================================================
  it('TC-5K-08: BOLA - Usuario B no puede consultar la notificación de Persona A (DENY)', async () => {
    const personaA = await crearPersonaTest('tc08_a');
    const usuarioA = await crearCuentaTest(personaA, `user_a_${Date.now()}`);

    const personaB = await crearPersonaTest('tc08_b');
    const usuarioB = await crearCuentaTest(personaB, `user_b_${Date.now()}`);

    const cutA = `CUT-BOLA-${Math.floor(100000 + Math.random() * 900000)}`;
    const idEvento = randomUUID();
    idsCreados.eventosOutbox.add(idEvento);

    const eventoA: EventoPendiente = {
      id_evento: idEvento,
      correlation_id: randomUUID(),
      agregado: 'Expediente',
      tipo_evento: 'ExpedienteAtendido',
      payload: {
        cut: cutA,
        persona_id: personaA,
        usuario_id: usuarioA,
        tipo_acto: 'RESOLUCION',
        resultado_resumen: 'Documento confidencial de Persona A',
      },
      intentos: 0,
    };

    await new DestinoCasilla(pool).despachar(eventoA);

    const notifRes = await pool.query<{ id: string }>(
      'SELECT id FROM sigd_auth.notificacion_casilla WHERE cut = $1',
      [cutA],
    );
    const notifIdA = notifRes.rows[0].id;
    idsCreados.notificaciones.add(notifIdA);

    // Intento de acceso desde cuenta de Usuario B (ataque BOLA / Broken Object Level Authorization)
    const resAtaque = await pool.query(
      `SELECT id FROM sigd_auth.notificacion_casilla
        WHERE id = $1::uuid
          AND (usuario_id = $2::uuid OR persona_id IN (
            SELECT id_persona FROM sigd_auth.cuenta_usuario WHERE id_usuario = $2::uuid
          ))`,
      [notifIdA, usuarioB],
    );

    // Debe denegar absolutamente el acceso (0 filas)
    expect(resAtaque.rowCount).toBe(0);
  });

  // ===========================================================================
  // TC-5K-09: Observación EN_REVISION -> OBSERVADO -> Outbox -> Casilla
  // ===========================================================================
  it('TC-5K-09: Observación transiciona expediente a OBSERVADO, emite evento y entrega en Casilla', async () => {
    const personaId = await crearPersonaTest('tc09');
    const usuarioId = await crearCuentaTest(personaId, `user_tc09_${Date.now()}`);
    const { expedienteId, cut } = await crearExpedienteTest(personaId, 'EN_REVISION');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await runWithContext(
        { correlation_id: randomUUID(), usuario_id: usuarioActorId, ip_origen: '127.0.0.1', user_agent: 'vitest-5k' },
        async () => {
          await observarExpediente(
            client,
            expedienteId,
            'Se requiere presentar constancia original de no adeudo',
            { personaId: personaActorId, areaId },
          );
        },
      );
      await client.query('COMMIT');
    } finally {
      client.release();
    }

    // Comprobar estado en tabla expediente
    const resExp = await pool.query<{ estado: string }>(
      'SELECT estado FROM sigd_tra.expediente WHERE expediente_id = $1::uuid',
      [expedienteId],
    );
    expect(resExp.rows[0].estado).toBe('OBSERVADO');

    // Despachar con worker
    const worker = new OutboxWorker(pool, new DestinoCasilla(pool), { lote: 10 });
    await worker.ciclo();

    // Comprobar notificación en Casilla
    const resNotif = await pool.query<{
      id: string;
      cut: string;
      persona_id: string;
      tipo_acto: string;
      estado: string;
    }>(
      'SELECT id, cut, persona_id, tipo_acto, estado FROM sigd_auth.notificacion_casilla WHERE cut = $1',
      [cut],
    );

    expect(resNotif.rowCount).toBe(1);
    const notif = resNotif.rows[0];
    idsCreados.notificaciones.add(notif.id);

    expect(notif.cut).toBe(cut);
    expect(notif.persona_id).toBe(personaId);
    expect(notif.tipo_acto).toBe('NOTIFICACION_OBSERVACION');
    expect(notif.estado).toBe('PUESTA_A_DISPOSICION');
  });

  // ===========================================================================
  // TC-5K-10: Notificación de observación incluye motivo público y excluye datos privados
  // ===========================================================================
  it('TC-5K-10: Notificación de observación incluye motivo formal y excluye observacion_interna', async () => {
    const personaId = await crearPersonaTest('tc10');
    const { expedienteId, cut } = await crearExpedienteTest(personaId, 'EN_REVISION');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await runWithContext(
        { correlation_id: randomUUID(), usuario_id: usuarioActorId, ip_origen: '127.0.0.1', user_agent: 'vitest-5k' },
        async () => {
          await observarExpediente(
            client,
            expedienteId,
            'Falta sello de dirección en formulario único',
            { personaId: personaActorId, areaId },
          );
        },
      );
      await client.query('COMMIT');
    } finally {
      client.release();
    }

    await new OutboxWorker(pool, new DestinoCasilla(pool), { lote: 10 }).ciclo();

    const resNotif = await pool.query<{ id: string; cuerpo: any }>(
      'SELECT id, cuerpo FROM sigd_auth.notificacion_casilla WHERE cut = $1',
      [cut],
    );
    expect(resNotif.rowCount).toBe(1);
    const cuerpo = resNotif.rows[0].cuerpo;
    idsCreados.notificaciones.add(resNotif.rows[0].id);

    // Verifica que el motivo público esté presente
    expect(cuerpo.motivo).toBe('Falta sello de dirección en formulario único');
    // Verifica que observacion_interna NO esté presente
    expect(cuerpo.observacion_interna).toBeUndefined();
    expect(cuerpo.nota_interna).toBeUndefined();
    expect(cuerpo.deliberacion).toBeUndefined();
  });

  // ===========================================================================
  // TC-5K-11: Intento de resolución sin evidencia de firma es rechazado (DENY)
  // ===========================================================================
  it('TC-5K-11: Intento de resolver expediente sin evidencia canónica de firma es denegado', async () => {
    const personaId = await crearPersonaTest('tc11');
    const { expedienteId } = await crearExpedienteTest(personaId, 'EN_FIRMA');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await expect(
        runWithContext(
          { correlation_id: randomUUID(), usuario_id: usuarioActorId, ip_origen: '127.0.0.1', user_agent: 'vitest-5k' },
          async () => {
            await resolverExpedienteConFirma(client, expedienteId, {
              resultado_resumen: 'Intento de resolver sin firma',
            });
          },
        ),
      ).rejects.toThrow(ConflictError);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  // ===========================================================================
  // TC-5K-12: /atender no puede transicionar a RESUELTO sin firma válida
  // ===========================================================================
  it('TC-5K-12: Invocar atenderExpediente en EN_REVISION no puede producir RESUELTO sin firma previa', async () => {
    const personaId = await crearPersonaTest('tc12');
    const { expedienteId } = await crearExpedienteTest(personaId, 'EN_REVISION');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await expect(
        runWithContext(
          { correlation_id: randomUUID(), usuario_id: usuarioActorId, ip_origen: '127.0.0.1', user_agent: 'vitest-5k' },
          async () => {
            await atenderExpediente(client, expedienteId, {
              resultado_resumen: 'Intento de atención directa sin firma',
            });
          },
        ),
      ).rejects.toThrow(DomainError);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  // ===========================================================================
  // TC-5K-13: Transacción Postgres real con cuenta activa NO produce SQLSTATE 25P02
  // ===========================================================================
  it('TC-5K-13: Transacción Postgres real con cuenta activa commitea sin aborto 25P02', async () => {
    const personaId = await crearPersonaTest('tc13_cuenta_activa');
    await crearCuentaTest(personaId, `user_tc13_${Date.now()}`);
    const { expedienteId, cut } = await crearExpedienteTest(personaId, 'EN_FIRMA');
    await crearEvidenciaFirmaTest(expedienteId, personaId);

    const client = await pool.connect();
    let transaccionCompletada = false;
    try {
      await client.query('BEGIN');
      await runWithContext(
        { correlation_id: randomUUID(), usuario_id: usuarioActorId, ip_origen: '127.0.0.1', user_agent: 'vitest-5k' },
        async () => {
          await resolverExpedienteConFirma(client, expedienteId, {
            resultado_resumen: 'Resolución libre de error 25P02',
          });
        },
      );
      // Si hubiera ocurrido error silenciado en cliente.query dentro del bloque BEGIN, COMMIT lanzaría 25P02
      await client.query('COMMIT');
      transaccionCompletada = true;
    } catch (err: any) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }

    expect(transaccionCompletada).toBe(true);
    const resExp = await pool.query<{ estado: string }>(
      'SELECT estado FROM sigd_tra.expediente WHERE expediente_id = $1::uuid',
      [expedienteId],
    );
    expect(resExp.rows[0].estado).toBe('RESUELTO');
  });

  // ===========================================================================
  // TC-5K-14: Evento notificable malformado falla cerrado y no se marca PROCESADO falsamente
  // ===========================================================================
  it('TC-5K-14: Evento notificable con payload incompleto falla y no se marca PROCESADO falsamente', async () => {
    const idEvento = randomUUID();
    idsCreados.eventosOutbox.add(idEvento);

    // Evento notificable pero sin cut, sin persona_id, sin usuario_id, sin correo
    const eventoMalformado: EventoPendiente = {
      id_evento: idEvento,
      correlation_id: randomUUID(),
      agregado: 'Expediente',
      tipo_evento: 'ExpedienteAtendido',
      payload: {
        resultado_resumen: 'Evento sin destinatario resoluble',
      },
      intentos: 0,
    };

    const destino = new DestinoCasilla(pool);
    await expect(destino.despachar(eventoMalformado)).rejects.toThrow(
      /carece de destinatario resoluble/,
    );
  });

  // ===========================================================================
  // TC-5K-15: Evento irrelevante (ej. ExpedienteDerivado) es omitido limpiamente (SKIP)
  // ===========================================================================
  it('TC-5K-15: Evento irrelevante para casilla es omitido limpiamente sin registrar notificación', async () => {
    const idEvento = randomUUID();
    const cut = `CUT-SKIP-${Math.floor(100000 + Math.random() * 900000)}`;

    const eventoDerivado: EventoPendiente = {
      id_evento: idEvento,
      correlation_id: randomUUID(),
      agregado: 'Expediente',
      tipo_evento: 'ExpedienteDerivado',
      payload: {
        cut,
        area_destino_id: areaId,
      },
      intentos: 0,
    };

    const destino = new DestinoCasilla(pool);
    // Debe retornar limpiamente sin lanzar error
    await expect(destino.despachar(eventoDerivado)).resolves.toBeUndefined();

    // Comprobar que no se creó notificación en casilla
    const res = await pool.query(
      'SELECT id FROM sigd_auth.notificacion_casilla WHERE cut = $1',
      [cut],
    );
    expect(res.rowCount).toBe(0);
  });
});
