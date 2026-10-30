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
import { NotFoundError, UnauthorizedError } from '../../shared/domain/errors/index.js';
import { obtenerConfiguracionS3 } from '../../config/s3.config.js';
import { generarUrlPresigned } from '../../core/storage/s3-storage.service.js';

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

interface DestinatarioCasilla {
  nombresCompletos: string;
  numeroDocumento: string;
  tipoDocumento: 'DNI' | 'CE' | 'RUC';
  direccionCasilla: string;
}

function mapearNotificacion(fila: FilaNotificacionCasilla, destinatario?: DestinatarioCasilla) {
  const anio = new Date().getFullYear();
  const cut = fila.cut ?? '';
  const numeroDocumento = fila.numero_documento ?? '';
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
    numeroNotificacion: `NOT-${anio}-${fila.id.slice(0, 6).toUpperCase()}`,
    numeroExpediente: cut,
    usuarioId: fila.usuario_id,
    cut,
    asunto: fila.asunto,
    tipo: 'RESOLUCION' as const,
    tipoActo: fila.tipo_acto,
    prioridad: 'NORMAL' as const,
    unidadEmisora: 'No registrada',
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
      anio,
      asunto: fila.asunto,
      resumenLegal: typeof fila.cuerpo === 'string' ? fila.cuerpo : fila.asunto,
      nombreArchivoPdf: 'acto_notificado.pdf',
      tamanoArchivo: 'No registrado',
      hashIntegridadSha256: hashSha256,
      cvd,
      firmantes: [],
    },
    acuse: fila.id_acuse && destinatario
      ? {
          idAcuse: fila.id_acuse,
          idNotificacion: fila.id,
          numeroExpediente: cut,
          destinatario,
          timestampGeneracionIso:
            typeof fila.acuse_sellado_tiempo === 'string'
              ? fila.acuse_sellado_tiempo
              : fila.acuse_sellado_tiempo?.toISOString() ?? fechaDeposito,
          hashSha256Acuse: fila.acuse_hash_sha256 ?? hashSha256,
          cvdAcuse: `CVD-${anio}-ACU-${fila.id.slice(0, 6).toUpperCase()}-7B12`,
          entidadEmisora: 'IESTP Suiza',
          unidadEmisora: 'Secretaría Académica',
          fechaEfectoLegal: fechaDeposito,
          plazoImpugnacionDiasHabiles: 15,
          validezLegalMensaje:
            'Acuse Notificatorio Digital emitido conforme al Art. 20 del TUO de la Ley N° 27444 y Ley N° 29733.',
        }
      : null,
  };
}

