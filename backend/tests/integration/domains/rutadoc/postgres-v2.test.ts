import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import { Network, type StartedNetwork } from 'testcontainers';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RepositorioPostgresFoliacionRutaDoc } from '../../../../src/domains/rutadoc/foliacion.repository.js';
import { RepositorioPostgresRutaDoc } from '../../../../src/domains/rutadoc/rutadoc.repository.js';
import { RepositorioPostgresTrazabilidadRutaDoc } from '../../../../src/domains/rutadoc/trazabilidad.repository.js';
import { RepositorioSlaRutaDoc } from '../../../../src/domains/rutadoc/sla.service.js';
import { ServicioRutaDoc } from '../../../../src/domains/rutadoc/rutadoc.service.js';
import { ServicioReversionRutaDoc } from '../../../../src/domains/rutadoc/rutadoc.reversion.service.js';
import { RepositorioReversionRutaDoc } from '../../../../src/domains/rutadoc/rutadoc.reversion.repository.js';
import { reversionSchema } from '../../../../src/domains/rutadoc/rutadoc.reversion.schemas.js';
import type { ActorRutaDoc } from '../../../../src/domains/rutadoc/rutadoc.types.js';
import { crearContexto, runWithContext } from '../../../../src/shared/request-context/request-context.js';

const DATABASE = 'sigd_rutadoc_v2_test';
const POSTGRES_IMAGE = 'postgres:18-alpine';
const MIGRACIONES_V2 = [
  '01_sigd_audit.sql',
  '02_sigd_auth.sql',
  '03_sigd_org.sql',
  '04_sigd_doc.sql',
  '05_sigd_tra.sql',
  '06_sigd_rut.sql',
  '07_sigd_reportes.sql',
] as const;

const actor: ActorRutaDoc = {
  id: '71001',
  roles: ['SUPER_ADMIN'],
  puedeVerExpediente: () => true,
};

interface ExpedienteFixture {
  id: string;
  cut: string;
}

let red: StartedNetwork | undefined;
let contenedor: StartedPostgreSqlContainer | undefined;
let pool: Pool | undefined;

function db(): Pool {
  if (!pool) throw new Error('El pool del PostgreSQL temporal no está disponible.');
  return pool;
}

async function cerrarRecursos(): Promise<void> {
  const errores: unknown[] = [];
  const poolActual = pool;
  pool = undefined;
  if (poolActual) {
    try { await poolActual.end(); } catch (error) { errores.push(error); }
  }

  const contenedorActual = contenedor;
  contenedor = undefined;
  if (contenedorActual) {
    try { await contenedorActual.stop({ remove: true, removeVolumes: true }); } catch (error) { errores.push(error); }
  }

  const redActual = red;
  red = undefined;
  if (redActual) {
    try { await redActual.stop(); } catch (error) { errores.push(error); }
  }
  if (errores.length) throw new AggregateError(errores, 'No se pudieron liberar todos los recursos del test RutaDoc V2.');
}

async function crearPersonaPrueba(sufijo: string): Promise<string> {
  const idPersona = randomUUID();
  const identificadorTecnico = `T${randomUUID().replaceAll('-', '').slice(0, 19)}`;
  await db().query(`
    INSERT INTO sigd_auth.persona (id_persona, tipo, id_documento)
    VALUES ($1::uuid, 'NATURAL', $2)`, [idPersona, identificadorTecnico]);
  await db().query(`
    INSERT INTO sigd_auth.persona_natural (id_persona, nombres, apellidos, nombre_completo)
    VALUES ($1::uuid, 'Persona', $2, $3)`, [idPersona, `Fixture ${sufijo}`, `Persona Fixture ${sufijo}`]);
  return idPersona;
}

async function crearExpediente(fecha: string, asunto: string): Promise<ExpedienteFixture> {
  const id = randomUUID();
  const personaId = await crearPersonaPrueba(id.slice(0, 8));
  const numero = `T-${randomUUID().replaceAll('-', '').slice(0, 20)}`;
  // En el DDL V2, tipo_documental_id es UUID obligatorio sin FK desde expediente.
  // Se genera un valor técnico aislado; no se crea ni se simula un tipo institucional.
  const tipoDocumentalId = randomUUID();
  const resultado = await db().query<{ expediente_id: string; codigo_expediente: string }>(`
    INSERT INTO sigd_tra.expediente
      (expediente_id, codigo_expediente, numero, tipo_documental_id,
       solicitante_id, fecha_radicacion)
    VALUES ($1::uuid, NULL, $2, $3::uuid, $4::uuid, $5::timestamptz)
    RETURNING expediente_id::text, codigo_expediente`,
  [id, numero, tipoDocumentalId, personaId, fecha]);
  await db().query(
    'INSERT INTO sigd_tra.tramite (expediente_id, asunto) VALUES ($1::uuid, $2)',
    [id, asunto]);
  return { id: resultado.rows[0].expediente_id, cut: resultado.rows[0].codigo_expediente };
}

