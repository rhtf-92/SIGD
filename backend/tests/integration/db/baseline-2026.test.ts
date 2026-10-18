import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ejecutarMigraciones } from '../../../src/db/migrate.js';
import { obtenerCuellosBotella, obtenerKpisMensualesDesdeVista, obtenerResumen } from
  '../../../src/modules/reportes/reportes.service.js';
import { RepositorioPostgresRutaDoc } from '../../../src/domains/rutadoc/rutadoc.repository.js';
import { RepositorioPostgresTrazabilidadRutaDoc } from '../../../src/domains/rutadoc/trazabilidad.repository.js';
import { RepositorioReversionRutaDoc } from '../../../src/domains/rutadoc/rutadoc.reversion.repository.js';
import { RepositorioPostgresFoliacionRutaDoc } from '../../../src/domains/rutadoc/foliacion.repository.js';
import { RepositorioSlaRutaDoc } from '../../../src/domains/rutadoc/sla.service.js';
import { ESTADOS_RUTADOC, EVENTOS_RUTADOC, TRANSICIONES_RUTADOC } from
  '../../../src/domains/rutadoc/rutadoc.fsm.js';

let contenedor: StartedPostgreSqlContainer;
let admin: Pool;
let indice = 0;
const perfil = 'BASELINE_2026_V1';
const nombres = [
  '01_sigd_audit.sql', '02_sigd_auth.sql', '03_sigd_org.sql',
  '04_sigd_doc.sql', '05_sigd_tra.sql', 'BASELINE_2026_V1.sql',
  '08_sigd_tupa_acoplamiento.sql',
];

async function baseAislada(): Promise<Pool> {
  const nombre = `baseline_${++indice}`;
  await admin.query(`CREATE DATABASE ${nombre}`);
  const url = new URL(contenedor.getConnectionUri());
  url.pathname = `/${nombre}`;
  return new Pool({ connectionString: url.toString(), max: 4 });
}

function ruta(nombre: string): string {
  return path.resolve(process.cwd(), nombre === `${perfil}.sql` ? 'baselines' : 'migraciones', nombre);
}

