import type { Pool, PoolClient } from 'pg';
import { ConflictError } from '../../shared/domain/errors/index.js';
import { registrarMutacion } from '../../audit/bitacora-auditoria.repository.js';
import type {
  FilaOrdenPago,
  DtoBuscarOrdenesParams,
  DtoResumenDashboardTesoreria,
  EstadoOrdenPago,
  MetodoPago,
  TipoOrdenPago,
  FilaSolicitudDevolucion,
  DtoBuscarDevolucionesParams,
} from './tesoreria.types.js';

export interface ContextoExpedientePago {
  expedienteId: string;
  codigoExpediente: string;
  solicitanteId: string;
  tipoDocumento: string;
  numeroDocumento: string;
  nombreSolicitante: string;
  costoOficial: number;
  concepto: string;
  codigoTupa: string | null;
  registroVersionId: string | null;
}

export interface InsertarOrdenPagoParams {
  codigoPago: string;
  expedienteId: string;
  registroVersionId: string | null;
  solicitanteId: string;
  concepto: string;
  codigoTupa: string | null;
  monto: number;
  moneda: string;
  fechaVencimiento: Date;
  fechaCreacion?: Date;
  tipoOrden?: TipoOrdenPago;
  motivoAdicional?: string | null;
}

export interface ConfirmarOrdenPagoParams {
  ordenPagoId: string;
  metodoPago: MetodoPago;
  referenciaOperacion: string | null;
  montoRecibido: number | null;
  vuelto: number | null;
  codigoRecibo: string;
  tesoreroId?: string | null;
  fechaPago: Date;
  confirmedSource?: 'TESORERIA' | 'WEBHOOK';
  providerPaymentId?: string | null;
  providerStatus?: string | null;
}

export class TesoreriaRepository {
  async cuentaCiudadanaVinculadaAlExpediente(
    cliente: Pool | PoolClient,
    expedienteId: string,
    usuarioId: string,
    personaId: string,
  ): Promise<boolean> {
    const resultado = await cliente.query<{ permitido: boolean }>(`
      SELECT EXISTS (
        SELECT 1 FROM sigd_tra.expediente e
         WHERE e.expediente_id = $1::uuid
           AND e.solicitante_id = $3::uuid
           AND e.estado <> 'ANULADO'
           AND (e.id_usuario_creador = $2::uuid OR EXISTS (
             SELECT 1 FROM sigd_tra.solicitud_vinculacion_expediente v
              WHERE v.expediente_id = e.expediente_id
                AND v.id_usuario = $2::uuid
                AND v.estado = 'APROBADA'
           ))
      ) AS permitido`, [expedienteId, usuarioId, personaId]);
    return resultado.rows[0]?.permitido === true;
  }

  async obtenerSiguienteCodigoPago(cliente: PoolClient, anio: number): Promise<string> {
    const res = await cliente.query<{ seq: string }>(
      "SELECT nextval('sigd_tra.seq_orden_pago_correlativo')::text AS seq"
    );
    const seq = res.rows[0]?.seq ?? '1';
    return `PAG-${anio}-${seq.padStart(6, '0')}`;
  }

  async obtenerSiguienteCodigoRecibo(cliente: PoolClient, anio: number): Promise<string> {
    const res = await cliente.query<{ seq: string }>(
      "SELECT nextval('sigd_tra.seq_recibo_pago_correlativo')::text AS seq"
    );
    const seq = res.rows[0]?.seq ?? '1';
    return `REC-${anio}-${seq.padStart(6, '0')}`;
  }

  async obtenerSiguienteCodigoDev(cliente: PoolClient, anio: number): Promise<string> {
    const res = await cliente.query<{ seq: string }>(
      "SELECT nextval('sigd_tra.seq_devolucion_correlativo')::text AS seq"
    );
    const seq = res.rows[0]?.seq ?? '1';
    return `DEV-${anio}-${seq.padStart(6, '0')}`;
  }

  async obtenerSiguienteCodigoCdev(cliente: PoolClient, anio: number): Promise<string> {
    const res = await cliente.query<{ seq: string }>(
      "SELECT nextval('sigd_tra.seq_constancia_devolucion_correlativo')::text AS seq"
    );
    const seq = res.rows[0]?.seq ?? '1';
    return `CDEV-${anio}-${seq.padStart(6, '0')}`;
  }

  async obtenerContextoExpedienteParaPago(
    cliente: PoolClient | Pool,
    expedienteId: string
  ): Promise<ContextoExpedientePago | null> {
    const query = `
      SELECT e.expediente_id,
             e.codigo_expediente,
             e.solicitante_id,
             pers.tipo AS persona_tipo,
             pers.id_documento AS numero_documento,
             CASE
               WHEN pers.tipo = 'JURIDICA' THEN 'RUC'
               WHEN pers.id_documento ~ '^[0-9]{8}$' THEN 'DNI'
               ELSE 'CE'
             END AS tipo_documento,
             COALESCE(pn.nombre_completo, pj.razon_social, 'Administrado') AS nombre_solicitante,
             v.registro_version_id,
             COALESCE(rv.codigo_externo, tp.codigo_ref) AS codigo_tupa,
             COALESCE(tp.denominacion, rv.denominacion_original, 'Trámite Administrativo') AS concepto_tupa,
             COALESCE(tp.monto, NULLIF(regexp_replace(COALESCE(rv.monto_original, ''), '[^0-9.]', '', 'g'), '')::numeric, 0.00)::numeric AS costo_oficial
        FROM sigd_tra.expediente e
        JOIN sigd_auth.persona pers ON pers.id_persona = e.solicitante_id
        LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = pers.id_persona
        LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = pers.id_persona
        LEFT JOIN sigd_doc.expediente_tupa_vinculo v ON v.expediente_id = e.expediente_id AND v.reemplaza_vinculo_id IS NULL
        LEFT JOIN sigd_doc.tupa_registro_version rv ON rv.registro_version_id = v.registro_version_id
        LEFT JOIN sigd_doc.tupa_procedimiento tp ON tp.registro_version_id = v.registro_version_id
       WHERE e.expediente_id = $1::uuid
       LIMIT 1
    `;
    const res = await cliente.query(query, [expedienteId]);
    const fila = res.rows[0];
    if (!fila) return null;

    return {
      expedienteId: fila.expediente_id,
      codigoExpediente: fila.codigo_expediente,
      solicitanteId: fila.solicitante_id,
      tipoDocumento: fila.tipo_documento,
      numeroDocumento: fila.numero_documento,
      nombreSolicitante: fila.nombre_solicitante,
      costoOficial: Number(fila.costo_oficial) || 0,
      concepto: fila.concepto_tupa,
      codigoTupa: fila.codigo_tupa ?? null,
      registroVersionId: fila.registro_version_id ?? null,
    };
  }

