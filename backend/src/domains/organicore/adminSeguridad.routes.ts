import { Router } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import { autorizarPermisos, PERMISOS_RBAC } from '../../core/auth/auth.guard.js';
import { crearAdminConfiguracionService } from './adminConfiguracion.service.js';

const politicasSchema = z.object({
  maxIntentosFallidos: z.number().int().min(1).max(20),
  minutosBloqueo: z.number().int().min(1).max(1440),
  minutosSesion: z.number().int().min(5).max(1440),
}).strict();
const idSchema = z.string().uuid();
const desbloqueoSchema = z.object({ justificacion: z.string().trim().min(10).max(1000) }).strict();
const pagingSchema = z.object({
  limite: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
}).strict();

export function crearRouterAdminSeguridad(pool: Pool): Router {
  const router = Router();
  const service = crearAdminConfiguracionService(pool);
  router.get('/politicas', autorizarPermisos(PERMISOS_RBAC.ADMIN_ACCESO), async (_req, res) => {
    res.json({ politicas: await service.obtenerPoliticas() });
  });
  router.put('/politicas', autorizarPermisos(PERMISOS_RBAC.ADMIN_ACCESO), async (req, res) => {
    const usuarioId = req.cuentaActual?.idUsuario;
    if (!usuarioId) throw new Error('La identidad autenticada es requerida.');
    res.json(await service.guardarPoliticas(politicasSchema.parse(req.body), usuarioId));
  });
  router.get('/intentos', autorizarPermisos(PERMISOS_RBAC.AUDITORIA_LEER), async (req, res) => {
    const page = pagingSchema.parse(req.query);
    res.json(await service.listarIntentos(page.limite, page.offset));
  });
  router.get('/cuentas-bloqueadas', autorizarPermisos(PERMISOS_RBAC.USUARIOS_LEER), async (_req, res) => {
    res.json(await service.listarCuentasBloqueadas());
  });
  router.post('/cuentas/:id/desbloquear', autorizarPermisos(PERMISOS_RBAC.USUARIOS_GESTIONAR), async (req, res) => {
    const usuarioId = req.cuentaActual?.idUsuario;
    if (!usuarioId) throw new Error('La identidad autenticada es requerida.');
    const id = idSchema.parse(req.params.id);
    const { justificacion } = desbloqueoSchema.parse(req.body);
    res.json(await service.desbloquearCuenta(id, justificacion, usuarioId));
  });
  return router;
}
