/**
 * Router para la gestión de Organización y Responsabilidades Temporales (Fase 5C)
 * Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
 */

import { Router, type Request, type Response } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import { resolverIdentidad } from '../../core/auth/auth.guard.js';
import { setUsuarioId } from '../../shared/request-context/request-context.js';
import { ForbiddenError, ValidationError } from '../../shared/domain/errors/index.js';
import { AuthorizationService } from '../../core/auth/authorization.service.js';
import { OrganizacionService } from './organizacion.service.js';
import type { TipoResponsabilidadTemporal, TipoUnidadOrganica } from './organizacion.types.js';

const crearUnidadSchema = z.object({
  codigo: z.string().min(1).max(20),
  nombre: z.string().min(1).max(100),
  tipoUnidad: z.enum(['DIRECCION', 'UNIDAD', 'AREA', 'OFICINA', 'SECRETARIA', 'SERVICIO', 'OTRO']).optional(),
  areaPadreId: z.string().uuid().nullable().optional(),
});

const crearCargoSchema = z.object({
  codigo: z.string().min(1).max(30),
  nombre: z.string().min(1).max(100),
  descripcion: z.string().optional().nullable(),
});

const crearAsignacionSchema = z.object({
  idUsuario: z.string().uuid(),
  cargoId: z.string().uuid(),
  areaId: z.string().uuid(),
  vigenteDesde: z.string().optional(),
  vigenteHasta: z.string().nullable().optional(),
  tipoDocumentoSustento: z.string().max(50).optional().nullable(),
  numeroDocumentoSustento: z.string().max(100).optional().nullable(),
  fechaDocumentoSustento: z.string().optional().nullable(),
});

const finalizarAsignacionSchema = z.object({
  fechaFinalizacion: z.string().optional(),
  motivoFinalizacion: z.string().max(255).optional(),
});

const crearResponsabilidadSchema = z.object({
  tipoResponsabilidad: z.enum(['ENCARGATURA', 'SUPLENCIA', 'DELEGACION', 'DESIGNACION_ESPECIFICA']),
  idUsuario: z.string().uuid(),
  titularUsuarioId: z.string().uuid().nullable().optional(),
  cargoId: z.string().uuid(),
  areaId: z.string().uuid(),
  vigenteDesde: z.string().optional(),
  vigenteHasta: z.string().nullable().optional(),
  tipoDocumentoSustento: z.string().max(50).optional().nullable(),
  numeroDocumentoSustento: z.string().max(100).optional().nullable(),
  fechaDocumentoSustento: z.string().optional().nullable(),
  alcance: z.record(z.string(), z.unknown()).nullable().optional(),
});

const finalizarResponsabilidadSchema = z.object({
  fechaFinalizacion: z.string().optional(),
  motivoFinalizacion: z.string().max(255).optional(),
});

const revocarResponsabilidadSchema = z.object({
  motivoRevocacion: z.string().min(1, 'El motivo de revocación es obligatorio').max(255),
  fechaRevocacion: z.string().optional(),
});

const anularResponsabilidadSchema = z.object({
  motivoAnulacion: z.string().min(1, 'El motivo de anulación es obligatorio').max(255),
});

async function exigirAutorizacionOrganizacion(
  req: Request,
  authService: AuthorizationService,
): Promise<string> {
  const identidad = resolverIdentidad(req);
  if (!identidad.roles.includes('ADMINISTRADOR')) {
    throw new ForbiddenError({
      message: 'Acceso restringido: se requiere rol ADMINISTRADOR para mutaciones organizacionales.',
      detail: 'Filtro preliminar de compatibilidad RBAC.',
    });
  }

  await authService.exigirAutorizacion({
    usuarioId: identidad.idUsuario,
    rolesDeclarados: identidad.roles,
    accion: 'ORGANIZACION_GESTIONAR',
  });

  setUsuarioId(identidad.idUsuario);
  return identidad.idUsuario;
}

