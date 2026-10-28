import { Router } from 'express';
import { RequerimientoPagoController } from './requerimientoPago.controller.js';
import { RequerimientoPagoService } from './requerimientoPago.service.js';
import type { Pool } from 'pg';

export function crearRutasTesoreria(pool: Pool): Router {
  const router = Router();
  const service = new RequerimientoPagoService(pool);
  const controller = new RequerimientoPagoController(service);

  router.post('/requerimientos', (req, res, next) => controller.crear(req, res, next));
  router.get('/requerimientos', (req, res, next) => controller.listar(req, res, next));
  router.get('/requerimientos/:codigo', (req, res, next) => controller.buscarPorCodigo(req, res, next));
  router.put('/requerimientos/:id/confirmar', (req, res, next) => controller.confirmarPago(req, res, next));
  router.put('/requerimientos/:id/rechazar', (req, res, next) => controller.rechazarPago(req, res, next));

  return router;
}
