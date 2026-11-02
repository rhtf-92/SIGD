import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { obtenerAgente, limpiarAmbiente, cerrarAmbiente } from '../helpers/app.helper.js';
import { obtenerPool } from '../helpers/database.helper.js';
import { AREA_E2E_ID, payloadRadicacionValido, PERSONA_E2E_ID } from '../helpers/payloads.helper.js';
import { firmarTokenAcceso } from '../../src/core/auth/jwt.service.js';

describe('E2E-05 · Transición Mesa de Partes → Jefatura', () => {
  const secretoJwtE2E = 'sigd-e2e-only-signing-secret-not-for-production';
  let tokenAdministrador: string;
  let tokenCiudadanoAjeno: string;
  let tokenOperadorFueraArea: string;
  let idUsuarioAdministrador: string;

  beforeAll(async () => {
    await limpiarAmbiente();
    process.env.AUTH_JWT_SECRET = secretoJwtE2E;
    const pool = obtenerPool();
    const administrador = await pool.query(
      `INSERT INTO sigd_auth.cuenta_usuario
         (id_persona, usuario, correo, password_hash)
       VALUES ($1::uuid, $2, $3, '$argon2id$test')
       RETURNING id_usuario`,
      [PERSONA_E2E_ID, `e2e-admin-${randomUUID()}`, `${randomUUID()}@example.test`],
    );
    idUsuarioAdministrador = administrador.rows[0].id_usuario;
    tokenAdministrador = firmarTokenAcceso({
      sub: idUsuarioAdministrador,
      roles: ['ADMINISTRADOR'],
    });

    const personaAjena = await pool.query(
      `INSERT INTO sigd_auth.persona (tipo, id_documento)
       VALUES ('NATURAL', $1) RETURNING id_persona`,
      [randomUUID().replaceAll('-', '').slice(0, 20)],
    );
    const ciudadanoAjeno = await pool.query(
      `INSERT INTO sigd_auth.cuenta_usuario
         (id_persona, usuario, correo, password_hash)
       VALUES ($1::uuid, $2, $3, '$argon2id$test')
       RETURNING id_usuario`,
      [personaAjena.rows[0].id_persona, `e2e-ciudadano-${randomUUID()}`, `${randomUUID()}@example.test`],
    );
    tokenCiudadanoAjeno = firmarTokenAcceso({
      sub: ciudadanoAjeno.rows[0].id_usuario,
      roles: ['CIUDADANO'],
    });
    tokenOperadorFueraArea = firmarTokenAcceso({
      sub: ciudadanoAjeno.rows[0].id_usuario,
      roles: ['MESA_PARTES'],
    });
  });

  afterAll(async () => {
    await cerrarAmbiente();
  });

  it('deriva a un área vigente y registra el movimiento (200 OK)', async () => {
    const pool = obtenerPool();
    const area = await pool.query(
      'INSERT INTO sigd_org.area (codigo, nombre, vigente) VALUES ($1, $2, true) RETURNING area_id',
      [`E2E${randomUUID().replaceAll('-', '').slice(0, 12)}`, 'Jefatura'],
    );
    const areaId = area.rows[0].area_id;

    const radicado = await obtenerAgente().post('/api/expedientes').send(payloadRadicacionValido());
    expect(radicado.status).toBe(201);

    const respuesta = await obtenerAgente()
      .post('/api/expedientes/derivar')
      .set('Authorization', `Bearer ${tokenAdministrador}`)
      .send({
        expediente_id: radicado.body.expediente_id,
        area_destino_id: areaId,
        proveido: 'Derivación a Jefatura para atención',
      });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.ok).toBe(true);

    const movimiento = await pool.query(
      `SELECT id_movimiento, estado_anterior, evento, estado_nuevo,
              usuario_operador_id, fecha_hora, datos
         FROM sigd_rut.movimiento_tramite
        WHERE expediente_id = $1::uuid
          AND datos->>'areaId' = $2`,
      [radicado.body.expediente_id, areaId],
    );
    expect(movimiento.rowCount).toBe(1);
    expect(movimiento.rows[0].estado_anterior).toBe('EN_CALIFICACION');
    expect(movimiento.rows[0].evento).toBe('DERIVACION');
    expect(movimiento.rows[0].estado_nuevo).toBe('DERIVADO');
    expect(movimiento.rows[0].fecha_hora).toBeInstanceOf(Date);
    expect(BigInt(movimiento.rows[0].usuario_operador_id)).toBeGreaterThan(1n);
    expect(movimiento.rows[0].datos).toMatchObject({
      areaId: areaId,
      proveido: 'Derivación a Jefatura para atención',
      areaOrigenId: AREA_E2E_ID,
    });

    const estadoActual = await pool.query(
      `SELECT estado_nuevo, area_actual_id
         FROM sigd_rut.estado_actual_expediente
        WHERE expediente_id = $1::uuid`,
      [radicado.body.expediente_id],
    );
    expect(estadoActual.rows[0]).toMatchObject({
      estado_nuevo: 'DERIVADO',
      area_actual_id: areaId,
    });

    const expediente = await pool.query(
      'SELECT estado, area_destino_id FROM sigd_tra.expediente WHERE expediente_id = $1::uuid',
      [radicado.body.expediente_id],
    );
    expect(expediente.rows[0]).toMatchObject({
      estado: 'DERIVADO',
      area_destino_id: areaId,
    });

    const auditado = await pool.query(
      'SELECT id_auditoria FROM sigd_audit.bitacora_auditoria WHERE esquema = $1 AND tabla = $2',
      ['sigd_rut', 'movimiento_tramite'],
    );
    expect(auditado.rowCount).toBe(1);
  });

  it('rechaza derivación a área no vigente', async () => {
    const pool = obtenerPool();
    const area = await pool.query(
      'INSERT INTO sigd_org.area (codigo, nombre, vigente) VALUES ($1, $2, false) RETURNING area_id',
      [`E2E${randomUUID().replaceAll('-', '').slice(0, 12)}`, 'Área inactiva'],
    );

    const radicado = await obtenerAgente().post('/api/expedientes').send(payloadRadicacionValido());

    const respuesta = await obtenerAgente()
      .post('/api/expedientes/derivar')
      .set('Authorization', `Bearer ${tokenAdministrador}`)
      .send({
        expediente_id: radicado.body.expediente_id,
        area_destino_id: area.rows[0].area_id,
        proveido: 'Derivación a área no vigente',
      });

    expect([400, 404]).toContain(respuesta.status);
  });

  it('deniega a un ciudadano ajeno antes de registrar movimiento (BOLA)', async () => {
    const pool = obtenerPool();
    const radicado = await obtenerAgente().post('/api/expedientes').send(payloadRadicacionValido());
    const area = await pool.query(
      'INSERT INTO sigd_org.area (codigo, nombre, vigente) VALUES ($1, $2, true) RETURNING area_id',
      [`E2E${randomUUID().replaceAll('-', '').slice(0, 12)}`, 'Área destino BOLA'],
    );

    const anonimo = await obtenerAgente()
      .post('/api/expedientes/derivar')
      .send({
        expediente_id: radicado.body.expediente_id,
        area_destino_id: area.rows[0].area_id,
        proveido: 'Intento anónimo',
      });
    expect(anonimo.status).toBe(401);

    const respuesta = await obtenerAgente()
      .post('/api/expedientes/derivar')
      .set('Authorization', `Bearer ${tokenCiudadanoAjeno}`)
      .send({
        expediente_id: radicado.body.expediente_id,
        area_destino_id: area.rows[0].area_id,
        proveido: 'Intento de derivación no autorizado',
      });

    expect(respuesta.status).toBe(403);
    const operadorFueraArea = await obtenerAgente()
      .post('/api/expedientes/derivar')
      .set('Authorization', `Bearer ${tokenOperadorFueraArea}`)
      .send({
        expediente_id: radicado.body.expediente_id,
        area_destino_id: area.rows[0].area_id,
        proveido: 'Intento fuera del área de custodia',
      });
    expect(operadorFueraArea.status).toBe(403);

    const movimientos = await pool.query(
      'SELECT count(*)::int AS cantidad FROM sigd_rut.movimiento_tramite WHERE expediente_id = $1::uuid',
      [radicado.body.expediente_id],
    );
    expect(movimientos.rows[0].cantidad).toBe(0);
  });
});