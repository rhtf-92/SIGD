import type { Request, Response, RequestHandler } from 'express';
import { RequerimientoPagoService, CrearRequerimientoDto, ConfirmarPagoDto, RechazarPagoDto } from './requerimientoPago.service.js';
import { z } from 'zod';

const crearSchema = z.object({
  idExpediente: z.string().uuid(),
  idTupaProcedimiento: z.string().uuid(),
  idSolicitante: z.string().uuid(),
  concepto: z.string().min(1).max(255),
});

const codigoParamSchema = z.object({
  codigo: z.string().min(1).max(30),
});

const idParamSchema = z.object({
  id: z.string().uuid(),
});

const confirmarSchema = z.object({
  idConfirmador: z.string().uuid(),
  observacion: z.string().max(500).optional(),
});

const rechazarSchema = z.object({
  idConfirmador: z.string().uuid(),
  observacion: z.string().min(1).max(500),
});

export class RequerimientoPagoController {
  constructor(private readonly service: any) {}

  crear: RequestHandler = async (req, res, next) => {
    try {
      const dto = crearSchema.parse(req.body);
      const resultado = await this.service.crearRequerimiento(dto);
      res.status(201).json({ success: true, data: resultado });
    } catch (error) {
      next(error);
    }
  };

  listar: RequestHandler = async (req, res, next) => {
    try {
      const filtros = {
        estado: req.query.estado as string | undefined,
        idExpediente: req.query.idExpediente as string | undefined,
        idSolicitante: req.query.idSolicitante as string | undefined,
        codigo: req.query.codigo as string | undefined,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
      };
      const resultado = await this.service.listar(filtros);
      res.json({ success: true, data: resultado });
    } catch (error) {
      next(error);
    }
  };

  buscarPorCodigo: RequestHandler = async (req, res, next) => {
    try {
      const { codigo } = codigoParamSchema.parse(req.params);
      const resultado = await this.service.buscarPorCodigo(codigo);
      if (!resultado) {
        res.status(404).json({ success: false, error: 'Requerimiento no encontrado' });
        return;
      }
      res.json({ success: true, data: resultado });
    } catch (error) {
      next(error);
    }
  };

  confirmarPago: RequestHandler = async (req, res, next) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      const dto = confirmarSchema.parse(req.body);
      const ok = await this.service.confirmarPago(req.params.id, dto);
      if (!ok) {
        res.status(409).json({ success: false, error: 'No se pudo confirmar: estado inválido o ya procesado' });
        return;
      }
      res.json({ success: true, message: 'Pago confirmado correctamente' });
    } catch (error) {
      next(error);
    }
  };

  rechazarPago: RequestHandler = async (req, res, next) => {
    try {
      const { id } = idParamSchema.parse(req.params);
      const dto = rechazarSchema.parse(req.body);
      const ok = await this.service.rechazarPago(req.params.id, dto);
      if (!ok) {
        res.status(409).json({ success: false, error: 'No se pudo rechazar: estado inválido o ya procesado' });
        return;
      }
      res.json({ success: true, message: 'Pago rechazado correctamente' });
    } catch (error) {
      next(error);
    }
  };
}