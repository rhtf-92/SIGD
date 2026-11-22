import pkg from 'pg';
const { Pool } = pkg;
const pool = new Pool({ connectionString: 'postgres://postgres:15092006@localhost:5432/sigd_prueba' });

async function main() {
  const exp = await pool.query("SELECT expediente_id, cut, estado_actual, area_actual_id, usuario_asignado_id, persona_asignada_id FROM sigd_doc.expediente WHERE cut = 'EXP-2026-000003'");
  console.log('EXPEDIENTE:', exp.rows[0]);
  if (exp.rows[0]) {
    try {
      const asig = await pool.query("SELECT * FROM sigd_doc.expediente_asignacion WHERE expediente_id = $1 ORDER BY asignado_en DESC", [exp.rows[0].expediente_id]);
      console.log('ASIGNACIONES:', asig.rows);
    } catch (e) {
      console.log('No tabla expediente_asignacion, buscando en sigd_rut:', e.message);
    }
  }
  const users = await pool.query("SELECT c.id_usuario, c.usuario, c.correo, pn.nombre_completo, r.codigo as rol FROM sigd_auth.cuenta_usuario c LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = c.id_persona LEFT JOIN sigd_org.usuario_rol ur ON ur.id_usuario = c.id_usuario LEFT JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id WHERE c.usuario LIKE '%especialista%' OR c.usuario LIKE '%ingles%'");
  console.log('USERS ESPECIALISTAS:', users.rows);
  await pool.end();
}
main().catch(console.error);
