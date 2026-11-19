import type { Pool } from 'pg';
import { z } from 'zod';
import { ForbiddenError, NotFoundError } from '../../shared/domain/errors/index.js';
import { registrarMutacion } from '../../audit/bitacora-auditoria.repository.js';
import { firmarTokenAcceso } from './jwt.service.js';
import type { PermisoInstitucional } from './auth.guard.js';
import type { ContextoUsuario, CambioContextoResult } from './contexto.types.js';

const PERMISOS_PERMITIDOS_GESTOR_APOYO = new Set([
  'EXPEDIENTE_LEER',
  'EXPEDIENTE_RECEPCIONAR',
  'EXPEDIENTE_DERIVAR',
  'EXPEDIENTE_ADJUNTAR',
]);

const PERMISOS_PROHIBIDOS_GESTOR_APOYO = new Set([
  'EXPEDIENTE_FIRMAR',
  'EXPEDIENTE_RESOLVER',
  'DOCENTE_EVALUAR',
  'ADMIN_USUARIOS',
  'FIRMA_FIRMAR',
  'REPORTE_LEER',
]);

export async function listarContextosDisponibles(pool: Pool, idUsuario: string): Promise<ContextoUsuario[]> {
  if (!z.string().uuid().safeParse(idUsuario).success) {
    return [];
  }

  const contextos: ContextoUsuario[] = [];

  // 1. Roles institucionales asignados y vigentes
  try {
    const { rows: rolesRows } = await pool.query<{
      id_asignacion: string;
      codigo: string;
      nombre: string;
      area_id: string | null;
      area_codigo: string | null;
      area_nombre: string | null;
      vigente_desde: string;
      vigente_hasta: string | null;
      activo: boolean;
      permisos: PermisoInstitucional[];
    }>(
      `SELECT ur.id_usuario_rol::text AS id_asignacion,
              r.codigo,
              r.nombre,
              ur.area_id::text AS area_id,
              a.codigo AS area_codigo,
              a.nombre AS area_nombre,
              ur.vigente_desde::text AS vigente_desde,
              ur.vigente_hasta::text AS vigente_hasta,
              (ur.vigente_desde <= now() AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())) AS activo,
              COALESCE(jsonb_agg(DISTINCT jsonb_build_object(
                'codigo', p.codigo,
                'ambito', p.ambito,
                'areaId', CASE WHEN p.ambito = 'AREA' THEN ur.area_id ELSE NULL END
              )) FILTER (WHERE p.codigo IS NOT NULL AND NOT (r.codigo = 'CIUDADANO' AND p.codigo = 'EXPEDIENTE_LEER')), '[]'::jsonb) AS permisos
         FROM sigd_auth.cuenta_usuario cu
         JOIN sigd_org.usuario_rol ur ON ur.id_usuario = cu.id_usuario
         JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id AND r.vigente = TRUE
         LEFT JOIN sigd_org.area a ON a.area_id = ur.area_id
         LEFT JOIN sigd_org.rol_permiso rp ON rp.rol_id = r.rol_id
         LEFT JOIN sigd_org.permiso_sistema p ON p.permiso_id = rp.permiso_id
        WHERE cu.id_usuario = $1::uuid
          AND cu.activo = TRUE
          AND ur.vigente_desde <= now()
          AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
        GROUP BY ur.id_usuario_rol, r.codigo, r.nombre, ur.area_id, a.codigo, a.nombre, ur.vigente_desde, ur.vigente_hasta
        ORDER BY r.codigo ASC, a.nombre ASC NULLS FIRST`,
      [idUsuario],
    );

    for (const fila of rolesRows) {
      contextos.push({
        idAsignacion: fila.id_asignacion,
        tipo: 'ROL',
        codigo: fila.codigo,
        nombre: fila.nombre,
        areaId: fila.area_id,
        areaCodigo: fila.area_codigo,
        areaNombre: fila.area_nombre,
        permisos: fila.permisos || [],
        vigenteDesde: fila.vigente_desde,
        vigenteHasta: fila.vigente_hasta,
        activo: fila.activo,
      });
    }
  } catch (error) {
    console.error('[CONTEXTO] Error al listar roles para contexto:', error);
  }

  // 2. Capacidades operativas normalizadas (relacional con sigd_org.permiso_sistema)
  try {
    const { rows: capacidadesRows } = await pool.query<{
      id_asignacion: string;
      codigo: string;
      nombre: string;
      area_id: string | null;
      area_codigo: string | null;
      area_nombre: string | null;
      vigente_desde: string;
      vigente_hasta: string | null;
      activo: boolean;
      permisos: PermisoInstitucional[];
    }>(
      `SELECT uc.id_usuario_capacidad::text AS id_asignacion,
              cs.codigo,
              cs.nombre,
              uc.area_id::text AS area_id,
              a.codigo AS area_codigo,
              a.nombre AS area_nombre,
              uc.vigente_desde::text AS vigente_desde,
              uc.vigente_hasta::text AS vigente_hasta,
              (uc.activo AND uc.vigente_desde <= now() AND (uc.vigente_hasta IS NULL OR uc.vigente_hasta > now())) AS activo,
              COALESCE(jsonb_agg(DISTINCT jsonb_build_object(
                'codigo', p.codigo,
                'ambito', p.ambito,
                'areaId', uc.area_id
              )) FILTER (WHERE p.codigo IS NOT NULL), '[]'::jsonb) AS permisos
         FROM sigd_org.usuario_capacidad uc
         JOIN sigd_org.capacidad_sistema cs ON cs.id_capacidad = uc.id_capacidad AND cs.vigente = TRUE
         JOIN sigd_auth.cuenta_usuario cu ON cu.id_usuario = uc.id_usuario AND cu.activo = TRUE
         LEFT JOIN sigd_org.area a ON a.area_id = uc.area_id
         LEFT JOIN sigd_org.capacidad_permiso cp ON cp.id_capacidad = cs.id_capacidad
         LEFT JOIN sigd_org.permiso_sistema p ON p.permiso_id = cp.permiso_id
        WHERE uc.id_usuario = $1::uuid
          AND uc.activo = TRUE
          AND uc.vigente_desde <= now()
          AND (uc.vigente_hasta IS NULL OR uc.vigente_hasta > now())
        GROUP BY uc.id_usuario_capacidad, cs.codigo, cs.nombre, uc.area_id, a.codigo, a.nombre, uc.vigente_desde, uc.vigente_hasta
        ORDER BY uc.creado_en DESC`,
      [idUsuario],
    );

    for (const cap of capacidadesRows) {
      // Filtrar proactivamente cualquier permiso prohibido para soporte operativo
      const permisosLimpios = (cap.permisos || []).filter(
        (p) => !PERMISOS_PROHIBIDOS_GESTOR_APOYO.has(p.codigo),
      );

      contextos.push({
        idAsignacion: cap.id_asignacion,
        tipo: 'CAPACIDAD',
        codigo: cap.codigo,
        nombre: cap.nombre || 'Gestor de Apoyo de Área',
        areaId: cap.area_id,
        areaCodigo: cap.area_codigo,
        areaNombre: cap.area_nombre,
        permisos: permisosLimpios,
        vigenteDesde: cap.vigente_desde,
        vigenteHasta: cap.vigente_hasta,
        activo: cap.activo,
      });
    }
  } catch (_normalizedTableErr) {
    // Si la estructura con agregación jsonb no devuelve o falla en entornos de prueba, intentar sin agrupación
    try {
      const { rows: legacyCapacidades } = await pool.query<{
        id_asignacion: string;
        codigo: string;
        area_id: string | null;
        area_codigo: string | null;
        area_nombre: string | null;
        vigente_desde: string;
        vigente_hasta: string | null;
        activo: boolean;
      }>(
        `SELECT uc.id_usuario_capacidad::text AS id_asignacion,
                COALESCE(cs.codigo, 'GESTOR_APOYO_AREA') AS codigo,
                uc.area_id::text AS area_id,
                a.codigo AS area_codigo,
                a.nombre AS area_nombre,
                uc.vigente_desde::text AS vigente_desde,
                uc.vigente_hasta::text AS vigente_hasta,
                (uc.activo AND uc.vigente_desde <= now() AND (uc.vigente_hasta IS NULL OR uc.vigente_hasta > now())) AS activo
           FROM sigd_org.usuario_capacidad uc
           LEFT JOIN sigd_org.capacidad_sistema cs ON cs.id_capacidad = uc.id_capacidad AND cs.vigente = TRUE
           JOIN sigd_auth.cuenta_usuario cu ON cu.id_usuario = uc.id_usuario AND cu.activo = TRUE
           LEFT JOIN sigd_org.area a ON a.area_id = uc.area_id
          WHERE uc.id_usuario = $1::uuid
            AND uc.activo = TRUE
            AND uc.vigente_desde <= now()
            AND (uc.vigente_hasta IS NULL OR uc.vigente_hasta > now())`,
        [idUsuario],
      );

      for (const cap of legacyCapacidades) {
        const areaId = cap.area_id;
        contextos.push({
          idAsignacion: cap.id_asignacion,
          tipo: 'CAPACIDAD',
          codigo: cap.codigo,
          nombre: cap.codigo === 'GESTOR_APOYO_AREA' ? 'Gestor de Apoyo de Área' : cap.codigo,
          areaId,
          areaCodigo: cap.area_codigo,
          areaNombre: cap.area_nombre,
          permisos: [
            { codigo: 'EXPEDIENTE_LEER', ambito: 'AREA', areaId },
            { codigo: 'EXPEDIENTE_RECEPCIONAR', ambito: 'AREA', areaId },
            { codigo: 'EXPEDIENTE_DERIVAR', ambito: 'AREA', areaId },
            { codigo: 'EXPEDIENTE_ADJUNTAR', ambito: 'AREA', areaId },
          ],
          vigenteDesde: cap.vigente_desde,
          vigenteHasta: cap.vigente_hasta,
          activo: cap.activo,
        });
      }
    } catch {
      // Tabla no creada aún en base sin migrar
    }
  }

  return contextos;
}

