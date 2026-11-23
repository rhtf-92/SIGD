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
  areaCodigo: 'DIR' | 'SDA' | 'CI' | null;
  passwordEnvVar: string;
  perfilOperativoCodigo?: 'GESTOR_AREA_ACADEMICA';
  funcion?: string;
}

const CUENTAS_DEMO: DemoAccountConfig[] = [
  {
    usuario: 'ciudadano_suiza',
    correo: 'ciudadano@iestp-suiza.edu.pe',
    dni: '99000001',
    nombres: 'Ciudadano',
    apellidos: 'Solicitante Externo',
    rol: 'CIUDADANO',
    areaCodigo: null,
    passwordEnvVar: 'LAB_CIUDADANO_PASSWORD',
  },
  {
    usuario: 'mesa_partes',
    correo: 'mesapartes@iestp-suiza.edu.pe',
    dni: '99000002',
    nombres: 'Módulo Mesa de Partes',
    apellidos: 'Ventanilla IESTP Suiza',
    rol: 'MESA_PARTES',
    areaCodigo: 'DIR',
    passwordEnvVar: 'LAB_MESA_PARTES_PASSWORD',
  },
  {
    usuario: 'especialista_ingles',
    correo: 'especialista.ingles@iestp-suiza.edu.pe',
    dni: '99000003',
    nombres: 'Docente Especialista de Inglés',
    apellidos: 'Centro de Idiomas',
    rol: 'ESPECIALISTA',
    areaCodigo: 'CI',
    passwordEnvVar: 'LAB_ESPECIALISTA_PASSWORD',
    funcion: 'ESPECIALISTA_INGLES',
  },
  {
    usuario: 'subdireccion_academica',
    correo: 'subdireccion@iestp-suiza.edu.pe',
    dni: '99000004',
    nombres: 'Subdirección Académica',
    apellidos: 'Secretaría Académica (SDA)',
    rol: 'SECRETARIO',
    areaCodigo: 'SDA',
    passwordEnvVar: 'LAB_SECRETARIO_PASSWORD',
  },
  {
    usuario: 'direccion_general',
    correo: 'direccion@iestp-suiza.edu.pe',
    dni: '99000005',
    nombres: 'Carlos Alberto Sánchez',
    apellidos: 'Director General IESTP Suiza',
    rol: 'DIRECTOR',
    areaCodigo: 'DIR',
    passwordEnvVar: 'LAB_DIRECTOR_PASSWORD',
  },
  {
    usuario: 'admin_suiza',
    correo: 'admin@iestp-suiza.edu.pe',
    dni: '99000006',
    nombres: 'Administrador General',
    apellidos: 'SIGD IESTP Suiza',
    rol: 'ADMINISTRADOR',
    areaCodigo: 'DIR',
    passwordEnvVar: 'LAB_ADMINISTRADOR_PASSWORD',
  },
  {
    usuario: 'tesoreria_caja',
    correo: 'tesoreria@iestp-suiza.edu.pe',
    dni: '99000007',
    nombres: 'Módulo Tesorería y Caja',
    apellidos: 'Recaudación IESTP Suiza',
    rol: 'TESORERIA',
    areaCodigo: 'DIR',
    passwordEnvVar: 'LAB_TESORERIA_PASSWORD',
  },
  {
    usuario: 'superadmin_suiza',
    correo: 'superadmin@iestp-suiza.edu.pe',
    dni: '99000008',
    nombres: 'Superadministrador',
    apellidos: 'TI IESTP Suiza',
    rol: 'SUPERADMINISTRADOR',
    areaCodigo: 'DIR',
    passwordEnvVar: 'LAB_SUPERADMINISTRADOR_PASSWORD',
  },
  {
    usuario: 'coordinador_idiomas',
    correo: 'coordinador.idiomas@iestp-suiza.edu.pe',
    dni: '99000009',
    nombres: 'Coordinador',
    apellidos: 'Área Centro de Idiomas',
    rol: 'ESPECIALISTA',
    areaCodigo: 'CI',
    passwordEnvVar: 'LAB_RESPONSABLE_INGLES_PASSWORD',
    perfilOperativoCodigo: 'GESTOR_AREA_ACADEMICA',
    funcion: 'COORDINADOR_IDIOMAS',
  },
  {
    usuario: 'especialista_portugues',
    correo: 'especialista.portugues@iestp-suiza.edu.pe',
    dni: '99000010',
    nombres: 'Docente Especialista de Portugués',
    apellidos: 'Centro de Idiomas',
    rol: 'ESPECIALISTA',
    areaCodigo: 'CI',
    passwordEnvVar: 'LAB_ESPECIALISTA_PORTUGUES_PASSWORD',
    funcion: 'ESPECIALISTA_PORTUGUES',
  },
];

