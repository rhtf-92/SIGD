import type { Pool, PoolClient } from 'pg';
import type {
  FilaOrdenPago,
  DtoBuscarOrdenesParams,
  DtoResumenDashboardTesoreria,
  EstadoOrdenPago,
  MetodoPago,
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
       ORDER BY op.fecha_creacion DESC
       LIMIT 1
    `;
    const res = await cliente.query<FilaOrdenPago>(query, [expedienteId]);
    return res.rows[0] ?? null;
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
        fecha_vencimiento
      ) VALUES ($1, $2::uuid, $3::uuid, $4::uuid, $5, $6, $7, $8, 'PENDIENTE', $9)
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

  async buscarPersonaPorDocumento(
    pool: Pool,
    tipoDocumento: string,
    numeroDocumento: string
  ): Promise<{
    idPersona: string;
    nombres: string;
    apellidos: string;
    nombreCompleto: string;
    documentoEnmascarado: string;
    tipoDocumento: string;
    numeroDocumento: string;
    tieneCuentaUsuario: boolean;
  } | null> {
    const query = `
      SELECT p.id_persona,
             p.tipo,
             p.id_documento,
             COALESCE(pn.nombres, pj.razon_social, '') AS nombres,
             COALESCE(pn.apellidos, '') AS apellidos,
             COALESCE(pn.nombre_completo, pj.razon_social, 'Ciudadano') AS nombre_completo,
             (SELECT COUNT(*) > 0 FROM sigd_auth.cuenta_usuario cu WHERE cu.id_persona = p.id_persona) AS tiene_cuenta
        FROM sigd_auth.persona p
        LEFT JOIN sigd_auth.persona_natural pn ON pn.id_persona = p.id_persona
        LEFT JOIN sigd_auth.persona_juridica pj ON pj.id_persona = p.id_persona
       WHERE p.id_documento = $1
       LIMIT 1
    `;
    const res = await pool.query(query, [numeroDocumento.trim()]);
    const fila = res.rows[0];
    if (!fila) return null;

    const docStr = String(fila.id_documento);
    const visibleLength = Math.min(3, Math.floor(docStr.length / 2));
    const masked = '•'.repeat(Math.max(docStr.length - visibleLength, 3)) + docStr.slice(-visibleLength);

    return {
      idPersona: fila.id_persona,
      nombres: fila.nombres,
      apellidos: fila.apellidos,
      nombreCompleto: fila.nombre_completo,
      documentoEnmascarado: masked,
      tipoDocumento,
      numeroDocumento: fila.id_documento,
      tieneCuentaUsuario: Boolean(fila.tiene_cuenta),
    };
  }
}