export async function validarYResolverContexto(
  pool: Pool,
  idUsuario: string,
  idAsignacion: string,
): Promise<ContextoUsuario> {
  if (!z.string().uuid().safeParse(idUsuario).success || !z.string().uuid().safeParse(idAsignacion).success) {
    throw new ForbiddenError({ message: 'Identificadores inválidos para resolución de contexto.' });
  }

  const contextos = await listarContextosDisponibles(pool, idUsuario);
  const contexto = contextos.find((c) => c.idAsignacion === idAsignacion);

  if (!contexto) {
    // Mitigación BOLA/IDOR: Verificar si la asignación existe pero pertenece a otro usuario o está vencida
    const existeEnOtro = await pool.query(
      `SELECT id_usuario FROM sigd_org.usuario_rol WHERE id_usuario_rol = $1::uuid
       UNION
       SELECT id_usuario FROM sigd_org.usuario_capacidad WHERE id_usuario_capacidad = $1::uuid`,
      [idAsignacion],
    ).catch(() => ({ rows: [] }));

    if (existeEnOtro.rows.length > 0) {
      throw new ForbiddenError({
        message: 'Acceso denegado: el contexto solicitado no pertenece a esta cuenta o no se encuentra activo.',
      });
    }

    throw new ForbiddenError({
      message: 'El contexto de autorización no existe o no se encuentra vigente.',
    });
  }

  if (!contexto.activo) {
    throw new ForbiddenError({
      message: 'El contexto solicitado se encuentra inactivo o fuera de su vigencia.',
    });
  }

  return contexto;
}

