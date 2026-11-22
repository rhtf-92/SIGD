import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const exps = await pool.query(`
    SELECT expediente_id, codigo, estado, area_actual_id, unidad_organica_actual_id, solicitante_id
    FROM sigd_rut.expediente 
    WHERE codigo IN ('EXP-2026-000002', 'EXP-2026-000005', 'EXP-2026-000012')
  `);
  console.log('EXPEDIENTES:', JSON.stringify(exps.rows, null, 2));

  const asigs = await pool.query(`
    SELECT ea.expediente_id, e.codigo, ea.id_usuario, u.nombre_usuario, ea.activo, ea.asignado_en
    FROM sigd_rut.expediente_asignacion ea
    JOIN sigd_rut.expediente e ON e.expediente_id = ea.expediente_id
    LEFT JOIN sigd_auth.cuenta_usuario u ON u.id_usuario = ea.id_usuario
    WHERE e.codigo IN ('EXP-2026-000002', 'EXP-2026-000005', 'EXP-2026-000012')
  `);
  console.log('ASIGNACIONES:', JSON.stringify(asigs.rows, null, 2));

  const uos = await pool.query(`
    SELECT unidad_organica_id, nombre, sigla FROM sigd_org.unidad_organica
  `);
  console.log('UNIDADES ORGANICAS:', JSON.stringify(uos.rows, null, 2));

  await pool.end();
}

main().catch(console.error);
