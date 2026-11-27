/**
 * Endpoints #7 al #13 del catálogo REST - Casilla Electrónica y Acuse Legal (Ley N° 29733)
 * Responsable: B_JAIR (Jair) / Subdominio: IdentiCore (sigd_auth)
 */

import crypto from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import { resolverIdentidad } from '../../core/auth/auth.guard.js';
import { NotFoundError } from '../../shared/domain/errors/index.js';
import { AppError } from '../../shared/domain/errors/index.js';

const consultaPaginadaSchema = z
  .object({
    pagina: z.coerce.number().int().positive().optional(),
    page: z.coerce.number().int().positive().optional(),
    porPagina: z.coerce.number().int().min(1).max(100).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    estado: z.enum(['LEIDO', 'NO_LEIDO', 'TODOS']).default('TODOS'),
    busqueda: z.string().optional(),
  })
  .transform((val) => ({
    pagina: val.pagina ?? val.page ?? 1,
    porPagina: val.porPagina ?? val.limit ?? 10,
    estado: val.estado,
    busqueda: val.busqueda,
  }));

interface FilaNotificacionCasilla {
  id: string;
  usuario_id: string | null;
  correo_destinatario: string | null;
  cut: string | null;
  asunto: string;
  tipo_acto: string;
  numero_documento: string | null;
  cuerpo: unknown;
  referencia: string | null;
  estado: 'NO_LEIDO' | 'LEIDO' | 'PENDIENTE' | 'NOTIFICADO';
  fecha_deposito: Date | string;
  fecha_lectura: Date | string | null;
  hash_sha256: string | null;
  cvd: string | null;
  id_acuse: string | null;
  acuse_hash_sha256: string | null;
  acuse_sellado_tiempo: Date | string | null;
  documento_url: string | null;
  creado_en: Date | string;
}

function mapearNotificacion(fila: FilaNotificacionCasilla) {
  const fechaDeposito =
    typeof fila.fecha_deposito === 'string' ? fila.fecha_deposito : fila.fecha_deposito.toISOString();
  const fechaLectura = fila.fecha_lectura
    ? typeof fila.fecha_lectura === 'string'
      ? fila.fecha_lectura
      : fila.fecha_lectura.toISOString()
    : null;
  const hashSha256 = fila.hash_sha256;
  const cvd = fila.cvd;
  const numeroDocumento = fila.numero_documento;
  const cut = fila.cut;

  if (!fila.usuario_id) {
    throw new AppError({
      status: 409,
      code: 'NOTIFICACION_SIN_USUARIO',
      message: 'Notificación sin usuario asociado.',
      detail: `La notificación ${fila.id} no tiene usuario_id asignado.`,
    });
  }

  return {
    id: fila.id,
    numeroNotificacion: fila.id,
    numeroExpediente: cut,
    usuarioId: fila.usuario_id,
    cut,
    asunto: fila.asunto,
    tipo: 'RESOLUCION' as const,
    tipoActo: fila.tipo_acto,
    prioridad: 'NORMAL' as const,
    numeroDocumento,
    estado: fila.estado === 'LEIDO' ? ('LEIDO' as const) : ('NO_LEIDO' as const),
    fechaDeposito,
    fechaDepositoIso: fechaDeposito,
    fechaLectura,
    fechaLecturaIso: fechaLectura,
    fechaNotificadoIso: fila.id_acuse
      ? typeof fila.acuse_sellado_tiempo === 'string'
        ? fila.acuse_sellado_tiempo
        : fila.acuse_sellado_tiempo?.toISOString() ?? fechaDeposito
      : null,
    requiereAcuse: true,
    hashSha256,
    cvd,
    idAcuse: fila.id_acuse,
    acuseHashSha256: fila.acuse_hash_sha256,
    acuseSelladoTiempo: fila.acuse_sellado_tiempo
      ? typeof fila.acuse_sellado_tiempo === 'string'
        ? fila.acuse_sellado_tiempo
        : fila.acuse_sellado_tiempo.toISOString()
      : null,
    documentoUrl: fila.documento_url,
    actoAdministrativo: {
      tipoActo: fila.tipo_acto,
      numeroDocumento,
      asunto: fila.asunto,
      resumenLegal: typeof fila.cuerpo === 'string' ? fila.cuerpo : fila.asunto,
      hashIntegridadSha256: hashSha256,
      cvd,
    },
    acuse: fila.id_acuse
      ? {
          idAcuse: fila.id_acuse,
          idNotificacion: fila.id,
          numeroExpediente: cut,
          timestampGeneracionIso:
            typeof fila.acuse_sellado_tiempo === 'string'
              ? fila.acuse_sellado_tiempo
              : fila.acuse_sellado_tiempo?.toISOString() ?? fechaDeposito,
          hashSha256Acuse: fila.acuse_hash_sha256 ?? hashSha256,
        }
      : null,
  };
}

