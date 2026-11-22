import dotenv from 'dotenv';
dotenv.config();
import { crearPool } from './src/database.js';

async function main() {
  const pool = crearPool(process.env.DATABASE_URL);
  const q = await pool.query(`
    SELECT e.codigo_expediente, u.estado_nuevo, u.area_actual_id, a.nombre AS area_nombre, u.usuario_asignado_id, cu.usuario AS usuario_asignado, u.persona_asignada_id
    FROM sigd_rut.estado_actual_expediente u
    JOIN sigd_tra.expediente e ON e.expediente_id = u.expediente_id
    LEFT JOIN sigd_org.area a ON a.area_id::text = u.area_actual_id
    LEFT JOIN sigd_auth.cuenta_usuario cu ON cu.id_usuario = u.usuario_asignado_id
    ORDER BY u.fecha_hora DESC LIMIT 10
  `);
  console.log(JSON.stringify(q.rows, null, 2));
  await pool.end();
}
main().catch(console.error);
