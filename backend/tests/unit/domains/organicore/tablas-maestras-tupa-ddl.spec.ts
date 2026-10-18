import type { Pool } from 'pg';
import { Pool as PgPool } from 'pg';
import { readFileSync } from 'node:fs';
import request from 'supertest';
import express from 'express';
import { describe, expect, it, vi } from 'vitest';
import { TablasMaestrasService } from '../../../../src/domains/organicore/tablasMaestras.service.js';
import { crearRouterTramites } from '../../../../src/domains/tramicore/tramites.controller.js';

const cargaSuiza = readFileSync(new URL('../../../../carga_tupa_suiza_2026.sql', import.meta.url), 'utf8');
const datosSuiza = JSON.parse(cargaSuiza.match(/\$datos_suiza\$\n([\s\S]*?)\n\$datos_suiza\$/)![1]) as Record<string, Array<Record<string, unknown>>>;

describe('Carga reproducible Suiza sin DDL', () => {
  it('conserva las identidades, menciones documentales y limitaciones verificadas', () => {
    expect(cargaSuiza).not.toMatch(/^\s*(CREATE|ALTER|DROP|TRUNCATE|DELETE|GRANT|REVOKE)\b/im);
    expect(datosSuiza.tipo_tramite_tupa).toHaveLength(19);
    expect(new Set(datosSuiza.tipo_tramite_tupa.map(t => t.tipo_tramite_id)).size).toBe(19);
    expect(datosSuiza.tipo_documento).toHaveLength(2);
    expect(datosSuiza.requisito).toHaveLength(17);
    expect(datosSuiza.tipo_documento_requisito).toHaveLength(17);
    expect(datosSuiza.requisito.every(r => r.obligatorio === false)).toBe(true);
    for (const t of datosSuiza.tipo_tramite_tupa) {
      expect(t.descripcion).toContain('no constituyen valores administrativos oficiales');
      expect(t.vigente).toBe(true);
      const requisitos = datosSuiza.requisito.filter(r => r.tipo_tramite_id === t.tipo_tramite_id);
      expect(requisitos).toHaveLength(['SUZ26-050', 'SUZ26-051', 'SUZ26-054'].includes(String(t.codigo)) ? 0 : t.codigo === 'SUZ26-066' ? 2 : 1);
    }
  });

  it.skipIf(!process.env.SIGD_SUIZA_REPRO_DATABASE_URL)('aplica dos veces en la base aislada y consulta los endpoints existentes contra PostgreSQL', async () => {
    const destino = new URL(process.env.SIGD_SUIZA_REPRO_DATABASE_URL!);
    expect(destino.hostname).toBe('127.0.0.1');
    expect(destino.port).toBe('5434');
    expect(destino.pathname).toMatch(/^\/sigd_suiza_repro_\d+$/);
    const pool = new PgPool({ connectionString: destino.toString() });
    const client = await pool.connect();
    try {
      const snapshot = async () => {
        const resultado: Record<string, unknown[]> = {};
        for (const tabla of Object.keys(datosSuiza)) {
          resultado[tabla] = (await client.query(`SELECT to_jsonb(t) fila FROM sigd_doc.${tabla} t ORDER BY to_jsonb(t)::text`)).rows;
        }
        return resultado;
      };
      await client.query(cargaSuiza);
      const primera = await snapshot();
      await client.query(cargaSuiza);
      expect(await snapshot()).toEqual(primera);
      const app = express();
      app.use('/api/v1', crearRouterTramites(pool));
      for (const ruta of ['/api/v1/tramites/tipos', '/api/v1/tramites/tupa']) {
        const respuesta = await request(app).get(ruta).expect(200);
        expect(respuesta.body).toHaveLength(19);
        expect(respuesta.body.map((t: { id: string; codigo: string }) => [t.id, t.codigo])).toEqual(
          [...datosSuiza.tipo_tramite_tupa].sort((a, b) => String(a.codigo).localeCompare(String(b.codigo))).map(t => [t.tipo_tramite_id, t.codigo]),
        );
      }
      expect((await client.query("SELECT count(*)::int n FROM sigd_doc.tipo_tramite_tupa WHERE codigo IN ('TUPA-01','TUPA-02','TUPA-03') AND NOT vigente")).rows[0].n).toBe(3);
      const conConflicto = cargaSuiza.replace('"codigo": "SUZ26-034"', '"codigo": "SUZ26-CONFLICTO"');
      expect(conConflicto).not.toBe(cargaSuiza);
      await expect(client.query(conConflicto)).rejects.toMatchObject({ code: 'P0001' });
      await client.query('ROLLBACK');
      expect(await snapshot()).toEqual(primera);
    } finally {
      await client.query('ROLLBACK');
      client.release();
      await pool.end();
    }
  });
});

describe('OrganiCore · proyección del TUPA según DocuCore SQL 04', () => {
  it('conserva el shape de respuesta y solo consulta columnas disponibles', async () => {
    const consultaTupa = {
      codigo: 'SUZ26-010',
      nombre: 'Concepto institucional Suiza',
      descripcion: 'Base legal documentada',
      extra: {
        es_tupa: true,
        calificacion_administrativa: null,
        plazo_max_dias_habiles: 12,
        costo: null,
        unidad_organica_responsable: 'Secretaría Académica',
      },
    };
    const query = vi.fn(async (sql: string) => {
      const esConsultaTupa = sql.includes('FROM sigd_doc.tipo_tramite_tupa AS t');
      return {
        rows: esConsultaTupa ? [consultaTupa] : [],
        rowCount: esConsultaTupa ? 1 : 0,
      };
    });
    const service = new TablasMaestrasService(
      { query } as unknown as Pool,
      { ttlMs: 1_000, ahora: () => '2026-10-15T12:00:00.000Z' },
    );

    const respuesta = await service.listarMaestras(true);
    const catalogo = respuesta.catalogos.find((item) => item.clave === 'tipos_tramite');
    const sql = query.mock.calls.map(([statement]) => statement).find((statement) =>
      statement.includes('FROM sigd_doc.tipo_tramite_tupa AS t'),
    );

    expect(catalogo?.disponible).toBe(true);
    expect(catalogo?.items).toEqual([consultaTupa]);
    expect(sql).toContain('t.codigo          AS codigo');
    expect(sql).toContain('t.plazo_dias');
    expect(sql).toContain('t.descripcion');
    expect(sql).toContain("t.codigo LIKE 'SUZ26-%'");
    expect(catalogo?.descripcion).toContain('Los defaults técnicos no acreditan');
    expect(catalogo?.descripcion).not.toContain('plazo legal');
    expect(sql).toContain('t.unidad_organica');
    expect(sql).toContain('t.vigente = TRUE');
    expect(sql).not.toMatch(/codigo_tupa|t\.activo|t\.costo|plazo_max_dias_habiles\s*,/);
  });
});
