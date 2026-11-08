/**
 * Router para la gestión de Vínculos Institucionales (Fase 5B)
 * Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
 *
 * NOTA DE SEGURIDAD ARQUITECTÓNICA:
 * La autorización de mutaciones administrativas está restringida de forma provisional
 * al rol canónico 'ADMINISTRADOR'. Esta autorización provisional sobre el RBAC existente
 * será formalmente refinada y granularizada en la Fase 5D.
 */

import { Router, type Request, type Response } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import { resolverIdentidad } from '../../core/auth/auth.guard.js';
import { ForbiddenError, ValidationError } from '../../shared/domain/errors/index.js';
import { VinculoInstitucionalService } from './vinculoInstitucional.service.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const crearVinculoSchema = z.object({
  tipoVinculo: z.union([z.string().min(1), z.number().int().positive()]),
  vigenteDesde: z.string().optional(),
  vigenteHasta: z.string().nullable().optional(),
});

const finalizarVinculoSchema = z.object({
  motivoFinalizacion: z.string().max(255).optional(),
  fechaFinalizacion: z.string().optional(),
});

const anularVinculoSchema = z.object({
  motivoAnulacion: z.string().min(1, 'El motivo de anulación es obligatorio').max(255),
});

function exigirRolAdministrador(req: Request): string {
  const identidad = resolverIdentidad(req);
  if (!identidad.roles.includes('ADMINISTRADOR')) {
    throw new ForbiddenError({
      message: 'Acceso restringido: se requiere rol ADMINISTRADOR para gestionar vínculos institucionales.',
      detail: 'Esta autorización es provisional sobre el RBAC existente y será refinada en Fase 5D.',
    });
  }
  return identidad.idUsuario;
}

export function crearRouterVinculosInstitucionales(pool: Pool): Router {
  const router = Router();
  const service = new VinculoInstitucionalService(pool);

  // 1. Catálogo de tipos de vínculo (público / institucional)
  router.get('/identidad/catalogo-vinculos', async (_req: Request, res: Response) => {
    const tipos = await service.listarCatalogoTipos();
    res.status(200).json({ tipos });
  });

  // 2. Consulta propia "MIS VÍNCULOS" (Autenticado, protección BOLA estricta)
  router.get('/identidad/mis-vinculos', async (req: Request, res: Response) => {
    const identidad = resolverIdentidad(req);
    const soloVigentes = req.query.solo_vigentes === 'true' || req.query.soloVigentes === 'true';
    const fechaCorte = typeof req.query.fecha_corte === 'string'
      ? req.query.fecha_corte
      : typeof req.query.fechaCorte === 'string'
        ? req.query.fechaCorte
        : undefined;

    const vinculos = await service.listarMisVinculos(identidad.idUsuario, {
      soloVigentes,
      fechaCorte,
    });
    res.status(200).json({ vinculos });
  });

  // 3. Consulta de vínculos por persona (Exclusivo ADMINISTRADOR provisional)
  router.get('/identidad/personas/:personaId/vinculos', async (req: Request, res: Response) => {
    exigirRolAdministrador(req);
    const personaId = String(req.params.personaId ?? '');
    if (!personaId || !UUID_REGEX.test(personaId)) {
      throw new ValidationError({
        message: 'El identificador de persona no es un UUID válido.',
        invalidParams: [{ name: 'personaId', reason: 'UUID v4 inválido' }],
      });
    }

    const soloVigentes = req.query.solo_vigentes === 'true' || req.query.soloVigentes === 'true';
    const fechaCorte = typeof req.query.fecha_corte === 'string'
      ? req.query.fecha_corte
      : typeof req.query.fechaCorte === 'string'
        ? req.query.fechaCorte
        : undefined;

    const vinculos = await service.listarVinculosPorPersona(personaId, {
      soloVigentes,
      fechaCorte,
    });
    res.status(200).json({ personaId, vinculos });
  });

  // 4. Creación administrativa de vínculo (Exclusivo ADMINISTRADOR provisional)
  router.post('/identidad/personas/:personaId/vinculos', async (req: Request, res: Response) => {
    exigirRolAdministrador(req);
    const personaId = String(req.params.personaId ?? '');
    if (!personaId || !UUID_REGEX.test(personaId)) {
      throw new ValidationError({
        message: 'El identificador de persona no es un UUID válido.',
        invalidParams: [{ name: 'personaId', reason: 'UUID v4 inválido' }],
      });
    }

    const body = crearVinculoSchema.parse(req.body);
    const creado = await service.crearVinculo({
      personaId,
      tipoVinculo: body.tipoVinculo,
      vigenteDesde: body.vigenteDesde,
      vigenteHasta: body.vigenteHasta,
    });
    res.status(201).json(creado);
  });

  // 5. Finalización de vínculo (Exclusivo ADMINISTRADOR provisional)
  router.patch('/identidad/vinculos/:vinculoId/finalizar', async (req: Request, res: Response) => {
    exigirRolAdministrador(req);
    const vinculoId = String(req.params.vinculoId ?? '');
    const body = finalizarVinculoSchema.parse(req.body);

    const finalizado = await service.finalizarVinculo({
      vinculoId,
      motivoFinalizacion: body.motivoFinalizacion,
      fechaFinalizacion: body.fechaFinalizacion,
    });
    res.status(200).json(finalizado);
  });

  // 6. Anulación de vínculo (Exclusivo ADMINISTRADOR provisional)
  router.patch('/identidad/vinculos/:vinculoId/anular', async (req: Request, res: Response) => {
    const usuarioId = exigirRolAdministrador(req);
    const vinculoId = String(req.params.vinculoId ?? '');
    const body = anularVinculoSchema.parse(req.body);

    const anulado = await service.anularVinculo({
      vinculoId,
      motivoAnulacion: body.motivoAnulacion,
      anuladoPor: usuarioId,
    });
    res.status(200).json(anulado);
  });

  return router;
}
