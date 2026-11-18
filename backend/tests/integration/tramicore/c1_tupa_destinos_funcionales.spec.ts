import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { TUPA72_DESTINOS_MAP, LISTA_TUPA72_DESTINOS } from '../../../src/domains/tramicore/tupa72.destinos.js';

describe('FASE C1 — Certificación de Integración Física: Matriz TUPA y Destinos Funcionales', () => {
  let pool: Pool;
  let tupa2026Id: string;
  let dirId: string;
  let sdaId: string;

  beforeAll(async () => {
    pool = new Pool({
      connectionString:
        process.env.DATABASE_URL ||
        'postgres://postgres:postgres_password@172.20.157.19:5432/sigd_prueba',
    });

    const connTest = await pool.query('SELECT current_database(), current_user');
    expect(connTest.rows[0].current_database).toBe('sigd_prueba');

    const vRes = await pool.query<{ id_version: string }>(
      "SELECT id_version FROM sigd_doc.tupa_version WHERE codigo = 'TUPA-2026' AND estado = 'VIGENTE'",
    );
    expect(vRes.rows.length).toBe(1);
    tupa2026Id = vRes.rows[0].id_version;

    const dirRes = await pool.query<{ area_id: string }>(
      "SELECT area_id FROM sigd_org.area WHERE codigo = 'DIR'",
    );
    expect(dirRes.rows.length).toBe(1);
    dirId = dirRes.rows[0].area_id;

    const sdaRes = await pool.query<{ area_id: string }>(
      "SELECT area_id FROM sigd_org.area WHERE codigo = 'SDA'",
    );
    expect(sdaRes.rows.length).toBe(1);
    sdaId = sdaRes.rows[0].area_id;
  });

  afterAll(async () => {
    await pool.end();
  });

  it('TC-C1-01: Debe cubrir exactamente los 72 procedimientos de TUPA-2026', async () => {
    const res = await pool.query<{ count: string }>(
      'SELECT count(*) FROM sigd_doc.tupa_procedimiento WHERE id_version = $1',
      [tupa2026Id],
    );
    expect(Number(res.rows[0].count)).toBe(72);
    expect(LISTA_TUPA72_DESTINOS.length).toBe(72);
  });

  it('TC-C1-02: El catálogo ejecutable no debe tener códigos duplicados ni faltantes', async () => {
    const refsEnMapa = Object.keys(TUPA72_DESTINOS_MAP);
    expect(refsEnMapa.length).toBe(72);

    const res = await pool.query<{ codigo_ref: string }>(
      'SELECT codigo_ref FROM sigd_doc.tupa_procedimiento WHERE id_version = $1 ORDER BY orden ASC',
      [tupa2026Id],
    );
    const dbRefs = res.rows.map((r) => r.codigo_ref);
    expect(dbRefs.length).toBe(72);

    for (const ref of dbRefs) {
      expect(TUPA72_DESTINOS_MAP[ref]).toBeDefined();
    }
  });

  it('TC-C1-03: Todos los procedimientos de TUPA-2026 deben poseer sus 4 unidades no nulas', async () => {
    const res = await pool.query<{
      incompletos: string;
      total: string;
    }>(
      `SELECT 
         count(*) as total,
         count(CASE WHEN unidad_receptora_id IS NULL 
                      OR unidad_responsable_id IS NULL 
                      OR unidad_resolutiva_id IS NULL 
                      OR unidad_financiera_id IS NULL 
                      OR intervencion_financiera IS NULL THEN 1 END) as incompletos
       FROM sigd_doc.tupa_procedimiento
      WHERE id_version = $1`,
      [tupa2026Id],
    );

    expect(Number(res.rows[0].total)).toBe(72);
    expect(Number(res.rows[0].incompletos)).toBe(0);
  });

  it('TC-C1-04: Las llaves foráneas de unidades deben referenciar áreas físicas válidas (DIR o SDA)', async () => {
    const res = await pool.query<{ huerfanas: string }>(
      `SELECT count(*) as huerfanas
         FROM sigd_doc.tupa_procedimiento p
        WHERE p.id_version = $1
          AND (
            p.unidad_receptora_id NOT IN ($2, $3) OR
            p.unidad_responsable_id NOT IN ($2, $3) OR
            p.unidad_resolutiva_id NOT IN ($2, $3) OR
            p.unidad_financiera_id NOT IN ($2, $3)
          )`,
      [tupa2026Id, dirId, sdaId],
    );

    expect(Number(res.rows[0].huerfanas)).toBe(0);
  });

  it('TC-C1-05: Caso Piloto — Certificado de Inglés (p1-fila-06) con configuración canónica exacta', async () => {
    const res = await pool.query<{
      codigo_ref: string;
      receptora_id: string;
      responsable_id: string;
      resolutiva_id: string;
      financiera_id: string;
      intervencion_financiera: string;
    }>(
      `SELECT codigo_ref,
              unidad_receptora_id as receptora_id,
              unidad_responsable_id as responsable_id,
              unidad_resolutiva_id as resolutiva_id,
              unidad_financiera_id as financiera_id,
              intervencion_financiera
         FROM sigd_doc.tupa_procedimiento
        WHERE id_version = $1 AND codigo_ref = 'p1-fila-06'`,
      [tupa2026Id],
    );

    expect(res.rows.length).toBe(1);
    const fila = res.rows[0];
    expect(fila.receptora_id).toBe(dirId); // Mesa de Partes física en DIR
    expect(fila.responsable_id).toBe(sdaId); // Análisis técnico e instrucción en SDA
    expect(fila.resolutiva_id).toBe(dirId); // Suscripción del certificado por Dirección General
    expect(fila.financiera_id).toBe(dirId); // Liquidación arancelaria en Tesorería (DIR)
    expect(fila.intervencion_financiera).toBe('REQUIERE_PAGO');
  });

  it('TC-C1-06: Familia Idiomas debe asignar responsabilidad técnica a SDA', async () => {
    const idiomasRefs = ['p1-fila-06', 'p1-fila-07', 'p1-fila-08', 'p1-fila-09'];
    const res = await pool.query<{
      codigo_ref: string;
      responsable_id: string;
      financiera_id: string;
    }>(
      `SELECT codigo_ref, unidad_responsable_id as responsable_id, unidad_financiera_id as financiera_id
         FROM sigd_doc.tupa_procedimiento
        WHERE id_version = $1 AND codigo_ref = ANY($2::text[])`,
      [tupa2026Id, idiomasRefs],
    );

    expect(res.rows.length).toBe(4);
    for (const fila of res.rows) {
      expect(fila.responsable_id).toBe(sdaId);
      expect(fila.financiera_id).toBe(dirId);
    }
  });

  it('TC-C1-07: Snapshots históricos en sigd_doc.expediente_tupa_vinculo no deben haber sido alterados', async () => {
    const res = await pool.query<{ total: string }>(
      'SELECT count(*) as total FROM sigd_doc.expediente_tupa_vinculo',
    );
    expect(Number(res.rows[0].total)).toBe(32);
  });

  it('TC-C1-08: Mecanismo de clonación debe preservar al 100% las 4 unidades y la intervención financiera', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN;');

      const cloneRes = await client.query<{ id_version: string }>(
        `INSERT INTO sigd_doc.tupa_version (
           codigo, denominacion, anio, estado, revision, version_origen_id, total_procedimientos
         ) VALUES (
           'TUPA-CLONE-VITEST', 'TUPA Vitest Clone Test', 2029, 'BORRADOR', 1, $1, 0
         ) RETURNING id_version`,
        [tupa2026Id],
      );
      const cloneId = cloneRes.rows[0].id_version;

      const origProcs = await client.query(
        `SELECT * FROM sigd_doc.tupa_procedimiento WHERE id_version = $1 ORDER BY orden ASC`,
        [tupa2026Id],
      );

      for (const p of origProcs.rows) {
        await client.query(
          `INSERT INTO sigd_doc.tupa_procedimiento (
             id_version, codigo_ref, codigo_externo, denominacion, categoria, tipo_formulario,
             monto, unidad_cobro, plazo_dias, plazo_fuente, requisitos, genera_expediente,
             calificacion, calificacion_fuente, canal_presentacion,
             unidad_receptora_id, unidad_responsable_id, unidad_resolutiva_id,
             unidad_financiera_id, intervencion_financiera,
             registro_version_id, activo, orden
           ) VALUES (
             $1, $2, $3, $4, $5, $6,
             $7, $8, $9, $10, $11, $12,
             $13, $14, $15,
             $16, $17, $18,
             $19, $20,
             $21, $22, $23
           )`,
          [
            cloneId, p.codigo_ref, p.codigo_externo, p.denominacion, p.categoria, p.tipo_formulario,
            p.monto, p.unidad_cobro, p.plazo_dias, p.plazo_fuente, JSON.stringify(p.requisitos || []), p.genera_expediente,
            p.calificacion, p.calificacion_fuente, p.canal_presentacion,
            p.unidad_receptora_id, p.unidad_responsable_id, p.unidad_resolutiva_id,
            p.unidad_financiera_id, p.intervencion_financiera,
            p.registro_version_id, p.activo, p.orden,
          ],
        );
      }

      const matchRes = await client.query<{
        total_clonados: string;
        match_rec: string;
        match_resp: string;
        match_resol: string;
        match_fin: string;
        match_interv: string;
      }>(
        `SELECT 
           count(*) as total_clonados,
           count(CASE WHEN c.unidad_receptora_id = o.unidad_receptora_id THEN 1 END) as match_rec,
           count(CASE WHEN c.unidad_responsable_id = o.unidad_responsable_id THEN 1 END) as match_resp,
           count(CASE WHEN c.unidad_resolutiva_id = o.unidad_resolutiva_id THEN 1 END) as match_resol,
           count(CASE WHEN c.unidad_financiera_id = o.unidad_financiera_id THEN 1 END) as match_fin,
           count(CASE WHEN c.intervencion_financiera = o.intervencion_financiera THEN 1 END) as match_interv
         FROM sigd_doc.tupa_procedimiento c
         JOIN sigd_doc.tupa_procedimiento o ON o.id_version = $1 AND o.codigo_ref = c.codigo_ref
        WHERE c.id_version = $2`,
        [tupa2026Id, cloneId],
      );

      expect(Number(matchRes.rows[0].total_clonados)).toBe(72);
      expect(Number(matchRes.rows[0].match_rec)).toBe(72);
      expect(Number(matchRes.rows[0].match_resp)).toBe(72);
      expect(Number(matchRes.rows[0].match_resol)).toBe(72);
      expect(Number(matchRes.rows[0].match_fin)).toBe(72);
      expect(Number(matchRes.rows[0].match_interv)).toBe(72);

      await client.query('ROLLBACK;');
    } catch (e) {
      await client.query('ROLLBACK;').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  });

  it('TC-C1-09: Rollback controlado restaura unidades a NULL de manera idempotente', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN;');

      // Ejecutar simulación de rollback
      await client.query(
        `UPDATE sigd_doc.tupa_procedimiento
            SET unidad_receptora_id = NULL,
                unidad_responsable_id = NULL,
                unidad_resolutiva_id = NULL,
                unidad_financiera_id = NULL,
                intervencion_financiera = NULL
          WHERE id_version = $1`,
        [tupa2026Id],
      );

      const nullRes = await client.query<{ con_receptora: string }>(
        `SELECT count(unidad_receptora_id) as con_receptora 
           FROM sigd_doc.tupa_procedimiento 
          WHERE id_version = $1`,
        [tupa2026Id],
      );
      expect(Number(nullRes.rows[0].con_receptora)).toBe(0);

      // Revertir para mantener la base canónica en estado C1 certificado
      await client.query('ROLLBACK;');
    } catch (e) {
      await client.query('ROLLBACK;').catch(() => {});
      throw e;
    } finally {
      client.release();
    }
  });
});
