import { readFileSync } from 'node:fs';
import pg from './node_modules/pg/lib/index.js';
const envText = readFileSync('.env', 'utf8');
const env = Object.fromEntries(envText.split(/\r?\n/).filter(Boolean).map((line) => { const [k, ...v] = line.split('='); return [k, v.join('=')]; }));
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
const queries = {
  columnasKpis: `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='sigd_tra' AND table_name='mv_kpis_mgd_mensual' ORDER BY ordinal_position`,
  columnasRetencion: `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='sigd_tra' AND table_name='mv_tiempos_retencion_area' ORDER BY ordinal_position`,
  resumenKpis: `SELECT count(*) AS filas, min(periodo) AS desde, max(periodo) AS hasta, max(actualizado_en) AS actualizado FROM sigd_tra.mv_kpis_mgd_mensual`,
  resumenRetencion: `SELECT count(*) AS filas, min(periodo) AS desde, max(periodo) AS hasta FROM sigd_tra.mv_tiempos_retencion_area`,
  muestraKpis: `SELECT * FROM sigd_tra.mv_kpis_mgd_mensual ORDER BY periodo DESC LIMIT 8`,
  consultaResumen: `SELECT to_char(MIN(periodo), 'YYYY-MM') AS periodo, MAX(actualizado_en) AS actualizado_en, SUM(n_radicados) AS n_radicados, SUM(n_atendidos) AS n_atendidos, SUM(n_archivados) AS n_archivados, SUM(n_resueltos) AS n_resueltos, SUM(n_en_tramite) AS n_en_tramite, SUM(n_observados) AS n_observados, SUM(n_resueltos_dentro_plazo) AS n_resueltos_dentro_plazo, SUM(horas_habiles_suma) AS horas_habiles_suma FROM sigd_tra.mv_kpis_mgd_mensual WHERE ($1::date IS NULL OR periodo = $1::date) AND ($2::date IS NULL OR periodo >= $2::date) AND ($3::date IS NULL OR periodo <= $3::date) AND ($4::text IS NULL OR unidad_organica_id = $4::text)`,
  unidades: `SELECT DISTINCT unidad_organica_id FROM sigd_tra.mv_kpis_mgd_mensual ORDER BY 1`,
};
for (const [name, sql] of Object.entries(queries)) {
  try {
    const params = name === 'consultaResumen' ? [null, '2026-01-01', '2026-12-01', null] : [];
    const res = await pool.query(sql, params);
    console.log(`\n=== ${name} ===`);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (error) {
    console.log(`\n=== ${name} ERROR ===`);
    console.log(String(error));
  }
}
await pool.end();
