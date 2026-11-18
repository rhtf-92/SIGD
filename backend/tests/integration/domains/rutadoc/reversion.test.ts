import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { construirApp } from '../../../../src/app.js';
import { RepositorioReversionRutaDoc } from '../../../../src/domains/rutadoc/rutadoc.reversion.repository.js';
import { FolioCompensationPostgres } from '../../../../src/domains/rutadoc/rutadoc.folio-compensation.js';
import type { ActorRutaDoc } from '../../../../src/domains/rutadoc/rutadoc.types.js';

const actor: ActorRutaDoc = { id: '7', roles: ['SUPER_ADMIN'], puedeVerExpediente: () => true };
const AREA_ORIGEN = 'e203345b-1e6a-4743-803b-c886c32e4d77';
const AREA_DESTINO = '30cc4c31-09ac-4ec1-a7fb-083348ad2d01';
const ruta = (id: number) => `/api/v1/expedientes/${id}/revertir-actuacion`;
const cuerpo = (movimientoObjetivoId = '2', claveIdempotencia = randomUUID()) => ({
  movimientoObjetivoId, motivo: 'Se corrige una actuación administrativa.', claveIdempotencia,
});

let contenedor: StartedPostgreSqlContainer;
let pool: Pool;

async function crearExpediente(id: number) {
  await pool.query('INSERT INTO sigd_tra.tramite (id_tramite, asunto, fk_remitente) VALUES ($1, $2, 80)',
    [id, `Asunto ${id}`]);
  await pool.query(`INSERT INTO sigd_tra.expediente
    (id_expediente, codigo_expediente, fk_tramite, creado_en)
    VALUES ($1, $2, $1, '2026-09-24T09:00:00Z')`, [id, `EXP-${id}`]);
  await pool.query(`INSERT INTO sigd_rut.movimiento_tramite
    (expediente_id, estado_anterior, evento, estado_nuevo, usuario_operador_id, fecha_hora, datos)
    VALUES ($1, 'REGISTRADO', 'RECEPCION', 'RECEPCIONADO', 7, '2026-09-24T10:00:00.123Z', '{}'::jsonb),
           ($1, 'RECEPCIONADO', 'INICIAR_CALIFICACION', 'EN_CALIFICACION', 7,
            '2026-09-24T10:01:00.456Z',
            CASE WHEN $1 = 107 THEN jsonb_build_object('areaId', $2::text) ELSE '{}'::jsonb END)`,
  [id, AREA_ORIGEN]);
}

async function cantidades(id: number) {
  const resultado = await pool.query<{ normales: number; compensatorios: number; identidades: number; secuencia: string }>(`
    SELECT (SELECT count(*)::integer FROM sigd_rut.movimiento_tramite WHERE expediente_id = $1) normales,
           (SELECT count(*)::integer FROM sigd_rut.movimiento_compensatorio WHERE expediente_id = $1) compensatorios,
           (SELECT count(*)::integer FROM sigd_rut.movimiento_identidad WHERE expediente_id = $1) identidades,
           (SELECT ultima_secuencia::text FROM sigd_rut.movimiento_secuencia WHERE expediente_id = $1) secuencia`, [id]);
  return resultado.rows[0];
}

function app() {
  return construirApp(pool, {
    obtenerActorRutaDoc: () => actor,
    politicaReversionRutaDoc: () => true,
  });
}

