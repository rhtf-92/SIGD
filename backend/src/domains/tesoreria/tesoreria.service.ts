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
  TipoOrdenPago,
  CausalDevolucion,
  EstadoDevolucion,
  CanalRegistroDevolucion,
  MetodoDevolucion,
  FilaSolicitudDevolucion,
  DtoSolicitudDevolucion,
  DtoSaldosExpediente,
  DtoBuscarDevolucionesParams,
} from './tesoreria.types.js';
import { TaypiProvider } from './providers/taypi.provider.js';
import { DemoQrProvider } from './providers/demo-qr.provider.js';
import { AuthorizationService } from '../../core/auth/authorization.service.js';

export function calcularVencimientoOrdenPago(ahora: Date): Date {
  const horasStr = process.env.PAYMENT_ORDER_EXPIRY_HOURS;
  const horasConfiguradas = horasStr ? Number(horasStr) : 48;
  const horas = Number.isFinite(horasConfiguradas) && horasConfiguradas > 0 ? horasConfiguradas : 48;
  return new Date(ahora.getTime() + horas * 3600 * 1000);
}

export class TesoreriaService {
  private readonly authorizationService: AuthorizationService;

  constructor(
    private readonly pool: Pool,
    private readonly repository: TesoreriaRepository = new TesoreriaRepository(),
    private readonly taypiProvider: TaypiProvider = new TaypiProvider(),
    private readonly demoQrProvider: DemoQrProvider = new DemoQrProvider(),
    authorizationService?: AuthorizationService,
  ) {
    this.authorizationService = authorizationService ?? new AuthorizationService(pool);
  }

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
      tipoOrden: fila.tipo_orden ?? 'PRINCIPAL',
      motivoAdicional: fila.motivo_adicional ?? null,
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

  private mapearFilaDevolucionADto(fila: FilaSolicitudDevolucion): DtoSolicitudDevolucion {
    const docStr = fila.solicitante_documento ?? '';
    const visibleLength = Math.min(3, Math.floor(docStr.length / 2));
    const masked = docStr.length > 0
      ? '•'.repeat(Math.max(docStr.length - visibleLength, 3)) + docStr.slice(-visibleLength)
      : '••••••';

    return {
      solicitudDevolucionId: fila.solicitud_devolucion_id,
      codigoDev: fila.codigo_dev,
      expedienteId: fila.expediente_id,
      codigoExpediente: fila.codigo_expediente ?? '',
      ordenPagoId: fila.orden_pago_id,
      codigoPago: fila.codigo_pago ?? '',
      codigoRecibo: fila.codigo_recibo ?? null,
      solicitanteId: fila.solicitante_id,
      solicitanteNombre: fila.solicitante_nombre ?? 'Administrado',
      solicitanteDocumento: masked,
      cuentaUsuarioId: fila.cuenta_usuario_id ?? null,
      canalRegistro: fila.canal_registro,
      causal: fila.causal,
      motivo: fila.motivo,
      montoOriginal: Number(fila.monto_original) || 0,
      montoSolicitado: Number(fila.monto_solicitado) || 0,
      montoAutorizado: fila.monto_autorizado !== null ? Number(fila.monto_autorizado) : null,
      montoDevuelto: fila.monto_devuelto !== null ? Number(fila.monto_devuelto) : null,
      estado: fila.estado,
      fechaSolicitud: fila.fecha_solicitud instanceof Date ? fila.fecha_solicitud.toISOString() : String(fila.fecha_solicitud),
      fechaAprobacion: fila.fecha_aprobacion ? (fila.fecha_aprobacion instanceof Date ? fila.fecha_aprobacion.toISOString() : String(fila.fecha_aprobacion)) : null,
      aprobadoPorId: fila.aprobado_por_id ?? null,
      aprobadoPorNombre: fila.aprobado_por_nombre ?? null,
      fechaDevolucion: fila.fecha_devolucion ? (fila.fecha_devolucion instanceof Date ? fila.fecha_devolucion.toISOString() : String(fila.fecha_devolucion)) : null,
      procesadoPorId: fila.procesado_por_id ?? null,
      procesadoPorNombre: fila.procesado_por_nombre ?? null,
      metodoDevolucion: fila.metodo_devolucion ?? null,
      constanciaDevolucionCodigo: fila.constancia_devolucion_codigo ?? null,
      motivoObservacion: fila.motivo_observacion ?? null,
      motivoRechazo: fila.motivo_rechazo ?? null,
      observacionResolucion: fila.observacion_resolucion ?? null,
      createdAt: fila.created_at instanceof Date ? fila.created_at.toISOString() : String(fila.created_at),
      updatedAt: fila.updated_at instanceof Date ? fila.updated_at.toISOString() : String(fila.updated_at),
    };
  }

