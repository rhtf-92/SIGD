import crypto from 'node:crypto';
import { Router } from 'express';
import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { cuentaActual } from '../../core/auth/cuenta-actual.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../shared/domain/errors/index.js';

type Estado = 'BORRADOR' | 'REGISTRADO' | 'EN_TRAMITE' | 'EN_REVISION' |
  'OBSERVADO' | 'SUBSANADO' | 'APROBADO' | 'PARA_FIRMA' | 'RESUELTO' | 'ANULADO';

export interface RequisitoWorkflowAcademico {
  idRequisito: number;
  descripcion: string;
  cumplido: boolean;
  fechaCumplimiento?: string;
}

export interface EtapaWorkflowAcademico {
  idEtapa: number;
  requisitos: RequisitoWorkflowAcademico[];
  observacion?: string;
  fechaInicio?: string;
  fechaFin?: string;
  [clave: string]: unknown;
}

export interface WorkflowAcademico {
  idTramite: number;
  cut: string;
  estado: Estado;
  etapaActualId: number;
  etapas: EtapaWorkflowAcademico[];
  certificado?: { hashSha256: string; cvd: string };
  [clave: string]: unknown;
}

const transicionSchema = z.discriminatedUnion('transicion', [
  z.object({ transicion: z.literal('tomar_revision') }),
  z.object({ transicion: z.literal('aprobar_etapa') }),
  z.object({ transicion: z.literal('observar'), observacion: z.string().trim().min(10).max(2000) }),
  z.object({ transicion: z.literal('subsanar') }),
  z.object({ transicion: z.literal('reanudar') }),
  z.object({ transicion: z.literal('firmar') }),
  z.object({ transicion: z.literal('anular') }),
  z.object({
    transicion: z.literal('marcar_requisito'),
    requisitoId: z.number().int().positive(),
    etapaId: z.number().int().positive(),
    cumplido: z.boolean(),
  }),
]);

type Transicion = z.infer<typeof transicionSchema>;

function exigirEstado(workflow: WorkflowAcademico, esperado: Estado, operacion: string): void {
  if (workflow.estado !== esperado) {
    throw new ConflictError({
      code: 'TRANSICION_FSM_INVALIDA',
      message: `${operacion} requiere estado ${esperado}; estado actual: ${workflow.estado}.`,
    });
  }
}

function etapaActual(workflow: WorkflowAcademico): EtapaWorkflowAcademico {
  const etapa = workflow.etapas.find((item) => item.idEtapa === workflow.etapaActualId);
  if (!etapa) {
    throw new ConflictError({ code: 'FSM_CORRUPTA', message: 'La etapa actual no existe en la definición del workflow.' });
  }
  return etapa;
}

export function aplicarTransicion(workflow: WorkflowAcademico, comando: Transicion): WorkflowAcademico {
  const ahora = new Date().toISOString();
  switch (comando.transicion) {
    case 'tomar_revision':
      exigirEstado(workflow, 'EN_TRAMITE', 'Tomar en revisión');
      workflow.estado = 'EN_REVISION';
      break;
    case 'aprobar_etapa': { 
      exigirEstado(workflow, 'EN_REVISION', 'Aprobar etapa');
      const actual = etapaActual(workflow);
      const pendientes = actual.requisitos.filter((requisito) => !requisito.cumplido);
      if (pendientes.length > 0) {
        throw new ConflictError({
          code: 'REQUISITOS_PENDIENTES',
          message: `No se puede aprobar: existen ${pendientes.length} requisito(s) pendientes.`,
        });
      }
      actual.fechaFin = ahora;
      const posicion = workflow.etapas.findIndex((item) => item.idEtapa === actual.idEtapa);
      const siguiente = workflow.etapas[posicion + 1];
      if (!siguiente) {
        workflow.estado = 'PARA_FIRMA';
      } else {
        siguiente.fechaInicio = ahora;
        workflow.etapaActualId = siguiente.idEtapa;
        workflow.estado = 'EN_TRAMITE';
      }
      break;
    }
    case 'observar':
      exigirEstado(workflow, 'EN_REVISION', 'Observar');
      etapaActual(workflow).observacion = comando.observacion;
      workflow.estado = 'OBSERVADO';
      break;
    case 'subsanar':
      exigirEstado(workflow, 'OBSERVADO', 'Registrar subsanación');
      workflow.estado = 'SUBSANADO';
      break;
    case 'reanudar':
      exigirEstado(workflow, 'SUBSANADO', 'Reanudar revisión');
      delete etapaActual(workflow).observacion;
      workflow.estado = 'EN_REVISION';
      break;
    case 'anular':
      if (workflow.estado !== 'EN_REVISION' && workflow.estado !== 'OBSERVADO') {
        throw new ConflictError({ code: 'TRANSICION_FSM_INVALIDA', message: 'Solo se puede anular en EN_REVISION u OBSERVADO.' });
      }
      workflow.estado = 'ANULADO';
      break;
    case 'marcar_requisito': { 
      if (workflow.estado === 'RESUELTO' || workflow.estado === 'ANULADO') {
        throw new ConflictError({ code: 'WORKFLOW_CERRADO', message: 'No se puede alterar un workflow cerrado.' });
      }
      const etapa = workflow.etapas.find((item) => item.idEtapa === comando.etapaId);
      const requisito = etapa?.requisitos.find((item) => item.idRequisito === comando.requisitoId);
      if (!requisito) throw new NotFoundError({ message: 'Requisito académico no encontrado.' });
      requisito.cumplido = comando.cumplido;
      if (comando.cumplido) requisito.fechaCumplimiento = ahora;
      else delete requisito.fechaCumplimiento;
      break;
    }
    case 'firmar': { 
      exigirEstado(workflow, 'PARA_FIRMA', 'Firmar documento');
      const pendientes = workflow.etapas.flatMap((etapa) => etapa.requisitos.filter((item) => !item.cumplido));
      if (pendientes.length > 0) {
        throw new ConflictError({ code: 'REQUISITOS_PENDIENTES', message: 'No se puede firmar con requisitos pendientes.' });
      }
      const hashSha256 = crypto.createHash('sha256')
        .update(`${workflow.idTramite}:${workflow.cut}:${ahora}:${JSON.stringify(workflow.etapas)}`)
        .digest('hex');
      workflow.certificado = {
        hashSha256,
        cvd: `CVD-${new Date().getUTCFullYear()}-TIT-${String(workflow.idTramite).padStart(6, '0')}-${hashSha256.slice(0, 8).toUpperCase()}`,
      };
      etapaActual(workflow).fechaFin = ahora;
      workflow.estado = 'RESUELTO';
      break;
    }
  }
  return workflow;
}