  async obtenerOrdenActivaPorExpediente(
    cliente: PoolClient | Pool,
    expedienteId: string
  ): Promise<FilaOrdenPago | null> {
    const query = `
      SELECT op.*,
             e.codigo_expediente,
             e.dni_solicitante,
             pers.id_documento AS numero_documento_solicitante,
             CASE
               WHEN pers.tipo = 'JURIDICA' THEN 'RUC'
               WHEN pers.id_documento ~ '^[0-9]{8}$' THEN 'DNI'
               ELSE 'CE'
             END AS tipo_documento_solicitante,
             COALESCE(pn.nombre_completo, pj.razon_social, 'Administrado') AS nombre_solicitante
        FROM sigd_tra.orden_pago op
        JOIN sigd_tra.expediente e ON e.expediente_id = op.expediente_id
        JOIN sigd_auth.persona pers ON pers.id_persona = op.solicitante_id
        LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = pers.id_persona
        LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = pers.id_persona
       WHERE op.expediente_id = $1::uuid
         AND op.tipo_orden = 'PRINCIPAL'
         AND op.estado IN ('PENDIENTE', 'CONFIRMADO')
       ORDER BY op.fecha_creacion DESC
       LIMIT 1
    `;
    const res = await cliente.query<FilaOrdenPago>(query, [expedienteId]);
    return res.rows[0] ?? null;
  }

  async obtenerOrdenConfirmadaPorExpediente(
    cliente: PoolClient | Pool,
    expedienteId: string
  ): Promise<FilaOrdenPago | null> {
    const query = `
      SELECT op.*,
             e.codigo_expediente,
             e.dni_solicitante,
             pers.id_documento AS numero_documento_solicitante,
             COALESCE(pn.nombre_completo, pj.razon_social, 'Administrado') AS nombre_solicitante
        FROM sigd_tra.orden_pago op
        JOIN sigd_tra.expediente e ON e.expediente_id = op.expediente_id
        JOIN sigd_auth.persona pers ON pers.id_persona = op.solicitante_id
        LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = pers.id_persona
        LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = pers.id_persona
       WHERE op.expediente_id = $1::uuid
         AND op.estado = 'CONFIRMADO'
       ORDER BY op.fecha_pago DESC
       LIMIT 1
    `;
    const res = await cliente.query<FilaOrdenPago>(query, [expedienteId]);
    return res.rows[0] ?? null;
  }

  async obtenerOrdenesPorExpediente(
    cliente: PoolClient | Pool,
    expedienteId: string
  ): Promise<FilaOrdenPago[]> {
    const query = `
      SELECT op.*,
             e.codigo_expediente,
             e.dni_solicitante,
             pers.id_documento AS numero_documento_solicitante,
             CASE
               WHEN pers.tipo = 'JURIDICA' THEN 'RUC'
               WHEN pers.id_documento ~ '^[0-9]{8}$' THEN 'DNI'
               ELSE 'CE'
             END AS tipo_documento_solicitante,
             COALESCE(pn.nombre_completo, pj.razon_social, 'Administrado') AS nombre_solicitante
        FROM sigd_tra.orden_pago op
        JOIN sigd_tra.expediente e ON e.expediente_id = op.expediente_id
        JOIN sigd_auth.persona pers ON pers.id_persona = op.solicitante_id
        LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = pers.id_persona
        LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = pers.id_persona
       WHERE op.expediente_id = $1::uuid
       ORDER BY op.fecha_creacion ASC
    `;
    const res = await cliente.query<FilaOrdenPago>(query, [expedienteId]);
    return res?.rows ?? [];
  }

  async obtenerOrdenPorId(
    cliente: PoolClient | Pool,
    ordenPagoId: string
  ): Promise<FilaOrdenPago | null> {
    const query = `
      SELECT op.*,
             e.codigo_expediente,
             e.dni_solicitante,
             pers.id_documento AS numero_documento_solicitante,
             CASE
               WHEN pers.tipo = 'JURIDICA' THEN 'RUC'
               WHEN pers.id_documento ~ '^[0-9]{8}$' THEN 'DNI'
               ELSE 'CE'
             END AS tipo_documento_solicitante,
             COALESCE(pn.nombre_completo, pj.razon_social, 'Administrado') AS nombre_solicitante
        FROM sigd_tra.orden_pago op
        JOIN sigd_tra.expediente e ON e.expediente_id = op.expediente_id
        JOIN sigd_auth.persona pers ON pers.id_persona = op.solicitante_id
        LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = pers.id_persona
        LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = pers.id_persona
       WHERE op.orden_pago_id = $1::uuid
       LIMIT 1
    `;
    const res = await cliente.query<FilaOrdenPago>(query, [ordenPagoId]);
    return res.rows[0] ?? null;
  }

