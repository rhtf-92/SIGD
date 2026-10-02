import { Router } from 'express';
import type { Pool } from 'pg';
import { ConsultaPublicaService } from './consultaPublica.service.js';
import { RadicacionVirtualService, type ProveedorFeriados } from './radicacionVirtual.service.js';
import { consultaPublicaParamsSchema, radicacionVirtualSchema } from './tramites.schemas.js';

/**
 * T-BE-TC-02, T-BE-TC-03 y T-BE-TC-04 · Endpoints del dominio TramiCore.
 *
 *   * #14 `POST /api/v1/tramites/radicacion-virtual` — radicacion ciudadana en
 *     la Mesa de Partes Virtual con asignacion atomica de CUT.
 *   * #16 `GET  /api/v1/tramites/consulta-publica/:cut` — consulta publica del
 *     estado procesal, sin credenciales y con datos enmascarados.
 *
 * Los errores de Zod y de PostgreSQL los traduce `errorMiddleware`, que ya
 * responde `application/problem+json` con el `correlation_id` de la peticion.
 * Por eso los handlers no envuelven la logica en try/catch.
 */
export function crearRouterTramites(
  pool: Pool,
  obtenerFeriados?: ProveedorFeriados,
): Router {
  const router = Router();
  const radicacionService = new RadicacionVirtualService(pool, obtenerFeriados);
  const consultaService = new ConsultaPublicaService(pool);

  // #14 — Radicacion virtual. El corte de las 16:30 y la proyeccion al dia
  // habil siguiente (Art. 138 LPAG) se resuelven dentro de la transaccion, de
  // modo que la respuesta 201 ya trae la fecha legal definitiva.
  router.post('/tramites/radicacion-virtual', async (req, res) => {
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

  // #16 — Consulta publica por CUT. Responde 404 tanto si el CUT no existe como
  // si el expediente esta anulado, para no confirmar la existencia de un CUT
  // cancelado.
  router.get('/tramites/consulta-publica/:cut', async (req, res) => {
    const params = consultaPublicaParamsSchema.parse({ cut: req.params.cut });
    const consulta = await consultaService.consultarPorCut(params);
    res.status(200).json(consulta);
  });

  return router;
}
