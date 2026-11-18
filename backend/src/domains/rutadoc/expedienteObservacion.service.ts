import type { PoolClient, Pool } from 'pg';
import { NotFoundError, ValidationError } from '../../shared/domain/errors/index.js';

export interface DtoExpedienteObservacion {
  idObservacion: string;
  expedienteId: string;
  numeroObservacion: number;
  estadoObservacion: 'OBSERVADO' | 'SUBSANADO' | 'REVISADO' | 'ANULADO';
  estadoAnteriorExpediente: string;
  motivo: string;
  observadoPorPersonaId: string;
  observadoPorUsuarioId: string;
  areaObservacionId: string;
  idMovimientoObservacion?: string | null;
  requisitosAfectados: string[];
  subsanadoEn?: string | null;
  subsanadoPorPersonaId?: string | null;
  subsanadoPorUsuarioId?: string | null;
  motivoSubsanacion?: string | null;
  idMovimientoSubsanacion?: string | null;
  creadoEn: string;
}

export interface RegistrarObservacionInput {
  expedienteId: string;
  motivo: string;
  requisitosAfectados?: string[];
  usuarioId: string;
  personaId: string;
  areaId: string;
  estadoAnterior: string;
  idMovimientoObservacion?: string;
}

export interface SubsanarObservacionInput {
  expedienteId: string;
  motivo: string;
  usuarioId: string;
  personaId: string;
  idMovimientoSubsanacion?: string;
}

export class ExpedienteObservacionService {
  constructor(private readonly pool: Pool) {}

  async registrarObservacion(
    input: RegistrarObservacionInput,
    clienteParam?: PoolClient | Pool,
  ): Promise<DtoExpedienteObservacion> {
    const db = clienteParam ?? this.pool;

    // 1. Obtener número de observación secuencial para este expediente
    const resCount = await db.query<{ total: string }>(
      `SELECT count(*)::text AS total FROM sigd_rut.expediente_observacion WHERE expediente_id = $1::uuid`,
      [input.expedienteId],
    );
    const numeroObservacion = (parseInt(resCount.rows[0]?.total ?? '0', 10) || 0) + 1;

    // 2. Insertar observación estructurada
    const { rows } = await db.query<{
      id_observacion: string;
      expediente_id: string;
      numero_observacion: number;
      estado_observacion: string;
      estado_anterior_expediente: string;
      motivo: string;
      observado_por_persona_id: string;
      observado_por_usuario_id: string;
      area_observacion_id: string;
      id_movimiento_observacion: string | null;
      requisitos_afectados: any;
      creado_en: Date;
    }>(
      `INSERT INTO sigd_rut.expediente_observacion (
        expediente_id, numero_observacion, estado_observacion, estado_anterior_expediente,
        motivo, observado_por_persona_id, observado_por_usuario_id, area_observacion_id,
        id_movimiento_observacion, requisitos_afectados
      ) VALUES ($1::uuid, $2, 'OBSERVADO', $3, $4, $5::uuid, $6::uuid, $7::uuid, $8::uuid, $9::jsonb)
      RETURNING id_observacion, expediente_id, numero_observacion, estado_observacion,
                estado_anterior_expediente, motivo, observado_por_persona_id, observado_por_usuario_id,
                area_observacion_id, id_movimiento_observacion, requisitos_afectados, creado_en`,
      [
        input.expedienteId,
        numeroObservacion,
        input.estadoAnterior,
        input.motivo,
        input.personaId,
        input.usuarioId,
        input.areaId,
        input.idMovimientoObservacion ?? null,
        JSON.stringify(input.requisitosAfectados ?? []),
      ],
    );

    // 3. Si existen requisitos afectados, marcar las últimas evidencias como OBSERVADO en 5F
    if (input.requisitosAfectados && input.requisitosAfectados.length > 0) {
      await db.query(
        `UPDATE sigd_doc.expediente_evidencia_requisito
            SET estado_validacion = 'OBSERVADO',
                observacion = $2
          WHERE expediente_id = $1::uuid
            AND id_requisito = ANY($3::uuid[])`,
        [input.expedienteId, input.motivo, input.requisitosAfectados],
      );
    }

    const r = rows[0];
    return {
      idObservacion: r.id_observacion,
      expedienteId: r.expediente_id,
      numeroObservacion: r.numero_observacion,
      estadoObservacion: r.estado_observacion as any,
      estadoAnteriorExpediente: r.estado_anterior_expediente,
      motivo: r.motivo,
      observadoPorPersonaId: r.observado_por_persona_id,
      observadoPorUsuarioId: r.observado_por_usuario_id,
      areaObservacionId: r.area_observacion_id,
      idMovimientoObservacion: r.id_movimiento_observacion,
      requisitosAfectados: r.requisitos_afectados ?? [],
      subsanadoEn: null,
      subsanadoPorPersonaId: null,
      subsanadoPorUsuarioId: null,
      motivoSubsanacion: null,
      idMovimientoSubsanacion: null,
      creadoEn: r.creado_en.toISOString(),
    };
  }

