import { Pool } from 'pg';
import { Argon2Service } from '../domains/identicore/argon2.service.js';

interface DemoAccountConfig {
  usuario: string;
  correo: string;
  dni: string;
  nombres: string;
  apellidos: string;
  rol: 'CIUDADANO' | 'MESA_PARTES' | 'ESPECIALISTA' | 'SECRETARIO' | 'DIRECTOR' | 'ADMINISTRADOR' | 'TESORERIA';
  areaCodigo: 'DIR' | 'SDA' | null;
  passwordEnvVar: string;
}

const CUENTAS_DEMO: DemoAccountConfig[] = [
  {
    usuario: 'ciudadano_demo',
    correo: 'ciudadano.demo@iestp-suiza.edu.pe',
    dni: '99000001',
    nombres: 'Ciudadano',
    apellidos: 'Demo Laboratorio',
    rol: 'CIUDADANO',
    areaCodigo: null,
    passwordEnvVar: 'LAB_CIUDADANO_PASSWORD',
  },
  {
    usuario: 'mesa_partes_demo',
    correo: 'mesapartes.demo@iestp-suiza.edu.pe',
    dni: '99000002',
    nombres: 'Operador',
    apellidos: 'Mesa de Partes Demo',
    rol: 'MESA_PARTES',
    areaCodigo: 'DIR',
    passwordEnvVar: 'LAB_MESA_PARTES_PASSWORD',
  },
  {
    usuario: 'especialista_demo',
    correo: 'especialista.demo@iestp-suiza.edu.pe',
    dni: '99000003',
    nombres: 'Especialista',
    apellidos: 'Académico Demo',
    rol: 'ESPECIALISTA',
    areaCodigo: 'SDA',
    passwordEnvVar: 'LAB_ESPECIALISTA_PASSWORD',
  },
  {
    usuario: 'secretario_demo',
    correo: 'secretario.demo@iestp-suiza.edu.pe',
    dni: '99000004',
    nombres: 'Secretario',
    apellidos: 'Académico Demo',
    rol: 'SECRETARIO',
    areaCodigo: 'SDA',
    passwordEnvVar: 'LAB_SECRETARIO_PASSWORD',
  },
  {
    usuario: 'director_demo',
    correo: 'director.demo@iestp-suiza.edu.pe',
    dni: '99000005',
    nombres: 'Director',
    apellidos: 'General Demo',
    rol: 'DIRECTOR',
    areaCodigo: 'DIR',
    passwordEnvVar: 'LAB_DIRECTOR_PASSWORD',
  },
  {
    usuario: 'administrador_demo',
    correo: 'administrador.demo@iestp-suiza.edu.pe',
    dni: '99000006',
    nombres: 'Administrador',
    apellidos: 'Sistema Demo',
    rol: 'ADMINISTRADOR',
    areaCodigo: 'DIR',
    passwordEnvVar: 'LAB_ADMINISTRADOR_PASSWORD',
  },
  {
    usuario: 'tesoreria_demo',
    correo: 'tesoreria.demo@iestp-suiza.edu.pe',
    dni: '99000007',
    nombres: 'Tesorero',
    apellidos: 'Institucional Demo',
    rol: 'TESORERIA',
    areaCodigo: 'DIR',
    passwordEnvVar: 'LAB_TESORERIA_PASSWORD',
  },
];

