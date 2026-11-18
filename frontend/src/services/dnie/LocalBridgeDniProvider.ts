import type {
  CertificadoDnieInfo,
  DniHardwareAdapter,
  EstadoDispositivoDnie,
  ResultadoFirmaDnie,
} from './dnieAdapter.types';

export interface LocalBridgeConfig {
  bridgeUrl?: string;
  timeoutMs?: number;
}

/**
 * Proveedor de enlace con el bridge nativo local del DNI electrónico.
 *
 * ESTADO OPERATIVO:
 * - Contrato e interfaz implementados bajo el patrón Adapter.
 * - Integración con bridge nativo real: NO IMPLEMENTADO / NO CERTIFICADO mientras
 *   no se cuente con lector físico, middleware oficial ni tarjeta DNIe real.
 * - Si no existe la variable VITE_DNIE_BRIDGE_URL configurada en el entorno,
 *   falla cerrado inmediatamente con estado BRIDGE_NO_DISPONIBLE.
 * - La aplicación web SIGD jamás maneja ni recibe el PIN del DNIe; cualquier solicitud
 *   de PIN es delegada exclusivamente al diálogo nativo del middleware del sistema operativo.
 */
export class LocalBridgeDniProvider implements DniHardwareAdapter {
  private bridgeUrl: string;
  private timeoutMs: number;

  constructor(config: LocalBridgeConfig = {}) {
    const envUrl = typeof window !== 'undefined'
      ? (import.meta as any).env?.VITE_DNIE_BRIDGE_URL
      : process.env.VITE_DNIE_BRIDGE_URL;

    this.bridgeUrl = config.bridgeUrl ?? envUrl ?? '';
    this.timeoutMs = config.timeoutMs ?? 2500;
  }

  async detectarDispositivo(): Promise<EstadoDispositivoDnie> {
    // Si la URL del bridge no está configurada, fallar cerrado de forma explícita
    if (!this.bridgeUrl || this.bridgeUrl.trim() === '') {
      return {
        estado: 'BRIDGE_NO_DISPONIBLE',
        mensaje: 'El servicio de integración con puente DNIe local no se encuentra configurado (VITE_DNIE_BRIDGE_URL no definida).',
        tarjetaDetectada: false,
        certificados: [],
      };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

      const resp = await fetch(`${this.bridgeUrl}/estado`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!resp.ok) {
        return {
          estado: 'LECTOR_NO_PRESENTE',
          mensaje: 'El servicio de tarjeta inteligente local no respondió satisfactoriamente.',
          tarjetaDetectada: false,
          certificados: [],
        };
      }

      const datos = (await resp.json()) as EstadoDispositivoDnie;
      return datos;
    } catch {
      // Bridge no instalado, servicio no iniciado o timeout
      return {
        estado: 'LECTOR_NO_PRESENTE',
        mensaje:
          'No se pudo conectar con el puente local DNIe en ' + this.bridgeUrl + '. Asegúrese de que el servicio local esté en ejecución.',
        tarjetaDetectada: false,
        certificados: [],
      };
    }
  }

  async listarCertificados(): Promise<CertificadoDnieInfo[]> {
    const estado = await this.detectarDispositivo();
    return estado.certificados;
  }

  async firmarHash(
    hashHex: string,
    certificadoId: string,
  ): Promise<ResultadoFirmaDnie> {
    if (!this.bridgeUrl || this.bridgeUrl.trim() === '') {
      throw new Error('BRIDGE_NO_DISPONIBLE: La URL del bridge local no está configurada.');
    }

    // Por diseño de seguridad: el PIN NUNCA viaja por este contrato web.
    // El bridge nativo dispara directamente el diálogo seguro de PIN del middleware / SO.
    const resp = await fetch(`${this.bridgeUrl}/firmar`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        hashHex,
        certificadoId,
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.message ?? 'Error al ejecutar la firma criptográfica en el DNIe local.');
    }

    const resultado = (await resp.json()) as ResultadoFirmaDnie;
    return resultado;
  }
}
