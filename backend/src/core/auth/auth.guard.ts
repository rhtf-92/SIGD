import type { Request } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import { AppError, ForbiddenError } from '../../shared/domain/errors/index.js';
import { extraerTokenBearer, verificarTokenAcceso, type ClaimsJwt } from './jwt.service.js';

export interface IdentidadAutenticada {
  idUsuario: string;
  roles: string[];
  contextoId?: string | null;
  requiereSeleccionContexto?: boolean;
  via: 'bearer' | 'query' | 'cabecera-interna';
}

/**
 * Resuelve la identidad del solicitante para los endpoints de streamed (SSE) y
 * de la cola de firma.
 *
 * Orden de precedencia (§4.8 de los endpoints #55 y #56):
 *   1. `Authorization: Bearer <jwt>` — vía autenticada.
 *   2. `?token=<jwt>` — compatibilidad con la API nativa `EventSource(url)`.
 *   3. `x-usuario-id` — ONLY la acepta si `ALLOW_HEADER_IDENTITY=true`, porque
 *      la API de `EventSource` no permite cabeceras personalizadas. En producción
 *      el valor por defecto es `false` para no aceptar identidades afirmadas por
 *      el cliente sin verificación criptográfica.
 */
export function resolverIdentidad(req: Request): IdentidadAutenticada {
  const contextoHeader = req.get('x-contexto-id')?.trim() || null;

  const bearer = extraerTokenBearer(req.get('authorization'));
  if (bearer) {
    const claims: ClaimsJwt = verificarTokenAcceso(bearer);

    // TSK-1.0A Regla de Seguridad:
    // 1. Un header x-contexto-id nunca debe sustituir libremente al contexto firmado.
    // 2. Si se envía x-contexto-id y el token tiene un ctx firmado, DEBEN coincidir.
    if (contextoHeader && claims.ctx && contextoHeader !== claims.ctx) {
      throw new AppError({
        status: 403,
        code: 'CONTEXT_HEADER_MISMATCH',
        message: 'Violación de seguridad: El encabezado x-contexto-id no coincide con el contexto activo firmado en el token.',
      });
    }

    // 3. Si el token NO tiene un ctx firmado (ej. sesión con múltiples roles pendientes de selección),
    // el encabezado x-contexto-id NO puede ser usado para auto-atribuirse privilegios.
    if (contextoHeader && !claims.ctx) {
      throw new AppError({
        status: 403,
        code: 'CONTEXT_SELECTION_REQUIRED',
        message: 'Debe seleccionar un contexto explícitamente mediante el endpoint autorizado POST /api/v1/auth/seleccionar-contexto.',
      });
    }

    return {
      idUsuario: claims.sub,
      roles: claims.roles,
      contextoId: claims.ctx ?? null,
      requiereSeleccionContexto: !claims.ctx && claims.roles.length === 0,
      via: 'bearer',
    };
  }

  const tokenQuery = typeof req.query.token === 'string' ? req.query.token : undefined;
  if (tokenQuery) {
    const claims = verificarTokenAcceso(tokenQuery);

    if (contextoHeader && claims.ctx && contextoHeader !== claims.ctx) {
      throw new AppError({
        status: 403,
        code: 'CONTEXT_HEADER_MISMATCH',
        message: 'Violación de seguridad: El encabezado x-contexto-id no coincide con el token.',
      });
    }

    if (contextoHeader && !claims.ctx) {
      throw new AppError({
        status: 403,
        code: 'CONTEXT_SELECTION_REQUIRED',
        message: 'Debe seleccionar un contexto mediante POST /api/v1/auth/seleccionar-contexto.',
      });
    }

    return {
      idUsuario: claims.sub,
      roles: claims.roles,
      contextoId: claims.ctx ?? null,
      requiereSeleccionContexto: !claims.ctx && claims.roles.length === 0,
      via: 'query',
    };
  }

  const cabecera = req.get('x-usuario-id');
  const cabeceraPermitida = (process.env.ALLOW_HEADER_IDENTITY ?? 'false') === 'true';
  if (cabecera && cabecera.trim() !== '' && cabeceraPermitida) {
    return {
      idUsuario: cabecera.trim(),
      roles: [],
      contextoId: contextoHeader,
      requiereSeleccionContexto: false,
      via: 'cabecera-interna',
    };
  }

  throw new AppError({
    status: 401,
    code: 'UNAUTHORIZED',
    message: 'No autenticado.',
    detail: 'Debe autenticarse con Authorization: Bearer <jwt> o ?token=<jwt>.',
  });
}

