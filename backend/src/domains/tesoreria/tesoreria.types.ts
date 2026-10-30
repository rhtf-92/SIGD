export type EstadoOrdenPago = 'PENDIENTE' | 'CONFIRMADO' | 'RECHAZADO' | 'VENCIDO' | 'ANULADO';

export type MetodoPago = 'EFECTIVO' | 'YAPE' | 'QR_AUTOMATICO_SANDBOX';

export type PaymentProvider = 'MANUAL' | 'TAYPI' | 'DEMO_QR';

export type ConfirmedSource = 'TESORERIA' | 'WEBHOOK';

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
