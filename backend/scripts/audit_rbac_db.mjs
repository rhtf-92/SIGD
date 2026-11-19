import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: './backend/.env' });

const url = process.env.DATABASE_URL || 'postgres://postgres:postgres_password@127.0.0.1:5433/sigd_jacobo_demo';
const parsed = new URL(url);
console.log('Host:', parsed.hostname, 'Port:', parsed.port, 'Database:', parsed.pathname.slice(1));

const pool = new pg.Pool({ connectionString: url });

async function audit() {
  const info = await pool.query('SELECT current_database(), current_user, version()');
  console.log('Connected to DB:', info.rows[0].current_database, 'as user:', info.rows[0].current_user);

  // Columnas sigd_org.permiso_sistema
  const pCols = await pool.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='sigd_org' AND table_name='permiso_sistema'");
  console.log('\n--- COLUMNAS sigd_org.permiso_sistema ---');
  pCols.rows.forEach(c => console.log(`  ${c.column_name}: ${c.data_type} (Nullable: ${c.is_nullable})`));

  // Permisos en sigd_org.permiso_sistema
  const permisos = await pool.query("SELECT * FROM sigd_org.permiso_sistema ORDER BY codigo");
  console.log('\n--- PERMISOS EN sigd_org.permiso_sistema (' + permisos.rows.length + ') ---');
  permisos.rows.forEach(p => console.log(`- ${p.codigo} (ID: ${p.permiso_id}, Ámbito: ${p.ambito}) - ${p.nombre}`));

  // Columnas sigd_org.rol_permiso
  const rpCols = await pool.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='sigd_org' AND table_name='rol_permiso'");
  console.log('\n--- COLUMNAS sigd_org.rol_permiso ---');
  rpCols.rows.forEach(c => console.log(`  ${c.column_name}: ${c.data_type} (Nullable: ${c.is_nullable})`));

  // Permisos asignados por rol
  const rpQuery = await pool.query(`
    SELECT r.codigo AS rol_codigo, r.nombre AS rol_nombre, count(rp.permiso_id) AS total_permisos,
           string_agg(p.codigo, ', ' ORDER BY p.codigo) AS lista_permisos
    FROM sigd_org.rol_sistema r
    LEFT JOIN sigd_org.rol_permiso rp ON rp.rol_id = r.rol_id
    LEFT JOIN sigd_org.permiso_sistema p ON p.permiso_id = rp.permiso_id
    GROUP BY r.codigo, r.nombre
    ORDER BY r.codigo
  `);
  console.log('\n--- PERMISOS POR ROL ---');
  rpQuery.rows.forEach(r => {
    console.log(`\n[${r.rol_codigo}] (${r.total_permisos} permisos):`);
    console.log(r.lista_permisos || '(ninguno)');
  });

  await pool.end();
}

audit().catch(e => {
  console.error('Audit error:', e);
  pool.end();
  process.exit(1);
});
