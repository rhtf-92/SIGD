import dotenv from 'dotenv';
dotenv.config();
import { crearPool } from './src/database.js';

async function main() {
  const pool = crearPool(process.env.DATABASE_URL);
  const q = await pool.query(`
    SELECT cu.usuario, cu.id_usuario, rs.codigo AS rol, ur.area_id, a.nombre AS area_nombre
    FROM sigd_auth.cuenta_usuario cu
    LEFT JOIN sigd_org.usuario_rol ur ON ur.id_usuario = cu.id_usuario
    LEFT JOIN sigd_org.rol_sistema rs ON rs.rol_id = ur.rol_id
    LEFT JOIN sigd_org.area a ON a.area_id = ur.area_id
    WHERE cu.usuario IN ('secretario_demo', 'especialista_demo', 'responsable_ingles_demo', 'especialista_portugues_demo')
  `);
  console.log(JSON.stringify(q.rows, null, 2));
  await pool.end();
}
main().catch(console.error);
