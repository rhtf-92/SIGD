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
      let token: string | undefined;
      const auth = req.headers.authorization;
      if (auth && auth.startsWith('Bearer ')) {
        token = auth.slice(7).trim();
      } else if (typeof req.query.token === 'string' && req.query.token.trim()) {
        token = req.query.token.trim();
      }
      if (!token) {
        return null;
      }
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
        if (resUser.rows.length === 0) {
          const resSimple = await pool.query<{ id_persona: string | null }>(
            `SELECT id_persona::text FROM sigd_auth.cuenta_usuario WHERE id_usuario = $1`,
            [usuarioId],
          );
          if (resSimple.rows && resSimple.rows.length > 0) {
            idPersona = resSimple.rows[0].id_persona;
          } else {
            return null;
          }
        } else {
          idPersona = resUser.rows[0].id_persona;
          areaId = resUser.rows[0].area_id;
        }
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
            area_actual_id: string | null;
            usuario_asignado_id: string | null;
            persona_asignada_id: string | null;
          }>(
            `SELECT e.solicitante_id::text AS solicitante_id,
                    e.area_destino_id::text AS area_destino_id,
                    COALESCE(u.estado_nuevo, e.estado) AS estado,
                    COALESCE(u.area_actual_id, e.area_destino_id::text) AS area_actual_id,
                    u.usuario_asignado_id::text AS usuario_asignado_id,
                    u.persona_asignada_id::text AS persona_asignada_id
               FROM sigd_tra.expediente e
               LEFT JOIN sigd_rut.estado_actual_expediente u ON u.expediente_id = e.expediente_id
              WHERE e.expediente_id = $1::uuid`,
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
          const tieneRolOperador = roles.some((r) =>
            ['ESPECIALISTA', 'SECRETARIO', 'DIRECTOR', 'ADMINISTRADOR', 'MESA_PARTES', 'TESORERIA'].includes(r),
          );
          if (roles.includes('CIUDADANO') && !tieneRolOperador) {
            return false;
          }

          // 2. Operadores de Mesa de Partes / Ventanilla
          if (roles.includes('MESA_PARTES')) {
            if (['REGISTRADO', 'PENDIENTE_PAGO', 'RECEPCIONADO', 'EN_CALIFICACION'].includes(exp.estado)) {
              return true;
            }
            if (areaId && (exp.area_destino_id === areaId || exp.area_actual_id === areaId)) {
              return true;
            }
          }

          // 3. Operadores de Tesorería (gestión de pagos y aranceles)
          if (roles.includes('TESORERIA')) {
            return true;
          }

          // 4. Especialista formalmente asignado (proyección o historial activo)
          if (
            exp.usuario_asignado_id === usuarioId ||
            (idPersona && exp.persona_asignada_id === idPersona)
          ) {
            return true;
          }

          const resAsig = await pool.query(
            `SELECT 1 FROM sigd_rut.expediente_asignacion
              WHERE expediente_id = $1::uuid
                AND (id_usuario = $2::uuid OR ($3::uuid IS NOT NULL AND id_persona = $3::uuid))
                AND activo = true
              LIMIT 1`,
            [idExpediente, usuarioId, idPersona],
          );
          if (resAsig.rows && resAsig.rows.length > 0) {
            return true;
          }

          // 5. Pertenencia al área de destino o área actual de custodia
          if (areaId) {
            if (exp.area_destino_id === areaId || exp.area_actual_id === areaId) {
              return true;
            }

            // Jerarquía de unidades (Centro de Idiomas <-> Subdirección Académica u otras áreas hijas/padres)
            const resJerarquia = await pool.query(
              `SELECT 1 FROM sigd_org.area
                WHERE (
                  (area_id = $1::uuid AND (area_padre_id = $2::uuid OR area_padre_id = $3::uuid))
                  OR (area_padre_id = $1::uuid AND (area_id = $2::uuid OR area_id = $3::uuid))
                )
                LIMIT 1`,
              [areaId, exp.area_actual_id, exp.area_destino_id],
            );
            if (resJerarquia.rows && resJerarquia.rows.length > 0) {
              return true;
            }

            // Equivalencia académica institucional SDA <-> Centro de Idiomas
            const sdaAreaId = 'a0000000-0000-0000-0000-000000000001';
            const ciAreaId = 'a0000000-0000-0000-0000-000000000003';
            if (
              [sdaAreaId, ciAreaId].includes(areaId) &&
              ([sdaAreaId, ciAreaId].includes(exp.area_actual_id ?? '') ||
                [sdaAreaId, ciAreaId].includes(exp.area_destino_id ?? ''))
            ) {
              return true;
            }
          }

          // 6. Operador de área que intervino o recibió derivación en el flujo histórico de movimientos
          if (areaId) {
            const resMov = await pool.query(
              `SELECT 1 FROM sigd_rut.movimiento_tramite
                WHERE expediente_id = $1::uuid
                  AND (
                    datos->>'areaId' = $2::text OR
                    datos->>'areaOrigenId' = $2::text OR
                    datos->>'area_destino_id' = $2::text OR
                    datos->>'area_origen_id' = $2::text OR
                    datos->>'areaId' IN (
                      SELECT a1.area_id::text FROM sigd_org.area a1 WHERE a1.area_padre_id::text = $2::text
                      UNION
                      SELECT a2.area_padre_id::text FROM sigd_org.area a2 WHERE a2.area_id::text = $2::text AND a2.area_padre_id IS NOT NULL
                    ) OR
                    datos->>'areaOrigenId' IN (
                      SELECT a1.area_id::text FROM sigd_org.area a1 WHERE a1.area_padre_id::text = $2::text
                      UNION
                      SELECT a2.area_padre_id::text FROM sigd_org.area a2 WHERE a2.area_id::text = $2::text AND a2.area_padre_id IS NOT NULL
                    ) OR
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
