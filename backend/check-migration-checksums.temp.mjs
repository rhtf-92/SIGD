import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from './node_modules/pg/lib/index.js';
const envText = fs.readFileSync('.env', 'utf8');
const env = Object.fromEntries(envText.split(/\r?\n/).filter(Boolean).map((line) => { const [k, ...v] = line.split('='); return [k, v.join('=')]; }));
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
const { rows } = await pool.query('SELECT nombre_script, checksum_sha256 FROM public.sigd_migraciones ORDER BY nombre_script');
const registrados = new Map(rows.map((f) => [f.nombre_script, f.checksum_sha256.trim()]));
for (const archivo of fs.readdirSync('migraciones').filter((f) => f.endsWith('.sql')).sort()) {
  const contenido = fs.readFileSync(path.join('migraciones', archivo), 'utf8');
  const actual = crypto.createHash('sha256').update(contenido).digest('hex');
  const lf = crypto.createHash('sha256').update(contenido.replace(/\r\n/g, '\n')).digest('hex');
  const registrado = registrados.get(archivo);
  if (!registrado) { console.log(`${archivo}: NO REGISTRADA`); continue; }
  const estado = registrado === actual ? 'OK-actual' : registrado === lf ? 'OK-LF' : 'MISMATCH';
  console.log(`${archivo}: ${estado} registrado=${registrado} actual=${actual} lf=${lf}`);
}
await pool.end();
