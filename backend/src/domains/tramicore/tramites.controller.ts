import crypto from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import { ConsultaPublicaService } from './consultaPublica.service.js';
import { RadicacionVirtualService, type ProveedorFeriados } from './radicacionVirtual.service.js';
import { VentanillaPresencialService } from './ventanillaPresencial.service.js';
import { TicketTermicoUtil } from './ticketTermico.util.js';
import { consultaPublicaParamsSchema, radicacionVirtualSchema } from './tramites.schemas.js';
import { NotFoundError } from '../../shared/domain/errors/index.js';

const ventanillaPresencialSchema = z
  .object({
    dniSolicitante: z.string().trim().regex(/^[0-9]{8}$/, 'DNI debe contener exactamente 8 dígitos'),
    datosRemitente: z.string().trim().min(3).max(200),
    asunto: z.string().trim().min(5).max(500),
    foliosTotales: z.coerce.number().int().positive(),
    correo: z.string().trim().toLowerCase().email().max(150),
    idTipoTramiteTupa: z.string().trim().uuid(),
    nombreSolicitante: z.string().trim().min(2).max(120).optional(),
  })
  .strict();

/**
 * Endpoints del dominio TramiCore (Grupo 2 - OE2)
 *
 *   * #14 `POST /api/v1/tramites/radicacion-virtual` — radicación ciudadana en Mesa de Partes Virtual
 *   * #15 `POST /api/v1/tramites/ventanilla-presencial` — radicación física en ventanilla y ticket térmico
 *   * #15-Cat `GET /api/v1/tramites/tipos` / `/tramites/tupa` — catálogo de procedimientos TUPA
 *   * #16 `GET  /api/v1/tramites/consulta-publica/:cut` — consulta pública del estado procesal
 *   * #20 `GET  /api/v1/tramites/ventanilla/cargo/:cut` — datos del cargo de recepción física para impresión
 */
export function crearRouterTramites(
  pool: Pool,
  obtenerFeriados?: ProveedorFeriados,
): Router {
  const router = Router();
  const radicacionService = new RadicacionVirtualService(pool, obtenerFeriados);
  const ventanillaService = new VentanillaPresencialService(pool);
  const consultaService = new ConsultaPublicaService(pool);

  // #14 — Radicación virtual (Mesa de Partes Virtual 24x7)
  router.post('/tramites/radicacion-virtual', async (req: Request, res: Response) => {
    const datos = radicacionVirtualSchema.parse(req.body);
    const radicacion = await radicacionService.radicar(datos);
    res.status(201).json({
      expedienteId: radicacion.expedienteId,
      cut: radicacion.cut,
      anioFiscal: radicacion.anio,
      fechaEnvioReal: radicacion.fechaEnvioReal,
      fechaRadicacionLegal: radicacion.fechaRadicacionLegal,
      diferidoPorCorte: radicacion.fueraDeHorario,
      totalFolios: radicacion.totalFolios,
      qrSeguimientoUrl: radicacion.cargoDigital.qrContenido,
      cargoDigital: radicacion.cargoDigital,
      mensajeLegal: radicacion.mensajeLegal,
    });
  });

  // #15 — Radicación física en Ventanilla Presencial
  router.post('/tramites/ventanilla-presencial', async (req: Request, res: Response) => {
    const datos = ventanillaPresencialSchema.parse(req.body);
    const resultado = await ventanillaService.registrarExpedienteVentanilla(datos);
    res.status(201).json(resultado);
  });

  // #15 en catálogo — Catálogo de tipos de trámite TUPA y trámites internos
  const handlerTiposTupa = async (_req: Request, res: Response) => {
    const query = `
      SELECT id_tipo_tramite_tupa AS id,
             id_tipo_tramite_tupa AS id_tipo_tramite,
             codigo_tupa AS codigo,
             denominacion,
             es_tupa,
             calificacion_administrativa,
             calificacion_administrativa AS calificacion,
             plazo_max_dias_habiles,
             plazo_max_dias_habiles AS plazo_dias,
             costo,
             unidad_organica_responsable AS unidad_organica,
             base_legal,
             activo AS vigente
        FROM sigd_doc.tipo_tramite_tupa
       WHERE activo = TRUE
       ORDER BY codigo_tupa ASC;
    `;
    const resultado = await pool.query(query);
    res.status(200).json(resultado.rows);
  };

  router.get('/tramites/tipos', handlerTiposTupa);
  router.get('/tramites/tupa', handlerTiposTupa);

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
      SELECT e.cut,
             e.nombre_solicitante,
             e.asunto,
             e.total_folios,
             e.fecha_envio_real,
             p.numero_documento
        FROM sigd_tra.expediente e
        LEFT JOIN sigd_auth.persona p ON p.id = e.id_persona
       WHERE e.cut = $1
       LIMIT 1;
    `;

    const resultado = await pool.query(query, [cut]);
    const asiento = resultado.rows[0];

    if (!asiento) {
      throw new NotFoundError({
        detail: `No se encontró cargo físico registrado para el CUT ${cut}.`,
      });
    }

    const hashSha256 = crypto.createHash('sha256').update(asiento.cut).digest('hex');
    const qrUrlSeguimiento = `https://sigd.iestp-suiza.edu.pe/api/v1/tramites/consulta-publica/${encodeURIComponent(asiento.cut)}`;

    const ticketImpresion = TicketTermicoUtil.generarTicketVentanilla({
      cut: asiento.cut,
      timestamp: new Date(asiento.fecha_envio_real),
      folios: Number(asiento.total_folios),
      hashSha256,
      qrUrlSeguimiento,
    });

    res.status(200).json({
      cut: asiento.cut,
      remitente: asiento.nombre_solicitante,
      dni: asiento.numero_documento,
      asunto: asiento.asunto,
      folios: Number(asiento.total_folios),
      fechaRecepcion: asiento.fecha_envio_real,
      hashSha256,
      qrSeguimientoUrl: qrUrlSeguimiento,
      ticketTermicoTexto: ticketImpresion,
    });
  });

  return router;
}

export default crearRouterTramites;
