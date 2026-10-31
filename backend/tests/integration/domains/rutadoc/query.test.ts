import { uuidPrueba, contratoLecturaUuid } from '../../../support/rutadoc-uuid.js';
import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import path from 'node:path';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { construirApp } from '../../../../src/app.js';
import { SQL_LISTAR_RUTADOC } from '../../../../src/domains/rutadoc/rutadoc.repository.js';
import type { ActorRutaDoc } from '../../../../src/domains/rutadoc/rutadoc.types.js';
import { actorProviderDePrueba } from '../../../support/rutadoc-actor-provider.js';

const AREA = 'da7aa251-a027-47f3-8bfd-4cc94df486d1';
const actor: ActorRutaDoc = { id: 'operador', roles: ['MESA_PARTES'], puedeVerExpediente: () => true };
type TransicionTupla = readonly [estadoAnterior: string, evento: string, estadoNuevo: string];
const destinos: ReadonlyArray<TransicionTupla | null> = [
  null,
  ['REGISTRADO', 'RECEPCION', 'RECEPCIONADO'],
  ['RECEPCIONADO', 'INICIAR_CALIFICACION', 'EN_CALIFICACION'],
  ['EN_CALIFICACION', 'INICIAR_REVISION', 'EN_REVISION'],
  ['EN_REVISION', 'OBSERVACION', 'OBSERVADO'],
  ['OBSERVADO', 'CORRECCION', 'SUBSANADO'],
  ['EN_CALIFICACION', 'DERIVACION', 'DERIVADO'],
  ['EN_REVISION', 'ENVIAR_A_FIRMA', 'EN_FIRMA'],
  ['EN_FIRMA', 'FIRMA', 'RESUELTO'],
  ['RESUELTO', 'CIERRE', 'ARCHIVADO'],
];

let contenedor: StartedPostgreSqlContainer;
let pool: Pool;

