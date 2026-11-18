import type { Pool, PoolClient } from 'pg';
import {
  PERMISOS_OPERATIVOS_RECEPTOR_RUTADOC,
  ROLES_OPERATIVOS_RECEPTOR_RUTADOC,
} from '../../core/auth/authorization.types.js';

export interface ResultadoEnrutabilidadArea {
  areaId: string;
  nombre?: string;
  codigo?: string;
  existe: boolean;
  vigente: boolean;
  enrutable: boolean;
  receptoresOperativos: number;
  motivo?: 'DESTINO_INEXISTENTE' | 'DESTINO_INACTIVO' | 'AREA_NO_ENRUTABLE';
}

export interface AreaEnrutableDTO {
  id: string;
  nombre: string;
  codigo?: string;
  habilitada: boolean;
  enrutable: boolean;
  motivo_no_enrutable: string | null;
}

/**
 * Servicio canónico de evaluación de Enrutabilidad Operativa de Unidades Orgánicas (RutaDoc).
 *
 * REGLA FORMAL DE ENRUTABILIDAD:
 * Un área de destino solo es enrutable si:
 * 1. Existe en el catálogo sigd_org.area.
 * 2. Su estado es vigente (vigente = true).
 * 3. Cuenta con AL MENOS UN receptor humano plenamente operativo:
 *    - Persona física activa (sigd_auth.persona).
 *    - Cuenta de usuario activa y no bloqueada (sigd_auth.cuenta_usuario).
 *    - Vínculo institucional formal vigente de categoría PERSONAL_INSTITUCIONAL (sigd_auth.vinculo_institucional).
 *    - Adscripción activa al área (vía asignacion_personal, responsabilidad_temporal, usuario_rol o asignacion_perfil_operativo).
 *    - Rol o perfil operativo vigente facultado para gestionar la bandeja de dicha área.
 */
export class EnrutabilidadService {
  constructor(private readonly pool: Pool) {}

