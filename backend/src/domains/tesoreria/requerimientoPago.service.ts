import type { Pool, PoolClient } from 'pg';
import { randomUUID } from 'crypto';

export interface RequerimientoPago {
  id: string;
  codigo: string;
  idExpediente: string;
  idTupaProcedimiento: string;
  idSolicitante: string;
  concepto: string;
  montoEsperado: number;
  moneda: string;
  estado: 'PENDIENTE_PAGO' | 'PAGO_EN_VERIFICACION' | 'PAGO_CONFIRMADO' | 'PAGO_RECHAZADO' | 'ANULADO';
  creadoEn: Date;
  confirmadoEn: Date | null;
  rechazadoEn: Date | null;
  idConfirmador: string | null;
  observacion: string | null;
  versionTupa: string | null;
}

export interface CrearRequerimientoDto {
  idExpediente: string;
  idTupaProcedimiento: string;
  idSolicitante: string;
  concepto: string;
}

export interface ConfirmarPagoDto {
  idConfirmador: string;
  observacion?: string;
}

export interface RechazarPagoDto {
  idConfirmador: string;
  observacion: string;
}

export class RequerimientoPagoService {
  constructor(private readonly pool: Pool) {}

  private generarCodigoPago(): string {
    const anio = new Date().getFullYear();
    const randomPart = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    return `PAG-${new Date().getFullYear()}-${randomPart}`;
  }

  async crearRequerimiento(dto: CrearRequerimientoDto, client?: PoolClient): Promise<{ codigo: string; id: string }> {
    const codigo = this.generarCodigoPago();
    const id = randomUUID();

    const query = `
      INSERT INTO sigd_doc.requerimiento_pago (
        id, codigo, id_expediente, id_tupa_procedimiento, id_solicitante,
        concepto, monto_esperado, moneda, estado, creado_en
      )
      SELECT
        $1, $2, $3, $4, $5,
        $6,
        tp.monto,
        tp.unidad_cobro,
        'PENDIENTE_PAGO',
        now()
      FROM sigd_doc.tupa_procedimiento tp
      WHERE tp.id_procedimiento = $4
      RETURNING id, codigo
    `;

    const params = [
      randomUUID(),
      `PAG-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`,
      dto.idExpediente,
      dto.idTupaProcedimiento,
      dto.idSolicitante,
      dto.concepto,
      dto.idTupaProcedimiento
    ];

    const conn = client || this.pool;
    const result = await conn.query(query, params);
    return { codigo: result.rows[0].codigo, id: result.rows[0].id };
  }

  async listar(filtros: { estado?: string; idExpediente?: string; idSolicitante?: string; codigo?: string; page?: number; limit?: number }) {
    const page = filtros.page ?? 1;
    const limit = filtros.limit ?? 20;
    const offset = (page - 1) * limit;

    const condiciones: string[] = [];
    const params: unknown[] = [];

    if (filtros.estado) {
      params.push(filtros.estado);
      condiciones.push(`estado = $${params.length}`);
    }
    if (filtros.idExpediente) {
      params.push(filtros.idExpediente);
      condiciones.push(`id_expediente = $${params.length}`);
    }
    if (filtros.idSolicitante) {
      params.push(filtros.idSolicitante);
      condiciones.push(`id_solicitante = $${params.length}`);
    }
    if (filtros.codigo) {
      params.push(filtros.codigo);
      condiciones.push(`codigo ILIKE $${params.length}`);
    }

    const whereClause = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

    const countQuery = `SELECT COUNT(*) FROM sigd_doc.requerimiento_pago ${whereClause}`;
    const countResult = await this.pool.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count, 10);

