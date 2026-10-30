import type { Request } from 'express';
import type { Pool } from 'pg';
import { resolverOperadorBigInt } from './derivaciones.service.js';
import type { ActorRutaDoc } from './rutadoc.types.js';
import { verificarTokenAcceso, type ClaimsJwt } from '../../core/auth/jwt.service.js';

/** Punto de conexión de IdentiCore: sólo acepta una sesión/token ya verificado. */
export interface ActorProviderRutaDoc {
  obtenerActor(req: Request): ActorRutaDoc | null | Promise<ActorRutaDoc | null>;
}

/** Adaptador productivo mientras IdentiCore no publique su middleware: falla cerrado. */
export const actorProviderNoConfigurado: ActorProviderRutaDoc = Object.freeze({
  obtenerActor: () => null,
});

/**
 * Proveedor de actor autenticado vía JWT institucional con evaluación estricta de autorización
 * relacional (mitigación de BOLA / SEC-01).
 *
 * Jerarquía de autorización (fail-closed):
 * 1. SUPER_ADMIN / ADMIN / DIRECTOR -> Visibilidad institucional amplia.
 * 2. CIUDADANO / ESTUDIANTE -> Acceso estrictamente limitado a expedientes donde es titular (solicitante_id).
 * 3. MESA_PARTES -> Acceso a expedientes en fases iniciales (REGISTRADO, RECEPCIONADO, EN_CALIFICACION) o de su área.
 * 4. Operadores de área -> Acceso si el expediente está asignado a su área o registra movimientos históricos en su unidad.
 * 5. Cualquier otro caso o error relacional -> Denegación de acceso (retorna false / 403 Forbidden).
 */
export function crearJwtActorProvider(pool: Pool): ActorProviderRutaDoc {
  return {
    async obtenerActor(req: Request): Promise<ActorRutaDoc | null> {
      const auth = req.headers.authorization;
      if (!auth || !auth.startsWith('Bearer ')) {
        return null;
      }
      const token = auth.slice(7).trim();
      let claims: ClaimsJwt;
      try {
        claims = verificarTokenAcceso(token);
      } catch {
        return null;
      }

      const usuarioId = claims.sub;
      const roles = claims.roles ?? [];

      let idPersona: string | null = null;
      let areaId: string | null = null;

      try {
        const resUser = await pool.query<{ id_persona: string | null; area_id: string | null }>(
          `SELECT u.id_persona::text AS id_persona,
                  COALESCE(rol_area.area_id, p.area_id)::text AS area_id
             FROM sigd_auth.cuenta_usuario u
        LEFT JOIN sigd_auth.perfil_usuario p ON p.id_usuario = u.id_usuario
        LEFT JOIN LATERAL (
          SELECT ur.area_id
            FROM sigd_org.usuario_rol ur
            JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id
           WHERE ur.id_usuario = u.id_usuario
             AND r.codigo = ANY($2::text[])
             AND ur.vigente_desde <= now()
             AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
           ORDER BY ur.vigente_desde DESC
           LIMIT 1
        ) rol_area ON true
            WHERE u.id_usuario = $1 AND u.activo = true`,
          [usuarioId, roles],
        );
        if (resUser.rows.length === 0) return null;
        idPersona = resUser.rows[0].id_persona;
        areaId = resUser.rows[0].area_id;
      } catch {
        return null;
      }

      const esAdminOInstitucional = roles.some((r) =>
        ['ADMINISTRADOR', 'DIRECTOR'].includes(r),
      );

      const puedeVerExpediente = async (idExpediente: string): Promise<boolean> => {
        if (esAdminOInstitucional) {
          return true;
        }

        try {
          const resExp = await pool.query<{
            solicitante_id: string | null;
            area_destino_id: string | null;
            estado: string;
          }>(
            `SELECT solicitante_id::text AS solicitante_id,
                    area_destino_id::text AS area_destino_id,
                    estado
               FROM sigd_tra.expediente
              WHERE expediente_id = $1::uuid`,
            [idExpediente],
          );

          if (!resExp.rows || resExp.rows.length === 0) {
            return false;
          }

          const exp = resExp.rows[0];

          // 1. Titularidad del expediente (para administrados o cualquier usuario titular)
          if (idPersona && exp.solicitante_id === idPersona) {
            return true;
          }

          // Si es rol exclusivo de administrado y no es el solicitante -> denegar acceso
          if (roles.includes('CIUDADANO')) {
            return false;
          }

          // 2. Operadores de Mesa de Partes / Ventanilla
          if (roles.includes('MESA_PARTES')) {
            if (['REGISTRADO', 'PENDIENTE_PAGO', 'RECEPCIONADO', 'EN_CALIFICACION'].includes(exp.estado)) {
              return true;
            }
            if (areaId && exp.area_destino_id === areaId) {
              return true;
            }
          }

          // 3. Operador asignado al área destino actual
          if (areaId && exp.area_destino_id === areaId) {
            return true;
          }

          // 4. Operador de área que intervino en el flujo histórico de movimientos (esquema físico real)
          if (areaId) {
            const resMov = await pool.query(
              `SELECT 1 FROM sigd_rut.movimiento_tramite
                WHERE expediente_id = $1::uuid
                  AND (
                    datos->>'areaId' = $2::text OR
                    datos->>'areaOrigenId' = $2::text OR
                    datos->>'area_destino_id' = $2::text OR
                    datos->>'area_origen_id' = $2::text OR
                    usuario_operador_id = $3::bigint
                  )
                LIMIT 1`,
              [idExpediente, areaId, resolverOperadorBigInt(usuarioId)],
            );
            if (resMov.rows && resMov.rows.length > 0) {
              return true;
            }
          }

          return false;
        } catch {
          return false;
        }
      };

      return {
        id: usuarioId,
        idPersona,
        roles,
        unidadOrganicaId: areaId,
        puedeVerExpediente,
      };
    },
  };
}