async function obtenerBloqueado(cliente: PoolClient, id: number): Promise<WorkflowAcademico> {
  const { rows } = await cliente.query<{ workflow: WorkflowAcademico }>(
    'SELECT workflow FROM sigd_doc.workflow_academico WHERE id_tramite=$1 FOR UPDATE', [id],
  );
  if (!rows[0]) throw new NotFoundError({ message: `Workflow académico ${id} no encontrado.` });
  return structuredClone(rows[0].workflow);
}

export function crearRouterWorkflowAcademico(pool: Pool): Router {
  const router = Router();

  router.use(async (req, res, next) => {
    try {
      res.locals.cuenta = await cuentaActual(pool, req);
      next();
    } catch (error) { next(error); }
  });

  router.get('/', async (_req, res, next) => {
    try {
      const { rows } = await pool.query<{ workflow: WorkflowAcademico }>(
        'SELECT workflow FROM sigd_doc.workflow_academico ORDER BY id_tramite',
      );
      res.json(rows.map((row) => row.workflow));
    } catch (error) { next(error); }
  });

  router.get('/:id', async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isSafeInteger(id) || id <= 0) {
        throw new ValidationError({ invalidParams: [{ name: 'id', reason: 'Debe ser un entero positivo.' }] });
      }
      const { rows } = await pool.query<{ workflow: WorkflowAcademico }>(
        'SELECT workflow FROM sigd_doc.workflow_academico WHERE id_tramite=$1', [id],
      );
      if (!rows[0]) throw new NotFoundError({ message: `Workflow académico ${id} no encontrado.` });
      res.json(rows[0].workflow);
    } catch (error) { next(error); }
  });

  router.post('/:id/transiciones', async (req, res, next) => {
    const cliente = await pool.connect();
    try {
      const cuenta = res.locals.cuenta as { roles: string[]; permisos: string[] };
      if (!cuenta.roles.some((rol) => ['SUPER_ADMIN', 'DIRECTOR', 'DOCENTE'].includes(rol)) &&
          !cuenta.permisos.includes('EXPEDIENTE_RESOLVER')) {
        throw new ForbiddenError({ message: 'El rol actual no puede operar workflows académicos.' });
      }
      const id = Number(req.params.id);
      if (!Number.isSafeInteger(id) || id <= 0) {
        throw new ValidationError({ invalidParams: [{ name: 'id', reason: 'Debe ser un entero positivo.' }] });
      }
      const analisis = transicionSchema.safeParse(req.body);
      if (!analisis.success) {
        throw new ValidationError({
          invalidParams: analisis.error.issues.map((issue) => ({ name: issue.path.join('.'), reason: issue.message })),
        });
      }
      await cliente.query('BEGIN');
      const actualizado = aplicarTransicion(await obtenerBloqueado(cliente, id), analisis.data);
      await cliente.query(
        `UPDATE sigd_doc.workflow_academico
         SET workflow=$2::jsonb, version=version+1, actualizado_en=now()
         WHERE id_tramite=$1`,
        [id, JSON.stringify(actualizado)],
      );
      await cliente.query('COMMIT');
      res.json(actualizado);
    } catch (error) {
      await cliente.query('ROLLBACK').catch(() => undefined);
      next(error);
    } finally { cliente.release(); }
  });

  return router;
}

