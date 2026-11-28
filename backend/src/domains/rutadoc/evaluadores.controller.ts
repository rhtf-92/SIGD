import { Router, type Request, type Response, type NextFunction } from 'express';
import type { Pool } from 'pg';
import { z } from 'zod';
import {
  AsignarEvaluadorSchema,
  ReasignarEvaluadorSchema,
  ReasignacionMasivaSchema,
} from './dto/asignarEvaluador.dto.js';
import {
  ObservarEvaluacionSchema,
  SubsanarExpedienteSchema,
  EmitirDictamenSchema,
  FiltrosBandejaDocenteSchema,
} from './dto/evaluacionDocente.dto.js';
import { CrearAnotacionInternaSchema } from './dto/anotacionesInternas.dto.js';
import {
  registrarAnotacionInterna,
  listarAnotacionesInternas,
} from './anotacionesInternas.service.js';
import {
  asignarEvaluador,
  reasignarEvaluador,
  reasignarMasivo,
  obtenerEvaluadorActivo,
  listarHistorialEvaluadores,
  listarDocentesElegibles,
  listarMisEvaluaciones,
  iniciarEvaluacion,
  obtenerDetalleEvaluacion,
  marcarRequisitoEvaluacion,
  registrarObservacionEvaluacion,
  registrarSubsanacionEstudiante,
  reanudarEvaluacionDocente,
  emitirDictamenDocente,
  supervisarEvaluacionesArea,
} from './evaluadores.service.js';
import type { ActorProviderRutaDoc } from './rutadoc.actor-provider.js';
import { ForbiddenError, UnauthorizedError, ValidationError } from '../../shared/domain/errors/index.js';