  async obtenerOrdenPorIdConLock(
    cliente: PoolClient,
    ordenPagoId: string
  ): Promise<FilaOrdenPago | null> {
    const query = `
      SELECT op.*,
             e.codigo_expediente,
             e.dni_solicitante,
             pers.id_documento AS numero_documento_solicitante,
             CASE
               WHEN pers.tipo = 'JURIDICA' THEN 'RUC'
               WHEN pers.id_documento ~ '^[0-9]{8}$' THEN 'DNI'
               ELSE 'CE'
             END AS tipo_documento_solicitante,
             COALESCE(pn.nombre_completo, pj.razon_social, 'Administrado') AS nombre_solicitante
        FROM sigd_tra.orden_pago op
        JOIN sigd_tra.expediente e ON e.expediente_id = op.expediente_id
        JOIN sigd_auth.persona pers ON pers.id_persona = op.solicitante_id
        LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = pers.id_persona
        LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = pers.id_persona
       WHERE op.orden_pago_id = $1::uuid
       FOR UPDATE OF op
       LIMIT 1
    `;
    const res = await cliente.query<FilaOrdenPago>(query, [ordenPagoId]);
    return res.rows[0] ?? null;
  }

  async insertarOrdenPago(
    cliente: PoolClient,
    datos: InsertarOrdenPagoParams
  ): Promise<FilaOrdenPago> {
    const query = `
      INSERT INTO sigd_tra.orden_pago (
        codigo_pago,
        expediente_id,
        registro_version_id,
        solicitante_id,
        concepto,
        codigo_tupa,
        monto,
        moneda,
        estado,
        fecha_vencimiento,
        fecha_creacion,
        tipo_orden,
        motivo_adicional
      ) VALUES ($1, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7, $8, 'PENDIENTE', $9, COALESCE($10, now()), $11, $12)
      RETURNING *
    `;
    const res = await cliente.query<FilaOrdenPago>(query, [
      datos.codigoPago,
      datos.expedienteId,
      datos.registroVersionId,
      datos.solicitanteId,
      datos.concepto,
      datos.codigoTupa,
      datos.monto,
      datos.moneda,
      datos.fechaVencimiento,
      datos.fechaCreacion ?? null,
      datos.tipoOrden ?? 'PRINCIPAL',
      datos.motivoAdicional ?? null,
    ]);
    return res.rows[0];
  }

  async actualizarOrdenAConfirmada(
    cliente: PoolClient,
    datos: ConfirmarOrdenPagoParams
  ): Promise<void> {
    const query = `
      UPDATE sigd_tra.orden_pago
         SET estado = 'CONFIRMADO',
             metodo_pago = $2,
             referencia_operacion = $3,
             monto_recibido = $4,
             vuelto = $5,
             codigo_recibo = $6,
             tesorero_id = $7::uuid,
             fecha_pago = $8,
             confirmed_source = COALESCE($9, 'TESORERIA'),
             provider_payment_id = COALESCE($10, provider_payment_id),
             provider_status = COALESCE($11, provider_status),
             updated_at = now()
       WHERE orden_pago_id = $1::uuid
    `;
    await cliente.query(query, [
      datos.ordenPagoId,
      datos.metodoPago,
      datos.referenciaOperacion,
      datos.montoRecibido,
      datos.vuelto,
      datos.codigoRecibo,
      datos.tesoreroId ?? null,
      datos.fechaPago,
      datos.confirmedSource ?? 'TESORERIA',
      datos.providerPaymentId ?? null,
      datos.providerStatus ?? null,
    ]);
  }

  async actualizarDatosProviderPago(
    cliente: PoolClient | Pool,
    datos: {
      ordenPagoId: string;
      paymentProvider: 'MANUAL' | 'TAYPI' | 'DEMO_QR';
      providerPaymentId: string;
      providerCheckoutToken?: string | null;
      providerQrImage?: string | null;
      providerCheckoutUrl?: string | null;
      providerStatus?: string | null;
      providerExpiresAt?: Date | null;
      providerReference?: string | null;
    }
  ): Promise<void> {
    const query = `
      UPDATE sigd_tra.orden_pago
         SET payment_provider = $2,
             provider_payment_id = $3,
             provider_checkout_token = $4,
             provider_qr_image = $5,
             provider_checkout_url = $6,
             provider_status = $7,
             provider_expires_at = $8,
             provider_reference = $9,
             updated_at = now()
       WHERE orden_pago_id = $1::uuid
    `;
    await cliente.query(query, [
      datos.ordenPagoId,
      datos.paymentProvider,
      datos.providerPaymentId,
      datos.providerCheckoutToken ?? null,
      datos.providerQrImage ?? null,
      datos.providerCheckoutUrl ?? null,
      datos.providerStatus ?? 'pending',
      datos.providerExpiresAt ?? null,
      datos.providerReference ?? null,
    ]);
  }

  async obtenerOrdenPorProviderPaymentId(
    cliente: PoolClient | Pool,
    providerPaymentId: string
  ): Promise<FilaOrdenPago | null> {
    const query = `
      SELECT op.*,
             e.codigo_expediente,
             e.dni_solicitante,
             pers.id_documento AS numero_documento_solicitante,
             CASE
               WHEN pers.tipo = 'JURIDICA' THEN 'RUC'
               WHEN pers.id_documento ~ '^[0-9]{8}$' THEN 'DNI'
               ELSE 'CE'
             END AS tipo_documento_solicitante,
             COALESCE(pn.nombre_completo, pj.razon_social, 'Administrado') AS nombre_solicitante
        FROM sigd_tra.orden_pago op
        JOIN sigd_tra.expediente e ON e.expediente_id = op.expediente_id
        JOIN sigd_auth.persona pers ON pers.id_persona = op.solicitante_id
        LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = pers.id_persona
        LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = pers.id_persona
       WHERE op.provider_payment_id = $1
       LIMIT 1
    `;
    const res = await cliente.query<FilaOrdenPago>(query, [providerPaymentId]);
    return res.rows[0] ?? null;
  }