  /**
   * Evalúa la enrutabilidad de múltiples áreas de forma consolidada en una sola consulta
   * set-based para prevenir problemas de N+1 en derivaciones múltiples.
   */
  async evaluarEnrutabilidadAreas(
    areaIds: string[],
    clienteParam?: PoolClient | Pool,
  ): Promise<Map<string, ResultadoEnrutabilidadArea>> {
    const mapa = new Map<string, ResultadoEnrutabilidadArea>();
    if (!areaIds || areaIds.length === 0) return mapa;

    const db = clienteParam ?? this.pool;
    const idsUnicos = Array.from(new Set(areaIds));

    const sql = `
      WITH areas_solicitadas AS (
        SELECT unnest($1::uuid[]) AS area_id
      ),
      areas_existentes AS (
        SELECT a.area_id, a.codigo, a.nombre, a.vigente
          FROM sigd_org.area a
         WHERE a.area_id = ANY($1::uuid[])
      ),
      receptores_operativos AS (
        SELECT DISTINCT
          area_candidata.area_id,
          cu.id_usuario
        FROM sigd_auth.cuenta_usuario cu
        JOIN sigd_auth.persona p ON p.id_persona = cu.id_persona
        JOIN sigd_auth.vinculo_institucional v ON v.id_persona = p.id_persona
        JOIN sigd_auth.tipo_vinculo_institucional t ON t.id_tipo_vinculo = v.id_tipo_vinculo
        CROSS JOIN LATERAL (
          SELECT ap.area_id
            FROM sigd_org.asignacion_personal ap
           WHERE (ap.id_persona = p.id_persona OR ap.id_usuario = cu.id_usuario)
             AND ap.area_id = ANY($1::uuid[])
             AND (ap.estado IS NULL OR ap.estado = 'ACTIVO')
             AND ap.vigente_desde <= now()
             AND (ap.vigente_hasta IS NULL OR ap.vigente_hasta > now())
          UNION
          SELECT rt.area_id
            FROM sigd_org.responsabilidad_temporal rt
           WHERE (rt.id_persona = p.id_persona OR rt.id_usuario = cu.id_usuario)
             AND rt.area_id = ANY($1::uuid[])
             AND rt.estado = 'ACTIVO'
             AND rt.vigente_desde <= now()
             AND (rt.vigente_hasta IS NULL OR rt.vigente_hasta > now())
          UNION
          SELECT ur.area_id
            FROM sigd_org.usuario_rol ur
           WHERE ur.id_usuario = cu.id_usuario
             AND ur.area_id = ANY($1::uuid[])
             AND ur.vigente_desde <= now()
             AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
          UNION
          SELECT apo.area_id
            FROM sigd_org.asignacion_perfil_operativo apo
           WHERE apo.id_usuario = cu.id_usuario
             AND apo.area_id = ANY($1::uuid[])
             AND apo.estado = 'ACTIVO'
             AND apo.vigente_desde <= now()
             AND (apo.vigente_hasta IS NULL OR apo.vigente_hasta > now())
        ) area_candidata
        WHERE cu.activo = true
          AND v.estado = 'ACTIVO'
          AND v.vigente_desde <= now()
          AND (v.vigente_hasta IS NULL OR v.vigente_hasta > now())
          AND (t.categoria_actor = 'PERSONAL_INSTITUCIONAL' OR t.codigo IN ('DOCENTE', 'ADMINISTRATIVO', 'DIRECTIVO'))
          AND (
            EXISTS (
              SELECT 1
                FROM sigd_org.usuario_rol ur2
                JOIN sigd_org.rol_sistema r ON r.rol_id = ur2.rol_id
               WHERE ur2.id_usuario = cu.id_usuario
                 AND (ur2.area_id = area_candidata.area_id OR ur2.area_id IS NULL)
                 AND ur2.vigente_desde <= now()
                 AND (ur2.vigente_hasta IS NULL OR ur2.vigente_hasta > now())
                 AND (
                   r.codigo = ANY($2::text[])
                   OR EXISTS (
                     SELECT 1
                       FROM sigd_org.rol_permiso rp
                       JOIN sigd_org.permiso_sistema ps_r ON ps_r.permiso_id = rp.permiso_id
                      WHERE rp.rol_id = r.rol_id
                        AND ps_r.codigo = ANY($3::text[])
                   )
                 )
            )
            OR EXISTS (
              SELECT 1
                FROM sigd_org.asignacion_perfil_operativo apo2
                JOIN sigd_org.perfil_operativo po ON po.perfil_id = apo2.perfil_id
                JOIN sigd_org.perfil_permiso pp ON pp.perfil_id = po.perfil_id
                JOIN sigd_org.permiso_sistema ps ON ps.permiso_id = pp.permiso_id
               WHERE apo2.id_usuario = cu.id_usuario
                 AND (apo2.area_id = area_candidata.area_id OR apo2.scope = 'INSTITUCIONAL')
                 AND apo2.estado = 'ACTIVO'
                 AND po.vigente = true
                 AND apo2.vigente_desde <= now()
                 AND (apo2.vigente_hasta IS NULL OR apo2.vigente_hasta > now())
                 AND ps.codigo = ANY($3::text[])
            )
          )
      )
      SELECT
        s.area_id::text AS "solicitadaId",
        e.area_id::text AS "areaId",
        e.nombre,
        e.codigo,
        e.vigente,
        COUNT(ro.id_usuario)::int AS "receptoresOperativos"
      FROM areas_solicitadas s
      LEFT JOIN areas_existentes e ON e.area_id = s.area_id
      LEFT JOIN receptores_operativos ro ON ro.area_id = e.area_id
      GROUP BY s.area_id, e.area_id, e.nombre, e.codigo, e.vigente;
    `;

    const { rows } = await db.query<{
      solicitadaId: string;
      areaId: string | null;
      nombre: string | null;
      codigo: string | null;
      vigente: boolean | null;
      receptoresOperativos: number;
    }>(sql, [idsUnicos, [...ROLES_OPERATIVOS_RECEPTOR_RUTADOC], [...PERMISOS_OPERATIVOS_RECEPTOR_RUTADOC]]);

    for (const raw of rows as any[]) {
      const areaId = raw.areaId ?? raw.area_id ?? raw.id_area ?? raw.id ?? null;
      const solicitadaId = raw.solicitadaId ?? raw.solicitada_id ?? areaId;
      const nombre = raw.nombre ?? undefined;
      const codigo = raw.codigo ?? undefined;
      const vigente = raw.vigente !== undefined ? Boolean(raw.vigente) : null;
      const receptoresOperativos =
        raw.receptoresOperativos !== undefined
          ? Number(raw.receptoresOperativos || 0)
          : raw.receptores_operativos !== undefined
          ? Number(raw.receptores_operativos || 0)
          : 1;

      if (!areaId) {
        mapa.set(solicitadaId, {
          areaId: solicitadaId,
          existe: false,
          vigente: false,
          enrutable: false,
          receptoresOperativos: 0,
          motivo: 'DESTINO_INEXISTENTE',
        });
      } else if (!vigente) {
        mapa.set(solicitadaId, {
          areaId,
          nombre,
          codigo,
          existe: true,
          vigente: false,
          enrutable: false,
          receptoresOperativos,
          motivo: 'DESTINO_INACTIVO',
        });
      } else {
        const enrutable = receptoresOperativos > 0;
        const resObj: ResultadoEnrutabilidadArea = {
          areaId,
          nombre,
          codigo,
          existe: true,
          vigente: true,
          enrutable,
          receptoresOperativos,
          motivo: enrutable ? undefined : 'AREA_NO_ENRUTABLE',
        };
        mapa.set(areaId, resObj);
        if (solicitadaId && solicitadaId !== areaId) {
          mapa.set(solicitadaId, resObj);
        }
      }
    }

    return mapa;
  }

