import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RepositorioPostgresRutaDoc } from '../../../../src/domains/rutadoc/rutadoc.repository.js';
import { RepositorioPostgresTrazabilidadRutaDoc } from '../../../../src/domains/rutadoc/trazabilidad.repository.js';
import { RepositorioPostgresFoliacionRutaDoc } from '../../../../src/domains/rutadoc/foliacion.repository.js';
import { RepositorioSlaRutaDoc } from '../../../../src/domains/rutadoc/sla.service.js';
import { RepositorioReversionRutaDoc } from '../../../../src/domains/rutadoc/rutadoc.reversion.repository.js';
import { codificarCursor, decodificarCursor } from '../../../../src/domains/rutadoc/rutadoc.cursor.js';

const alto = 'ffffffff-ffff-4fff-8fff-fffffffffff1';
const bajo = '00000000-0000-4000-8000-000000000002';
const fecha = '2026-09-24T10:00:00.000Z';
let contenedor: StartedPostgreSqlContainer;
let pool: Pool;

async function crearExpediente(id: string, asunto: string): Promise<void> {
  const persona = await pool.query<{ id_persona: string }>(
    "INSERT INTO sigd_auth.persona (tipo, id_documento) VALUES ('NATURAL', $1) RETURNING id_persona",
    [`T${randomUUID().replaceAll('-', '').slice(0, 18)}`],
  );
  await pool.query(`INSERT INTO sigd_tra.expediente
    (expediente_id, codigo_expediente, numero, tipo_documental_id, solicitante_id, fecha_radicacion)
    VALUES ($1::uuid, NULL, $2, $3::uuid, $4::uuid, $5::timestamptz)`,
  [id, `PR-${randomUUID().slice(0, 8)}`, randomUUID(), persona.rows[0].id_persona, fecha]);
  await pool.query('INSERT INTO sigd_tra.tramite (expediente_id, asunto) VALUES ($1::uuid, $2)', [id, asunto]);
}

