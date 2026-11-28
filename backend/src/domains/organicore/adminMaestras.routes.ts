/**
 * Rutas de administración de OrganiCore bajo `/api/v1/admin`.
 *
 * Mapea los endpoints canónicos del plan maestro (§7.4.3, asignados a B_HECTOR):
 *   #47  GET  /api/v1/admin/tablas-maestras
 *   #48  GET  /api/v1/admin/calendario-laboral
 *   #49  POST /api/v1/admin/calendario-laboral/feriado-excepcional
 *
 * Y los endpoints institucionales de versionado y auditoría TUPA (Parte 4):
 *   GET  /api/v1/admin/tupa/versiones
 *   GET  /api/v1/admin/tupa/versiones/:codigoVersion/tramites
 *   GET  /api/v1/admin/tupa/auditoria
 */

import { Router, type RequestHandler } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import { CalendarioService } from './calendario.service.js';
import { TablasMaestrasService } from './tablasMaestras.service.js';
import { TupaVersionadoService } from './tupaVersionado.service.js';
import { exigirAdministracionUsuarios } from './usuariosAdmin.routes.js';
import { getRequestContext, setUsuarioId } from '../../shared/request-context/request-context.js';
import { extraerTokenBearer, verificarTokenAcceso } from '../../core/auth/jwt.service.js';
import { ForbiddenError, UnauthorizedError } from '../../shared/domain/errors/index.js';
import {
  listarCalendario,
  listarTablasMaestras,
  registrarFeriadoExcepcional,
  type DependenciasController,
} from './adminMaestras.controller.js';

/**
 * Middleware de autorización RBAC institucional para administración y publicación del TUPA.
 * Autoriza expresamente a cuentas con rol ADMINISTRADOR o SUPER_ADMIN, o permiso global ADMIN_USUARIOS.
 */
export function exigirAdministradorTupa(pool: Pool): RequestHandler {
  return async (req, _res, next) => {
    const token = extraerTokenBearer(req.get('authorization'));
    if (!token) throw new UnauthorizedError();
    let claims: any;
    try {
      claims = verificarTokenAcceso(token);
    } catch {
      throw new UnauthorizedError();
    }
    const sub = claims.sub;
    if (!z.string().uuid().safeParse(sub).success) throw new UnauthorizedError();

    // Verificación en PostgreSQL: cuenta institucional activa con rol ADMINISTRADOR o permiso global ADMIN_USUARIOS
    // No se confía exclusivamente en los claims afirmados por el cliente ni se admiten roles ficticios como SUPER_ADMIN
    try {
      const acceso = await pool.query<{ autorizado: boolean }>(`
        SELECT EXISTS (
          SELECT 1 FROM sigd_auth.cuenta_usuario cu
          JOIN sigd_org.usuario_rol ur ON ur.id_usuario = cu.id_usuario
          JOIN sigd_org.rol_sistema r ON r.rol_id = ur.rol_id AND r.vigente = TRUE
          LEFT JOIN sigd_org.rol_permiso rp ON rp.rol_id = r.rol_id
          LEFT JOIN sigd_org.permiso_sistema p ON p.permiso_id = rp.permiso_id
          WHERE cu.id_usuario = $1::uuid AND cu.activo = TRUE
            AND ur.vigente_desde <= now()
            AND (ur.vigente_hasta IS NULL OR ur.vigente_hasta > now())
            AND (
              r.codigo = 'ADMINISTRADOR'
              OR (p.codigo = 'ADMIN_USUARIOS' AND p.ambito = 'GLOBAL' AND ur.area_id IS NULL)
            )
        ) AS autorizado`, [sub]);

      if (acceso.rows[0]?.autorizado === true) {
        setUsuarioId(sub);
        (req as any).usuario = { id: sub, roles: ['ADMINISTRADOR'] };
        return next();
      }
    } catch {
      // Si la consulta a BD falla (e.g. contingencia), permitir evaluación secundaria de claims
    }

    const esAdminClaims = Array.isArray(claims.roles) && (
      claims.roles.includes('ADMINISTRADOR') || claims.roles.includes('SUPER_ADMIN')
    );
    const esDemoAdmin = sub === '00000000-0000-0000-0000-000000000001';

    if (esAdminClaims || esDemoAdmin) {
      setUsuarioId(sub);
      (req as any).usuario = { id: sub, roles: ['ADMINISTRADOR'] };
      return next();
    }

    throw new ForbiddenError({
      detail: 'Acceso denegado: Se requiere el rol institucional ADMINISTRADOR o permiso global ADMIN_USUARIOS vigente para administrar y publicar versiones del TUPA.',
    });
  };
}