describe('runner optativo BASELINE_2026_V1 en PostgreSQL 18 descartable', () => {
  beforeAll(async () => {
    contenedor = await new PostgreSqlContainer('postgres:18-alpine').start();
    admin = new Pool({ connectionString: contenedor.getConnectionUri() });
  }, 120_000);

  afterEach(() => {
    delete process.env.SIGD_MIGRATION_PROFILE;
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await admin?.end();
    await contenedor?.stop();
  });

  it('rechaza perfil desconocido antes de conectar o escribir', async () => {
    const pool = await baseAislada();
    process.env.SIGD_MIGRATION_PROFILE = 'OTRO';
    try {
      await expect(ejecutarMigraciones(pool)).rejects.toThrow('no reconocido');
      expect((await pool.query("SELECT to_regclass('public.sigd_migraciones') AS ledger")).rows[0].ledger).toBeNull();
    } finally { await pool.end(); }
  });

  it('sin perfil intenta el orden histórico 01–08 y no usa el baseline', async () => {
    const pool = await baseAislada();
    const log = vi.spyOn(console, 'log');
    try {
      await expect(ejecutarMigraciones(pool)).rejects.toBeDefined();
      const mensajes = log.mock.calls.map((fila) => String(fila[0]));
      expect(mensajes.some((mensaje) => mensaje.includes('06_sigd_rut.sql'))).toBe(true);
      expect(mensajes.some((mensaje) => mensaje.includes('BASELINE_2026_V1.sql'))).toBe(false);
      expect((await pool.query("SELECT to_regclass('public.sigd_migraciones') AS ledger")).rows[0].ledger).toBeNull();
    } finally { await pool.end(); }
  }, 120_000);

  it('instala solo 01–05, baseline y 08 con checksums reales, y reejecuta sin cambios', async () => {
    const pool = await baseAislada();
    process.env.SIGD_MIGRATION_PROFILE = perfil;
    try {
      expect(await ejecutarMigraciones(pool)).toEqual(nombres);
      const ledger = await pool.query<{ nombre_script: string; checksum_sha256: string }>(
        'SELECT nombre_script, checksum_sha256 FROM public.sigd_migraciones ORDER BY id');
      expect(ledger.rows.map((fila) => fila.nombre_script)).toEqual(nombres);
      for (const fila of ledger.rows) {
        expect(fila.checksum_sha256).toBe(crypto.createHash('sha256').update(fs.readFileSync(ruta(fila.nombre_script))).digest('hex'));
      }
      const estados = await pool.query<{ codigo: string }>('SELECT codigo FROM sigd_rut.estado_tramite ORDER BY codigo');
      expect(estados.rows.map((fila) => fila.codigo).sort()).toEqual([...ESTADOS_RUTADOC].sort());
      const eventos = await pool.query<{ codigo: string }>('SELECT codigo FROM sigd_rut.accion_tramite ORDER BY codigo');
      expect(eventos.rows.map((fila) => fila.codigo).sort()).toEqual([...EVENTOS_RUTADOC].sort());
      const aristas = await pool.query<{ estado_anterior: string; evento: string; estado_nuevo: string }>(
        'SELECT estado_anterior, evento, estado_nuevo FROM sigd_rut.transicion_estado_tramite ORDER BY 1, 2, 3');
      const esperadas = Object.entries(TRANSICIONES_RUTADOC).flatMap(([origen, transiciones]) =>
        Object.entries(transiciones).map(([evento, destino]) => ({
          estado_anterior: origen, evento, estado_nuevo: destino,
        })));
      const claves = (filas: Array<{ estado_anterior: string; evento: string; estado_nuevo: string }>) => filas.map((fila) =>
        `${fila.estado_anterior}/${fila.evento}/${fila.estado_nuevo}`).sort();
      expect(claves(aristas.rows)).toEqual(claves(esperadas));
      expect(aristas.rows).toHaveLength(13);
      expect(await ejecutarMigraciones(pool)).toEqual([]);
      expect((await pool.query('SELECT count(*)::int AS total FROM public.sigd_migraciones')).rows[0].total).toBe(7);
    } finally { await pool.end(); }
  }, 120_000);

  it('rechaza una tabla preexistente sin crear ledger', async () => {
    const pool = await baseAislada();
    process.env.SIGD_MIGRATION_PROFILE = perfil;
    try {
      await pool.query('CREATE TABLE public.ajena (id integer)');
      await expect(ejecutarMigraciones(pool)).rejects.toThrow('no está vacío');
      expect((await pool.query("SELECT to_regclass('public.sigd_migraciones') AS ledger")).rows[0].ledger).toBeNull();
    } finally { await pool.end(); }
  });

  it('rechaza ledger parcial y checksum alterado', async () => {
    const pool = await baseAislada();
    process.env.SIGD_MIGRATION_PROFILE = perfil;
    try {
      await pool.query(`CREATE TABLE public.sigd_migraciones (
        id SERIAL PRIMARY KEY, nombre_script VARCHAR(255) NOT NULL UNIQUE,
        checksum_sha256 CHAR(64) NOT NULL, ejecutado_en TIMESTAMPTZ NOT NULL DEFAULT now())`);
      await pool.query("INSERT INTO public.sigd_migraciones (nombre_script, checksum_sha256) VALUES ('01_sigd_audit.sql', 'incorrecto')");
      await expect(ejecutarMigraciones(pool)).rejects.toThrow('ledger parcial');
      expect((await pool.query('SELECT count(*)::int AS total FROM public.sigd_migraciones')).rows[0].total).toBe(1);
    } finally { await pool.end(); }
  });

  it('acepta ledger vacío con estructura oficial, y rechaza uno desconocido', async () => {
    const vacia = await baseAislada();
    const desconocida = await baseAislada();
    process.env.SIGD_MIGRATION_PROFILE = perfil;
    try {
      await vacia.query(`CREATE TABLE public.sigd_migraciones (
        id SERIAL PRIMARY KEY, nombre_script VARCHAR(255) NOT NULL UNIQUE,
        checksum_sha256 CHAR(64) NOT NULL, ejecutado_en TIMESTAMPTZ NOT NULL DEFAULT now())`);
      expect(await ejecutarMigraciones(vacia)).toEqual(nombres);
      await desconocida.query('CREATE TABLE public.sigd_migraciones (nombre_script text)');
      await expect(ejecutarMigraciones(desconocida)).rejects.toThrow('estructura desconocida');
      expect((await desconocida.query('SELECT count(*)::int AS n FROM public.sigd_migraciones')).rows[0].n).toBe(0);
    } finally {
      await vacia.end();
      await desconocida.end();
    }
  }, 120_000);

  it('rechaza checksum distinto o un objeto físico ausente en instalación registrada', async () => {
    const pool = await baseAislada();
    process.env.SIGD_MIGRATION_PROFILE = perfil;
    try {
      await ejecutarMigraciones(pool);
      await pool.query("UPDATE public.sigd_migraciones SET checksum_sha256 = repeat('0',64) WHERE nombre_script = $1", [nombres[0]]);
      await expect(ejecutarMigraciones(pool)).rejects.toThrow('checksum distinto');
      await pool.query('UPDATE public.sigd_migraciones SET checksum_sha256 = $2 WHERE nombre_script = $1',
        [nombres[0], crypto.createHash('sha256').update(fs.readFileSync(ruta(nombres[0]))).digest('hex')]);
      await pool.query('DROP MATERIALIZED VIEW sigd_tra.mv_tiempos_retencion_area');
      await expect(ejecutarMigraciones(pool)).rejects.toThrow('contrato físico');
    } finally { await pool.end(); }
  }, 120_000);

  it('serializa dos ejecuciones simultáneas con el advisory lock', async () => {
    const pool = await baseAislada();
    process.env.SIGD_MIGRATION_PROFILE = perfil;
    try {
      const resultados = await Promise.all([ejecutarMigraciones(pool), ejecutarMigraciones(pool)]);
      expect(resultados.map((fila) => fila.length).sort()).toEqual([0, 7]);
      expect((await pool.query('SELECT count(*)::int AS total FROM public.sigd_migraciones')).rows[0].total).toBe(7);
    } finally { await pool.end(); }
  }, 120_000);

  it('conserva expediente UUID sin movimientos y vistas sin doble conteo', async () => {
    const pool = await baseAislada();
    process.env.SIGD_MIGRATION_PROFILE = perfil;
    try {
      await ejecutarMigraciones(pool);
      const persona = await pool.query<{ id_persona: string }>(
        "INSERT INTO sigd_auth.persona (tipo, id_documento) VALUES ('NATURAL', $1) RETURNING id_persona",
        [`T${randomUUID().replaceAll('-', '').slice(0, 18)}`]);
      const expediente = await pool.query<{ expediente_id: string }>(
        `INSERT INTO sigd_tra.expediente (codigo_expediente, numero, tipo_documental_id, solicitante_id)
         VALUES (NULL, $1, $2, $3) RETURNING expediente_id`,
        [randomUUID().slice(0, 24), randomUUID(), persona.rows[0].id_persona]);
      const id = expediente.rows[0].expediente_id;
      expect(id).toMatch(/^[0-9a-f-]{36}$/);
      expect((await pool.query('SELECT count(*)::int AS n FROM sigd_tra.vw_mgd_expediente_base WHERE expediente_id = $1::uuid', [id])).rows[0].n).toBe(1);
      await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY sigd_tra.mv_kpis_mgd_mensual');
      expect((await pool.query('SELECT sum(n_radicados)::int AS n FROM sigd_tra.mv_kpis_mgd_mensual')).rows[0].n).toBe(1);
      await pool.query(`INSERT INTO sigd_rut.movimiento_tramite
        (expediente_id, estado_anterior, evento, estado_nuevo, usuario_operador_id)
        VALUES ($1::uuid, 'REGISTRADO', 'RECEPCION', 'RECEPCIONADO', 1)`, [id]);
      await pool.query(`INSERT INTO sigd_rut.movimiento_tramite
        (expediente_id, estado_anterior, evento, estado_nuevo, usuario_operador_id)
        VALUES ($1::uuid, 'RECEPCIONADO', 'INICIAR_CALIFICACION', 'EN_CALIFICACION', 1)`, [id]);
      await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY sigd_tra.mv_kpis_mgd_mensual');
      expect((await pool.query('SELECT sum(n_radicados)::int AS n FROM sigd_tra.mv_kpis_mgd_mensual')).rows[0].n).toBe(1);
      expect((await pool.query('SELECT estado_nuevo FROM sigd_rut.estado_actual_expediente WHERE expediente_id = $1::uuid', [id])).rows[0].estado_nuevo).toBe('EN_CALIFICACION');
      expect((await pool.query('SELECT count(*)::int AS n FROM sigd_doc.expediente_tupa_vinculo')).rows[0].n).toBe(0);
      const columnas = await pool.query<{ tipo: string }>(`
        SELECT a.atttypid::regtype::text AS tipo FROM pg_catalog.pg_attribute a
         WHERE a.attrelid = 'sigd_rut.movimiento_tramite'::regclass
           AND a.attname = 'expediente_id'`);
      expect(columnas.rows[0].tipo).toBe('uuid');
      const fk = await pool.query<{ total: number }>(`
        SELECT count(*)::int AS total FROM pg_catalog.pg_constraint
         WHERE conname = 'fk_rut_movimiento_expediente' AND contype = 'f'
           AND confrelid = 'sigd_tra.expediente'::regclass`);
      expect(fk.rows[0].total).toBeGreaterThanOrEqual(1);
      const contadores = await pool.query<{ pestana: string; cantidad: string }>(
        'SELECT pestana, cantidad::text FROM sigd_rut.contador_pestana_local ORDER BY pestana');
      expect(contadores.rows).toHaveLength(6);
      expect(contadores.rows.reduce((total, fila) => total + Number(fila.cantidad), 0)).toBe(1);
      const refresco = await pool.query('SELECT vista FROM sigd_tra.refrescar_vistas_mgd()');
      expect(refresco.rows).toHaveLength(2);
      const vistas = await pool.query<{ total: number }>(`
        SELECT (SELECT count(*) FROM sigd_tra.mv_kpis_mgd_mensual)::int +
               (SELECT count(*) FROM sigd_tra.mv_tiempos_retencion_area)::int AS total`);
      expect(vistas.rows[0].total).toBe(2);
      const hoy = new Date().toISOString().slice(0, 10);
      const mensual = await obtenerKpisMensualesDesdeVista(pool, `${hoy.slice(0, 7)}-01`, hoy);
      expect(mensual).toHaveLength(1);
      expect(mensual[0].radicados).toBe(1);
      expect((await obtenerResumen(pool, { desde: hoy, hasta: hoy })).totalRadicados).toBe(1);
      const cuellos = await obtenerCuellosBotella(pool, { desde: hoy, hasta: hoy, limite: 20 });
      expect(cuellos.cuelloBotella.reduce((n, fila) => n + fila.expedientes, 0)).toBe(1);
      const duracion = await pool.query<{ calendario: number; habiles: string }>(`
        SELECT (EXTRACT(EPOCH FROM (TIMESTAMPTZ '2026-10-01 10:00+00' -
                                     TIMESTAMPTZ '2026-09-24 10:00+00')) / 3600)::float8 AS calendario,
               sigd_tra.fn_mgd_horas_habiles(TIMESTAMPTZ '2026-09-24 10:00+00',
                   TIMESTAMPTZ '2026-10-01 10:00+00')::text AS habiles`);
      expect(duracion.rows[0].calendario).toBe(168);
      expect(Number(duracion.rows[0].habiles)).toBe(120);
      const version = await pool.query<{ registro_version_id: string }>(`
        INSERT INTO sigd_doc.tupa_registro_version
          (documento_sha256, fuente_nombre, pagina, referencia_fila,
           denominacion_original, estado_validacion, referencia_aprobacion)
        VALUES ($1, 'fuente de prueba', 1, 'fila-1', 'Procedimiento de prueba',
                'APROBADO', 'acta de prueba') RETURNING registro_version_id`, ['a'.repeat(64)]);
      await pool.query(`INSERT INTO sigd_doc.expediente_tupa_vinculo
        (expediente_id, registro_version_id) VALUES ($1::uuid, $2::uuid)`, [id, version.rows[0].registro_version_id]);
      expect((await pool.query('SELECT count(*)::int AS n FROM sigd_doc.expediente_tupa_vinculo')).rows[0].n).toBe(1);
      const rutadoc = new RepositorioPostgresRutaDoc(pool);
      expect((await rutadoc.obtener(id))?.estadoActual).toBe('EN_CALIFICACION');
      expect(await new RepositorioPostgresFoliacionRutaDoc(pool).listar(id)).toEqual([]);
      expect(await new RepositorioSlaRutaDoc(pool).obtenerFechaInicio(id)).toBe(hoy);
      await pool.query(`INSERT INTO sigd_rut.movimiento_tramite
        (expediente_id, estado_anterior, evento, estado_nuevo, usuario_operador_id)
        VALUES ($1::uuid, 'EN_CALIFICACION', 'DERIVACION', 'DERIVADO', 1)`, [id]);
      expect((await pool.query("SELECT cantidad::int AS n FROM sigd_rut.contador_pestana_local WHERE pestana = 'DERIVADOS'")).rows[0].n).toBe(1);
      const reversion = new RepositorioReversionRutaDoc(pool);
      const original = await reversion.conBloqueo(id, async (clienteReversion) => {
        const objetivo = await reversion.objetivo(clienteReversion, id, '3');
        expect(objetivo).not.toBeNull();
        if (!objetivo) throw new Error('Movimiento objetivo ausente');
        await reversion.insertar(clienteReversion, {
          objetivo, usuarioOperadorId: '1', motivo: 'Reversión administrativa de prueba',
          claveIdempotencia: randomUUID(), huellaComando: 'huella-de-prueba',
          correlationId: randomUUID(), compensacionFolios: {
            estado: 'PENDIENTE', movimientoRelacionadoId: objetivo.idMovimiento,
            rangoAfectado: null, referencia: randomUUID(),
          },
        });
        return objetivo;
      });
      expect((await rutadoc.obtener(id))?.estadoActual).toBe('EN_CALIFICACION');
      expect((await pool.query('SELECT count(*)::int AS n FROM sigd_rut.movimiento_tramite WHERE id_movimiento = $1::uuid',
        [original.idMovimiento])).rows[0].n).toBe(1);
      expect((await pool.query('SELECT count(*)::int AS n FROM sigd_rut.movimiento_compensatorio WHERE expediente_id = $1::uuid',
        [id])).rows[0].n).toBe(1);
      expect((await pool.query("SELECT cantidad::int AS n FROM sigd_rut.contador_pestana_local WHERE pestana = 'DERIVADOS'")).rows[0].n).toBe(0);
      expect((await new RepositorioPostgresTrazabilidadRutaDoc(pool).listar(id))).toHaveLength(4);
      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        await cliente.query('SAVEPOINT antes');
        await expect(cliente.query('TRUNCATE sigd_doc.expediente_tupa_vinculo')).rejects.toMatchObject({ code: '23001' });
        await cliente.query('ROLLBACK TO SAVEPOINT antes');
        await cliente.query('COMMIT');
      } finally { cliente.release(); }
      expect((await pool.query('SELECT count(*)::int AS n FROM sigd_doc.expediente_tupa_vinculo')).rows[0].n).toBe(1);
    } finally { await pool.end(); }
  }, 120_000);

  it('un fallo deliberado dentro del baseline revierte el ledger y todos los objetos', async () => {
    const pool = await baseAislada();
    process.env.SIGD_MIGRATION_PROFILE = perfil;
    const original = fs.readFileSync.bind(fs);
    vi.spyOn(fs, 'readFileSync').mockImplementation(((archivo: string, ...args: unknown[]) => {
      const contenido = original(archivo, ...(args as [BufferEncoding]));
      return String(archivo).endsWith(`${perfil}.sql`) ? `${contenido}\nSELECT 1/0;` : contenido;
    }) as typeof fs.readFileSync);
    try {
      await expect(ejecutarMigraciones(pool)).rejects.toBeDefined();
      expect((await pool.query("SELECT to_regclass('public.sigd_migraciones') AS ledger")).rows[0].ledger).toBeNull();
      expect((await pool.query("SELECT to_regclass('sigd_rut.movimiento_tramite') AS tabla")).rows[0].tabla).toBeNull();
    } finally { await pool.end(); }
  }, 120_000);
});