describe('Contrato UUID de RutaDoc sobre el DDL 05 en PostgreSQL 18 aislado', () => {
  beforeAll(async () => {
    contenedor = await new PostgreSqlContainer('postgres:18-alpine').withDatabase('sigd_rutadoc_uuid_test').start();
    pool = new Pool({ connectionString: contenedor.getConnectionUri() });
    for (const nombre of ['01_sigd_audit.sql', '02_sigd_auth.sql', '03_sigd_org.sql',
      '04_sigd_doc.sql', '05_sigd_tra.sql']) {
      await pool.query(readFileSync(path.resolve(process.cwd(), 'migraciones', nombre), 'utf8'));
    }
    // Proyección UUID efímera de lectura: no es el baseline de producción.
    await pool.query(`CREATE SCHEMA sigd_rut;
      CREATE TABLE sigd_rut.estado_actual_expediente (
        expediente_id UUID PRIMARY KEY, estado_nuevo TEXT NOT NULL, area_actual_id TEXT,
        id_movimiento UUID, evento TEXT, fecha_hora TIMESTAMPTZ, usuario_operador_id BIGINT);
      CREATE TABLE sigd_rut.contador_pestana_local (pestana TEXT PRIMARY KEY, cantidad BIGINT NOT NULL);
      INSERT INTO sigd_rut.contador_pestana_local VALUES
        ('PENDIENTES',0), ('EN_TRAMITE',0), ('DERIVADOS',0),
        ('POR_FIRMAR',0), ('ATENDIDOS',0), ('ARCHIVADOS',0);
      CREATE TABLE sigd_rut.movimiento_tramite (
        id_movimiento UUID PRIMARY KEY DEFAULT gen_random_uuid(), expediente_id UUID NOT NULL,
        secuencia BIGINT NOT NULL, fecha_hora TIMESTAMPTZ NOT NULL, estado_anterior TEXT NOT NULL,
        evento TEXT NOT NULL, estado_nuevo TEXT NOT NULL, usuario_operador_id BIGINT NOT NULL,
        datos JSONB NOT NULL DEFAULT '{}'::jsonb);
      CREATE TABLE sigd_rut.movimiento_compensatorio
        (LIKE sigd_rut.movimiento_tramite INCLUDING DEFAULTS);
      ALTER TABLE sigd_rut.movimiento_compensatorio
        ALTER COLUMN secuencia SET DEFAULT 3,
        ALTER COLUMN fecha_hora SET DEFAULT CURRENT_TIMESTAMP,
        ALTER COLUMN evento SET DEFAULT 'REVERSION_ADMINISTRATIVA',
        ADD COLUMN motivo TEXT,
        ADD COLUMN correlation_id TEXT,
        ADD COLUMN clave_idempotencia UUID,
        ADD COLUMN movimiento_objetivo_fecha_hora TIMESTAMPTZ,
        ADD COLUMN movimiento_objetivo_id UUID,
        ADD COLUMN movimiento_objetivo_secuencia BIGINT,
        ADD COLUMN huella_comando TEXT,
        ADD COLUMN compensacion_folios JSONB;`);
    await crearExpediente(alto, 'Solicitud alta');
    await crearExpediente(bajo, 'Solicitud baja');
    await pool.query(`INSERT INTO sigd_rut.movimiento_tramite
      (expediente_id, secuencia, fecha_hora, estado_anterior, evento, estado_nuevo, usuario_operador_id)
      VALUES ($1::uuid, 1, $2::timestamptz, 'REGISTRADO', 'RECEPCION', 'RECEPCIONADO', 7)`,
    [alto, '2026-09-24T10:01:00.000Z']);
    await pool.query(`INSERT INTO sigd_rut.estado_actual_expediente
      (expediente_id, estado_nuevo, id_movimiento, evento, fecha_hora, usuario_operador_id)
      SELECT expediente_id, estado_nuevo, id_movimiento, evento, fecha_hora, usuario_operador_id
        FROM sigd_rut.movimiento_tramite WHERE expediente_id = $1::uuid`, [alto]);
  });

  afterAll(async () => {
    await pool?.end();
    await contenedor?.stop();
  });

  it('lista el expediente sin movimiento y pagina UUID con orden estable', async () => {
    const repo = new RepositorioPostgresRutaDoc(pool);
    const filtros = { pestana: 'PENDIENTES' as const, limite: 1 };
    const primera = await repo.listar(filtros, ['REGISTRADO', 'RECEPCIONADO'], null);
    expect(primera.elementos.map((fila) => fila.idExpediente)).toEqual([alto, bajo]);
    expect(primera.porPestana?.PENDIENTES).toBe(2);
    const cursor = codificarCursor({ fechaRadicacion: fecha, idExpediente: alto }, filtros);
    const posicion = decodificarCursor(cursor, filtros);
    const segunda = await repo.listar(filtros, ['REGISTRADO', 'RECEPCIONADO'], posicion);
    expect(segunda.elementos.map((fila) => fila.idExpediente)).toEqual([bajo]);
    expect(new Set([primera.elementos[0].idExpediente, segunda.elementos[0].idExpediente]).size).toBe(2);
  });

  it('consulta detalle y filtra término mediante parámetros sin cruzar identidades', async () => {
    const repo = new RepositorioPostgresRutaDoc(pool);
    const detalle = await repo.obtener(bajo);
    expect(detalle).toMatchObject({ idExpediente: bajo, asunto: 'Solicitud baja',
      estadoActual: 'REGISTRADO', ultimoMovimiento: null });
    const filtrado = await repo.listar({ pestana: 'PENDIENTES', limite: 20,
      terminoBusqueda: 'baja' }, ['REGISTRADO'], null);
    expect(filtrado.elementos.map((fila) => fila.idExpediente)).toEqual([bajo]);
    expect((await repo.listar({ pestana: 'PENDIENTES', limite: 20,
      terminoBusqueda: "' OR 1=1 --" }, ['REGISTRADO'], null)).elementos).toEqual([]);
  });

  it('aísla la trazabilidad de dos UUID y conserva el expediente sin movimientos', async () => {
    const repo = new RepositorioPostgresTrazabilidadRutaDoc(pool);
    expect(await repo.existeExpediente(alto)).toBe(true);
    expect(await repo.existeExpediente(bajo)).toBe(true);
    expect((await repo.listar(alto)).map((fila) => fila.secuencia)).toEqual(['1']);
    expect(await repo.listar(bajo)).toEqual([]);
  });

  it('resuelve foliación, SLA y existencia para reversión mediante UUID físico', async () => {
    const documento = randomUUID();
    await pool.query(`INSERT INTO sigd_tra.expediente_documento_folio
      (expediente_id, id_documento, folio_inicio, folio_fin)
      VALUES ($1::uuid, $2::uuid, 1, 3)`, [alto, documento]);
    const folios = new RepositorioPostgresFoliacionRutaDoc(pool);
    expect((await folios.listar(alto))[0]).toMatchObject({ idDocumento: documento, cantidadFolios: 3 });
    expect(await folios.listar(bajo)).toEqual([]);
    expect(await new RepositorioSlaRutaDoc(pool).obtenerFechaInicio(alto)).toBe('2026-09-24');
    const cliente = await pool.connect();
    try {
      expect(await new RepositorioReversionRutaDoc(pool).existeExpediente(cliente, alto)).toBe(true);
      expect(await new RepositorioReversionRutaDoc(pool).existeExpediente(cliente, randomUUID())).toBe(false);
    } finally {
      cliente.release();
    }
  });

  it('lee e inserta compensación con UUID sin convertir la secuencia ni el actor', async () => {
    await pool.query(`INSERT INTO sigd_rut.movimiento_tramite
      (expediente_id, secuencia, fecha_hora, estado_anterior, evento, estado_nuevo, usuario_operador_id)
      VALUES ($1::uuid, 2, '2026-09-24T10:02:00Z', 'RECEPCIONADO',
              'INICIAR_CALIFICACION', 'EN_CALIFICACION', 7)`, [alto]);
    const cliente = await pool.connect();
    try {
      await cliente.query('BEGIN');
      const repo = new RepositorioReversionRutaDoc(pool);
      const objetivo = await repo.objetivo(cliente, alto, '2');
      expect(objetivo).toMatchObject({ expedienteId: alto, secuencia: '2' });
      const creada = await repo.insertar(cliente, {
        objetivo: objetivo!, usuarioOperadorId: '7', motivo: 'Reversión de prueba con UUID',
        claveIdempotencia: randomUUID(), huellaComando: 'huella-prueba', correlationId: 'corr-uuid',
        compensacionFolios: { estado: 'PENDIENTE', movimientoRelacionadoId: objetivo!.idMovimiento,
          rangoAfectado: null, referencia: null },
      });
      expect(creada.expediente_id).toBe(alto);
      expect(creada.secuencia).toBe('3');
      await cliente.query('ROLLBACK');
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }
    const total = await pool.query<{ total: string }>(
      'SELECT count(*)::text AS total FROM sigd_rut.movimiento_compensatorio WHERE expediente_id = $1::uuid',
      [alto],
    );
    expect(total.rows[0].total).toBe('0');
  });
});