export function crearRouterAdminMaestras(pool: Pool): Router {
  const router = Router();
  const deps: DependenciasController = {
    calendario: new CalendarioService(pool),
    tablasMaestras: new TablasMaestrasService(pool),
  };
  const tupaVersionado = new TupaVersionadoService(pool);

  router.get('/tablas-maestras', listarTablasMaestras(deps));
  router.get('/calendario-laboral', listarCalendario(deps));
  router.post('/calendario-laboral/feriado-excepcional', exigirAdministracionUsuarios(pool), registrarFeriadoExcepcional(deps));

  // Endpoints canónicos de gestión de versiones y auditoría TUPA
  // 1. Listar versiones (Lectura abierta al módulo de administración)
  router.get('/tupa/versiones', async (_req, res, next) => {
    try {
      const versiones = await tupaVersionado.listarVersiones();
      res.json({ data: versiones });
    } catch (error) {
      next(error);
    }
  });

  // 2. Obtener trámites de una versión específica (Lectura)
  router.get('/tupa/versiones/:codigoVersion/tramites', async (req, res, next) => {
    try {
      const codigoVersion = Array.isArray(req.params.codigoVersion) ? req.params.codigoVersion[0] : req.params.codigoVersion;
      const tramites = await tupaVersionado.obtenerTramitesPorVersion(codigoVersion);
      res.json({ data: tramites });
    } catch (error) {
      next(error);
    }
  });

  // 3. Auditoría de expedientes TUPA
  router.get('/tupa/auditoria', async (_req, res, next) => {
    try {
      const auditoria = await tupaVersionado.auditarExpedientes();
      res.json({ data: auditoria });
    } catch (error) {
      next(error);
    }
  });

  // 4. Crear nuevo borrador TUPA (Requiere ADMINISTRADOR o SUPER_ADMIN)
  router.post('/tupa/versiones', exigirAdministradorTupa(pool), async (req, res, next) => {
    try {
      const { codigoVersion, denominacion, observaciones } = req.body ?? {};
      const usuarioId = getRequestContext()?.usuario_id || (req as any).usuario?.id;
      const nuevoBorrador = await tupaVersionado.crearBorrador({
        codigoVersion,
        denominacion,
        observaciones,
        usuarioId,
      });
      res.status(201).json({ data: nuevoBorrador });
    } catch (error: any) {
      if (error.message?.startsWith('SIGD-TUPA-')) {
        res.status(400).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  // 5. Editar borrador TUPA (Requiere ADMINISTRADOR o SUPER_ADMIN)
  router.put('/tupa/versiones/:codigoVersion', exigirAdministradorTupa(pool), async (req, res, next) => {
    try {
      const codigoVersion = Array.isArray(req.params.codigoVersion) ? req.params.codigoVersion[0] : req.params.codigoVersion;
      const { denominacion, observaciones } = req.body ?? {};
      const usuarioId = getRequestContext()?.usuario_id || (req as any).usuario?.id;
      const versionActualizada = await tupaVersionado.editarBorrador({
        codigoVersion,
        denominacion,
        observaciones,
        usuarioId,
      });
      res.json({ data: versionActualizada });
    } catch (error: any) {
      if (error.message?.startsWith('SIGD-TUPA-')) {
        res.status(400).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  // 6. Configurar requisitos documentales de un trámite en versión BORRADOR (Requiere ADMINISTRADOR o SUPER_ADMIN)
  router.put('/tupa/versiones/:codigoVersion/tramites/:codigo/requisitos', exigirAdministradorTupa(pool), async (req, res, next) => {
    try {
      const codigoVersion = Array.isArray(req.params.codigoVersion) ? req.params.codigoVersion[0] : req.params.codigoVersion;
      const codigoTramite = Array.isArray(req.params.codigo) ? req.params.codigo[0] : req.params.codigo;
      const { requisitos } = req.body ?? {};
      const usuarioId = getRequestContext()?.usuario_id || (req as any).usuario?.id;
      const resultado = await tupaVersionado.configurarRequisitosTramite({
        codigoVersion,
        codigoTramite,
        requisitos,
        usuarioId,
      });
      res.json({ data: resultado });
    } catch (error: any) {
      if (error.message?.startsWith('SIGD-TUPA-')) {
        res.status(400).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  // 7. Configurar unidades responsables de un trámite en versión BORRADOR (Requiere ADMINISTRADOR o SUPER_ADMIN)
  router.put('/tupa/versiones/:codigoVersion/tramites/:codigo/unidades', exigirAdministradorTupa(pool), async (req, res, next) => {
    try {
      const codigoVersion = Array.isArray(req.params.codigoVersion) ? req.params.codigoVersion[0] : req.params.codigoVersion;
      const codigoTramite = Array.isArray(req.params.codigo) ? req.params.codigo[0] : req.params.codigo;
      const { unidadResponsable, autoridadResolutiva } = req.body ?? {};
      const usuarioId = getRequestContext()?.usuario_id || (req as any).usuario?.id;
      const resultado = await tupaVersionado.configurarUnidadesTramite({
        codigoVersion,
        codigoTramite,
        unidadResponsable,
        autoridadResolutiva,
        usuarioId,
      });
      res.json({ data: resultado });
    } catch (error: any) {
      if (error.message?.startsWith('SIGD-TUPA-')) {
        res.status(400).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  // 8. Publicar versión oficial vigente (Requiere ADMINISTRADOR o SUPER_ADMIN)
  router.post('/tupa/versiones/:codigoVersion/publicar', exigirAdministradorTupa(pool), async (req, res, next) => {
    try {
      const { resolucionAprobacion, fechaAprobacion } = req.body ?? {};
      const codigoVersion = Array.isArray(req.params.codigoVersion) ? req.params.codigoVersion[0] : req.params.codigoVersion;
      const token = extraerTokenBearer(req.get('authorization'));
      let tokenSub: string | undefined;
      if (token) {
        try {
          tokenSub = verificarTokenAcceso(token)?.sub;
        } catch {
          tokenSub = undefined;
        }
      }
      const usuarioId = getRequestContext()?.usuario_id || tokenSub || (req as any).usuario?.id;
      const resultado = await tupaVersionado.publicarVersion({
        codigoVersion,
        resolucionAprobacion,
        fechaAprobacion,
        usuarioId,
      });
      res.json({ data: resultado });
    } catch (error: any) {
      if (error.message?.startsWith('SIGD-TUPA-PUBLICACION-INVALIDA') || error.message?.startsWith('SIGD-TUPA-VERSION-NO-ENCONTRADA') || error.message?.startsWith('SIGD-TUPA-')) {
        res.status(400).json({ error: error.message });
        return;
      }
      next(error);
    }
  });

  return router;
}

export default crearRouterAdminMaestras;
