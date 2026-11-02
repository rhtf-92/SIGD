export type EstadoOrdenPago = 'PENDIENTE' | 'CONFIRMADO' | 'RECHAZADO' | 'VENCIDO' | 'ANULADO';

export type MetodoPago = 'EFECTIVO' | 'YAPE' | 'QR_AUTOMATICO_SANDBOX';

export type PaymentProvider = 'MANUAL' | 'TAYPI' | 'DEMO_QR';

export type ConfirmedSource = 'TESORERIA' | 'WEBHOOK';

export type TipoOrdenPago = 'PRINCIPAL' | 'ADICIONAL';

export type CausalDevolucion = 'SOBREPAGO' | 'PAGO_DUPLICADO' | 'PAGO_INDEBIDO' | 'DESISTIMIENTO' | 'TRAMITE_DENEGADO' | 'OTRO';

export type EstadoDevolucion =
  | 'SOLICITADA'
  | 'EN_REVISION'
  | 'OBSERVADA'
  | 'SUBSANADA'
  | 'APROBADA'
  | 'PENDIENTE_TESORERIA'
  | 'DEVUELTA'
  | 'RECHAZADA'
  | 'ANULADA';

export type CanalRegistroDevolucion = 'VIRTUAL' | 'PRESENCIAL' | 'MESA_PARTES';

export type MetodoDevolucion = 'EFECTIVO' | 'TRANSFERENCIA' | 'YAPE' | 'CHEQUE';

export interface FilaOrdenPago {
  orden_pago_id: string;
  codigo_pago: string;
  expediente_id: string;
  registro_version_id: string | null;
  solicitante_id: string;
  concepto: string;
  codigo_tupa: string | null;
  monto: string | number;
  moneda: string;
  estado: EstadoOrdenPago;
  tipo_orden?: TipoOrdenPago;
  motivo_adicional?: string | null;
  metodo_pago: MetodoPago | null;
  referencia_operacion: string | null;
  monto_recibido: string | number | null;
  vuelto: string | number | null;
  codigo_recibo: string | null;
  fecha_creacion: Date;
  fecha_vencimiento: Date;
  fecha_pago: Date | null;
  tesorero_id: string | null;
  motivo_rechazo: string | null;
  observacion: string | null;
  payment_provider?: PaymentProvider | null;
  provider_payment_id?: string | null;
  provider_checkout_token?: string | null;
  provider_qr_image?: string | null;
  provider_checkout_url?: string | null;
  provider_status?: string | null;
  provider_expires_at?: Date | null;
  confirmed_source?: ConfirmedSource | null;
  provider_reference?: string | null;
  created_at: Date;
  updated_at: Date;
  // Campos de JOIN opcionales
  codigo_expediente?: string;
  dni_solicitante?: string | null;
  nombre_solicitante?: string | null;
  tipo_documento_solicitante?: string | null;
  numero_documento_solicitante?: string | null;
  nombre_tesorero?: string | null;
}

export interface DtoOrdenPago {
  ordenPagoId: string;
  codigoPago: string;
  expedienteId: string;
  codigoExpediente: string;
  solicitanteId: string;
  solicitanteNombre: string;
  documentoEnmascarado: string;
  concepto: string;
  codigoTupa: string | null;
  monto: number;
  moneda: string;
  estado: EstadoOrdenPago;
  tipoOrden: TipoOrdenPago;
  motivoAdicional: string | null;
  metodoPago: MetodoPago | null;
  referenciaOperacion: string | null;
  montoRecibido: number | null;
  vuelto: number | null;
  codigoRecibo: string | null;
  fechaCreacion: string;
  fechaVencimiento: string;
  fechaPago: string | null;
  tesoreroId: string | null;
  tesoreroNombre?: string | null;
  motivoRechazo: string | null;
  paymentProvider?: PaymentProvider | null;
  providerPaymentId?: string | null;
  providerCheckoutToken?: string | null;
  providerQrImage?: string | null;
  providerCheckoutUrl?: string | null;
  providerStatus?: string | null;
  providerExpiresAt?: string | null;
  confirmedSource?: ConfirmedSource | null;
  providerReference?: string | null;
}

export interface FilaSolicitudDevolucion {
  solicitud_devolucion_id: string;
  codigo_dev: string;
  expediente_id: string;
  orden_pago_id: string;
  solicitante_id: string;
  cuenta_usuario_id: string | null;
  canal_registro: CanalRegistroDevolucion;
  causal: CausalDevolucion;
  motivo: string;
  monto_original: string | number;
  monto_solicitado: string | number;
  monto_autorizado: string | number | null;
  monto_devuelto: string | number | null;
  estado: EstadoDevolucion;
  fecha_solicitud: Date;
  fecha_aprobacion: Date | null;
  aprobado_por_id: string | null;
  fecha_devolucion: Date | null;
  procesado_por_id: string | null;
  metodo_devolucion: MetodoDevolucion | null;
  constancia_devolucion_codigo: string | null;
  motivo_observacion: string | null;
  motivo_rechazo: string | null;
  observacion_resolucion: string | null;
  created_at: Date;
  updated_at: Date;
  // Campos de JOIN opcionales
  codigo_expediente?: string;
  codigo_pago?: string;
  codigo_recibo?: string | null;
  solicitante_nombre?: string | null;
  solicitante_documento?: string | null;
  aprobado_por_nombre?: string | null;
  procesado_por_nombre?: string | null;
}

export interface DtoSolicitudDevolucion {
  solicitudDevolucionId: string;
  codigoDev: string;
  expedienteId: string;
  codigoExpediente: string;
  ordenPagoId: string;
  codigoPago: string;
  codigoRecibo: string | null;
  solicitanteId: string;
  solicitanteNombre: string;
  solicitanteDocumento: string;
  cuentaUsuarioId: string | null;
  canalRegistro: CanalRegistroDevolucion;
  causal: CausalDevolucion;
  motivo: string;
  montoOriginal: number;
  montoSolicitado: number;
  montoAutorizado: number | null;
  montoDevuelto: number | null;
  estado: EstadoDevolucion;
  fechaSolicitud: string;
  fechaAprobacion: string | null;
  aprobadoPorId: string | null;
  aprobadoPorNombre: string | null;
  fechaDevolucion: string | null;
  procesadoPorId: string | null;
  procesadoPorNombre: string | null;
  metodoDevolucion: MetodoDevolucion | null;
  constanciaDevolucionCodigo: string | null;
  motivoObservacion: string | null;
  motivoRechazo: string | null;
  observacionResolucion: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DtoSaldosExpediente {
  expedienteId: string;
  codigoExpediente: string;
  costoOficial: number;
  totalPagado: number;
  diferencia: number;
  posibleSobrepago: boolean;
  ordenes: Array<{
    ordenPagoId: string;
    codigoPago: string;
    codigoRecibo: string | null;
    tipoOrden: TipoOrdenPago;
    monto: number;
    estado: EstadoOrdenPago;
    fechaPago: string | null;
    saldoDevolvible: number;
  }>;
  devoluciones: DtoSolicitudDevolucion[];
}

export interface DtoResumenDashboardTesoreria {
  pendientes: number;
  confirmadosHoy: number;
  vencidos: number;
}

export interface DtoBuscarOrdenesParams {
  estado?: EstadoOrdenPago | 'TODOS';
  buscar?: string;
  page?: number;
  limit?: number;
}

export interface DtoBuscarDevolucionesParams {
  estado?: EstadoDevolucion | 'TODAS';
  buscar?: string;
  expedienteId?: string;
  page?: number;
  limit?: number;
}
