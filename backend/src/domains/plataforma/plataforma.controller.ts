/**
 * Controlador HTTP para Administración de Plataforma SaaS
 * SIGD · IESTP «Suiza» · B_JACOBO
 */

import type { Request, Response } from 'express';
import { z } from 'zod';
import { ValidationError } from '../../shared/domain/errors/index.js';
import { PlataformaService } from './plataforma.service.js';

const CrearInstitucionSchema = z.object({
  codigo: z.string().min(2).max(40),
  nombre: z.string().min(3).max(200),
  abreviatura: z.string().min(2).max(40),
  ruc: z.string().length(11).regex(/^\d{11}$/).optional().nullable(),
  ubigeoInei: z.string().length(6).regex(/^\d{6}$/).optional().nullable(),
  motivoJustificacion: z.string().min(15, 'El motivo de justificación debe contener al menos 15 caracteres.'),
});

const ActualizarEstadoSchema = z.object({
  activo: z.boolean(),
  motivoJustificacion: z.string().min(15, 'El motivo de justificación debe contener al menos 15 caracteres.'),
});

const AsignarRolSchema = z.object({
  targetUserId: z.string().uuid(),
  rolPlataforma: z.string().min(2).max(30),
  motivoJustificacion: z.string().min(15, 'El motivo de justificación debe contener al menos 15 caracteres.'),
  esBreakGlass: z.boolean().optional(),
  breakGlassKey: z.string().optional(),
});

const RevocarRolSchema = z.object({
  targetUserId: z.string().uuid(),
  rolPlataforma: z.string().min(2).max(30),
  motivoJustificacion: z.string().min(15, 'El motivo de justificación debe contener al menos 15 caracteres.'),
});

export class PlataformaController {
  constructor(private readonly service: PlataformaService) {}

  listarInstituciones = async (_req: Request, res: Response): Promise<void> => {
    const data = await this.service.listarInstituciones();
    res.status(200).json({ ok: true, data });
  };

  crearInstitucion = async (req: Request, res: Response): Promise<void> => {
    const parse = CrearInstitucionSchema.safeParse(req.body);
    if (!parse.success) {
      throw new ValidationError({
        invalidParams: parse.error.issues.map((e) => ({
          name: e.path.join('.'),
          reason: e.message,
        })),
      });
    }

    const actorId = res.locals.actorSuperAdmin;
    const ipOrigen = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'HTTP-Client';

    const data = await this.service.crearInstitucion({
      ...parse.data,
      actorId,
      ipOrigen,
      userAgent,
    });

    res.status(201).json({ ok: true, data, mensaje: 'Institución aprovisionada exitosamente con registro WORM.' });
  };

  actualizarEstadoInstitucion = async (req: Request, res: Response): Promise<void> => {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!id || !z.string().uuid().safeParse(id).success) {
      throw new ValidationError({ invalidParams: [{ name: 'id', reason: 'El id de institución debe ser un UUID válido.' }] });
    }

    const parse = ActualizarEstadoSchema.safeParse(req.body);
    if (!parse.success) {
      throw new ValidationError({
        invalidParams: parse.error.issues.map((e) => ({
          name: e.path.join('.'),
          reason: e.message,
        })),
      });
    }

    const actorId = res.locals.actorSuperAdmin;
    const ipOrigen = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'HTTP-Client';

    const data = await this.service.actualizarEstadoInstitucion({
      institucionId: id,
      activo: parse.data.activo,
      actorId,
      motivoJustificacion: parse.data.motivoJustificacion,
      ipOrigen,
      userAgent,
    });

    res.status(200).json({ ok: true, data, mensaje: 'Estado institucional actualizado con registro WORM.' });
  };

  listarSuperAdmins = async (_req: Request, res: Response): Promise<void> => {
    const data = await this.service.listarUsuariosPlataforma();
    res.status(200).json({ ok: true, data });
  };

  asignarRolPlataforma = async (req: Request, res: Response): Promise<void> => {
    const parse = AsignarRolSchema.safeParse(req.body);
    if (!parse.success) {
      throw new ValidationError({
        invalidParams: parse.error.issues.map((e) => ({
          name: e.path.join('.'),
          reason: e.message,
        })),
      });
    }

    const actorId = res.locals.actorSuperAdmin;
    const ipOrigen = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'HTTP-Client';

    const result = await this.service.asignarRolPlataforma({
      ...parse.data,
      actorId,
      ipOrigen,
      userAgent,
    });

    res.status(201).json({
      ok: true,
      correlationId: result.correlationId,
      mensaje: 'Rol de plataforma asignado exitosamente bajo función rectora SECURITY DEFINER y auditoría WORM.',
    });
  };

  revocarRolPlataforma = async (req: Request, res: Response): Promise<void> => {
    const parse = RevocarRolSchema.safeParse(req.body);
    if (!parse.success) {
      throw new ValidationError({
        invalidParams: parse.error.issues.map((e) => ({
          name: e.path.join('.'),
          reason: e.message,
        })),
      });
    }

    const actorId = res.locals.actorSuperAdmin;
    const ipOrigen = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'] || 'HTTP-Client';

    const result = await this.service.revocarRolPlataforma({
      ...parse.data,
      actorId,
      ipOrigen,
      userAgent,
    });

    res.status(200).json({
      ok: true,
      correlationId: result.correlationId,
      mensaje: 'Rol de plataforma revocado exitosamente bajo función rectora SECURITY DEFINER y auditoría WORM.',
    });
  };

  listarAuditoria = async (req: Request, res: Response): Promise<void> => {
    const limit = typeof req.query.limite === 'string' ? parseInt(req.query.limite, 10) : 50;
    const data = await this.service.listarAuditoriaPlataforma(isNaN(limit) ? 50 : limit);
    res.status(200).json({ ok: true, data });
  };
}
