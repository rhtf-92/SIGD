import dotenv from 'dotenv';
dotenv.config();
import { crearPool } from './src/database.js';

async function main() {
  const pool = crearPool(process.env.DATABASE_URL);
  const q = await pool.query(`SELECT area_id, codigo, nombre, area_padre_id, tipo_unidad FROM sigd_org.area`);
  console.log(JSON.stringify(q.rows, null, 2));
  await pool.end();
}
main().catch(console.error);