  async generarOrdenPago(
    expedienteId: string,
    usuarioActorId: string,
    rolesActor: string[],
    personaActorId?: string,
    opciones?: {
      confirmarPagoAdicional?: boolean;
      motivoAdicional?: string;
    },
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

    const ordenExistente = await this.repository.obtenerOrdenActivaPorExpediente(
      this.pool,
      expedienteId,
    );

    const todasLasOrdenes = await this.repository.obtenerOrdenesPorExpediente(this.pool, expedienteId);

    const ordenesConfirmadas = todasLasOrdenes.filter((o) => o.estado === 'CONFIRMADO');
    const ordenConfirmada = ordenesConfirmadas[ordenesConfirmadas.length - 1] ?? (ordenExistente?.estado === 'CONFIRMADO' ? ordenExistente : null);

    const ahora = new Date();
    let esAdicional = false;

    if (ordenConfirmada) {
      // Prevención de duplicados accidentales: si ya existe pago confirmado, se exige confirmación explícita
      if (!opciones?.confirmarPagoAdicional) {
        const totalPagado = ordenesConfirmadas.length > 0
          ? ordenesConfirmadas.reduce((acc, curr) => acc + (Number(curr.monto) || 0), 0)
          : Number(ordenConfirmada.monto);
        throw new ConflictError({
          code: 'PAGO_YA_CONFIRMADO',
          message: 'El expediente ya cuenta con un pago confirmado y registrado en Tesorería.',
          detail: JSON.stringify({
            codigoPago: ordenConfirmada.codigo_pago,
            codigoRecibo: ordenConfirmada.codigo_recibo,
            monto: Number(ordenConfirmada.monto),
            fechaPago: ordenConfirmada.fecha_pago ? new Date(ordenConfirmada.fecha_pago).toISOString() : null,
            totalPagado,
            requiereConfirmacionAdicional: true,
          }),
        });
      }

      // Si confirmó explícitamente la intención de pago adicional
      if (!opciones.motivoAdicional || opciones.motivoAdicional.trim().length < 5) {
        throw new ValidationError({
          message: 'Debe ingresar un motivo descriptivo (mínimo 5 caracteres) para registrar un pago adicional.',
          invalidParams: [{ name: 'motivoAdicional', reason: 'MOTIVO_REQUERIDO: Ingrese la justificación del pago adicional.' }],
        });
      }

      // Idempotencia: si ya existe una orden adicional en PENDIENTE
      const adicionalPendiente = todasLasOrdenes.find(
        (o) => o.tipo_orden === 'ADICIONAL' && o.estado === 'PENDIENTE',
      );
      if (adicionalPendiente) {
        const vence = new Date(adicionalPendiente.fecha_vencimiento);
        if (ahora <= vence) {
          return this.mapearFilaADto(adicionalPendiente);
        }
        await this.repository.marcarOrdenVencida(this.pool, adicionalPendiente.orden_pago_id);
      }

      esAdicional = true;
    } else {
      // Orden principal: verificar si ya existe una orden activa
      if (ordenExistente) {
        if (ordenExistente.estado === 'PENDIENTE') {
          const vence = new Date(ordenExistente.fecha_vencimiento);
          if (ahora <= vence) {
            return this.mapearFilaADto(ordenExistente);
          }
          await this.repository.marcarOrdenVencida(this.pool, ordenExistente.orden_pago_id);
        }
      }
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
        concepto: esAdicional ? `Pago Adicional: ${contexto.concepto}` : contexto.concepto,
        codigoTupa: contexto.codigoTupa,
        monto: contexto.costoOficial,
        moneda: 'PEN',
        fechaVencimiento,
        tipoOrden: esAdicional ? 'ADICIONAL' : 'PRINCIPAL',
        motivoAdicional: esAdicional ? opciones?.motivoAdicional?.trim() : null,
      });

