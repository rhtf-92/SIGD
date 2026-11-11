export type EstadoLectorDnie =
  | 'LECTOR_NO_PRESENTE'
  | 'LECTOR_PRESENTE_SIN_TARJETA'
  | 'TARJETA_PRESENTE'
  | 'CERTIFICADO_DISPONIBLE'
  | 'CERTIFICADO_VALIDO'
  | 'BRIDGE_NO_DISPONIBLE';

export interface CertificadoDnieInfo {
  id: string;
  subject: string;
  issuer: string;
  serialNumber: string;
  thumbprint: string;
  validFrom: string;
  validTo: string;
  dni: string;
  nombreCompleto: string;
  algoritmo: string;
  esVigente: boolean;
  pem: string;
}

export interface EstadoDispositivoDnie {
  estado: EstadoLectorDnie;
  mensaje: string;
  lectorNombre?: string;
  tarjetaDetectada: boolean;
  certificados: CertificadoDnieInfo[];
}

export interface ResultadoFirmaDnie {
  hashSha256: string;
  firmaB64: string;
  certificadoPem: string;
  algoritmo: string;
  proveedor: string;
}

export interface DniHardwareAdapter {
  detectarDispositivo(): Promise<EstadoDispositivoDnie>;
  listarCertificados(): Promise<CertificadoDnieInfo[]>;
  /**
   * Ejecuta la firma criptográfica del hash en el dispositivo seguro.
   * Por diseño estricto de seguridad, la capa web NUNCA recibe ni solicita el PIN.
   * El diálogo seguro de PIN lo gestiona directamente el middleware o servicio nativo del SO.
   */
  firmarHash(
    hashHex: string,
    certificadoId: string,
  ): Promise<ResultadoFirmaDnie>;
}
