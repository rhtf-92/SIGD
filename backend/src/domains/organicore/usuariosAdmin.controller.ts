import type {
  Request,
  Response,
  NextFunction,
} from "express";
import type { Pool } from "pg";
import { z } from "zod";
import { Argon2Service } from "../identicore/argon2.service.js";
import { ConflictError, ValidationError, NotFoundError } from "../../shared/domain/errors/index.js";

import {
  listarUsuariosQuerySchema,
  crearUsuarioAdminSchema,
  actualizarUsuarioAdminSchema,
  usuarioIdParamSchema,
} from "./dto/usuarioAdmin.dto.js";

import type {
  UsuariosAdminService,
} from "./usuariosAdmin.service.js";

/**
 * Schema para alta de usuario institucional administrativo (+ Nuevo usuario).
 */
export const nuevoUsuarioInstitucionalSchema = z.object({
  tipoDocumento: z.string().default('DNI'),
  numeroDocumento: z.string().min(8, 'El documento debe tener al menos 8 dígitos').max(20),
  nombres: z.string().min(2, 'Los nombres deben tener al menos 2 caracteres'),
  apellidos: z.string().min(2, 'Los apellidos deben tener al menos 2 caracteres'),
  correo: z.string().email('Correo electrónico no válido'),
  usuario: z.string().min(3, 'El nombre de usuario debe tener al menos 3 caracteres'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  rolId: z.string().min(1, 'El rol es obligatorio'),
  areaId: z.string().uuid('ID de área inválido').optional().nullable(),
  activo: z.boolean().default(true),
});

export function crearUsuariosAdminController(
  service: UsuariosAdminService,
  pool?: Pool,
) {
  /**
   * GET /api/v1/admin/usuarios
   *
   * Directorio institucional paginado.
   */
  async function listarUsuarios(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const filtros =
        listarUsuariosQuerySchema.parse(
          req.query,
        );

      const resultado =
        await service.listarUsuarios(
          filtros,
        );

      res.status(200).json(resultado);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/admin/usuarios/institucional
   *
   * Alta segura de usuario institucional (ADMINISTRADOR).
   */
  async function crearUsuarioInstitucional(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      if (!pool) {
        throw new Error("Pool de base de datos no configurado en usuarios controller.");
      }

      const datos = nuevoUsuarioInstitucionalSchema.parse(req.body);

      // 1. Validar unicidad de usuario y correo
      const existente = await pool.query(
        `SELECT id_usuario FROM sigd_auth.cuenta_usuario WHERE usuario = $1 OR correo = $2 LIMIT 1`,
        [datos.usuario.trim(), datos.correo.trim().toLowerCase()],
      );
      if (existente.rowCount && existente.rowCount > 0) {
        throw new ConflictError({
          message: "Ya existe un usuario o correo registrado con esos datos.",
        });
      }

      // 2. Hash Argon2id de la contraseña
      const passwordHash = await Argon2Service.hash(datos.password, {
        type: 2,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
      });

      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');

        // 3. Upsert persona
        const personaRes = await cliente.query<{ id_persona: string }>(
          `INSERT INTO sigd_auth.persona (tipo, id_documento)
           VALUES ($1, $2)
           ON CONFLICT (tipo, id_documento) DO UPDATE
             SET id_documento = EXCLUDED.id_documento
           RETURNING id_persona`,
          [datos.tipoDocumento === 'CE' ? 'EXTRANJERO' : 'NATURAL', datos.numeroDocumento.trim()],
        );
        const idPersona = personaRes.rows[0].id_persona;

        // 4. Upsert persona_natural
        const nombreCompleto = `${datos.nombres.trim()} ${datos.apellidos.trim()}`;
        await cliente.query(
          `INSERT INTO sigd_auth.persona_natural (id_persona, nombres, apellidos, nombre_completo, correo)
           VALUES ($1::uuid, $2, $3, $4, $5)
           ON CONFLICT (id_persona) DO UPDATE
             SET nombres = EXCLUDED.nombres,
                 apellidos = EXCLUDED.apellidos,
                 nombre_completo = EXCLUDED.nombre_completo,
                 correo = EXCLUDED.correo`,
          [idPersona, datos.nombres.trim(), datos.apellidos.trim(), nombreCompleto, datos.correo.trim().toLowerCase()],
        );

        // 5. Insert cuenta_usuario
        const cuentaRes = await cliente.query<{ id_usuario: string }>(
          `INSERT INTO sigd_auth.cuenta_usuario (id_persona, usuario, correo, password_hash, activo)
           VALUES ($1::uuid, $2, $3, $4, $5)
           RETURNING id_usuario`,
          [idPersona, datos.usuario.trim(), datos.correo.trim().toLowerCase(), passwordHash, datos.activo],
        );
        const idUsuario = cuentaRes.rows[0].id_usuario;

        // 6. Resolver rol_id
        let rolId = datos.rolId.trim();
        const esUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rolId);
        if (!esUuid) {
          const rolRes = await cliente.query<{ rol_id: string }>(
            `SELECT rol_id FROM sigd_org.rol_sistema WHERE codigo = $1 LIMIT 1`,
            [rolId.toUpperCase()],
          );
          if (!rolRes.rows[0]) {
            throw new NotFoundError({ message: `Rol no encontrado: ${rolId}` });
          }
          rolId = rolRes.rows[0].rol_id;
        }

        // 7. Resolver y validar area_id (P2 - Codex Audit)
        let areaId: string | null = null;
        if (datos.areaId) {
          const esAreaUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(datos.areaId);
          if (!esAreaUuid) {
            throw new ValidationError({
              message: `El identificador de área institucional especificado no es un UUID válido: ${datos.areaId}`,
              invalidParams: [{ name: 'areaId', reason: 'Formato UUID inválido' }],
            });
          }

          const areaRes = await cliente.query<{ area_id: string; vigente: boolean }>(
            `SELECT area_id, vigente FROM sigd_org.area WHERE area_id = $1::uuid LIMIT 1`,
            [datos.areaId],
          );
          if (!areaRes.rows[0]) {
            throw new ValidationError({
              message: `El área institucional especificada no existe (ID: ${datos.areaId}).`,
              invalidParams: [{ name: 'areaId', reason: 'El área institucional especificada no existe' }],
            });
          }
          if (!areaRes.rows[0].vigente) {
            throw new ValidationError({
              message: `El área institucional especificada se encuentra inactiva o dada de baja.`,
              invalidParams: [{ name: 'areaId', reason: 'El área institucional se encuentra inactiva' }],
            });
          }
          areaId = areaRes.rows[0].area_id;
        }

        // 8. Insert usuario_rol
        await cliente.query(
          `INSERT INTO sigd_org.usuario_rol (id_usuario, rol_id, area_id, vigente_desde)
           VALUES ($1::uuid, $2::uuid, $3::uuid, now())`,
          [idUsuario, rolId, areaId],
        );

        // 9. Upsert perfil_usuario si hay area
        if (areaId) {
          await cliente.query(
            `INSERT INTO sigd_auth.perfil_usuario (id_usuario, area_id)
             VALUES ($1::uuid, $2::uuid)
             ON CONFLICT (id_usuario) DO UPDATE SET area_id = EXCLUDED.area_id`,
            [idUsuario, areaId],
          );
        }

        await cliente.query('COMMIT');

        res.status(201).json({
          idUsuario,
          usuario: datos.usuario.trim(),
          correo: datos.correo.trim().toLowerCase(),
          nombreCompleto,
          activo: datos.activo,
          mensaje: "Usuario institucional registrado exitosamente.",
        });
      } catch (err) {
        await cliente.query('ROLLBACK');
        throw err;
      } finally {
        cliente.release();
      }
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/admin/usuarios
   *
   * Valida los datos del usuario institucional
   * y delega las reglas de negocio al servicio.
   */
  async function crearUsuario(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const datos =
        crearUsuarioAdminSchema.parse(
          req.body,
        );

      const resultado =
        await service.crearUsuario(
          datos,
        );

      res.status(201).json(resultado);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/v1/admin/usuarios/:id
   *
   * Valida el identificador y los datos
   * enviados para la actualización.
   */
  async function actualizarUsuario(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { id } =
        usuarioIdParamSchema.parse(
          req.params,
        );

      const datos =
        actualizarUsuarioAdminSchema.parse(
          req.body,
        );

      const resultado =
        await service.actualizarUsuario(
          id,
          datos,
        );

      res.status(200).json(resultado);
    } catch (error) {
      next(error);
    }
  }

  return {
    listarUsuarios,
    crearUsuario,
    crearUsuarioInstitucional,
    actualizarUsuario,
  };
}

export type UsuariosAdminController =
  ReturnType<
    typeof crearUsuariosAdminController
  >;
