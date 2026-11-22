import { pool } from './backend/src/infrastructure/database/db.js';

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

  const usuarios = await pool.query(`
    SELECT u.id_usuario, u.nombre_usuario, ur.unidad_organica_id, uo.nombre as unidad, rs.codigo as rol
    FROM sigd_auth.cuenta_usuario u
    JOIN sigd_org.usuario_rol ur ON ur.id_usuario = u.id_usuario
    JOIN sigd_org.rol_sistema rs ON rs.rol_id = ur.rol_id
    LEFT JOIN sigd_org.unidad_organica uo ON uo.unidad_organica_id = ur.unidad_organica_id
    WHERE u.nombre_usuario IN ('responsable_ingles_demo', 'especialista_demo', 'secretario_demo', 'director_demo')
  `);
  console.log('USUARIOS:', JSON.stringify(usuarios.rows, null, 2));

  await pool.end();
}

main().catch(console.error);