      // Actualizar estado del expediente a PENDIENTE_PAGO si estaba en REGISTRADO
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
          tipoOrden: nuevaOrden.tipo_orden,
          motivoAdicional: nuevaOrden.motivo_adicional,
          fechaVencimiento,
        },
      });

      if (esAdicional) {
        await insertarEvento(cliente, {
          agregado: 'TESORERIA',
          tipo_evento: 'ORDEN_PAGO_ADICIONAL_GENERADA',
          payload: {
            ordenPagoId: nuevaOrden.orden_pago_id,
            expedienteId,
            codigoPago: nuevaOrden.codigo_pago,
            monto: nuevaOrden.monto,
            motivoAdicional: nuevaOrden.motivo_adicional,
          },
        });
      }

      await cliente.query('COMMIT');

      const ordenCompleta = await this.repository.obtenerOrdenPorId(this.pool, nuevaOrden.orden_pago_id);
      return this.mapearFilaADto(ordenCompleta ?? nuevaOrden);
    } catch (error) {
      try { await cliente.query('ROLLBACK'); } catch { /* ignore */ }
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '23505' &&
        'constraint' in error &&
        (error.constraint === 'uq_tra_orden_pago_principal_activa' ||
          error.constraint === 'uq_tra_orden_pago_adicional_pendiente' ||
          error.constraint === 'uq_tra_orden_pago_activa_expediente')
      ) {
        const existente = error.constraint === 'uq_tra_orden_pago_adicional_pendiente'
          ? (await this.repository.obtenerOrdenesPorExpediente(this.pool, expedienteId))
              .find((orden) => orden.tipo_orden === 'ADICIONAL' && orden.estado === 'PENDIENTE')
          : await this.repository.obtenerOrdenActivaPorExpediente(this.pool, expedienteId);
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

  // ---------------------------------------------------------------------------
  // Módulo Devoluciones y Saldos de Expediente (Fase 3)
  // ---------------------------------------------------------------------------

  async calcularSaldosExpediente(
    expedienteId: string,
    rolesActor: string[],
    personaActorId?: string,
    usuarioActorId?: string,
  ): Promise<DtoSaldosExpediente> {
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

    const esInstitucional = rolesActor.some((r) =>
      ['MESA_PARTES', 'ADMINISTRADOR', 'DIRECTOR', 'SECRETARIO', 'ESPECIALISTA', 'TESORERIA'].includes(
        r.toUpperCase(),
      ),
    );

    if (!esInstitucional && (!personaActorId || contexto.solicitanteId !== personaActorId)) {
      throw new ForbiddenError({
        detail: 'BOLA_VIOLATION: No tiene autorización para consultar la información financiera de este expediente.',
      });
    }
    if (!esInstitucional && (!usuarioActorId ||
      !await this.repository.cuentaCiudadanaVinculadaAlExpediente(this.pool, expedienteId, usuarioActorId, personaActorId!))) {
      throw new ForbiddenError({ detail: 'BOLA_VIOLATION: Expediente no vinculado formalmente a esta cuenta.' });
    }

    const todasOrdenes = await this.repository.obtenerOrdenesPorExpediente(this.pool, expedienteId);
    const todasDevoluciones = await this.repository.listarDevolucionesPorExpediente(this.pool, expedienteId);

    const ordenesConfirmadas = todasOrdenes.filter((o) => o.estado === 'CONFIRMADO');
    const totalPagado = ordenesConfirmadas.reduce((acc, curr) => acc + (Number(curr.monto) || 0), 0);
    const costoOficial = contexto.costoOficial;
    const diferencia = Number((totalPagado - costoOficial).toFixed(2));
    const posibleSobrepago = (costoOficial > 0 && totalPagado > costoOficial) || (costoOficial === 0 && totalPagado > 0);

    const ordenesCalculadas = await Promise.all(
      todasOrdenes.map(async (ord) => {
        const saldoDevolvible = ord.estado === 'CONFIRMADO'
          ? await this.repository.calcularSaldoDevolviblePago(this.pool, ord.orden_pago_id)
          : 0;

        return {
          ordenPagoId: ord.orden_pago_id,
          codigoPago: ord.codigo_pago,
          codigoRecibo: ord.codigo_recibo ?? null,
          tipoOrden: ord.tipo_orden ?? 'PRINCIPAL',
          monto: Number(ord.monto) || 0,
          estado: ord.estado,
          fechaPago: ord.fecha_pago ? (ord.fecha_pago instanceof Date ? ord.fecha_pago.toISOString() : String(ord.fecha_pago)) : null,
          saldoDevolvible,
        };
      }),
    );

    return {
      expedienteId,
      codigoExpediente: contexto.codigoExpediente,
      costoOficial,
      totalPagado,
      diferencia,
      posibleSobrepago,
      ordenes: ordenesCalculadas,
      devoluciones: todasDevoluciones.map((d) => this.mapearFilaDevolucionADto(d)),
    };
  }

  async solicitarDevolucion(
    datos: {
      expedienteId: string;
      ordenPagoId: string;
      causal: CausalDevolucion;
      motivo: string;
      montoSolicitado: number;
      canalRegistro: CanalRegistroDevolucion;
    },
    usuarioActorId: string,
    rolesActor: string[],
    personaActorId?: string,
  ): Promise<DtoSolicitudDevolucion> {
    const orden = await this.repository.obtenerOrdenPorId(this.pool, datos.ordenPagoId);
    if (!orden || orden.expediente_id !== datos.expedienteId) {
      throw new NotFoundError({
        message: 'Orden de pago no encontrada.',
        detail: `No existe la orden ${datos.ordenPagoId} en el expediente ${datos.expedienteId}.`,
      });
    }

    if (orden.estado !== 'CONFIRMADO') {
      throw new ConflictError({
        code: 'ORDEN_NO_CONFIRMADA',
        message: 'Solo se puede solicitar devolución sobre pagos efectivamente confirmados en Tesorería.',
      });
    }

    const esInstitucional = rolesActor.some((r) =>
      ['MESA_PARTES', 'ADMINISTRADOR'].includes(r.toUpperCase()),
    );

    if (!esInstitucional && (!personaActorId || orden.solicitante_id !== personaActorId)) {
      throw new ForbiddenError({
        detail: 'BOLA_VIOLATION: No tiene autorización para solicitar devoluciones sobre este pago.',
      });
    }
    if (!esInstitucional && !await this.repository.cuentaCiudadanaVinculadaAlExpediente(
      this.pool, datos.expedienteId, usuarioActorId, personaActorId!,
    )) {
      throw new ForbiddenError({ detail: 'BOLA_VIOLATION: Expediente no vinculado formalmente a esta cuenta.' });
    }

    const saldoDevolvible = await this.repository.calcularSaldoDevolviblePago(this.pool, datos.ordenPagoId);
    if (datos.montoSolicitado > saldoDevolvible) {
      throw new ValidationError({
        message: `El monto solicitado (S/ ${datos.montoSolicitado.toFixed(2)}) supera el saldo disponible devolvible de este pago (S/ ${saldoDevolvible.toFixed(2)}).`,
        invalidParams: [{ name: 'montoSolicitado', reason: 'MONTO_EXCEDE_SALDO_DISPONIBLE' }],
      });
    }

    // Validación semántica para PAGO_DUPLICADO: debe existir evidencia real de más de un pago
    // confirmado asociado al expediente. No permite convertir un pago único en "duplicado".
    if (datos.causal === 'PAGO_DUPLICADO') {
      const todasLasOrdenes = await this.repository.obtenerOrdenesPorExpediente(this.pool, datos.expedienteId);
      const ordenesConfirmadas = todasLasOrdenes.filter((o) => o.estado === 'CONFIRMADO');
      if (ordenesConfirmadas.length < 2) {
        throw new ValidationError({
          message: 'La causal PAGO_DUPLICADO requiere evidencia de más de un pago confirmado asociado al expediente.',
          invalidParams: [{ name: 'causal', reason: 'PAGO_DUPLICADO_REQUIERE_EVIDENCIA: No existe más de un pago confirmado para este expediente.' }],
        });
      }
    }

    const devolucionActiva = await this.repository.obtenerSolicitudDevolucionActivaPorOrden(
      this.pool,
      datos.ordenPagoId,
    );
    if (devolucionActiva) {
      throw new ConflictError({
        code: 'DEVOLUCION_EN_TRAMITE',
        message: `Ya existe una solicitud de devolución (${devolucionActiva.codigo_dev}) en estado ${devolucionActiva.estado} para este pago.`,
      });
    }

    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');

      const ahora = new Date();
      const anio = ahora.getFullYear();
      const codigoDev = await this.repository.obtenerSiguienteCodigoDev(cliente, anio);

      const nuevaSolicitud = await this.repository.insertarSolicitudDevolucion(cliente, {
        codigoDev,
        expedienteId: datos.expedienteId,
        ordenPagoId: datos.ordenPagoId,
        solicitanteId: orden.solicitante_id,
        cuentaUsuarioId: esInstitucional ? null : usuarioActorId,
        canalRegistro: datos.canalRegistro,
        causal: datos.causal,
        motivo: datos.motivo.trim(),
        montoOriginal: Number(orden.monto),
        montoSolicitado: datos.montoSolicitado,
      });

      await registrarMutacion(cliente, {
        esquema: 'sigd_tra',
        tabla: 'solicitud_devolucion',
        operacion: 'INSERT',
        datos_despues: {
          solicitudDevolucionId: nuevaSolicitud.solicitud_devolucion_id,
          codigoDev,
          expedienteId: datos.expedienteId,
          ordenPagoId: datos.ordenPagoId,
          montoSolicitado: datos.montoSolicitado,
          causal: datos.causal,
        },
      });

      await insertarEvento(cliente, {
        agregado: 'TESORERIA',
        tipo_evento: 'DEVOLUCION_SOLICITADA',
        payload: {
          solicitudDevolucionId: nuevaSolicitud.solicitud_devolucion_id,
          codigoDev,
          expedienteId: datos.expedienteId,
          ordenPagoId: datos.ordenPagoId,
          montoSolicitado: datos.montoSolicitado,
          causal: datos.causal,
        },
      });

      await cliente.query('COMMIT');

      const completa = await this.repository.obtenerSolicitudDevolucionPorId(
        this.pool,
        nuevaSolicitud.solicitud_devolucion_id,
      );
      return this.mapearFilaDevolucionADto(completa ?? nuevaSolicitud);
    } catch (error) {
      try { await cliente.query('ROLLBACK'); } catch { /* ignore */ }
      throw error;
    } finally {
      cliente.release();
    }
  }

  async revisarDevolucion(
    solicitudDevolucionId: string,
    usuarioActorId: string,
    rolesActor: string[],
  ): Promise<DtoSolicitudDevolucion> {
    const esAutorizado = rolesActor.some((r) => ['MESA_PARTES', 'ADMINISTRADOR'].includes(r.toUpperCase()));
    if (!esAutorizado) {
      throw new ForbiddenError({
        detail: 'Acceso denegado: Solo Mesa de Partes o Administrador pueden revisar solicitudes de devolución.',
      });
    }

    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');

      const solicitud = await this.repository.obtenerSolicitudDevolucionPorIdConLock(
        cliente,
        solicitudDevolucionId,
      );
      if (!solicitud) {
        throw new NotFoundError({
          message: 'Solicitud de devolución no encontrada.',
          detail: `No existe la solicitud con id ${solicitudDevolucionId}.`,
        });
      }

      if (!['SOLICITADA', 'SUBSANADA'].includes(solicitud.estado)) {
        throw new ConflictError({
          code: 'ESTADO_INVALIDO_PARA_REVISION',
          message: `La solicitud se encuentra en estado ${solicitud.estado} y no puede pasar a revisión.`,
        });
      }

      await this.repository.actualizarSolicitudDevolucion(cliente, solicitudDevolucionId, {
        estado: 'EN_REVISION',
      });

      await registrarMutacion(cliente, {
        esquema: 'sigd_tra',
        tabla: 'solicitud_devolucion',
        operacion: 'UPDATE',
        datos_antes: { estado: solicitud.estado },
        datos_despues: { estado: 'EN_REVISION', revisadoPor: usuarioActorId },
      });

      await cliente.query('COMMIT');

      const actualizada = await this.repository.obtenerSolicitudDevolucionPorId(
        this.pool,
        solicitudDevolucionId,
      );
      return this.mapearFilaDevolucionADto(actualizada!);
    } catch (error) {
      try { await cliente.query('ROLLBACK'); } catch { /* ignore */ }
      throw error;
    } finally {
      cliente.release();
    }
  }

  async observarDevolucion(
    solicitudDevolucionId: string,
    motivoObservacion: string,
    usuarioActorId: string,
    rolesActor: string[],
  ): Promise<DtoSolicitudDevolucion> {
    const esAutorizado = rolesActor.some((r) => ['MESA_PARTES', 'ADMINISTRADOR'].includes(r.toUpperCase()));
    if (!esAutorizado) {
      throw new ForbiddenError({
        detail: 'Acceso denegado: Solo Mesa de Partes o Administrador pueden observar solicitudes de devolución.',
      });
    }

    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');

      const solicitud = await this.repository.obtenerSolicitudDevolucionPorIdConLock(
        cliente,
        solicitudDevolucionId,
      );
      if (!solicitud) {
        throw new NotFoundError({
          message: 'Solicitud de devolución no encontrada.',
          detail: `No existe la solicitud con id ${solicitudDevolucionId}.`,
        });
      }

      if (!['SOLICITADA', 'EN_REVISION'].includes(solicitud.estado)) {
        throw new ConflictError({
          code: 'ESTADO_INVALIDO_PARA_OBSERVACION',
          message: `La solicitud se encuentra en estado ${solicitud.estado} y no puede ser observada.`,
        });
      }

      await this.repository.actualizarSolicitudDevolucion(cliente, solicitudDevolucionId, {
        estado: 'OBSERVADA',
        motivoObservacion: motivoObservacion.trim(),
      });

      await registrarMutacion(cliente, {
        esquema: 'sigd_tra',
        tabla: 'solicitud_devolucion',
        operacion: 'UPDATE',
        datos_antes: { estado: solicitud.estado },
        datos_despues: {
          estado: 'OBSERVADA',
          motivoObservacion: motivoObservacion.trim(),
          observadoPor: usuarioActorId,
        },
      });

      await cliente.query('COMMIT');

      const actualizada = await this.repository.obtenerSolicitudDevolucionPorId(
        this.pool,
        solicitudDevolucionId,
      );
      return this.mapearFilaDevolucionADto(actualizada!);
    } catch (error) {
      try { await cliente.query('ROLLBACK'); } catch { /* ignore */ }
      throw error;
    } finally {
      cliente.release();
    }
  }

  async subsanarDevolucion(
    solicitudDevolucionId: string,
    sustentoSubsanacion: string,
    usuarioActorId: string,
    rolesActor: string[],
    personaActorId?: string,
  ): Promise<DtoSolicitudDevolucion> {
    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');

      const solicitud = await this.repository.obtenerSolicitudDevolucionPorIdConLock(
        cliente,
        solicitudDevolucionId,
      );
      if (!solicitud) {
        throw new NotFoundError({
          message: 'Solicitud de devolución no encontrada.',
          detail: `No existe la solicitud con id ${solicitudDevolucionId}.`,
        });
      }

      const esMesa = rolesActor.some((r) => ['MESA_PARTES', 'ADMINISTRADOR'].includes(r.toUpperCase()));
      if (!esMesa && (!personaActorId || solicitud.solicitante_id !== personaActorId)) {
        throw new ForbiddenError({
          detail: 'BOLA_VIOLATION: No tiene autorización para subsanar esta solicitud de devolución.',
        });
      }

      if (solicitud.estado !== 'OBSERVADA') {
        throw new ConflictError({
          code: 'SOLICITUD_NO_OBSERVADA',
          message: `La solicitud se encuentra en estado ${solicitud.estado} y no requiere subsanación.`,
        });
      }

      const observacionActual = solicitud.motivo_observacion ?? '';
      const observacionConSubsanacion = `${observacionActual}\n[Subsanación ${new Date().toISOString()}]: ${sustentoSubsanacion.trim()}`.trim();

      await this.repository.actualizarSolicitudDevolucion(cliente, solicitudDevolucionId, {
        estado: 'SUBSANADA',
        motivoObservacion: observacionConSubsanacion,
      });

      await registrarMutacion(cliente, {
        esquema: 'sigd_tra',
        tabla: 'solicitud_devolucion',
        operacion: 'UPDATE',
        datos_antes: { estado: solicitud.estado },
        datos_despues: {
          estado: 'SUBSANADA',
          sustentoSubsanacion: sustentoSubsanacion.trim(),
          subsanadoPor: usuarioActorId,
        },
      });

      await cliente.query('COMMIT');

      const actualizada = await this.repository.obtenerSolicitudDevolucionPorId(
        this.pool,
        solicitudDevolucionId,
      );
      return this.mapearFilaDevolucionADto(actualizada!);
    } catch (error) {
      try { await cliente.query('ROLLBACK'); } catch { /* ignore */ }
      throw error;
    } finally {
      cliente.release();
    }
  }

  async aprobarDevolucion(
    solicitudDevolucionId: string,
    montoAutorizado: number,
    observacionResolucion: string | undefined,
    usuarioActorId: string,
    rolesActor: string[],
  ): Promise<DtoSolicitudDevolucion> {
    // Principio de Separación de Poderes (Filtro previo):
    // Solo roles competentes documentalmente. Tesorería NO autoriza devoluciones.
    const esRolAutorizado = rolesActor.some((r) =>
      ['MESA_PARTES', 'ADMINISTRADOR', 'DIRECTOR'].includes(r.toUpperCase()),
    );
    if (!esRolAutorizado) {
      throw new ForbiddenError({
        message: 'No autorizado para realizar esta acción.',
        detail: 'Acceso denegado: Tesorería no tiene competencia para autorizar documentalmente devoluciones.',
      });
    }

    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');

      const solicitud = await this.repository.obtenerSolicitudDevolucionPorIdConLock(
        cliente,
        solicitudDevolucionId,
      );
      if (!solicitud) {
        throw new NotFoundError({
          message: 'Solicitud de devolución no encontrada.',
          detail: `No existe la solicitud con id ${solicitudDevolucionId}.`,
        });
      }

      // Principio de Autorización Contextual y Segregación de Funciones (Fase 5D):
      // Exige permiso DEVOLUCION_AUTORIZAR validando cuenta activa, perfil operativo vigente (AUTORIZADOR_DEVOLUCION),
      // scope institucional y prohibición estricta de autoaprobación (solicitante !== autorizador).
      const autz = await this.authorizationService.exigirAutorizacion({
        usuarioId: usuarioActorId,
        rolesDeclarados: rolesActor,
        accion: 'DEVOLUCION_AUTORIZAR',
        recurso: {
          tipo: 'SOLICITUD_DEVOLUCION',
          id: solicitudDevolucionId,
          solicitanteUsuarioId: solicitud.cuenta_usuario_id ?? undefined,
          solicitantePersonaId: solicitud.solicitante_id,
        },
      });

      // Principio de Segregación de Funciones: Prohibición estricta de autoaprobación (Fase 5D)
      if (solicitud.cuenta_usuario_id === usuarioActorId) {
        throw new ForbiddenError({
          message: 'No autorizado para realizar esta acción.',
          detail: 'Principio de Segregación: El solicitante no puede ser el autorizador de su propia devolución (Autoaprobación prohibida).',
        });
      }

      if (!['SOLICITADA', 'EN_REVISION', 'SUBSANADA'].includes(solicitud.estado)) {
        throw new ConflictError({
          code: 'ESTADO_INVALIDO_PARA_APROBACION',
          message: `La solicitud se encuentra en estado ${solicitud.estado} y no puede ser aprobada.`,
        });
      }

      // Bloqueo pesimista en la orden de pago para evitar carreras concurrentes de sobre-devolución
      const orden = await this.repository.obtenerOrdenPorIdConLock(cliente, solicitud.orden_pago_id);
      if (!orden || orden.estado !== 'CONFIRMADO') {
        throw new ConflictError({
          code: 'ORDEN_NO_CONFIRMADA',
          message: 'La orden de pago asociada no se encuentra en estado CONFIRMADO.',
        });
      }

      // Cálculo atómico del saldo devolvible disponible
      const saldoDevolvible = await this.repository.calcularSaldoDevolviblePago(cliente, solicitud.orden_pago_id);
      if (!Number.isFinite(montoAutorizado) || montoAutorizado <= 0) {
        throw new ValidationError({
          message: 'El monto autorizado debe ser mayor a cero.',
          invalidParams: [{ name: 'montoAutorizado', reason: 'MONTO_INVALIDO' }],
        });
      }
      if (montoAutorizado > Number(solicitud.monto_solicitado)) {
        throw new ConflictError({
          code: 'MONTO_EXCEDE_SOLICITADO',
          message: 'El monto autorizado no puede superar el monto solicitado.',
        });
      }
      if (montoAutorizado > saldoDevolvible) {
        throw new ConflictError({
          code: 'SALDO_INSUFICIENTE',
          message: `El monto autorizado (S/ ${montoAutorizado.toFixed(2)}) excede el saldo devolvible disponible del pago (S/ ${saldoDevolvible.toFixed(2)}).`,
        });
      }

      const ahora = new Date();

      // Transición a PENDIENTE_TESORERIA (formal reserva de saldo financiero)
      await this.repository.actualizarSolicitudDevolucion(cliente, solicitudDevolucionId, {
        estado: 'PENDIENTE_TESORERIA',
        montoAutorizado,
        fechaAprobacion: ahora,
        aprobadoPorId: usuarioActorId,
        observacionResolucion: observacionResolucion?.trim() || null,
      });

      await registrarMutacion(cliente, {
        esquema: 'sigd_tra',
        tabla: 'solicitud_devolucion',
        operacion: 'UPDATE',
        datos_antes: { estado: solicitud.estado },
        datos_despues: {
          estado: 'PENDIENTE_TESORERIA',
          montoAutorizado,
          fechaAprobacion: ahora.toISOString(),
          aprobadoPorId: usuarioActorId,
          autorizacion: {
            perfil: autz.perfilAplicado,
            permiso: 'DEVOLUCION_AUTORIZAR',
            scope: autz.scopeAplicado,
          },
        },
      });

      await insertarEvento(cliente, {
        agregado: 'TESORERIA',
        tipo_evento: 'DEVOLUCION_APROBADA',
        payload: {
          solicitudDevolucionId,
          codigoDev: solicitud.codigo_dev,
          expedienteId: solicitud.expediente_id,
          ordenPagoId: solicitud.orden_pago_id,
          montoAutorizado,
          aprobadoPorId: usuarioActorId,
          fechaAprobacion: ahora.toISOString(),
        },
      });

      await cliente.query('COMMIT');

      const actualizada = await this.repository.obtenerSolicitudDevolucionPorId(
        this.pool,
        solicitudDevolucionId,
      );
      return this.mapearFilaDevolucionADto(actualizada!);
    } catch (error) {
      try { await cliente.query('ROLLBACK'); } catch { /* ignore */ }
      throw error;
    } finally {
      cliente.release();
    }
  }

  async rechazarDevolucion(
    solicitudDevolucionId: string,
    motivoRechazo: string,
    usuarioActorId: string,
    rolesActor: string[],
  ): Promise<DtoSolicitudDevolucion> {
    const esAutorizado = rolesActor.some((r) => ['MESA_PARTES', 'ADMINISTRADOR'].includes(r.toUpperCase()));
    if (!esAutorizado) {
      throw new ForbiddenError({
        detail: 'Acceso denegado: Solo Mesa de Partes o Administrador pueden rechazar solicitudes de devolución.',
      });
    }

    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');

      const solicitud = await this.repository.obtenerSolicitudDevolucionPorIdConLock(
        cliente,
        solicitudDevolucionId,
      );
      if (!solicitud) {
        throw new NotFoundError({
          message: 'Solicitud de devolución no encontrada.',
          detail: `No existe la solicitud con id ${solicitudDevolucionId}.`,
        });
      }

      if (!['SOLICITADA', 'EN_REVISION', 'OBSERVADA', 'SUBSANADA'].includes(solicitud.estado)) {
        throw new ConflictError({
          code: 'ESTADO_INVALIDO_PARA_RECHAZO',
          message: `La solicitud se encuentra en estado ${solicitud.estado} y no puede ser rechazada.`,
        });
      }

      await this.repository.actualizarSolicitudDevolucion(cliente, solicitudDevolucionId, {
        estado: 'RECHAZADA',
        motivoRechazo: motivoRechazo.trim(),
      });

      await registrarMutacion(cliente, {
        esquema: 'sigd_tra',
        tabla: 'solicitud_devolucion',
        operacion: 'UPDATE',
        datos_antes: { estado: solicitud.estado },
        datos_despues: {
          estado: 'RECHAZADA',
          motivoRechazo: motivoRechazo.trim(),
          rechazadoPor: usuarioActorId,
        },
      });

      await cliente.query('COMMIT');

      const actualizada = await this.repository.obtenerSolicitudDevolucionPorId(
        this.pool,
        solicitudDevolucionId,
      );
      return this.mapearFilaDevolucionADto(actualizada!);
    } catch (error) {
      try { await cliente.query('ROLLBACK'); } catch { /* ignore */ }
      throw error;
    } finally {
      cliente.release();
    }
  }

  async ejecutarDevolucion(
    solicitudDevolucionId: string,
    metodoDevolucion: MetodoDevolucion,
    observacion: string | undefined,
    usuarioActorId: string,
    rolesActor: string[],
  ): Promise<DtoSolicitudDevolucion> {
    // Principio de Separación de Poderes (Filtro previo):
    // Solo personal financiero. Mesa de Partes NO ejecuta desembolsos.
    const esRolFinanciero = rolesActor.some((r) =>
      ['TESORERIA', 'ADMINISTRADOR'].includes(r.toUpperCase()),
    );
    if (!esRolFinanciero) {
      throw new ForbiddenError({
        message: 'No autorizado para realizar esta acción.',
        detail: 'Acceso denegado: Solo el personal de Tesorería puede ejecutar materialmente el desembolso de devolución.',
      });
    }

    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');

      const solicitud = await this.repository.obtenerSolicitudDevolucionPorIdConLock(
        cliente,
        solicitudDevolucionId,
      );
      if (!solicitud) {
        throw new NotFoundError({
          message: 'Solicitud de devolución no encontrada.',
          detail: `No existe la solicitud con id ${solicitudDevolucionId}.`,
        });
      }

      // Principio de Autorización Contextual y Segregación de Funciones (Fase 5D):
      // Exige permiso DEVOLUCION_EJECUTAR validando cuenta activa, perfil operativo financiero vigente (GESTOR_TESORERIA),
      // scope institucional y segregación estricta de funciones (autorizador !== ejecutor).
      const autz = await this.authorizationService.exigirAutorizacion({
        usuarioId: usuarioActorId,
        rolesDeclarados: rolesActor,
        accion: 'DEVOLUCION_EJECUTAR',
        recurso: {
          tipo: 'SOLICITUD_DEVOLUCION',
          id: solicitudDevolucionId,
          solicitanteUsuarioId: solicitud.cuenta_usuario_id ?? undefined,
          solicitantePersonaId: solicitud.solicitante_id,
          autorizadorUsuarioId: solicitud.aprobado_por_id ?? undefined,
        },
      });

      // Principio de Segregación de Funciones: Quien autoriza no puede ejecutar materialmente (Fase 5D)
      if (solicitud.aprobado_por_id === usuarioActorId) {
        throw new ForbiddenError({
          message: 'No autorizado para realizar esta acción.',
          detail: 'Principio de Segregación: Quien autorizó documentalmente la devolución no puede ejecutar materialmente el desembolso.',
        });
      }

      if (solicitud.estado !== 'PENDIENTE_TESORERIA') {
        throw new ConflictError({
          code: 'NO_PENDIENTE_TESORERIA',
          message: `La solicitud se encuentra en estado ${solicitud.estado}. Solo se pueden procesar desembolsos sobre solicitudes en PENDIENTE_TESORERIA.`,
        });
      }

      const ahora = new Date();
      const anio = ahora.getFullYear();
      const codigoCdev = await this.repository.obtenerSiguienteCodigoCdev(cliente, anio);
      const montoDevuelto = Number(solicitud.monto_autorizado);

      await this.repository.actualizarSolicitudDevolucion(cliente, solicitudDevolucionId, {
        estado: 'DEVUELTA',
        montoDevuelto,
        fechaDevolucion: ahora,
        procesadoPorId: usuarioActorId,
        metodoDevolucion,
        constanciaDevolucionCodigo: codigoCdev,
        observacionResolucion: observacion?.trim()
          ? `${solicitud.observacion_resolucion ?? ''}\n[Tesorería ${ahora.toISOString()}]: ${observacion.trim()}`.trim()
          : solicitud.observacion_resolucion,
      });

      // La orden de pago y recibo original quedan intactos (principio de inmutabilidad contable)
      await registrarMutacion(cliente, {
        esquema: 'sigd_tra',
        tabla: 'solicitud_devolucion',
        operacion: 'UPDATE',
        datos_antes: { estado: solicitud.estado },
        datos_despues: {
          estado: 'DEVUELTA',
          constanciaDevolucionCodigo: codigoCdev,
          montoDevuelto,
          metodoDevolucion,
          procesadoPorId: usuarioActorId,
          fechaDevolucion: ahora.toISOString(),
          autorizacion: {
            perfil: autz.perfilAplicado,
            permiso: 'DEVOLUCION_EJECUTAR',
            scope: autz.scopeAplicado,
          },
        },
      });

      await insertarEvento(cliente, {
        agregado: 'TESORERIA',
        tipo_evento: 'DEVOLUCION_PROCESADA',
        payload: {
          solicitudDevolucionId,
          codigoDev: solicitud.codigo_dev,
          constanciaDevolucionCodigo: codigoCdev,
          expedienteId: solicitud.expediente_id,
          ordenPagoId: solicitud.orden_pago_id,
          montoDevuelto,
          metodoDevolucion,
          procesadoPorId: usuarioActorId,
          fechaDevolucion: ahora.toISOString(),
        },
      });

      await cliente.query('COMMIT');

      const actualizada = await this.repository.obtenerSolicitudDevolucionPorId(
        this.pool,
        solicitudDevolucionId,
      );
      return this.mapearFilaDevolucionADto(actualizada!);
    } catch (error) {
      try { await cliente.query('ROLLBACK'); } catch { /* ignore */ }
      throw error;
    } finally {
      cliente.release();
    }
  }

  async listarDevoluciones(
    params: DtoBuscarDevolucionesParams,
    rolesActor: string[],
    personaActorId?: string,
  ): Promise<{ total: number; items: DtoSolicitudDevolucion[] }> {
    const esInstitucional = rolesActor.some((r) =>
      ['MESA_PARTES', 'ADMINISTRADOR', 'DIRECTOR', 'SECRETARIO', 'ESPECIALISTA', 'TESORERIA'].includes(
        r.toUpperCase(),
      ),
    );

    // Si es ciudadano, solo puede listar las suyas
    if (!esInstitucional && !personaActorId) {
      throw new ForbiddenError({
        detail: 'BOLA_VIOLATION: No tiene autorización para listar devoluciones.',
      });
    }

    const { total, items } = await this.repository.listarSolicitudesDevolucion(
      this.pool, params, esInstitucional ? undefined : personaActorId,
    );

    return {
      total,
      items: items.map((d) => this.mapearFilaDevolucionADto(d)),
    };
  }

  async obtenerDevolucionPorId(
    solicitudDevolucionId: string,
    rolesActor: string[],
    personaActorId?: string,
  ): Promise<DtoSolicitudDevolucion> {
    const solicitud = await this.repository.obtenerSolicitudDevolucionPorId(
      this.pool,
      solicitudDevolucionId,
    );
    if (!solicitud) {
      throw new NotFoundError({
        message: 'Solicitud de devolución no encontrada.',
        detail: `No existe la solicitud con id ${solicitudDevolucionId}.`,
      });
    }

    const esInstitucional = rolesActor.some((r) =>
      ['MESA_PARTES', 'ADMINISTRADOR', 'DIRECTOR', 'SECRETARIO', 'ESPECIALISTA', 'TESORERIA'].includes(
        r.toUpperCase(),
      ),
    );

    if (!esInstitucional && (!personaActorId || solicitud.solicitante_id !== personaActorId)) {
      throw new ForbiddenError({
        detail: 'BOLA_VIOLATION: No tiene autorización para consultar esta solicitud de devolución.',
      });
    }

    return this.mapearFilaDevolucionADto(solicitud);
  }

  // ---------------------------------------------------------------------------
  // Atención presencial y registro sin cuenta
  // ---------------------------------------------------------------------------

  async buscarPersonaParaAtencionPresencial(
    tipoDocumento: string,
    numeroDocumento: string,
    operadorId: string,
  ): Promise<{
    encontrada: boolean;
    persona?: {
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

  async registrarPersonaPresencial(
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
    operadorId: string,
  ) {
    if (datos.tipoDocumento === 'DNI' && !/^[0-9]{8}$/.test(datos.numeroDocumento.trim())) {
      throw new ValidationError({
        invalidParams: [{ name: 'numeroDocumento', reason: 'El DNI debe tener exactamente 8 dígitos.' }],
      });
    }
    if (datos.tipoDocumento === 'RUC' && !/^[0-9]{11}$/.test(datos.numeroDocumento.trim())) {
      throw new ValidationError({
        invalidParams: [{ name: 'numeroDocumento', reason: 'El RUC debe tener exactamente 11 dígitos.' }],
      });
    }
    if (datos.tipoDocumento === 'CE' && !/^[0-9a-zA-Z]{9,12}$/.test(datos.numeroDocumento.trim())) {
      throw new ValidationError({
        invalidParams: [{ name: 'numeroDocumento', reason: 'El Carné de Extranjería debe tener entre 9 y 12 caracteres alfanuméricos.' }],
      });
    }

    return await this.repository.registrarPersonaSinCuenta(this.pool, datos, operadorId);
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
    ordenPagoId: string,
    rolesActor: string[],
    personaActorId?: string,
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

    if (
      orden.payment_provider === 'TAYPI' &&
      orden.provider_payment_id &&
      orden.provider_qr_image &&
      orden.provider_expires_at &&
      ahora < new Date(orden.provider_expires_at)
    ) {
      return this.mapearFilaADto(orden);
    }

    const resultado = await this.taypiProvider.createPayment({
      ordenPagoId: orden.orden_pago_id,
      codigoPago: orden.codigo_pago,
      monto: Number(orden.monto),
      concepto: orden.concepto,
    });

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

    if (event.event !== 'payment.completed') {
      return {
        received: true,
        status: 'ignored',
        motivo: `Evento ${event.event} no requiere confirmación en Tesorería.`,
      };
    }

    if (event.currency !== 'PEN') {
      return {
        received: true,
        status: 'rejected',
        motivo: `Moneda inválida (${event.currency}). Solo se aceptan transacciones en PEN.`,
      };
    }

    if (event.status !== 'completed') {
      return {
        received: true,
        status: 'ignored',
        motivo: `Estado del pago (${event.status}) no es completed.`,
      };
    }

    const cliente = await this.pool.connect();
    try {
      await cliente.query('BEGIN');

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

      if (orden.estado === 'CONFIRMADO') {
        await cliente.query('COMMIT');
        return {
          received: true,
          status: 'already_confirmed',
          codigoPago: orden.codigo_pago,
          codigoRecibo: orden.codigo_recibo,
        };
      }

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

      const montoOficial = Number(orden.monto);
      const montoDiscrepante = proveedor === 'DEMO_QR'
        ? !Number.isFinite(event.amount) || Math.round(event.amount * 100) !== Math.round(montoOficial * 100)
        : Math.abs(event.amount - montoOficial) > 0.01;
      if (montoDiscrepante) {
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
        tesoreroId: null,
        fechaPago,
        confirmedSource: 'WEBHOOK',
        providerPaymentId: event.paymentId,
        providerStatus: 'completed',
      });

      await cliente.query(
        `UPDATE sigd_tra.expediente
            SET estado = 'REGISTRADO'
          WHERE expediente_id = $1::uuid
            AND estado = 'PENDIENTE_PAGO'`,
        [orden.expediente_id],
      );

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
