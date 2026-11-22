import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    const res = await client.query(
      `SELECT e.expediente_id, e.codigo_expediente, e.estado as tra_estado, u.estado_nuevo as rut_estado, u.area_actual_id, u.evento
       FROM sigd_tra.expediente e
       LEFT JOIN sigd_rut.estado_actual_expediente u ON u.expediente_id = e.expediente_id
       WHERE e.codigo_expediente = 'EXP-2026-000012'`
    );
    console.log('EXP DATA:', JSON.stringify(res.rows, null, 2));

    const resFlujo = await client.query(
      `SELECT * FROM sigd_doc.flujo_certificado_ingles WHERE expediente_id = $1`,
      [res.rows[0]?.expediente_id]
    );
    console.log('FLUJO CERTIFICADO:', JSON.stringify(resFlujo.rows, null, 2));
  } finally {
    client.release();
    await pool.end();
  }
}
main().catch(console.error);