export async function ejecutarSeedLab(poolParam?: Pool): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: seed-lab cannot run in production environment.');
  }

  // Validar presencia obligatoria de todas las contraseñas de las cuentas demo antes de proceder
  for (const cuenta of CUENTAS_DEMO) {
    const password = process.env[cuenta.passwordEnvVar];
    if (!password || password.trim() === '') {
      throw new Error(
        `Falta definir la variable de entorno obligatoria para la cuenta demo: ${cuenta.passwordEnvVar}`,
      );
    }
  }

  let pool: Pool;
  if (poolParam) {
    pool = poolParam;
  } else {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl?.trim()) {
      throw new Error(
        'Falta definir DATABASE_URL para ejecutar el seed de laboratorio.',
      );
    }
    pool = new Pool({
      connectionString: databaseUrl,
    });
  }

  console.log('--- Iniciando Seed LAB SIGD 2026 ---');

  try {
    for (const cuenta of CUENTAS_DEMO) {
      const password = process.env[cuenta.passwordEnvVar]!;

      const passwordHash = await Argon2Service.hash(password, {
        type: 2,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
      });

      // 1. Upsert persona
      const personaRes = await pool.query<{ id_persona: string }>(
        `INSERT INTO sigd_auth.persona (tipo, id_documento)
         VALUES ('NATURAL', $1)
         ON CONFLICT (tipo, id_documento) DO UPDATE
           SET id_documento = EXCLUDED.id_documento
         RETURNING id_persona`,
        [cuenta.dni],
      );
      const idPersona = personaRes.rows[0].id_persona;

      // 2. Upsert persona_natural
      const nombreCompleto = `${cuenta.nombres} ${cuenta.apellidos}`.trim();
      await pool.query(
        `INSERT INTO sigd_auth.persona_natural (id_persona, nombres, apellidos, nombre_completo, correo)
         VALUES ($1::uuid, $2, $3, $4, $5)
         ON CONFLICT (id_persona) DO UPDATE
           SET nombres = EXCLUDED.nombres,
               apellidos = EXCLUDED.apellidos,
               nombre_completo = EXCLUDED.nombre_completo,
               correo = EXCLUDED.correo`,
        [idPersona, cuenta.nombres, cuenta.apellidos, nombreCompleto, cuenta.correo],
      );

      // 3. Upsert cuenta_usuario
      const cuentaRes = await pool.query<{ id_usuario: string }>(
        `INSERT INTO sigd_auth.cuenta_usuario (id_persona, usuario, correo, password_hash, activo)
         VALUES ($1::uuid, $2, $3, $4, true)
         ON CONFLICT (usuario) DO UPDATE
           SET password_hash = EXCLUDED.password_hash,
               correo = EXCLUDED.correo,
               activo = true,
               id_persona = EXCLUDED.id_persona
         RETURNING id_usuario`,
        [idPersona, cuenta.usuario, cuenta.correo, passwordHash],
      );
      const idUsuario = cuentaRes.rows[0].id_usuario;

      // 4. Resolver rol_id
      const rolRes = await pool.query<{ rol_id: string }>(
        `SELECT rol_id FROM sigd_org.rol_sistema WHERE codigo = $1`,
        [cuenta.rol],
      );
      if (!rolRes.rows[0]) {
        throw new Error(`Rol canónico no encontrado en sigd_org.rol_sistema: ${cuenta.rol}`);
      }
      const rolId = rolRes.rows[0].rol_id;

      // 5. Resolver area_id
      let areaId: string | null = null;
      if (cuenta.areaCodigo) {
        const areaRes = await pool.query<{ area_id: string }>(
          `SELECT area_id FROM sigd_org.area WHERE codigo = $1`,
          [cuenta.areaCodigo],
        );
        if (!areaRes.rows[0]) {
          throw new Error(`Área no encontrada en sigd_org.area: ${cuenta.areaCodigo}`);
        }
        areaId = areaRes.rows[0].area_id;
      }

      // 6. Upsert usuario_rol
      const existingRol = await pool.query<{ id_usuario_rol: string }>(
        `SELECT id_usuario_rol FROM sigd_org.usuario_rol
          WHERE id_usuario = $1::uuid AND rol_id = $2::uuid`,
        [idUsuario, rolId],
      );

      if (existingRol.rows[0]) {
        await pool.query(
          `UPDATE sigd_org.usuario_rol
              SET area_id = $1::uuid,
                  vigente_hasta = NULL
            WHERE id_usuario_rol = $2::uuid`,
          [areaId, existingRol.rows[0].id_usuario_rol],
        );
      } else {
        await pool.query(
          `INSERT INTO sigd_org.usuario_rol (id_usuario, rol_id, area_id, vigente_desde)
           VALUES ($1::uuid, $2::uuid, $3::uuid, now())`,
          [idUsuario, rolId, areaId],
        );
      }

      console.log(
        `✓ [${cuenta.rol}] Usuario: ${cuenta.usuario} | DNI: ${cuenta.dni} | Área: ${cuenta.areaCodigo ?? 'N/A'}`,
      );
    }

    console.log('--- Seed LAB completado exitosamente ---');
  } finally {
    if (!poolParam) {
      await pool.end();
    }
  }
}

// Ejecución directa
const esScriptDirecto =
  process.argv[1]?.endsWith('seed-lab.ts') || process.argv[1]?.endsWith('seed-lab.js');
if (esScriptDirecto) {
  ejecutarSeedLab().catch((err) => {
    console.error('Error al ejecutar seed:lab:', err);
    process.exit(1);
  });
}
