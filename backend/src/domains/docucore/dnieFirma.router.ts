import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import type { Pool } from 'pg';
import { resolverIdentidad } from '../../core/auth/auth.guard.js';
import {
  prepararFirmaDnie,
  verificarYRegistrarFirmaDnie,
} from './dnieFirma.service.js';

const esquemaPreparar = z.object({
  expedienteId: z.string().uuid(),
  documentoId: z.string().uuid().optional(),
  tipoActo: z.string().optional(),
});

const esquemaRegistrar = z.object({
  preparacionId: z.string().uuid(),
  expedienteId: z.string().uuid(),
  documentoId: z.string().uuid(),
  hashSha256: z.string().regex(/^[0-9a-fA-F]{64}$/),
  firmaB64: z.string().min(10),
  certificadoPem: z.string().min(20),
  algoritmo: z.string().optional(),
  proveedor: z.string().optional(),
});

export function crearRouterDnieFirma(pool: Pool): Router {
  const router = Router();

  /**
   * POST /api/v1/firma/dnie/preparar
   * Prepara el contexto y hash canónico del documento para firma con DNIe.
   */
  router.post('/preparar', async (req: Request, res: Response) => {
    const datos = esquemaPreparar.parse(req.body);
    const identidad = resolverIdentidad(req);
    const contextoActor = (req.get('x-contexto-activo') ?? req.get('x-contexto') ?? 'INSTITUCIONAL').toUpperCase();

    const resultado = await prepararFirmaDnie(
      pool,
      datos,
      identidad.idUsuario,
      contextoActor,
      identidad.roles,
    );

    res.status(200).json(resultado);
  });

  /**
   * POST /api/v1/firma/dnie/verificar-y-registrar
   * Verifica criptográficamente la firma X.509 y registra la evidencia canónica.
   */
  router.post('/verificar-y-registrar', async (req: Request, res: Response) => {
    const datos = esquemaRegistrar.parse(req.body);
    const identidad = resolverIdentidad(req);
    const contextoActor = (req.get('x-contexto-activo') ?? req.get('x-contexto') ?? 'INSTITUCIONAL').toUpperCase();

    const resultado = await verificarYRegistrarFirmaDnie(
      pool,
      datos,
      identidad.idUsuario,
      contextoActor,
    );

    res.status(201).json(resultado);
  });

  return router;
}
