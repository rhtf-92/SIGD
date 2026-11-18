import { apiClient } from '../api/client';

export type EstadoOrdenPago = 'PENDIENTE' | 'CONFIRMADO' | 'RECHAZADO' | 'VENCIDO' | 'ANULADO';

export type MetodoPago = 'EFECTIVO' | 'YAPE' | 'QR_AUTOMATICO_SANDBOX';

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

export interface DtoConfiguracionDemoQr {
  configured: boolean;
  sandbox: true;
  publicUrl: string | null;
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
  tipoOrden?: TipoOrdenPago;
  motivoAdicional?: string | null;
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
  paymentProvider?: 'MANUAL' | 'TAYPI' | 'DEMO_QR' | null;
  providerPaymentId?: string | null;
  providerCheckoutToken?: string | null;
  providerQrImage?: string | null;
  providerCheckoutUrl?: string | null;
  providerStatus?: string | null;
  providerExpiresAt?: string | null;
  confirmedSource?: 'TESORERIA' | 'WEBHOOK' | null;
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

export interface DtoBuscarOrdenesRespuesta {
  items: DtoOrdenPago[];
  total: number;
  page: number;
  totalPages: number;
}

export interface DtoConfirmarPagoBody {
  metodoPago: MetodoPago;
  referenciaOperacion?: string;
  montoRecibido?: number;
}

export interface DtoConfirmarPagoRespuesta {
  ok: boolean;
  mensaje: string;
  orden: DtoOrdenPago;
}

export interface DtoRechazarPagoBody {
  motivo: string;
}

export interface DtoRechazarPagoRespuesta {
  ok: boolean;
  mensaje: string;
  orden: DtoOrdenPago;
}

export interface DtoExpedientePagoRespuesta {
  tieneOrden: boolean;
  pago: DtoOrdenPago | null;
}

export interface DtoPersonaBusqueda {
  idPersona: string;
  tipoPersona?: 'NATURAL' | 'JURIDICA';
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
}

export interface DtoPersonaBusquedaRespuesta {
  encontrada: boolean;
  persona?: DtoPersonaBusqueda | null;
  exito?: boolean;
  datos?: DtoPersonaBusqueda | null;
}

export interface DtoRegistrarPersonaPresencialBody {
  tipoPersona: 'NATURAL' | 'JURIDICA';
  tipoDocumento: 'DNI' | 'CE' | 'RUC';
  numeroDocumento: string;
  nombres?: string;
  apellidos?: string;
  razonSocial?: string;
  correo?: string | null;
  telefono?: string | null;
  direccion?: string | null;
}

export interface DtoRegistrarPersonaPresencialRespuesta {
  ok: boolean;
  mensaje: string;
  persona: DtoPersonaBusqueda;
}

// ---------------------------------------------------------------------------
// Interfaces de Devoluciones (Fase 3)
// ---------------------------------------------------------------------------

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

export interface SolicitarDevolucionPayload {
  expedienteId: string;
  ordenPagoId: string;
  causal: CausalDevolucion;
  motivo: string;
  montoSolicitado: number;
}

export const tesoreriaService = {
  async obtenerDashboard(signal?: AbortSignal): Promise<DtoResumenDashboardTesoreria> {
    const res = await apiClient.get<DtoResumenDashboardTesoreria>('/api/v1/tesoreria/dashboard', { signal });
    return res.data;
  },

  async listarOrdenes(params: DtoBuscarOrdenesParams = {}, signal?: AbortSignal): Promise<DtoBuscarOrdenesRespuesta> {
    const query = new URLSearchParams();
    if (params.estado && params.estado !== 'TODOS') query.set('estado', params.estado);
    if (params.buscar?.trim()) query.set('buscar', params.buscar.trim());
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));