  async obtenerOrdenPorCodigoPago(
    cliente: PoolClient | Pool,
    codigoPago: string
  ): Promise<FilaOrdenPago | null> {
    const query = `
      SELECT op.*,
             e.codigo_expediente,
             e.dni_solicitante,
             pers.id_documento AS numero_documento_solicitante,
             CASE
               WHEN pers.tipo = 'JURIDICA' THEN 'RUC'
               WHEN pers.id_documento ~ '^[0-9]{8}$' THEN 'DNI'
               ELSE 'CE'
             END AS tipo_documento_solicitante,
             COALESCE(pn.nombre_completo, pj.razon_social, 'Administrado') AS nombre_solicitante
        FROM sigd_tra.orden_pago op
        JOIN sigd_tra.expediente e ON e.expediente_id = op.expediente_id
        JOIN sigd_auth.persona pers ON pers.id_persona = op.solicitante_id
        LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = pers.id_persona
        LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = pers.id_persona
       WHERE op.codigo_pago = $1
       LIMIT 1
    `;
    const res = await cliente.query<FilaOrdenPago>(query, [codigoPago]);
    return res.rows[0] ?? null;
  }

  async obtenerOrdenPorProviderPaymentIdConLock(
    cliente: PoolClient,
    providerPaymentId: string
  ): Promise<FilaOrdenPago | null> {
    const query = `
      SELECT op.*,
             e.codigo_expediente,
             e.dni_solicitante,
             pers.id_documento AS numero_documento_solicitante,
             CASE
               WHEN pers.tipo = 'JURIDICA' THEN 'RUC'
               WHEN pers.id_documento ~ '^[0-9]{8}$' THEN 'DNI'
               ELSE 'CE'
             END AS tipo_documento_solicitante,
             COALESCE(pn.nombre_completo, pj.razon_social, 'Administrado') AS nombre_solicitante
        FROM sigd_tra.orden_pago op
        JOIN sigd_tra.expediente e ON e.expediente_id = op.expediente_id
        JOIN sigd_auth.persona pers ON pers.id_persona = op.solicitante_id
        LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = pers.id_persona
        LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = pers.id_persona
       WHERE op.provider_payment_id = $1
       FOR UPDATE OF op
       LIMIT 1
    `;
    const res = await cliente.query<FilaOrdenPago>(query, [providerPaymentId]);
    return res.rows[0] ?? null;
  }

  async actualizarOrdenARechazada(
    cliente: PoolClient,
    ordenPagoId: string,
    motivo: string,
    tesoreroId: string
  ): Promise<void> {
    const query = `
      UPDATE sigd_tra.orden_pago
         SET estado = 'RECHAZADO',
             motivo_rechazo = $2,
             tesorero_id = $3::uuid,
             updated_at = now()
       WHERE orden_pago_id = $1::uuid
    `;
    await cliente.query(query, [ordenPagoId, motivo, tesoreroId]);
  }

  async marcarOrdenVencida(
    cliente: PoolClient | Pool,
    ordenPagoId: string
  ): Promise<void> {
    const query = `
      UPDATE sigd_tra.orden_pago
         SET estado = 'VENCIDO',
             updated_at = now()
       WHERE orden_pago_id = $1::uuid
         AND estado = 'PENDIENTE'
    `;
    await cliente.query(query, [ordenPagoId]);
  }

  async listarOrdenes(
    pool: Pool,
    params: DtoBuscarOrdenesParams
  ): Promise<{ total: number; ordenes: FilaOrdenPago[] }> {
    const page = Math.max(params.page ?? 1, 1);
    const limit = Math.min(Math.max(params.limit ?? 20, 1), 100);
    const offset = (page - 1) * limit;

    const condiciones: string[] = [];
    const valores: unknown[] = [];
    let contador = 1;

    if (params.estado && params.estado !== 'TODOS') {
      condiciones.push(`op.estado = $${contador++}`);
      valores.push(params.estado);
    }

    if (params.buscar && params.buscar.trim().length > 0) {
      const termino = `%${params.buscar.trim()}%`;
      condiciones.push(`(
        op.codigo_pago ILIKE $${contador} OR
        e.codigo_expediente ILIKE $${contador} OR
        pers.id_documento ILIKE $${contador} OR
        pn.nombre_completo ILIKE $${contador} OR
        pj.razon_social ILIKE $${contador} OR
        op.concepto ILIKE $${contador}
      )`);
      valores.push(termino);
      contador++;
    }

    const whereClause = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

    const countQuery = `
      SELECT COUNT(*)::int AS total
        FROM sigd_tra.orden_pago op
        JOIN sigd_tra.expediente e ON e.expediente_id = op.expediente_id
        JOIN sigd_auth.persona pers ON pers.id_persona = op.solicitante_id
        LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = pers.id_persona
        LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = pers.id_persona
       ${whereClause}
    `;
    const countRes = await pool.query<{ total: number }>(countQuery, valores);
    const total = countRes.rows[0]?.total ?? 0;

    const dataQuery = `
      SELECT op.*,
             e.codigo_expediente,
             e.dni_solicitante,
             pers.id_documento AS numero_documento_solicitante,
             CASE
               WHEN pers.tipo = 'JURIDICA' THEN 'RUC'
               WHEN pers.id_documento ~ '^[0-9]{8}$' THEN 'DNI'
               ELSE 'CE'
             END AS tipo_documento_solicitante,
             COALESCE(pn.nombre_completo, pj.razon_social, 'Administrado') AS nombre_solicitante
        FROM sigd_tra.orden_pago op
        JOIN sigd_tra.expediente e ON e.expediente_id = op.expediente_id
        JOIN sigd_auth.persona pers ON pers.id_persona = op.solicitante_id
        LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = pers.id_persona
        LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = pers.id_persona
       ${whereClause}
       ORDER BY op.fecha_creacion DESC
       LIMIT $${contador++} OFFSET $${contador++}
    `;
    const dataRes = await pool.query<FilaOrdenPago>(dataQuery, [...valores, limit, offset]);

    return { total, ordenes: dataRes.rows };
  }

