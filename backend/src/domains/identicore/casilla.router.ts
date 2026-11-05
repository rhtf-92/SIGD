/**
 * Endpoints #7 al #13 del catálogo REST — Casilla Electrónica y registro de acuses
 * Responsable: B_JAIR (Jair) / Subdominio: IdentiCore (sigd_auth)
 *
 *   #7  GET   /api/v1/casilla/notificaciones                — Bandeja paginada de notificaciones legales
 *   #8  GET   /api/v1/casilla/notificaciones/:id            — Detalle del acto administrativo notificado
 *   #9  PATCH /api/v1/casilla/notificaciones/:id/lectura    — Registro de primera lectura
 *   #10 POST  /api/v1/casilla/notificaciones/:id/acuse      — Registro idempotente de acuse (SHA-256)
 *   #11 GET   /api/v1/casilla/estadisticas                  — Contadores de notificaciones no leídas y plazos
 *   #12 GET   /api/v1/casilla/notificaciones/:id/documento/descargar — Presigned GET URL para PDF del acto notificado
 *   #13 GET   /api/v1/casilla/notificaciones/:id/acuse/descargar     — PDF generado desde los datos registrados del acuse
 */

import crypto from 'node:crypto';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { Router, type Request, type Response } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import { extraerTokenBearer } from '../../core/auth/jwt.service.js';
import { verificarSesionActiva } from '../../core/auth/sesion-activa.js';
import { NotFoundError, UnauthorizedError } from '../../shared/domain/errors/index.js';

const prefijosTipo = {
  RESOLUCION: ['RESOLUCION%', 'RESOLUCIÓN%'],
  OFICIO: ['OFICIO%'],
  NOTIFICACION_OBSERVACION: ['NOTIFICACION DE OBSERVACION%', 'NOTIFICACIÓN DE OBSERVACIÓN%', 'NOTIFICACION_OBSERVACION%', 'NOTIFICACIÓN_OBSERVACIÓN%'],
  CITACION: ['CITACION%', 'CITACIÓN%'],
  CONSTANCIA: ['CONSTANCIA%'],
  INFORME: ['INFORME%'],
} as const;

const fechaConsulta = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((valor) => {
  const fecha = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
});

const consultaPaginadaSchema = z
  .object({
    pagina: z.coerce.number().int().positive().optional(),
    page: z.coerce.number().int().positive().optional(),
    porPagina: z.coerce.number().int().min(1).max(100).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    estado: z.enum(['LEIDO', 'NO_LEIDO', 'NOTIFICADO', 'TODOS']).default('TODOS'),
    tipo: z.enum(['RESOLUCION', 'OFICIO', 'NOTIFICACION_OBSERVACION', 'CITACION', 'CONSTANCIA', 'INFORME', 'OTRO']).optional(),
    fechaInicio: fechaConsulta.optional(),
    fechaFin: fechaConsulta.optional(),
    busqueda: z.string().optional(),
  })
  .transform((val) => ({
    pagina: val.pagina ?? val.page ?? 1,
    porPagina: val.porPagina ?? val.limit ?? 10,
    estado: val.estado,
    tipo: val.tipo,
    fechaInicio: val.fechaInicio,
    fechaFin: val.fechaFin,
    busqueda: val.busqueda,
  }));

interface FilaNotificacionCasilla {
  id: string;
  usuario_id: string;
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
  const anio = new Date(fila.fecha_deposito).getUTCFullYear();
  const cut = fila.cut ?? 'No registrado';
  const numeroDocumento = fila.numero_documento ?? 'No registrado';
  const fechaDeposito = typeof fila.fecha_deposito === 'string' ? fila.fecha_deposito : fila.fecha_deposito.toISOString();
  const fechaLectura = fila.fecha_lectura
    ? typeof fila.fecha_lectura === 'string'
      ? fila.fecha_lectura
      : fila.fecha_lectura.toISOString()
    : null;
  const hashSha256 = fila.hash_sha256 ?? '';
  const cvd = fila.cvd ?? '';

