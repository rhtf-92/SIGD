import type { Pool, PoolClient } from 'pg';
import type {
  CrearWorkflowDefinicionInput,
  CrearWorkflowVersionInput,
  DtoWorkflowDefinicion,
  DtoWorkflowInstancia,
  DtoWorkflowVersion,
  RegistroHistorialPaso,
} from './workflow.types.js';

function formatearFechaIso(fecha: any): string {
  if (!fecha) return new Date().toISOString();
  if (fecha instanceof Date) return fecha.toISOString();
  return new Date(fecha).toISOString();
}

function formatearFechaIsoNullable(fecha: any): string | null {
  if (!fecha) return null;
  if (fecha instanceof Date) return fecha.toISOString();
  return new Date(fecha).toISOString();
}

export class WorkflowRepository {
  constructor(private readonly pool: Pool) {}

  async crearDefinicion(
    input: CrearWorkflowDefinicionInput,
    clienteParam?: PoolClient | Pool,
  ): Promise<DtoWorkflowDefinicion> {
    const db = clienteParam ?? this.pool;
    const { rows } = await db.query<{
      id_workflow: string;
      codigo: string;
      nombre: string;
      descripcion: string | null;
      activo: boolean;
      proveniencia: string;
      fuente_original: string;
      estado_homologacion: string;
      creado_en: Date;
    }>(
      `INSERT INTO sigd_rut.workflow_definicion (
        codigo, nombre, descripcion, proveniencia, fuente_original, estado_homologacion
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id_workflow, codigo, nombre, descripcion, activo, proveniencia, fuente_original, estado_homologacion, creado_en`,
      [
        input.codigo,
        input.nombre,
        input.descripcion ?? null,
        input.proveniencia ?? 'NO_DETERMINADO',
        input.fuenteOriginal ?? 'NO_DETERMINADO',
        input.estadoHomologacion ?? 'PENDIENTE_HOMOLOGACION',
      ],
    );

    const r = rows[0];
    return {
      idWorkflow: r.id_workflow,
      codigo: r.codigo,
      nombre: r.nombre,
      descripcion: r.descripcion,
      activo: r.activo,
      proveniencia: r.proveniencia as any,
      fuenteOriginal: r.fuente_original,
      estadoHomologacion: r.estado_homologacion as any,
      creadoEn: formatearFechaIso(r.creado_en),
    };
  }

