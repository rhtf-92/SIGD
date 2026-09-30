import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { obtenerAgente, limpiarAmbiente, cerrarAmbiente } from '../helpers/app.helper.js';
import { obtenerPool } from '../helpers/database.helper.js';
import { payloadRadicacionValido } from '../helpers/payloads.helper.js';

/** Funcionario con facultad de despacho vigente, sembrado para esta suite. */
const DIRECTOR_ID = '11111111-1111-4111-8111-111111111111';
/** Identidad valida a la que el plan no le reconoce facultad de despacho. */
const SIN_FACULTAD_ID = '33333333-3333-4333-8333-333333333333';

const HASH_ARGON2 = '$argon2id$v=19$m=65536,t=3,p=4$e2e$e2e';

async function sembrarFuncionario(idUsuario: string, rolCodigo: string | null): Promise<void> {
  const pool = obtenerPool();
  await pool.query(
    `INSERT INTO sigd_auth.persona (id_persona, tipo, id_documento)
     VALUES ($1, 'NATURAL', $2)
     ON CONFLICT DO NOTHING`,
    [idUsuario, `E2E-${idUsuario.slice(0, 8)}`],
  );
  await pool.query(
    `INSERT INTO sigd_auth.cuenta_usuario (id_usuario, id_persona, usuario, correo, password_hash)
     VALUES ($1, $1, $2, $3, $4)
     ON CONFLICT DO NOTHING`,
    [idUsuario, `e2e_${idUsuario.slice(0, 8)}`, `e2e_${idUsuario.slice(0, 8)}@e2e.local`, HASH_ARGON2],
  );

  if (rolCodigo === null) return;
  await pool.query(
    `INSERT INTO sigd_org.rol_sistema (codigo, nombre) VALUES ($1, $1)
     ON CONFLICT (codigo) DO NOTHING`,
    [rolCodigo],
  );
  await pool.query(
    `INSERT INTO sigd_org.usuario_rol (id_usuario, rol_id)
     SELECT $1, rol_id FROM sigd_org.rol_sistema WHERE codigo = $2
     ON CONFLICT DO NOTHING`,
    [idUsuario, rolCodigo],
  );
}

describe('E2E-13 · Versionado canónico /api/v1, alias legado y sondas', () => {
  beforeAll(async () => {
    await limpiarAmbiente();
    await sembrarFuncionario(DIRECTOR_ID, 'DIRECTOR');
    await sembrarFuncionario(SIN_FACULTAD_ID, 'CIUDADANO');
  });

  afterAll(async () => {
    await cerrarAmbiente();
  });

  it('GET /health responde 200 con el estado de las dependencias', async () => {
    const respuesta = await obtenerAgente().get('/health');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.status).toBe('ok');
    expect(respuesta.body.dependencias.postgres.estado).toBe('ok');
    expect(respuesta.body.dependencias.postgres.detalle).toMatch(/PostgreSQL/i);
  });

  it('GET /ready responde 200 cuando PostgreSQL está disponible', async () => {
    const respuesta = await obtenerAgente().get('/ready');

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.status).toBe('ok');
    expect(respuesta.body.dependencias.postgres.estado).toBe('ok');
  });

  it('sirve la referencia bajo el prefijo canónico /api/v1', async () => {
    const radicado = await obtenerAgente()
      .post('/api/v1/expedientes')
      .send(await payloadRadicacionValido());

    expect(radicado.status).toBe(201);
    expect(radicado.body.expediente_id).toBeDefined();
  });

  it('conserva el prefijo legado /api con Warning 299 de deprecación', async () => {
    const radicado = await obtenerAgente()
      .post('/api/expedientes')
      .send(await payloadRadicacionValido());

    expect(radicado.status).toBe(201);
    expect(radicado.headers['warning']).toMatch(/^299/);
    expect(radicado.headers['warning']).toMatch(/\/api\/v1/);
  });

  it('NO expone las sondas bajo el prefijo versionado', async () => {
    const respuesta = await obtenerAgente().get('/api/v1/health');

    expect(respuesta.status).toBe(404);
  });

  it('exige identidad autenticada en la cola de firma', async () => {
    // El plan (§4.8, endpoint #56) distingue las dos barreras: 401 cuando no
    // hay identidad verificable y 403 `USER_CANNOT_SIGN` cuando la identidad es
    // valida pero carece de facultad de despacho. Un solicitante anonimo no
    // llega a la comprobacion de facultad, asi que corresponde 401.
    const sinIdentidad = await obtenerAgente().get('/api/v1/firma/pendientes');
    expect(sinIdentidad.status).toBe(401);

    const conIdentidad = await obtenerAgente()
      .get('/api/v1/firma/pendientes')
      .set('x-usuario-id', DIRECTOR_ID);
    expect(conIdentidad.status).toBe(200);
    expect(conIdentidad.body.documentos).toEqual([]);
    expect(conIdentidad.body.total).toBe(0);
  });

  it('devuelve 403 USER_CANNOT_SIGN a una identidad valida sin facultad de despacho', async () => {
    const respuesta = await obtenerAgente()
      .get('/api/v1/firma/pendientes')
      .set('x-usuario-id', SIN_FACULTAD_ID);

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.code).toBe('USER_CANNOT_SIGN');
  });

  it('rechaza parámetros de consulta fuera del contrato de la cola de firma', async () => {
    const respuesta = await obtenerAgente()
      .get('/api/v1/firma/pendientes?porPagina=1000')
      .set('x-usuario-id', DIRECTOR_ID);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.type).toBeDefined();
  });

  it('mantiene la protección de rutas de la referencia bajo el prefijo canónico', async () => {
    const sinCredencial = await obtenerAgente().get('/api/v1/protegido');
    expect(sinCredencial.status).toBe(401);

    const conCredencial = await obtenerAgente().get('/api/v1/protegido').set('x-auth', 'test');
    expect(conCredencial.status).toBe(200);
    expect(conCredencial.body.ok).toBe(true);
  });

  it('no marca deprecación las rutas canónicas', async () => {
    const radicado = await obtenerAgente()
      .post('/api/v1/expedientes')
      .send(await payloadRadicacionValido());

    expect(radicado.status).toBe(201);
    expect(radicado.headers['warning']).toBeUndefined();
  });
});
