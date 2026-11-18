import 'dotenv/config';
import { Pool } from 'pg';
import { Argon2Service } from '../domains/identicore/argon2.service.js';

interface DemoAccountConfig {
  usuario: string;
  correo: string;
  dni: string;
  nombres: string;
  apellidos: string;
  rol: 'CIUDADANO' | 'MESA_PARTES' | 'ESPECIALISTA' | 'SECRETARIO' | 'DIRECTOR' | 'ADMINISTRADOR' | 'TESORERIA' | 'SUPERADMINISTRADOR';
  areaCodigo: 'DIR' | 'SDA' | null;
  passwordEnvVar: string;
  perfilOperativoCodigo?: 'GESTOR_AREA_ACADEMICA';
  funcion?: string;
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
  {
    usuario: 'superadmin_demo',
    correo: 'superadmin.demo@iestp-suiza.edu.pe',
    dni: '99000008',
    nombres: 'Superadministrador',
    apellidos: 'Gobierno Demo',
    rol: 'SUPERADMINISTRADOR',
    areaCodigo: 'DIR',
    passwordEnvVar: 'LAB_SUPERADMINISTRADOR_PASSWORD',
  },
  {
    usuario: 'responsable_ingles_demo',
    correo: 'ingles.demo@iestp-suiza.edu.pe',
    dni: '99000009',
    nombres: 'Responsable',
    apellidos: 'Inglés Demo',
    rol: 'ESPECIALISTA',
    areaCodigo: 'SDA',
    passwordEnvVar: 'LAB_RESPONSABLE_INGLES_PASSWORD',
    perfilOperativoCodigo: 'GESTOR_AREA_ACADEMICA',
    funcion: 'RESPONSABLE_IDIOMAS',
  },
];

export async function ejecutarSeedLab(poolParam?: Pool): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: seed-lab cannot run in production environment.');
  }

  // Validar presencia obligatoria de contraseñas de las cuentas demo antes de proceder
  for (const cuenta of CUENTAS_DEMO) {
    const password = process.env[cuenta.passwordEnvVar];
    if (!password || password.trim() === '') {
      if (cuenta.usuario === 'superadmin_demo' || cuenta.usuario === 'responsable_ingles_demo') {
        // Omisión controlada si no se define la variable (sin fallback a otras contraseñas)
        continue;
      }
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
      const password = process.env[cuenta.passwordEnvVar];
      if (!password || password.trim() === '') {
        if (cuenta.usuario === 'superadmin_demo' || cuenta.usuario === 'responsable_ingles_demo') {
          console.log(`[SKIP] Cuenta ${cuenta.usuario} omitida: ${cuenta.passwordEnvVar} no configurada.`);
          continue;
        }
        throw new Error(
          `Falta definir la variable de entorno obligatoria para la cuenta demo: ${cuenta.passwordEnvVar}`,
        );
      }

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

      // 7. Upsert vinculo_institucional para cuentas institucionales
      if (cuenta.rol !== 'CIUDADANO') {
        const tipoVinculoCodigo =
          cuenta.rol === 'DIRECTOR'
            ? 'DIRECTIVO'
            : cuenta.rol === 'ESPECIALISTA' || cuenta.rol === 'SECRETARIO'
              ? 'DOCENTE'
              : 'ADMINISTRATIVO';
        const tipoVincRes = await pool.query<{ id_tipo_vinculo: number }>(
          `SELECT id_tipo_vinculo FROM sigd_auth.tipo_vinculo_institucional WHERE codigo = $1`,
          [tipoVinculoCodigo],
        );
        if (tipoVincRes.rows[0]) {
          const idTipoVinculo = tipoVincRes.rows[0].id_tipo_vinculo;
          const vincExist = await pool.query<{ id_vinculo: string }>(
            `SELECT id_vinculo FROM sigd_auth.vinculo_institucional
              WHERE id_persona = $1::uuid AND id_tipo_vinculo = $2`,
            [idPersona, idTipoVinculo],
          );
          if (!vincExist.rows[0]) {
            await pool.query(
              `INSERT INTO sigd_auth.vinculo_institucional (id_persona, id_tipo_vinculo, estado, vigente_desde)
               VALUES ($1::uuid, $2, 'ACTIVO', now())`,
              [idPersona, idTipoVinculo],
            );
          } else {
            await pool.query(
              `UPDATE sigd_auth.vinculo_institucional
                  SET estado = 'ACTIVO', vigente_hasta = NULL
                WHERE id_vinculo = $1::uuid`,
              [vincExist.rows[0].id_vinculo],
            );
          }
        }
      }

      // 8. Upsert perfil operativo institucional si está especificado
      if (cuenta.perfilOperativoCodigo) {
        const perfilRes = await pool.query<{ perfil_id: number }>(
          `SELECT perfil_id FROM sigd_org.perfil_operativo WHERE codigo = $1`,
          [cuenta.perfilOperativoCodigo],
        );
        if (perfilRes.rows[0]) {
          const perfilId = perfilRes.rows[0].perfil_id;
          const apoExist = await pool.query<{ id_asignacion_perfil: string }>(
            `SELECT id_asignacion_perfil FROM sigd_org.asignacion_perfil_operativo
              WHERE id_usuario = $1::uuid AND perfil_id = $2`,
            [idUsuario, perfilId],
          );
          const alcanceJson = cuenta.funcion ? JSON.stringify({ funcion: cuenta.funcion }) : null;
          if (!apoExist.rows[0]) {
            await pool.query(
              `INSERT INTO sigd_org.asignacion_perfil_operativo
                 (id_usuario, perfil_id, area_id, scope, estado, alcance, vigente_desde)
               VALUES ($1::uuid, $2, $3::uuid, 'AREA', 'ACTIVO', $4::jsonb, now())`,
              [idUsuario, perfilId, areaId, alcanceJson],
            );
          } else {
            await pool.query(
              `UPDATE sigd_org.asignacion_perfil_operativo
                  SET area_id = $1::uuid, estado = 'ACTIVO', vigente_hasta = NULL, alcance = $3::jsonb
                WHERE id_asignacion_perfil = $2::uuid`,
              [areaId, apoExist.rows[0].id_asignacion_perfil, alcanceJson],
            );
          }
        }
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
