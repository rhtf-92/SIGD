import dotenv from 'dotenv';
dotenv.config();
import { crearPool } from './src/database.js';

async function main() {
  const pool = crearPool(process.env.DATABASE_URL);
  const q = await pool.query(`
    SELECT column_name FROM information_schema.columns WHERE table_schema = 'sigd_tra' AND table_name = 'expediente'
  `);
  console.log(q.rows.map(r => r.column_name));
  await pool.end();
}
main().catch(console.error);