export interface PermisoInstitucional {
  codigo: string;
  ambito: 'GLOBAL' | 'AREA';
  areaId: string | null;
}

export interface AutorizacionCuenta {
  roles: string[];
  permisos: PermisoInstitucional[];
  unidadOrganicaId?: string | null;
  contextoActivoId?: string | null;
  requiereSeleccionContexto?: boolean;
  contextoRevocado?: boolean;
}

const PERMISOS_PROHIBIDOS_GESTOR_APOYO = new Set([
  'EXPEDIENTE_FIRMAR',
  'EXPEDIENTE_RESOLVER',
  'EXPEDIENTE_ASIGNAR',
  'EXPEDIENTE_REASIGNAR',
  'EXPEDIENTE_EVALUAR',
  'DOCENTE_EVALUAR',
  'ADMIN_USUARIOS',
  'FIRMA_FIRMAR',
  'REPORTE_LEER',
]);

/** El JWT identifica la cuenta; las facultades proceden del RBAC vigente.
 * Si se especifica idAsignacionContexto, los permisos se calculan exclusivamente
 * para ese contexto activo asignado (sin acumulación de roles).
 * Si no se especifica y la cuenta tiene múltiples roles activos, NO se acumulan
 * permisos y se exige la selección explícita de contexto.
 * CIUDADANO consulta sus expedientes por titularidad, no mediante lectura
 * institucional global. Otros roles de la misma cuenta conservan sus permisos.
 */