export function crearRouterCasilla(pool: Pool): Router {
  const router = Router();

  const handlerBandeja = async (req: Request, res: Response) => {
    const identidad = resolverIdentidad(req);
    const usuarioId = identidad.idUsuario;
    const query = consultaPaginadaSchema.parse(req.query);

    const condiciones: string[] = ['usuario_id = $1'];
    const valores: unknown[] = [usuarioId];

    if (query.estado !== 'TODOS') {
      valores.push(query.estado);
      condiciones.push(`estado = $${valores.length}`);
    }

    if (query.busqueda) {
      valores.push(`%${query.busqueda}%`);
      condiciones.push(`(asunto ILIKE $${valores.length} OR cut ILIKE $${valores.length})`);
    }

    const whereClausula = condiciones.join(' AND ');

    const countRes = await pool.query<{ total: string }>(
      `SELECT COUNT(*)::text as total FROM sigd_auth.notificacion_casilla WHERE ${whereClausula}`,
      valores,
    );
    const total = Number(countRes.rows[0]?.total ?? 0);

    const offset = (query.pagina - 1) * query.porPagina;
    const paginacionValores = [...valores, query.porPagina, offset];

    const itemsRes = await pool.query<FilaNotificacionCasilla>(
      `SELECT id, usuario_id, correo_destinatario, cut, asunto, tipo_acto,
              numero_documento, cuerpo, referencia, estado, fecha_deposito,
              fecha_lectura, hash_sha256, cvd, id_acuse, acuse_hash_sha256,
              acuse_sellado_tiempo, documento_url, creado_en
         FROM sigd_auth.notificacion_casilla
        WHERE ${whereClausula}
        ORDER BY fecha_deposito DESC
        LIMIT $${paginacionValores.length - 1} OFFSET $${paginacionValores.length}`,
      paginacionValores,
    );

    const notificaciones = itemsRes.rows.map(mapearNotificacion);
    const totalPaginas = Math.ceil(total / query.porPagina) || 1;

    res.status(200).json({
      total,
      pagina: query.pagina,
      porPagina: query.porPagina,
      totalPaginas,
      notificaciones,
      data: notificaciones,
      meta: {
        currentPage: query.pagina,
        totalPages: totalPaginas,
        totalItems: total,
        itemsPerPage: query.porPagina,
        hasNextPage: query.pagina < totalPaginas,
        hasPreviousPage: query.pagina > 1,
      },
    });
  };

  router.get('/casilla/notificaciones', handlerBandeja);
  router.get('/casilla/bandeja', handlerBandeja);

  router.get('/casilla/notificaciones/:id', async (req: Request, res: Response) => {
    const identidad = resolverIdentidad(req);
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const resultado = await pool.query<FilaNotificacionCasilla>(
      `SELECT * FROM sigd_auth.notificacion_casilla WHERE id = $1 AND usuario_id = $2`,
      [id, identidad.idUsuario],
    );

    if (resultado.rows.length === 0) {
      throw new NotFoundError({
        detail: `No existe la notificación de casilla con ID: ${id}`,
      });
    }

    res.status(200).json(mapearNotificacion(resultado.rows[0]));
  });

  router.patch('/casilla/notificaciones/:id/lectura', async (req: Request, res: Response) => {
    const identidad = resolverIdentidad(req);
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const resultado = await pool.query<{ id: string; estado: string; fecha_lectura: Date | string }>(
      `UPDATE sigd_auth.notificacion_casilla
          SET estado = 'LEIDO',
              fecha_lectura = COALESCE(fecha_lectura, now())
        WHERE id = $1 AND usuario_id = $2
        RETURNING id, estado, fecha_lectura`,
      [id, identidad.idUsuario],
    );

    if (resultado.rows.length === 0) {
      throw new NotFoundError({
        detail: `No existe la notificación de casilla para marcar lectura: ${id}`,
      });
    }

    const row = resultado.rows[0];
    const leidoEnIso = typeof row.fecha_lectura === 'string'
      ? row.fecha_lectura
      : row.fecha_lectura.toISOString();

    res.status(200).json({
      idNotificacion: row.id,
      estado: row.estado,
      leidoEn: leidoEnIso,
    });
  });

  router.post('/casilla/notificaciones/:id/acuse', async (req: Request, res: Response) => {
    const identidad = resolverIdentidad(req);
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const notifRes = await pool.query<FilaNotificacionCasilla>(
      `SELECT * FROM sigd_auth.notificacion_casilla WHERE id = $1 AND usuario_id = $2`,
      [id, identidad.idUsuario],
    );

    if (notifRes.rows.length === 0) {
      throw new NotFoundError({
        detail: `No existe la notificación de casilla para emitir acuse: ${id}`,
      });
    }

    const notif = notifRes.rows[0];
    if (!notif.cut) {
      throw new AppError({
        status: 409,
        code: 'NOTIFICACION_SIN_CUT',
        message: 'La notificación no tiene CUT asociado.',
      });
    }

    const anio = new Date().getFullYear();

    if (notif.id_acuse) {
      const selladoOriginalIso = notif.acuse_sellado_tiempo
        ? typeof notif.acuse_sellado_tiempo === 'string'
          ? notif.acuse_sellado_tiempo
          : notif.acuse_sellado_tiempo.toISOString()
        : typeof notif.fecha_deposito === 'string'
          ? notif.fecha_deposito
          : notif.fecha_deposito.toISOString();

      const hashAcuseExistente =
        notif.acuse_hash_sha256 ??
        crypto.createHash('sha256').update(`${id}:${selladoOriginalIso}:IESTP-SUIZA-ACUSE-LEGAL`).digest('hex');

      return res.status(200).json({
        success: true,
        message: 'Acuse digital legal existente recuperado.',
        data: {
          idAcuse: notif.id_acuse,
          idNotificacion: id,
          numeroExpediente: notif.cut,
          timestampGeneracionIso: selladoOriginalIso,
          selladoTiempo: selladoOriginalIso,
          hashSha256Acuse: hashAcuseExistente,
          hashSha256: hashAcuseExistente,
        },
        notificacionActualizada: mapearNotificacion(notif),
      });
    }

    const ahoraIso = new Date().toISOString();
    const hashAcuse = crypto
      .createHash('sha256')
      .update(`${id}:${ahoraIso}:IESTP-SUIZA-ACUSE-LEGAL`)
      .digest('hex');
    const idAcuse = `ACU-${anio}-${id.slice(0, 8).toUpperCase()}`;

    await pool.query(
      `UPDATE sigd_auth.notificacion_casilla
          SET id_acuse = $1,
              acuse_hash_sha256 = $2,
              acuse_sellado_tiempo = COALESCE(acuse_sellado_tiempo, now())
        WHERE id = $3 AND usuario_id = $4 AND id_acuse IS NULL`,
      [idAcuse, hashAcuse, id, identidad.idUsuario],
    );

    const notificacionActualizada = mapearNotificacion({
      ...notif,
      id_acuse: idAcuse,
      acuse_hash_sha256: hashAcuse,
      acuse_sellado_tiempo: ahoraIso,
    });

    res.status(201).json({
      success: true,
      message: 'Acuse digital legal emitido y sellado exitosamente.',
      data: {
        idAcuse,
        idNotificacion: id,
        numeroExpediente: notif.cut,
        timestampGeneracionIso: ahoraIso,
        selladoTiempo: ahoraIso,
        hashSha256Acuse: hashAcuse,
        hashSha256: hashAcuse,
      },
      notificacionActualizada,
    });
  });

  router.get('/casilla/estadisticas', async (req: Request, res: Response) => {
    const identidad = resolverIdentidad(req);
    const usuarioId = identidad.idUsuario;

    const resultado = await pool.query<{ no_leidas: string; total: string }>(
      `SELECT COUNT(*) FILTER (WHERE estado = 'NO_LEIDO')::text AS no_leidas,
              COUNT(*)::text AS total
         FROM sigd_auth.notificacion_casilla
        WHERE usuario_id = $1`,
      [usuarioId],
    );

    const noLeidas = Number(resultado.rows[0]?.no_leidas ?? 0);
    const total = Number(resultado.rows[0]?.total ?? 0);

    res.status(200).json({
      noLeidas,
      noLeidos: noLeidas,
      total,
      leidos: Math.max(0, total - noLeidas),
      notificados: total,
      urgentes: 0,
      ultimosMovimientos: total > 0 ? 1 : 0,
    });
  });

  router.get('/casilla/notificaciones/:id/documento/descargar', async (req: Request, res: Response) => {
    const identidad = resolverIdentidad(req);
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const notifRes = await pool.query<{ id: string }>(
      `SELECT id FROM sigd_auth.notificacion_casilla WHERE id = $1 AND usuario_id = $2`,
      [id, identidad.idUsuario],
    );
    if (notifRes.rows.length === 0) {
      throw new NotFoundError({ detail: `No existe la notificación de casilla con ID: ${id}` });
    }
    res.status(200).json({
      downloadUrl: `/api/v1/storage/download/sigd-resoluciones/rd-${id}.pdf`,
      expiraEnSegundos: 900,
    });
  });

  router.get('/casilla/notificaciones/:id/acuse/descargar', async (req: Request, res: Response) => {
    const identidad = resolverIdentidad(req);
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const notifRes = await pool.query<{ id: string }>(
      `SELECT id FROM sigd_auth.notificacion_casilla WHERE id = $1 AND usuario_id = $2`,
      [id, identidad.idUsuario],
    );
    if (notifRes.rows.length === 0) {
      throw new NotFoundError({ detail: `No existe la notificación de casilla con ID: ${id}` });
    }
    res.status(200).json({
      downloadUrl: `/api/v1/storage/download/sigd-acuses/acuse-${id}.pdf`,
      expiraEnSegundos: 900,
    });
  });

  return router;
}

export default crearRouterCasilla;
