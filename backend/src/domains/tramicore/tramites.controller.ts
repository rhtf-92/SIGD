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