  return {
    id: fila.id,
    numeroNotificacion: fila.id,
    numeroExpediente: cut,
    usuarioId: fila.usuario_id,
    cut,
    asunto: fila.asunto,
    tipo: Object.keys(prefijosTipo).find((tipo) =>
      fila.tipo_acto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replaceAll('_', ' ').toUpperCase()
        .startsWith(tipo === 'NOTIFICACION_OBSERVACION' ? 'NOTIFICACION DE OBSERVACION' : tipo)
    ) ?? 'OTRO',
    tipoActo: fila.tipo_acto,
    prioridad: 'NORMAL' as const,
    unidadEmisora: 'No registrada',
    numeroDocumento,
    estado: fila.id_acuse ? ('NOTIFICADO' as const) : fila.estado === 'LEIDO' ? ('LEIDO' as const) : ('NO_LEIDO' as const),
    fechaDeposito,
    fechaDepositoIso: fechaDeposito,
    fechaLectura,
    fechaLecturaIso: fechaLectura,
    fechaNotificadoIso: fila.id_acuse
      ? typeof fila.acuse_sellado_tiempo === 'string'
        ? fila.acuse_sellado_tiempo
        : fila.acuse_sellado_tiempo?.toISOString() ?? null
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
      anio,
      asunto: fila.asunto,
      resumenLegal: typeof fila.cuerpo === 'string' ? fila.cuerpo : fila.asunto,
      nombreArchivoPdf: fila.documento_url?.split('/').at(-1) ?? 'No registrado',
      tamanoArchivo: 'No registrado',
      hashIntegridadSha256: hashSha256,
      cvd,
      firmantes: [],
    },
    acuse: fila.id_acuse
      ? {
          idAcuse: fila.id_acuse,
          idNotificacion: fila.id,
          numeroExpediente: cut,
          destinatario: {
            nombresCompletos: 'No registrado',
            numeroDocumento: 'No registrado',
            tipoDocumento: 'NO_REGISTRADO' as const,
            direccionCasilla: fila.correo_destinatario ?? 'No registrada',
          },
          timestampGeneracionIso:
            typeof fila.acuse_sellado_tiempo === 'string'
              ? fila.acuse_sellado_tiempo
              : fila.acuse_sellado_tiempo?.toISOString() ?? '',
          hashSha256Acuse: fila.acuse_hash_sha256 ?? '',
          cvdAcuse: '',
          entidadEmisora: 'IESTP Suiza',
          unidadEmisora: 'No registrada',
          fechaEfectoLegal: 'No registrada',
          plazoImpugnacionDiasHabiles: null,
          validezLegalMensaje: 'Los efectos y plazos deben verificarse en el acto administrativo.',
        }
      : null,
  };
}

function responderAcuse(res: Response, fila: FilaNotificacionCasilla, nuevo: boolean): void {
  const notificacionActualizada = mapearNotificacion(fila);
  const acuse = notificacionActualizada.acuse;
  if (!acuse) throw new NotFoundError({ detail: 'El acuse no quedó registrado.' });
  res.status(nuevo ? 201 : 200).json({
    success: true,
    message: nuevo ? 'Acuse registrado.' : 'Acuse existente recuperado sin mutación.',
    data: {
      ...acuse,
      selladoTiempo: acuse.timestampGeneracionIso,
      hashSha256: acuse.hashSha256Acuse,
      mensajeLegal: acuse.validezLegalMensaje,
    },
    notificacionActualizada,
  });
}