export async function obtenerAutorizacionCuenta(
  pool: Pool,
  idUsuario: string,
  idAsignacionContexto?: string | null,
): Promise<AutorizacionCuenta | null> {
  if (!z.string().uuid().safeParse(idUsuario).success) return null;
  if (idAsignacionContexto && !z.string().uuid().safeParse(idAsignacionContexto).success) return null;

  const params: unknown[] = [idUsuario];
  let filtroContexto = '';
  if (idAsignacionContexto) {
    params.push(idAsignacionContexto);
    filtroContexto = ' AND ur.id_usuario_rol = $2::uuid';
  }

  const { rows } = await pool.query<{ roles: string[]; permisos: PermisoInstitucional[]; unidad_organica_id?: string | null }>(`
    SELECT COALESCE(json_agg(DISTINCT r.codigo ORDER BY r.codigo)
             FILTER (WHERE r.codigo IS NOT NULL), '[]') AS roles,
           COALESCE(jsonb_agg(DISTINCT jsonb_build_object(
             'codigo', p.codigo, 'ambito', p.ambito, 'areaId', CASE WHEN p.ambito = 'AREA' THEN ur.area_id ELSE NULL END))
             FILTER (WHERE p.codigo IS NOT NULL
               AND NOT (r.codigo = 'CIUDADANO' AND p.codigo = 'EXPEDIENTE_LEER')
               AND NOT (r.codigo = 'ESTUDIANTE' AND p.codigo = 'EXPEDIENTE_LEER')), '[]') AS permisos,
           MIN(ur.area_id::text) AS unidad_organica_id
      FROM sigd_auth.cuenta_usuario cu
      LEFT JOIN sigd_org.usuario_rol ur ON ur.id_usuario = cu.id_usuario
        AND ur.vigente_desde <= now()
        AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())${filtroContexto}
      LEFT JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id AND r.vigente = TRUE
      LEFT JOIN sigd_org.rol_permiso rp ON rp.rol_id = r.rol_id
      LEFT JOIN sigd_org.permiso_sistema p ON p.permiso_id = rp.permiso_id
     WHERE cu.id_usuario = $1::uuid AND cu.activo = TRUE
     GROUP BY cu.id_usuario`, params);
  if (!rows[0]) return null;

  const rawRoles = rows[0].roles;
  const rawPermisos = rows[0].permisos;
  const roles: string[] = Array.isArray(rawRoles)
    ? rawRoles
    : (typeof rawRoles === 'string' ? JSON.parse(rawRoles) : []);
  const permisos: PermisoInstitucional[] = Array.isArray(rawPermisos)
    ? rawPermisos
    : (typeof rawPermisos === 'string' ? JSON.parse(rawPermisos) : []);

  // Si se envió idAsignacionContexto pero no se encontraron roles vigentes en usuario_rol:
  if (idAsignacionContexto && roles.length === 0) {
    try {
      const capQuery = await pool.query<{
        id_asignacion: string;
        codigo: string;
        area_id: string | null;
        permisos: PermisoInstitucional[];
      }>(
        `SELECT uc.id_usuario_capacidad::text AS id_asignacion,
                cs.codigo AS codigo,
                uc.area_id::text AS area_id,
                COALESCE(jsonb_agg(DISTINCT jsonb_build_object(
                  'codigo', p.codigo,
                  'ambito', p.ambito,
                  'areaId', uc.area_id
                )) FILTER (WHERE p.codigo IS NOT NULL), '[]'::jsonb) AS permisos
           FROM sigd_org.usuario_capacidad uc
           JOIN sigd_org.capacidad_sistema cs ON cs.id_capacidad = uc.id_capacidad AND cs.vigente = TRUE
           LEFT JOIN sigd_org.capacidad_permiso cp ON cp.id_capacidad = cs.id_capacidad
           LEFT JOIN sigd_org.permiso_sistema p ON p.permiso_id = cp.permiso_id
          WHERE uc.id_usuario = $1::uuid
            AND uc.id_usuario_capacidad = $2::uuid
            AND uc.activo = TRUE
            AND uc.vigente_desde <= now()
            AND (uc.vigente_hasta IS NULL OR uc.vigente_hasta > now())
          GROUP BY uc.id_usuario_capacidad, cs.codigo, uc.area_id`,
        [idUsuario, idAsignacionContexto],
      );

      if (capQuery.rows.length === 1) {
        const cap = capQuery.rows[0];
        const rawPerms = Array.isArray(cap.permisos)
          ? cap.permisos
          : (typeof cap.permisos === 'string' ? JSON.parse(cap.permisos) : []);
        const permsLimpios = rawPerms.filter((p: PermisoInstitucional) => !PERMISOS_PROHIBIDOS_GESTOR_APOYO.has(p.codigo));
        const permsAjustados = permsLimpios.map((p: PermisoInstitucional) => ({
          ...p,
          ambito: 'AREA' as const,
          areaId: cap.area_id,
        }));
        const permsFinales = permsAjustados.length > 0 ? permsAjustados : [
          { codigo: 'EXPEDIENTE_LEER', ambito: 'AREA' as const, areaId: cap.area_id },
          { codigo: 'EXPEDIENTE_RECEPCIONAR', ambito: 'AREA' as const, areaId: cap.area_id },
          { codigo: 'EXPEDIENTE_DERIVAR', ambito: 'AREA' as const, areaId: cap.area_id },
          { codigo: 'EXPEDIENTE_ADJUNTAR', ambito: 'AREA' as const, areaId: cap.area_id },
        ];
        return {
          roles: [cap.codigo],
          permisos: permsFinales,
          unidadOrganicaId: cap.area_id,
          contextoActivoId: idAsignacionContexto,
          requiereSeleccionContexto: false,
          contextoRevocado: false,
        };
      }
    } catch {
      // Tabla o estructura de capacidades no presente en el entorno de prueba
    }

    // El contexto fue REVOCADO o ya no se encuentra vigente para esta cuenta activa.
    return {
      roles: [],
      permisos: [],
      unidadOrganicaId: null,
      contextoActivoId: null,
      requiereSeleccionContexto: true,
      contextoRevocado: true,
    };
  }

  // Regla TSK-1.0A: Si no se especificó un contexto activo (idAsignacionContexto es null)
  // y la cuenta tiene múltiples roles asignados, NO se acumulan permisos automáticamente.
  if (!idAsignacionContexto && roles.length > 1) {
    return {
      roles: [],
      permisos: [],
      unidadOrganicaId: null,
      contextoActivoId: null,
      requiereSeleccionContexto: true,
      contextoRevocado: false,
    };
  }

  return {
    roles,
    permisos,
    unidadOrganicaId: rows[0].unidad_organica_id ?? permisos?.find(p => p.areaId !== null)?.areaId ?? null,
    contextoActivoId: idAsignacionContexto ?? null,
    requiereSeleccionContexto: false,
    contextoRevocado: false,
  };
}