  async obtenerMetricasDashboard(pool: Pool): Promise<DtoResumenDashboardTesoreria> {
    const query = `
      SELECT
        COUNT(*) FILTER (WHERE estado = 'PENDIENTE' AND fecha_vencimiento >= now())::int AS pendientes,
        COUNT(*) FILTER (WHERE estado = 'CONFIRMADO' AND fecha_pago >= CURRENT_DATE)::int AS confirmados_hoy,
        COUNT(*) FILTER (WHERE estado = 'VENCIDO' OR (estado = 'PENDIENTE' AND fecha_vencimiento < now()))::int AS vencidos
      FROM sigd_tra.orden_pago
    `;
    const res = await pool.query<{
      pendientes: number;
      confirmados_hoy: number;
      vencidos: number;
    }>(query);

    return {
      pendientes: res.rows[0]?.pendientes ?? 0,
      confirmadosHoy: res.rows[0]?.confirmados_hoy ?? 0,
      vencidos: res.rows[0]?.vencidos ?? 0,
    };
  }

  // ---------------------------------------------------------------------------
  // Módulo Devoluciones (Fase 3)
  // ---------------------------------------------------------------------------

  async calcularSaldoDevolviblePago(
    cliente: PoolClient | Pool,
    ordenPagoId: string
  ): Promise<number> {
    const query = `
      SELECT (o.monto - COALESCE(SUM(d.monto_autorizado), 0))::numeric AS saldo_devolvible
        FROM sigd_tra.orden_pago o
        LEFT JOIN sigd_tra.solicitud_devolucion d
          ON d.orden_pago_id = o.orden_pago_id
         AND d.estado IN ('APROBADA', 'PENDIENTE_TESORERIA', 'DEVUELTA')
       WHERE o.orden_pago_id = $1::uuid
       GROUP BY o.monto
    `;
    const res = await cliente.query<{ saldo_devolvible: string }>(query, [ordenPagoId]);
    if (!res.rows[0]) return 0;
    const saldo = Number(res.rows[0].saldo_devolvible);
    return Math.max(saldo, 0);
  }

  async obtenerSolicitudDevolucionActivaPorOrden(
    cliente: PoolClient | Pool,
    ordenPagoId: string
  ): Promise<FilaSolicitudDevolucion | null> {
    const query = `
      SELECT *
        FROM sigd_tra.solicitud_devolucion
       WHERE orden_pago_id = $1::uuid
         AND estado IN ('SOLICITADA', 'EN_REVISION', 'OBSERVADA', 'SUBSANADA', 'APROBADA', 'PENDIENTE_TESORERIA')
       LIMIT 1
    `;
    const res = await cliente.query<FilaSolicitudDevolucion>(query, [ordenPagoId]);
    return res.rows[0] ?? null;
  }

  async insertarSolicitudDevolucion(
    cliente: PoolClient,
    datos: {
      codigoDev: string;
      expedienteId: string;
      ordenPagoId: string;
      solicitanteId: string;
      cuentaUsuarioId?: string | null;
      canalRegistro: 'VIRTUAL' | 'PRESENCIAL' | 'MESA_PARTES';
      causal: 'SOBREPAGO' | 'PAGO_DUPLICADO' | 'PAGO_INDEBIDO' | 'DESISTIMIENTO' | 'TRAMITE_DENEGADO' | 'OTRO';
      motivo: string;
      montoOriginal: number;
      montoSolicitado: number;
    }
  ): Promise<FilaSolicitudDevolucion> {
    const query = `
      INSERT INTO sigd_tra.solicitud_devolucion (
        codigo_dev,
        expediente_id,
        orden_pago_id,
        solicitante_id,
        cuenta_usuario_id,
        canal_registro,
        causal,
        motivo,
        monto_original,
        monto_solicitado,
        estado
      ) VALUES (
        $1, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6, $7, $8, $9, $10, 'SOLICITADA'
      )
      RETURNING *
    `;
    const res = await cliente.query<FilaSolicitudDevolucion>(query, [
      datos.codigoDev,
      datos.expedienteId,
      datos.ordenPagoId,
      datos.solicitanteId,
      datos.cuentaUsuarioId ?? null,
      datos.canalRegistro,
      datos.causal,
      datos.motivo,
      datos.montoOriginal,
      datos.montoSolicitado,
    ]);
    return res.rows[0];
  }

  async obtenerSolicitudDevolucionPorId(
    cliente: PoolClient | Pool,
    solicitudDevolucionId: string
  ): Promise<FilaSolicitudDevolucion | null> {
    const query = `
      SELECT d.*,
             e.codigo_expediente,
             op.codigo_pago,
             op.codigo_recibo,
             COALESCE(pn.nombre_completo, pj.razon_social, 'Administrado') AS solicitante_nombre,
             pers.id_documento AS solicitante_documento,
             aprob.nombre_completo AS aprobado_por_nombre,
             proc.nombre_completo AS procesado_por_nombre
        FROM sigd_tra.solicitud_devolucion d
        JOIN sigd_tra.expediente e ON e.expediente_id = d.expediente_id
        JOIN sigd_tra.orden_pago op ON op.orden_pago_id = d.orden_pago_id
        JOIN sigd_auth.persona pers ON pers.id_persona = d.solicitante_id
        LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = pers.id_persona
        LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = pers.id_persona
        LEFT JOIN sigd_auth.cuenta_usuario cu_aprob ON cu_aprob.id_usuario = d.aprobado_por_id
        LEFT JOIN sigd_auth.persona_natural aprob ON aprob.id_persona = cu_aprob.id_persona
        LEFT JOIN sigd_auth.cuenta_usuario cu_proc ON cu_proc.id_usuario = d.procesado_por_id
        LEFT JOIN sigd_auth.persona_natural proc ON proc.id_persona = cu_proc.id_persona
       WHERE d.solicitud_devolucion_id = $1::uuid
       LIMIT 1
    `;
    const res = await cliente.query<FilaSolicitudDevolucion>(query, [solicitudDevolucionId]);
    return res.rows[0] ?? null;
  }