export async function cambiarContexto(
  pool: Pool,
  idUsuario: string,
  idAsignacion: string,
  ipOrigen?: string,
  userAgent?: string,
): Promise<CambioContextoResult> {
  const nuevoContexto = await validarYResolverContexto(pool, idUsuario, idAsignacion);

  // Registrar auditoría WORM del cambio de contexto
  try {
    await registrarMutacion(pool, {
      esquema: 'sigd_auth',
      tabla: 'sesion_contexto',
      operacion: 'UPDATE',
      datos_antes: null,
      datos_despues: {
        idUsuario,
        idAsignacion: nuevoContexto.idAsignacion,
        tipo: nuevoContexto.tipo,
        codigo: nuevoContexto.codigo,
        areaId: nuevoContexto.areaId,
      },
      usuario_id: idUsuario,
    });
  } catch (auditErr) {
    console.error('[CONTEXTO] Error al registrar bitácora de cambio de contexto:', auditErr);
  }

  const nuevoAccessToken = firmarTokenAcceso({
    sub: idUsuario,
    roles: [nuevoContexto.codigo],
    ctx: nuevoContexto.idAsignacion,
    rol: nuevoContexto.codigo,
    expiraSegundos: 900,
  });

  return {
    ok: true,
    contextoActivo: nuevoContexto,
    accessToken: nuevoAccessToken,
    mensaje: `Contexto cambiado exitosamente a ${nuevoContexto.nombre}${
      nuevoContexto.areaNombre ? ` (${nuevoContexto.areaNombre})` : ''
    }.`,
  };
}

export async function verificarEvaluadorExpediente(
  pool: Pool,
  idUsuario: string,
  expedienteId: string,
): Promise<boolean> {
  if (!z.string().uuid().safeParse(idUsuario).success || !z.string().uuid().safeParse(expedienteId).success) {
    return false;
  }

  try {
    const res = await pool.query<{ asignado: boolean }>(
      `SELECT EXISTS (
         SELECT 1
           FROM sigd_rut.expediente_evaluador
          WHERE expediente_id = $1::uuid
            AND id_usuario_docente = $2::uuid
            AND activo = TRUE
       ) AS asignado`,
      [expedienteId, idUsuario],
    );
    return res.rows[0]?.asignado === true;
  } catch {
    return false;
  }
}
