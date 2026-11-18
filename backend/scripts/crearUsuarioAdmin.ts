import 'dotenv/config';
import crypto from 'node:crypto';
import { crearPool } from '../src/database.js';
import { Argon2Service } from '../src/domains/identicore/argon2.service.js';

async function main(): Promise<void> {
  const identificador = (process.env.TUPA_ADMIN_IDENTIFICADOR ?? process.argv[2] ?? '').trim();
  const password = process.env.TUPA_ADMIN_PASSWORD ?? process.argv[3] ?? '';
  const correoConfigurado = process.env.TUPA_ADMIN_EMAIL?.trim();

  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL no está configurada.');
  if (identificador.length < 3 || identificador.length > 60 || /\s/.test(identificador)) {
    throw new Error('Indique un identificador de 3 a 60 caracteres, sin espacios.');
  }
  if (password.length < 8 || password.length > 128) {
    throw new Error('La contraseña debe tener entre 8 y 128 caracteres.');
  }
  const correo = (correoConfigurado || (identificador.includes('@') ? identificador : `${identificador}@iestp-suiza.edu.pe`))
    .toLocaleLowerCase('es');
  if (correo.length > 160) throw new Error('El correo supera el máximo de 160 caracteres.');

  const pool = crearPool(process.env.DATABASE_URL);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existe = await client.query(
      'SELECT 1 FROM sigd_auth.cuenta_usuario WHERE usuario = $1 OR correo = $2',
      [identificador, correo],
    );
    if (existe.rowCount) throw new Error('Ya existe una cuenta con ese identificador o correo; no se modificó.');

    const rol = await client.query(
      `SELECT rol_id FROM sigd_org.rol_sistema WHERE codigo = 'ADMINISTRADOR' AND vigente = TRUE`,
    );
    if (!rol.rows[0]) {
      throw new Error('No existe el rol ADMINISTRADOR activo definido por el esquema institucional.');
    }

    const idDocumento = `TUPA-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const persona = await client.query(
      `INSERT INTO sigd_auth.persona (tipo, id_documento)
       VALUES ('NATURAL', $1)
       RETURNING id_persona`,
      [idDocumento],
    );
    await client.query(
      `INSERT INTO sigd_auth.persona_natural (id_persona, nombres, apellidos, nombre_completo)
       VALUES ($1, 'Administrador', 'TUPA', 'Administrador de versiones TUPA')`,
      [persona.rows[0].id_persona],
    );
    const passwordHash = await Argon2Service.hash(password);
    const cuenta = await client.query(
      `INSERT INTO sigd_auth.cuenta_usuario (id_persona, usuario, correo, password_hash, activo)
       VALUES ($1, $2, $3, $4, TRUE)
       RETURNING id_usuario`,
      [persona.rows[0].id_persona, identificador, correo, passwordHash],
    );
    await client.query(
      `INSERT INTO sigd_org.usuario_rol (id_usuario, rol_id)
       VALUES ($1, $2)`,
      [cuenta.rows[0].id_usuario, rol.rows[0].rol_id],
    );
    await client.query('COMMIT');
    console.log(`Cuenta administrativa creada: ${identificador} (rol ADMINISTRADOR).`);
  } catch (error) {
    await client.query('ROLLBACK').catch((rollbackError: unknown) => {
      console.error('[TUPA] No se pudo revertir la creación del usuario:', rollbackError);
    });
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error('[TUPA] No se pudo crear el usuario administrativo:', error);
  process.exitCode = 1;
});