  async obtenerSolicitudDevolucionPorIdConLock(
    cliente: PoolClient,
    solicitudDevolucionId: string
  ): Promise<FilaSolicitudDevolucion | null> {
    const query = `
      SELECT d.*,
             e.codigo_expediente,
             op.codigo_pago,
             op.codigo_recibo,
             COALESCE(pn.nombre_completo, pj.razon_social, 'Administrado') AS solicitante_nombre,
             pers.id_documento AS solicitante_documento,
             aprob.nombre_completo AS aprobado_por_nombre,
             proc.nombre_completo AS procesado_por_nombre
        FROM sigd_tra.solicitud_devolucion d
        JOIN sigd_tra.expediente e ON e.expediente_id = d.expediente_id
        JOIN sigd_tra.orden_pago op ON op.orden_pago_id = d.orden_pago_id
        JOIN sigd_auth.persona pers ON pers.id_persona = d.solicitante_id
        LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = pers.id_persona
        LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = pers.id_persona
        LEFT JOIN sigd_auth.cuenta_usuario cu_aprob ON cu_aprob.id_usuario = d.aprobado_por_id
        LEFT JOIN sigd_auth.persona_natural aprob ON aprob.id_persona = cu_aprob.id_persona
        LEFT JOIN sigd_auth.cuenta_usuario cu_proc ON cu_proc.id_usuario = d.procesado_por_id
        LEFT JOIN sigd_auth.persona_natural proc ON proc.id_persona = cu_proc.id_persona
       WHERE d.solicitud_devolucion_id = $1::uuid
       FOR UPDATE OF d
       LIMIT 1
    `;
    const res = await cliente.query<FilaSolicitudDevolucion>(query, [solicitudDevolucionId]);
    return res.rows[0] ?? null;
  }

  async actualizarSolicitudDevolucion(
    cliente: PoolClient,
    solicitudDevolucionId: string,
    cambios: {
      estado?: string;
      montoAutorizado?: number | null;
      montoDevuelto?: number | null;
      fechaAprobacion?: Date | null;
      aprobadoPorId?: string | null;
      fechaDevolucion?: Date | null;
      procesadoPorId?: string | null;
      metodoDevolucion?: string | null;
      constanciaDevolucionCodigo?: string | null;
      motivoObservacion?: string | null;
      motivoRechazo?: string | null;
      observacionResolucion?: string | null;
    }
  ): Promise<void> {
    const query = `
      UPDATE sigd_tra.solicitud_devolucion
         SET estado = COALESCE($2, estado),
             monto_autorizado = COALESCE($3, monto_autorizado),
             monto_devuelto = COALESCE($4, monto_devuelto),
             fecha_aprobacion = COALESCE($5, fecha_aprobacion),
             aprobado_por_id = COALESCE($6::uuid, aprobado_por_id),
             fecha_devolucion = COALESCE($7, fecha_devolucion),
             procesado_por_id = COALESCE($8::uuid, procesado_por_id),
             metodo_devolucion = COALESCE($9, metodo_devolucion),
             constancia_devolucion_codigo = COALESCE($10, constancia_devolucion_codigo),
             motivo_observacion = COALESCE($11, motivo_observacion),
             motivo_rechazo = COALESCE($12, motivo_rechazo),
             observacion_resolucion = COALESCE($13, observacion_resolucion),
             updated_at = now()
       WHERE solicitud_devolucion_id = $1::uuid
    `;
    await cliente.query(query, [
      solicitudDevolucionId,
      cambios.estado ?? null,
      cambios.montoAutorizado ?? null,
      cambios.montoDevuelto ?? null,
      cambios.fechaAprobacion ?? null,
      cambios.aprobadoPorId ?? null,
      cambios.fechaDevolucion ?? null,
      cambios.procesadoPorId ?? null,
      cambios.metodoDevolucion ?? null,
      cambios.constanciaDevolucionCodigo ?? null,
      cambios.motivoObservacion ?? null,
      cambios.motivoRechazo ?? null,
      cambios.observacionResolucion ?? null,
    ]);
  }