    const qs = query.toString();
    const url = `/api/v1/tesoreria/ordenes${qs ? `?${qs}` : ''}`;
    const res = await apiClient.get<DtoBuscarOrdenesRespuesta>(url, { signal });
    return res.data;
  },

  async obtenerOrdenPorId(ordenPagoId: string, signal?: AbortSignal): Promise<DtoOrdenPago> {
    const res = await apiClient.get<DtoOrdenPago>(`/api/v1/tesoreria/ordenes/${encodeURIComponent(ordenPagoId)}`, { signal });
    return res.data;
  },

  async confirmarPago(
    ordenPagoId: string,
    datos: DtoConfirmarPagoBody,
    signal?: AbortSignal
  ): Promise<DtoConfirmarPagoRespuesta> {
    const res = await apiClient.post<DtoConfirmarPagoRespuesta>(
      `/api/v1/tesoreria/ordenes/${encodeURIComponent(ordenPagoId)}/confirmar`,
      datos,
      { signal }
    );
    return res.data;
  },

  async rechazarPago(
    ordenPagoId: string,
    motivo: string,
    signal?: AbortSignal
  ): Promise<DtoRechazarPagoRespuesta> {
    const res = await apiClient.post<DtoRechazarPagoRespuesta>(
      `/api/v1/tesoreria/ordenes/${encodeURIComponent(ordenPagoId)}/rechazar`,
      { motivo },
      { signal }
    );
    return res.data;
  },

  async obtenerPagoExpediente(expedienteId: string, signal?: AbortSignal): Promise<DtoExpedientePagoRespuesta> {
    const res = await apiClient.get<DtoExpedientePagoRespuesta>(
      `/api/v1/expedientes/${encodeURIComponent(expedienteId)}/pago`,
      { signal }
    );
    return res.data;
  },

  async generarOrdenPagoExpediente(
    expedienteId: string,
    opciones?: { confirmarPagoAdicional?: boolean; motivoAdicional?: string },
    signal?: AbortSignal,
  ): Promise<DtoOrdenPago> {
    const res = await apiClient.post<DtoOrdenPago>(
      `/api/v1/expedientes/${encodeURIComponent(expedienteId)}/orden-pago`,
      opciones ?? {},
      { signal }
    );
    return res.data;
  },

  async buscarPersonaPresencial(
    tipoDocumento: string,
    numeroDocumento: string,
    signal?: AbortSignal
  ): Promise<DtoPersonaBusquedaRespuesta> {
    const res = await apiClient.get<DtoPersonaBusquedaRespuesta>(
      `/api/v1/mesa-partes/personas/buscar?tipoDocumento=${encodeURIComponent(tipoDocumento)}&numeroDocumento=${encodeURIComponent(numeroDocumento)}`,
      { signal }
    );
    return res.data;
  },

  async registrarPersonaPresencial(
    datos: DtoRegistrarPersonaPresencialBody,
    signal?: AbortSignal
  ): Promise<DtoRegistrarPersonaPresencialRespuesta> {
    const res = await apiClient.post<DtoRegistrarPersonaPresencialRespuesta>(
      '/api/v1/mesa-partes/personas',
      datos,
      { signal }
    );
    return res.data;
  },

  async obtenerConfiguracionDemoQr(signal?: AbortSignal): Promise<DtoConfiguracionDemoQr> {
    const res = await apiClient.get<DtoConfiguracionDemoQr>('/api/v1/tesoreria/configuracion-demo-qr', { signal });
    return res.data;
  },

  async crearPagoDemoQr(ordenPagoId: string, signal?: AbortSignal): Promise<{ ok: boolean; orden: DtoOrdenPago }> {
    const res = await apiClient.post<{ ok: boolean; orden: DtoOrdenPago }>(
      `/api/v1/tesoreria/ordenes/${encodeURIComponent(ordenPagoId)}/pago-demo-qr`, {}, { signal });
    return res.data;
  },

  // ---------------------------------------------------------------------------
  // Servicios de Devoluciones y Saldos (Fase 3)
  // ---------------------------------------------------------------------------

  async obtenerSaldosExpediente(expedienteId: string, signal?: AbortSignal): Promise<DtoSaldosExpediente> {
    const res = await apiClient.get<DtoSaldosExpediente>(
      `/api/v1/expedientes/${encodeURIComponent(expedienteId)}/saldos`,
      { signal }
    );
    return res.data;
  },

  async solicitarDevolucion(
    payload: SolicitarDevolucionPayload,
    signal?: AbortSignal
  ): Promise<{ ok: boolean; mensaje: string; codigoDev: string; devolucion: DtoSolicitudDevolucion }> {
    const res = await apiClient.post<{ ok: boolean; mensaje: string; codigoDev: string; devolucion: DtoSolicitudDevolucion }>(
      '/api/v1/devoluciones',
      payload,
      { signal }
    );
    return res.data;
  },

  async listarDevoluciones(
    params: { estado?: string; buscar?: string; expedienteId?: string; page?: number; limit?: number } = {},
    signal?: AbortSignal
  ): Promise<{ items: DtoSolicitudDevolucion[]; total: number; page: number; totalPages: number }> {
    const query = new URLSearchParams();
    if (params.estado && params.estado !== 'TODAS') query.set('estado', params.estado);
    if (params.buscar?.trim()) query.set('buscar', params.buscar.trim());
    if (params.expedienteId) query.set('expedienteId', params.expedienteId);
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));

    const qs = query.toString();
    const url = `/api/v1/devoluciones${qs ? `?${qs}` : ''}`;
    const res = await apiClient.get<{ items: DtoSolicitudDevolucion[]; total: number; page: number; totalPages: number }>(
      url,
      { signal }
    );
    return res.data;
  },

  async obtenerDevolucionPorId(id: string, signal?: AbortSignal): Promise<DtoSolicitudDevolucion> {
    const res = await apiClient.get<DtoSolicitudDevolucion>(
      `/api/v1/devoluciones/${encodeURIComponent(id)}`,
      { signal }
    );
    return res.data;
  },

  async revisarDevolucion(
    id: string,
    signal?: AbortSignal
  ): Promise<{ ok: boolean; mensaje: string; devolucion: DtoSolicitudDevolucion }> {
    const res = await apiClient.post<{ ok: boolean; mensaje: string; devolucion: DtoSolicitudDevolucion }>(
      `/api/v1/devoluciones/${encodeURIComponent(id)}/revisar`,
      {},
      { signal }
    );
    return res.data;
  },

  async observarDevolucion(
    id: string,
    motivoObservacion: string,
    signal?: AbortSignal
  ): Promise<{ ok: boolean; mensaje: string; devolucion: DtoSolicitudDevolucion }> {
    const res = await apiClient.post<{ ok: boolean; mensaje: string; devolucion: DtoSolicitudDevolucion }>(
      `/api/v1/devoluciones/${encodeURIComponent(id)}/observar`,
      { motivoObservacion },
      { signal }
    );
    return res.data;
  },

  async subsanarDevolucion(
    id: string,
    sustentoSubsanacion: string,
    signal?: AbortSignal
  ): Promise<{ ok: boolean; mensaje: string; devolucion: DtoSolicitudDevolucion }> {
    const res = await apiClient.post<{ ok: boolean; mensaje: string; devolucion: DtoSolicitudDevolucion }>(
      `/api/v1/devoluciones/${encodeURIComponent(id)}/subsanar`,
      { sustentoSubsanacion },
      { signal }
    );
    return res.data;
  },

  async aprobarDevolucion(
    id: string,
    montoAutorizado: number,
    observacionResolucion?: string,
    signal?: AbortSignal
  ): Promise<{ ok: boolean; mensaje: string; devolucion: DtoSolicitudDevolucion }> {
    const res = await apiClient.post<{ ok: boolean; mensaje: string; devolucion: DtoSolicitudDevolucion }>(
      `/api/v1/devoluciones/${encodeURIComponent(id)}/aprobar`,
      { montoAutorizado, observacionResolucion },
      { signal }
    );
    return res.data;
  },

  async rechazarDevolucion(
    id: string,
    motivoRechazo: string,
    signal?: AbortSignal
  ): Promise<{ ok: boolean; mensaje: string; devolucion: DtoSolicitudDevolucion }> {
    const res = await apiClient.post<{ ok: boolean; mensaje: string; devolucion: DtoSolicitudDevolucion }>(
      `/api/v1/devoluciones/${encodeURIComponent(id)}/rechazar`,
      { motivoRechazo },
      { signal }
    );
    return res.data;
  },

  async ejecutarDevolucion(
    id: string,
    metodoDevolucion: MetodoDevolucion,
    observacion?: string,
    signal?: AbortSignal
  ): Promise<{ ok: boolean; mensaje: string; constanciaDevolucionCodigo: string; devolucion: DtoSolicitudDevolucion }> {
    const res = await apiClient.post<{ ok: boolean; mensaje: string; constanciaDevolucionCodigo: string; devolucion: DtoSolicitudDevolucion }>(
      `/api/v1/devoluciones/${encodeURIComponent(id)}/ejecutar`,
      { metodoDevolucion, observacion },
      { signal }
    );
    return res.data;
  },
};