  async subsanarObservacion(
    input: SubsanarObservacionInput,
    clienteParam?: PoolClient | Pool,
  ): Promise<DtoExpedienteObservacion> {
    const db = clienteParam ?? this.pool;

    // Buscar la última observación pendiente
    const { rows: ultRows } = await db.query<{ id_observacion: string }>(
      `SELECT id_observacion
         FROM sigd_rut.expediente_observacion
        WHERE expediente_id = $1::uuid
          AND estado_observacion = 'OBSERVADO'
        ORDER BY numero_observacion DESC
        LIMIT 1`,
      [input.expedienteId],
    );

    if (ultRows.length === 0) {
      throw new NotFoundError({
        message: 'No existe una observación activa en estado OBSERVADO para subsanar.',
      });
    }

    const idObservacion = ultRows[0].id_observacion;

    const { rows } = await db.query<{
      id_observacion: string;
      expediente_id: string;
      numero_observacion: number;
      estado_observacion: string;
      estado_anterior_expediente: string;
      motivo: string;
      observado_por_persona_id: string;
      observado_por_usuario_id: string;
      area_observacion_id: string;
      id_movimiento_observacion: string | null;
      requisitos_afectados: any;
      subsanado_en: Date;
      subsanado_por_persona_id: string;
      subsanado_por_usuario_id: string;
      motivo_subsanacion: string;
      id_movimiento_subsanacion: string | null;
      creado_en: Date;
    }>(
      `UPDATE sigd_rut.expediente_observacion
          SET estado_observacion = 'SUBSANADO',
              subsanado_en = now(),
              subsanado_por_persona_id = $2::uuid,
              subsanado_por_usuario_id = $3::uuid,
              motivo_subsanacion = $4,
              id_movimiento_subsanacion = $5::uuid
        WHERE id_observacion = $1::uuid
        RETURNING *`,
      [
        idObservacion,
        input.personaId,
        input.usuarioId,
        input.motivo,
        input.idMovimientoSubsanacion ?? null,
      ],
    );

    const r = rows[0];
    return {
      idObservacion: r.id_observacion,
      expedienteId: r.expediente_id,
      numeroObservacion: r.numero_observacion,
      estadoObservacion: r.estado_observacion as any,
      estadoAnteriorExpediente: r.estado_anterior_expediente,
      motivo: r.motivo,
      observadoPorPersonaId: r.observado_por_persona_id,
      observadoPorUsuarioId: r.observado_por_usuario_id,
      areaObservacionId: r.area_observacion_id,
      idMovimientoObservacion: r.id_movimiento_observacion,
      requisitosAfectados: r.requisitos_afectados ?? [],
      subsanadoEn: r.subsanado_en.toISOString(),
      subsanadoPorPersonaId: r.subsanado_por_persona_id,
      subsanadoPorUsuarioId: r.subsanado_por_usuario_id,
      motivoSubsanacion: r.motivo_subsanacion,
      idMovimientoSubsanacion: r.id_movimiento_subsanacion,
      creadoEn: r.creado_en.toISOString(),
    };
  }

  async listarObservacionesPorExpediente(
    expedienteId: string,
    clienteParam?: PoolClient | Pool,
  ): Promise<DtoExpedienteObservacion[]> {
    const db = clienteParam ?? this.pool;
    const { rows } = await db.query<{
      id_observacion: string;
      expediente_id: string;
      numero_observacion: number;
      estado_observacion: string;
      estado_anterior_expediente: string;
      motivo: string;
      observado_por_persona_id: string;
      observado_por_usuario_id: string;
      area_observacion_id: string;
      id_movimiento_observacion: string | null;
      requisitos_afectados: any;
      subsanado_en: Date | null;
      subsanado_por_persona_id: string | null;
      subsanado_por_usuario_id: string | null;
      motivo_subsanacion: string | null;
      id_movimiento_subsanacion: string | null;
      creado_en: Date;
    }>(
      `SELECT *
         FROM sigd_rut.expediente_observacion
        WHERE expediente_id = $1::uuid
        ORDER BY numero_observacion ASC`,
      [expedienteId],
    );

    return rows.map((r) => ({
      idObservacion: r.id_observacion,
      expedienteId: r.expediente_id,
      numeroObservacion: r.numero_observacion,
      estadoObservacion: r.estado_observacion as any,
      estadoAnteriorExpediente: r.estado_anterior_expediente,
      motivo: r.motivo,
      observadoPorPersonaId: r.observado_por_persona_id,
      observadoPorUsuarioId: r.observado_por_usuario_id,
      areaObservacionId: r.area_observacion_id,
      idMovimientoObservacion: r.id_movimiento_observacion,
      requisitosAfectados: r.requisitos_afectados ?? [],
      subsanadoEn: r.subsanado_en ? r.subsanado_en.toISOString() : null,
      subsanadoPorPersonaId: r.subsanado_por_persona_id,
      subsanadoPorUsuarioId: r.subsanado_por_usuario_id,
      motivoSubsanacion: r.motivo_subsanacion,
      idMovimientoSubsanacion: r.id_movimiento_subsanacion,
      creadoEn: r.creado_en.toISOString(),
    }));
  }
}