  /**
   * Evalúa la enrutabilidad de una única área.
   */
  async evaluarEnrutabilidadArea(
    areaId: string,
    clienteParam?: PoolClient | Pool,
  ): Promise<ResultadoEnrutabilidadArea> {
    const mapa = await this.evaluarEnrutabilidadAreas([areaId], clienteParam);
    const res = mapa.get(areaId);
    if (!res) {
      return {
        areaId,
        existe: false,
        vigente: false,
        enrutable: false,
        receptoresOperativos: 0,
        motivo: 'DESTINO_INEXISTENTE',
      };
    }
    return res;
  }

  /**
   * Lista todas las áreas del organigrama con su indicador de enrutabilidad operativa en tiempo real.
   */
  async listarAreasEnrutables(
    clienteParam?: PoolClient | Pool,
  ): Promise<AreaEnrutableDTO[]> {
    const db = clienteParam ?? this.pool;

    const sql = `
      WITH areas_catalogo AS (
        SELECT a.area_id, a.codigo, a.nombre, a.vigente
          FROM sigd_org.area a
         ORDER BY a.nombre ASC, a.area_id ASC
      ),
      receptores_operativos AS (
        SELECT DISTINCT
          area_candidata.area_id,
          cu.id_usuario
        FROM sigd_auth.cuenta_usuario cu
        JOIN sigd_auth.persona p ON p.id_persona = cu.id_persona
        JOIN sigd_auth.vinculo_institucional v ON v.id_persona = p.id_persona
        JOIN sigd_auth.tipo_vinculo_institucional t ON t.id_tipo_vinculo = v.id_tipo_vinculo
        CROSS JOIN LATERAL (
          SELECT ap.area_id
            FROM sigd_org.asignacion_personal ap
           WHERE (ap.id_persona = p.id_persona OR ap.id_usuario = cu.id_usuario)
             AND (ap.estado IS NULL OR ap.estado = 'ACTIVO')
             AND ap.vigente_desde <= now()
             AND (ap.vigente_hasta IS NULL OR ap.vigente_hasta > now())
          UNION
          SELECT rt.area_id
            FROM sigd_org.responsabilidad_temporal rt
           WHERE (rt.id_persona = p.id_persona OR rt.id_usuario = cu.id_usuario)
             AND rt.estado = 'ACTIVO'
             AND rt.vigente_desde <= now()
             AND (rt.vigente_hasta IS NULL OR rt.vigente_hasta > now())
          UNION
          SELECT ur.area_id
            FROM sigd_org.usuario_rol ur
           WHERE ur.id_usuario = cu.id_usuario
             AND ur.vigente_desde <= now()
             AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
          UNION
          SELECT apo.area_id
            FROM sigd_org.asignacion_perfil_operativo apo
           WHERE apo.id_usuario = cu.id_usuario
             AND apo.estado = 'ACTIVO'
             AND apo.vigente_desde <= now()
             AND (apo.vigente_hasta IS NULL OR apo.vigente_hasta > now())
        ) area_candidata
        WHERE cu.activo = true
          AND v.estado = 'ACTIVO'
          AND v.vigente_desde <= now()
          AND (v.vigente_hasta IS NULL OR v.vigente_hasta > now())
          AND (t.categoria_actor = 'PERSONAL_INSTITUCIONAL' OR t.codigo IN ('DOCENTE', 'ADMINISTRATIVO', 'DIRECTIVO'))
          AND (
            EXISTS (
              SELECT 1
                FROM sigd_org.usuario_rol ur2
                JOIN sigd_org.rol_sistema r ON r.rol_id = ur2.rol_id
               WHERE ur2.id_usuario = cu.id_usuario
                 AND (ur2.area_id = area_candidata.area_id OR ur2.area_id IS NULL)
                 AND ur2.vigente_desde <= now()
                 AND (ur2.vigente_hasta IS NULL OR ur2.vigente_hasta > now())
                 AND (
                   r.codigo = ANY($1::text[])
                   OR EXISTS (
                     SELECT 1
                       FROM sigd_org.rol_permiso rp
                       JOIN sigd_org.permiso_sistema ps_r ON ps_r.permiso_id = rp.permiso_id
                      WHERE rp.rol_id = r.rol_id
                        AND ps_r.codigo = ANY($2::text[])
                   )
                 )
            )
            OR EXISTS (
              SELECT 1
                FROM sigd_org.asignacion_perfil_operativo apo2
                JOIN sigd_org.perfil_operativo po ON po.perfil_id = apo2.perfil_id
                JOIN sigd_org.perfil_permiso pp ON pp.perfil_id = po.perfil_id
                JOIN sigd_org.permiso_sistema ps ON ps.permiso_id = pp.permiso_id
               WHERE apo2.id_usuario = cu.id_usuario
                 AND (apo2.area_id = area_candidata.area_id OR apo2.scope = 'INSTITUCIONAL')
                 AND apo2.estado = 'ACTIVO'
                 AND po.vigente = true
                 AND apo2.vigente_desde <= now()
                 AND (apo2.vigente_hasta IS NULL OR apo2.vigente_hasta > now())
                 AND ps.codigo = ANY($2::text[])
            )
          )
      )
      SELECT
        a.area_id::text AS id,
        a.nombre,
        a.codigo,
        a.vigente AS habilitada,
        (a.vigente AND COUNT(ro.id_usuario) > 0) AS enrutable,
        CASE
          WHEN NOT a.vigente THEN 'DESTINO_INACTIVO: El área se encuentra dada de baja en el organigrama.'
          WHEN COUNT(ro.id_usuario) = 0 THEN 'AREA_NO_ENRUTABLE: No cuenta con personal habilitado para gestionar expedientes.'
          ELSE NULL
        END AS motivo_no_enrutable
      FROM areas_catalogo a
      LEFT JOIN receptores_operativos ro ON ro.area_id = a.area_id
      GROUP BY a.area_id, a.nombre, a.codigo, a.vigente
      ORDER BY a.nombre ASC, a.area_id ASC;
    `;

    const { rows } = await db.query<AreaEnrutableDTO>(sql, [
      [...ROLES_OPERATIVOS_RECEPTOR_RUTADOC],
      [...PERMISOS_OPERATIVOS_RECEPTOR_RUTADOC],
    ]);
    return rows;
  }
}
