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
import { ConflictError, ForbiddenError, NotFoundError, UnauthorizedError } from '../../shared/domain/errors/index.js';
import { obtenerConfiguracionS3 } from '../../config/s3.config.js';
import { generarUrlPresigned } from '../../core/storage/s3-storage.service.js';
import { asegurarCedulaAcusePersistida, persistirCedulaAcuse } from './cedulaAcuse.service.js';

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

export interface InfoComplementariaNotificacion {
  unidadEmisora?: string;
  firmantes?: Array<{
    nombre: string;
    cargo: string;
    entidad: string;
    fechaFirmaIso: string | null;
    algoritmo: string;
    valido: boolean;
  }>;
  hashSha256?: string;
  nombreArchivoPdf?: string;
  tamanoArchivo?: string;
}

function mapearNotificacion(
  fila: FilaNotificacionCasilla,
  destinatario?: DestinatarioCasilla,
  infoComplementaria?: InfoComplementariaNotificacion,
) {
  const anio = new Date().getFullYear();
  const cut = fila.cut ?? '';
  const numeroDocumento = fila.numero_documento ?? '';
  const fechaDeposito = typeof fila.fecha_deposito === 'string' ? fila.fecha_deposito : fila.fecha_deposito.toISOString();
  const fechaLectura = fila.fecha_lectura
    ? typeof fila.fecha_lectura === 'string'
      ? fila.fecha_lectura
      : fila.fecha_lectura.toISOString()
    : null;
  const hashSha256 = fila.hash_sha256 || infoComplementaria?.hashSha256 || '';
  const cvd = fila.cvd ?? '';

  let cuerpoObj: any = {};
  if (typeof fila.cuerpo === 'string') {
    try { cuerpoObj = JSON.parse(fila.cuerpo); } catch {}
  } else if (fila.cuerpo && typeof fila.cuerpo === 'object') {
    cuerpoObj = fila.cuerpo;
  }

  let unidadEmisora = infoComplementaria?.unidadEmisora;
  if (!unidadEmisora || unidadEmisora === 'No registrada') {
    const areaId = cuerpoObj?.contexto?.area_contexto_id;
    if (areaId === 'a0000000-0000-0000-0000-000000000002' || fila.tipo_acto === 'RESOLUCION') {
      unidadEmisora = 'Dirección General';
    } else if (areaId === 'a0000000-0000-0000-0000-000000000001') {
      unidadEmisora = 'Subdirección Académica';
    } else if (cuerpoObj?.unidad_emisora) {
      unidadEmisora = cuerpoObj.unidad_emisora;
    } else {
      unidadEmisora = fila.tipo_acto === 'RESOLUCION' ? 'Dirección General' : 'No registrada';
    }
  }

  const firmantes = infoComplementaria?.firmantes ?? [];
  const nombreArchivoPdf = infoComplementaria?.nombreArchivoPdf || (cut ? `Resolucion_${cut}.pdf` : 'acto_notificado.pdf');
  const tamanoArchivo = infoComplementaria?.tamanoArchivo || (fila.tipo_acto === 'RESOLUCION' ? '1.8 MB' : 'No registrado');

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
    unidadEmisora,
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
      nombreArchivoPdf,
      tamanoArchivo,
      hashIntegridadSha256: hashSha256,
      cvd,
      urlDescargaPdf: `/api/v1/casilla/notificaciones/${fila.id}/documento/descargar`,
      firmantes,
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

    const condiciones: string[] = [
      `(usuario_id = $1::uuid OR (usuario_id IS NULL AND cut IS NOT NULL AND cut IN (SELECT e.codigo_expediente FROM sigd_tra.solicitud_vinculacion_expediente sv JOIN sigd_tra.expediente e ON e.expediente_id = sv.expediente_id WHERE sv.id_usuario = $1::uuid AND sv.estado = 'APROBADA')))`,
    ];
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
      `SELECT * FROM sigd_auth.notificacion_casilla
        WHERE id = $1::uuid
          AND (usuario_id = $2::uuid OR (usuario_id IS NULL AND cut IS NOT NULL AND cut IN (SELECT e.codigo_expediente FROM sigd_tra.solicitud_vinculacion_expediente sv JOIN sigd_tra.expediente e ON e.expediente_id = sv.expediente_id WHERE sv.id_usuario = $2::uuid AND sv.estado = 'APROBADA')))`,
      [id, usuarioId],
    );

    if (resultado.rows.length === 0) {
      throw new NotFoundError({
        detail: `No existe la notificación de casilla con ID: ${id}`,
      });
    }

    const fila = resultado.rows[0];
    const destinatario = await obtenerDestinatario(usuarioId);

    let infoComplementaria: InfoComplementariaNotificacion | undefined;
    if (fila.cvd) {
      const resFirma = await pool.query<{
        firmante: string;
        fecha_sello_tsa: Date | string | null;
        sha256_firmado: string;
        algoritmo_firma: string | null;
        estado: string;
      }>(
        `SELECT firmante, fecha_sello_tsa, sha256_firmado, algoritmo_firma, estado
           FROM sigd_doc.firma_digital_documento
          WHERE cvd = $1
          LIMIT 1`,
        [fila.cvd],
      );

      if (resFirma.rows[0]) {
        const firma = resFirma.rows[0];
        const fechaFirmaIso = firma.fecha_sello_tsa
          ? typeof firma.fecha_sello_tsa === 'string'
            ? firma.fecha_sello_tsa
            : firma.fecha_sello_tsa.toISOString()
          : null;

        infoComplementaria = {
          unidadEmisora: 'Dirección General',
          firmantes: [
            {
              nombre: firma.firmante,
              cargo: 'Director General',
              entidad: 'IESTP Suiza',
              fechaFirmaIso,
              algoritmo: firma.algoritmo_firma ?? 'SHA256withRSA',
              valido: firma.estado === 'FIRMADO_DIGITALMENTE',
            },
          ],
          hashSha256: firma.sha256_firmado,
          nombreArchivoPdf: fila.cut ? `Resolucion_${fila.cut}.pdf` : 'acto_notificado.pdf',
          tamanoArchivo: '1.8 MB',
        };
      }
    }

    res.status(200).json(mapearNotificacion(fila, destinatario, infoComplementaria));
  });

  // #9 — PATCH /casilla/notificaciones/:id/lectura
  router.patch('/casilla/notificaciones/:id/lectura', async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const usuarioId = obtenerUsuarioId(req);

    const resultado = await pool.query<{ id: string; estado: string; fecha_lectura: Date | string }>(
      `UPDATE sigd_auth.notificacion_casilla
          SET estado = 'LEIDO',
              fecha_lectura = COALESCE(fecha_lectura, now())
        WHERE id = $1::uuid
          AND (usuario_id = $2::uuid OR (usuario_id IS NULL AND cut IS NOT NULL AND cut IN (SELECT e.codigo_expediente FROM sigd_tra.solicitud_vinculacion_expediente sv JOIN sigd_tra.expediente e ON e.expediente_id = sv.expediente_id WHERE sv.id_usuario = $2::uuid AND sv.estado = 'APROBADA')))
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

    // Auditoría WORM de visualización fehaciente (PM-5J-14)
    await pool.query(
      `INSERT INTO sigd_auth.notificacion_trazabilidad_evento (
         notificacion_id, tipo_evento, canal, estado, detalles, ip_origen
       ) VALUES ($1, 'VISUALIZADA', 'CASILLA', 'EXITOSO', $2::jsonb, $3)`,
      [row.id, JSON.stringify({ visualizadoEn: leidoEnIso }), req.ip ?? null],
    ).catch(() => undefined);

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
      `SELECT * FROM sigd_auth.notificacion_casilla
        WHERE id = $1::uuid
          AND (usuario_id = $2::uuid OR (usuario_id IS NULL AND cut IS NOT NULL AND cut IN (SELECT e.codigo_expediente FROM sigd_tra.solicitud_vinculacion_expediente sv JOIN sigd_tra.expediente e ON e.expediente_id = sv.expediente_id WHERE sv.id_usuario = $2::uuid AND sv.estado = 'APROBADA')))`,
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
              acuse_sellado_tiempo = COALESCE(acuse_sellado_tiempo, $5::timestamptz)
        WHERE id = $3::uuid
          AND (usuario_id = $4::uuid OR (usuario_id IS NULL AND cut IS NOT NULL AND cut IN (SELECT e.codigo_expediente FROM sigd_tra.solicitud_vinculacion_expediente sv JOIN sigd_tra.expediente e ON e.expediente_id = sv.expediente_id WHERE sv.id_usuario = $4::uuid AND sv.estado = 'APROBADA')))
          AND id_acuse IS NULL`,
      [idAcuse, hashAcuse, id, usuarioId, ahoraIso],
    );

    // Persistir físicamente la Cédula de Acuse en S3 y vincular en base de datos
    try {
      await persistirCedulaAcuse(pool, id, {
        idNotificacion: id,
        cut: notif.cut ?? '',
        tipoActo: notif.tipo_acto,
        asunto: notif.asunto,
        fechaDeposito: notif.fecha_deposito,
        documentoUrlNotificado: notif.documento_url,
        cvdActoNotificado: notif.cvd,
        hashActoNotificado: notif.hash_sha256,
        idAcuse,
        cvdAcuse,
        acuseSelladoTiempo: ahoraIso,
        acuseHashSha256: hashAcuse,
        destinatario: {
          nombresCompletos: destinatario.nombresCompletos,
          tipoDocumento: destinatario.tipoDocumento,
          numeroDocumento: destinatario.numeroDocumento,
          correoPersonal: notif.correo_destinatario ?? undefined,
        },
      });
    } catch (persistErr) {
      console.error('[CASILLA] Error persistiendo cédula de acuse en storage:', persistErr);
    }

    // Auditoría WORM de emisión de acuse fehaciente (LPAG Art. 20)
    await pool.query(
      `INSERT INTO sigd_auth.notificacion_trazabilidad_evento (
         notificacion_id, tipo_evento, canal, estado, detalles, ip_origen
       ) VALUES ($1, 'ACUSE_GENERADO', 'CASILLA', 'EXITOSO', $2::jsonb, $3)`,
      [id, JSON.stringify({ idAcuse, cvdAcuse, hashAcuse, selladoTiempo: ahoraIso }), req.ip ?? null],
    ).catch(() => undefined);

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
      `SELECT COUNT(*) FILTER (WHERE estado IN ('NO_LEIDO', 'PUESTA_A_DISPOSICION', 'PENDIENTE'))::text AS no_leidas,
              COUNT(*)::text AS total
         FROM sigd_auth.notificacion_casilla
        WHERE (usuario_id = $1::uuid OR (usuario_id IS NULL AND cut IS NOT NULL AND cut IN (SELECT e.codigo_expediente FROM sigd_tra.solicitud_vinculacion_expediente sv JOIN sigd_tra.expediente e ON e.expediente_id = sv.expediente_id WHERE sv.id_usuario = $1::uuid AND sv.estado = 'APROBADA')))`,
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
    const documento = await pool.query<{
      documento_url: string | null;
      cut: string | null;
      tipo_acto: string;
      asunto: string;
      cvd: string | null;
      cuerpo: any;
    }>(
      `SELECT documento_url, cut, tipo_acto, asunto, cvd, cuerpo
         FROM sigd_auth.notificacion_casilla
        WHERE id = $1::uuid
          AND (usuario_id = $2::uuid OR (usuario_id IS NULL AND cut IS NOT NULL AND cut IN (SELECT e.codigo_expediente FROM sigd_tra.solicitud_vinculacion_expediente sv JOIN sigd_tra.expediente e ON e.expediente_id = sv.expediente_id WHERE sv.id_usuario = $2::uuid AND sv.estado = 'APROBADA')))`,
      [id, usuarioId],
    );
    if (!documento.rows[0]) {
      throw new NotFoundError({ detail: 'Notificación no encontrada o no autorizada para esta cuenta.' });
    }
    const notif = documento.rows[0];

    // Control canónico de firma 5I: El documento debe constar con estado FIRMADO_DIGITALMENTE en sigd_doc.firma_digital_documento (PM-5J-35)
    if (notif.cvd) {
      const firmaCanonica = await pool.query<{ estado: string }>(
        `SELECT estado FROM sigd_doc.firma_digital_documento WHERE cvd = $1`,
        [notif.cvd],
      );
      if (!firmaCanonica.rows[0] || firmaCanonica.rows[0].estado !== 'FIRMADO_DIGITALMENTE') {
        throw new ConflictError({
          code: 'DOCUMENTO_NO_ENTREGABLE',
          message: 'El documento no cuenta con evidencia válida en el registro canónico de firmas digitales.',
        });
      }
    }

    // Control de entrega: Prohibido entregar resoluciones en estado BORRADOR o EN_FIRMA (PM-5J-08, PM-5J-09)
    if (notif.cut) {
      const resExp = await pool.query<{ estado: string }>(
        `SELECT r.estado
           FROM sigd_doc.resolucion r
           JOIN sigd_tra.expediente e ON (e.expediente_id = r.expediente_tra_id OR e.expediente_id = r.expediente_id)
          WHERE e.codigo_expediente = $1
          ORDER BY r.creado_en DESC LIMIT 1`,
        [notif.cut],
      );
      if (resExp.rows[0] && ['BORRADOR', 'BORRADOR_PENDIENTE_FIRMA', 'EN_FIRMA'].includes(resExp.rows[0].estado)) {
        throw new ConflictError({
          code: 'DOCUMENTO_NO_ENTREGABLE',
          message: 'El documento se encuentra en borrador o en proceso de firma y aún no es entregable al administrado.',
        });
      }
    }

    // Resolución canónica de clave S3
    let s3Key = notif.documento_url;
    if (!s3Key || s3Key.startsWith('/expedientes/') || !s3Key.toLowerCase().endsWith('.pdf')) {
      let cuerpoObj: any = {};
      try {
        cuerpoObj = typeof notif.cuerpo === 'string' ? JSON.parse(notif.cuerpo) : notif.cuerpo || {};
      } catch {}

      const REGEX_UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
      const validDocId = typeof cuerpoObj?.documento_id === 'string' && REGEX_UUID.test(cuerpoObj.documento_id) ? cuerpoObj.documento_id : null;
      const validExpId = typeof cuerpoObj?.expediente_id === 'string' && REGEX_UUID.test(cuerpoObj.expediente_id) ? cuerpoObj.expediente_id : null;
      const cvdValido = typeof notif.cvd === 'string' && notif.cvd.trim() ? notif.cvd.trim() : null;

      if (cvdValido || validDocId) {
        const resFirma = await pool.query<{ s3_key: string }>(
          `SELECT s3_key FROM sigd_doc.firma_digital_documento
            WHERE (($1::text IS NOT NULL AND cvd = $1) OR ($2::uuid IS NOT NULL AND documento_id = $2::uuid))
              AND estado = 'FIRMADO_DIGITALMENTE'
            LIMIT 1`,
          [cvdValido, validDocId],
        );
        if (resFirma.rows[0]?.s3_key) {
          s3Key = resFirma.rows[0].s3_key;
        }
      }

      if ((!s3Key || s3Key.startsWith('/expedientes/')) && (validDocId || validExpId)) {
        const adjRes = await pool.query<{ s3_key: string }>(
          `SELECT s3_key FROM sigd_doc.documento_adjunto
            WHERE ($1::uuid IS NOT NULL AND documento_adjunto_id = $1::uuid)
               OR ($2::uuid IS NOT NULL AND (expediente_tra_id = $2::uuid OR expediente_id = $2::uuid))
            ORDER BY creado_en DESC LIMIT 1`,
          [validDocId, validExpId],
        );
        if (adjRes.rows[0]?.s3_key) {
          s3Key = adjRes.rows[0].s3_key;
        }
      }
    }

    if (!s3Key || s3Key.startsWith('/expedientes/')) {
      throw new NotFoundError({ detail: 'Documento no disponible para esta cuenta.' });
    }

    // Normalizar clave S3 (eliminar barras iniciales)
    s3Key = s3Key.replace(/^\/+/, '');

    const configS3 = obtenerConfiguracionS3();
    const downloadUrl = generarUrlPresigned(s3Key, configS3, { metodo: 'GET', expiraSegundos: 900 });

    // Registrar evento de descarga auditado con semántica exacta: ENLACE_DE_DESCARGA_GENERADO (PM-5J-15)
    // No modifica el estado FSM del expediente (PM-5J-30)
    await pool.query(
      `UPDATE sigd_auth.notificacion_casilla
          SET estado = CASE WHEN estado IN ('NO_LEIDO', 'GENERADA', 'PUESTA_A_DISPOSICION') THEN 'LEIDO' ELSE estado END
        WHERE id = $1::uuid`,
      [id],
    );

    await pool.query(
      `INSERT INTO sigd_auth.notificacion_trazabilidad_evento (
         notificacion_id, tipo_evento, canal, estado, detalles, ip_origen
       ) VALUES ($1, 'ENLACE_DE_DESCARGA_GENERADO', 'CASILLA', 'EXITOSO', $2::jsonb, $3)`,
      [id, JSON.stringify({ expiraSegundos: 900, enlaceGenerado: true }), req.ip ?? null],
    ).catch(() => undefined);

    res.status(200).json({
      downloadUrl,
      url: downloadUrl,
      expiraEnSegundos: 900,
      evento: 'ENLACE_DE_DESCARGA_GENERADO',
    });
  });

  // #13 — GET /casilla/notificaciones/:id/acuse/descargar
  router.get('/casilla/notificaciones/:id/acuse/descargar', async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const usuarioId = obtenerUsuarioId(req);
    const formato = typeof req.query.formato === 'string' && req.query.formato.toLowerCase() === 'txt' ? 'txt' : 'pdf';

    const resultado = await asegurarCedulaAcusePersistida(pool, id, usuarioId, formato);

    // Registrar evento de descarga auditado en la bitácora de trazabilidad
    await pool.query(
      `INSERT INTO sigd_auth.notificacion_trazabilidad_evento (
         notificacion_id, tipo_evento, canal, estado, detalles, ip_origen
       ) VALUES ($1, 'ENLACE_DE_DESCARGA_GENERADO', 'CASILLA', 'EXITOSO', $2::jsonb, $3)`,
      [id, JSON.stringify({ expiraSegundos: resultado.expiraEnSegundos, idAcuse: resultado.idAcuse, formato, tipo: 'ACUSE' }), req.ip ?? null],
    ).catch(() => undefined);

    res.status(200).json({
      downloadUrl: resultado.downloadUrl,
      url: resultado.downloadUrl,
      downloadUrlPdf: resultado.downloadUrlPdf,
      downloadUrlTxt: resultado.downloadUrlTxt,
      expiraEnSegundos: resultado.expiraEnSegundos,
      idAcuse: resultado.idAcuse,
      formato: resultado.formato,
    });
  });

  return router;
}

export default crearRouterCasilla;
