import type { Pool } from 'pg';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
} from '../../shared/domain/errors/index.js';
import { registrarMutacion } from '../../audit/bitacora-auditoria.repository.js';
import { insertarEvento } from '../../audit/evento-outbox.repository.js';
import {
  TesoreriaRepository,
  type ContextoExpedientePago,
} from './tesoreria.repository.js';
import type {
  DtoBuscarOrdenesParams,
  DtoOrdenPago,
  DtoResumenDashboardTesoreria,
  FilaOrdenPago,
  MetodoPago,
} from './tesoreria.types.js';
import { TaypiProvider } from './providers/taypi.provider.js';
import { DemoQrProvider } from './providers/demo-qr.provider.js';

export function calcularVencimientoOrdenPago(ahora: Date): Date {
  const horasStr = process.env.PAYMENT_ORDER_EXPIRY_HOURS;
  const horasConfiguradas = horasStr ? Number(horasStr) : 48;
  const horas = Number.isFinite(horasConfiguradas) && horasConfiguradas > 0 ? horasConfiguradas : 48;
  return new Date(ahora.getTime() + horas * 3600 * 1000);
}

export class TesoreriaService {
  constructor(
    private readonly pool: Pool,
    private readonly repository: TesoreriaRepository = new TesoreriaRepository(),
    private readonly taypiProvider: TaypiProvider = new TaypiProvider(),
    private readonly demoQrProvider: DemoQrProvider = new DemoQrProvider(),
  ) {}

  private mapearFilaADto(fila: FilaOrdenPago): DtoOrdenPago {
    const docStr = fila.numero_documento_solicitante ?? fila.dni_solicitante ?? '';
    const visibleLength = Math.min(3, Math.floor(docStr.length / 2));
    const masked = docStr.length > 0
      ? '•'.repeat(Math.max(docStr.length - visibleLength, 3)) + docStr.slice(-visibleLength)
      : '••••••';

    return {
      ordenPagoId: fila.orden_pago_id,
      codigoPago: fila.codigo_pago,
      expedienteId: fila.expediente_id,
      codigoExpediente: fila.codigo_expediente ?? '',
      solicitanteId: fila.solicitante_id,
      solicitanteNombre: fila.nombre_solicitante ?? 'Administrado',
      documentoEnmascarado: masked,
      concepto: fila.concepto,
      codigoTupa: fila.codigo_tupa ?? null,
      monto: Number(fila.monto) || 0,
      moneda: fila.moneda,
      estado: fila.estado,
      metodoPago: fila.metodo_pago ?? null,
      referenciaOperacion: fila.referencia_operacion ?? null,
      montoRecibido: fila.monto_recibido !== null ? Number(fila.monto_recibido) : null,
      vuelto: fila.vuelto !== null ? Number(fila.vuelto) : null,
      codigoRecibo: fila.codigo_recibo ?? null,
      fechaCreacion: fila.fecha_creacion instanceof Date ? fila.fecha_creacion.toISOString() : String(fila.fecha_creacion),
      fechaVencimiento: fila.fecha_vencimiento instanceof Date ? fila.fecha_vencimiento.toISOString() : String(fila.fecha_vencimiento),
      fechaPago: fila.fecha_pago ? (fila.fecha_pago instanceof Date ? fila.fecha_pago.toISOString() : String(fila.fecha_pago)) : null,
      tesoreroId: fila.tesorero_id ?? null,
      tesoreroNombre: fila.nombre_tesorero ?? (fila.confirmed_source === 'WEBHOOK'
        ? fila.payment_provider === 'DEMO_QR' ? 'Simulador QR' : 'Webhook TAYPI' : null),
      motivoRechazo: fila.motivo_rechazo ?? null,
      paymentProvider: fila.payment_provider ?? null,
      providerPaymentId: fila.provider_payment_id ?? null,
      providerCheckoutToken: fila.provider_checkout_token ?? null,
      providerQrImage: fila.provider_qr_image ?? null,
      providerCheckoutUrl: fila.provider_checkout_url ?? null,
      providerStatus: fila.provider_status ?? null,
      providerExpiresAt: fila.provider_expires_at
        ? (fila.provider_expires_at instanceof Date ? fila.provider_expires_at.toISOString() : String(fila.provider_expires_at))
        : null,
      confirmedSource: fila.confirmed_source ?? null,
      providerReference: fila.provider_reference ?? null,
    };
  }

