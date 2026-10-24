import crypto from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import { ConsultaPublicaService } from './consultaPublica.service.js';
import { RadicacionVirtualService, type ProveedorFeriados } from './radicacionVirtual.service.js';
import { VentanillaPresencialService } from './ventanillaPresencial.service.js';
import { TupaVersionadoService } from './tupaVersionado.service.js';
import { TicketTermicoUtil } from './ticketTermico.util.js';
import {
  consultaPublicaParamsSchema,
  expedienteTupaParamsSchema,
  radicacionVirtualSchema,
} from './tramites.schemas.js';
import { ForbiddenError, NotFoundError, UnauthorizedError } from '../../shared/domain/errors/index.js';
import { extraerTokenBearer, verificarTokenAcceso } from '../../core/auth/jwt.service.js';

const ventanillaPresencialSchema = z.object({
  dniSolicitante: z.string().regex(/^[0-9]{8}$/, 'DNI debe contener exactamente 8 dígitos'),
  datosRemitente: z.string().min(3),
  asunto: z.string().min(5).max(500),
  foliosTotales: z.coerce.number().int().positive(),
  areaDestinoId: z.string().uuid().optional(),
  tipoDocumentalId: z.string().uuid().optional(),
  registroVersionId: z.string().uuid('registroVersionId debe ser un UUID valido.').optional().nullable(),
});

/**
 * Endpoints del dominio TramiCore (Grupo 2 - OE2 / Integración TUPA 2026)
 *
 *   * #14 `POST /api/v1/tramites/radicacion-virtual` — radicación ciudadana en Mesa de Partes Virtual
 *   * #15 `POST /api/v1/tramites/ventanilla-presencial` — radicación física en ventanilla y ticket térmico
 *   * `GET  /api/v1/tramites/tupa` — catálogo canónico TUPA versionado (sigd_doc.tupa_registro_version)
 *   * `GET  /api/v1/tramites/tipos` — catálogo legado (sigd_doc.tipo_tramite_tupa) por compatibilidad
 *   * #16 `GET  /api/v1/tramites/consulta-publica/:cut` — consulta pública del estado procesal
 *   * #20 `GET  /api/v1/tramites/ventanilla/cargo/:cut` — datos del cargo de recepción física para impresión
 *   * `GET  /api/v1/tramites/expedientes/:expedienteId` — detalle del expediente con contexto TUPA
 *   * `GET  /api/v1/tramites/expedientes/:expedienteId/tupa` — contexto TUPA persistido del expediente
 */
