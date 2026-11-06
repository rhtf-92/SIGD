import 'dotenv/config';
import type { PoolClient } from 'pg';
import { crearPool } from '../database.js';
import { Argon2Service } from '../domains/identicore/argon2.service.js';

const PASSWORD_DEMO = '123';

interface UsuarioSeed {
  idUsuario: string;
  idPersona: string;
  documento: string;
  usuario: string;
  correo: string;
  nombres: string;
  apellidos: string;
  nombreCompleto: string;
  rol: string;
  telefono: string;
  firmaHabilitada: boolean;
}

const USUARIOS: UsuarioSeed[] = [
  {
    idUsuario: '22222222-2222-2222-2222-222222222001',
    idPersona: '11111111-1111-1111-1111-111111111001',
    documento: '10000001',
    usuario: 'admin',
    correo: 'admin@iestp-suiza.edu.pe',
    nombres: 'Administrador',
    apellidos: 'del Sistema',
    nombreCompleto: 'Administrador del Sistema',
    rol: 'ADMIN',
    telefono: '900000001',
    firmaHabilitada: true,
  },
  {
    idUsuario: '22222222-2222-2222-2222-222222222002',
    idPersona: '11111111-1111-1111-1111-111111111002',
    documento: '10000002',
    usuario: 'director',
    correo: 'director@iestp-suiza.edu.pe',
    nombres: 'Elena',
    apellidos: 'Rojas Vasquez',
    nombreCompleto: 'Elena Rojas Vasquez',
    rol: 'DIRECTOR',
    telefono: '900000002',
    firmaHabilitada: true,
  },
  {
    idUsuario: '22222222-2222-2222-2222-222222222003',
    idPersona: '11111111-1111-1111-1111-111111111003',
    documento: '10000003',
    usuario: 'docente',
    correo: 'docente@iestp-suiza.edu.pe',
    nombres: 'Docente',
    apellidos: 'Coordinador',
    nombreCompleto: 'Docente Coordinador',
    rol: 'DOCENTE',
    telefono: '900000003',
    firmaHabilitada: true,
  },
  {
    idUsuario: '22222222-2222-2222-2222-222222222004',
    idPersona: '11111111-1111-1111-1111-111111111004',
    documento: '10000004',
    usuario: 'mesa_partes',
    correo: 'mesadepartes@iestp-suiza.edu.pe',
    nombres: 'Mesa',
    apellidos: 'de Partes',
    nombreCompleto: 'Mesa de Partes',
    rol: 'MESA_PARTES',
    telefono: '900000004',
    firmaHabilitada: false,
  },
  {
    idUsuario: '22222222-2222-2222-2222-222222222005',
    idPersona: '11111111-1111-1111-1111-111111111005',
    documento: '10000005',
    usuario: 'estudiante',
    correo: 'estudiante@iestp-suiza.edu.pe',
    nombres: 'Estudiante',
    apellidos: 'Demo',
    nombreCompleto: 'Estudiante Demo',
    rol: 'ESTUDIANTE',
    telefono: '900000005',
    firmaHabilitada: false,
  },
];

const ROLES: Array<{ codigo: string; nombre: string; descripcion: string }> = [
  { codigo: 'ADMIN', nombre: 'Administrador', descripcion: 'Alias operativo del Administrador del Sistema' },
  { codigo: 'ADMINISTRADOR', nombre: 'Administrador del Sistema', descripcion: 'Administración técnica total de la plataforma SIGD' },
  { codigo: 'SUPER_ADMIN', nombre: 'Super Administrador', descripcion: 'Alias de gobernanza global del SIGD' },
  { codigo: 'DIRECTOR', nombre: 'Director General', descripcion: 'Emisión de resoluciones directorales y firma digital' },
  { codigo: 'SECRETARIO', nombre: 'Secretario Académico', descripcion: 'Proyección y preparación de resoluciones y expedientes' },
  { codigo: 'DOCENTE', nombre: 'Docente / Coordinador', descripcion: 'Evaluación académica y derivación de actuados' },
  { codigo: 'ESPECIALISTA', nombre: 'Especialista', descripcion: 'Análisis técnico y emisión de dictámenes' },
  { codigo: 'MESA_PARTES', nombre: 'Mesa de Partes', descripcion: 'Recepción, radicación y registro de documentos' },
  { codigo: 'CIUDADANO', nombre: 'Ciudadano / Administrado', descripcion: 'Consulta pública y casilla electrónica' },
  { codigo: 'ESTUDIANTE', nombre: 'Estudiante / Administrado', descripcion: 'Trámites propios y casilla electrónica personal' },
];

