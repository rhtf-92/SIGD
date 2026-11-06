import { createRequire } from 'node:module';

const require = createRequire('/app/package.json');
const { Pool } = require('pg');
const argon2 = require('argon2');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const client = await pool.connect();
try {
  await client.query('BEGIN');
  const existing = await client.query("SELECT 1 FROM sigd_auth.cuenta_usuario WHERE usuario = 'demo.academico'");
  if (existing.rowCount === 0) {
    const hash = await argon2.hash(process.env.ACADEMIC_DEMO_PASSWORD, { type: argon2.argon2id });
    const person = await client.query("INSERT INTO sigd_auth.persona(tipo,id_documento) VALUES ('NATURAL','00000000') RETURNING id_persona");
    const personId = person.rows[0].id_persona;
    await client.query("INSERT INTO sigd_auth.persona_natural(id_persona,nombres,apellidos,nombre_completo,correo) VALUES ($1,'Demo','Académico','Demo Académico','demo@example.invalid')", [personId]);
    const account = await client.query("INSERT INTO sigd_auth.cuenta_usuario(id_persona,usuario,correo,password_hash) VALUES ($1,'demo.academico','demo@example.invalid',$2) RETURNING id_usuario", [personId, hash]);
    await client.query("INSERT INTO sigd_org.usuario_rol(id_usuario,rol_id) SELECT $1,rol_id FROM sigd_org.rol_sistema WHERE codigo='DIRECTOR'", [account.rows[0].id_usuario]);
  }
  await client.query('COMMIT');
  console.log('Academic demo account ready. Credentials remain in the local ignored environment file.');
} catch (error) {
  await client.query('ROLLBACK');
  console.error('Academic demo seed failed:', error.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
