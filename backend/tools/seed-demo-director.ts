import 'dotenv/config';
import pg from 'pg';
import { Argon2Service } from '../src/domains/identicore/argon2.service.ts';

const USUARIO = 'director.demo';
const CORREO = 'director.demo@iestp-suiza.edu.pe';
const PASSWORD = 'DirectorDemo2026!';
const ID_PERSONA = '00000000-0000-0000-0000-0000000000d1';
const ID_USUARIO = '00000000-0000-0000-0000-0000000000d2';

if (process.env.NODE_ENV === 'production') {
  throw new Error('El seeder demo está prohibido en NODE_ENV=production.');
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL no está configurada.');
}

const host = new URL(databaseUrl).hostname;
if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
  throw new Error(`El seeder demo sólo opera sobre BD local; host resuelto: ${host}.`);
}

const pool = new pg.Pool({ connectionString: databaseUrl });
const client = await pool.connect();

try {
  const passwordHash = await Argon2Service.hash(PASSWORD);

  await client.query('BEGIN');

  await client.query(
    `INSERT INTO sigd_auth.persona (id_persona, tipo, id_documento)
     VALUES ($1, 'NATURAL', 'DEMO-DIRECTOR-001')
     ON CONFLICT (id_persona) DO NOTHING`,
    [ID_PERSONA],
  );

  await client.query(
    `INSERT INTO sigd_auth.persona_natural (
       id_persona, nombres, apellidos, nombre_completo, correo
     ) VALUES ($1, 'Director', 'Demo', 'Director Demo', $2)
     ON CONFLICT (id_persona) DO NOTHING`,
    [ID_PERSONA, CORREO],
  );

  await client.query(
    `INSERT INTO sigd_auth.cuenta_usuario (
       id_usuario, id_persona, usuario, correo, password_hash, activo
     ) VALUES ($1, $2, $3, $4, $5, TRUE)
     ON CONFLICT (id_usuario) DO UPDATE
       SET usuario = EXCLUDED.usuario,
           correo = EXCLUDED.correo,
           password_hash = EXCLUDED.password_hash,
           activo = TRUE`,
    [ID_USUARIO, ID_PERSONA, USUARIO, CORREO, passwordHash],
  );

  await client.query(
    `INSERT INTO sigd_org.usuario_rol (id_usuario, rol_id, vigente_desde)
     SELECT $1, r.rol_id, now()
       FROM sigd_org.rol_sistema r
      WHERE r.codigo = 'DIRECTOR'
     ON CONFLICT DO NOTHING`,
    [ID_USUARIO],
  );

  await client.query('COMMIT');
  console.log(`Seeder demo listo: ${USUARIO} / ${PASSWORD} (DIRECTOR)`);
} catch (error) {
  await client.query('ROLLBACK').catch(() => undefined);
  throw error;
} finally {
  client.release();
  await pool.end();
}