export function crearRouterEvaluadores(
  pool: Pool,
  proveedorActor: ActorProviderRutaDoc,
): Router {
  const router = Router();

  // 1. Rutas estáticas primero (para evitar colisiones con parámetros :id)
  // HITO 1: Bandeja del docente evaluador
  router.get('/mis-evaluaciones', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actor = await proveedorActor.obtenerActor(req);
      if (!actor) throw new UnauthorizedError();

      const filtros = FiltrosBandejaDocenteSchema.parse(req.query);
      const resultado = await listarMisEvaluaciones(pool, actor, filtros);
      res.status(200).json(resultado);
    } catch (error) {
      next(error);
    }
  });

  // HITO 8: Herramienta de supervisión para Coordinador de Área y Autoridades
  router.get('/supervision-area', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actor = await proveedorActor.obtenerActor(req);
      if (!actor) throw new UnauthorizedError();

      const areaId = typeof req.query.areaId === 'string' ? req.query.areaId : null;
      const resultado = await supervisarEvaluacionesArea(pool, actor, areaId);
      res.status(200).json(resultado);
    } catch (error) {
      next(error);
    }
  });

  router.post('/reasignar-masivo', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actor = await proveedorActor.obtenerActor(req);
      if (!actor) throw new UnauthorizedError();

      const datos = ReasignacionMasivaSchema.parse(req.body);
      const cliente = await pool.connect();

      try {
        await cliente.query('BEGIN');
        const resultado = await reasignarMasivo(cliente, actor, datos);
        await cliente.query('COMMIT');
        res.status(200).json(resultado);
      } catch (err) {
        await cliente.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        cliente.release();
      }
    } catch (error) {
      next(error);
    }
  });

  router.get('/docentes-elegibles', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const actor = await proveedorActor.obtenerActor(req);
      if (!actor) throw new UnauthorizedError();

      const areaId = typeof req.query.areaId === 'string' && z.string().uuid().safeParse(req.query.areaId).success
        ? req.query.areaId
        : actor.unidadOrganicaId ?? null;

      const docentes = await listarDocentesElegibles(pool, areaId);
      res.status(200).json({ ok: true, total: docentes.length, docentes });
    } catch (error) {
      next(error);
    }
  });

  // 2. Rutas parametrizadas por :id de expediente
  router.post('/:id/asignar-evaluador', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.id);
      if (!z.string().uuid().safeParse(expedienteId).success) {
        throw new ValidationError({
          invalidParams: [{ name: 'id', reason: 'Identificador de expediente inválido.' }],
        });
      }

      const actor = await proveedorActor.obtenerActor(req);
      if (!actor) throw new UnauthorizedError();

      const datos = AsignarEvaluadorSchema.parse(req.body);
      const cliente = await pool.connect();

      try {
        await cliente.query('BEGIN');
        const resultado = await asignarEvaluador(cliente, expedienteId, actor, datos);
        await cliente.query('COMMIT');
        res.status(201).json(resultado);
      } catch (err) {
        await cliente.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        cliente.release();
      }
    } catch (error) {
      next(error);
    }
  });

  router.post('/:id/reasignar-evaluador', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.id);
      if (!z.string().uuid().safeParse(expedienteId).success) {
        throw new ValidationError({
          invalidParams: [{ name: 'id', reason: 'Identificador de expediente inválido.' }],
        });
      }

      const actor = await proveedorActor.obtenerActor(req);
      if (!actor) throw new UnauthorizedError();

      const datos = ReasignarEvaluadorSchema.parse(req.body);
      const cliente = await pool.connect();

      try {
        await cliente.query('BEGIN');
        const resultado = await reasignarEvaluador(cliente, expedienteId, actor, datos);
        await cliente.query('COMMIT');
        res.status(200).json(resultado);
      } catch (err) {
        await cliente.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        cliente.release();
      }
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id/evaluador-activo', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.id);
      if (!z.string().uuid().safeParse(expedienteId).success) {
        return res.status(200).json({ ok: true, evaluador: null });
      }

      const actor = await proveedorActor.obtenerActor(req);
      if (!actor) throw new UnauthorizedError();

      if (!actor.puedeVerExpediente || !(await actor.puedeVerExpediente(expedienteId))) {
        throw new ForbiddenError({ message: 'No cuenta con autorización para visualizar este expediente.' });
      }

      try {
        const evaluador = await obtenerEvaluadorActivo(pool, expedienteId);
        res.status(200).json({ ok: true, evaluador });
      } catch {
        res.status(200).json({ ok: true, evaluador: null });
      }
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id/evaluadores', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.id);
      if (!z.string().uuid().safeParse(expedienteId).success) {
        return res.status(200).json({ ok: true, total: 0, historial: [] });
      }

      const actor = await proveedorActor.obtenerActor(req);
      if (!actor) throw new UnauthorizedError();

      if (!actor.puedeVerExpediente || !(await actor.puedeVerExpediente(expedienteId))) {
        throw new ForbiddenError({ message: 'No cuenta con autorización para visualizar este expediente.' });
      }

      try {
        const historial = await listarHistorialEvaluadores(pool, expedienteId);
        res.status(200).json({ ok: true, total: historial.length, historial });
      } catch {
        res.status(200).json({ ok: true, total: 0, historial: [] });
      }
    } catch (error) {
      next(error);
    }
  });


  // HITO 2: Confirmar recepción e iniciar evaluación técnica
  router.post('/:id/iniciar-evaluacion', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.id);
      if (!z.string().uuid().safeParse(expedienteId).success) {
        throw new ValidationError({
          invalidParams: [{ name: 'id', reason: 'Identificador de expediente inválido.' }],
        });
      }

      const actor = await proveedorActor.obtenerActor(req);
      if (!actor) throw new UnauthorizedError();

      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        const resultado = await iniciarEvaluacion(cliente, expedienteId, actor);
        await cliente.query('COMMIT');
        res.status(200).json(resultado);
      } catch (err) {
        await cliente.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        cliente.release();
      }
    } catch (error) {
      next(error);
    }
  });

  // HITO 3: Consulta integral para evaluación técnica y requisitos
  router.get('/:id/detalle-evaluacion', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.id);
      if (!z.string().uuid().safeParse(expedienteId).success) {
        throw new ValidationError({
          invalidParams: [{ name: 'id', reason: 'Identificador de expediente inválido.' }],
        });
      }

      const actor = await proveedorActor.obtenerActor(req);
      if (!actor) throw new UnauthorizedError();

      const resultado = await obtenerDetalleEvaluacion(pool, expedienteId, actor);
      res.status(200).json(resultado);
    } catch (error) {
      next(error);
    }
  });

  // HITO 3 (Cont.): Marcar requisito individual
  router.post('/:id/requisitos/:reqId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.id);
      const reqId = String(req.params.reqId);
      if (!z.string().uuid().safeParse(expedienteId).success || !z.string().uuid().safeParse(reqId).success) {
        throw new ValidationError({
          invalidParams: [{ name: 'id/reqId', reason: 'Identificadores inválidos.' }],
        });
      }

      const actor = await proveedorActor.obtenerActor(req);
      if (!actor) throw new UnauthorizedError();

      const cumplido = req.body.cumplido === true;
      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        const resultado = await marcarRequisitoEvaluacion(cliente, expedienteId, reqId, cumplido, actor);
        await cliente.query('COMMIT');
        res.status(200).json(resultado);
      } catch (err) {
        await cliente.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        cliente.release();
      }
    } catch (error) {
      next(error);
    }
  });

  // HITO 4: Registro formal de observaciones técnicas por docente
  router.post('/:id/observar-evaluacion', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.id);
      if (!z.string().uuid().safeParse(expedienteId).success) {
        throw new ValidationError({
          invalidParams: [{ name: 'id', reason: 'Identificador de expediente inválido.' }],
        });
      }

      const actor = await proveedorActor.obtenerActor(req);
      if (!actor) throw new UnauthorizedError();

      const datos = ObservarEvaluacionSchema.parse(req.body);
      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        const resultado = await registrarObservacionEvaluacion(cliente, expedienteId, actor, datos);
        await cliente.query('COMMIT');
        res.status(200).json(resultado);
      } catch (err) {
        await cliente.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        cliente.release();
      }
    } catch (error) {
      next(error);
    }
  });

  // HITO 5: Subsanación por el estudiante / administrado
  router.post('/:id/subsanar-estudiante', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.id);
      if (!z.string().uuid().safeParse(expedienteId).success) {
        throw new ValidationError({
          invalidParams: [{ name: 'id', reason: 'Identificador de expediente inválido.' }],
        });
      }

      const actor = await proveedorActor.obtenerActor(req);
      if (!actor) throw new UnauthorizedError();

      const datos = SubsanarExpedienteSchema.parse(req.body);
      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        const resultado = await registrarSubsanacionEstudiante(cliente, expedienteId, actor, datos);
        await cliente.query('COMMIT');
        res.status(200).json(resultado);
      } catch (err) {
        await cliente.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        cliente.release();
      }
    } catch (error) {
      next(error);
    }
  });

  // HITO 6: Reanudar evaluación post-subsanación
  router.post('/:id/reanudar-evaluacion', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.id);
      if (!z.string().uuid().safeParse(expedienteId).success) {
        throw new ValidationError({
          invalidParams: [{ name: 'id', reason: 'Identificador de expediente inválido.' }],
        });
      }

      const actor = await proveedorActor.obtenerActor(req);
      if (!actor) throw new UnauthorizedError();

      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        const resultado = await reanudarEvaluacionDocente(cliente, expedienteId, actor);
        await cliente.query('COMMIT');
        res.status(200).json(resultado);
      } catch (err) {
        await cliente.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        cliente.release();
      }
    } catch (error) {
      next(error);
    }
  });

  // HITO 7: Emisión de dictamen técnico docente
  router.post('/:id/emitir-dictamen', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.id);
      if (!z.string().uuid().safeParse(expedienteId).success) {
        throw new ValidationError({
          invalidParams: [{ name: 'id', reason: 'Identificador de expediente inválido.' }],
        });
      }

      const actor = await proveedorActor.obtenerActor(req);
      if (!actor) throw new UnauthorizedError();

      const datos = EmitirDictamenSchema.parse(req.body);
      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        const resultado = await emitirDictamenDocente(cliente, expedienteId, actor, datos);
        await cliente.query('COMMIT');
        res.status(200).json(resultado);
      } catch (err) {
        await cliente.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        cliente.release();
      }
    } catch (error) {
      next(error);
    }
  });

  // HITO 8: Módulo de Anotaciones Internas de Seguimiento Académico
  router.post('/:id/anotaciones-internas', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.id);
      if (!z.string().uuid().safeParse(expedienteId).success) {
        throw new ValidationError({
          invalidParams: [{ name: 'id', reason: 'Identificador de expediente inválido.' }],
        });
      }

      const actor = await proveedorActor.obtenerActor(req);
      if (!actor) throw new UnauthorizedError();

      const datos = CrearAnotacionInternaSchema.parse(req.body);
      const cliente = await pool.connect();
      try {
        await cliente.query('BEGIN');
        const anotacion = await registrarAnotacionInterna(cliente, expedienteId, actor, datos);
        await cliente.query('COMMIT');
        res.status(201).json({
          ok: true,
          mensaje: 'Anotación interna registrada exitosamente.',
          anotacion,
        });
      } catch (err) {
        await cliente.query('ROLLBACK').catch(() => {});
        throw err;
      } finally {
        cliente.release();
      }
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id/anotaciones-internas', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const expedienteId = String(req.params.id);
      if (!z.string().uuid().safeParse(expedienteId).success) {
        return res.status(200).json({ ok: true, anotaciones: [], total: 0 });
      }

      const actor = await proveedorActor.obtenerActor(req);
      if (!actor) throw new UnauthorizedError();

      try {
        const resultado = await listarAnotacionesInternas(pool, expedienteId, actor);
        res.status(200).json(resultado);
      } catch {
        res.status(200).json({ ok: true, anotaciones: [], total: 0 });
      }
    } catch (error) {
      next(error);
    }
  });

  return router;
}