  async listarSolicitudesDevolucion(
    pool: Pool,
    params: DtoBuscarDevolucionesParams,
    solicitanteId?: string,
  ): Promise<{ total: number; items: FilaSolicitudDevolucion[] }> {
    const page = Math.max(params.page ?? 1, 1);
    const limit = Math.min(Math.max(params.limit ?? 20, 1), 100);
    const offset = (page - 1) * limit;

    const condiciones: string[] = [];
    const valores: unknown[] = [];
    let contador = 1;

    if (params.estado && params.estado !== 'TODAS') {
      condiciones.push(`d.estado = $${contador++}`);
      valores.push(params.estado);
    }

    if (params.expedienteId) {
      condiciones.push(`d.expediente_id = $${contador++}::uuid`);
      valores.push(params.expedienteId);
    }

    if (solicitanteId) {
      condiciones.push(`d.solicitante_id = $${contador++}::uuid`);
      valores.push(solicitanteId);
    }

    if (params.buscar && params.buscar.trim().length > 0) {
      const termino = `%${params.buscar.trim()}%`;
      condiciones.push(`(
        d.codigo_dev ILIKE $${contador} OR
        e.codigo_expediente ILIKE $${contador} OR
        op.codigo_pago ILIKE $${contador} OR
        op.codigo_recibo ILIKE $${contador} OR
        pers.id_documento ILIKE $${contador} OR
        pn.nombre_completo ILIKE $${contador} OR
        pj.razon_social ILIKE $${contador} OR
        d.constancia_devolucion_codigo ILIKE $${contador}
      )`);
      valores.push(termino);
      contador++;
    }

    const whereClause = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

    const countQuery = `
      SELECT COUNT(*)::int AS total
        FROM sigd_tra.solicitud_devolucion d
        JOIN sigd_tra.expediente e ON e.expediente_id = d.expediente_id
        JOIN sigd_tra.orden_pago op ON op.orden_pago_id = d.orden_pago_id
        JOIN sigd_auth.persona pers ON pers.id_persona = d.solicitante_id
        LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = pers.id_persona
        LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = pers.id_persona
       ${whereClause}
    `;
    const countRes = await pool.query<{ total: number }>(countQuery, valores);
    const total = countRes.rows[0]?.total ?? 0;

    const dataQuery = `
      SELECT d.*,
             e.codigo_expediente,
             op.codigo_pago,
             op.codigo_recibo,
             COALESCE(pn.nombre_completo, pj.razon_social, 'Administrado') AS solicitante_nombre,
             pers.id_documento AS solicitante_documento,
             aprob.nombre_completo AS aprobado_por_nombre,
             proc.nombre_completo AS procesado_por_nombre
        FROM sigd_tra.solicitud_devolucion d
        JOIN sigd_tra.expediente e ON e.expediente_id = d.expediente_id
        JOIN sigd_tra.orden_pago op ON op.orden_pago_id = d.orden_pago_id
        JOIN sigd_auth.persona pers ON pers.id_persona = d.solicitante_id
        LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = pers.id_persona
        LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = pers.id_persona
        LEFT JOIN sigd_auth.cuenta_usuario cu_aprob ON cu_aprob.id_usuario = d.aprobado_por_id
        LEFT JOIN sigd_auth.persona_natural aprob ON aprob.id_persona = cu_aprob.id_persona
        LEFT JOIN sigd_auth.cuenta_usuario cu_proc ON cu_proc.id_usuario = d.procesado_por_id
        LEFT JOIN sigd_auth.persona_natural proc ON proc.id_persona = cu_proc.id_persona
       ${whereClause}
       ORDER BY d.fecha_solicitud DESC
       LIMIT $${contador++} OFFSET $${contador++}
    `;
    const dataRes = await pool.query<FilaSolicitudDevolucion>(dataQuery, [...valores, limit, offset]);

    return { total, items: dataRes.rows };
  }

  async listarDevolucionesPorExpediente(
    cliente: PoolClient | Pool,
    expedienteId: string
  ): Promise<FilaSolicitudDevolucion[]> {
    const query = `
      SELECT d.*,
             e.codigo_expediente,
             op.codigo_pago,
             op.codigo_recibo,
             COALESCE(pn.nombre_completo, pj.razon_social, 'Administrado') AS solicitante_nombre,
             pers.id_documento AS solicitante_documento,
             aprob.nombre_completo AS aprobado_por_nombre,
             proc.nombre_completo AS procesado_por_nombre
        FROM sigd_tra.solicitud_devolucion d
        JOIN sigd_tra.expediente e ON e.expediente_id = d.expediente_id
        JOIN sigd_tra.orden_pago op ON op.orden_pago_id = d.orden_pago_id
        JOIN sigd_auth.persona pers ON pers.id_persona = d.solicitante_id
        LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = pers.id_persona
        LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = pers.id_persona
        LEFT JOIN sigd_auth.cuenta_usuario cu_aprob ON cu_aprob.id_usuario = d.aprobado_por_id
        LEFT JOIN sigd_auth.persona_natural aprob ON aprob.id_persona = cu_aprob.id_persona
        LEFT JOIN sigd_auth.cuenta_usuario cu_proc ON cu_proc.id_usuario = d.procesado_por_id
        LEFT JOIN sigd_auth.persona_natural proc ON proc.id_persona = cu_proc.id_persona
       WHERE d.expediente_id = $1::uuid
       ORDER BY d.fecha_solicitud DESC
    `;
    const res = await cliente.query<FilaSolicitudDevolucion>(query, [expedienteId]);
    return res?.rows ?? [];
  }

  // ---------------------------------------------------------------------------
  // Registro presencial
  // ---------------------------------------------------------------------------

