import dotenv from 'dotenv';
dotenv.config();
import { crearPool } from './src/database.js';

async function main() {
  const pool = crearPool(process.env.DATABASE_URL);
  const r = await pool.query('SELECT documento_adjunto_id, expediente_tra_id, s3_bucket, s3_key, nombre_archivo, mime_type FROM sigd_doc.documento_adjunto ORDER BY creado_en DESC LIMIT 10');
  console.log(JSON.stringify(r.rows, null, 2));
  await pool.end();
}
main().catch(console.error);
