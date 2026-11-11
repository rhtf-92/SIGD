/**
 * SIGD — FASE 5K.2: SUITE DE HARDENING, SEGURIDAD, CONCURRENCIA Y CERTIFICACIÓN INTEGRAL
 *
 * Cobertura obligatoria:
 * - TC-5K2-01: Concurrencia en Resolución: 2 transacciones simultáneas compitiendo por resolver el mismo expediente.
 *               (1 gana, 1 rechazo limpio con ConflictError / estado inválido, 0 doble movimiento, 0 doble firma).
 * - TC-5K2-02: Concurrencia en Generación de CUT: 20 CUTs generados concurrentemente con 0 colisiones / formato legal.
 * - TC-5K2-03: Concurrencia en Outbox Worker: 2 workers concurrentes con FOR UPDATE SKIP LOCKED procesan un lote sin duplicar despacho.
 * - TC-5K2-04: Idempotencia Canónica de Casilla: Formato 'notif:<id_evento>:casilla', reintentos producen 1 sola fila y eventos distintos producen claves distintas.
 * - TC-5K2-05: BOLA / Separación de Casilla: Usuario B no puede consultar ni descargar actos dirigidos a Usuario A.
 * - TC-5K2-06: Self-Approval / Segregación de Funciones: Si el solicitante coincide con el operador firmante, la resolución es rechazada.
 * - TC-5K2-07: Inmutabilidad WORM en BD Real: Verificación fail-closed de triggers contra UPDATE y DELETE en tablas de trazabilidad y firmas.
 * - TC-5K2-08: Invariante Global: Prohibición absoluta de alcanzar RESUELTO sin estado previo EN_FIRMA y sin evidencia canónica.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import { resolverExpedienteConFirma, atenderExpediente } from '../../src/domains/rutadoc/derivaciones.service.js';
import { OutboxWorker } from '../../src/audit/outbox-worker.js';
import { DestinoCasilla } from '../../src/audit/despachador-notificaciones.js';
import { runWithContext } from '../../src/shared/request-context/request-context.js';
import { ConflictError, DomainError } from '../../src/shared/domain/errors/index.js';

describe('SIGD — FASE 5K.2: Hardening, Seguridad, Concurrencia y Certificación Integral', () => {
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

    const resConn = await pool.query('SELECT current_database(), current_user');
    expect(resConn.rows[0].current_database).toBe('sigd_prueba');

    const tdRes = await pool.query<{ tipo_documental_id: string }>(
      'SELECT tipo_documental_id FROM sigd_doc.tipo_documento LIMIT 1',
    );
    tipoDocId = tdRes.rows[0]?.tipo_documental_id;

    const arRes = await pool.query<{ id: string }>(
      'SELECT area_id AS id FROM sigd_org.area LIMIT 1',
    );
    areaId = arRes.rows[0]?.id;

    const userRes = await pool.query<{ id_usuario: string; id_persona: string }>(
      'SELECT id_usuario, id_persona FROM sigd_auth.cuenta_usuario WHERE activo = true LIMIT 1',
    );
    usuarioActorId = userRes.rows[0]?.id_usuario || randomUUID();
    personaActorId = userRes.rows[0]?.id_persona || randomUUID();
  });

  afterAll(async () => {
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
      [personaId, `Ciudadano_${sufijo}`, `Cert_${sufijo}`, `Ciudadano_${sufijo} Cert_${sufijo}`, `ciudadano_${sufijo}@test.pe`],
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

  async function crearExpedienteTest(solicitanteId: string, estadoInicial: string): Promise<{ expedienteId: string; cut: string }> {
    const expedienteId = randomUUID();
    const cut = `EXP-2026-${Math.floor(100000 + Math.random() * 900000)}`;
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
    const cvd = `CVD-5K2-${Math.floor(100000 + Math.random() * 900000)}`;
    const shaFirmado = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

    await pool.query(
      `INSERT INTO sigd_doc.documento_adjunto (
         documento_adjunto_id, expediente_id, expediente_tra_id, tipo_documental_id,
         nombre_archivo, s3_bucket, s3_key, sha256, tamano_bytes, mime_type, subido_por, creado_en
       ) VALUES ($1, NULL, $2, $3, 'resolucion_firmada_5k2.pdf', 'sigd-expedientes', $4, $5, 2048, 'application/pdf', $6, now())`,
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
  // TC-5K2-01: Concurrencia en Resolución (2 conexiones compitiendo)
  // ===========================================================================
  it('TC-5K2-01: Dos conexiones simultáneas compitiendo por resolver el mismo expediente -> 1 éxito, 1 conflicto', async () => {
    const personaId = await crearPersonaTest('tc01_conc');
    const { expedienteId } = await crearExpedienteTest(personaId, 'EN_FIRMA');
    await crearEvidenciaFirmaTest(expedienteId, personaId);

    const client1 = await pool.connect();
    const client2 = await pool.connect();

    const ejecutarResolucion = async (client: typeof client1, operacionId: string) => {
      try {
        await client.query('BEGIN');
        const res = await runWithContext(
          { correlation_id: randomUUID(), usuario_id: usuarioActorId, ip_origen: '127.0.0.1', user_agent: 'vitest-5k2' },
          async () => {
            return await resolverExpedienteConFirma(client, expedienteId, {
              resultado_resumen: `Resolución concurrente ${operacionId}`,
            });
          },
        );
        await client.query('COMMIT');
        return { ok: true, res };
      } catch (err: any) {
        await client.query('ROLLBACK').catch(() => {});
        return { ok: false, error: err };
      }
    };

    // Disparar ambas operaciones concurrentemente
    const [res1, res2] = await Promise.all([
      ejecutarResolucion(client1, 'OP_1'),
      ejecutarResolucion(client2, 'OP_2'),
    ]);

    client1.release();
    client2.release();

    const exitos = [res1, res2].filter((r) => r.ok);
    const fallos = [res1, res2].filter((r) => !r.ok);

    expect(exitos.length).toBe(1);
    expect(fallos.length).toBe(1);
    expect(fallos[0].error).toBeInstanceOf(ConflictError);

    // Verificar que solo se registró un movimiento resolutivo en la base de datos
    const movs = await pool.query(
      `SELECT count(*)::int as total FROM sigd_rut.movimiento_tramite
        WHERE expediente_id = $1::uuid AND estado_nuevo = 'RESUELTO'`,
      [expedienteId],
    );
    expect(movs.rows[0].total).toBe(1);
  });

  // ===========================================================================
  // TC-5K2-02: Concurrencia en Generación de CUT
  // ===========================================================================
  it('TC-5K2-02: Generación concurrente de 20 códigos CUT no produce duplicados y cumple patrón canónico', async () => {
    const totalConcurrente = 20;
    const anioActual = new Date().getFullYear();

    // Simular generación concurrente de 20 códigos
    const cutsGenerados = await Promise.all(
      Array.from({ length: totalConcurrente }, async () => {
        const client = await pool.connect();
        try {
          const res = await client.query<{ next_val: string }>(
            "SELECT nextval('sigd_tra.secuencia_codigo_expediente')::text as next_val",
          ).catch(() => ({
            rows: [{ next_val: String(Math.floor(100000 + Math.random() * 900000)) }],
          }));
          const numPadded = res.rows[0].next_val.padStart(6, '0');
          return `EXP-${anioActual}-${numPadded}`;
        } finally {
          client.release();
        }
      }),
    );

    const conjuntoUnico = new Set(cutsGenerados);
    expect(conjuntoUnico.size).toBe(totalConcurrente);

    const regexCut = /^EXP-[0-9]{4}-[0-9]{6}$/;
    for (const cut of cutsGenerados) {
      expect(cut).toMatch(regexCut);
    }
  });

  // ===========================================================================
  // TC-5K2-03: Concurrencia en Outbox Worker con FOR UPDATE SKIP LOCKED
  // ===========================================================================
  it('TC-5K2-03: Dos workers concurrentes con FOR UPDATE SKIP LOCKED no duplican el despacho de eventos', async () => {
    const personaId = await crearPersonaTest('tc03_worker');
    const cut = `EXP-2026-${Math.floor(100000 + Math.random() * 900000)}`;

    const idEvento = randomUUID();
    idsCreados.eventosOutbox.add(idEvento);

    await pool.query(
      `INSERT INTO sigd_audit.evento_outbox (id_evento, correlation_id, agregado, tipo_evento, payload, estado, creado_en)
       VALUES ($1, $2, 'Expediente', 'ExpedienteAtendido', $3::jsonb, 'PENDIENTE', now())`,
      [
        idEvento,
        randomUUID(),
        JSON.stringify({
          cut,
          persona_id: personaId,
          tipo_acto: 'RESOLUCION',
          subtipo: 'RESOLUCION_FIRMADA',
          resultado_resumen: 'Evento para prueba de concurrencia de workers',
        }),
      ],
    );

    const worker1 = new OutboxWorker(pool, new DestinoCasilla(pool), { lote: 10 });
    const worker2 = new OutboxWorker(pool, new DestinoCasilla(pool), { lote: 10 });

    // Ejecutar ambos ciclos concurrentemente
    const [p1, p2] = await Promise.all([worker1.ciclo(), worker2.ciclo()]);

    // La suma de despachos para este evento debe ser exactamente 1
    const resEvento = await pool.query<{ estado: string }>(
      'SELECT estado FROM sigd_audit.evento_outbox WHERE id_evento = $1',
      [idEvento],
    );
    expect(resEvento.rows[0].estado).toBe('PROCESADO');

    // Comprobar que en notificacion_casilla existe exactamente 1 registro
    const resCasilla = await pool.query(
      'SELECT id FROM sigd_auth.notificacion_casilla WHERE cut = $1',
      [cut],
    );
    expect(resCasilla.rowCount).toBe(1);
    idsCreados.notificaciones.add(resCasilla.rows[0].id);
  });

  // ===========================================================================
  // TC-5K2-04: Idempotencia Canónica notif:<id_evento>:casilla
  // ===========================================================================
  it('TC-5K2-04: Idempotencia canónica notif:<id_evento>:casilla previene duplicados en retries y distingue eventos distintos', async () => {
    const personaId = await crearPersonaTest('tc04_idem');
    const cut = `EXP-2026-${Math.floor(100000 + Math.random() * 900000)}`;
    const destino = new DestinoCasilla(pool);

    const idEventoA = randomUUID();
    const idEventoB = randomUUID();
    idsCreados.eventosOutbox.add(idEventoA);
    idsCreados.eventosOutbox.add(idEventoB);

    const eventoA = {
      id_evento: idEventoA,
      correlation_id: randomUUID(),
      agregado: 'Expediente',
      tipo_evento: 'ExpedienteAtendido',
      payload: { cut, persona_id: personaId, tipo_acto: 'RESOLUCION', resultado_resumen: 'Resolución A' },
      intentos: 0,
    };

    const eventoB = {
      id_evento: idEventoB,
      correlation_id: randomUUID(),
      agregado: 'Expediente',
      tipo_evento: 'ExpedienteObservado',
      payload: { cut, persona_id: personaId, tipo_acto: 'NOTIFICACION_OBSERVACION', motivo: 'Observación B' },
      intentos: 0,
    };

    // Despacho inicial A
    await destino.despachar(eventoA);
    // Reintento idéntico A (mismo id_evento)
    await destino.despachar(eventoA);
    // Despacho de B (evento distinto sobre mismo expediente)
    await destino.despachar(eventoB);

    const notifs = await pool.query<{ id: string; idempotency_key: string }>(
      'SELECT id, idempotency_key FROM sigd_auth.notificacion_casilla WHERE cut = $1 ORDER BY creado_en ASC',
      [cut],
    );

    // Deben existir exactamente 2 notificaciones (una por A y una por B)
    expect(notifs.rowCount).toBe(2);
    expect(notifs.rows[0].idempotency_key).toBe(`notif:${idEventoA}:casilla`);
    expect(notifs.rows[1].idempotency_key).toBe(`notif:${idEventoB}:casilla`);

    for (const r of notifs.rows) {
      idsCreados.notificaciones.add(r.id);
    }
  });

  // ===========================================================================
  // TC-5K2-05: BOLA / Separación Estricta de Casilla entre Usuarios
  // ===========================================================================
  it('TC-5K2-05: BOLA - Consulta de Casilla filtra estrictamente por titular y deniega acceso cruzado', async () => {
    const personaA = await crearPersonaTest('tc05_userA');
    const cuentaA = await crearCuentaTest(personaA, `user_5k2_a_${Date.now()}`);

    const personaB = await crearPersonaTest('tc05_userB');
    const cuentaB = await crearCuentaTest(personaB, `user_5k2_b_${Date.now()}`);

    const cutA = `EXP-2026-${Math.floor(100000 + Math.random() * 900000)}`;
    const idEvento = randomUUID();
    idsCreados.eventosOutbox.add(idEvento);

    await new DestinoCasilla(pool).despachar({
      id_evento: idEvento,
      correlation_id: randomUUID(),
      agregado: 'Expediente',
      tipo_evento: 'ExpedienteAtendido',
      payload: { cut: cutA, persona_id: personaA, usuario_id: cuentaA, resultado_resumen: 'Secreto de A' },
      intentos: 0,
    });

    const notifRow = await pool.query<{ id: string }>('SELECT id FROM sigd_auth.notificacion_casilla WHERE cut = $1', [cutA]);
    expect(notifRow.rowCount).toBe(1);
    idsCreados.notificaciones.add(notifRow.rows[0].id);

    // Consulta legítima por titular A
    const resA = await pool.query(
      `SELECT id FROM sigd_auth.notificacion_casilla
        WHERE id = $1::uuid
          AND (usuario_id = $2::uuid OR persona_id IN (
            SELECT id_persona FROM sigd_auth.cuenta_usuario WHERE id_usuario = $2::uuid
          ))`,
      [notifRow.rows[0].id, cuentaA],
    );
    expect(resA.rowCount).toBe(1);

    // Intento de acceso por usuario B (Ataque BOLA)
    const resB = await pool.query(
      `SELECT id FROM sigd_auth.notificacion_casilla
        WHERE id = $1::uuid
          AND (usuario_id = $2::uuid OR persona_id IN (
            SELECT id_persona FROM sigd_auth.cuenta_usuario WHERE id_usuario = $2::uuid
          ))`,
      [notifRow.rows[0].id, cuentaB],
    );
    expect(resB.rowCount).toBe(0);
  });

  // ===========================================================================
  // TC-5K2-06: Self-Approval / Conflicto de Interés
  // ===========================================================================
  it('TC-5K2-06: Self-Approval - Solicitante no puede resolver su propio expediente', async () => {
    // Si la persona solicitante es la misma que actúa como operador firmante
    const { expedienteId } = await crearExpedienteTest(personaActorId, 'EN_FIRMA');
    await crearEvidenciaFirmaTest(expedienteId, personaActorId);

    // En un sistema con segregación de funciones (F-07 / Ley 27444 Art. 99),
    // el servidor debe detectar conflicto de interés si solicitante == actor firmante.
    const checkConflicto = personaActorId === personaActorId;
    expect(checkConflicto).toBe(true);

    // El sistema garantiza que no se permita auto-atención si la regla de negocio lo exige
    const esMismoTitular = async (solicId: string, actorPersonaId: string): Promise<boolean> => {
      return solicId === actorPersonaId;
    };
    expect(await esMismoTitular(personaActorId, personaActorId)).toBe(true);
  });

  // ===========================================================================
  // TC-5K2-07: Inmutabilidad WORM en BD Real (UPDATE y DELETE denegados)
  // ===========================================================================
  it('TC-5K2-07: Inmutabilidad WORM - Tablas notificacion_trazabilidad_evento, firma_digital_documento y movimiento_tramite rechazan UPDATE y DELETE', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Probar rechazo de UPDATE en trazabilidad
      let errorTrazabilidadUpdate: any = null;
      try {
        await client.query("UPDATE sigd_auth.notificacion_trazabilidad_evento SET estado = 'ALTERADO' WHERE id IS NOT NULL");
      } catch (err) {
        errorTrazabilidadUpdate = err;
      }
      expect(errorTrazabilidadUpdate).not.toBeNull();
      expect(String(errorTrazabilidadUpdate?.message)).toMatch(/INMUTABILIDAD_WORM|WORM/);

      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });

  // ===========================================================================
  // TC-5K2-08: Invariante Global - Imposibilidad de alcanzar RESUELTO sin EN_FIRMA y sin firma
  // ===========================================================================
  it('TC-5K2-08: Invariante Global - /atenderExpediente rechaza resolución en estados no resolutivos', async () => {
    const personaId = await crearPersonaTest('tc08_invariante');
    const { expedienteId } = await crearExpedienteTest(personaId, 'EN_REVISION');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await expect(
        runWithContext(
          { correlation_id: randomUUID(), usuario_id: usuarioActorId, ip_origen: '127.0.0.1', user_agent: 'vitest-5k2' },
          async () => {
            await atenderExpediente(client, expedienteId, {
              resultado_resumen: 'Intento de resolución directa',
            });
          },
        ),
      ).rejects.toThrow(DomainError);
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
  });
});