  async buscarPersonaPorDocumento(
    pool: Pool,
    tipoDocumento: string,
    numeroDocumento: string
  ): Promise<{
    idPersona: string;
    tipoPersona: 'NATURAL' | 'JURIDICA';
    nombres: string;
    apellidos: string;
    nombreCompleto: string;
    documentoEnmascarado: string;
    tipoDocumento: string;
    numeroDocumento: string;
    correo?: string | null;
    telefono?: string | null;
    direccion?: string | null;
    tieneCuentaUsuario: boolean;
  } | null> {
    const query = `
      SELECT p.id_persona,
             p.tipo,
             p.id_documento,
             p.direccion,
             COALESCE(pn.nombres, pj.razon_social, '') AS nombres,
             COALESCE(pn.apellidos, '') AS apellidos,
             COALESCE(pn.nombre_completo, pj.razon_social, 'Ciudadano') AS nombre_completo,
             COALESCE(pn.correo, NULL) AS correo,
             COALESCE(pn.telefono, NULL) AS telefono,
             (SELECT COUNT(*) > 0 FROM sigd_auth.cuenta_usuario cu WHERE cu.id_persona = p.id_persona) AS tiene_cuenta
        FROM sigd_auth.persona p
        LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = p.id_persona
        LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = p.id_persona
       WHERE p.id_documento = $1
          AND (
            ($2 = 'RUC' AND p.tipo = 'JURIDICA')
            OR ($2 IN ('DNI', 'CE') AND (p.tipo = 'NATURAL' OR p.tipo IS NULL))
          )
       LIMIT 1
    `;
    const res = await pool.query(query, [numeroDocumento.trim(), tipoDocumento.trim().toUpperCase()]);
    const fila = res.rows[0];
    if (!fila) return null;

    const docStr = String(fila.id_documento);
    const visibleLength = Math.min(3, Math.floor(docStr.length / 2));
    const masked = '•'.repeat(Math.max(docStr.length - visibleLength, 3)) + docStr.slice(-visibleLength);

    return {
      idPersona: fila.id_persona,
      tipoPersona: fila.tipo === 'JURIDICA' ? 'JURIDICA' : 'NATURAL',
      nombres: fila.nombres,
      apellidos: fila.apellidos,
      nombreCompleto: fila.nombre_completo,
      documentoEnmascarado: masked,
      tipoDocumento: tipoDocumento.trim().toUpperCase(),
      numeroDocumento: fila.id_documento,
      correo: fila.correo ?? null,
      telefono: fila.telefono ?? null,
      direccion: fila.direccion ?? null,
      tieneCuentaUsuario: Boolean(fila.tiene_cuenta),
    };
  }

  async registrarPersonaSinCuenta(
    pool: Pool,
    datos: {
      tipoPersona: 'NATURAL' | 'JURIDICA';
      tipoDocumento: 'DNI' | 'CE' | 'RUC';
      numeroDocumento: string;
      nombres?: string;
      apellidos?: string;
      razonSocial?: string;
      correo?: string | null;
      telefono?: string | null;
      direccion?: string | null;
    },
    operadorId: string
  ): Promise<{
    idPersona: string;
    tipoPersona: 'NATURAL' | 'JURIDICA';
    tipoDocumento: string;
    numeroDocumento: string;
    nombres: string;
    apellidos: string;
    nombreCompleto: string;
    documentoEnmascarado: string;
    correo?: string | null;
    telefono?: string | null;
    direccion?: string | null;
    tieneCuentaUsuario: boolean;
  }> {
    const numDoc = datos.numeroDocumento.trim();
    const cliente = await pool.connect();
    try {
      await cliente.query('BEGIN');

      // 1. Verificar si ya existe
      const existente = await cliente.query<{ id_persona: string }>(
        `SELECT id_persona::text FROM sigd_auth.persona WHERE tipo = $1 AND id_documento = $2 LIMIT 1`,
        [datos.tipoPersona, numDoc]
      );
      if (existente.rows[0]) {
        throw new ConflictError({
          message: 'El administrado ya se encuentra registrado.',
          detail: `Ya existe un registro de ${datos.tipoPersona} con el documento ${numDoc}.`,
        });
      }

      // 2. Insertar en sigd_auth.persona
      const resPersona = await cliente.query<{ id_persona: string }>(
        `INSERT INTO sigd_auth.persona (tipo, id_documento, direccion)
         VALUES ($1, $2, $3)
         RETURNING id_persona::text`,
        [datos.tipoPersona, numDoc, datos.direccion?.trim() || null]
      );
      const idPersona = resPersona.rows[0].id_persona;

      let nombresFinal = '';
      let apellidosFinal = '';
      let nombreCompletoFinal = '';

      if (datos.tipoPersona === 'NATURAL') {
        nombresFinal = datos.nombres?.trim() || '';
        apellidosFinal = datos.apellidos?.trim() || '';
        nombreCompletoFinal = `${nombresFinal} ${apellidosFinal}`.trim();

        await cliente.query(
          `INSERT INTO sigd_auth.persona_natural (
             id_persona, nombres, apellidos, nombre_completo, correo, telefono
           ) VALUES ($1::uuid, $2, $3, $4, $5, $6)`,
          [
            idPersona,
            nombresFinal,
            apellidosFinal,
            nombreCompletoFinal,
            datos.correo?.trim() || null,
            datos.telefono?.trim() || null,
          ]
        );
      } else {
        nombreCompletoFinal = datos.razonSocial?.trim() || '';
        nombresFinal = nombreCompletoFinal;
        apellidosFinal = '';

        await cliente.query(
          `INSERT INTO sigd_auth.persona_juridica (
             id_persona, razon_social, direccion
           ) VALUES ($1::uuid, $2, $3)`,
          [idPersona, nombreCompletoFinal, datos.direccion?.trim() || null]
        );
      }

      await registrarMutacion(cliente, {
        esquema: 'sigd_auth',
        tabla: 'persona',
        operacion: 'INSERT',
        datos_despues: {
          idPersona,
          tipoPersona: datos.tipoPersona,
          tipoDocumento: datos.tipoDocumento,
          numeroDocumento: numDoc,
          operadorId,
        },
      });

      await cliente.query('COMMIT');

      const visibleLength = Math.min(3, Math.floor(numDoc.length / 2));
      const masked = '•'.repeat(Math.max(numDoc.length - visibleLength, 3)) + numDoc.slice(-visibleLength);

      return {
        idPersona,
        tipoPersona: datos.tipoPersona,
        tipoDocumento: datos.tipoDocumento,
        numeroDocumento: numDoc,
        nombres: nombresFinal,
        apellidos: apellidosFinal,
        nombreCompleto: nombreCompletoFinal,
        documentoEnmascarado: masked,
        correo: datos.correo?.trim() || null,
        telefono: datos.telefono?.trim() || null,
        direccion: datos.direccion?.trim() || null,
        tieneCuentaUsuario: false,
      };
    } catch (err) {
      await cliente.query('ROLLBACK');
      throw err;
    } finally {
      cliente.release();
    }
  }
}