  async generarOrdenPago(
    expedienteId: string,
    usuarioActorId: string,
    rolesActor: string[],
    personaActorId?: string,
  ): Promise<DtoOrdenPago> {
    const contexto = await this.repository.obtenerContextoExpedienteParaPago(
      this.pool,
      expedienteId,
    );

    if (!contexto) {
      throw new NotFoundError({
        message: 'Expediente no encontrado.',
        detail: `No existe expediente con id ${expedienteId}.`,
      });
    }

    // Salvaguarda BOLA: Si el actor es exclusivamente CIUDADANO, debe ser el titular
    const esInstitucional = rolesActor.some((r) =>
      ['MESA_PARTES', 'ADMINISTRADOR', 'DIRECTOR', 'SECRETARIO', 'ESPECIALISTA', 'TESORERIA'].includes(r.toUpperCase()),
    );

    if (!esInstitucional && (!personaActorId || contexto.solicitanteId !== personaActorId)) {
      throw new ForbiddenError({
        detail: 'BOLA_VIOLATION: No tiene autorización para generar órdenes de pago sobre este expediente.',
      });
    }

    // Regla: Trámites gratuitos no generan orden de pago
    if (contexto.costoOficial <= 0) {
      throw new ConflictError({
        code: 'EXPEDIENTE_SIN_COSTO',
        message: 'El expediente no requiere orden de pago ya que corresponde a un trámite gratuito.',
      });
    }

    // Verificar si ya existe una orden activa (Idempotencia y regla de una orden)
    const ordenExistente = await this.repository.obtenerOrdenActivaPorExpediente(
      this.pool,
      expedienteId,
    );

    const ahora = new Date();

    if (ordenExistente) {
      if (ordenExistente.estado === 'CONFIRMADO') {
        throw new ConflictError({
          code: 'EXPEDIENTE_YA_PAGADO',
          message: 'El expediente ya cuenta con un pago confirmado y registrado en Tesorería.',
        });
      }

      if (ordenExistente.estado === 'PENDIENTE') {
        const vence = new Date(ordenExistente.fecha_vencimiento);
        if (ahora <= vence) {
          // Idempotente: retornar la orden pendiente activa sin duplicar
          return this.mapearFilaADto(ordenExistente);
        }
        // Si ya venció en tiempo, marcar como vencida para permitir reemisión
        await this.repository.marcarOrdenVencida(this.pool, ordenExistente.orden_pago_id);
      }
      // Si está RECHAZADA o VENCIDA, se permite la reemisión de una nueva orden
    }

    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');

      const anio = ahora.getFullYear();
      const codigoPago = await this.repository.obtenerSiguienteCodigoPago(cliente, anio);
      const fechaVencimiento = calcularVencimientoOrdenPago(ahora);

      const nuevaOrden = await this.repository.insertarOrdenPago(cliente, {
        codigoPago,
        expedienteId,
        registroVersionId: contexto.registroVersionId,
        solicitanteId: contexto.solicitanteId,
        concepto: contexto.concepto,
        codigoTupa: contexto.codigoTupa,
        monto: contexto.costoOficial,
        moneda: 'PEN',
        fechaVencimiento,
      });

      // Actualizar estado del expediente a PENDIENTE_PAGO
      await cliente.query(
        `UPDATE sigd_tra.expediente
            SET estado = 'PENDIENTE_PAGO'
          WHERE expediente_id = $1::uuid
            AND estado = 'REGISTRADO'`,
        [expedienteId],
      );

      // Registrar auditoría forense
      await registrarMutacion(cliente, {
        esquema: 'sigd_tra',
        tabla: 'orden_pago',
        operacion: 'INSERT',
        datos_despues: {
          ordenPagoId: nuevaOrden.orden_pago_id,
          codigoPago: nuevaOrden.codigo_pago,
          expedienteId,
          monto: nuevaOrden.monto,
          fechaVencimiento,
        },
      });

      await cliente.query('COMMIT');

      // Re-consultar con datos de solicitante y expediente
      const ordenCompleta = await this.repository.obtenerOrdenPorId(this.pool, nuevaOrden.orden_pago_id);
      return this.mapearFilaADto(ordenCompleta ?? nuevaOrden);
    } catch (error) {
      try { await cliente.query('ROLLBACK'); } catch { /* ignore */ }
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505' &&
          'constraint' in error && error.constraint === 'uq_tra_orden_pago_activa_expediente') {
        const existente = await this.repository.obtenerOrdenActivaPorExpediente(this.pool, expedienteId);
        if (existente?.estado === 'PENDIENTE') return this.mapearFilaADto(existente);
        if (existente?.estado === 'CONFIRMADO') {
          throw new ConflictError({ code: 'EXPEDIENTE_YA_PAGADO', message: 'El expediente ya cuenta con un pago confirmado.' });
        }
      }
      throw error;
    } finally {
      cliente.release();
    }
  }

  async obtenerPagoPorExpediente(
    expedienteId: string,
    rolesActor: string[],
    personaActorId?: string,
  ): Promise<DtoOrdenPago | null> {
    const orden = await this.repository.obtenerOrdenActivaPorExpediente(this.pool, expedienteId);
    if (!orden) return null;

    const esInstitucional = rolesActor.some((r) =>
      ['MESA_PARTES', 'ADMINISTRADOR', 'DIRECTOR', 'SECRETARIO', 'ESPECIALISTA', 'TESORERIA'].includes(r.toUpperCase()),
    );

    if (!esInstitucional && (!personaActorId || orden.solicitante_id !== personaActorId)) {
      throw new ForbiddenError({
        detail: 'BOLA_VIOLATION: No tiene autorización para consultar los pagos de este expediente.',
      });
    }

    // On-demand expiry check
    if (orden.estado === 'PENDIENTE') {
      const vence = new Date(orden.fecha_vencimiento);
      if (new Date() > vence) {
        await this.repository.marcarOrdenVencida(this.pool, orden.orden_pago_id);
        orden.estado = 'VENCIDO';
      }
    }

    return this.mapearFilaADto(orden);
  }

  async obtenerOrdenPorId(
    ordenPagoId: string,
    rolesActor: string[],
    personaActorId?: string,
  ): Promise<DtoOrdenPago> {
    const orden = await this.repository.obtenerOrdenPorId(this.pool, ordenPagoId);
    if (!orden) {
      throw new NotFoundError({
        message: 'Orden de pago no encontrada.',
        detail: `No existe orden de pago con id ${ordenPagoId}.`,
      });
    }

    const esInstitucional = rolesActor.some((r) =>
      ['MESA_PARTES', 'ADMINISTRADOR', 'DIRECTOR', 'SECRETARIO', 'ESPECIALISTA', 'TESORERIA'].includes(r.toUpperCase()),
    );

    if (!esInstitucional && (!personaActorId || orden.solicitante_id !== personaActorId)) {
      throw new ForbiddenError({
        detail: 'BOLA_VIOLATION: No tiene autorización para acceder a esta orden de pago.',
      });
    }

    if (orden.estado === 'PENDIENTE' && new Date() > new Date(orden.fecha_vencimiento)) {
      await this.repository.marcarOrdenVencida(this.pool, orden.orden_pago_id);
      orden.estado = 'VENCIDO';
    }

    return this.mapearFilaADto(orden);
  }

  async confirmarPago(
    ordenPagoId: string,
    datos: {
      metodoPago: MetodoPago;
      montoRecibido?: number | null;
      referenciaOperacion?: string | null;
    },
    tesoreroId: string,
  ): Promise<DtoOrdenPago> {
    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');

      // Bloqueo pesimista contra carreras y dobles confirmaciones concurrentes
      const orden = await this.repository.obtenerOrdenPorIdConLock(cliente, ordenPagoId);
      if (!orden) {
        throw new NotFoundError({
          message: 'Orden de pago no encontrada.',
          detail: `No existe orden con id ${ordenPagoId}.`,
        });
      }

      if (orden.estado !== 'PENDIENTE') {
        throw new ConflictError({
          code: 'ORDEN_NO_PENDIENTE',
          message: `La orden de pago ya se encuentra en estado ${orden.estado}. No se puede confirmar nuevamente.`,
        });
      }

      const ahora = new Date();
      if (ahora > new Date(orden.fecha_vencimiento)) {
        await this.repository.marcarOrdenVencida(cliente, ordenPagoId);
        throw new ConflictError({
          code: 'ORDEN_VENCIDA',
          message: 'La orden de pago ha vencido. Mesa de Partes debe emitir una nueva orden.',
        });
      }

      const montoOficial = Number(orden.monto);
      let vuelto: number | null = null;
      let montoRecibido: number | null = null;

      if (datos.metodoPago === 'EFECTIVO') {
        montoRecibido = datos.montoRecibido !== undefined && datos.montoRecibido !== null
          ? Number(datos.montoRecibido)
          : montoOficial;

        if (montoRecibido < montoOficial) {
          throw new ValidationError({
            message: `El monto recibido (S/ ${montoRecibido.toFixed(2)}) no puede ser menor al monto oficial (S/ ${montoOficial.toFixed(2)}).`,
            invalidParams: [
              { name: 'montoRecibido', reason: 'MONTO_INSUFICIENTE: El monto recibido es menor al arancel oficial requerido.' },
            ],
          });
        }
        vuelto = Number((montoRecibido - montoOficial).toFixed(2));
      } else if (datos.metodoPago === 'YAPE') {
        if (!datos.referenciaOperacion || datos.referenciaOperacion.trim().length === 0) {
          throw new ValidationError({
            message: 'Debe ingresar el número o código de operación para pagos con Yape.',
            invalidParams: [
              { name: 'referenciaOperacion', reason: 'REFERENCIA_REQUERIDA: Ingrese el número de operación emitido por Yape.' },
            ],
          });
        }
        montoRecibido = montoOficial;
        vuelto = 0;
      }

      const anio = ahora.getFullYear();
      const codigoRecibo = await this.repository.obtenerSiguienteCodigoRecibo(cliente, anio);

      await this.repository.actualizarOrdenAConfirmada(cliente, {
        ordenPagoId,
        metodoPago: datos.metodoPago,
        referenciaOperacion: datos.referenciaOperacion?.trim() ?? null,
        montoRecibido,
        vuelto,
        codigoRecibo,
        tesoreroId,
        fechaPago: ahora,
      });

      // Desbloqueo atómico del expediente: transiciona a REGISTRADO para habilitar calificación/derivación
      await cliente.query(
        `UPDATE sigd_tra.expediente
            SET estado = 'REGISTRADO'
          WHERE expediente_id = $1::uuid
            AND estado = 'PENDIENTE_PAGO'`,
        [orden.expediente_id],
      );

      // Auditoría inmutable de la confirmación
      await registrarMutacion(cliente, {
        esquema: 'sigd_tra',
        tabla: 'orden_pago',
        operacion: 'UPDATE',
        datos_antes: { estado: orden.estado },
        datos_despues: {
          estado: 'CONFIRMADO',
          metodoPago: datos.metodoPago,
          codigoRecibo,
          tesoreroId,
          fechaPago: ahora.toISOString(),
        },
      });

      // Outbox transaccional para eventos del sistema
      await insertarEvento(cliente, {
        agregado: 'TESORERIA',
        tipo_evento: 'PAGO_CONFIRMADO',
        payload: {
          ordenPagoId,
          expedienteId: orden.expediente_id,
          codigoPago: orden.codigo_pago,
          codigoRecibo,
          monto: montoOficial,
          metodoPago: datos.metodoPago,
          referenciaOperacion: datos.referenciaOperacion?.trim() ?? null,
          tesoreroId,
          fechaPago: ahora.toISOString(),
        },
      });

      await cliente.query('COMMIT');

      const ordenActualizada = await this.repository.obtenerOrdenPorId(this.pool, ordenPagoId);
      return this.mapearFilaADto(ordenActualizada!);
    } catch (error) {
      try { await cliente.query('ROLLBACK'); } catch { /* ignore */ }
      throw error;
    } finally {
      cliente.release();
    }
  }

  async rechazarPago(
    ordenPagoId: string,
    motivo: string,
    tesoreroId: string,
  ): Promise<DtoOrdenPago> {
    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');

      const orden = await this.repository.obtenerOrdenPorIdConLock(cliente, ordenPagoId);
      if (!orden) {
        throw new NotFoundError({
          message: 'Orden de pago no encontrada.',
          detail: `No existe orden con id ${ordenPagoId}.`,
        });
      }

      if (orden.estado !== 'PENDIENTE') {
        throw new ConflictError({
          code: 'ORDEN_NO_PENDIENTE',
          message: `La orden de pago se encuentra en estado ${orden.estado}. Solo se pueden rechazar órdenes pendientes.`,
        });
      }

      await this.repository.actualizarOrdenARechazada(
        cliente,
        ordenPagoId,
        motivo.trim(),
        tesoreroId,
      );

      await registrarMutacion(cliente, {
        esquema: 'sigd_tra',
        tabla: 'orden_pago',
        operacion: 'UPDATE',
        datos_antes: { estado: orden.estado },
        datos_despues: {
          estado: 'RECHAZADO',
          motivoRechazo: motivo.trim(),
          tesoreroId,
        },
      });

      await cliente.query('COMMIT');

      const ordenActualizada = await this.repository.obtenerOrdenPorId(this.pool, ordenPagoId);
      return this.mapearFilaADto(ordenActualizada!);
    } catch (error) {
      try { await cliente.query('ROLLBACK'); } catch { /* ignore */ }
      throw error;
    } finally {
      cliente.release();
    }
  }

  async listarOrdenes(
    params: DtoBuscarOrdenesParams,
  ): Promise<{ total: number; ordenes: DtoOrdenPago[] }> {
    const { total, ordenes } = await this.repository.listarOrdenes(this.pool, params);
    return {
      total,
      ordenes: ordenes.map((o) => this.mapearFilaADto(o)),
    };
  }

  async obtenerMetricasDashboard(): Promise<DtoResumenDashboardTesoreria> {
    return this.repository.obtenerMetricasDashboard(this.pool);
  }

  async buscarPersonaParaAtencionPresencial(
    tipoDocumento: string,
    numeroDocumento: string,
    operadorId: string,
  ): Promise<{
    encontrada: boolean;
    persona?: {
      idPersona: string;
      nombres: string;
      apellidos: string;
      nombreCompleto: string;
      documentoEnmascarado: string;
      tipoDocumento: string;
      numeroDocumento: string;
      tieneCuentaUsuario: boolean;
    };
  }> {
    const persona = await this.repository.buscarPersonaPorDocumento(
      this.pool,
      tipoDocumento,
      numeroDocumento,
    );

    // Auditoría de consulta presencial (con documento parcialmente protegido)
    const docHash = numeroDocumento.length > 4 ? `***${numeroDocumento.slice(-4)}` : '***';
    const cliente = await this.pool.connect();
    try {
      await registrarMutacion(cliente, {
        esquema: 'sigd_tra',
        tabla: 'atencion_presencial_busqueda',
        operacion: 'INSERT',
        datos_despues: {
          operadorId,
          tipoDocumento,
          documentoParcial: docHash,
          encontrada: Boolean(persona),
          consultadoEn: new Date().toISOString(),
        },
      });
    } catch {
      // Ignorar fallo secundario de bitácora en consulta de solo lectura
    } finally {
      cliente.release();
    }

    if (!persona) {
      return { encontrada: false };
    }

    return {
      encontrada: true,
      persona,
    };
  }

  // ---------------------------------------------------------------------------
  // 4. Módulo TAYPI: Pago QR Automático Sandbox & Webhook
  // ---------------------------------------------------------------------------

  obtenerConfiguracionDemoQr() {
    return this.demoQrProvider.getPublicConfig();
  }

  async obtenerCheckoutDemo(token: string) {
    return this.demoQrProvider.getPayment(this.pool, token);
  }

  async simularPagoDemo(token: string): Promise<{ status: string; receipt?: string | null }> {
    const pago = await this.demoQrProvider.getPayment(this.pool, token);
    if (!pago) throw new NotFoundError({ detail: 'El enlace de pago simulado no existe.' });
    if (pago.status === 'CONFIRMADO') return { status: 'already_confirmed', receipt: pago.receipt };
    if (pago.status !== 'PENDIENTE' || this.demoQrProvider.isExpired(pago)) {
      throw new ConflictError({ code: 'DEMO_QR_EXPIRED', message: 'Este QR expiró o ya no está disponible.' });
    }
    const { rawBody, signature } = this.demoQrProvider.createSignedWebhook(pago);
    // El simulador actúa como proveedor: entrega un evento firmado al endpoint real de SIGD.
    const response = await fetch(`http://127.0.0.1:${process.env.PORT ?? 3000}/api/v1/webhooks/demo-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Demo-Qr-Signature': signature },
      body: rawBody,
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`DEMO_QR_WEBHOOK_HTTP_${response.status}`);
    const result = await response.json() as { status: string; codigoRecibo?: string | null };
    if (!['processed', 'already_confirmed'].includes(result.status)) {
      throw new Error(`DEMO_QR_WEBHOOK_${result.status}`);
    }
    return { status: result.status, receipt: result.codigoRecibo };
  }

  async crearPagoAutomaticoDemo(
    ordenPagoId: string, rolesActor: string[], personaActorId?: string,
  ): Promise<DtoOrdenPago> {
    if (!this.demoQrProvider.isConfigured()) {
      throw new ConflictError({ code: 'DEMO_QR_NOT_CONFIGURED', message: 'El simulador QR no está configurado.' });
    }
    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');
      const orden = await this.repository.obtenerOrdenPorIdConLock(cliente, ordenPagoId);
      if (!orden) throw new NotFoundError({ detail: 'Orden de pago no encontrada.' });
      const esInstitucional = rolesActor.some((rol) =>
        ['MESA_PARTES', 'ADMINISTRADOR', 'DIRECTOR', 'SECRETARIO', 'ESPECIALISTA', 'TESORERIA'].includes(rol.toUpperCase()));
      if (!esInstitucional && (!personaActorId || orden.solicitante_id !== personaActorId)) {
        throw new ForbiddenError({ detail: 'No tiene autorización sobre esta orden.' });
      }
      if (orden.estado !== 'PENDIENTE') {
        throw new ConflictError({ code: 'ORDEN_NO_PENDIENTE', message: 'La orden no está pendiente.' });
      }
      const ahora = new Date();
      if (ahora >= new Date(orden.fecha_vencimiento)) {
        throw new ConflictError({ code: 'ORDEN_VENCIDA', message: 'La orden ha vencido.' });
      }
      if (orden.payment_provider === 'DEMO_QR' && orden.provider_payment_id &&
          orden.provider_payment_id.length <= 20 &&
          orden.provider_qr_image && orden.provider_expires_at &&
          ahora < new Date(orden.provider_expires_at)) {
        await cliente.query('COMMIT');
        return this.mapearFilaADto(orden);
      }
      const generado = await this.demoQrProvider.createPayment();
      await this.repository.actualizarDatosProviderPago(cliente, {
        ordenPagoId: orden.orden_pago_id,
        paymentProvider: 'DEMO_QR',
        providerPaymentId: generado.paymentId,
        providerCheckoutToken: generado.checkoutTokenHash,
        providerQrImage: generado.qrImage,
        providerCheckoutUrl: generado.checkoutUrl,
        providerStatus: 'pending',
        providerExpiresAt: generado.expiresAt,
        providerReference: orden.codigo_pago,
      });
      const actualizada = await this.repository.obtenerOrdenPorId(cliente, ordenPagoId);
      await cliente.query('COMMIT');
      return this.mapearFilaADto(actualizada!);
    } catch (error) {
      await cliente.query('ROLLBACK');
      throw error;
    } finally {
      cliente.release();
    }
  }

  obtenerConfiguracionTaypi() {
    return this.taypiProvider.getPublicConfig();
  }

  async crearPagoAutomaticoTaypi(
    ordenPagoId: string,
    usuarioActorId: string,
    rolesActor: string[],
    personaActorId?: string,
  ): Promise<DtoOrdenPago> {
    const orden = await this.repository.obtenerOrdenPorId(this.pool, ordenPagoId);
    if (!orden) {
      throw new NotFoundError({
        message: 'Orden de pago no encontrada.',
        detail: `No existe orden de pago con id ${ordenPagoId}.`,
      });
    }

    // Salvaguarda BOLA: Solo el solicitante o personal institucional puede iniciar el pago
    const esInstitucional = rolesActor.some((r) =>
      ['MESA_PARTES', 'ADMINISTRADOR', 'DIRECTOR', 'SECRETARIO', 'ESPECIALISTA', 'TESORERIA'].includes(
        r.toUpperCase(),
      ),
    );

    if (!esInstitucional && (!personaActorId || orden.solicitante_id !== personaActorId)) {
      throw new ForbiddenError({
        detail: 'BOLA_VIOLATION: No tiene autorización para generar pago sobre esta orden.',
      });
    }

    if (orden.estado === 'CONFIRMADO') {
      return this.mapearFilaADto(orden);
    }

    if (orden.estado !== 'PENDIENTE') {
      throw new ConflictError({
        code: 'ORDEN_NO_PENDIENTE',
        message: `La orden de pago se encuentra en estado ${orden.estado}. No se puede generar pago.`,
      });
    }

    const ahora = new Date();
    if (ahora > new Date(orden.fecha_vencimiento)) {
      await this.repository.marcarOrdenVencida(this.pool, ordenPagoId);
      throw new ConflictError({
        code: 'ORDEN_VENCIDA',
        message: 'La orden de pago ha vencido. Debe emitirse una nueva orden.',
      });
    }

    // Idempotencia: Si ya tiene un pago TAYPI vigente y no expirado con QR generado, reutilizarlo
    if (
      orden.payment_provider === 'TAYPI' &&
      orden.provider_payment_id &&
      orden.provider_qr_image &&
      orden.provider_expires_at &&
      ahora < new Date(orden.provider_expires_at)
    ) {
      return this.mapearFilaADto(orden);
    }

    // Invocar proveedor TAYPI (monto se toma exclusivamente server-side de la orden)
    const resultado = await this.taypiProvider.createPayment({
      ordenPagoId: orden.orden_pago_id,
      codigoPago: orden.codigo_pago,
      monto: Number(orden.monto),
      concepto: orden.concepto,
    });

    // Persistir datos del proveedor en BD
    await this.repository.actualizarDatosProviderPago(this.pool, {
      ordenPagoId: orden.orden_pago_id,
      paymentProvider: 'TAYPI',
      providerPaymentId: resultado.paymentId,
      providerCheckoutToken: resultado.checkoutToken,
      providerQrImage: resultado.qrImage,
      providerCheckoutUrl: resultado.checkoutUrl,
      providerStatus: resultado.status,
      providerExpiresAt: resultado.expiresAt,
      providerReference: resultado.reference,
    });

    const ordenActualizada = await this.repository.obtenerOrdenPorId(this.pool, ordenPagoId);
    return this.mapearFilaADto(ordenActualizada!);
  }

  async procesarWebhookTaypi(
    rawBody: Buffer | string,
    signatureHeader?: string,
  ) {
    return this.procesarWebhookAutomatico(rawBody, signatureHeader, 'TAYPI');
  }

  async procesarWebhookDemo(rawBody: Buffer | string, signatureHeader?: string) {
    return this.procesarWebhookAutomatico(rawBody, signatureHeader, 'DEMO_QR');
  }

  private async procesarWebhookAutomatico(
    rawBody: Buffer | string,
    signatureHeader: string | undefined,
    proveedor: 'TAYPI' | 'DEMO_QR',
  ): Promise<{
    received: boolean;
    status: 'processed' | 'ignored' | 'rejected' | 'already_confirmed';
    motivo?: string;
    codigoPago?: string;
    codigoRecibo?: string | null;
  }> {
    // 1. Verificación estricta de firma HMAC contra el cuerpo crudo
    const firmaValida = proveedor === 'TAYPI'
      ? this.taypiProvider.verifyWebhookSignature(rawBody, signatureHeader)
      : this.demoQrProvider.verifyWebhook(
          Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf-8'), signatureHeader);
    if (!firmaValida) {
      throw new UnauthorizedError({
        detail: proveedor === 'TAYPI'
          ? 'FIRMA_HMAC_INVALIDA: La cabecera Taypi-Signature no coincide con el cuerpo del webhook.'
          : 'FIRMA_HMAC_INVALIDA: La firma del simulador no coincide con el cuerpo del webhook.',
      });
    }

    // 2. Parseo del payload
    let jsonBody: Record<string, any>;
    try {
      jsonBody = typeof rawBody === 'string'
        ? JSON.parse(rawBody)
        : JSON.parse(rawBody.toString('utf-8'));
    } catch {
      throw new ValidationError({
        message: 'Cuerpo de webhook JSON inválido.',
        invalidParams: [{ name: 'body', reason: 'JSON_SYNTAX_ERROR: El cuerpo de la solicitud no es un JSON válido.' }],
      });
    }

    const event = this.taypiProvider.parseWebhookEvent(jsonBody);
    if (!event) {
      return {
        received: true,
        status: 'ignored',
        motivo: 'Estructura de evento no reconocida o incompleta.',
      };
    }

    // Solo procesamos payment.completed
    if (event.event !== 'payment.completed') {
      return {
        received: true,
        status: 'ignored',
        motivo: `Evento ${event.event} no requiere confirmación en Tesorería.`,
      };
    }

    // Moneda debe ser estrictamente PEN
    if (event.currency !== 'PEN') {
      return {
        received: true,
        status: 'rejected',
        motivo: `Moneda inválida (${event.currency}). Solo se aceptan transacciones en PEN.`,
      };
    }

    // Estado del proveedor debe ser completed
    if (event.status !== 'completed') {
      return {
        received: true,
        status: 'ignored',
        motivo: `Estado del pago (${event.status}) no es completed.`,
      };
    }

    // 3. Conexión y transacción con bloqueo pesimista contra carreras concurrentes
    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');

      // Buscar por provider_payment_id con lock
      let orden = await this.repository.obtenerOrdenPorProviderPaymentIdConLock(
        cliente,
        event.paymentId,
      );

      if (!orden) {
        await cliente.query('ROLLBACK');
        return {
          received: true,
          status: 'rejected',
          motivo: `No se encontró orden de pago para payment_id ${event.paymentId}.`,
        };
      }

      if (
        orden.payment_provider !== proveedor ||
        orden.provider_payment_id !== event.paymentId ||
        orden.codigo_pago !== event.reference
      ) {
        await cliente.query('ROLLBACK');
        return {
          received: true,
          status: 'rejected',
          motivo: 'La identidad del pago no coincide con la orden registrada.',
        };
      }

      // Idempotencia: Si ya está confirmada
      if (orden.estado === 'CONFIRMADO') {
        await cliente.query('COMMIT');
        return {
          received: true,
          status: 'already_confirmed',
          codigoPago: orden.codigo_pago,
          codigoRecibo: orden.codigo_recibo,
        };
      }

      // Solo se puede confirmar si está PENDIENTE
      if (orden.estado !== 'PENDIENTE') {
        await cliente.query('ROLLBACK');
        return {
          received: true,
          status: 'rejected',
          motivo: `La orden ${orden.codigo_pago} está en estado ${orden.estado}.`,
          codigoPago: orden.codigo_pago,
        };
      }

      if (proveedor === 'DEMO_QR' &&
          (!orden.provider_expires_at || new Date() >= new Date(orden.provider_expires_at))) {
        await cliente.query('ROLLBACK');
        return { received: true, status: 'rejected', motivo: 'El QR simulado ha expirado.' };
      }

      // 4. Verificación estricta del monto recibido vs monto oficial
      const montoOficial = Number(orden.monto);
      const montoDiscrepante = proveedor === 'DEMO_QR'
        ? !Number.isFinite(event.amount) || Math.round(event.amount * 100) !== Math.round(montoOficial * 100)
        : Math.abs(event.amount - montoOficial) > 0.01;
      if (montoDiscrepante) {
        // Registrar anomalía en auditoría
        await registrarMutacion(cliente, {
          esquema: 'sigd_tra',
          tabla: 'orden_pago',
          operacion: 'UPDATE',
          datos_despues: {
            alerta: 'WEBHOOK_MONTO_DISCREPANTE',
            montoOficial,
            montoWebhook: event.amount,
            providerPaymentId: event.paymentId,
          },
        });
        await cliente.query('COMMIT');
        return {
          received: true,
          status: 'rejected',
          motivo: `DISCREPANCIA_MONTO: Monto pagado (${event.amount}) no coincide con el oficial (${montoOficial}).`,
          codigoPago: orden.codigo_pago,
        };
      }

      // 5. Confirmación Atómica, Generación de Recibo y Desbloqueo FSM
      const ahora = new Date();
      const anio = ahora.getFullYear();
      const codigoRecibo = await this.repository.obtenerSiguienteCodigoRecibo(cliente, anio);
      const fechaPago = event.paidAt ?? ahora;

      await this.repository.actualizarOrdenAConfirmada(cliente, {
        ordenPagoId: orden.orden_pago_id,
        metodoPago: 'QR_AUTOMATICO_SANDBOX',
        referenciaOperacion: event.paymentId,
        montoRecibido: montoOficial,
        vuelto: 0,
        codigoRecibo,
        tesoreroId: null, // Confirmado por pasarela automatizada
        fechaPago,
        confirmedSource: 'WEBHOOK',
        providerPaymentId: event.paymentId,
        providerStatus: 'completed',
      });

      // Desbloqueo atómico del expediente: transiciona a REGISTRADO para habilitar derivación
      await cliente.query(
        `UPDATE sigd_tra.expediente
            SET estado = 'REGISTRADO'
          WHERE expediente_id = $1::uuid
            AND estado = 'PENDIENTE_PAGO'`,
        [orden.expediente_id],
      );

      // Auditoría inmutable de la confirmación
      await registrarMutacion(cliente, {
        esquema: 'sigd_tra',
        tabla: 'orden_pago',
        operacion: 'UPDATE',
        datos_antes: { estado: orden.estado },
        datos_despues: {
          estado: 'CONFIRMADO',
          metodoPago: 'QR_AUTOMATICO_SANDBOX',
          paymentProvider: proveedor,
          confirmedSource: 'WEBHOOK',
          codigoRecibo,
          providerPaymentId: event.paymentId,
          fechaPago: fechaPago.toISOString(),
        },
      });

      // Outbox transaccional para eventos del sistema
      await insertarEvento(cliente, {
        agregado: 'TESORERIA',
        tipo_evento: 'PAGO_CONFIRMADO',
        payload: {
          ordenPagoId: orden.orden_pago_id,
          expedienteId: orden.expediente_id,
          codigoPago: orden.codigo_pago,
          codigoRecibo,
          monto: montoOficial,
          metodoPago: 'QR_AUTOMATICO_SANDBOX',
          paymentProvider: proveedor,
          confirmedSource: 'WEBHOOK',
          referenciaOperacion: event.paymentId,
          fechaPago: fechaPago.toISOString(),
        },
      });

      await cliente.query('COMMIT');

      return {
        received: true,
        status: 'processed',
        codigoPago: orden.codigo_pago,
        codigoRecibo,
      };
    } catch (error) {
      try { await cliente.query('ROLLBACK'); } catch { /* ignore */ }
      throw error;
    } finally {
      cliente.release();
    }
  }
}
