import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { obtenerAgente, limpiarAmbiente, cerrarAmbiente } from '../helpers/app.helper.js';
import { obtenerPool } from '../helpers/database.helper.js';
import { payloadRadicacionValido, PERSONA_E2E_ID } from '../helpers/payloads.helper.js';
import { firmarTokenAcceso } from '../../src/core/auth/jwt.service.js';

describe('E2E-04 · Derivación a área inexistente', () => {
  const secretoJwtE2E = 'sigd-e2e-only-signing-secret-not-for-production';
  let tokenAdministrador: string;

  beforeAll(async () => {
    await limpiarAmbiente();
    process.env.AUTH_JWT_SECRET = secretoJwtE2E;
    const cuenta = await obtenerPool().query(
      `INSERT INTO sigd_auth.cuenta_usuario
         (id_persona, usuario, correo, password_hash)
       VALUES ($1::uuid, $2, $3, '$argon2id$test')
       RETURNING id_usuario`,
      [PERSONA_E2E_ID, `e2e-admin-${randomUUID()}`, `${randomUUID()}@example.test`],
    );
    tokenAdministrador = firmarTokenAcceso({
      sub: cuenta.rows[0].id_usuario,
      roles: ['ADMINISTRADOR'],
    });
  });

  afterAll(async () => {
    await cerrarAmbiente();
  });

  it('no deriva y responde 400/404 cuando el área destino no existe', async () => {
    const radicado = await obtenerAgente()
      .post('/api/expedientes')
      .send(payloadRadicacionValido());
    expect(radicado.status).toBe(201);

    const areaInexistente = randomUUID();
    const respuesta = await obtenerAgente()
      .post('/api/expedientes/derivar')
      .set('Authorization', `Bearer ${tokenAdministrador}`)
      .send({
        expediente_id: radicado.body.expediente_id,
        area_destino_id: areaInexistente,
        proveido: 'Derivación a área inexistente',
      });

    expect([400, 404]).toContain(respuesta.status);
    expect(respuesta.body.code).toBeDefined();

    const movimientos = await obtenerPool().query(
      'SELECT id_movimiento FROM sigd_rut.movimiento_tramite WHERE expediente_id = $1',
      [radicado.body.expediente_id],
    );
    expect(movimientos.rowCount).toBe(0);
  });
});