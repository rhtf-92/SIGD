import dotenv from 'dotenv';
dotenv.config();
import { crearPool } from './src/database.js';

async function main() {
  const pool = crearPool(process.env.DATABASE_URL);
  const areaId = 'a0000000-0000-0000-0000-000000000001';
  const { rows } = await pool.query(`
    SELECT DISTINCT
       cu.id_usuario,
       cu.usuario,
       pn.nombre_completo,
       rs.codigo AS rol_codigo,
       a.nombre AS area_nombre
     FROM sigd_auth.cuenta_usuario cu
     JOIN sigd_auth.persona p ON p.id_persona = cu.id_persona
     JOIN sigd_auth.persona_natural pn ON pn.id_persona = p.id_persona
     JOIN sigd_auth.vinculo_institucional vi ON vi.id_persona = p.id_persona AND vi.estado = 'ACTIVO'
     LEFT JOIN sigd_org.usuario_rol ur ON ur.id_usuario = cu.id_usuario AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
     LEFT JOIN sigd_org.rol_sistema rs ON rs.rol_id = ur.rol_id
     LEFT JOIN sigd_org.area a ON a.area_id = ur.area_id
     LEFT JOIN sigd_org.asignacion_perfil_operativo apo ON apo.id_usuario = cu.id_usuario AND apo.estado = 'ACTIVO'
     WHERE cu.activo = true
       AND (
         ur.area_id = $1::uuid
         OR apo.area_id = $1::uuid
         OR ur.area_id IN (SELECT area_id FROM sigd_org.area WHERE area_padre_id = $1::uuid)
         OR ur.area_id IN (SELECT area_padre_id FROM sigd_org.area WHERE area_id = $1::uuid AND area_padre_id IS NOT NULL)
         OR apo.area_id IN (SELECT area_id FROM sigd_org.area WHERE area_padre_id = $1::uuid)
         OR apo.area_id IN (SELECT area_padre_id FROM sigd_org.area WHERE area_id = $1::uuid AND area_padre_id IS NOT NULL)
       )
       AND rs.codigo IN ('ESPECIALISTA', 'SECRETARIO')
     ORDER BY cu.usuario ASC
  `, [areaId]);
  console.log(JSON.stringify(rows, null, 2));
  await pool.end();
}
main().catch(console.error);
