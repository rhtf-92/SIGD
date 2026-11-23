import { Request, Response, Router } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import { getRequestContext } from '../../shared/request-context/request-context.js';
import { resolverIdentidad, obtenerAutorizacionCuenta } from '../../core/auth/auth.guard.js';
import { AppError, ForbiddenError, UnauthorizedError } from '../../shared/domain/errors/index.js';
import {
  crearServicioResoluciones,
  TIPOS_RESOLUCION,
  type ServicioResoluciones,
} from './resoluciones.service.js';

// =============================================================================
// DocuCore · Controlador REST de Resoluciones Directorales
// Autor: Christian Jhoel Rodríguez Cari (B_CHRISTIAN) · Sprint 4 · T-BE-DC-03
// =============================================================================
// #32  POST   /api/v1/resoluciones/proyectar   (alta/actualización canónica de borrador)
// #32  POST   /api/v1/resoluciones              (ruta alias frontend)
// #33  GET    /api/v1/resoluciones/proyectos/:id (consulta canónica con render)
// #33  GET    /api/v1/resoluciones/:id          (ruta canónica del plan)
// =============================================================================

const esquemaProyectar = z.object({
  expedienteId: z.string().uuid(),
  tipoResolucion: z.enum(TIPOS_RESOLUCION),
  visto: z.string().min(10, 'El Visto debe tener al menos 10 caracteres.'),
  considerandos: z.array(z.string().min(10, 'Cada considerando debe tener al menos 10 caracteres.')).min(1),
  articulos: z
    .array(
      z.object({
        numero: z.number().int().positive('El número de artículo debe ser positivo.'),
        texto: z.string().min(10, 'El texto del artículo debe tener al menos 10 caracteres.'),
      }),
    )
    .min(1),
  distribucion: z.array(z.string().min(1)).min(1).optional(),
});

const esquemaActualizar = z.object({
  tipoResolucion: z.enum(TIPOS_RESOLUCION).optional(),
  visto: z.string().min(10, 'El Visto debe tener al menos 10 caracteres.').optional(),
  considerandos: z.array(z.string().min(10, 'Cada considerando debe tener al menos 10 caracteres.')).min(1).optional(),
  articulos: z
    .array(
      z.object({
        numero: z.number().int().positive('El número de artículo debe ser positivo.'),
        texto: z.string().min(10, 'El texto del artículo debe tener al menos 10 caracteres.'),
      }),
    )
    .min(1)
    .optional(),
  distribucion: z.array(z.string().min(1)).min(1).optional(),
});

