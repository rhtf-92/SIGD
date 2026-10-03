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

const ventanillaPresencialSchema = z.object({
  dniSolicitante: z.string().regex(/^[0-9]{8}$/, 'DNI debe contener exactamente 8 dígitos'),
  datosRemitente: z.string().min(3),
  asunto: z.string().min(5).max(500),
  foliosTotales: z.coerce.number().int().positive(),
  areaDestinoId: z.string().uuid().optional(),
  tipoDocumentalId: z.string().uuid().optional(),
});

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

  return router;
}

export default crearRouterTramites;
