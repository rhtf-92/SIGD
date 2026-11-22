import dotenv from 'dotenv';
dotenv.config();
import { crearPool } from './src/database.js';

async function main() {
  const pool = crearPool(process.env.DATABASE_URL);
  const q = await pool.query(`
    SELECT e.expediente_id, e.codigo_expediente, ea.id_asignacion, ea.id_usuario, cu.usuario, pn.nombre_completo, ea.motivo, ea.asignado_en, ea.activo
    FROM sigd_tra.expediente e
    LEFT JOIN sigd_rut.expediente_asignacion ea ON ea.expediente_id = e.expediente_id AND ea.activo = true
    LEFT JOIN sigd_auth.cuenta_usuario cu ON cu.id_usuario = ea.id_usuario
    LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = cu.id_persona
    WHERE e.codigo_expediente IN ('EXP-2026-000002', 'EXP-2026-000005')
  `);
  console.log(JSON.stringify(q.rows, null, 2));
  await pool.end();
}
main().catch(console.error);