export async function ejecutarSeedLab(poolParam?: Pool): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('FATAL: seed-lab cannot run in production environment.');
  }

  const DEFAULT_PASSWORDS: Record<string, string> = {
    LAB_CIUDADANO_PASSWORD: 'CiudadanoDemo#2026',
    LAB_MESA_PARTES_PASSWORD: 'MesaPartesDemo#2026',
    LAB_ESPECIALISTA_PASSWORD: 'EspecialistaDemo#2026',
    LAB_SECRETARIO_PASSWORD: 'SecretarioDemo#2026',
    LAB_DIRECTOR_PASSWORD: 'DirectorDemo#2026',
    LAB_ADMINISTRADOR_PASSWORD: 'AdministradorDemo#2026',
    LAB_TESORERIA_PASSWORD: 'TesoreriaDemo#2026',
    LAB_SUPERADMINISTRADOR_PASSWORD: 'SuperAdminDemo#2026',
    LAB_RESPONSABLE_INGLES_PASSWORD: 'ResponsableInglesDemo#2026',
    LAB_ESPECIALISTA_PORTUGUES_PASSWORD: 'EspecialistaPortugues#2026',
  };

  // Validar presencia de contraseñas individuales de las cuentas institucionales
  for (const cuenta of CUENTAS_DEMO) {
    if (!process.env[cuenta.passwordEnvVar] || process.env[cuenta.passwordEnvVar]?.trim() === '') {
      process.env[cuenta.passwordEnvVar] = DEFAULT_PASSWORDS[cuenta.passwordEnvVar];
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
    // Asegurar existencia canónica del Área Centro de Idiomas (CI)
    await pool.query(`
      INSERT INTO sigd_org.area (area_id, codigo, nombre, area_padre_id, tipo_unidad, vigente)
      VALUES (
        'a0000000-0000-0000-0000-000000000003'::uuid,
        'CI',
        'Centro de Idiomas',
        'a0000000-0000-0000-0000-000000000001'::uuid,
        'AREA',
        true
      )
      ON CONFLICT (codigo) DO UPDATE
      SET nombre = 'Centro de Idiomas', vigente = true
    `);

    for (const cuenta of CUENTAS_DEMO) {
      const password =
        process.env[cuenta.passwordEnvVar]?.trim() ||
        DEFAULT_PASSWORDS[cuenta.passwordEnvVar];

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

      // 3. Upsert cuenta_usuario (preservando id_usuario si ya existía para esa persona)
      let idUsuario: string;
      const existentePorPersona = await pool.query<{ id_usuario: string }>(
        `UPDATE sigd_auth.cuenta_usuario
            SET usuario = $2,
                correo = $3,
                password_hash = $4,
                activo = true
          WHERE id_persona = $1::uuid
          RETURNING id_usuario`,
        [idPersona, cuenta.usuario, cuenta.correo, passwordHash],
      );
      if (existentePorPersona.rows[0]) {
        idUsuario = existentePorPersona.rows[0].id_usuario;
      } else {
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
        idUsuario = cuentaRes.rows[0].id_usuario;
      }

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

      // 9. Si es ciudadano, asegurar que tenga acceso TUPA aprobado para trámites
      if (cuenta.rol === 'CIUDADANO') {
        await pool.query(
          `INSERT INTO sigd_doc.tupa_solicitud_acceso (id_persona, correo, motivo, estado, fecha_resolucion, vigencia_hasta)
           VALUES ($1::uuid, $2, 'Acceso TUPA autorizado para consultas y requerimientos', 'APROBADA', now(), now() + interval '365 days')
           ON CONFLICT DO NOTHING;`,
          [idPersona, cuenta.correo],
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
