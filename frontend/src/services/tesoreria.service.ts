import { apiClient } from '../api/client';

export type EstadoOrdenPago = 'PENDIENTE' | 'CONFIRMADO' | 'RECHAZADO' | 'VENCIDO' | 'ANULADO';

export type MetodoPago = 'EFECTIVO' | 'YAPE' | 'QR_AUTOMATICO_SANDBOX';

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
  nombres: string;
  apellidos: string;
  nombreCompleto: string;
  documentoEnmascarado: string;
  tipoDocumento: string;
  numeroDocumento: string;
  tieneCuentaUsuario: boolean;
}

export interface DtoPersonaBusquedaRespuesta {
  exito: boolean;
  datos: DtoPersonaBusqueda | null;
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

  async generarOrdenPagoExpediente(expedienteId: string, signal?: AbortSignal): Promise<DtoOrdenPago> {
    const res = await apiClient.post<DtoOrdenPago>(
      `/api/v1/expedientes/${encodeURIComponent(expedienteId)}/orden-pago`,
      {},
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

  async obtenerConfiguracionDemoQr(signal?: AbortSignal): Promise<DtoConfiguracionDemoQr> {
    const res = await apiClient.get<DtoConfiguracionDemoQr>('/api/v1/tesoreria/configuracion-demo-qr', { signal });
    return res.data;
  },

  async crearPagoDemoQr(ordenPagoId: string, signal?: AbortSignal): Promise<{ ok: boolean; orden: DtoOrdenPago }> {
    const res = await apiClient.post<{ ok: boolean; orden: DtoOrdenPago }>(
      `/api/v1/tesoreria/ordenes/${encodeURIComponent(ordenPagoId)}/pago-demo-qr`, {}, { signal });
    return res.data;
  },
};