describe('GET RutaDoc en PostgreSQL 18 aislado', () => {
  beforeAll(async () => {
    contenedor = await new PostgreSqlContainer('postgres:18-alpine')
      .withDatabase('sigd_rutadoc_consulta').start();
    pool = new Pool({ connectionString: contenedor.getConnectionUri() });
    await pool.query('BEGIN;\n' + readFileSync(path.resolve(process.cwd(), 'migraciones/06_sigd_rut.sql'), 'utf8') + '\nCOMMIT;');
    await pool.query(contratoLecturaUuid);
    await pool.query('BEGIN;\n' + readFileSync(path.resolve(process.cwd(), 'migraciones/06_sigd_rut.sql'), 'utf8') + '\nCOMMIT;');
    for (let id = 1; id <= 12; id += 1) {
      const fecha = id >= 11 ? '2026-09-24T10:00:00.000Z' :
        `2026-09-${String(id).padStart(2, '0')}T10:00:00.000Z`;
      await pool.query(`INSERT INTO sigd_tra.expediente
        (expediente_id, codigo_expediente, asunto, fecha_radicacion)
        VALUES ($1, $2, $3, $4)`, [uuidPrueba(id), `EXP-2026-${String(id).padStart(6, '0')}`,
          id === 2 ? 'Solicitud de beca' : `Asunto ${id}`, fecha]);
      const transicion = destinos[id - 1];
      if (transicion) {
        await pool.query(`INSERT INTO sigd_rut.movimiento_tramite
          (expediente_id, estado_anterior, evento, estado_nuevo,
           usuario_operador_id, fecha_hora, datos)
          VALUES ($1, $2, $3, $4, '00000000-0000-4000-8000-000000000007', '2026-09-25T10:00:00Z', $5::jsonb)`,
        [uuidPrueba(id), ...transicion, JSON.stringify(id === 2 ? { areaId: AREA } : {})]);
      }
    }
    await pool.query(`INSERT INTO sigd_tra.expediente_documento_folio VALUES
      ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000501', 1, 3), ('00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000502', 4, 5)`);
  });

  afterAll(async () => {
    await pool?.end();
    await contenedor?.stop();
  });

  function app() { return construirApp(pool, { actorProviderRutaDoc: actorProviderDePrueba(actor) }); }

  it.each<[string, readonly string[]]>([
    ['PENDIENTES', ['REGISTRADO', 'RECEPCIONADO', 'EN_CALIFICACION']],
    ['EN_TRAMITE', ['EN_REVISION', 'OBSERVADO', 'SUBSANADO']],
    ['DERIVADOS', ['DERIVADO']],
    ['POR_FIRMAR', ['EN_FIRMA']],
    ['ATENDIDOS', ['RESUELTO']],
    ['ARCHIVADOS', ['ARCHIVADO']],
  ])('GET %s devuelve sólo los estados de su pestaña', async (pestana, estados) => {
    const respuesta = await request(app()).get('/api/v1/expedientes').query({ pestana });
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.elementos.length).toBeGreaterThan(0);
    expect(respuesta.body.elementos.every((fila: { estadoActual: string }) => estados.includes(fila.estadoActual))).toBe(true);
  });

  it('calcula los seis contadores sobre la misma lectura', async () => {
    const respuesta = await request(app()).get('/api/v1/expedientes').query({ pestana: 'PENDIENTES' });
    expect(respuesta.body.contadores).toEqual({ PENDIENTES: 5, EN_TRAMITE: 3, DERIVADOS: 1,
      POR_FIRMAR: 1, ATENDIDOS: 1, ARCHIVADOS: 1 });
  });

  it('mantiene contadores exactos con altas, bajas y movimientos externos sin cache eventual', async () => {
    const contar = async () => (await request(app()).get('/api/v1/expedientes')
      .query({ pestana: 'PENDIENTES' })).body.contadores as Record<string, number>;
    const antes = await contar();
    await pool.query(`INSERT INTO sigd_tra.expediente
      VALUES ('00000000-0000-4000-8000-000000000013', 'EXP-2026-000013', 'Alta de prueba', '2026-09-24T09:00:00Z')`);
    expect((await contar()).PENDIENTES).toBe(antes.PENDIENTES + 1);
    await pool.query(`INSERT INTO sigd_rut.movimiento_tramite
      (expediente_id, estado_anterior, evento, estado_nuevo, usuario_operador_id)
      VALUES ('00000000-0000-4000-8000-000000000013', 'REGISTRADO', 'RECEPCION', 'RECEPCIONADO', '00000000-0000-4000-8000-000000000007'),
             ('00000000-0000-4000-8000-000000000013', 'RECEPCIONADO', 'INICIAR_CALIFICACION', 'EN_CALIFICACION', '00000000-0000-4000-8000-000000000007'),
             ('00000000-0000-4000-8000-000000000013', 'EN_CALIFICACION', 'DERIVACION', 'DERIVADO', '00000000-0000-4000-8000-000000000007')`);
    expect((await contar()).DERIVADOS).toBe(antes.DERIVADOS + 1);
    const conexion = await pool.connect();
    try {
      await conexion.query('BEGIN');
      await conexion.query(`DELETE FROM sigd_tra.expediente WHERE expediente_id = '00000000-0000-4000-8000-000000000013'`);
      const temporal = await conexion.query<{ cantidad: string }>(`
        SELECT cantidad::text FROM sigd_rut.contador_pestana_local
        WHERE pestana = 'DERIVADOS'`);
      expect(Number(temporal.rows[0].cantidad)).toBe(antes.DERIVADOS);
      await conexion.query('ROLLBACK');
    } finally {
      conexion.release();
    }
    expect((await contar()).DERIVADOS).toBe(antes.DERIVADOS + 1);
    await pool.query(`DELETE FROM sigd_tra.expediente WHERE expediente_id = '00000000-0000-4000-8000-000000000013'`);
    expect((await contar()).DERIVADOS).toBe(antes.DERIVADOS);
    await pool.query(`INSERT INTO sigd_tra.expediente
      VALUES ('00000000-0000-4000-8000-000000000013', 'EXP-2026-000013', 'Alta de prueba', '2026-09-24T09:00:00Z')`);
    expect((await contar()).DERIVADOS).toBe(antes.DERIVADOS + 1);
    const completo = await pool.query<{ total: number }>(`
      SELECT count(*)::integer total FROM sigd_tra.expediente e
      LEFT JOIN sigd_rut.estado_actual_expediente u ON u.expediente_id = e.expediente_id
      WHERE COALESCE(u.estado_nuevo, 'REGISTRADO') = 'DERIVADO'`);
    expect((await contar()).DERIVADOS).toBe(completo.rows[0].total);
    await Promise.all([14, 15].map((id) => pool.query(`INSERT INTO sigd_tra.expediente
      VALUES ($1, $2, 'Alta concurrente', '2026-09-24T09:00:00Z')`,
    [uuidPrueba(id), `EXP-2026-${String(id).padStart(6, '0')}`])));
    expect((await contar()).PENDIENTES).toBe(antes.PENDIENTES + 2);
    await pool.query(`DELETE FROM sigd_tra.expediente WHERE expediente_id IN ('00000000-0000-4000-8000-000000000014', '00000000-0000-4000-8000-000000000015')`);
    expect((await contar()).PENDIENTES).toBe(antes.PENDIENTES);
    await pool.query(`INSERT INTO sigd_rut.movimiento_tramite
      (expediente_id, estado_anterior, evento, estado_nuevo, usuario_operador_id)
      VALUES ('00000000-0000-4000-8000-000000000016', 'REGISTRADO', 'RECEPCION', 'RECEPCIONADO', '00000000-0000-4000-8000-000000000007')`);
    expect((await contar()).PENDIENTES).toBe(antes.PENDIENTES);
    await pool.query(`INSERT INTO sigd_tra.expediente
      VALUES ('00000000-0000-4000-8000-000000000016', 'EXP-2026-000016', 'Alta de prueba', '2026-09-24T09:00:00Z')`);
    expect((await contar()).PENDIENTES).toBe(antes.PENDIENTES + 1);
    await pool.query(`DELETE FROM sigd_tra.expediente WHERE expediente_id = '00000000-0000-4000-8000-000000000016'`);
    expect((await contar()).PENDIENTES).toBe(antes.PENDIENTES);
  });

  it('usa conteo exacto de respaldo si falta el adaptador de altas externas', async () => {
    await pool.query('DROP TRIGGER tr_rutadoc_contador_expediente ON sigd_tra.expediente');
    await pool.query(`INSERT INTO sigd_tra.expediente
      VALUES ('00000000-0000-4000-8000-000000000017', 'EXP-2026-000017', 'Alta de prueba', '2026-09-24T09:00:00Z')`);
    const consulta = async () => (await request(app()).get('/api/v1/expedientes')
      .query({ pestana: 'PENDIENTES' })).body.contadores.PENDIENTES as number;
    expect(await consulta()).toBe(6);
    await pool.query('BEGIN;\n' + readFileSync(path.resolve(process.cwd(), 'migraciones/06_sigd_rut.sql'), 'utf8') + '\nCOMMIT;');
    expect(await consulta()).toBe(6);
    await pool.query(`DELETE FROM sigd_tra.expediente WHERE expediente_id = '00000000-0000-4000-8000-000000000017'`);
    expect(await consulta()).toBe(5);
  });

  it('filtra por término literal, sin ejecutar fragmentos SQL del usuario', async () => {
    const normal = await request(app()).get('/api/v1/expedientes').query({ pestana: 'PENDIENTES', terminoBusqueda: 'beca' });
    expect(normal.status).toBe(200);
    expect(normal.body.elementos.map((fila: { idExpediente: string }) => fila.idExpediente)).toEqual(['00000000-0000-4000-8000-000000000002']);
    const inyeccion = await request(app()).get('/api/v1/expedientes')
      .query({ pestana: 'PENDIENTES', terminoBusqueda: "' OR 1=1 --" });
    expect(inyeccion.status).toBe(200);
    expect(inyeccion.body.elementos).toEqual([]);
  });

  it('filtra por área y fecha de radicación', async () => {
    const area = await request(app()).get('/api/v1/expedientes').query({ pestana: 'PENDIENTES', areaId: AREA });
    expect(area.status).toBe(200);
    expect(area.body.elementos.map((fila: { idExpediente: string }) => fila.idExpediente)).toEqual(['00000000-0000-4000-8000-000000000002']);
    const fecha = await request(app()).get('/api/v1/expedientes').query({
      pestana: 'PENDIENTES', fechaDesde: '2026-09-02', fechaHasta: '2026-09-02',
    });
    expect(fecha.status).toBe(200);
    expect(fecha.body.elementos.map((fila: { idExpediente: string }) => fila.idExpediente)).toEqual(['00000000-0000-4000-8000-000000000002']);
  });

  it('pagina con orden estable y sin duplicados cuando hay fechas iguales', async () => {
    const ids: string[] = [];
    let cursor: string | null = null;
    do {
      const respuesta = await request(app()).get('/api/v1/expedientes').query({
        pestana: 'PENDIENTES', limite: '2', ...(cursor ? { cursor } : {}),
      });
      expect(respuesta.status).toBe(200);
      ids.push(...respuesta.body.elementos.map((fila: { idExpediente: string }) => fila.idExpediente));
      cursor = respuesta.body.siguienteCursor;
    } while (cursor);
    expect(ids).toEqual(['00000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001']);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('devuelve detalle disponible y 404 para expediente inexistente', async () => {
    const existente = await request(app()).get('/api/v1/expedientes/00000000-0000-4000-8000-000000000002');
    expect(existente.status).toBe(200);
    expect(existente.body).toMatchObject({ idExpediente: '00000000-0000-4000-8000-000000000002', cut: 'EXP-2026-000002',
      asunto: 'Solicitud de beca', estadoActual: 'RECEPCIONADO', areaActualId: AREA,
      solicitanteId: uuidPrueba(80), resumenDocumentos: { cantidadDocumentos: 2, totalFolios: 5 }, sla: null });
    expect(existente.body.ultimoMovimiento).toMatchObject({ evento: 'RECEPCION', usuarioOperadorId: uuidPrueba(7) });
    const ausente = await request(app()).get('/api/v1/expedientes/00000000-0000-4000-8000-000000000999');
    expect(ausente.status).toBe(404);
    expect(ausente.body).toMatchObject({ code: 'NOT_FOUND', status: 404 });
  });

  it('rechaza filtros, ID y cursor inválidos como Problem Details con correlation_id', async () => {
    for (const ruta of ['/api/v1/expedientes?pestana=PENDIENTES&limite=101',
      '/api/v1/expedientes?pestana=PENDIENTES&cursor=invalido',
      '/api/v1/expedientes/abc']) {
      const respuesta = await request(app()).get(ruta).set('x-correlation-id', 'rd03-prueba');
      expect(respuesta.status).toBe(400);
      expect(respuesta.body).toMatchObject({ status: 400, correlation_id: 'rd03-prueba' });
      expect(respuesta.body.type).toContain('/errors/');
    }
  });

  it('no acepta identidad desde headers libres y sanea errores internos', async () => {
    const sinAuth = await request(construirApp(pool)).get('/api/v1/expedientes')
      .query({ pestana: 'PENDIENTES' }).set('x-usuario-id', '7').set('x-auth', 'si');
    expect(sinAuth.status).toBe(401);
    const fallido = construirApp({ query: async () => { throw new Error('secret-sql-details'); } } as unknown as Pool,
      { obtenerActorRutaDoc: () => actor });
    const respuesta = await request(fallido).get('/api/v1/expedientes/00000000-0000-4000-8000-000000000002');
    expect(respuesta.status).toBe(500);
    expect(JSON.stringify(respuesta.body)).not.toContain('secret-sql-details');
    expect(respuesta.body.correlation_id).toBeTruthy();
  });

  it('deniega rol inválido y actor ausente mediante el puerto de autenticación', async () => {
    const rolInvalido = await request(construirApp(pool, {
      actorProviderRutaDoc: actorProviderDePrueba({ ...actor, roles: ['INVITADO'] }),
    })).get('/api/v1/expedientes').query({ pestana: 'PENDIENTES' });
    expect(rolInvalido.status).toBe(403);
    const ausente = await request(construirApp(pool, {
      actorProviderRutaDoc: actorProviderDePrueba(null),
    })).get('/api/v1/expedientes/00000000-0000-4000-8000-000000000002').set('x-usuario-id', '7');
    expect(ausente.status).toBe(401);
  });

  it('mide EXPLAIN ANALYZE de la bandeja con 10 000 expedientes adicionales', async () => {
    await pool.query('DROP INDEX IF EXISTS sigd_tra.ix_rutadoc_expediente_fecha_id');
    await pool.query(`INSERT INTO sigd_tra.expediente
      SELECT ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, 'EXP-2026-' || lpad(n::text, 6, '0'), 'Solicitud de laboratorio',
             '2026-09-01T00:00:00Z'::timestamptz + n * interval '1 second'
        FROM generate_series(1000, 10999) AS n`);
    await pool.query(`INSERT INTO sigd_rut.movimiento_tramite
      (expediente_id, estado_anterior, evento, estado_nuevo, usuario_operador_id, fecha_hora)
      SELECT ('00000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, 'REGISTRADO', 'RECEPCION', 'RECEPCIONADO', '00000000-0000-4000-8000-000000000007',
             '2026-09-25T10:00:00Z'::timestamptz
        FROM generate_series(1000, 10999) AS n`);
    await pool.query('ANALYZE sigd_tra.expediente');
    await pool.query('ANALYZE sigd_rut.movimiento_tramite');
    const resultado = await pool.query<{ 'QUERY PLAN': Array<{ 'Execution Time': number; Plan: unknown }> }>(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${SQL_LISTAR_RUTADOC}`,
      [null, null, null, null, ['REGISTRADO', 'RECEPCIONADO', 'EN_CALIFICACION'],
        '2026-09-24T10:00:00.000Z', '00000000-0000-4000-8000-000000000012', 21]);
    const plan = resultado.rows[0]['QUERY PLAN'][0];
    expect(plan['Execution Time']).toBeGreaterThan(0);
    const indices = [...JSON.stringify(plan.Plan).matchAll(/"Index Name":"([^"]+)"/g)].map((m) => m[1]);
    expect(JSON.stringify(plan.Plan)).toContain('estado_actual_expediente');
    expect(JSON.stringify(plan.Plan)).not.toContain('movimiento_tramite_2026');
    console.log(`RD-03 sin índice externo: ${plan['Execution Time']} ms; índices=${indices.join(',')}`);

    // Sólo en esta base efímera: demuestra el índice que debe proveer TramiCore.
    await pool.query(`CREATE INDEX idx_prueba_expediente_fecha_id
      ON sigd_tra.expediente (fecha_radicacion DESC, expediente_id DESC)`);
    await pool.query('ANALYZE sigd_tra.expediente');
    const conIndice = await pool.query<{ 'QUERY PLAN': Array<{ 'Execution Time': number; Plan: unknown }> }>(
      `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${SQL_LISTAR_RUTADOC}`,
      [null, null, null, null, ['REGISTRADO', 'RECEPCIONADO', 'EN_CALIFICACION'],
        '2026-09-24T10:00:00.000Z', '00000000-0000-4000-8000-000000000012', 21]);
    const planIndexado = conIndice.rows[0]['QUERY PLAN'][0];
    const indicesIndexados = [...JSON.stringify(planIndexado.Plan).matchAll(/"Index Name":"([^"]+)"/g)].map((m) => m[1]);
    const indice = await pool.query<{ existe: string | null }>(
      "SELECT to_regclass('sigd_tra.idx_prueba_expediente_fecha_id')::text AS existe");
    expect(indice.rows[0].existe).toBe('sigd_tra.idx_prueba_expediente_fecha_id');
    expect(JSON.stringify(planIndexado.Plan)).toContain('estado_actual_expediente');
    console.log(`RD-03 con índice externo sólo en fixture: ${planIndexado['Execution Time']} ms; índices=${indicesIndexados.join(',')}`);
    const inicioHttp = performance.now();
    const respuesta = await request(app()).get('/api/v1/expedientes')
      .query({ pestana: 'PENDIENTES', limite: '20' });
    const duracionHttp = performance.now() - inicioHttp;
    expect(respuesta.status).toBe(200);
    console.log(`RD-03 GET completo con contadores: ${duracionHttp} ms`);
  });

  it('GET trazabilidad une particiones históricas en orden de secuencia y mide duración entre estaciones', async () => {
    await pool.query(`INSERT INTO sigd_rut.movimiento_tramite
      (expediente_id, estado_anterior, evento, estado_nuevo, usuario_operador_id, fecha_hora, datos)
      VALUES ('00000000-0000-4000-8000-000000000002', 'RECEPCIONADO', 'INICIAR_CALIFICACION', 'EN_CALIFICACION', '00000000-0000-4000-8000-000000000007',
        '2027-01-02T10:00:00Z', jsonb_build_object('areaId', $1::text))`, [AREA]);
    const movimientoObjetivo = await pool.query<{ fecha_hora: Date; id_movimiento: string }>(`
      SELECT fecha_hora, id_movimiento::text FROM sigd_rut.movimiento_tramite
       WHERE expediente_id = '00000000-0000-4000-8000-000000000002' AND secuencia = 2`);
    await pool.query(`INSERT INTO sigd_rut.movimiento_compensatorio
      (expediente_id, estado_anterior, estado_nuevo, usuario_operador_id, fecha_hora,
       correlation_id, clave_idempotencia, movimiento_objetivo_fecha_hora,
       movimiento_objetivo_id, movimiento_objetivo_secuencia, huella_comando,
       motivo, compensacion_folios, datos)
      VALUES ('00000000-0000-4000-8000-000000000002', 'EN_CALIFICACION', 'RECEPCIONADO', '00000000-0000-4000-8000-000000000007', '2027-01-03T10:00:00Z',
       'integration-correlation', 'integration-idempotency', $1, $2::uuid, 2,
       'integration-fingerprint', 'Reversión aprobada para probar lectura', '{}'::jsonb,
       jsonb_build_object('areaId', $3::text))`,
    [movimientoObjetivo.rows[0].fecha_hora, movimientoObjetivo.rows[0].id_movimiento, AREA]);
    const respuesta = await request(app()).get('/api/v1/expedientes/00000000-0000-4000-8000-000000000002/trazabilidad');
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.actuaciones.map((fila: { secuencia: string }) => fila.secuencia)).toEqual(['1', '2', '3']);
    expect(respuesta.body.actuaciones.map((fila: { fechaHora: string }) => fila.fechaHora)).toEqual([
      '2026-09-25T10:00:00.000Z', '2027-01-02T10:00:00.000Z', '2027-01-03T10:00:00.000Z',
    ]);
    expect(respuesta.body.actuaciones[0]).toMatchObject({ areaDestinoId: AREA,
      duracionMs: Date.parse('2027-01-02T10:00:00Z') - Date.parse('2026-09-25T10:00:00Z'),
      duracionMinutos: (Date.parse('2027-01-02T10:00:00Z') - Date.parse('2026-09-25T10:00:00Z')) / 60_000,
    });
    expect(respuesta.body.actuaciones[0].tipoActuacion).toBe('NORMAL');
    expect(respuesta.body.actuaciones[2]).toMatchObject({ tipoActuacion: 'COMPENSATORIA', duracionMs: null });
  });

  it('GET foliación ordena estrictamente, presenta rangos y conserva metadata ausente como null', async () => {
    const respuesta = await request(construirApp(pool, {
      actorProviderRutaDoc: actorProviderDePrueba(actor),
    })).get('/api/v1/expedientes/00000000-0000-4000-8000-000000000002/foliacion');
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.map((fila: { folioInicio: number }) => fila.folioInicio)).toEqual([1, 4]);
    expect(respuesta.body[0]).toMatchObject({ idDocumento: '00000000-0000-4000-8000-000000000501', cantidadFolios: 3,
      rango: 'F. 0001 a F. 0003', nombre: null, tipo: null, checksumSha256: null });
    const ausente = await request(app()).get('/api/v1/expedientes/00000000-0000-4000-8000-000000000999/foliacion');
    expect(ausente.status).toBe(404);
  });

  it('GET foliación adjunta checksum solo cuando lo resuelve el contrato inyectado', async () => {
    const respuesta = await request(construirApp(pool, {
      actorProviderRutaDoc: actorProviderDePrueba(actor),
      documentoMetadataRutaDoc: { obtenerMetadataDocumento: async (id: string) => ({
        checksumSha256: id === '00000000-0000-4000-8000-000000000501' ? 'b'.repeat(64) : null, nombre: 'anexo.pdf', tipo: 'ANEXO',
      }) },
    })).get('/api/v1/expedientes/00000000-0000-4000-8000-000000000002/foliacion');
    expect(respuesta.status).toBe(200);
    expect(respuesta.body[0]).toMatchObject({ checksumSha256: 'b'.repeat(64), nombre: 'anexo.pdf', tipo: 'ANEXO' });
  });

  it('GET SLA consume fechas del calendario inyectado y entrega un resultado completo', async () => {
    let rangoConsultado: [string, string] | null = null;
    const respuesta = await request(construirApp(pool, {
      actorProviderRutaDoc: actorProviderDePrueba(actor),
      calendarioLaboralRutaDoc: { obtenerDiasNoLaborables: async (desde: string, hasta: string) => {
        rangoConsultado = [desde, hasta];
        return ['2026-09-28'];
      } },
    })).get('/api/v1/expedientes/00000000-0000-4000-8000-000000000002/sla-status');
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.fechaInicio).toBe('2026-09-24');
    expect(respuesta.body).toEqual(expect.objectContaining({ fechaCalculo: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      fechaLimite: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
      diasHabilesTranscurridos: expect.any(Number), diasHabilesRestantes: expect.any(Number),
      porcentaje: expect.any(Number), estado: expect.stringMatching(/^(VERDE|AMARILLO|ROJO)$/) }));
    expect(rangoConsultado?.[0]).toBe('2026-09-24');
  });

  it('GET CCD serializa el árbol del port institucional sin sembrar datos productivos', async () => {
    const respuesta = await request(construirApp(pool, {
      actorProviderRutaDoc: actorProviderDePrueba(actor),
      clasificadorCcdRutaDoc: { obtenerArbol: async () => [
        { id: 'ccd-1', codigo: '01', nombre: 'Serie', tipo: 'SERIE' as const, hijos: [
          { id: 'ccd-2', codigo: '01.01', nombre: 'Subserie', tipo: 'SUBSERIE' as const, hijos: [] },
        ] },
      ] },
    })).get('/api/v1/expedientes/clasificador-ccd');
    expect(respuesta.status).toBe(200);
    expect(respuesta.body.elementos).toMatchObject([{ id: 'ccd-1', tipo: 'SERIE',
      hijos: [{ id: 'ccd-2', tipo: 'SUBSERIE' }] }]);
  });
});