  async obtenerDefinicionPorCodigo(
    codigo: string,
    clienteParam?: PoolClient | Pool,
  ): Promise<DtoWorkflowDefinicion | null> {
    const db = clienteParam ?? this.pool;
    const { rows } = await db.query<{
      id_workflow: string;
      codigo: string;
      nombre: string;
      descripcion: string | null;
      activo: boolean;
      proveniencia: string;
      fuente_original: string;
      estado_homologacion: string;
      creado_en: Date;
    }>(
      `SELECT id_workflow, codigo, nombre, descripcion, activo, proveniencia, fuente_original, estado_homologacion, creado_en
         FROM sigd_rut.workflow_definicion
        WHERE codigo = $1
        LIMIT 1`,
      [codigo],
    );

    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      idWorkflow: r.id_workflow,
      codigo: r.codigo,
      nombre: r.nombre,
      descripcion: r.descripcion,
      activo: r.activo,
      proveniencia: r.proveniencia as any,
      fuenteOriginal: r.fuente_original,
      estadoHomologacion: r.estado_homologacion as any,
      creadoEn: formatearFechaIso(r.creado_en),
    };
  }

  async crearVersion(
    input: CrearWorkflowVersionInput,
    clienteParam?: PoolClient | Pool,
  ): Promise<DtoWorkflowVersion> {
    const db = clienteParam ?? this.pool;
    const { rows } = await db.query<{
      id_version: string;
      id_workflow: string;
      version: string;
      codigo_completo: string;
      descripcion: string | null;
      activo: boolean;
      proveniencia: string;
      fuente_original: string;
      estado_homologacion: string;
      pasos: any;
      creado_en: Date;
    }>(
      `INSERT INTO sigd_rut.workflow_version (
        id_workflow, version, codigo_completo, descripcion, activo, proveniencia, fuente_original, estado_homologacion, pasos
      ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
      RETURNING id_version, id_workflow, version, codigo_completo, descripcion, activo, proveniencia, fuente_original, estado_homologacion, pasos, creado_en`,
      [
        input.idWorkflow,
        input.version,
        input.codigoCompleto,
        input.descripcion ?? null,
        input.activo ?? false,
        input.proveniencia ?? 'NO_DETERMINADO',
        input.fuenteOriginal ?? 'NO_DETERMINADO',
        input.estadoHomologacion ?? 'PENDIENTE_HOMOLOGACION',
        JSON.stringify(input.pasos ?? []),
      ],
    );

    const r = rows[0];
    return {
      idVersion: r.id_version,
      idWorkflow: r.id_workflow,
      version: r.version,
      codigoCompleto: r.codigo_completo,
      descripcion: r.descripcion,
      activo: r.activo,
      proveniencia: r.proveniencia as any,
      fuenteOriginal: r.fuente_original,
      estadoHomologacion: r.estado_homologacion as any,
      pasos: r.pasos ?? [],
      creadoEn: formatearFechaIso(r.creado_en),
    };
  }

  async obtenerVersionPorCodigo(
    codigoCompleto: string,
    clienteParam?: PoolClient | Pool,
  ): Promise<DtoWorkflowVersion | null> {
    const db = clienteParam ?? this.pool;
    const { rows } = await db.query<{
      id_version: string;
      id_workflow: string;
      version: string;
      codigo_completo: string;
      descripcion: string | null;
      activo: boolean;
      proveniencia: string;
      fuente_original: string;
      estado_homologacion: string;
      pasos: any;
      creado_en: Date;
    }>(
      `SELECT id_version, id_workflow, version, codigo_completo, descripcion, activo, proveniencia, fuente_original, estado_homologacion, pasos, creado_en
         FROM sigd_rut.workflow_version
        WHERE codigo_completo = $1
        LIMIT 1`,
      [codigoCompleto],
    );

    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      idVersion: r.id_version,
      idWorkflow: r.id_workflow,
      version: r.version,
      codigoCompleto: r.codigo_completo,
      descripcion: r.descripcion,
      activo: r.activo,
      proveniencia: r.proveniencia as any,
      fuenteOriginal: r.fuente_original,
      estadoHomologacion: r.estado_homologacion as any,
      pasos: r.pasos ?? [],
      creadoEn: formatearFechaIso(r.creado_en),
    };
  }

  async obtenerVersionPorId(
    idVersion: string,
    clienteParam?: PoolClient | Pool,
  ): Promise<DtoWorkflowVersion | null> {
    const db = clienteParam ?? this.pool;
    const { rows } = await db.query<{
      id_version: string;
      id_workflow: string;
      version: string;
      codigo_completo: string;
      descripcion: string | null;
      activo: boolean;
      proveniencia: string;
      fuente_original: string;
      estado_homologacion: string;
      pasos: any;
      creado_en: Date;
    }>(
      `SELECT id_version, id_workflow, version, codigo_completo, descripcion, activo, proveniencia, fuente_original, estado_homologacion, pasos, creado_en
         FROM sigd_rut.workflow_version
        WHERE id_version = $1::uuid
        LIMIT 1`,
      [idVersion],
    );

    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      idVersion: r.id_version,
      idWorkflow: r.id_workflow,
      version: r.version,
      codigoCompleto: r.codigo_completo,
      descripcion: r.descripcion,
      activo: r.activo,
      proveniencia: r.proveniencia as any,
      fuenteOriginal: r.fuente_original,
      estadoHomologacion: r.estado_homologacion as any,
      pasos: r.pasos ?? [],
      creadoEn: formatearFechaIso(r.creado_en),
    };
  }

  async asignarWorkflowAProcedimiento(
    idProcedimiento: string,
    idVersionWorkflow: string,
    clienteParam?: PoolClient | Pool,
  ): Promise<void> {
    const db = clienteParam ?? this.pool;
    await db.query(
      `INSERT INTO sigd_rut.workflow_procedimiento_config (
        id_procedimiento, id_version_workflow, activo
      ) VALUES ($1::uuid, $2::uuid, true)
      ON CONFLICT (id_procedimiento, id_version_workflow) DO UPDATE SET activo = true, actualizado_en = now()`,
      [idProcedimiento, idVersionWorkflow],
    );
  }

  async obtenerVersionPorProcedimiento(
    idProcedimiento: string,
    clienteParam?: PoolClient | Pool,
  ): Promise<DtoWorkflowVersion | null> {
    const db = clienteParam ?? this.pool;
    const { rows } = await db.query<{
      id_version: string;
      id_workflow: string;
      version: string;
      codigo_completo: string;
      descripcion: string | null;
      activo: boolean;
      proveniencia: string;
      fuente_original: string;
      estado_homologacion: string;
      pasos: any;
      creado_en: Date;
    }>(
      `SELECT v.id_version, v.id_workflow, v.version, v.codigo_completo, v.descripcion, v.activo,
              v.proveniencia, v.fuente_original, v.estado_homologacion, v.pasos, v.creado_en
         FROM sigd_rut.workflow_procedimiento_config c
         JOIN sigd_rut.workflow_version v ON v.id_version = c.id_version_workflow
        WHERE c.id_procedimiento = $1::uuid
          AND c.activo = true
          AND v.activo = true
        LIMIT 1`,
      [idProcedimiento],
    );

    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      idVersion: r.id_version,
      idWorkflow: r.id_workflow,
      version: r.version,
      codigoCompleto: r.codigo_completo,
      descripcion: r.descripcion,
      activo: r.activo,
      proveniencia: r.proveniencia as any,
      fuenteOriginal: r.fuente_original,
      estadoHomologacion: r.estado_homologacion as any,
      pasos: r.pasos ?? [],
      creadoEn: formatearFechaIso(r.creado_en),
    };
  }

  async crearInstancia(
    expedienteId: string,
    idVersionWorkflow: string,
    totalPasos: number,
    clienteParam?: PoolClient | Pool,
  ): Promise<DtoWorkflowInstancia> {
    const db = clienteParam ?? this.pool;
    const { rows } = await db.query<{
      id_instancia: string;
      expediente_id: string;
      id_version_workflow: string;
      paso_actual: number;
      total_pasos: number;
      estado_instancia: string;
      historial_pasos: any;
      iniciado_en: Date;
      finalizado_en: Date | null;
    }>(
      `INSERT INTO sigd_rut.workflow_instancia (
        expediente_id, id_version_workflow, paso_actual, total_pasos, estado_instancia
      ) VALUES ($1::uuid, $2::uuid, 1, $3, 'EN_CURSO')
      ON CONFLICT (expediente_id) DO UPDATE SET
        id_version_workflow = EXCLUDED.id_version_workflow,
        total_pasos = EXCLUDED.total_pasos
      RETURNING id_instancia, expediente_id, id_version_workflow, paso_actual, total_pasos, estado_instancia, historial_pasos, iniciado_en, finalizado_en`,
      [expedienteId, idVersionWorkflow, totalPasos],
    );

    const r = rows[0];
    return {
      idInstancia: r.id_instancia,
      expedienteId: r.expediente_id,
      idVersionWorkflow: r.id_version_workflow,
      pasoActual: r.paso_actual,
      totalPasos: r.total_pasos,
      estadoInstancia: r.estado_instancia as any,
      historialPasos: r.historial_pasos ?? [],
      iniciadoEn: formatearFechaIso(r.iniciado_en),
      finalizadoEn: formatearFechaIsoNullable(r.finalizado_en),
    };
  }

  async obtenerInstanciaPorExpediente(
    expedienteId: string,
    clienteParam?: PoolClient | Pool,
  ): Promise<DtoWorkflowInstancia | null> {
    const db = clienteParam ?? this.pool;
    const { rows } = await db.query<{
      id_instancia: string;
      expediente_id: string;
      id_version_workflow: string;
      codigo_completo: string;
      paso_actual: number;
      total_pasos: number;
      estado_instancia: string;
      historial_pasos: any;
      iniciado_en: Date;
      finalizado_en: Date | null;
    }>(
      `SELECT i.id_instancia, i.expediente_id, i.id_version_workflow, v.codigo_completo,
              i.paso_actual, i.total_pasos, i.estado_instancia, i.historial_pasos,
              i.iniciado_en, i.finalizado_en
         FROM sigd_rut.workflow_instancia i
         JOIN sigd_rut.workflow_version v ON v.id_version = i.id_version_workflow
        WHERE i.expediente_id = $1::uuid
        LIMIT 1`,
      [expedienteId],
    );

    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      idInstancia: r.id_instancia,
      expedienteId: r.expediente_id,
      idVersionWorkflow: r.id_version_workflow,
      codigoVersion: r.codigo_completo,
      pasoActual: r.paso_actual,
      totalPasos: r.total_pasos,
      estadoInstancia: r.estado_instancia as any,
      historialPasos: r.historial_pasos ?? [],
      iniciadoEn: formatearFechaIso(r.iniciado_en),
      finalizadoEn: formatearFechaIsoNullable(r.finalizado_en),
    };
  }

  async avanzarPaso(
    expedienteId: string,
    nuevoPaso: number,
    registro: RegistroHistorialPaso,
    finalizado: boolean = false,
    clienteParam?: PoolClient | Pool,
  ): Promise<void> {
    const db = clienteParam ?? this.pool;
    await db.query(
      `UPDATE sigd_rut.workflow_instancia
          SET paso_actual = $2,
              estado_instancia = CASE WHEN $3 = true THEN 'COMPLETADO' ELSE estado_instancia END,
              finalizado_en = CASE WHEN $3 = true THEN now() ELSE finalizado_en END,
              historial_pasos = COALESCE(historial_pasos, '[]'::jsonb) || $4::jsonb
        WHERE expediente_id = $1::uuid`,
      [
        expedienteId,
        nuevoPaso,
        finalizado,
        JSON.stringify([registro]),
      ],
    );
  }
}
