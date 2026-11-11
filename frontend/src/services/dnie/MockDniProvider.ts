import type {
  CertificadoDnieInfo,
  DniHardwareAdapter,
  EstadoDispositivoDnie,
  EstadoLectorDnie,
  ResultadoFirmaDnie,
} from './dnieAdapter.types';

export interface ConfiguracionMockDnie {
  estadoLector?: EstadoLectorDnie;
  lectorNombre?: string;
  tarjetaPresente?: boolean;
  certificados?: CertificadoDnieInfo[];
  dniTitular?: string;
  nombreTitular?: string;
  certificadoExpirado?: boolean;
}

// Certificado X.509 de prueba generado específicamente para tests con clave efímera pública
export const CERTIFICADO_TEST_PEM = `-----BEGIN CERTIFICATE-----
MIICljCCAX4CCQDCfK1V2g3X7zANBgkqhkiG9w0BAQsFADBCMQswCQYDVQQGEwJQ
RTEQMA4GA1UECgwHSUVTVFAgUzERMA8GA1UECwwIRmlybWEgNTERMA8GA1UEAwwI
Q0EgU1VJTkEwHhcNMjYwMTAxMDAwMDAwWhcNMjcwMTAxMDAwMDAwWjBUMQswCQYD
VQQGEwJQRTERMA8GA1UECwwIRmlybWEgNTEvMC0GA1UEAwwmQ0FSTE9TIEFMQkVS
VE8gU0FOQ0hFWiAoRE5JIDk5MDAwMDA1KTEQMA4GA1UEBRMNOTkwMDAwMDUwggEi
MA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDEcEfZNf/QWvQ8P0U+8GfB9yD
Jq1t109+L0A1K2r3X4M5l8L6p4P9R4m6W9S4s3K6R0p5v4Q1Z8p4K5l6M7X8w9A
B3C5D6E7F8A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C1D2E3F4A5B6C7
D8E9F0A1B2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C1D2E3F4A5B6C7D8E9
AgMBAAEwDQYJKoZIhvcNAQELBQADggEBAAN5l4k6p4P8Q9m1r2S3t4U5v6w7x8y9
-----END CERTIFICATE-----`;

export class MockDniProvider implements DniHardwareAdapter {
  private configuracion: ConfiguracionMockDnie;

  constructor(configuracion: ConfiguracionMockDnie = {}) {
    // Salvaguarda obligatoria: Prohibido en producción
    if (typeof window !== 'undefined' && (import.meta as any).env?.PROD) {
      throw new Error(
        'PROVEEDOR_MOCK_PROHIBIDO_EN_PRODUCCION: MockDniProvider está estrictamente prohibido en producción.',
      );
    }
    this.configuracion = {
      estadoLector: 'CERTIFICADO_VALIDO',
      lectorNombre: 'Bit4id miniLector EVO (SIMULADO)',
      tarjetaPresente: true,
      dniTitular: '99000005',
      nombreTitular: 'CARLOS ALBERTO SANCHEZ',
      certificadoExpirado: false,
      ...configuracion,
    };
  }

  actualizarConfiguracion(nuevaConfig: Partial<ConfiguracionMockDnie>): void {
    this.configuracion = { ...this.configuracion, ...nuevaConfig };
  }

  async detectarDispositivo(): Promise<EstadoDispositivoDnie> {
    const { estadoLector, lectorNombre, tarjetaPresente } = this.configuracion;

    if (estadoLector === 'LECTOR_NO_PRESENTE') {
      return {
        estado: 'LECTOR_NO_PRESENTE',
        mensaje: 'No se detectó ningún lector de tarjetas inteligentes conectado al equipo.',
        tarjetaDetectada: false,
        certificados: [],
      };
    }

    if (estadoLector === 'LECTOR_PRESENTE_SIN_TARJETA' || !tarjetaPresente) {
      return {
        estado: 'LECTOR_PRESENTE_SIN_TARJETA',
        mensaje: `Lector ${lectorNombre} detectado, pero no se ha insertado ninguna tarjeta inteligente (DNIe).`,
        lectorNombre,
        tarjetaDetectada: false,
        certificados: [],
      };
    }

    const certs = await this.listarCertificados();

    if (estadoLector === 'TARJETA_PRESENTE' || certs.length === 0) {
      return {
        estado: 'TARJETA_PRESENTE',
        mensaje: 'DNIe insertado, pero no contiene certificados digitales legibles.',
        lectorNombre,
        tarjetaDetectada: true,
        certificados: [],
      };
    }

    return {
      estado: estadoLector ?? 'CERTIFICADO_VALIDO',
      mensaje: `DNIe listo para firma. Certificado de ${certs[0].nombreCompleto} verificado.`,
      lectorNombre,
      tarjetaDetectada: true,
      certificados: certs,
    };
  }

  async listarCertificados(): Promise<CertificadoDnieInfo[]> {
    if (this.configuracion.certificados) {
      return this.configuracion.certificados;
    }

    const { dniTitular, nombreTitular, certificadoExpirado } = this.configuracion;
    const ahora = new Date();
    const validFrom = certificadoExpirado
      ? new Date(ahora.getTime() - 2 * 365 * 86400000).toISOString()
      : new Date(ahora.getTime() - 30 * 86400000).toISOString();
    const validTo = certificadoExpirado
      ? new Date(ahora.getTime() - 10 * 86400000).toISOString()
      : new Date(ahora.getTime() + 365 * 86400000).toISOString();

    return [
      {
        id: 'cert-mock-01',
        subject: `CN=${nombreTitular || 'DIRECTOR GENERAL'} (DNI ${dniTitular || '99000005'})/serialNumber=${dniTitular || '99000005'}`,
        issuer: 'CN=IESTP Suiza CA Subordinada/O=IESTP Suiza/C=PE',
        serialNumber: `SN-${dniTitular || '99000005'}-2026`,
        thumbprint: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
        validFrom,
        validTo,
        dni: dniTitular || '99000005',
        nombreCompleto: nombreTitular || 'DIRECTOR GENERAL',
        algoritmo: 'RSA-2048',
        esVigente: !certificadoExpirado,
        pem: CERTIFICADO_TEST_PEM,
      },
    ];
  }

  async firmarHash(
    hashHex: string,
    _certificadoId: string,
  ): Promise<ResultadoFirmaDnie> {
    const certs = await this.listarCertificados();
    const cert = certs[0];

    if (!cert) {
      throw new Error('NO_HAY_CERTIFICADO: No existe certificado disponible en el DNIe para firmar.');
    }

    if (!cert.esVigente) {
      throw new Error('CERTIFICADO_EXPIRADO: El certificado digital del DNIe ha expirado.');
    }

    // Generar firma determinista simulada para tests
    const dummySignatureBytes = new Uint8Array(256);
    for (let i = 0; i < dummySignatureBytes.length; i++) {
      dummySignatureBytes[i] = (hashHex.charCodeAt(i % hashHex.length) + i) % 256;
    }
    const firmaB64 = btoa(String.fromCharCode(...dummySignatureBytes));

    return {
      hashSha256: hashHex,
      firmaB64,
      certificadoPem: cert.pem,
      algoritmo: 'SHA256withRSA',
      proveedor: 'MOCK_TEST',
    };
  }
}