export function crearRouterResoluciones(pool: Pool): Router {
  const router = Router();
  const servicio: ServicioResoluciones = crearServicioResoluciones(pool);

  async function autorizarOperadorResolucion(
    req: Request,
    expedienteId?: string,
  ): Promise<{ idUsuario: string; roles: string[] }> {
    const identidad = resolverIdentidad(req);
    if (!z.string().uuid().safeParse(identidad.idUsuario).success) {
      throw new UnauthorizedError({ detail: 'Identificador de usuario no válido.' });
    }

    const autorizacion = await obtenerAutorizacionCuenta(pool, identidad.idUsuario, identidad.contextoId);
    if (!autorizacion) {
      throw new ForbiddenError({ detail: 'Cuenta institucional no habilitada o inactiva.' });
    }
    if (identidad.contextoId && autorizacion.contextoRevocado) {
      throw new AppError({
        status: 403,
        code: 'CONTEXT_REVOKED',
        message: 'El contexto activo ha sido revocado o no se encuentra vigente. Debe seleccionar un contexto vigente.',
      });
    }

    const esDirectorInstitucional =
      autorizacion.roles.includes('DIRECTOR') &&
      autorizacion.permisos.some(
        (p) => p.codigo === 'FIRMA_FIRMAR' && p.ambito === 'GLOBAL' && p.areaId === null,
      );

    if (esDirectorInstitucional) {
      return identidad;
    }

    const permisosResolver = autorizacion.permisos.filter(
      (p) => p.codigo === 'EXPEDIENTE_RESOLVER' || p.codigo === 'EXPEDIENTE_DERIVAR',
    );

    if (permisosResolver.length === 0 || autorizacion.roles.includes('CIUDADANO')) {
      throw new ForbiddenError({ detail: 'El usuario no dispone de facultades para proyectar resoluciones.' });
    }

    const tieneGlobal = permisosResolver.some((p) => p.ambito === 'GLOBAL' || p.areaId === null);
    if (!tieneGlobal && expedienteId && z.string().uuid().safeParse(expedienteId).success) {
      const areasUsuario = permisosResolver
        .filter((p) => p.ambito === 'AREA' && p.areaId !== null)
        .map((p) => p.areaId);

      if (areasUsuario.length > 0) {
        const acceso = await pool.query<{ autorizado: boolean }>(
          `SELECT EXISTS (
             SELECT 1 FROM sigd_tra.expediente e
             LEFT JOIN sigd_rut.estado_actual_expediente a USING (expediente_id)
             LEFT JOIN (
               SELECT DISTINCT ON (expediente_id)
                      expediente_id, canal_ingreso, anulado
                 FROM sigd_tra.asiento_registro
                WHERE anulado = FALSE
                ORDER BY expediente_id, numero_registro ASC
             ) ar ON ar.expediente_id = e.expediente_id
            WHERE e.expediente_id = $1::uuid
              AND (
                CASE
                  WHEN a.expediente_id IS NOT NULL THEN NULLIF(a.area_actual_id, '')
                  WHEN ar.canal_ingreso IN ('MESA_PRESENCIAL', 'MESA_VIRTUAL') AND (ar.anulado IS FALSE OR ar.anulado IS NULL)
                    THEN (SELECT area_id::text FROM sigd_org.area WHERE codigo = 'MP')
                  ELSE NULL
                END
              ) = ANY($2::text[])
          ) AS autorizado`,
          [expedienteId, areasUsuario],
        );
        if (acceso.rows[0]?.autorizado !== true) {
          throw new ForbiddenError({ detail: 'El expediente no corresponde al área asignada del operador.' });
        }
      }
    }

    return identidad;
  }

  async function actualizar(req: Request, res: Response): Promise<void> {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const identidad = await autorizarOperadorResolucion(req);
    const datos = esquemaActualizar.parse(req.body);
    const contexto = getRequestContext();
    const proyecto = await servicio.actualizarProyecto(id, {
      ...datos,
      usuarioId: identidad.idUsuario,
    });
    res.status(200).json({
      resolucionId: proyecto.id,
      numeroBorrador: proyecto.numero,
      estado: proyecto.estado,
      correlation_id: contexto?.correlation_id,
    });
  }

  async function proyectar(req: Request, res: Response): Promise<void> {
    if (req.body?.resolucionId) {
      req.params = { id: req.body.resolucionId };
      return actualizar(req, res);
    }
    const datos = esquemaProyectar.parse(req.body);
    const identidad = await autorizarOperadorResolucion(req, datos.expedienteId);
    const contexto = getRequestContext();
    const proyecto = await servicio.proyectar({
      expedienteId: datos.expedienteId,
      tipoResolucion: datos.tipoResolucion,
      visto: datos.visto,
      considerandos: datos.considerandos,
      articulos: datos.articulos,
      distribucion: datos.distribucion,
      usuarioId: identidad.idUsuario,
    });
    res.status(201).json({
      resolucionId: proyecto.id,
      numeroBorrador: proyecto.numero,
      correlation_id: contexto?.correlation_id,
    });
  }

  async function obtenerProyecto(req: Request, res: Response): Promise<void> {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const identidad = resolverIdentidad(req);
    if (!z.string().uuid().safeParse(identidad.idUsuario).success) {
      throw new UnauthorizedError({ detail: 'Identificador de usuario inválido.' });
    }

    const autorizacion = await obtenerAutorizacionCuenta(pool, identidad.idUsuario, identidad.contextoId);
    if (!autorizacion) {
      throw new ForbiddenError({ detail: 'Cuenta institucional inactiva o no autorizada.' });
    }

    const proyecto = await servicio.obtenerProyectoPorId(id);

    const tieneLecturaGlobalODirector =
      (autorizacion.roles.includes('DIRECTOR') &&
        autorizacion.permisos.some((p) => p.codigo === 'FIRMA_FIRMAR' && p.ambito === 'GLOBAL' && p.areaId === null)) ||
      autorizacion.permisos.some(
        (p) => p.codigo === 'EXPEDIENTE_LEER' && p.ambito === 'GLOBAL' && p.areaId === null,
      );

    if (!tieneLecturaGlobalODirector) {
      const acceso = await pool.query<{ autorizado: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM sigd_auth.cuenta_usuario cu
           JOIN sigd_tra.expediente e ON e.expediente_id = $2::uuid
           LEFT JOIN sigd_rut.estado_actual_expediente ultimo ON ultimo.expediente_id = e.expediente_id
           WHERE cu.id_usuario = $1::uuid AND cu.activo = TRUE
             AND (
               e.solicitante_id = cu.id_persona
               OR EXISTS (
                 SELECT 1 FROM sigd_org.usuario_rol ur
                 JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id AND r.vigente = TRUE
                 JOIN sigd_org.rol_permiso rp ON rp.rol_id = r.rol_id
                 JOIN sigd_org.permiso_sistema p ON p.permiso_id = rp.permiso_id
                 WHERE ur.id_usuario = cu.id_usuario
                   AND ur.vigente_desde <= now()
                   AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
                   AND p.codigo IN ('EXPEDIENTE_LEER', 'EXPEDIENTE_RESOLVER')
                   AND (
                     (p.ambito = 'GLOBAL' AND ur.area_id IS NULL)
                     OR (ur.area_id IS NOT NULL AND ur.area_id::text = NULLIF(ultimo.area_actual_id, ''))
                   )
               )
             )
        ) AS autorizado`,
        [identidad.idUsuario, proyecto.expedienteId],
      );
      if (acceso.rows[0]?.autorizado !== true) {
        throw new ForbiddenError({ detail: 'No autorizado para consultar la resolución de este expediente.' });
      }
    }

    const contexto = getRequestContext();
    res.status(200).json({
      resolucionId: proyecto.id,
      numero: proyecto.numero,
      tipoResolucion: proyecto.tipoResolucion,
      expedienteId: proyecto.expedienteId,
      estado: proyecto.estado,
      visto: proyecto.visto,
      considerandos: proyecto.considerandos,
      articulos: proyecto.articulos,
      distribucion: proyecto.distribucion,
      html: proyecto.html,
      creadoEn: proyecto.creadoEn,
      correlation_id: contexto?.correlation_id,
    });
  }

  async function listarResoluciones(req: Request, res: Response): Promise<void> {
    const identidad = resolverIdentidad(req);
    if (!z.string().uuid().safeParse(identidad.idUsuario).success) {
      throw new UnauthorizedError({ detail: 'Identificador de usuario inválido.' });
    }

    const autorizacion = await obtenerAutorizacionCuenta(pool, identidad.idUsuario, identidad.contextoId);
    if (!autorizacion) {
      throw new ForbiddenError({ detail: 'Cuenta institucional inactiva o no autorizada.' });
    }

    const expedienteId =
      typeof req.query.expedienteId === 'string' && z.string().uuid().safeParse(req.query.expedienteId).success
        ? req.query.expedienteId
        : undefined;
    const estado = typeof req.query.estado === 'string' && req.query.estado.trim() ? req.query.estado.trim() : undefined;
    const pagina = Math.max(1, parseInt(String(req.query.pagina || '1'), 10) || 1);
    const limite = Math.min(100, Math.max(1, parseInt(String(req.query.limite || '20'), 10) || 20));
    const offset = (pagina - 1) * limite;

    const condiciones: string[] = [];
    const params: unknown[] = [];

    if (expedienteId) {
      params.push(expedienteId);
      condiciones.push(`r.expediente_id = $${params.length}::uuid`);
    }
    if (estado) {
      params.push(estado);
      condiciones.push(`r.estado = $${params.length}`);
    }

    const whereClause = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

    params.push(limite);
    const limiteIdx = params.length;
    params.push(offset);
    const offsetIdx = params.length;

    const resultado = await pool.query<{
      resolucion_id: string;
      expediente_id: string;
      numero_borrador: string;
      numero_resolucion: string | null;
      tipo_resolucion: string;
      asunto: string;
      estado: string;
      fecha_proyeccion: string;
      creado_en: string;
      codigo_expediente: string | null;
    }>(
      `SELECT r.resolucion_id, r.expediente_id, r.numero_borrador, r.numero_resolucion,
              r.tipo_resolucion, r.asunto, r.estado, r.fecha_proyeccion, r.creado_en,
              e.codigo_expediente
         FROM sigd_doc.resolucion r
         LEFT JOIN sigd_tra.expediente e ON e.expediente_id = r.expediente_id
        ${whereClause}
        ORDER BY r.creado_en DESC
        LIMIT $${limiteIdx} OFFSET $${offsetIdx}`,
      params,
    );

    const totalParams = condiciones.length > 0 ? params.slice(0, condiciones.length) : [];
    const totalRes = await pool.query<{ total: string }>(
      `SELECT count(*)::text AS total FROM sigd_doc.resolucion r ${whereClause}`,
      totalParams,
    );

    const contexto = getRequestContext();
    res.status(200).json({
      items: resultado.rows.map((row) => ({
        resolucionId: row.resolucion_id,
        numero: row.numero_resolucion || row.numero_borrador,
        numeroBorrador: row.numero_borrador,
        numeroResolucion: row.numero_resolucion,
        tipoResolucion: row.tipo_resolucion,
        expedienteId: row.expediente_id,
        codigoExpediente: row.codigo_expediente,
        asunto: row.asunto,
        estado: row.estado,
        fechaProyeccion: row.fecha_proyeccion,
        creadoEn: row.creado_en,
      })),
      total: parseInt(totalRes.rows[0]?.total ?? '0', 10),
      pagina,
      limite,
      correlation_id: contexto?.correlation_id,
    });
  }

  async function obtenerResolucionPorExpediente(req: Request, res: Response): Promise<void> {
    const { expedienteId } = z.object({ expedienteId: z.string().uuid() }).parse(req.params);
    const identidad = resolverIdentidad(req);
    if (!z.string().uuid().safeParse(identidad.idUsuario).success) {
      throw new UnauthorizedError({ detail: 'Identificador de usuario inválido.' });
    }

    const autorizacion = await obtenerAutorizacionCuenta(pool, identidad.idUsuario, identidad.contextoId);
    if (!autorizacion) {
      throw new ForbiddenError({ detail: 'Cuenta institucional inactiva o no autorizada.' });
    }

    const tieneLecturaGlobalODirector =
      (autorizacion.roles.includes('DIRECTOR') &&
        autorizacion.permisos.some((p) => p.codigo === 'FIRMA_FIRMAR' && p.ambito === 'GLOBAL' && p.areaId === null)) ||
      autorizacion.permisos.some(
        (p) => p.codigo === 'EXPEDIENTE_LEER' && p.ambito === 'GLOBAL' && p.areaId === null,
      );

    if (!tieneLecturaGlobalODirector) {
      const acceso = await pool.query<{ autorizado: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM sigd_auth.cuenta_usuario cu
           JOIN sigd_tra.expediente e ON e.expediente_id = $2::uuid
           LEFT JOIN sigd_rut.estado_actual_expediente ultimo ON ultimo.expediente_id = e.expediente_id
           WHERE cu.id_usuario = $1::uuid AND cu.activo = TRUE
             AND (
               e.solicitante_id = cu.id_persona
               OR EXISTS (
                 SELECT 1 FROM sigd_org.usuario_rol ur
                 JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id AND r.vigente = TRUE
                 JOIN sigd_org.rol_permiso rp ON rp.rol_id = r.rol_id
                 JOIN sigd_org.permiso_sistema p ON p.permiso_id = rp.permiso_id
                 WHERE ur.id_usuario = cu.id_usuario
                   AND ur.vigente_desde <= now()
                   AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
                   AND p.codigo IN ('EXPEDIENTE_LEER', 'EXPEDIENTE_RESOLVER', 'EXPEDIENTE_DERIVAR')
                   AND (
                     (p.ambito = 'GLOBAL' AND ur.area_id IS NULL)
                     OR (ur.area_id IS NOT NULL AND ur.area_id::text = NULLIF(ultimo.area_actual_id, ''))
                   )
               )
             )
        ) AS autorizado`,
        [identidad.idUsuario, expedienteId],
      );
      if (acceso.rows[0]?.autorizado !== true) {
        throw new ForbiddenError({ detail: 'No autorizado para consultar la resolución de este expediente.' });
      }
    }

    const resultado = await pool.query<{
      resolucion_id: string;
      expediente_id: string;
      numero_borrador: string;
      numero_resolucion: string | null;
      tipo_resolucion: string;
      asunto: string;
      estado: string;
      fecha_proyeccion: string;
      firmado_por: string | null;
      firmante_nombre: string | null;
      firmado_en: Date | null;
      cvd: string | null;
      hash_pades: string | null;
      documento_adjunto_id: string | null;
    }>(
      `SELECT r.resolucion_id::text,
              r.expediente_id::text,
              r.numero_borrador,
              r.numero_resolucion,
              r.tipo_resolucion,
              r.asunto,
              r.estado,
              r.fecha_proyeccion::text,
              r.firmado_por::text,
              COALESCE(pn.nombre_completo, TRIM(pn.nombres || ' ' || pn.apellidos), cu.usuario, fd.firmante) AS firmante_nombre,
              r.firmado_en,
              fd.cvd,
              COALESCE(r.hash_pades, fd.sha256_firmado) AS hash_pades,
              adj.documento_adjunto_id::text
         FROM sigd_doc.resolucion r
         LEFT JOIN sigd_auth.cuenta_usuario cu ON cu.id_usuario = r.firmado_por
         LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = cu.id_persona
         LEFT JOIN sigd_doc.documento_adjunto adj
           ON adj.expediente_id = r.expediente_id
          AND (adj.s3_key = ('resoluciones/' || r.numero_borrador || '.pdf') OR adj.mime_type = 'application/pdf')
         LEFT JOIN sigd_doc.firma_digital_documento fd
           ON fd.documento_id = adj.documento_adjunto_id
          AND fd.estado = 'FIRMADO_DIGITALMENTE'
        WHERE r.expediente_id = $1::uuid
        ORDER BY r.creado_en DESC
        LIMIT 1`,
      [expedienteId],
    );

    const contexto = getRequestContext();
    if (resultado.rows.length === 0) {
      res.status(200).json({
        ok: true,
        resolucion: null,
        correlation_id: contexto?.correlation_id,
      });
      return;
    }

    const row = resultado.rows[0];
    res.status(200).json({
      ok: true,
      resolucion: {
        resolucionId: row.resolucion_id,
        expedienteId: row.expediente_id,
        numero: row.numero_resolucion || row.numero_borrador,
        numeroBorrador: row.numero_borrador,
        numeroResolucion: row.numero_resolucion,
        tipoResolucion: row.tipo_resolucion,
        asunto: row.asunto,
        estado: row.estado,
        fechaProyeccion: row.fecha_proyeccion,
        firmadoPor: row.firmado_por,
        firmanteNombre: row.firmante_nombre,
        firmadoEn: row.firmado_en ? row.firmado_en.toISOString() : null,
        cvd: row.cvd,
        hashPades: row.hash_pades,
        documentoAdjuntoId: row.documento_adjunto_id,
      },
      correlation_id: contexto?.correlation_id,
    });
  }

  // Se registran primero las rutas específicas para no colisionar con /:id.
  router.get('/', (req, res, next) => {
    listarResoluciones(req, res).catch(next);
  });
  router.post('/proyectar', (req, res, next) => {
    proyectar(req, res).catch(next);
  });
  router.get('/proyectos/:id', (req, res, next) => {
    obtenerProyecto(req, res).catch(next);
  });
  router.get('/expediente/:expedienteId', (req, res, next) => {
    obtenerResolucionPorExpediente(req, res).catch(next);
  });

  // Rutas alias (interop frontend y ruta canónica #33 del plan).
  router.post('/', (req, res, next) => {
    proyectar(req, res).catch(next);
  });
  router.get('/:id', (req, res, next) => {
    obtenerProyecto(req, res).catch(next);
  });

  return router;
}