async function asegurarRoles(cliente: PoolClient): Promise<void> {
  await cliente.query('ALTER TABLE sigd_org.rol_sistema DROP CONSTRAINT IF EXISTS chk_rol_codigo');
  await cliente.query(`
    ALTER TABLE sigd_org.rol_sistema
      ADD CONSTRAINT chk_rol_codigo CHECK (codigo IN (
        'ADMIN', 'ADMINISTRADOR', 'SUPER_ADMIN', 'DIRECTOR', 'SECRETARIO',
        'ESPECIALISTA', 'DOCENTE', 'MESA_PARTES', 'CIUDADANO', 'ESTUDIANTE'
      ))
  `);

  for (const rol of ROLES) {
    await cliente.query(
      `INSERT INTO sigd_org.rol_sistema (codigo, nombre, descripcion, vigente)
       VALUES ($1, $2, $3, TRUE)
       ON CONFLICT (codigo) DO UPDATE
         SET nombre = EXCLUDED.nombre,
             descripcion = EXCLUDED.descripcion,
             vigente = TRUE`,
      [rol.codigo, rol.nombre, rol.descripcion],
    );
  }

  await cliente.query(`
    INSERT INTO sigd_org.rol_permiso (rol_id, permiso_id)
    SELECT rol_admin.rol_id, rp.permiso_id
      FROM sigd_org.rol_sistema rol_admin
      JOIN sigd_org.rol_sistema rol_base ON rol_base.codigo = 'ADMINISTRADOR'
      JOIN sigd_org.rol_permiso rp ON rp.rol_id = rol_base.rol_id
     WHERE rol_admin.codigo = 'ADMIN'
    ON CONFLICT DO NOTHING
  `);
}

async function limpiarCuentas(cliente: PoolClient): Promise<void> {
  // `titular_usuario_id` usa ON DELETE RESTRICT: hay que vaciar las encargaturas
  // antes de eliminar las cuentas.
  await cliente.query('DELETE FROM sigd_org.encargatura_despacho');
  await cliente.query('DELETE FROM sigd_auth.cuenta_usuario');
}

async function sembrarUsuario(cliente: PoolClient, datos: UsuarioSeed): Promise<void> {
  const passwordHash = await Argon2Service.hash(PASSWORD_DEMO);
  if (!(await Argon2Service.verify(passwordHash, PASSWORD_DEMO))) {
    throw new Error(`No se pudo verificar el hash generado para ${datos.usuario}.`);
  }

  await cliente.query(
    `INSERT INTO sigd_auth.persona (id_persona, tipo, id_documento)
     VALUES ($1, 'NATURAL', $2)
     ON CONFLICT (id_persona) DO UPDATE
       SET tipo = EXCLUDED.tipo,
           id_documento = EXCLUDED.id_documento`,
    [datos.idPersona, datos.documento],
  );

  await cliente.query(
    `INSERT INTO sigd_auth.persona_natural
       (id_persona, nombres, apellidos, nombre_completo, correo)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id_persona) DO UPDATE
       SET nombres = EXCLUDED.nombres,
           apellidos = EXCLUDED.apellidos,
           nombre_completo = EXCLUDED.nombre_completo,
           correo = EXCLUDED.correo`,
    [datos.idPersona, datos.nombres, datos.apellidos, datos.nombreCompleto, datos.correo],
  );

  await cliente.query(
    `INSERT INTO sigd_auth.cuenta_usuario
       (id_usuario, id_persona, usuario, correo, password_hash, activo)
     VALUES ($1, $2, $3, $4, $5, TRUE)`,
    [datos.idUsuario, datos.idPersona, datos.usuario, datos.correo, passwordHash],
  );

  await cliente.query(
    `INSERT INTO sigd_auth.perfil_usuario
       (id_usuario, telefono, firma_electronica_habilitada)
     VALUES ($1, $2, $3)
     ON CONFLICT (id_usuario) DO UPDATE
       SET telefono = EXCLUDED.telefono,
           firma_electronica_habilitada = EXCLUDED.firma_electronica_habilitada,
           actualizado_en = now()`,
    [datos.idUsuario, datos.telefono, datos.firmaHabilitada],
  );

  const asignacion = await cliente.query(
    `INSERT INTO sigd_org.usuario_rol (id_usuario, rol_id, vigente_desde)
     SELECT $1::uuid, r.rol_id, now()
       FROM sigd_org.rol_sistema r
      WHERE r.codigo = $2`,
    [datos.idUsuario, datos.rol],
  );

  if (asignacion.rowCount !== 1) {
    throw new Error(`No se pudo asignar el rol ${datos.rol} a ${datos.usuario}.`);
  }
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL no está definida. Ejecute el seed dentro del contenedor o exporte la variable.');
  }

  const pool = crearPool(databaseUrl);
  const cliente = await pool.connect();

  try {
    await cliente.query('BEGIN');
    await asegurarRoles(cliente);
    await limpiarCuentas(cliente);
    for (const usuario of USUARIOS) {
      await sembrarUsuario(cliente, usuario);
    }
    await cliente.query('COMMIT');

    console.log('[SEED-AUTH] Cuentas restauradas con contraseña "123":');
    for (const usuario of USUARIOS) {
      console.log(`  ${usuario.usuario.padEnd(12)} -> ${usuario.rol}`);
    }
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  } finally {
    cliente.release();
    await pool.end();
  }
}

try {
  await main();
} catch (error) {
  console.error('[SEED-AUTH] Finalizó con error:', error);
  process.exitCode = 1;
}
