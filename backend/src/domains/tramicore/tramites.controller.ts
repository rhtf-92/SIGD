import crypto from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import type { Pool } from 'pg';
import { ConsultaPublicaService } from './consultaPublica.service.js';
import { RadicacionVirtualService, type ProveedorFeriados } from './radicacionVirtual.service.js';
import { VentanillaPresencialService } from './ventanillaPresencial.service.js';
import { TicketTermicoUtil } from './ticketTermico.util.js';
import {
  consultaPublicaParamsSchema,
  radicacionVirtualSchema,
  ventanillaPresencialSchema,
} from './tramites.schemas.js';
import { NotFoundError } from '../../shared/domain/errors/index.js';

const ARANCELES_TUPA: Record<string, string> = {
  'TUPA-01': 'S/. 11.00 por semestre; S/. 2.00',
  'TUPA-02': 'S/. 25.00 por asignatura interna; S/. 30.00 externa',
  'TUPA-03': 'S/. 3.00',
  'TUPA-04': 'S/. 3.00',
  'TUPA-05': 'S/. 20.00',
  'TUPA-06': 'Gratuito',
  'TUPA-07': 'S/. 150.00 por nivel',
  'TUPA-08': 'Módulo semestral: S/. 75.00; anual: S/. 150.00',
  'TUPA-09': 'S/. 250.00 a S/. 900.00 según tasas vigentes',
  'TUPA-10': 'S/. 2.00',
  'TUPA-11': 'S/. 5.00',
  'TUPA-12': 'S/. 10.00',
  'TUPA-13': 'S/. 35.00',
  'TUPA-14': 'S/. 20.00 a S/. 35.00',
  'TUPA-15': 'S/. 35.00 por asignatura / unidad didáctica',
  'TUPA-16': 'S/. 100.00',
  'TUPA-17': 'S/. 150.00',
  'TUPA-18': 'S/. 3.00 c/s',
  'TUPA-19': 'S/. 20.00',
  'TUPA-20': 'S/. 30.00',
  'TUPA-21': 'Tasas vigentes según R.D. N.º 048',
  'TUPA-22': 'S/. 250.00',
  'TUPA-23': 'S/. 5.00',
  'TUPA-24': 'S/. 20.00',
  'TUPA-25': 'S/. 15.00',
  'TUPA-26': 'S/. 50.00',
  'TUPA-27': 'S/. 15.00',
  'TUPA-28': 'S/. 10.00',
  'TUPA-29': 'S/. 10.00',
  'TUPA-30': 'S/. 50.00',
  'TUPA-31': 'S/. 30.00',
  'TUPA-32': 'S/. 150.00',
  'TUPA-33': 'S/. 150.00',
  'TUPA-34': 'S/. 100.00',
  'TUPA-35': 'S/. 80.00',
  'TUPA-36': 'S/. 130.00',
  'TUPA-37': 'S/. 100.00',
  'TUPA-38': 'S/. 20.00',
  'TUPA-39': 'S/. 40.00',
  'TUPA-40': 'S/. 100.00',
  'TUPA-41': 'S/. 200.00',
  'TUPA-42': 'S/. 220.00',
  'TUPA-43': 'S/. 230.00',
  'TUPA-44': 'S/. 200.00',
  'TUPA-45': 'S/. 150.00',
  'TUPA-46': 'S/. 200.00',
  'TUPA-47': 'Curación S/. 10.00 - S/. 30.00; Extracción S/. 15.00 - S/. 50.00',
  'TUPA-48': 'Tarifas según servicio y alquiler',
  'LIBRE-01': 'Gratuito',
};

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
  const consultaService = new ConsultaPublicaService(pool, obtenerFeriados);

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
      SELECT t.tipo_tramite_id AS id,
             t.tipo_tramite_id AS id_tipo_tramite,
             t.tipo_tramite_id AS id_tipo_tramite_tupa,
             t.codigo,
             t.denominacion,
             t.denominacion AS nombre,
             t.descripcion,
             t.unidad_organica,
             t.unidad_organica AS dependencia,
             t.plazo_dias,
             t.plazo_dias AS plazo_dias_habiles,
             t.silencio_administrativo,
             t.silencio_administrativo AS calificacion,
             t.base_legal,
             t.vigente,
             TRUE AS es_tupa,
             COALESCE(
               json_agg(r.denominacion ORDER BY r.orden) FILTER (WHERE r.denominacion IS NOT NULL),
               '[]'::json
             ) AS requisitos
        FROM sigd_doc.tipo_tramite_tupa t
        LEFT JOIN sigd_doc.requisito r ON r.tipo_tramite_id = t.tipo_tramite_id
       WHERE t.vigente = TRUE
       GROUP BY t.tipo_tramite_id, t.codigo, t.denominacion, t.descripcion, t.unidad_organica, t.plazo_dias, t.silencio_administrativo, t.base_legal, t.vigente
       ORDER BY t.codigo ASC;
    `;
    const resultado = await pool.query(query);
    const filasConArancel = resultado.rows.map((fila: any) => ({
      ...fila,
      derecho_pago: ARANCELES_TUPA[fila.codigo] ?? 'Gratuito',
      derechoPago: ARANCELES_TUPA[fila.codigo] ?? 'Gratuito',
      arancel: ARANCELES_TUPA[fila.codigo] ?? 'Gratuito',
    }));
    res.status(200).json(filasConArancel);
  };

  router.get('/tramites/tipos', handlerTiposTupa);
  router.get('/tramites/tupa', handlerTiposTupa);
  router.get('/tramites/catalogo-tupa', handlerTiposTupa);

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
      SELECT e.expediente_id,
             e.codigo_expediente AS cut,
             e.fecha_radicacion,
             COALESCE(e.dni_solicitante, p.id_documento, '') AS remitente_documento,
             COALESCE(pn.nombre_completo, p.id_documento, 'Ciudadano') AS remitente,
             COALESCE(a.asunto, de.asunto, 'Trámite Presencial') AS asunto,
             a.fecha_ingreso,
             a.numero_registro,
             COALESCE(
               (SELECT MAX(folio_fin) FROM sigd_tra.expediente_documento_folio edf WHERE edf.expediente_id = e.expediente_id),
               1
             ) AS folios
        FROM sigd_tra.expediente e
        LEFT JOIN sigd_tra.asiento_registro a ON a.expediente_id = e.expediente_id
        LEFT JOIN sigd_doc.expediente de ON de.codigo_expediente = e.codigo_expediente
        LEFT JOIN sigd_auth.persona p ON p.id_persona = e.solicitante_id
        LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = p.id_persona
       WHERE e.codigo_expediente = $1
       LIMIT 1;
    `;

    const resultado = await pool.query(query, [cut]);
    const fila = resultado.rows[0];

    if (!fila) {
      throw new NotFoundError({
        detail: `No se encontró cargo físico registrado para el CUT ${cut}.`,
      });
    }

    const fechaAsiento = fila.fecha_ingreso ?? fila.fecha_radicacion ?? new Date();

    const ticketImpresion = TicketTermicoUtil.generarTicketVentanilla({
      cut: fila.cut,
      timestamp: new Date(fechaAsiento),
      folios: Number(fila.folios),
      hashSha256: crypto.createHash('sha256').update(fila.cut).digest('hex'),
      qrUrlSeguimiento: `https://sigd.iestp-suiza.edu.pe/consulta/${encodeURIComponent(fila.cut)}`,
    });

    res.status(200).json({
      cut: fila.cut,
      remitente: fila.remitente,
      dni: fila.remitente_documento,
      asunto: fila.asunto,
      folios: Number(fila.folios),
      fechaRecepcion: new Date(fechaAsiento).toISOString(),
      ticketTermicoTexto: ticketImpresion,
    });
  });

  return router;
}

export default crearRouterTramites;