async function crearPar(fecha: string, asunto: string): Promise<[ExpedienteFixture, ExpedienteFixture]> {
  return [
    await crearExpediente(fecha, `${asunto} A ${randomUUID().slice(0, 8)}`),
    await crearExpediente(fecha, `${asunto} B ${randomUUID().slice(0, 8)}`),
  ];
}

async function insertarMovimiento(
  expedienteId: string,
  estadoAnterior: string,
  evento: string,
  estadoNuevo: string,
  fechaHora: string,
): Promise<{ id: string; secuencia: string }> {
  const resultado = await db().query<{ id: string; secuencia: string }>(`
    INSERT INTO sigd_rut.movimiento_tramite
      (expediente_id, estado_anterior, evento, estado_nuevo,
       usuario_operador_id, fecha_hora, datos)
    VALUES ($1::uuid, $2, $3, $4, $5::bigint, $6::timestamptz, '{}'::jsonb)
    RETURNING id_movimiento::text AS id, secuencia::text`,
  [expedienteId, estadoAnterior, evento, estadoNuevo, actor.id, fechaHora]);
  return resultado.rows[0];
}

describe('RutaDoc contra PostgreSQL V2 original 01–07', () => {
  beforeAll(async () => {
    try {
      const redTemporal = await new Network().start();
      red = redTemporal;
      contenedor = await new PostgreSqlContainer(POSTGRES_IMAGE)
        .withDatabase(DATABASE)
        .withUsername('postgres')
        .withPassword('postgres')
        .withNetwork(redTemporal)
        .withAutoRemove(true)
        .start();

      const uri = new URL(contenedor.getConnectionUri());
      const puertoMapeado = String(contenedor.getMappedPort(5432));
      if (uri.protocol !== 'postgres:' || uri.port !== puertoMapeado ||
          ['5433', '5434'].includes(uri.port)) {
        throw new Error('El URI no corresponde exclusivamente al puerto dinámico del contenedor.');
      }
      if (uri.hostname !== contenedor.getHost() || uri.pathname !== `/${DATABASE}`) {
        throw new Error('El URI no identifica la base creada por este test.');
      }

      // No se consulta DATABASE_URL ni se inicia server.ts o el runner general.
      pool = new Pool({ connectionString: uri.toString(), max: 4 });
      const identidad = await db().query<{ database: string; port: number }>(
        'SELECT current_database() AS database, inet_server_port() AS port');
      if (identidad.rows[0]?.database !== DATABASE || Number(identidad.rows[0]?.port) !== 5432) {
        throw new Error('La conexión SQL no corresponde al PostgreSQL temporal esperado.');
      }

      for (const archivo of MIGRACIONES_V2) {
        const sql = readFileSync(path.resolve(process.cwd(), 'migraciones_v2', archivo), 'utf8');
        await db().query(sql);
      }
    } catch (error) {
      try {
        await cerrarRecursos();
      } catch (errorLimpieza) {
        throw new AggregateError([error, errorLimpieza], 'Falló la preparación y la limpieza del entorno aislado.');
      }
      throw error;
    }
  }, 180_000);

  afterAll(async () => cerrarRecursos());

  it('aplica 01–07 en orden y deja presentes las proyecciones, contadores y relaciones reales V2', async () => {
    const objetos = await db().query<{
      expediente: string | null;
      tramite: string | null;
      foliacion: string | null;
      estado: string | null;
      contador: string | null;
      movimiento: string | null;
      compensatorio: string | null;
      outbox: string | null;
      foliar: boolean;
      reporte: string | null;
    }>(`
      SELECT to_regclass('sigd_tra.expediente')::text AS expediente,
             to_regclass('sigd_tra.tramite')::text AS tramite,
             to_regclass('sigd_tra.expediente_documento_folio')::text AS foliacion,
             to_regclass('sigd_rut.estado_actual_expediente')::text AS estado,
             to_regclass('sigd_rut.contador_pestana_local')::text AS contador,
             to_regclass('sigd_rut.movimiento_tramite')::text AS movimiento,
             to_regclass('sigd_rut.movimiento_compensatorio')::text AS compensatorio,
             to_regclass('sigd_audit.evento_outbox')::text AS outbox,
             to_regprocedure('sigd_tra.agregar_folio_expediente(uuid,uuid,integer,uuid)') IS NOT NULL AS foliar,
             to_regclass('sigd_tra.v_reporte_expedientes_v2')::text AS reporte`);
    expect(Object.values(objetos.rows[0])).toEqual([
      'sigd_tra.expediente', 'sigd_tra.tramite', 'sigd_tra.expediente_documento_folio',
      'sigd_rut.estado_actual_expediente', 'sigd_rut.contador_pestana_local',
      'sigd_rut.movimiento_tramite', 'sigd_rut.movimiento_compensatorio',
      'sigd_audit.evento_outbox', true,
      'sigd_tra.v_reporte_expedientes_v2',
    ]);

    const triggers = await db().query<{ tgname: string }>(`
      SELECT tgname FROM pg_catalog.pg_trigger
       WHERE NOT tgisinternal AND tgname = ANY($1::text[])`,
    [['tr_tra_expediente_asignar_cut', 'tr_folio_continuidad',
      'tr_estado_actual_movimiento', 'tr_estado_actual_compensacion',
      'tr_contador_pestana_local', 'tr_rutadoc_contador_expediente']]);
    expect(triggers.rows.map((fila) => fila.tgname).sort()).toEqual([
      'tr_contador_pestana_local', 'tr_estado_actual_compensacion',
      'tr_estado_actual_movimiento', 'tr_folio_continuidad',
      'tr_rutadoc_contador_expediente', 'tr_tra_expediente_asignar_cut',
    ]);
  });

  it('lista dos expedientes UUID y pagina con cursor v2 estable sin duplicados ni omisiones', async () => {
    const [primero, segundo] = await crearPar('2026-10-01T17:00:00.000Z', 'Bandeja técnica');
    expect(primero.id).not.toBe(segundo.id);
    expect(primero.cut).toMatch(/^EXP-2026-\d{6}$/);
    expect(segundo.cut).toMatch(/^EXP-2026-\d{6}$/);

    const servicio = new ServicioRutaDoc(new RepositorioPostgresRutaDoc(db()));
    const filtros = { pestana: 'PENDIENTES' as const, limite: 1 };
    const paginaUno = await servicio.listar(filtros, actor);
    expect(paginaUno.elementos).toHaveLength(1);
    expect(paginaUno.tieneMas).toBe(true);
    expect(paginaUno.siguienteCursor).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(paginaUno.contadores.PENDIENTES).toBe(2);

    const paginaDos = await servicio.listar({ ...filtros, cursor: paginaUno.siguienteCursor! }, actor);
    expect(paginaDos.elementos).toHaveLength(1);
    expect(paginaDos.tieneMas).toBe(false);
    expect(paginaDos.siguienteCursor).toBeNull();

    const devueltos = [...paginaUno.elementos, ...paginaDos.elementos].map((e) => e.idExpediente);
    const ordenV2 = await db().query<{ expediente_id: string }>(`
      SELECT expediente_id::text FROM sigd_tra.expediente
       WHERE expediente_id = ANY($1::uuid[])
       ORDER BY fecha_radicacion DESC, expediente_id DESC`, [[primero.id, segundo.id]]);
    expect(devueltos).toEqual(ordenV2.rows.map((fila) => fila.expediente_id));
    expect(new Set(devueltos).size).toBe(2);
  });

  it('aísla la trazabilidad y la proyección de movimientos por expediente UUID', async () => {
    const [conMovimiento, sinMovimiento] = await crearPar('2026-10-02T17:00:00.000Z', 'Trazabilidad técnica');
    await insertarMovimiento(conMovimiento.id, 'REGISTRADO', 'RECEPCION', 'RECEPCIONADO',
      '2026-10-02T18:00:00.000Z');

    const trazabilidad = new RepositorioPostgresTrazabilidadRutaDoc(db());
    const delPrimero = await trazabilidad.listar(conMovimiento.id);
    const delSegundo = await trazabilidad.listar(sinMovimiento.id);
    expect(delPrimero).toHaveLength(1);
    expect(delPrimero[0]).toMatchObject({
      movimientoId: expect.stringMatching(/^[0-9a-f-]{36}$/i),
      secuencia: '1',
      usuarioOperadorId: actor.id,
      estadoNuevo: 'RECEPCIONADO',
    });
    expect(delSegundo).toEqual([]);

    const proyeccion = await db().query<{ estado_nuevo: string; secuencia: string }>(`
      SELECT estado_nuevo, secuencia::text FROM sigd_rut.estado_actual_expediente
       WHERE expediente_id = $1::uuid`, [conMovimiento.id]);
    expect(proyeccion.rows).toEqual([{ estado_nuevo: 'RECEPCIONADO', secuencia: '1' }]);
  });

  it('folia mediante la función V2 y recupera rangos inclusivos solo del expediente correspondiente', async () => {
    const [conFolios, sinFolios] = await crearPar('2026-10-03T17:00:00.000Z', 'Foliación técnica');
    const documentoUno = randomUUID();
    const documentoDos = randomUUID();
    const usuarioAsignador = randomUUID();
    await db().query(
      'SELECT * FROM sigd_tra.agregar_folio_expediente($1::uuid, $2::uuid, $3::integer, $4::uuid)',
      [conFolios.id, documentoUno, 3, usuarioAsignador]);
    await db().query(
      'SELECT * FROM sigd_tra.agregar_folio_expediente($1::uuid, $2::uuid, $3::integer, $4::uuid)',
      [conFolios.id, documentoDos, 2, usuarioAsignador]);

    const repositorio = new RepositorioPostgresFoliacionRutaDoc(db());
    expect(await repositorio.existeExpediente(conFolios.id)).toBe(true);
    expect(await repositorio.listar(conFolios.id)).toEqual([
      { idDocumento: documentoUno, folioInicio: 1, folioFin: 3, cantidadFolios: 3 },
      { idDocumento: documentoDos, folioInicio: 4, folioFin: 5, cantidadFolios: 2 },
    ]);
    expect(await repositorio.listar(sinFolios.id)).toEqual([]);

    const detalle = await new RepositorioPostgresRutaDoc(db()).obtener(conFolios.id);
    expect(detalle?.resumenDocumentos).toEqual({ cantidadDocumentos: 2, totalFolios: 5 });
  });

  it('lee el inicio del SLA desde fecha_radicacion en hora Lima', async () => {
    const [expediente] = await crearPar('2026-10-04T17:00:00.000Z', 'SLA técnico');
    const inicio = await new RepositorioSlaRutaDoc(db()).obtenerFechaInicio(expediente.id);
    expect(inicio).toBe('2026-10-04');
  });

  it('ejecuta reversión persistida con expediente/movimiento UUID y secuencia/actor numéricos', async () => {
    const [expediente, otroExpediente] = await crearPar('2026-10-05T17:00:00.000Z', 'Reversión técnica');
    await insertarMovimiento(expediente.id, 'REGISTRADO', 'RECEPCION', 'RECEPCIONADO',
      '2026-10-05T18:00:00.000Z');
    const objetivo = await insertarMovimiento(expediente.id, 'RECEPCIONADO',
      'INICIAR_CALIFICACION', 'EN_CALIFICACION', '2026-10-05T18:01:00.000Z');
    const comando = reversionSchema.parse({
      movimientoObjetivoId: objetivo.secuencia,
      motivo: 'Corrección técnica de integración aislada.',
      claveIdempotencia: randomUUID(),
    });
    const correlationId = randomUUID();
    const servicio = new ServicioReversionRutaDoc(
      new RepositorioReversionRutaDoc(db()),
      () => true,
    );
    const resultado = await runWithContext(
      crearContexto({ correlation_id: correlationId, usuario_id: actor.id }),
      () => servicio.revertir(expediente.id, comando, actor, correlationId),
    );

    expect(resultado).toMatchObject({
      expedienteId: expediente.id,
      movimientoRevertidoId: objetivo.secuencia,
      estadoAntesDeReversion: 'EN_CALIFICACION',
      estadoRestaurado: 'RECEPCIONADO',
      correlationId,
    });
    expect(resultado.movimientoCompensatorioUuid).toMatch(/^[0-9a-f-]{36}$/i);
    expect(resultado.movimientoCompensatorioId).toBe('3');

    const persistida = await db().query<{
      expediente_id: string;
      secuencia: string;
      usuario_operador_id: string;
      movimiento_objetivo_id: string;
    }>(`
      SELECT expediente_id::text, secuencia::text, usuario_operador_id::text,
             movimiento_objetivo_id::text
        FROM sigd_rut.movimiento_compensatorio
       WHERE id_movimiento = $1::uuid`, [resultado.movimientoCompensatorioUuid]);
    expect(persistida.rows[0]).toEqual({
      expediente_id: expediente.id,
      secuencia: '3',
      usuario_operador_id: actor.id,
      movimiento_objetivo_id: objetivo.id,
    });

    const otraTrazabilidad = await new RepositorioPostgresTrazabilidadRutaDoc(db()).listar(otroExpediente.id);
    expect(otraTrazabilidad).toEqual([]);
    const solicitud = await db().query<{ estado: string; correlation_id: string | null }>(`
      SELECT estado, id_evento_outbox::text AS correlation_id
        FROM sigd_rut.solicitud_compensacion_folios
       WHERE movimiento_compensatorio_id = $1::uuid`, [resultado.movimientoCompensatorioUuid]);
    expect(solicitud.rows).toEqual([{ estado: 'PENDIENTE', correlation_id: expect.any(String) }]);
    const evento = await db().query<{ correlation_id: string }>(`
      SELECT correlation_id::text FROM sigd_audit.evento_outbox WHERE id_evento = $1::uuid`,
    [solicitud.rows[0].correlation_id]);
    expect(evento.rows).toEqual([{ correlation_id: correlationId }]);
  });
});