export function crearRouterCasilla(pool: Pool): Router {
  const router = Router();

  router.use('/casilla', async (req: Request, res: Response, next) => {
    try {
      const token = extraerTokenBearer(req.get('authorization'));
      if (!token) throw new UnauthorizedError({ detail: 'Token de acceso no proporcionado.' });
      res.locals.usuarioCasillaId = (await verificarSesionActiva(pool, token)).sub;
      next();
    } catch (error) {
      next(error);
    }
  });

  function obtenerUsuarioId(res: Response): string {
    const usuarioId = res.locals.usuarioCasillaId;
    if (typeof usuarioId !== 'string' || usuarioId.length === 0) {
      throw new UnauthorizedError({ detail: 'Autenticación requerida.' });
    }
    return usuarioId;
  }

  // #7 — GET /casilla/notificaciones y alias /casilla/bandeja
  const handlerBandeja = async (req: Request, res: Response) => {
    const query = consultaPaginadaSchema.parse(req.query);
    const usuarioId = obtenerUsuarioId(res);

    const condiciones: string[] = ['usuario_id = $1'];
    const valores: unknown[] = [usuarioId];

    if (query.estado !== 'TODOS') {
      if (query.estado === 'NOTIFICADO') condiciones.push('id_acuse IS NOT NULL');
      else {
        valores.push(query.estado);
        condiciones.push(`estado = $${valores.length} AND id_acuse IS NULL`);
      }
    }

    if (query.tipo) {
      const patrones = Object.values(prefijosTipo).flat();
      valores.push(query.tipo === 'OTRO' ? patrones : prefijosTipo[query.tipo as keyof typeof prefijosTipo]);
      condiciones.push(`${query.tipo === 'OTRO' ? 'NOT ' : ''}(tipo_acto ILIKE ANY($${valores.length}::text[]))`);
    }
    if (query.fechaInicio) {
      valores.push(query.fechaInicio);
      condiciones.push(`fecha_deposito >= $${valores.length}::date`);
    }
    if (query.fechaFin) {
      valores.push(query.fechaFin);
      condiciones.push(`fecha_deposito < ($${valores.length}::date + interval '1 day')`);
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
        total,
        pagina: query.pagina,
        porPagina: query.porPagina,
        totalPaginas,
      },
    });
  };

  router.get('/casilla/notificaciones', handlerBandeja);
  router.get('/casilla/bandeja', handlerBandeja);

  // #8 — GET /casilla/notificaciones/:id
  router.get('/casilla/notificaciones/:id', async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const usuarioId = obtenerUsuarioId(res);

    const resultado = await pool.query<FilaNotificacionCasilla>(
      `SELECT * FROM sigd_auth.notificacion_casilla WHERE id = $1 AND usuario_id = $2`,
      [id, usuarioId],
    );

    if (resultado.rows.length === 0) {
      throw new NotFoundError({
        detail: `No existe la notificación de casilla con ID: ${id}`,
      });
    }

    res.status(200).json(mapearNotificacion(resultado.rows[0]));
  });

  // #9 — PATCH /casilla/notificaciones/:id/lectura
  router.patch('/casilla/notificaciones/:id/lectura', async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const usuarioId = obtenerUsuarioId(res);

    const resultado = await pool.query<FilaNotificacionCasilla>(
      `UPDATE sigd_auth.notificacion_casilla
          SET estado = CASE WHEN id_acuse IS NULL THEN 'LEIDO' ELSE estado END,
              fecha_lectura = COALESCE(fecha_lectura, now())
        WHERE id = $1 AND usuario_id = $2
        RETURNING *`,
      [id, usuarioId],
    );

    if (resultado.rows.length === 0) {
      throw new NotFoundError({
        detail: `No existe la notificación de casilla para marcar lectura: ${id}`,
      });
    }

    const row = resultado.rows[0];
    if (!row.fecha_lectura) throw new Error('La lectura no quedó registrada.');
    const leidoEnIso = typeof row.fecha_lectura === 'string'
      ? row.fecha_lectura
      : row.fecha_lectura.toISOString();

    res.status(200).json({
      ...mapearNotificacion(row),
      idNotificacion: row.id,
      leidoEn: leidoEnIso,
    });
  });

  // #10 — POST /casilla/notificaciones/:id/acuse
  router.post('/casilla/notificaciones/:id/acuse', async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const usuarioId = obtenerUsuarioId(res);

    const notifRes = await pool.query<FilaNotificacionCasilla>(
      `SELECT * FROM sigd_auth.notificacion_casilla WHERE id = $1 AND usuario_id = $2`,
      [id, usuarioId],
    );

    if (notifRes.rows.length === 0) {
      throw new NotFoundError({
        detail: `No existe la notificación de casilla para emitir acuse: ${id}`,
      });
    }

    const notif = notifRes.rows[0];
    const anio = new Date().getFullYear();

    if (notif.id_acuse) return responderAcuse(res, notif, false);

    // Primera emisión: generación y sellado de tiempo inicial
    const ahoraIso = new Date().toISOString();
    const hashAcuse = crypto
      .createHash('sha256')
      .update(`${id}:${ahoraIso}:IESTP-SUIZA-ACUSE-LEGAL`)
      .digest('hex');
    const idAcuse = `ACU-${anio}-${id}`;
    const actualizado = await pool.query<FilaNotificacionCasilla>(
      `UPDATE sigd_auth.notificacion_casilla
          SET id_acuse = $1,
              acuse_hash_sha256 = $2,
              acuse_sellado_tiempo = $3::timestamptz
        WHERE id = $4 AND usuario_id = $5 AND id_acuse IS NULL
        RETURNING *`,
      [idAcuse, hashAcuse, ahoraIso, id, usuarioId],
    );
    if (actualizado.rows[0]) return responderAcuse(res, actualizado.rows[0], true);
    const existente = await pool.query<FilaNotificacionCasilla>(
      `SELECT * FROM sigd_auth.notificacion_casilla WHERE id = $1 AND usuario_id = $2`,
      [id, usuarioId],
    );
    if (!existente.rows[0]?.id_acuse) throw new NotFoundError();
    responderAcuse(res, existente.rows[0], false);
  });

  // #11 — GET /casilla/estadisticas
  router.get('/casilla/estadisticas', async (req: Request, res: Response) => {
    const usuarioId = obtenerUsuarioId(res);

    const resultado = await pool.query<{ no_leidas: string; leidas: string; notificadas: string; total: string }>(
      `SELECT COUNT(*) FILTER (WHERE estado = 'NO_LEIDO' AND id_acuse IS NULL)::text AS no_leidas,
              COUNT(*) FILTER (WHERE estado = 'LEIDO' AND id_acuse IS NULL)::text AS leidas,
              COUNT(*) FILTER (WHERE id_acuse IS NOT NULL)::text AS notificadas,
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
      leidos: Number(resultado.rows[0]?.leidas ?? 0),
      notificados: Number(resultado.rows[0]?.notificadas ?? 0),
      urgentes: 0,
      ultimosMovimientos: total > 0 ? 1 : 0,
    });
  });

  // #12 — GET /casilla/notificaciones/:id/documento/descargar
  router.get('/casilla/notificaciones/:id/documento/descargar', async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const usuarioId = obtenerUsuarioId(res);
    const resultado = await pool.query<{ documento_url: string | null }>(
      `SELECT documento_url FROM sigd_auth.notificacion_casilla WHERE id = $1 AND usuario_id = $2`,
      [id, usuarioId],
    );
    const referencia = resultado.rows[0]?.documento_url;
    const recurso = typeof referencia === 'string' ? /^s3:\/\/([a-zA-Z0-9._-]+)\/(.+)$/.exec(referencia) : null;
    if (!recurso || recurso[2].split('/').some((segmento) => segmento === '.' || segmento === '..' || segmento === '')) {
      throw new NotFoundError();
    }
    const bucket = encodeURIComponent(recurso[1]);
    const key = recurso[2].split('/').map(encodeURIComponent).join('/');
    res.status(200).json({
      downloadUrl: `/api/v1/storage/download/${bucket}/${key}`,
      expiraEnSegundos: 900,
    });
  });

  // #13 — GET /casilla/notificaciones/:id/acuse/descargar
  router.get('/casilla/notificaciones/:id/acuse/descargar', async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const usuarioId = obtenerUsuarioId(res);
    const resultado = await pool.query<Pick<FilaNotificacionCasilla, 'id_acuse' | 'acuse_hash_sha256' | 'acuse_sellado_tiempo'>>(
      `SELECT id_acuse, acuse_hash_sha256, acuse_sellado_tiempo
         FROM sigd_auth.notificacion_casilla
        WHERE id = $1 AND usuario_id = $2`,
      [id, usuarioId],
    );
    const acuse = resultado.rows[0];
    if (!acuse?.id_acuse) throw new NotFoundError();

    const pdf = await PDFDocument.create();
    const page = pdf.addPage();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fecha = acuse.acuse_sellado_tiempo
      ? typeof acuse.acuse_sellado_tiempo === 'string'
        ? acuse.acuse_sellado_tiempo
        : acuse.acuse_sellado_tiempo.toISOString()
      : 'Fecha no registrada';
    page.drawText('Acuse de notificación electrónica', { x: 48, y: 740, size: 18, font });
    page.drawText(`Notificación: ${id}`, { x: 48, y: 700, size: 12, font });
    page.drawText(`Acuse: ${acuse.id_acuse}`, { x: 48, y: 680, size: 12, font });
    page.drawText(`Fecha de emisión: ${fecha}`, { x: 48, y: 660, size: 12, font });
    page.drawText(`SHA-256: ${acuse.acuse_hash_sha256 ?? 'No registrado'}`, { x: 48, y: 640, size: 9, font });
    const bytes = Buffer.from(await pdf.save());
    res.status(200).set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="acuse-${encodeURIComponent(id)}.pdf"`,
      'Cache-Control': 'no-store, private',
    }).send(bytes);
  });

  return router;
}

export default crearRouterCasilla;