export async function exigirContextoValido(
  pool: Pool,
  idUsuario: string,
  contextoId?: string | null,
): Promise<AutorizacionCuenta> {
  const autorizacion = await obtenerAutorizacionCuenta(pool, idUsuario, contextoId);
  if (!autorizacion) {
    throw new ForbiddenError({ message: 'Cuenta institucional inactiva o no autorizada.' });
  }
  if (contextoId && autorizacion.contextoRevocado) {
    throw new AppError({
      status: 403,
      code: 'CONTEXT_REVOKED',
      message: 'El contexto activo ha sido revocado o no se encuentra vigente. Debe seleccionar un contexto vigente.',
    });
  }
  return autorizacion;
}

export function tienePermisoGlobal(permisos: readonly PermisoInstitucional[], codigo: string): boolean {
  return permisos.some(p => p.codigo === codigo && p.ambito === 'GLOBAL' && p.areaId === null);
}

export function tienePermisoArea(permisos: readonly PermisoInstitucional[], codigo: string, areaId: string): boolean {
  return permisos.some(p => p.codigo === codigo && (
    (p.ambito === 'GLOBAL') ||
    (p.ambito === 'AREA' && p.areaId === areaId)
  ));
}

/**
 * Verifica si el usuario posee facultades vigentes de Super Administrador de Plataforma (Platform RBAC).
 * Invoca la función rectora sigd_auth.fn_es_super_admin(UUID) de forma segura.
 */
export async function esSuperAdmin(pool: Pool, idUsuario: string): Promise<boolean> {
  if (!z.string().uuid().safeParse(idUsuario).success) return false;
  try {
    const res = await pool.query<{ es_super_admin: boolean }>(
      'SELECT sigd_auth.fn_es_super_admin($1::uuid) AS es_super_admin',
      [idUsuario],
    );
    return Boolean(res.rows[0]?.es_super_admin);
  } catch {
    return false;
  }
}

export const ROLES_FIRMA = ['DIRECTOR'] as const;

export interface FacultadFirma {
  puedeFirmar: boolean;
  roles: string[];
  facultadGlobal: boolean;
  tiposAutorizados: string[];
  motivo: string | null;
}

/**
 * Verifica las facultades legales de despacho del funcionario (Art. 5 del
 * Reglamento de Firmas): rol institucional DIRECTOR o facultad de
 * despacho vigente en `sigd_org.facultad_despacho`, incluidas las suplencias
 * registradas en `sigd_org.encargatura_despacho`.
 */