describe('POST reversión RutaDoc en PostgreSQL 18 aislado', () => {
  beforeAll(async () => {
    contenedor = await new PostgreSqlContainer('postgres:18-alpine')
      .withDatabase('sigd_rutadoc_reversion').start();
    pool = new Pool({ connectionString: contenedor.getConnectionUri(), max: 10 });
    await pool.query(readFileSync(path.resolve(process.cwd(), 'migraciones/06_sigd_rut.sql'), 'utf8'));
    // Contrato externo mínimo sólo en el contenedor efímero.
    await pool.query(`CREATE SCHEMA sigd_tra;
      CREATE TABLE sigd_tra.tramite (
        id_tramite BIGINT PRIMARY KEY, asunto TEXT NOT NULL, fk_remitente BIGINT NOT NULL);
      CREATE TABLE sigd_tra.expediente (
        id_expediente BIGINT PRIMARY KEY, codigo_expediente TEXT NOT NULL,
        fk_tramite BIGINT NOT NULL, creado_en TIMESTAMPTZ NOT NULL)`);
    await pool.query(readFileSync(path.resolve(process.cwd(), 'migraciones/06_sigd_rut.sql'), 'utf8'));
    for (const id of [101, 102, 103, 104, 105, 106, 107, 108, 109, 110]) await crearExpediente(id);
    await pool.query(`INSERT INTO sigd_rut.movimiento_tramite
      (expediente_id, estado_anterior, evento, estado_nuevo, usuario_operador_id, datos)
      VALUES (107, 'EN_CALIFICACION', 'DERIVACION', 'DERIVADO', 7,
              jsonb_build_object('areaId', $1::text))`, [AREA_DESTINO]);
  });

  afterAll(async () => {
    await pool?.end();
    await contenedor?.stop();
  });

  it('adquiere advisory lock transaccional en el mismo cliente y no bloquea otro expediente', async () => {
    const repo = new RepositorioReversionRutaDoc(pool);
    await repo.conBloqueo('101', async (cliente) => {
      const bloqueo = await cliente.query<{ bloqueado: boolean; transaccion: string }>(`
        SELECT EXISTS(SELECT 1 FROM pg_locks WHERE pid = pg_backend_pid()
          AND locktype = 'advisory' AND mode = 'ExclusiveLock' AND granted) bloqueado,
          txid_current()::text transaccion`);
      expect(bloqueo.rows[0].bloqueado).toBe(true);
      expect(bloqueo.rows[0].transaccion).toBeTruthy();
      const otro = await pool.connect();
      try {
        const intento = await otro.query<{ disponible: boolean }>(
          "SELECT pg_try_advisory_xact_lock(hashtext('exp_' || $1::text)) disponible", ['102']);
        expect(intento.rows[0].disponible).toBe(true);
        const mismo = await otro.query<{ disponible: boolean }>(
          "SELECT pg_try_advisory_xact_lock(hashtext('exp_' || $1::text)) disponible", ['101']);
        expect(mismo.rows[0].disponible).toBe(false);
      } finally { otro.release(); }
    });
  });

  it('inserta un asiento inmutable con actor, milisegundos y referencia; conserva el original', async () => {
    const antes = await pool.query('SELECT * FROM sigd_rut.movimiento_tramite WHERE expediente_id = 101 ORDER BY secuencia');
    const correlationId = randomUUID();
    const respuesta = await request(app()).post(ruta(101)).set('x-correlation-id', correlationId).send(cuerpo());
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({ expedienteId: '101', movimientoRevertidoId: '2',
      movimientoCompensatorioId: '3', estadoAntesDeReversion: 'EN_CALIFICACION',
      estadoRestaurado: 'RECEPCIONADO', correlationId,
      compensacionFolios: { estado: 'PENDIENTE', rangoAfectado: null } });
    const despues = await pool.query('SELECT * FROM sigd_rut.movimiento_tramite WHERE expediente_id = 101 ORDER BY secuencia');
    expect(despues.rows).toEqual(antes.rows);
    expect(await cantidades(101)).toEqual({ normales: 2, compensatorios: 1, identidades: 3, secuencia: '3' });
    const asiento = await pool.query(`SELECT c.evento, c.usuario_operador_id::text actor,
      c.fecha_hora, c.movimiento_objetivo_id, c.estado_anterior, c.estado_nuevo,
      c.motivo, c.correlation_id, c.compensacion_folios, c.datos,
      m.id_movimiento AS original_id
      FROM sigd_rut.movimiento_compensatorio c JOIN sigd_rut.movimiento_tramite m
      ON m.fecha_hora = c.movimiento_objetivo_fecha_hora AND m.id_movimiento = c.movimiento_objetivo_id
      WHERE c.expediente_id = 101`);
    expect(asiento.rows[0]).toMatchObject({ evento: 'REVERSION_ADMINISTRATIVA', actor: '7',
      estado_anterior: 'EN_CALIFICACION', estado_nuevo: 'RECEPCIONADO',
      motivo: respuesta.body.motivo, correlation_id: correlationId,
      compensacion_folios: { estado: 'PENDIENTE', rangoAfectado: null,
        movimientoRelacionadoId: expect.any(String) } });
    expect(asiento.rows[0].movimiento_objetivo_id).toEqual(asiento.rows[0].original_id);
    expect(asiento.rows[0].datos).toMatchObject({ motivo: respuesta.body.motivo,
      estadoAntesDeReversion: 'EN_CALIFICACION', estadoRestaurado: 'RECEPCIONADO' });
    const precision = await pool.query<{ milisegundos: boolean }>(`
      SELECT fecha_hora = date_trunc('milliseconds', fecha_hora) milisegundos
      FROM sigd_rut.movimiento_compensatorio WHERE expediente_id = 101`);
    expect(precision.rows[0].milisegundos).toBe(true);
    const solicitud = await pool.query(`SELECT expediente_id::text, movimiento_original_id,
      movimiento_compensatorio_id, motivo, actor_id::text, correlation_id,
      clave_idempotencia::text, estado, id_evento_outbox
      FROM sigd_rut.solicitud_compensacion_folios WHERE expediente_id = 101`);
    expect(solicitud.rows).toHaveLength(1);
    expect(solicitud.rows[0]).toMatchObject({ expediente_id: '101',
      movimiento_original_id: asiento.rows[0].original_id,
      movimiento_compensatorio_id: respuesta.body.movimientoCompensatorioUuid,
      motivo: respuesta.body.motivo, actor_id: '7', correlation_id: correlationId,
      estado: 'PENDIENTE', id_evento_outbox: null });
    const detalle = await request(app()).get('/api/v1/expedientes/101');
    expect(detalle.status).toBe(200);
    expect(detalle.body).toMatchObject({ estadoActual: 'RECEPCIONADO',
      ultimoMovimiento: { evento: 'REVERSION_ADMINISTRATIVA', estadoNuevo: 'RECEPCIONADO' } });
  });

  it('reintento con igual clave devuelve la misma respuesta sin duplicar y clave alterada da 409', async () => {
    const clave = randomUUID();
    const comando = cuerpo('2', clave);
    const primero = await request(app()).post(ruta(102)).send(comando);
    const segundo = await request(app()).post(ruta(102)).send(comando);
    expect(primero.status).toBe(200);
    expect(segundo.status).toBe(200);
    expect(segundo.body).toEqual(primero.body);
    expect((await cantidades(102)).compensatorios).toBe(1);
    const solicitudes = await pool.query<{ total: number }>(
      'SELECT count(*)::integer total FROM sigd_rut.solicitud_compensacion_folios WHERE expediente_id = 102');
    expect(solicitudes.rows[0].total).toBe(1);
    const conflicto = await request(app()).post(ruta(102)).send({ ...comando, motivo: 'Un motivo distinto para la misma clave.' });
    expect(conflicto.status).toBe(409);
    expect(conflicto.body.code).toBe('CLAVE_IDEMPOTENCIA_REUTILIZADA');
    const otroObjetivo = await request(app()).post(ruta(102)).send({ ...comando, movimientoObjetivoId: '1' });
    expect(otroObjetivo.status).toBe(409);
    expect(otroObjetivo.body.code).toBe('CLAVE_IDEMPOTENCIA_REUTILIZADA');
    expect((await cantidades(102)).compensatorios).toBe(1);
  });

  it('GET de bandeja, detalle y seis contadores leen la secuencia total tras revertir', async () => {
    const antes = await request(app()).get('/api/v1/expedientes').query({ pestana: 'DERIVADOS' });
    expect(antes.status).toBe(200);
    expect(antes.body.elementos.map((fila: { idExpediente: string }) => fila.idExpediente)).toContain('107');
    const areaAntes = await request(app()).get('/api/v1/expedientes')
      .query({ pestana: 'DERIVADOS', areaId: AREA_DESTINO });
    expect(areaAntes.body.elementos.map((fila: { idExpediente: string }) => fila.idExpediente)).toContain('107');
    const respuesta = await request(app()).post(ruta(107)).send(cuerpo('3'));
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toMatchObject({ movimientoCompensatorioId: '4',
      estadoAntesDeReversion: 'DERIVADO', estadoRestaurado: 'EN_CALIFICACION' });
    const pendientes = await request(app()).get('/api/v1/expedientes').query({ pestana: 'PENDIENTES' });
    const derivados = await request(app()).get('/api/v1/expedientes').query({ pestana: 'DERIVADOS' });
    expect(pendientes.status).toBe(200);
    expect(derivados.status).toBe(200);
    expect(pendientes.body.elementos).toContainEqual(expect.objectContaining({
      idExpediente: '107', estadoActual: 'EN_CALIFICACION',
    }));
    expect(derivados.body.elementos.map((fila: { idExpediente: string }) => fila.idExpediente))
      .not.toContain('107');
    expect(Object.keys(pendientes.body.contadores).sort()).toEqual([
      'ARCHIVADOS', 'ATENDIDOS', 'DERIVADOS', 'EN_TRAMITE', 'PENDIENTES', 'POR_FIRMAR',
    ]);
    expect(pendientes.body.contadores).toEqual({ ...antes.body.contadores,
      PENDIENTES: antes.body.contadores.PENDIENTES + 1,
      DERIVADOS: antes.body.contadores.DERIVADOS - 1 });
    expect(derivados.body.contadores).toEqual(pendientes.body.contadores);
    const areaRestaurada = await request(app()).get('/api/v1/expedientes')
      .query({ pestana: 'PENDIENTES', areaId: AREA_ORIGEN });
    expect(areaRestaurada.body.elementos).toContainEqual(expect.objectContaining({
      idExpediente: '107', areaActualId: AREA_ORIGEN, estadoActual: 'EN_CALIFICACION',
    }));
    const areaAnterior = await request(app()).get('/api/v1/expedientes')
      .query({ pestana: 'DERIVADOS', areaId: AREA_DESTINO });
    expect(areaAnterior.body.elementos.map((fila: { idExpediente: string }) => fila.idExpediente))
      .not.toContain('107');
    const detalle = await request(app()).get('/api/v1/expedientes/107');
    expect(detalle.status).toBe(200);
    expect(detalle.body).toMatchObject({ estadoActual: 'EN_CALIFICACION',
      ultimoMovimiento: { evento: 'REVERSION_ADMINISTRATIVA', estadoNuevo: 'EN_CALIFICACION' } });
    const historial = await pool.query<{ secuencia: string; tipo: string }>(`
      SELECT secuencia::text, tipo FROM (
        SELECT secuencia, 'NORMAL'::text tipo FROM sigd_rut.movimiento_tramite WHERE expediente_id = 107
        UNION ALL
        SELECT secuencia, 'COMPENSATORIA'::text tipo FROM sigd_rut.movimiento_compensatorio WHERE expediente_id = 107
      ) h ORDER BY secuencia`);
    expect(historial.rows).toEqual([
      { secuencia: '1', tipo: 'NORMAL' }, { secuencia: '2', tipo: 'NORMAL' },
      { secuencia: '3', tipo: 'NORMAL' }, { secuencia: '4', tipo: 'COMPENSATORIA' },
    ]);
  });

  it('dos reversiones concurrentes se serializan y sólo una crea el asiento', async () => {
    const [a, b] = await Promise.all([
      request(app()).post(ruta(103)).send(cuerpo()),
      request(app()).post(ruta(103)).send(cuerpo()),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(await cantidades(103)).toEqual({ normales: 2, compensatorios: 1, identidades: 3, secuencia: '3' });
  });

  it('dos reversiones concurrentes con la misma clave devuelven un único resultado', async () => {
    const comando = cuerpo();
    const [a, b] = await Promise.all([
      request(app()).post(ruta(104)).send(comando),
      request(app()).post(ruta(104)).send(comando),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(a.body).toEqual(b.body);
    expect((await cantidades(104)).compensatorios).toBe(1);
  });

  it('falla después de reservar identidad y revierte movimiento, identidad y secuencia', async () => {
    const comando = cuerpo();
    await pool.query(`CREATE FUNCTION sigd_rut.fallo_prueba_reversion() RETURNS trigger
      LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fallo controlado' USING ERRCODE = 'XX001'; END $$;
      CREATE TRIGGER tr_fallo_prueba_reversion AFTER INSERT ON sigd_rut.movimiento_compensatorio
      FOR EACH ROW EXECUTE FUNCTION sigd_rut.fallo_prueba_reversion()`);
    try {
      const respuesta = await request(app()).post(ruta(105)).send(comando);
      expect(respuesta.status).toBe(500);
      expect(JSON.stringify(respuesta.body)).not.toContain('fallo controlado');
      expect(respuesta.body.correlation_id).toBeTruthy();
      expect(await cantidades(105)).toEqual({ normales: 2, compensatorios: 0, identidades: 2, secuencia: '2' });
      const clavePersistida = await pool.query<{ total: number }>(`
        SELECT count(*)::integer total FROM sigd_rut.movimiento_identidad
        WHERE expediente_id = 105 AND clave_idempotencia = $1`, [comando.claveIdempotencia]);
      expect(clavePersistida.rows[0].total).toBe(0);
      const solicitudes = await pool.query<{ total: number }>(
        'SELECT count(*)::integer total FROM sigd_rut.solicitud_compensacion_folios WHERE expediente_id = 105');
      expect(solicitudes.rows[0].total).toBe(0);
    } finally {
      await pool.query('DROP TRIGGER tr_fallo_prueba_reversion ON sigd_rut.movimiento_compensatorio');
      await pool.query('DROP FUNCTION sigd_rut.fallo_prueba_reversion()');
    }
    const recuperada = await request(app()).post(ruta(105)).send(comando);
    expect(recuperada.status).toBe(200);
    expect(recuperada.body.movimientoCompensatorioId).toBe('3');
  });

  it('rechaza UPDATE, DELETE y TRUNCATE del asiento y deja intacta la historia', async () => {
    await expect(pool.query("UPDATE sigd_rut.movimiento_compensatorio SET motivo = 'Cambio posterior' WHERE expediente_id = 101"))
      .rejects.toMatchObject({ code: '23001' });
    await expect(pool.query('DELETE FROM sigd_rut.movimiento_compensatorio WHERE expediente_id = 101'))
      .rejects.toMatchObject({ code: '23001' });
    await expect(pool.query('TRUNCATE sigd_rut.movimiento_compensatorio'))
      .rejects.toMatchObject({ code: '0A000' });
    await expect(pool.query('TRUNCATE sigd_rut.movimiento_compensatorio CASCADE'))
      .rejects.toMatchObject({ code: '23001' });
    expect((await cantidades(101)).compensatorios).toBe(1);
  });

  it('rechaza entrada inválida, ausencia de actor y falta de autorización por RFC 7807', async () => {
    const invalido = await request(app()).post(ruta(101)).send({ ...cuerpo(), movimientoObjetivoId: 'abc' });
    expect(invalido.status).toBe(400);
    const correlacionInvalida = await request(app()).post(ruta(101))
      .set('x-correlation-id', 'sin-uuid').send(cuerpo());
    expect(correlacionInvalida.status).toBe(400);
    const sinActor = await request(construirApp(pool)).post(ruta(101))
      .set('x-usuario-id', '7').send(cuerpo());
    expect(sinActor.status).toBe(401);
    const sinPermiso = await request(construirApp(pool, { obtenerActorRutaDoc: () => actor }))
      .post(ruta(101)).send(cuerpo());
    expect(sinPermiso.status).toBe(403);
    for (const respuesta of [invalido, correlacionInvalida, sinActor, sinPermiso]) {
      expect(respuesta.body.correlation_id).toBeTruthy();
      expect(respuesta.body.type).toContain('/errors/');
    }
  });

  it('distingue expediente o movimiento inexistente, inicial no reversible y objetivo desactualizado', async () => {
    const expediente = await request(app()).post(ruta(999)).send(cuerpo());
    const movimiento = await request(app()).post(ruta(106)).send(cuerpo('99'));
    const inicial = await request(app()).post(ruta(106)).send(cuerpo('1'));
    await pool.query(`INSERT INTO sigd_rut.movimiento_tramite
      (expediente_id, estado_anterior, evento, estado_nuevo, usuario_operador_id)
      VALUES (106, 'EN_CALIFICACION', 'INICIAR_REVISION', 'EN_REVISION', 7)`);
    const desactualizado = await request(app()).post(ruta(106)).send(cuerpo('2'));
    expect([expediente.status, movimiento.status, inicial.status, desactualizado.status])
      .toEqual([404, 404, 422, 409]);
    expect((await cantidades(106)).compensatorios).toBe(0);
  });

  it('un fallo del puerto de folios revierte asiento, solicitud, identidad e idempotencia', async () => {
    const comando = cuerpo();
    const fallido = construirApp(pool, { obtenerActorRutaDoc: () => actor,
      politicaReversionRutaDoc: () => true,
      folioCompensationPort: { solicitar: async () => { throw new Error('fallo puerto folios'); } } });
    const res = await request(fallido).post(ruta(109)).send(comando);
    expect(res.status).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain('fallo puerto folios');
    expect(await cantidades(109)).toEqual({ normales: 2, compensatorios: 0, identidades: 2, secuencia: '2' });
    const pendientes = await pool.query<{ total: number }>(`
      SELECT count(*)::integer total FROM sigd_rut.solicitud_compensacion_folios
      WHERE expediente_id = 109 OR clave_idempotencia = $1`, [comando.claveIdempotencia]);
    expect(pendientes.rows[0].total).toBe(0);
    const retry = await request(app()).post(ruta(109)).send(comando);
    expect(retry.status).toBe(200);
  });

  it('el adaptador encola una sola solicitud en el outbox canónico cuando está disponible', async () => {
    await pool.query(`CREATE SCHEMA sigd_audit;
      CREATE TABLE sigd_audit.evento_outbox (
        id_evento UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        correlation_id UUID NOT NULL, agregado VARCHAR(64) NOT NULL,
        tipo_evento VARCHAR(64) NOT NULL, payload JSONB NOT NULL,
        estado VARCHAR(16) NOT NULL DEFAULT 'PENDIENTE')`);
    const correlationId = randomUUID();
    const comando = cuerpo();
    const primera = await request(app()).post(ruta(108))
      .set('x-correlation-id', correlationId).send(comando);
    const repetida = await request(app()).post(ruta(108))
      .set('x-correlation-id', correlationId).send(comando);
    expect([primera.status, repetida.status]).toEqual([200, 200]);
    expect(repetida.body).toEqual(primera.body);
    const eventos = await pool.query(`SELECT id_evento, correlation_id, agregado,
      tipo_evento, payload, estado FROM sigd_audit.evento_outbox`);
    expect(eventos.rows).toHaveLength(1);
    expect(eventos.rows[0]).toMatchObject({ correlation_id: correlationId,
      agregado: 'RutaDoc', tipo_evento: 'CompensacionFoliosSolicitada',
      estado: 'PENDIENTE', payload: {
        expedienteId: '108', movimientoCompensatorioId: primera.body.movimientoCompensatorioUuid,
        claveIdempotencia: comando.claveIdempotencia, actorId: '7' } });
    const solicitud = await pool.query(`SELECT estado, id_evento_outbox
      , id_solicitud FROM sigd_rut.solicitud_compensacion_folios WHERE expediente_id = 108`);
    expect(solicitud.rows).toEqual([{ estado: 'PENDIENTE',
      id_evento_outbox: eventos.rows[0].id_evento, id_solicitud: expect.any(String) }]);
    const cliente = await pool.connect();
    try {
      const port = new FolioCompensationPostgres();
      await expect(port.registrarEstado(cliente, solicitud.rows[0].id_solicitud, 'COMPLETADO'))
        .rejects.toThrow('inválida');
      await port.registrarEstado(cliente, solicitud.rows[0].id_solicitud, 'PROCESANDO');
      await port.registrarEstado(cliente, solicitud.rows[0].id_solicitud, 'FALLIDO');
      await port.registrarEstado(cliente, solicitud.rows[0].id_solicitud, 'PROCESANDO');
      await port.registrarEstado(cliente, solicitud.rows[0].id_solicitud, 'COMPLETADO');
      const final = await cliente.query('SELECT estado FROM sigd_rut.solicitud_compensacion_folios WHERE expediente_id = 108');
      expect(final.rows[0].estado).toBe('COMPLETADO');
    } finally { cliente.release(); }
  });

  it('un fallo del outbox revierte también la proyección y admite reintento con la misma clave', async () => {
    await pool.query(`CREATE FUNCTION sigd_audit.fallo_outbox_prueba() RETURNS trigger
      LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fallo outbox' USING ERRCODE = 'XX002'; END $$;
      CREATE TRIGGER tr_fallo_outbox_prueba AFTER INSERT ON sigd_audit.evento_outbox
      FOR EACH ROW EXECUTE FUNCTION sigd_audit.fallo_outbox_prueba()`);
    const comando = cuerpo();
    try {
      const fallido = await request(app()).post(ruta(110)).send(comando);
      expect(fallido.status).toBe(500);
      expect(JSON.stringify(fallido.body)).not.toContain('fallo outbox');
      expect(await cantidades(110)).toEqual({ normales: 2, compensatorios: 0, identidades: 2, secuencia: '2' });
      const estado = await pool.query<{ secuencia: string; estado_nuevo: string }>(`
        SELECT secuencia::text, estado_nuevo FROM sigd_rut.estado_actual_expediente WHERE expediente_id = 110`);
      expect(estado.rows).toEqual([{ secuencia: '2', estado_nuevo: 'EN_CALIFICACION' }]);
      const solicitud = await pool.query<{ total: number }>(`
        SELECT count(*)::integer total FROM sigd_rut.solicitud_compensacion_folios
        WHERE expediente_id = 110 OR clave_idempotencia = $1`, [comando.claveIdempotencia]);
      expect(solicitud.rows[0].total).toBe(0);
    } finally {
      await pool.query('DROP TRIGGER tr_fallo_outbox_prueba ON sigd_audit.evento_outbox');
      await pool.query('DROP FUNCTION sigd_audit.fallo_outbox_prueba()');
    }
    const repetida = await request(app()).post(ruta(110)).send(comando);
    expect(repetida.status).toBe(200);
    expect(repetida.body.movimientoCompensatorioId).toBe('3');
  });
});
