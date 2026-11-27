import fs from 'node:fs';
import pg from './node_modules/pg/lib/index.js';
const envText = fs.readFileSync('.env', 'utf8');
const env = Object.fromEntries(envText.split(/\r?\n/).filter(Boolean).map((line) => { const [k, ...v] = line.split('='); return [k, v.join('=')]; }));
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });
const { rows } = await pool.query(`
  SELECT c.usuario, c.password_hash, array_agg(r.codigo ORDER BY r.codigo) AS roles
    FROM sigd_auth.cuenta_usuario c
    LEFT JOIN sigd_org.usuario_rol ur ON ur.id_usuario = c.id_usuario
    LEFT JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id
   GROUP BY c.usuario, c.password_hash
   ORDER BY c.usuario
`);
console.log(JSON.stringify(rows, null, 2));
await pool.end();
