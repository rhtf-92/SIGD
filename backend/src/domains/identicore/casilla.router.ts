/**
 * Endpoints #7 al #13 del catálogo REST — Casilla Electrónica y Acuse Legal (Ley N° 29733)
 * Responsable: B_JAIR (Jair) / Subdominio: IdentiCore (sigd_auth)
 *
 *   #7  GET   /api/v1/casilla/notificaciones                — Bandeja paginada de notificaciones legales
 *   #8  GET   /api/v1/casilla/notificaciones/:id            — Detalle del acto administrativo notificado
 *   #9  PATCH /api/v1/casilla/notificaciones/:id/lectura    — Asiento fehaciente de primera lectura procesal
 *   #10 POST  /api/v1/casilla/notificaciones/:id/acuse      — Generación inmutable de Acuse Notificatorio Digital (SHA-256)
 *   #11 GET   /api/v1/casilla/estadisticas                  — Contadores de notificaciones no leídas y plazos
 *   #12 GET   /api/v1/casilla/notificaciones/:id/documento/descargar — Presigned GET URL para PDF del acto notificado
 *   #13 GET   /api/v1/casilla/notificaciones/:id/acuse/descargar     — Presigned GET URL para certificado de acuse legal
 */

import crypto from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import { extraerTokenBearer, verificarTokenAcceso } from '../../core/auth/jwt.service.js';
import { AppError, ConflictError, ForbiddenError, NotFoundError, UnauthorizedError } from '../../shared/domain/errors/index.js';
import { generarDescargaAutorizada } from '../../core/storage/storage.router.js';
import { cotejarPdfFirmado } from '../docucore/callbackRefirma.service.js';

const fechaFiltroSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((valor) => {
  const fecha = new Date(`${valor}T00:00:00.000Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
}, 'Fecha inválida');

const consultaPaginadaSchema = z
  .object({
    pagina: z.coerce.number().int().positive().optional(),
    page: z.coerce.number().int().positive().optional(),
    porPagina: z.coerce.number().int().min(1).max(100).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
    estado: z.enum(['LEIDO', 'NO_LEIDO', 'NOTIFICADO', 'TODOS']).default('TODOS'),
    tipo: z.enum(['RESOLUCION', 'OFICIO', 'NOTIFICACION_OBSERVACION', 'CITACION', 'CONSTANCIA', 'INFORME', 'OTRO', 'TODOS']).default('TODOS'),
    fechaInicio: fechaFiltroSchema.optional(),
    fechaFin: fechaFiltroSchema.optional(),
    busqueda: z.string().optional(),
  })
  .refine((val) => !val.fechaInicio || !val.fechaFin || val.fechaInicio <= val.fechaFin, {
    message: 'El rango de fechas es inválido',
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

// El acuse persistido determina el estado que presenta la Casilla ciudadana.
const estadoVisibleSql = `CASE WHEN id_acuse IS NOT NULL OR estado = 'NOTIFICADO' THEN 'NOTIFICADO'
  WHEN estado = 'LEIDO' THEN 'LEIDO' ELSE 'NO_LEIDO' END`;

const tipoVisibleSql = `CASE
  WHEN translate(upper(tipo_acto), 'ÁÉÍÓÚÜÑ', 'AEIOUUN') LIKE '%RESOLUCION%' THEN 'RESOLUCION'
  WHEN translate(upper(tipo_acto), 'ÁÉÍÓÚÜÑ', 'AEIOUUN') LIKE '%OFICIO%' THEN 'OFICIO'
  WHEN translate(upper(tipo_acto), 'ÁÉÍÓÚÜÑ', 'AEIOUUN') LIKE '%OBSERVACION%'
    OR translate(upper(tipo_acto), 'ÁÉÍÓÚÜÑ', 'AEIOUUN') LIKE '%SUBSANACION%' THEN 'NOTIFICACION_OBSERVACION'
  WHEN translate(upper(tipo_acto), 'ÁÉÍÓÚÜÑ', 'AEIOUUN') LIKE '%CITACION%' THEN 'CITACION'
  WHEN translate(upper(tipo_acto), 'ÁÉÍÓÚÜÑ', 'AEIOUUN') LIKE '%CONSTANCIA%' THEN 'CONSTANCIA'
  WHEN translate(upper(tipo_acto), 'ÁÉÍÓÚÜÑ', 'AEIOUUN') LIKE '%INFORME%' THEN 'INFORME'
  ELSE 'OTRO' END`;

function clasificarTipoNotificacion(tipoActo: string) {
  const tipo = tipoActo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  if (tipo.includes('RESOLUCION')) return 'RESOLUCION' as const;
  if (tipo.includes('OFICIO')) return 'OFICIO' as const;
  if (tipo.includes('OBSERVACION') || tipo.includes('SUBSANACION')) return 'NOTIFICACION_OBSERVACION' as const;
  if (tipo.includes('CITACION')) return 'CITACION' as const;
  if (tipo.includes('CONSTANCIA')) return 'CONSTANCIA' as const;
  if (tipo.includes('INFORME')) return 'INFORME' as const;
  return 'OTRO' as const;
}

function extraerTextoCuerpo(cuerpo: unknown, campos: string[]): string | null {
  if (typeof cuerpo === 'string') return cuerpo;
  if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) return null;
  for (const campo of campos) {
    const valor = (cuerpo as Record<string, unknown>)[campo];
    if (typeof valor === 'string' && valor.trim()) return valor;
  }
  return null;
}

function mapearNotificacion(fila: FilaNotificacionCasilla) {
  if (!fila.usuario_id) throw new ForbiddenError();
  const fechaDeposito = typeof fila.fecha_deposito === 'string' ? fila.fecha_deposito : fila.fecha_deposito.toISOString();
  const anio = new Date(fechaDeposito).getFullYear();
  const fechaLectura = fila.fecha_lectura
    ? typeof fila.fecha_lectura === 'string'
      ? fila.fecha_lectura
      : fila.fecha_lectura.toISOString()
    : null;
  const fechaAcuse = fila.acuse_sellado_tiempo
    ? typeof fila.acuse_sellado_tiempo === 'string'
      ? fila.acuse_sellado_tiempo
      : fila.acuse_sellado_tiempo.toISOString()
    : null;
  const cuerpoTexto = extraerTextoCuerpo(fila.cuerpo, ['textoCompleto', 'contenido', 'texto', 'resumenLegal', 'resumen']);

  return {
    id: fila.id,
    numeroNotificacion: fila.id,
    numeroExpediente: fila.cut,
    usuarioId: fila.usuario_id,
    cut: fila.cut,
    asunto: fila.asunto,
    tipo: clasificarTipoNotificacion(fila.tipo_acto),
    tipoActo: fila.tipo_acto,
    prioridad: null,
    unidadEmisora: null,
    numeroDocumento: fila.numero_documento,
    estado: fila.id_acuse || fila.estado === 'NOTIFICADO' ? ('NOTIFICADO' as const)
      : fila.estado === 'LEIDO' ? ('LEIDO' as const) : ('NO_LEIDO' as const),
    fechaDeposito,
    fechaDepositoIso: fechaDeposito,
    fechaLectura,
    fechaLecturaIso: fechaLectura,
    fechaNotificadoIso: fila.id_acuse ? fechaAcuse : null,
    requiereAcuse: true,
    documentoUrl: fila.documento_url,
    hashSha256: fila.hash_sha256,
    cvd: fila.cvd,
    idAcuse: fila.id_acuse,
    acuseHashSha256: fila.acuse_hash_sha256,
    acuseSelladoTiempo: fila.acuse_sellado_tiempo
      ? typeof fila.acuse_sellado_tiempo === 'string'
        ? fila.acuse_sellado_tiempo
        : fila.acuse_sellado_tiempo.toISOString()
      : null,
    actoAdministrativo: {
      tipoActo: fila.tipo_acto,
      numeroDocumento: fila.numero_documento,
      anio,
      asunto: fila.asunto,
      resumenLegal: extraerTextoCuerpo(fila.cuerpo, ['resumenLegal', 'resumen', 'contenido', 'texto']),
      textoCompleto: cuerpoTexto,
      nombreArchivoPdf: null,
      tamanoArchivo: null,
      urlDescargaPdf: null,
      hashIntegridadSha256: fila.hash_sha256,
      cvd: fila.cvd,
      firmantes: [],
    },
    acuse: fila.id_acuse
      ? {
          idAcuse: fila.id_acuse,
          idNotificacion: fila.id,
          numeroExpediente: fila.cut,
          documentoUrl: null,
          destinatario: {
            nombresCompletos: null,
            numeroDocumento: null,
            tipoDocumento: null,
            direccionCasilla: fila.correo_destinatario,
          },
          timestampGeneracionIso: fechaAcuse,
          hashSha256Acuse: fila.acuse_hash_sha256,
          cvdAcuse: null,
          entidadEmisora: null,
          unidadEmisora: null,
          fechaEfectoLegal: null,
          plazoImpugnacionDiasHabiles: null,
          validezLegalMensaje: null,
        }
      : null,
  };
}

export function crearRouterCasilla(pool: Pool): Router {
  const router = Router();

  function obtenerUsuarioId(req: Request): string {
    const token = extraerTokenBearer(req.get('authorization'));
    if (!token) {
      throw new UnauthorizedError();
    }
    const claims = verificarTokenAcceso(token);
    if (!z.string().uuid().safeParse(claims.sub).success) {
      throw new UnauthorizedError();
    }
    return claims.sub;
  }

  // Todas las rutas y alias requieren JWT válido y cuenta activa, como Storage.
  router.use('/casilla', async (req, _res, next) => {
    const usuarioId = obtenerUsuarioId(req);
    const cuenta = await pool.query<{ id_usuario: string }>(
      'SELECT id_usuario FROM sigd_auth.cuenta_usuario WHERE id_usuario = $1::uuid AND activo = TRUE',
      [usuarioId],
    );
    if (cuenta.rows.length !== 1) throw new ForbiddenError();
    next();
  });

  async function obtenerNotificacionAutorizada(req: Request, id: string): Promise<FilaNotificacionCasilla> {
    const usuarioId = obtenerUsuarioId(req);
    const resultado = await pool.query<FilaNotificacionCasilla>(
      'SELECT * FROM sigd_auth.notificacion_casilla WHERE id = $1',
      [id],
    );
    const notificacion = resultado.rows[0];
    if (!notificacion) throw new NotFoundError();
    // NULL no acredita propiedad ni una política de acceso compartido.
    if (notificacion.usuario_id !== usuarioId) throw new ForbiddenError();
    return notificacion;
  }

  // #7 — GET /casilla/notificaciones y alias /casilla/bandeja
  const handlerBandeja = async (req: Request, res: Response) => {
    const query = consultaPaginadaSchema.parse(req.query);
    const usuarioId = obtenerUsuarioId(req);

    const condiciones: string[] = ['usuario_id = $1'];
    const valores: unknown[] = [usuarioId];

    if (query.estado !== 'TODOS') {
      valores.push(query.estado);
      condiciones.push(`(${estadoVisibleSql}) = $${valores.length}`);
    }

    if (query.tipo !== 'TODOS') {
      valores.push(query.tipo);
      condiciones.push(`(${tipoVisibleSql}) = $${valores.length}`);
    }

    if (query.fechaInicio) {
      valores.push(query.fechaInicio);
      condiciones.push(`fecha_deposito >= $${valores.length}::date`);
    }

    if (query.fechaFin) {
      valores.push(query.fechaFin);
      condiciones.push(`fecha_deposito < ($${valores.length}::date + INTERVAL '1 day')`);
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

    const notificacion = await obtenerNotificacionAutorizada(req, id);
    res.status(200).json(mapearNotificacion(notificacion));
  });

  // #9 — PATCH /casilla/notificaciones/:id/lectura
  router.patch('/casilla/notificaciones/:id/lectura', async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const notificacion = await obtenerNotificacionAutorizada(req, id);

    if (process.env.SIGD_SAFE_BOOT === 'true' || process.env.SIGD_READ_ONLY === 'true') {
      return res.status(200).json({
        idNotificacion: notificacion.id,
        estado: notificacion.estado,
        leidoEn: notificacion.fecha_lectura
          ? (typeof notificacion.fecha_lectura === 'string'
              ? notificacion.fecha_lectura
              : notificacion.fecha_lectura.toISOString())
          : new Date().toISOString(),
      });
    }

    const resultado = await pool.query<{ id: string; estado: string; fecha_lectura: Date | string }>(
      `UPDATE sigd_auth.notificacion_casilla
          SET estado = 'LEIDO',
              fecha_lectura = COALESCE(fecha_lectura, now())
        WHERE id = $1 AND usuario_id = $2::uuid
        RETURNING id, estado, fecha_lectura`,
      [id, notificacion.usuario_id],
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

  // #10 — POST /casilla/notificaciones/:id/acuse
  router.post('/casilla/notificaciones/:id/acuse', async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const notif = await obtenerNotificacionAutorizada(req, id);
    if (req.body?.confirmacionAdministrado !== true) {
      throw new AppError({ status: 400, code: 'ACK_CONFIRMATION_REQUIRED', message: 'Confirme la recepción para registrar el acuse.' });
    }

    // Los tres campos existentes permiten recuperar el asiento de recepción.
    // Los metadatos que no existen en el modelo (CVD, firmantes o PDF) no se inventan.
    if (notif.id_acuse) {
      const selladoOriginalIso = notif.acuse_sellado_tiempo
        ? (typeof notif.acuse_sellado_tiempo === 'string'
            ? notif.acuse_sellado_tiempo
            : notif.acuse_sellado_tiempo.toISOString())
        : null;

      return res.status(200).json({
        success: true,
        message: 'Registro de acuse existente recuperado.',
        data: {
          idAcuse: notif.id_acuse,
          idNotificacion: id,
          numeroExpediente: notif.cut,
          documentoUrl: null,
          destinatario: {
            nombresCompletos: null,
            numeroDocumento: null,
            tipoDocumento: null,
            direccionCasilla: notif.correo_destinatario,
          },
          timestampGeneracionIso: selladoOriginalIso,
          hashSha256Acuse: notif.acuse_hash_sha256,
          cvdAcuse: null,
          entidadEmisora: null,
          unidadEmisora: null,
          fechaEfectoLegal: null,
          plazoImpugnacionDiasHabiles: null,
          validezLegalMensaje: null,
        },
        notificacionActualizada: mapearNotificacion(notif),
      });
    }

    // Registrar la confirmación en los campos que define el esquema existente.
    const ahoraIso = new Date().toISOString();
    const contenidoAcuse = JSON.stringify({
      notificacionId: id,
      usuarioId: notif.usuario_id,
      cut: notif.cut,
      confirmadaEn: ahoraIso,
    });
    const hashAcuse = crypto
      .createHash('sha256')
      .update(contenidoAcuse)
      .digest('hex');
    const idAcuse = `ACU-${new Date(ahoraIso).getUTCFullYear()}-${id.slice(0, 8).toUpperCase()}`;

    if (process.env.SIGD_SAFE_BOOT === 'true' || process.env.SIGD_READ_ONLY === 'true') {
      throw new AppError({
        status: 503,
        code: 'ACUSE_PERSISTENCIA_DESHABILITADA',
        message: 'El entorno opera en modo seguro / base de datos inmutable. No se permite la emisión persistente de nuevos acuses en PostgreSQL.',
      });
    }

    const emision = await pool.query<{ acuse_sellado_tiempo: Date | string }>(
      `UPDATE sigd_auth.notificacion_casilla
          SET id_acuse = $1,
              acuse_hash_sha256 = $2,
              acuse_sellado_tiempo = $3::timestamptz
        WHERE id = $4 AND usuario_id = $5::uuid AND id_acuse IS NULL
        RETURNING acuse_sellado_tiempo`,
      [idAcuse, hashAcuse, ahoraIso, id, notif.usuario_id],
    );
    if (emision.rowCount !== 1) {
      throw new ConflictError({ message: 'La notificación cambió durante el registro del acuse. Vuelva a consultarla.' });
    }
    const selladoEn = typeof emision.rows[0].acuse_sellado_tiempo === 'string'
      ? emision.rows[0].acuse_sellado_tiempo
      : emision.rows[0].acuse_sellado_tiempo.toISOString();

    const notificacionActualizada = mapearNotificacion({
      ...notif,
      id_acuse: idAcuse,
      acuse_hash_sha256: hashAcuse,
      acuse_sellado_tiempo: selladoEn,
    });

    res.status(201).json({
      success: true,
      message: 'La confirmación de recepción quedó registrada.',
      data: {
        idAcuse,
        idNotificacion: id,
        numeroExpediente: notif.cut,
        documentoUrl: null,
        destinatario: {
          nombresCompletos: null,
          numeroDocumento: null,
          tipoDocumento: null,
          direccionCasilla: notif.correo_destinatario,
        },
        timestampGeneracionIso: selladoEn,
        hashSha256Acuse: hashAcuse,
        cvdAcuse: null,
        entidadEmisora: null,
        unidadEmisora: null,
        fechaEfectoLegal: null,
        plazoImpugnacionDiasHabiles: null,
        validezLegalMensaje: null,
      },
      notificacionActualizada,
    });
  });

  // #11 — GET /casilla/estadisticas
  router.get('/casilla/estadisticas', async (req: Request, res: Response) => {
    const usuarioId = obtenerUsuarioId(req);

    const resultado = await pool.query<{ no_leidas: string; leidas: string; notificadas: string; total: string }>(
      `SELECT COUNT(*) FILTER (WHERE (${estadoVisibleSql}) = 'NO_LEIDO')::text AS no_leidas,
              COUNT(*) FILTER (WHERE (${estadoVisibleSql}) = 'LEIDO')::text AS leidas,
              COUNT(*) FILTER (WHERE (${estadoVisibleSql}) = 'NOTIFICADO')::text AS notificadas,
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
    const notificacion = await obtenerNotificacionAutorizada(req, id);
    const referencia = notificacion.documento_url;
    const documentoId = typeof referencia === 'string'
      ? /^\/api\/v1\/storage\/documentos\/([0-9a-f-]{36})\/download$/i.exec(referencia)?.[1]
      : undefined;
    if (documentoId) {
      if (!z.string().uuid().safeParse(documentoId).success) throw new ForbiddenError();
      const cuerpo = notificacion.cuerpo && typeof notificacion.cuerpo === 'object'
        ? notificacion.cuerpo as Record<string, unknown> : {};
      const esResolucion = cuerpo.tipo_acto === 'resolucion_emitida' || /resoluci/i.test(notificacion.tipo_acto);
      const documento = await pool.query<{ s3_bucket: string; s3_key: string; sha256_firmado: string | null }>(
        `SELECT CASE WHEN $3 THEN f.s3_bucket ELSE a.s3_bucket END AS s3_bucket,
                CASE WHEN $3 THEN f.s3_key ELSE a.s3_key END AS s3_key,
                f.sha256_firmado
           FROM sigd_doc.documento_adjunto a
           JOIN sigd_doc.expediente e ON e.expediente_id = a.expediente_id
           LEFT JOIN sigd_doc.firma_digital_documento f
             ON f.documento_id = a.documento_adjunto_id
            AND f.estado = 'FIRMADO_DIGITALMENTE' AND f.cvd = $4
          WHERE a.documento_adjunto_id = $1::uuid AND e.codigo_expediente = $2`,
        [documentoId, notificacion.cut, esResolucion, typeof cuerpo.cvd === 'string' ? cuerpo.cvd : null],
      );
      const fila = documento.rows[0];
      if (documento.rows.length !== 1 || !fila?.s3_bucket || !fila.s3_key) {
        throw new AppError({ status: 503, code: 'STORAGE_REFERENCE_UNAVAILABLE', message: 'No se pudo acreditar el documento del acto notificado.' });
      }
      // Una resolución notificada entrega el artefacto firmado, nunca su borrador.
      if (esResolucion) {
        if (!fila.sha256_firmado) throw new ForbiddenError();
        await cotejarPdfFirmado({ ...fila, sha256_firmado: fila.sha256_firmado });
      }
      return res.status(200).json({
        downloadUrl: generarDescargaAutorizada(fila.s3_bucket, fila.s3_key, req),
        expiraEnSegundos: 900,
      });
    }
    let disponible = typeof referencia === 'string' && referencia.startsWith('/api/v1/storage/download/');
    if (referencia && !disponible) {
      try {
        const url = new URL(referencia);
        disponible = ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
      } catch {
        disponible = false;
      }
    }
    if (!disponible) throw new AppError({
      status: 503, code: 'STORAGE_REFERENCE_UNAVAILABLE',
      message: 'La notificación no tiene una referencia de documento disponible.',
    });
    res.status(200).json({
      downloadUrl: referencia,
      expiraEnSegundos: 900,
    });
  });

  // #13 — GET /casilla/notificaciones/:id/acuse/descargar
  router.get('/casilla/notificaciones/:id/acuse/descargar', async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const notificacion = await obtenerNotificacionAutorizada(req, id);
    if (!notificacion.id_acuse) {
      throw new AppError({ status: 409, code: 'ACK_NOT_REGISTERED', message: 'La confirmación de recepción aún no está registrada.' });
    }
    // El modelo actual no guarda una referencia al PDF del acuse. No se deriva
    // una clave S3 a partir del ID porque eso no acredita que el objeto exista.
    throw new AppError({
      status: 503,
      code: 'ACK_DOCUMENT_REFERENCE_UNAVAILABLE',
      message: 'El registro de recepción existe, pero no tiene un documento asociado para descargar.',
    });
  });

  return router;
}

export default crearRouterCasilla;