export function crearRouterTramites(
  pool: Pool,
  obtenerFeriados?: ProveedorFeriados,
): Router {
  const router = Router();
  const radicacionService = new RadicacionVirtualService(pool, obtenerFeriados);
  const ventanillaService = new VentanillaPresencialService(pool);
  const consultaService = new ConsultaPublicaService(pool);
  const tupaService = new TupaVersionadoService(pool);

  // #14 — Radicación virtual (Mesa de Partes Virtual 24x7)
  router.post('/tramites/radicacion-virtual', async (req: Request, res: Response) => {
    const token = extraerTokenBearer(req.get('authorization'));
    if (!token) {
      throw new UnauthorizedError({ detail: 'Debe iniciar sesión para radicar un trámite virtual.' });
    }
    const claims = verificarTokenAcceso(token);
    if (!z.uuid().safeParse(claims.sub).success) {
      throw new UnauthorizedError({ detail: 'El token no identifica una cuenta válida.' });
    }
    const cuenta = await pool.query<{ id_persona: string | null; activo: boolean }>(
      `SELECT id_persona::text AS id_persona, activo
         FROM sigd_auth.cuenta_usuario
        WHERE id_usuario = $1::uuid`,
      [claims.sub],
    );
    const actor = cuenta.rows[0];
    if (!actor?.activo) {
      throw new UnauthorizedError({ detail: 'La cuenta no existe o está deshabilitada.' });
    }
    if (!actor.id_persona) {
      throw new ForbiddenError({ detail: 'La cuenta no tiene una persona asociada para radicar.' });
    }
    if (req.body?.idPersona !== undefined && req.body.idPersona !== actor.id_persona) {
      throw new ForbiddenError({ detail: 'No puede radicar un expediente a nombre de otra persona.' });
    }
    const datos = radicacionVirtualSchema.parse({ ...req.body, idPersona: actor.id_persona });
    const radicacion = await radicacionService.radicar(datos);
    res.status(201).json({
      expedienteId: radicacion.expedienteId,
      tipoDocumentalId: radicacion.tipoDocumentalId,
      cut: radicacion.cut,
      anioFiscal: radicacion.anio,
      fechaEnvioReal: radicacion.fechaEnvioReal,
      fechaRadicacionLegal: radicacion.fechaRadicacionLegal,
      diferidoPorCorte: radicacion.fueraDeHorario,
      totalFolios: radicacion.totalFolios,
      registroVersionId: radicacion.registroVersionId ?? null,
      qrSeguimientoUrl: radicacion.cargoDigital.qrContenido,
      cargoDigital: radicacion.cargoDigital,
      mensajeLegal: radicacion.mensajeLegal,
    });
  });

  // #15 — Radicación física en Ventanilla Presencial
  // #14b — Mis expedientes (Ciudadano autenticado - consulta estricta de trámites propios con BOLA protection)
  router.get('/tramites/mis-expedientes', async (req: Request, res: Response) => {
    const queryInyectado = req.query as Record<string, unknown> | undefined;
    if (
      queryInyectado?.idPersona ||
      queryInyectado?.id_persona ||
      queryInyectado?.personaId ||
      queryInyectado?.solicitanteId
    ) {
      throw new ForbiddenError({ detail: 'No está permitido especificar el identificador de persona en la consulta.' });
    }

    const token = extraerTokenBearer(req.get('authorization'));
    if (!token) {
      throw new UnauthorizedError({ detail: 'Debe iniciar sesión para consultar sus expedientes.' });
    }
    const claims = verificarTokenAcceso(token);
    if (!z.uuid().safeParse(claims.sub).success) {
      throw new UnauthorizedError({ detail: 'El token no identifica una cuenta válida.' });
    }
    const cuenta = await pool.query<{ id_persona: string | null; activo: boolean }>(
      `SELECT id_persona::text AS id_persona, activo
         FROM sigd_auth.cuenta_usuario
        WHERE id_usuario = $1::uuid`,
      [claims.sub],
    );
    const actor = cuenta.rows[0];
    if (!actor?.activo) {
      throw new UnauthorizedError({ detail: 'La cuenta no existe o está deshabilitada.' });
    }
    if (!actor.id_persona) {
      throw new ForbiddenError({ detail: 'La cuenta no tiene una persona asociada para consultar expedientes.' });
    }

    const resultado = await pool.query<{
      expediente_id: string;
      cut: string;
      codigo_expediente: string;
      numero: string;
      asunto: string;
      tipo_documento: string;
      tipo_tramite: string | null;
      estado: string;
      fecha_radicacion: Date | string;
      canal_ingreso: string;
      total_folios: number;
    }>(
      `SELECT e.expediente_id,
              e.codigo_expediente AS cut,
              e.codigo_expediente,
              e.numero,
              COALESCE(tr.asunto, '') AS asunto,
              COALESCE(td.nombre, 'SOLICITUD') AS tipo_documento,
              tv.denominacion_original AS tipo_tramite,
              COALESCE(rut.estado_nuevo, e.estado) AS estado,
              e.fecha_radicacion,
              COALESCE(ar.canal_ingreso, 'MESA_VIRTUAL') AS canal_ingreso,
              COALESCE((SELECT MAX(f.folio_fin) FROM sigd_tra.expediente_documento_folio f
                         WHERE f.expediente_id = e.expediente_id), 0)::int AS total_folios
         FROM sigd_tra.expediente e
         LEFT JOIN sigd_tra.tramite tr ON tr.expediente_id = e.expediente_id
         LEFT JOIN sigd_doc.tipo_documento td ON td.tipo_documental_id = e.tipo_documental_id
         LEFT JOIN sigd_rut.estado_actual_expediente rut ON rut.expediente_id = e.expediente_id
         LEFT JOIN LATERAL (
           SELECT a.canal_ingreso
             FROM sigd_tra.asiento_registro a
            WHERE a.expediente_id = e.expediente_id
            ORDER BY a.fecha_ingreso ASC LIMIT 1
         ) ar ON TRUE
         LEFT JOIN LATERAL (
           SELECT v.denominacion_original
             FROM sigd_doc.expediente_tupa_vinculo x
             JOIN sigd_doc.tupa_registro_version v ON v.registro_version_id = x.registro_version_id
            WHERE x.expediente_id = e.expediente_id
            ORDER BY x.vinculado_en DESC LIMIT 1
         ) tv ON TRUE
        WHERE e.solicitante_id = $1::uuid
          AND e.estado <> 'ANULADO'
        ORDER BY e.fecha_radicacion DESC`,
      [actor.id_persona],
    );

    const expedientes = resultado.rows.map((row) => ({
      expedienteId: row.expediente_id,
      cut: row.cut,
      codigoExpediente: row.codigo_expediente,
      numero: row.numero,
      asunto: row.asunto,
      tipoDocumento: row.tipo_documento,
      tipoTramite: row.tipo_tramite,
      estado: row.estado,
      fechaRadicacion: row.fecha_radicacion instanceof Date
        ? row.fecha_radicacion.toISOString()
        : String(row.fecha_radicacion),
      canalIngreso: row.canal_ingreso,
      totalFolios: Number(row.total_folios),
    }));

    res.status(200).json(expedientes);
  });

  router.post('/tramites/ventanilla-presencial', async (req: Request, res: Response) => {
    const token = extraerTokenBearer(req.get('authorization'));
    if (!token) throw new UnauthorizedError({ detail: 'Debe iniciar sesión para registrar una recepción presencial.' });
    const claims = verificarTokenAcceso(token);
    if (!z.uuid().safeParse(claims.sub).success) {
      throw new UnauthorizedError({ detail: 'El token no identifica una cuenta válida.' });
    }
    const autorizado = await pool.query<{ permitido: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM sigd_auth.cuenta_usuario c
         JOIN sigd_org.usuario_rol ur ON ur.id_usuario = c.id_usuario
           AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
         JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id
        WHERE c.id_usuario = $1::uuid AND c.activo = true
          AND r.codigo IN ('MESA_PARTES', 'ADMINISTRADOR')
       ) AS permitido`,
      [claims.sub],
    );
    if (!autorizado.rows[0]?.permitido) {
      throw new ForbiddenError({ detail: 'Se requiere rol vigente de Mesa de Partes o Administrador.' });
    }
    const datos = ventanillaPresencialSchema.parse(req.body);
    const resultado = await ventanillaService.registrarExpedienteVentanilla({
      ...datos,
      registroVersionId: datos.registroVersionId ?? undefined,
    });
    res.status(201).json(resultado);
  });

  // Catálogo TUPA versionado 2026 (sigd_doc.tupa_registro_version)
  router.get('/tramites/tupa', async (_req: Request, res: Response) => {
    const catalogo = await tupaService.listarAprobados();
    res.status(200).json(catalogo);
  });

  // Catálogo legado (sigd_doc.tipo_tramite_tupa) por compatibilidad
  const handlerTiposTupa = async (_req: Request, res: Response) => {
    const query = `
      SELECT tipo_tramite_id AS id,
             tipo_tramite_id AS id_tipo_tramite,
             codigo,
             denominacion,
             descripcion,
             unidad_organica,
             plazo_dias,
             plazo_dias AS plazo_dias_habiles,
             silencio_administrativo,
             silencio_administrativo AS calificacion,
             base_legal,
             vigente
        FROM sigd_doc.tipo_tramite_tupa
       WHERE vigente = TRUE
       ORDER BY codigo ASC;
    `;
    const resultado = await pool.query(query);
    res.status(200).json(resultado.rows);
  };

  router.get('/tramites/tipos', handlerTiposTupa);

  // #16 — Consulta pública por CUT
  router.get('/tramites/consulta-publica/:cut', async (req: Request, res: Response) => {
    const params = consultaPublicaParamsSchema.parse({ cut: req.params.cut });
    const consulta = await consultaService.consultarPorCut(params);
    res.status(200).json(consulta);
  });

  // #20 — Cargo de recepción física para impresión térmica
  router.get('/tramites/ventanilla/cargo/:cut', async (req: Request, res: Response) => {
    const cut = String(req.params.cut).trim().toUpperCase();

    const query = `
      SELECT a.numero_asiento, a.anio_fiscal, a.cut, a.remitente,
             a.remitente_documento, a.asunto, a.folios, a.fecha_asiento
        FROM sigd_tra.asiento_registro a
       WHERE a.cut = $1
       LIMIT 1;
    `;

    const resultado = await pool.query(query, [cut]);
    const asiento = resultado.rows[0];

    if (!asiento) {
      throw new NotFoundError({
        detail: `No se encontró cargo físico registrado para el CUT ${cut}.`,
      });
    }

    const ticketImpresion = TicketTermicoUtil.generarTicketVentanilla({
      cut: asiento.cut,
      timestamp: new Date(asiento.fecha_asiento),
      folios: Number(asiento.folios),
      hashSha256: crypto.createHash('sha256').update(asiento.cut).digest('hex'),
      qrUrlSeguimiento: `https://sigd.iestp-suiza.edu.pe/consulta/${encodeURIComponent(asiento.cut)}`,
    });

    res.status(200).json({
      cut: asiento.cut,
      remitente: asiento.remitente,
      dni: asiento.remitente_documento,
      asunto: asiento.asunto,
      folios: Number(asiento.folios),
      fechaRecepcion: asiento.fecha_asiento,
      ticketTermicoTexto: ticketImpresion,
    });
  });

  // Detalle del expediente con contexto TUPA
  const handlerDetalleExpediente = async (req: Request, res: Response) => {
    const params = expedienteTupaParamsSchema.parse(req.params);
    const detalle = await radicacionService.obtenerDetalleExpediente(params.expedienteId);
    res.status(200).json(detalle);
  };

  router.get('/tramites/expedientes/:expedienteId', handlerDetalleExpediente);
  router.get('/tramites/expediente/:expedienteId', handlerDetalleExpediente);

  // Contexto TUPA persistido del expediente
  const handlerContextoTupa = async (req: Request, res: Response) => {
    const params = expedienteTupaParamsSchema.parse(req.params);
    const contexto = await tupaService.obtenerContextoExpediente(params.expedienteId);
    res.status(200).json(contexto);
  };

  router.get('/tramites/expedientes/:expedienteId/tupa', handlerContextoTupa);
  router.get('/tramites/expediente/:expedienteId/tupa', handlerContextoTupa);

  return router;
}

export default crearRouterTramites;
