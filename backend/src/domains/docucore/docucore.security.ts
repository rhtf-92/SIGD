import type { NextFunction, Request, Response } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from '../../shared/domain/errors/index.js';

export const ROLES_DOCUCORE = {
  FOLIAR: ['ADMINISTRADOR', 'MESA_PARTES', 'SECRETARIO', 'ESPECIALISTA'],
  PROYECTAR_RESOLUCION: ['ADMINISTRADOR', 'SECRETARIO', 'ESPECIALISTA'],
  FIRMAR: ['ADMINISTRADOR', 'DIRECTOR'],
} as const;

export type RolDocuCore = (typeof ROLES_DOCUCORE)[keyof typeof ROLES_DOCUCORE][number];

export async function obtenerRolesActivos(pool: Pool, usuarioId: string): Promise<string[]> {
  const resultado = await pool.query<{ codigo: string }>(
    `SELECT DISTINCT r.codigo
       FROM sigd_auth.cuenta_usuario u
       JOIN sigd_org.usuario_rol ur ON ur.id_usuario = u.id_usuario
       JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id
      WHERE u.id_usuario = $1
        AND u.activo
        AND r.vigente
        AND ur.vigente_desde <= now()
        AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())`,
    [usuarioId],
  );
  return resultado.rows.map(({ codigo }) => codigo);
}

export function requerirRolActivo(pool: Pool, ...rolesPermitidos: readonly RolDocuCore[]) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const cuenta = req.cuentaActual;
    if (!cuenta) throw new UnauthorizedError({ detail: 'Autenticación requerida.' });

    const rolesActivos = await obtenerRolesActivos(pool, cuenta.idUsuario);
    if (!rolesPermitidos.some((rol) => rolesActivos.includes(rol))) {
      throw new ForbiddenError({ detail: 'El rol activo no está autorizado para esta operación.' });
    }

    next();
  };
}

export function validarIdExpediente(valor: string): string {
  const resultado = z.string().uuid().safeParse(valor);
  if (!resultado.success) {
    throw new ValidationError({
      invalidParams: [{ name: 'expedienteId', reason: 'Debe ser un UUID válido.' }],
    });
  }
  return resultado.data;
}

/**
 * SEC-02: resuelve la propiedad y asignación vigente en base de datos; los IDs
 * enviados por el cliente nunca constituyen autorización por sí solos.
 */
export async function verificarAccesoExpediente(
  pool: Pool,
  usuarioId: string,
  expedienteId: string,
): Promise<void> {
  const id = validarIdExpediente(expedienteId);
  const expediente = await pool.query(
    `SELECT expediente_id FROM sigd_doc.expediente WHERE expediente_id = $1
     UNION ALL
     SELECT expediente_id FROM sigd_tra.expediente WHERE expediente_id = $1
     LIMIT 1`,
    [id],
  );
  if (expediente.rowCount === 0) {
    throw new NotFoundError({ detail: 'El expediente indicado no existe.' });
  }

  const acceso = await pool.query<{ autorizado: boolean }>(
    `SELECT
       EXISTS (
         SELECT 1
           FROM sigd_doc.expediente e
           JOIN sigd_auth.cuenta_usuario u ON u.id_usuario = $2 AND u.activo
          WHERE e.expediente_id = $1
            AND (
              e.solicitante_id = u.id_persona
              OR EXISTS (
                SELECT 1 FROM sigd_org.asignacion_personal a
                 WHERE a.id_usuario = u.id_usuario
                   AND a.area_id = e.area_actual_id
                   AND a.vigente_desde <= now()
                   AND (a.vigente_hasta IS NULL OR a.vigente_hasta > now())
              )
              OR EXISTS (
                SELECT 1
                  FROM sigd_org.usuario_rol ur
                  JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id
                 WHERE ur.id_usuario = u.id_usuario
                   AND r.codigo IN ('ADMINISTRADOR', 'DIRECTOR')
                   AND r.vigente
                   AND ur.vigente_desde <= now()
                   AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
                   AND (ur.area_id IS NULL OR ur.area_id = e.area_actual_id)
              )
            )
       ) OR EXISTS (
         SELECT 1
           FROM sigd_tra.expediente e
           JOIN sigd_auth.cuenta_usuario u ON u.id_usuario = $2 AND u.activo
          WHERE e.expediente_id = $1
            AND (
              e.solicitante_id = u.id_persona
              OR EXISTS (
                SELECT 1 FROM sigd_org.asignacion_personal a
                 WHERE a.id_usuario = u.id_usuario
                   AND a.area_id = e.area_destino_id
                   AND a.vigente_desde <= now()
                   AND (a.vigente_hasta IS NULL OR a.vigente_hasta > now())
              )
              OR EXISTS (
                SELECT 1
                  FROM sigd_org.usuario_rol ur
                  JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id
                 WHERE ur.id_usuario = u.id_usuario
                   AND r.codigo IN ('ADMINISTRADOR', 'DIRECTOR')
                   AND r.vigente
                   AND ur.vigente_desde <= now()
                   AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
                   AND (ur.area_id IS NULL OR ur.area_id = e.area_destino_id)
              )
            )
       ) AS autorizado`,
    [id, usuarioId],
  );

  if (!acceso.rows[0]?.autorizado) {
    throw new ForbiddenError({ detail: 'No tiene permisos activos sobre este expediente.' });
  }
}

export async function verificarDocumentoDeExpediente(
  pool: Pool,
  documentoId: string,
  expedienteId: string,
): Promise<void> {
  const documento = await pool.query<{ expediente_id: string }>(
    `SELECT expediente_id
       FROM sigd_doc.documento_adjunto
      WHERE documento_adjunto_id = $1`,
    [documentoId],
  );
  const fila = documento.rows[0];
  if (!fila) throw new NotFoundError({ detail: 'El documento indicado no existe.' });
  if (fila.expediente_id !== expedienteId) {
    throw new ForbiddenError({ detail: 'El documento no pertenece al expediente indicado.' });
  }
}
