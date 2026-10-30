/**
 * ==============================================================================
 * Router del Asistente Virtual Institucional (AsistenteCore)
 * Sistema Integral de Gestión Documentaria (SIGD) - IESTP "Suiza"
 * ==============================================================================
 * Endpoints:
 *   POST /api/v1/asistente/consulta     — Atiende una pregunta del administrado
 *   GET  /api/v1/asistente/sugerencias   — Sugerencias rápidas iniciales
 *   GET  /api/v1/asistente/estado        — Estado y motor activo (health)
 *
 * Normativa: TUO de la Ley N° 27444 (LPAG), Ley N° 29733 (LPDP),
 * D.S. N° 026-2016-PCM (MGD) y Directiva N° 001-2019-AGN.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { ValidationError } from '../../shared/domain/errors/index.js';
import { getRequestContext } from '../../shared/request-context/request-context.js';
import type { AsistenteAuditPort, AsistenteMotor } from './asistente.types.js';
import { AuditAsistenteNoOp, hashSha256 } from './asistente.audit.js';
import { crearMotorAsistente } from './asistente.motor.js';
import { SUGERENCIAS_INICIALES } from './asistente.conocimiento.js';

const consultaSchema = z.object({
  mensaje: z
    .string({ required_error: 'El campo "mensaje" es obligatorio.' })
    .trim()
    .min(3, 'El mensaje debe tener al menos 3 caracteres.')
    .max(500, 'El mensaje no puede superar los 500 caracteres.'),
  sesionId: z.string().trim().max(120).optional(),
  contexto: z.record(z.string(), z.unknown()).optional(),
});

export interface AsistenteRouterOptions {
  /** Motor del asistente (por defecto: FAQ determinista). */
  motor?: AsistenteMotor;
  /** Puerto de auditoría (por defecto: no-op para no escribir en pruebas). */
  audit?: AsistenteAuditPort;
}

export function crearRouterAsistente(opciones: AsistenteRouterOptions = {}): Router {
  const motor = opciones.motor ?? crearMotorAsistente();
  const audit = opciones.audit ?? new AuditAsistenteNoOp();
  const router = Router();

  // POST /asistente/consulta
  router.post('/asistente/consulta', async (req: Request, res: Response) => {
    const parseado = consultaSchema.safeParse(req.body);
    if (!parseado.success) {
      const primerError = parseado.error.issues[0];
      throw new ValidationError({
        invalidParams: [
          {
            name: 'mensaje',
            reason: primerError ? `${primerError.path.join('.')}: ${primerError.message}` : 'Cuerpo inválido.',
          },
        ],
      });
    }

    const { mensaje, sesionId } = parseado.data;
    const resultado = await motor.responder(mensaje);
    const contexto = getRequestContext();

    try {
      await audit.registrarConsulta({
        mensajeHashSha256: hashSha256(mensaje),
        intencion: resultado.intencion,
        confianza: resultado.confianza,
        motor: resultado.motor,
        respuestaHashSha256: hashSha256(resultado.respuesta),
        sesionId: sesionId ?? null,
      });
    } catch (error) {
      req.app.locals.logger?.warn?.(
        `[asistente] No se pudo registrar la auditoría (correlation_id=${contexto?.correlation_id ?? ''})`,
        error,
      );
    }

    res.status(200).json({
      respuesta: resultado.respuesta,
      intencion: resultado.intencion,
      confianza: resultado.confianza,
      fuentes: resultado.fuentes,
      sugerencias: resultado.sugerencias,
      enlaces: resultado.enlaces ?? [],
      motor: resultado.motor,
      correlationId: contexto?.correlation_id ?? '',
    });
  });

  // GET /asistente/sugerencias
  router.get('/asistente/sugerencias', (_req: Request, res: Response) => {
    res.status(200).json({ sugerencias: [...SUGERENCIAS_INICIALES] });
  });

  // GET /asistente/estado
  router.get('/asistente/estado', (_req: Request, res: Response) => {
    res.status(200).json({
      estado: 'UP',
      motor: motor.nombre,
      version: '1.0.0',
      normativa: ['Ley 27444', 'Ley 29733', 'D.S. 026-2016-PCM', 'Directiva 001-2019-AGN'],
    });
  });

  return router;
}

export default crearRouterAsistente;