export function crearRouterCasilla(pool: Pool): Router {
  const router = Router();

  async function obtenerDestinatario(usuarioId: string): Promise<DestinatarioCasilla> {
    const resultado = await pool.query<{
      nombre_completo: string; id_documento: string; tipo: string;
    }>(`
      SELECT COALESCE(pn.nombre_completo, pj.razon_social) AS nombre_completo,
             p.id_documento, p.tipo
        FROM sigd_auth.cuenta_usuario c
        JOIN sigd_auth.persona p ON p.id_persona = c.id_persona
        LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = p.id_persona
        LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = p.id_persona
       WHERE c.id_usuario = $1::uuid`, [usuarioId]);
    const persona = resultado.rows[0];
    if (!persona) throw new UnauthorizedError({ detail: 'La cuenta no tiene una persona asociada.' });
    return {
      nombresCompletos: persona.nombre_completo,
      numeroDocumento: persona.id_documento,
      tipoDocumento: persona.tipo === 'JURIDICA' ? 'RUC' : /^\d{8}$/.test(persona.id_documento) ? 'DNI' : 'CE',
      // El esquema actual no almacena una dirección de casilla propia.
      direccionCasilla: '',
    };
  }

  function obtenerUsuarioId(req: Request): string {
    const token = extraerTokenBearer(req.get('authorization'));
    if (!token) throw new UnauthorizedError({ detail: 'Se requiere una sesión válida para consultar la Casilla.' });
    const usuarioId = verificarTokenAcceso(token).sub;
    if (!z.uuid().safeParse(usuarioId).success) {
      throw new UnauthorizedError({ detail: 'La sesión no identifica una cuenta válida.' });
    }
    return usuarioId;
  }

  router.use('/casilla', (req, _res, next) => {
    try { obtenerUsuarioId(req); next(); } catch (error) { next(error); }
  });

  // #7 — GET /casilla/notificaciones y alias /casilla/bandeja
  const handlerBandeja = async (req: Request, res: Response) => {
    const query = consultaPaginadaSchema.parse(req.query);
    const usuarioId = obtenerUsuarioId(req);

    const condiciones: string[] = ['usuario_id = $1::uuid'];
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

    const destinatario = itemsRes.rows.length ? await obtenerDestinatario(usuarioId) : undefined;
    const notificaciones = itemsRes.rows.map((fila) => mapearNotificacion(fila, destinatario));
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
    const usuarioId = obtenerUsuarioId(req);

    const resultado = await pool.query<FilaNotificacionCasilla>(
      `SELECT * FROM sigd_auth.notificacion_casilla WHERE id = $1::uuid AND usuario_id = $2::uuid`,
      [id, usuarioId],
    );

    if (resultado.rows.length === 0) {
      throw new NotFoundError({
        detail: `No existe la notificación de casilla con ID: ${id}`,
      });
    }

    res.status(200).json(mapearNotificacion(resultado.rows[0], await obtenerDestinatario(usuarioId)));
  });

  // #9 — PATCH /casilla/notificaciones/:id/lectura
  router.patch('/casilla/notificaciones/:id/lectura', async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const usuarioId = obtenerUsuarioId(req);

    const resultado = await pool.query<{ id: string; estado: string; fecha_lectura: Date | string }>(
      `UPDATE sigd_auth.notificacion_casilla
          SET estado = 'LEIDO',
              fecha_lectura = COALESCE(fecha_lectura, now())
        WHERE id = $1::uuid AND usuario_id = $2::uuid
        RETURNING id, estado, fecha_lectura`,
      [id, usuarioId],
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
    const usuarioId = obtenerUsuarioId(req);

    const notifRes = await pool.query<FilaNotificacionCasilla>(
      `SELECT * FROM sigd_auth.notificacion_casilla WHERE id = $1::uuid AND usuario_id = $2::uuid`,
      [id, usuarioId],
    );

    if (notifRes.rows.length === 0) {
      throw new NotFoundError({
        detail: `No existe la notificación de casilla para emitir acuse: ${id}`,
      });
    }

    const notif = notifRes.rows[0];
    const anio = new Date().getFullYear();
    const destinatario = await obtenerDestinatario(usuarioId);

    // -------------------------------------------------------------------------
    // LPAG Art. 20 (Modalidades de Notificación) & Inmutabilidad Forense:
    // Si la notificación ya cuenta con acuse emitido (id_acuse poblado),
    // el sello de tiempo (acuse_sellado_tiempo) y el hash criptográfico (acuse_hash_sha256)
    // son ESTRICTAMENTE INMUTABLES y constituyen plena prueba fehaciente de la fecha cierta.
    // No debe actualizarse acuse_sellado_tiempo a now(), preservando la fecha original.
    // -------------------------------------------------------------------------
    if (notif.id_acuse) {
      const selladoOriginalIso = notif.acuse_sellado_tiempo
        ? (typeof notif.acuse_sellado_tiempo === 'string'
            ? notif.acuse_sellado_tiempo
            : notif.acuse_sellado_tiempo.toISOString())
        : (typeof notif.fecha_deposito === 'string'
            ? notif.fecha_deposito
            : notif.fecha_deposito.toISOString());

      const hashAcuseExistente = notif.acuse_hash_sha256
        ?? crypto
            .createHash('sha256')
            .update(`${id}:${selladoOriginalIso}:IESTP-SUIZA-ACUSE-LEGAL`)
            .digest('hex');

      const cvdAcuseExistente = `CVD-${anio}-ACU-${id.slice(0, 6).toUpperCase()}-7B12`;

      return res.status(200).json({
        success: true,
        message: 'Acuse digital legal existente recuperado sin mutación (Art. 20 LPAG - Inmutabilidad Fechado).',
        data: {
          idAcuse: notif.id_acuse,
          idNotificacion: id,
          numeroExpediente: notif.cut ?? '',
          destinatario,
          timestampGeneracionIso: selladoOriginalIso,
          selladoTiempo: selladoOriginalIso,
          hashSha256Acuse: hashAcuseExistente,
          hashSha256: hashAcuseExistente,
          cvdAcuse: cvdAcuseExistente,
          entidadEmisora: 'IESTP Suiza',
          unidadEmisora: 'Secretaría Académica',
          fechaEfectoLegal: selladoOriginalIso,
          plazoImpugnacionDiasHabiles: 15,
          validezLegalMensaje:
            'Acuse Notificatorio Digital emitido conforme al Art. 20 del TUO de la Ley N° 27444 y Ley N° 29733.',
          mensajeLegal:
            'Acuse Notificatorio Digital emitido conforme al Art. 20 del TUO de la Ley N° 27444 y Ley N° 29733.',
        },
        notificacionActualizada: mapearNotificacion(notif, destinatario),
      });
    }

    // Primera emisión: generación y sellado de tiempo inicial
    const ahoraIso = new Date().toISOString();
    const hashAcuse = crypto
      .createHash('sha256')
      .update(`${id}:${ahoraIso}:IESTP-SUIZA-ACUSE-LEGAL`)
      .digest('hex');
    const idAcuse = `ACU-${anio}-${id.slice(0, 8).toUpperCase()}`;
    const cvdAcuse = `CVD-${anio}-ACU-${id.slice(0, 6).toUpperCase()}-7B12`;

    await pool.query(
      `UPDATE sigd_auth.notificacion_casilla
          SET id_acuse = $1,
              acuse_hash_sha256 = $2,
              acuse_sellado_tiempo = COALESCE(acuse_sellado_tiempo, now())
        WHERE id = $3::uuid AND usuario_id = $4::uuid AND id_acuse IS NULL`,
      [idAcuse, hashAcuse, id, usuarioId],
    );

    const notificacionActualizada = mapearNotificacion({
      ...notif,
      id_acuse: idAcuse,
      acuse_hash_sha256: hashAcuse,
      acuse_sellado_tiempo: ahoraIso,
    }, destinatario);

    res.status(201).json({
      success: true,
      message: 'Acuse digital legal emitido y sellado exitosamente.',
      data: {
        idAcuse,
        idNotificacion: id,
        numeroExpediente: notif.cut ?? '',
        destinatario,
        timestampGeneracionIso: ahoraIso,
        selladoTiempo: ahoraIso,
        hashSha256Acuse: hashAcuse,
        hashSha256: hashAcuse,
        cvdAcuse,
        entidadEmisora: 'IESTP Suiza',
        unidadEmisora: 'Secretaría Académica',
        fechaEfectoLegal: ahoraIso,
        plazoImpugnacionDiasHabiles: 15,
        validezLegalMensaje:
          'Acuse Notificatorio Digital emitido conforme al Art. 20 del TUO de la Ley N° 27444 y Ley N° 29733.',
        mensajeLegal:
          'Acuse Notificatorio Digital emitido conforme al Art. 20 del TUO de la Ley N° 27444 y Ley N° 29733.',
      },
      notificacionActualizada,
    });
  });

  // #11 — GET /casilla/estadisticas
  router.get('/casilla/estadisticas', async (req: Request, res: Response) => {
    const usuarioId = obtenerUsuarioId(req);

    const resultado = await pool.query<{ no_leidas: string; total: string }>(
      `SELECT COUNT(*) FILTER (WHERE estado = 'NO_LEIDO')::text AS no_leidas,
              COUNT(*)::text AS total
         FROM sigd_auth.notificacion_casilla
        WHERE usuario_id = $1::uuid`,
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

  // #12 — GET /casilla/notificaciones/:id/documento/descargar
  router.get('/casilla/notificaciones/:id/documento/descargar', async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const usuarioId = obtenerUsuarioId(req);
    const documento = await pool.query<{ documento_url: string | null }>(
      `SELECT documento_url FROM sigd_auth.notificacion_casilla WHERE id = $1::uuid AND usuario_id = $2::uuid`,
      [id, usuarioId],
    );
    if (!documento.rows[0]?.documento_url) throw new NotFoundError({ detail: 'Documento no disponible para esta cuenta.' });
    let downloadUrl = documento.rows[0].documento_url;
    if (!downloadUrl.startsWith('http://') && !downloadUrl.startsWith('https://')) {
      const configS3 = obtenerConfiguracionS3();
      downloadUrl = generarUrlPresigned(downloadUrl, configS3, { metodo: 'GET', expiraSegundos: 900 });
    }
    res.status(200).json({
      downloadUrl,
      expiraEnSegundos: 900,
    });
  });

  // #13 — GET /casilla/notificaciones/:id/acuse/descargar
  router.get('/casilla/notificaciones/:id/acuse/descargar', async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const usuarioId = obtenerUsuarioId(req);
    const acuse = await pool.query<{ id_acuse: string | null }>(
      `SELECT id_acuse FROM sigd_auth.notificacion_casilla WHERE id = $1::uuid AND usuario_id = $2::uuid`,
      [id, usuarioId],
    );
    if (!acuse.rows[0]?.id_acuse) throw new NotFoundError({ detail: 'Acuse no disponible para esta cuenta.' });
    throw new NotFoundError({ detail: 'El acuse no tiene un archivo descargable persistido.' });
  });

  return router;
}

export default crearRouterCasilla;
