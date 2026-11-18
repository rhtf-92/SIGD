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
MIIDkjCCAnqgAwIBAgIUOzA6I1ZwRO7Glq0DKE5xH4RHXtQwDQYJKoZIhvcNAQEL
BQAwVzELMAkGA1UEBhMCUEUxGDAWBgNVBAoMD0lFU1RQIFNVSVpBIExBQjESMBAG
A1UECwwJVEVTVF9PTkxZMRowGAYDVQQDDBFTSUdEIFRFU1QgUk9PVCBDQTAeFw0y
NjExMDkyMTAyNDdaFw0yODExMDgyMTAyNDdaMGsxCzAJBgNVBAYTAlBFMRQwEgYD
VQQKDAtJRVNUUCBTVUlaQTESMBAGA1UECwwJRElSRUNDSU9OMREwDwYDVQQFEwg5
OTAwMDAwNTEfMB0GA1UEAwwWQ0FSTE9TIEFMQkVSVE8gU0FOQ0hFWjCCASIwDQYJ
KoZIhvcNAQEBBQADggEPADCCAQoCggEBAJ0/sZRdUtuBNW7NY9jS4y6+FtWmhqNL
DzYxW5wKqrQaIUnv3M7hfaDr6JmUkfAR0CW+9hlNx3q/GyS0Ff5ayh1tS2hPZ5LB
obTp8zDVGi84BfGfckWpEl+2SbLWUQ0hr0s+elH5NaN9ec36oNCnjX6cUGRTVEDY
q3dN8HKfz/XpKvlvWIPzdy6oZ07Efyj0c0f+yZhtwWkTjTKfcSF7NUqCqko1fgx9
prZe3jRWhQxwyuO7BXqQG6aw3neXjjB616Lsoo3c52vc0MUcXNBSiQAX5efo6M7s
z5NH+hkRRxu/NXk2WU0bjQ+iQ3EcqqKEuz/yMWwnKEOL4ydAZvtcD58CAwEAAaNC
MEAwHQYDVR0OBBYEFL4TSXJXWaDIIAGqamAxJ999REHbMB8GA1UdIwQYMBaAFMKQ
MV7Bh+h1zExCrnwXCSjp5VNCMA0GCSqGSIb3DQEBCwUAA4IBAQB0VGKNUq1u/UNb
9wLei9Lbgn3REL5e3IIo5XXz+InJCICMyOck1zTGY8Q/PJj6E8c/HcUnZ0bFTkrf
ClwOrtH9N6cYHSVqTdomuPQxHJRzfLoHLDsNdhDt0p7v//rHI4EuYH8YO1ICqNOr
FZtLwBHoTvzGA+VrJlbYpG4v0HrokRSde5YZpZLXpxPfC0QAFd2kvnfpwLEpOqs2
qL6kzkGqJf5RCyER8O/IyORIx0HwLE9MuIwLJvszccqZNxiTdLPngZ9QftPJA1UG
Aws5FwB08XQnPXnYadUA5nfL8gU5FaN/uM3XOrOUM1HKqTGwUhpokCp8w9uXTCp4
7x9zB7UV
-----END CERTIFICATE-----`;

export const KEY_TEST_PEM = `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQCdP7GUXVLbgTVu
zWPY0uMuvhbVpoajSw82MVucCqq0GiFJ79zO4X2g6+iZlJHwEdAlvvYZTcd6vxsk
tBX+WsodbUtoT2eSwaG06fMw1RovOAXxn3JFqRJftkmy1lENIa9LPnpR+TWjfXnN
+qDQp41+nFBkU1RA2Kt3TfByn8/16Sr5b1iD83cuqGdOxH8o9HNH/smYbcFpE40y
n3EhezVKgqpKNX4Mfaa2Xt40VoUMcMrjuwV6kBumsN53l44wetei7KKN3Odr3NDF
HFzQUokAF+Xn6OjO7M+TR/oZEUcbvzV5NllNG40PokNxHKqihLs/8jFsJyhDi+Mn
QGb7XA+fAgMBAAECggEAA8mE5X9pyzdSg0FBd5kXzvDVwhyhpcFqvd9Pjc6QRrdf
VqmovBk7SxuYdsKpjaiYK3iOhr0eXqlOGLVIDSoRL9SdzLX+VwuvmZ+ASydXK/iK
NZTHQ+jq6iGui+zNn9Jdu8TZeIn/b4hXz+SRWubPbOD3/zji3jEN60uWAq7Smqtc
zlBn+16piLRUKq9rS5TOMb1uC8soCOV2ipEgXR/c0zEIbvI91QdBW8aSLyYvbs6c
pF/eMuQY0UiZtEhyzgUZwVLjap345Hq64JBVivBoHzTdOuZnqq+2ZxdDjQ9ulF6b
K+Q6VvnoMCuIIOjBQD9iIHZ2T1TRQ0lh+x6nJVSfOQKBgQDaGimyivStQuLwOQeQ
yRdReWIH8VkaZtqxCJR+WRcWnpcYjBB85+XnPHl4VjvPJogwlNNMj+ixfJYHenz9
HtB36fmDWyveyMrGZqi/fZPras92wVebB70jVBp40L/I5QOljwFiQVXm1OQDBKuM
Z44Fm5KdN//PS3Hsff5DopBYKQKBgQC4kpcMtIcVG/OFv3+rTN3w5SdYHJwsSC+n
uZri4bCvnjiaJm8tqKTdg8RX3//Nth1yUnEcbwjCS7Z9IPCqKqmT/nwQs9R5mPGP
zKsOyDeChY6ZqDd4NLJp2nGIlpYbTBcduHpRu4390RMl7YrxwXUQLXtsQMrbuXSS
UykgUstChwKBgQDJVuWvYP/HArwlL0CAtGLGX9vToUW0TccNLvKGQRBDXVv22TZP
WHSwJu+r20+TR+rpjjoRr7gMQQrvFHBV6yBf0qr4TC4PmCU5SoP1YqQu64diBdIt
19MOzhEx/uNNPb1EFOQeJFp8oYNsFd+X2fEN1DRg1tVcNDWTMCyNm4DNIQKBgELh
u6J6+EgJ7OCWV+j23aWhI/SlyWGydrJMa3ezWJcKunABZWAiMDukt80v+j3MtDbs
8Nfg1Eezr9j/yrWe5/wcx1A2GdRGO6JkA8hDfPnq85Vyg0cnsU7yPRnFl3ckx2uZ
oZlkYTuMO2gO/75C3+yQzpyXjeq49SjgwZJY7haZAoGAAwsN3GC3TNhZlqbco8dJ
GjuluMVbZtkyo5DDn7t487q4Z1iXcaszIQA1WnrwsFdfvx84srP4stCY2GXFR5jK
IGMAu97hjCXnriVd0x5c8GR8b0vkI2VjIzwwH+s1KSV68d3k0CLaF8qPyp2ypula
P2X9pk11iCEk6lCLY8pj3ww=
-----END PRIVATE KEY-----`;

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

    // Generar firma RSA-SHA256 válida con la clave de prueba
    let firmaB64: string;
    try {
      const pemHeader = '-----BEGIN PRIVATE KEY-----';
      const pemFooter = '-----END PRIVATE KEY-----';
      const pemContents = KEY_TEST_PEM
        .replace(pemHeader, '')
        .replace(pemFooter, '')
        .replace(/\s/g, '');
      const binaryDer = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));

      const subtle = typeof window !== 'undefined' && window.crypto?.subtle ? window.crypto.subtle : (globalThis as any).crypto?.subtle;
      if (subtle) {
        const privateKey = await subtle.importKey(
          'pkcs8',
          binaryDer,
          {
            name: 'RSASSA-PKCS1-v1_5',
            hash: 'SHA-256',
          },
          false,
          ['sign']
        );

        const hashBytes = new Uint8Array(
          (hashHex.match(/.{1,2}/g) || []).map((byte) => parseInt(byte, 16))
        );

        const signature = await subtle.sign(
          'RSASSA-PKCS1-v1_5',
          privateKey,
          hashBytes
        );

        firmaB64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
      } else {
        const dummySignatureBytes = new Uint8Array(256);
        for (let i = 0; i < dummySignatureBytes.length; i++) {
          dummySignatureBytes[i] = (hashHex.charCodeAt(i % hashHex.length) + i) % 256;
        }
        firmaB64 = btoa(String.fromCharCode(...dummySignatureBytes));
      }
    } catch {
      const dummySignatureBytes = new Uint8Array(256);
      for (let i = 0; i < dummySignatureBytes.length; i++) {
        dummySignatureBytes[i] = (hashHex.charCodeAt(i % hashHex.length) + i) % 256;
      }
      firmaB64 = btoa(String.fromCharCode(...dummySignatureBytes));
    }

    return {
      hashSha256: hashHex,
      firmaB64,
      certificadoPem: cert.pem,
      algoritmo: 'SHA256withRSA',
      proveedor: 'MOCK_TEST',
    };
  }
}