export function crearRouterOrganizacion(pool: Pool): Router {
  const router = Router();
  const service = new OrganizacionService(pool);
  const authService = new AuthorizationService(pool);

  // ===========================================================================
  // 1. UNIDADES ORGÁNICAS
  // ===========================================================================

  router.get('/organizacion/unidades', async (req: Request, res: Response) => {
    resolverIdentidad(req);
    const soloVigentes = req.query.solo_vigentes !== 'false';
    const unidades = await service.listarUnidades(soloVigentes);
    res.status(200).json({ unidades });
  });

  router.get('/organizacion/unidades/arbol', async (req: Request, res: Response) => {
    resolverIdentidad(req);
    const arbol = await service.obtenerArbolOrganico();
    res.status(200).json({ arbol });
  });

  router.post('/organizacion/unidades', async (req: Request, res: Response) => {
    const usuarioEjecutorId = await exigirAutorizacionOrganizacion(req, authService);
    const parse = crearUnidadSchema.safeParse(req.body);
    if (!parse.success) {
      throw new ValidationError({
        message: 'Datos de unidad orgánica inválidos.',
        invalidParams: parse.error.issues.map((i) => ({ name: i.path.join('.'), reason: i.message })),
      });
    }

    const unidad = await service.crearUnidad(
      {
        ...parse.data,
        tipoUnidad: parse.data.tipoUnidad as TipoUnidadOrganica,
      },
      usuarioEjecutorId
    );
    res.status(201).json({ unidad });
  });

  // ===========================================================================
  // 2. CARGOS
  // ===========================================================================

  router.get('/organizacion/cargos', async (req: Request, res: Response) => {
    resolverIdentidad(req);
    const soloVigentes = req.query.solo_vigentes !== 'false';
    const cargos = await service.listarCargos(soloVigentes);
    res.status(200).json({ cargos });
  });

  router.post('/organizacion/cargos', async (req: Request, res: Response) => {
    const usuarioEjecutorId = await exigirAutorizacionOrganizacion(req, authService);
    const parse = crearCargoSchema.safeParse(req.body);
    if (!parse.success) {
      throw new ValidationError({
        message: 'Datos de cargo institucional inválidos.',
        invalidParams: parse.error.issues.map((i) => ({ name: i.path.join('.'), reason: i.message })),
      });
    }

    const cargo = await service.crearCargo(parse.data, usuarioEjecutorId);
    res.status(201).json({ cargo });
  });

  // ===========================================================================
  // 3. ASIGNACIONES
  // ===========================================================================

  router.get('/organizacion/asignaciones', async (req: Request, res: Response) => {
    resolverIdentidad(req);
    const asignaciones = await service.listarAsignaciones({
      areaId: typeof req.query.area_id === 'string' ? req.query.area_id : undefined,
      idUsuario: typeof req.query.id_usuario === 'string' ? req.query.id_usuario : undefined,
      cargoId: typeof req.query.cargo_id === 'string' ? req.query.cargo_id : undefined,
      soloActivos: req.query.solo_activos === 'true',
      fechaCorte: typeof req.query.fecha_corte === 'string' ? req.query.fecha_corte : undefined,
    });
    res.status(200).json({ asignaciones });
  });

  router.post('/organizacion/asignaciones', async (req: Request, res: Response) => {
    const usuarioEjecutorId = await exigirAutorizacionOrganizacion(req, authService);
    const parse = crearAsignacionSchema.safeParse(req.body);
    if (!parse.success) {
      throw new ValidationError({
        message: 'Datos de asignación de personal inválidos.',
        invalidParams: parse.error.issues.map((i) => ({ name: i.path.join('.'), reason: i.message })),
      });
    }

    const asignacion = await service.crearAsignacion(parse.data, usuarioEjecutorId);
    res.status(201).json({ asignacion });
  });

  router.put('/organizacion/asignaciones/:id/finalizar', async (req: Request, res: Response) => {
    const usuarioEjecutorId = await exigirAutorizacionOrganizacion(req, authService);
    const parse = finalizarAsignacionSchema.safeParse(req.body);
    if (!parse.success) {
      throw new ValidationError({
        message: 'Datos de finalización de asignación inválidos.',
        invalidParams: parse.error.issues.map((i) => ({ name: i.path.join('.'), reason: i.message })),
      });
    }

    const asignacion = await service.finalizarAsignacion(
      {
        idAsignacion: String(req.params.id ?? ''),
        ...parse.data,
      },
      usuarioEjecutorId
    );
    res.status(200).json({ asignacion });
  });

  // ===========================================================================
  // 4. RESPONSABILIDADES TEMPORALES
  // ===========================================================================

  router.get('/organizacion/responsabilidades-temporales', async (req: Request, res: Response) => {
    resolverIdentidad(req);
    const responsabilidades = await service.listarResponsabilidadesTemporales({
      tipoResponsabilidad: typeof req.query.tipo_responsabilidad === 'string'
        ? (req.query.tipo_responsabilidad as TipoResponsabilidadTemporal)
        : undefined,
      areaId: typeof req.query.area_id === 'string' ? req.query.area_id : undefined,
      idUsuario: typeof req.query.id_usuario === 'string' ? req.query.id_usuario : undefined,
      cargoId: typeof req.query.cargo_id === 'string' ? req.query.cargo_id : undefined,
      soloActivos: req.query.solo_activos === 'true',
      fechaCorte: typeof req.query.fecha_corte === 'string' ? req.query.fecha_corte : undefined,
    });
    res.status(200).json({ responsabilidades });
  });

  router.post('/organizacion/responsabilidades-temporales', async (req: Request, res: Response) => {
    const usuarioEjecutorId = await exigirAutorizacionOrganizacion(req, authService);
    const parse = crearResponsabilidadSchema.safeParse(req.body);
    if (!parse.success) {
      throw new ValidationError({
        message: 'Datos de responsabilidad temporal inválidos.',
        invalidParams: parse.error.issues.map((i) => ({ name: i.path.join('.'), reason: i.message })),
      });
    }

    const responsabilidad = await service.crearResponsabilidadTemporal(
      {
        ...parse.data,
        tipoResponsabilidad: parse.data.tipoResponsabilidad as TipoResponsabilidadTemporal,
        alcance: parse.data.alcance as any,
      },
      usuarioEjecutorId
    );
    res.status(201).json({ responsabilidad });
  });

  router.put('/organizacion/responsabilidades-temporales/:id/finalizar', async (req: Request, res: Response) => {
    const usuarioEjecutorId = await exigirAutorizacionOrganizacion(req, authService);
    const parse = finalizarResponsabilidadSchema.safeParse(req.body);
    if (!parse.success) {
      throw new ValidationError({
        message: 'Datos de finalización inválidos.',
        invalidParams: parse.error.issues.map((i) => ({ name: i.path.join('.'), reason: i.message })),
      });
    }

    const responsabilidad = await service.finalizarResponsabilidad(
      {
        idResponsabilidad: String(req.params.id ?? ''),
        ...parse.data,
      },
      usuarioEjecutorId
    );
    res.status(200).json({ responsabilidad });
  });

  router.put('/organizacion/responsabilidades-temporales/:id/revocar', async (req: Request, res: Response) => {
    const usuarioEjecutorId = await exigirAutorizacionOrganizacion(req, authService);
    const parse = revocarResponsabilidadSchema.safeParse(req.body);
    if (!parse.success) {
      throw new ValidationError({
        message: 'Datos de revocación inválidos.',
        invalidParams: parse.error.issues.map((i) => ({ name: i.path.join('.'), reason: i.message })),
      });
    }

    const responsabilidad = await service.revocarResponsabilidad(
      {
        idResponsabilidad: String(req.params.id ?? ''),
        ...parse.data,
      },
      usuarioEjecutorId
    );
    res.status(200).json({ responsabilidad });
  });

  router.put('/organizacion/responsabilidades-temporales/:id/anular', async (req: Request, res: Response) => {
    const usuarioEjecutorId = await exigirAutorizacionOrganizacion(req, authService);
    const parse = anularResponsabilidadSchema.safeParse(req.body);
    if (!parse.success) {
      throw new ValidationError({
        message: 'Datos de anulación inválidos.',
        invalidParams: parse.error.issues.map((i) => ({ name: i.path.join('.'), reason: i.message })),
      });
    }

    const responsabilidad = await service.anularResponsabilidad(
      {
        idResponsabilidad: String(req.params.id ?? ''),
        motivoAnulacion: parse.data.motivoAnulacion,
        usuarioEjecutorId,
      },
      usuarioEjecutorId
    );
    res.status(200).json({ responsabilidad });
  });

  return router;
}
