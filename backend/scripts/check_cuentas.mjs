import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: 'postgres://postgres:postgres_password@127.0.0.1:5433/sigd_jacobo_demo',
});

async function main() {
  const { rows } = await pool.query(`
    SELECT cu.id_usuario, cu.usuario, cu.correo, cu.activo, p.id_documento as dni,
           pn.nombres, pn.apellidos,
           COALESCE(json_agg(DISTINCT r.codigo) FILTER (WHERE r.codigo IS NOT NULL), '[]') as roles
    FROM sigd_auth.cuenta_usuario cu
    JOIN sigd_auth.persona p ON p.id_persona = cu.id_persona
    LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = p.id_persona
    LEFT JOIN sigd_org.usuario_rol ur ON ur.id_usuario = cu.id_usuario AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
    LEFT JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id
    GROUP BY cu.id_usuario, cu.usuario, cu.correo, cu.activo, p.id_documento, pn.nombres, pn.apellidos
    ORDER BY cu.activo DESC, cu.usuario ASC
  `);

  console.log(`Total cuentas encontradas: ${rows.length}`);
  for (const c of rows) {
    console.log(`- [${c.activo ? 'ACTIVO' : 'INACTIVO'}] usuario: ${c.usuario} | DNI: ${c.dni} | Correo: ${c.correo} | Nombres: ${c.nombres} ${c.apellidos} | Roles: ${JSON.stringify(c.roles)}`);
  }

  await pool.end();
}

main().catch(err => {
  console.error(err);
  pool.end();
});
