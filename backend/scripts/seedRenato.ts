import 'dotenv/config';
import { crearPool } from '../src/database.js';
import { Argon2Service } from '../src/domains/identicore/argon2.service.js';

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL no configurada');

  const pool = crearPool(databaseUrl);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Eliminar si ya existía parcialmente para idempotencia
    const existente = await client.query(
      `SELECT id_usuario, id_persona FROM sigd_auth.cuenta_usuario WHERE usuario = $1 OR correo = $2`,
      ['rtarazona.flores@gmail.com', 'rtarazona.flores@gmail.com']
    );

    if (existente.rowCount && existente.rowCount > 0) {
      console.log('El usuario ya existe. Actualizando contraseña y rol...');
      const nuevoHash = await Argon2Service.hash('Renato#_92');
      await client.query(
        `UPDATE sigd_auth.cuenta_usuario SET password_hash = $1, activo = TRUE WHERE id_usuario = $2`,
        [nuevoHash, existente.rows[0].id_usuario]
      );
      const rolRes = await client.query(
        `SELECT rol_id FROM sigd_org.rol_sistema WHERE codigo = 'ADMINISTRADOR' AND vigente = TRUE`
      );
      if (rolRes.rows[0]) {
        await client.query(
          `INSERT INTO sigd_org.usuario_rol (id_usuario, rol_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [existente.rows[0].id_usuario, rolRes.rows[0].rol_id]
        );
      }
      await client.query('COMMIT');
      console.log('Usuario actualizado correctamente.');
      return;
    }

    // 2. Obtener rol ADMINISTRADOR
    const rolRes = await client.query(
      `SELECT rol_id FROM sigd_org.rol_sistema WHERE codigo = 'ADMINISTRADOR' AND vigente = TRUE`
    );
    if (!rolRes.rows[0]) {
      throw new Error('No se encontró el rol ADMINISTRADOR.');
    }
    const rolAdminId = rolRes.rows[0].rol_id;

    // 3. Crear Persona
    const dni = '45678912';
    const personaRes = await client.query(
      `INSERT INTO sigd_auth.persona (tipo, id_documento)
       VALUES ('NATURAL', $1)
       RETURNING id_persona`,
      [dni]
    );
    const personaId = personaRes.rows[0].id_persona;

    // 4. Crear Persona Natural
    await client.query(
      `INSERT INTO sigd_auth.persona_natural
       (id_persona, nombres, apellidos, nombre_completo, correo, telefono)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [personaId, 'Renato', 'Tarazona Flores', 'Renato Tarazona Flores', 'rtarazona.flores@gmail.com', '987654321']
    );

    // 5. Generar Hash Argon2 de Renato#_92
    const passwordHash = await Argon2Service.hash('Renato#_92');

    // 6. Crear Cuenta de Usuario
    const cuentaRes = await client.query(
      `INSERT INTO sigd_auth.cuenta_usuario
       (id_persona, usuario, correo, password_hash, activo)
       VALUES ($1, $2, $3, $4, TRUE)
       RETURNING id_usuario`,
      [personaId, 'rtarazona.flores@gmail.com', 'rtarazona.flores@gmail.com', passwordHash]
    );
    const usuarioId = cuentaRes.rows[0].id_usuario;

    // 7. Asignar rol ADMINISTRADOR
    await client.query(
      `INSERT INTO sigd_org.usuario_rol (id_usuario, rol_id)
       VALUES ($1, $2)`,
      [usuarioId, rolAdminId]
    );

    await client.query('COMMIT');
    console.log(`Usuario Renato creado exitosamente con ID: ${usuarioId}`);
    console.log(`Usuario / Correo: rtarazona.flores@gmail.com`);
    console.log(`Rol: ADMINISTRADOR`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al registrar usuario Renato:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