    params.push(limit, offset);
    const query = `
      SELECT
        rp.*,
        tp.denominacion AS tupa_denominacion,
        tp.monto AS tupa_monto,
        tp.unidad_cobro AS tupa_unidad_cobro,
        e.codigo_expediente AS expediente_codigo,
        cu.correo AS solicitante_correo,
        p.nombres AS solicitante_nombres,
        p.apellidos AS solicitante_apellidos
      FROM sigd_doc.requerimiento_pago rp
      LEFT JOIN sigd_doc.tupa_procedimiento tp ON rp.id_tupa_procedimiento = tp.id_procedimiento
      LEFT JOIN sigd_doc.expediente e ON rp.id_expediente = e.expediente_id
      LEFT JOIN sigd_auth.cuenta_usuario cu ON rp.id_solicitante = cu.id_usuario
      LEFT JOIN sigd_auth.persona p ON cu.id_persona = p.id_persona
      ${params.length > 0 ? `WHERE ${['rp.estado = $1'].join(' AND ')}` : ''}
      ORDER BY rp.creado_en DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const result = await this.pool.query(query, params);
    return {
      data: result.rows,
      total: total,
      page: 1,
      limit: 20,
      totalPages: Math.ceil(total / 20)
    };
  }

  async buscarPorCodigo(codigo: string) {
    const result = await this.pool.query(
      `SELECT rp.*, tp.denominacion AS tupa_denominacion, tp.monto AS tupa_monto, tp.unidad_cobro AS tupa_unidad_cobro,
              e.codigo_expediente AS expediente_codigo,
              cu.correo AS solicitante_correo, p.nombres AS solicitante_nombres, p.apellidos AS solicitante_apellidos
       FROM sigd_doc.requerimiento_pago rp
       LEFT JOIN sigd_doc.tupa_procedimiento tp ON rp.id_tupa_procedimiento = tp.id_procedimiento
       LEFT JOIN sigd_doc.expediente e ON rp.id_expediente = e.expediente_id
       LEFT JOIN sigd_auth.cuenta_usuario cu ON rp.id_solicitante = cu.id_usuario
       LEFT JOIN sigd_auth.persona p ON cu.id_persona = p.id_persona
       WHERE rp.codigo = $1`,
      [codigo]
    );
    return result.rows[0] || null;
  }

  async confirmarPago(id: string, dto: { idConfirmador: string; observacion?: string }): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      const result = await client.query(
        `UPDATE sigd_doc.requerimiento_pago
         SET estado = 'PAGO_CONFIRMADO',
             confirmado_en = now(),
             id_confirmador = $2,
             observacion = COALESCE($3, observacion)
         WHERE id = $1 AND estado = 'PENDIENTE_PAGO'
         RETURNING id`,
        [id, dto.idConfirmador, dto.observacion || null]
      );

      if (result.rowCount === 0) {
        await client.query('ROLLBACK');
        return false;
      }

      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async rechazarPago(id: string, dto: { idConfirmador: string; observacion: string }): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      const result = await client.query(
        `UPDATE sigd_doc.requerimiento_pago
         SET estado = 'PAGO_RECHAZADO',
             rechazado_en = now(),
             id_confirmador = $2,
             observacion = $3
         WHERE id = $1 AND estado = 'PENDIENTE_PAGO'
         RETURNING id`,
        [id, dto.idConfirmador, dto.observacion]
      );

      if (result.rowCount === 0) {
        await client.query('ROLLBACK');
        return false;
      }

      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async anular(id: string, idConfirmador: string, observacion?: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      const result = await client.query(
        `UPDATE sigd_doc.requerimiento_pago
         SET estado = 'ANULADO',
             rechazado_en = now(),
             id_confirmador = $2,
             observacion = COALESCE($3, observacion)
         WHERE id = $1 AND estado IN ('PENDIENTE_PAGO', 'PAGO_EN_VERIFICACION')
         RETURNING id`,
        [id, idConfirmador, observacion || null]
      );

      if (result.rowCount === 0) {
        await client.query('ROLLBACK');
        return false;
      }

      await client.query('COMMIT');
      return true;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}