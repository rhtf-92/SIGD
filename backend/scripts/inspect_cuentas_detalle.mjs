import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgres://postgres:postgres_password@127.0.0.1:5433/sigd_jacobo_demo',
});

async function main() {
  const { rows } = await pool.query(`
    SELECT cu.id_usuario, cu.usuario, cu.correo, cu.activo, p.id_documento as dni,
           pn.nombres, pn.apellidos,
           ap.id_asignacion, ap.cargo_id, c.nombre as cargo, ap.area_id, a.nombre as area,
           COALESCE(jsonb_agg(DISTINCT jsonb_build_object('rol_id', ur.rol_id, 'codigo', r.codigo, 'area_id', ur.area_id, 'vigente_hasta', ur.vigente_hasta)) FILTER (WHERE r.codigo IS NOT NULL), '[]'::jsonb) as roles
    FROM sigd_auth.cuenta_usuario cu
    JOIN sigd_auth.persona p ON p.id_persona = cu.id_persona
    LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = p.id_persona
    LEFT JOIN sigd_org.asignacion_personal ap ON ap.id_usuario = cu.id_usuario AND (ap.vigente_hasta IS NULL OR ap.vigente_hasta > now())
    LEFT JOIN sigd_org.cargo c ON c.cargo_id = ap.cargo_id
    LEFT JOIN sigd_org.area a ON a.area_id = ap.area_id
    LEFT JOIN sigd_org.usuario_rol ur ON ur.id_usuario = cu.id_usuario AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
    LEFT JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id
    WHERE cu.usuario IN ('trabajador.h2.test', 'especialista.demo', 'test.ciclo.1793803705257')
    GROUP BY cu.id_usuario, cu.usuario, cu.correo, cu.activo, p.id_documento, pn.nombres, pn.apellidos, ap.id_asignacion, ap.cargo_id, c.nombre, ap.area_id, a.nombre
  `);

  console.log(JSON.stringify(rows, null, 2));
  await pool.end();
}

main().catch(err => {
  console.error(err);
  pool.end();
});