export async function verificarFacultadFirma(
  pool: Pool,
  idUsuario: string,
  _rolesDeclarados: string[] = [],
): Promise<FacultadFirma> {
  let resultado: {
    rows: Array<{
      rol_codigo: string | null;
      rol_area_id: string | null;
      tipo_resolucion: string | null;
      vigente: boolean;
      motivo_no_habilitado: string | null;
    }>;
  };

  try {
    resultado = await pool.query<{
      rol_codigo: string | null;
      rol_area_id: string | null;
      tipo_resolucion: string | null;
      vigente: boolean;
      motivo_no_habilitado: string | null;
    }>(
      `SELECT r.codigo AS rol_codigo, ur.area_id AS rol_area_id, f.tipo_resolucion, f.vigente, f.motivo_no_habilitado
         FROM sigd_org.usuario_rol ur
         JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id AND r.vigente = TRUE
         JOIN sigd_auth.cuenta_usuario cu ON cu.id_usuario = ur.id_usuario AND cu.activo = TRUE
         LEFT JOIN sigd_org.facultad_despacho f
                ON f.usuario_id = ur.id_usuario
               AND f.cargo_id IS NOT NULL
        WHERE ur.id_usuario = $1
          AND ur.vigente_desde <= now()
          AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
       UNION ALL
       SELECT NULL AS rol_codigo, NULL::uuid AS rol_area_id, e.tipo_resolucion, e.vigente, e.motivo_no_habilitado
         FROM sigd_org.encargatura_despacho e
        WHERE e.usuario_id = $1
          AND EXISTS (SELECT 1 FROM sigd_auth.cuenta_usuario cu
                       WHERE cu.id_usuario = e.usuario_id AND cu.activo = TRUE)
          AND e.vigente
          AND e.inicio <= now()
          AND (e.fin IS NULL OR e.fin > now())`,
      [idUsuario],
    );
  } catch (error: any) {
    if (error?.code === '42501') {
      const resRoles = await pool.query<{ rol_codigo: string; rol_area_id: string | null }>(
        `SELECT r.codigo AS rol_codigo, ur.area_id AS rol_area_id
           FROM sigd_org.usuario_rol ur
           JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id AND r.vigente = TRUE
           JOIN sigd_auth.cuenta_usuario cu ON cu.id_usuario = ur.id_usuario AND cu.activo = TRUE
          WHERE ur.id_usuario = $1
            AND ur.vigente_desde <= now()
            AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())`,
        [idUsuario],
      );
      resultado = {
        rows: resRoles.rows.map((r) => ({
          rol_codigo: r.rol_codigo,
          rol_area_id: r.rol_area_id,
          tipo_resolucion: null,
          vigente: false,
          motivo_no_habilitado: 'Privilegios de almacenamiento insuficientes para verificar sigd_org.facultad_despacho / encargatura_despacho.',
        })),
      };
    } else {
      throw error;
    }
  }

  const roles = new Set<string>();
  const rolesGlobales = new Set<string>();
  const tipos = new Set<string>();
  let facultadGlobal = false;
  let motivo: string | null = null;

  for (const fila of resultado.rows) {
    if (fila.rol_codigo) {
      roles.add(fila.rol_codigo);
      if (fila.rol_area_id == null) rolesGlobales.add(fila.rol_codigo);
    }
    if (!fila.vigente) {
      motivo ??= fila.motivo_no_habilitado;
      continue;
    }
    if (fila.tipo_resolucion === null) facultadGlobal = true;
    else tipos.add(fila.tipo_resolucion);
  }

  const rolFirmante = [...rolesGlobales].some((rol) => (ROLES_FIRMA as readonly string[]).includes(rol));
  const tieneRolDirector = roles.has('DIRECTOR');
  const tieneEncargatura = resultado.rows.some((r) => r.rol_codigo === null && r.vigente);

  // Segregación institucional: ADMINISTRADOR es un rol técnico de plataforma/usuarios sin facultades de firma.
  // La firma institucional de resoluciones requiere rol DIRECTOR o encargo formal de despacho.
  const habilitadoParaFirmar = tieneRolDirector || tieneEncargatura;
  const puedeFirmar = habilitadoParaFirmar && (rolFirmante || facultadGlobal || tipos.size > 0);

  if (!habilitadoParaFirmar && (roles.has('ADMINISTRADOR') || roles.size > 0)) {
    motivo ??= 'El usuario no posee rol DIRECTOR ni encargatura de despacho vigente para suscribir resoluciones.';
  }

  return {
    puedeFirmar,
    roles: [...roles],
    facultadGlobal: puedeFirmar && (facultadGlobal || rolFirmante),
    tiposAutorizados: puedeFirmar ? [...tipos] : [],
    motivo,
  };
}
