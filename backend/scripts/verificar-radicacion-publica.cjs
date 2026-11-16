// Default is READ ONLY. --aplicar-esquema applies ONLY migration 09 after the
// configured URL and the effective connection both identify the demo database.
const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('dotenv');
const { Client } = require('pg');
const { createHash, randomUUID } = require('node:crypto');

async function probarBloqueo(connectionString) {
  const a = new Client({ connectionString, connectionTimeoutMillis: 5000, query_timeout: 5000 });
  const b = new Client({ connectionString, connectionTimeoutMillis: 5000, query_timeout: 5000 });
  const key = createHash('sha256').update(randomUUID()).digest('hex');
  let waiting;
  try {
    await a.connect(); await b.connect();
    for (const c of [a, b]) {
      if ((await c.query('SELECT current_database() db')).rows[0].db !== 'sigd_jacobo_demo') throw new Error('SAFE_STOP_TEST');
      await c.query('BEGIN');
    }
    const sql = `INSERT INTO sigd_tra.radicacion_publica (sesion_hash,payload_hash,datos_declarados)
      VALUES ($1,$1,'{"fixture":"SOLO BLOQUEO, SIN EXPEDIENTE NI CUT"}'::jsonb) ON CONFLICT DO NOTHING`;
    await a.query(sql, [key]);
    let settled = false;
    waiting = b.query(sql, [key]).finally(() => { settled = true; });
    await new Promise(resolve => setTimeout(resolve, 200));
    if (settled) throw new Error('NO_SE_SERIALIZO_EL_REINTENTO');
    await a.query('ROLLBACK');
    const retry = await waiting;
    if (retry.rowCount !== 1) throw new Error('NO_SE_RECUPERO_TRAS_ROLLBACK');
    await b.query('ROLLBACK');
    const remaining = (await a.query('SELECT count(*)::int n FROM sigd_tra.radicacion_publica WHERE sesion_hash=$1', [key])).rows[0].n;
    if (remaining !== 0) throw new Error('QUEDO_FIXTURE_PERSISTIDA');
    console.log('INTEGRACION_POSTGRES', JSON.stringify({ concurrenciaSerializada: true, reintentoTrasRollback: true, registrosFixturePersistidos: 0, cutsGenerados: 0 }));
  } finally {
    await a.query('ROLLBACK').catch(() => {});
    await waiting?.catch(() => {});
    await b.query('ROLLBACK').catch(() => {});
    await Promise.allSettled([a.end(), b.end()]);
  }
}

async function main() {
  const file = path.join(process.env.LOCALAPPDATA, 'SIGD/secrets/demo-runtime.env');
  const env = parse(fs.readFileSync(file));
  const url = new URL(env.DATABASE_URL);
  if (url.hostname !== '127.0.0.1' || url.port !== '5433' || url.pathname !== '/sigd_jacobo_demo' || url.username !== 'sigd_jacobo_user') throw new Error('SAFE_STOP_CONFIG');
  const apply = process.argv.includes('--aplicar-esquema');
  const client = new Client({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 5000, query_timeout: 10000 });
  let transaction = false;
  try {
    await client.connect();
    await client.query(apply ? 'BEGIN' : 'BEGIN READ ONLY'); transaction = true;
    const identity = (await client.query('SELECT current_database() db,current_user usr,inet_server_addr()::text addr,inet_server_port() port')).rows[0];
    if (identity.db !== 'sigd_jacobo_demo' || identity.usr !== 'sigd_jacobo_user') throw new Error('SAFE_STOP_CONNECTION');
    console.log('IDENTIDAD', JSON.stringify(identity));
    const snapshot = async () => (await client.query(`SELECT count(*)::int n, md5(COALESCE(string_agg(row_to_json(e)::text, '' ORDER BY expediente_id),'')) fingerprint FROM sigd_doc.expediente e`)).rows[0];
    const before = await snapshot();
    if (apply) {
      await client.query("SET LOCAL lock_timeout='5s'");
      const sql = fs.readFileSync(path.join(__dirname, '../migraciones/09_radicacion_publica_idempotencia.sql'), 'utf8');
      await client.query(sql);
    }
    const table = (await client.query("SELECT to_regclass('sigd_tra.radicacion_publica') IS NOT NULL presente")).rows[0].presente;
    const after = await snapshot();
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('EXPEDIENTES_PREVIOS_CAMBIARON');
    if (table) console.log('RADICACIONES_PUBLICAS', (await client.query('SELECT count(*)::int n FROM sigd_tra.radicacion_publica')).rows[0].n);
    console.log('ESQUEMA_PUBLICO', table, 'EXPEDIENTES_PREVIOS_INTACTOS', true, 'TOTAL_EXPEDIENTES', before.n);
    await client.query(apply ? 'COMMIT' : 'ROLLBACK'); transaction = false;
    if (process.argv.includes('--probar-bloqueo')) await probarBloqueo(env.DATABASE_URL);
  } finally {
    if (transaction) await client.query('ROLLBACK').catch(() => {});
    await client.end();
  }
}
main().catch(error => { console.error('VERIFICACION_FALLIDA', error.code || 'ERROR', String(error.message).replace(/postgres(?:ql)?:\/\/\S+/g, '[conexion privada]')); process.exitCode = 1; });
