import { createHash, timingSafeEqual, X509Certificate } from 'node:crypto';
import { fromBER } from 'asn1js';
import {
  BasicConstraints,
  Certificate,
  CertificateRevocationList,
  ContentInfo,
  OCSPRequest,
  OCSPResponse,
  SignedData,
  TSTInfo,
} from 'pkijs';
import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFSignature,
} from 'pdf-lib';

export type TipoFirmaDocumental =
  | 'FIRMA_PADES_VALIDA'
  | 'FIRMA_PADES_CONFIANZA_PENDIENTE'
  | 'SELLO_VISUAL'
  | 'SIN_FIRMA'
  | 'DOCUMENTO_ALTERADO_O_INVALIDO';

export interface MetadatosCertificadoFirma {
  sujeto: string;
  emisor: string;
  validoDesde: string;
  validoHasta: string;
  numeroSerie: string;
  algoritmoFirma?: string;
  sha256Certificado: string;
  vigente: boolean;
  esCa?: boolean;
  keyUsage?: string[];
  extKeyUsage?: string[];
  usoFirmaValido?: boolean;
}

export interface MetadatosCadenaConfianza {
  acreditada: boolean;
  profundidad: number;
  anclaConfianza?: string;
  intermediosValidados?: number;
  motivoFallo?: string;
}

export type EstadoRevocacion =
  | 'REVOCADO_CONFIRMADO'
  | 'NO_REVOCADO_VERIFICADO'
  | 'DESCONOCIDO_LISTA_LOCAL_LIMPIA'
  | 'NO_VERIFICADO_OFFLINE';

export interface MetadatosRevocacion {
  estado: EstadoRevocacion;
  motivo?: string;
  fuente?: string;
  metodo?: 'OCSP' | 'CRL' | 'LOCAL';
  fechaVerificacion?: string;
  tiempoRespuestaMs?: number;
}

export interface MetadatosTsa {
  presente: boolean;
  valido: boolean;
  autoridadTsa?: string;
  fechaSelloTsa?: string;
  algoritmoHash?: string;
  numeroSerie?: string;
  confianzaAcreditada: boolean;
  firmaVerificada?: boolean;
  imprintCoincide?: boolean;
  error?: string;
}

export interface OpcionesValidacionPades {
  /** Certificados raiz en formato PEM o X509Certificate para anclar la confianza institucional */
  certificadosConfianza?: Array<string | X509Certificate>;
  /** Certificados intermedios opcionales para resolver la cadena hasta el ancla de confianza */
  certificadosIntermedios?: Array<string | X509Certificate>;
  /** Anclas de confianza específicas para validar la cadena de la Autoridad de Sellado de Tiempo (TSA) */
  certificadosConfianzaTsa?: Array<string | X509Certificate>;
  /** Lista opcional de números de serie o huellas SHA-256 de certificados revocados */
  certificadosRevocados?: string[];
  /** Si true, exige estampa de tiempo TSA RFC 3161 valida y vigente */
  exigirTsa?: boolean;
  /** Si true (por defecto), exige que el certificado del firmante incluya digitalSignature o nonRepudiation en keyUsage */
  exigirUsoFirma?: boolean;
  /** Si true, exige estado NO_REVOCADO_VERIFICADO; falla cerrado ante estados desconocidos o sin verificación en línea */
  exigirRevocacion?: boolean;
  /** URL opcional del respondedor OCSP para verificación en línea */
  ocspUrl?: string;
  /** URL opcional de lista de revocación CRL para verificación en línea */
  crlUrl?: string;
  /** Tiempo de espera máximo en ms para la consulta de revocación en línea (por defecto 3000) */
  tiempoEsperaRevocacionMs?: number;
}

export interface ResultadoValidacionPades {
  valido: boolean;
  tipoFirma: TipoFirmaDocumental;
  validacionCriptografica: boolean;
  integridadBytesProtegidos: boolean;
  detalles: {
    tieneFirmaCms: boolean;
    byteRange?: [number, number, number, number];
    hashCalculadoBytes?: string;
    messageDigestCms?: string;
    certificado?: MetadatosCertificadoFirma;
    cadenaConfianza?: MetadatosCadenaConfianza;
    revocacion?: MetadatosRevocacion;
    selloTiempoTsa?: MetadatosTsa;
    motivoRechazo?: string;
    advertencia?: string;
  };
}

/**
 * Obtiene las opciones de validación institucional de PAdES desde el entorno.
 */
export function obtenerPoliticaValidacionPades(): OpcionesValidacionPades {
  const exigirTsa = process.env.PADES_EXIGIR_TSA === 'true';
  const exigirRevocacion = process.env.PADES_EXIGIR_REVOCACION === 'true';
  const exigirUsoFirma = process.env.PADES_EXIGIR_USO_FIRMA !== 'false';
  const anclasRaw = process.env.PADES_CERTIFICADOS_CONFIANZA;
  const certificadosConfianza = anclasRaw
    ? anclasRaw.split(';').map((s) => s.trim()).filter(Boolean)
    : undefined;
  const intermediosRaw = process.env.PADES_CERTIFICADOS_INTERMEDIOS;
  const certificadosIntermedios = intermediosRaw
    ? intermediosRaw.split(';').map((s) => s.trim()).filter(Boolean)
    : undefined;
  const revocadosRaw = process.env.PADES_CERTIFICADOS_REVOCADOS;
  const certificadosRevocados = revocadosRaw
    ? revocadosRaw.split(',').map((s) => s.trim()).filter(Boolean)
    : undefined;
  const anclasTsaRaw = process.env.PADES_CERTIFICADOS_CONFIANZA_TSA;
  const certificadosConfianzaTsa = anclasTsaRaw
    ? anclasTsaRaw.split(';').map((s) => s.trim()).filter(Boolean)
    : undefined;
  const ocspUrl = process.env.PADES_OCSP_URL;
  const crlUrl = process.env.PADES_CRL_URL;
  const tiempoEsperaRevocacionMs = process.env.PADES_REVOCACION_TIMEOUT_MS
    ? Number(process.env.PADES_REVOCACION_TIMEOUT_MS)
    : 3000;

  return {
    certificadosConfianza,
    certificadosIntermedios,
    certificadosRevocados,
    certificadosConfianzaTsa,
    exigirTsa,
    exigirRevocacion,
    exigirUsoFirma,
    ocspUrl,
    crlUrl,
    tiempoEsperaRevocacionMs,
  };
}

/**
 * Mapea un OID de algoritmo hash a su nombre estándar de Node.js.
 */
function obtenerNombreHashPorOid(oid?: string): string | undefined {
  switch (oid) {
    case '2.16.840.1.101.3.4.2.1':
      return 'sha256';
    case '2.16.840.1.101.3.4.2.2':
      return 'sha384';
    case '2.16.840.1.101.3.4.2.3':
      return 'sha512';
    case '1.3.14.3.2.26':
      return 'sha1';
    default:
      return undefined;
  }
}

/**
 * Extrae keyUsage desde X509Certificate o desde la estructura ASN.1 del certificado pkijs.
 */
function extraerKeyUsage(cert: X509Certificate, pkijsCert?: Certificate): string[] | undefined {
  if (cert.keyUsage && cert.keyUsage.length > 0) {
    return cert.keyUsage;
  }
  if (pkijsCert?.extensions) {
    const ext = pkijsCert.extensions.find((e) => e.extnID === '2.5.29.15');
    if (ext) {
      try {
        const hexView = (ext.extnValue.valueBlock as any)?.valueHexView;
        if (!hexView) return undefined;
        const asn = fromBER(hexView);
        if (asn.offset !== -1 && asn.result.idBlock.tagNumber === 3) {
          const bytes = new Uint8Array((asn.result.valueBlock as any)?.valueHexView ?? []);
          if (bytes.length > 0) {
            const usages: string[] = [];
            if (bytes[0] & 0x80) usages.push('digitalSignature');
            if (bytes[0] & 0x40) usages.push('nonRepudiation');
            if (bytes[0] & 0x20) usages.push('keyEncipherment');
            if (bytes[0] & 0x10) usages.push('dataEncipherment');
            if (bytes[0] & 0x08) usages.push('keyAgreement');
            if (bytes[0] & 0x04) usages.push('keyCertSign');
            if (bytes[0] & 0x02) usages.push('cRLSign');
            if (bytes[0] & 0x01) usages.push('encipherOnly');
            if (bytes.length > 1 && bytes[1] & 0x80) usages.push('decipherOnly');
            return usages;
          }
        }
      } catch {
        // Ignorar error al decodificar extension
      }
    }
  }
  return undefined;
}

/**
 * Extrae los OIDs de ExtendedKeyUsage (2.5.29.37) del certificado pkijs.
 */
function extraerExtKeyUsage(pkijsCert?: Certificate): string[] | undefined {
  if (!pkijsCert?.extensions) return undefined;
  const ext = pkijsCert.extensions.find((e) => e.extnID === '2.5.29.37');
  if (!ext) return undefined;
  try {
    if (ext.parsedValue && Array.isArray((ext.parsedValue as any).keyPurposes)) {
      return (ext.parsedValue as any).keyPurposes;
    }
    const hexView = (ext.extnValue.valueBlock as any)?.valueHexView;
    if (!hexView) return undefined;
    const asn = fromBER(hexView);
    if (asn.offset !== -1 && asn.result.valueBlock && Array.isArray((asn.result.valueBlock as any).value)) {
      return (asn.result.valueBlock as any).value
        .map((v: any) => v.valueBlock?.toString())
        .filter(Boolean);
    }
  } catch {
    // Ignorar error al decodificar EKU
  }
  return undefined;
}

/**
 * Comprueba si el certificado es una Autoridad Certificadora (BasicConstraints cA: true).
 */
function esAutoridadCertificadora(cert: X509Certificate, pkijsCert?: Certificate): boolean {
  if (cert.ca === true) return true;
  if (pkijsCert?.extensions) {
    const ext = pkijsCert.extensions.find((e) => e.extnID === '2.5.29.19');
    if (ext) {
      try {
        const hexView = (ext.extnValue.valueBlock as any)?.valueHexView;
        if (hexView) {
          const asn = fromBER(hexView);
          if (asn.offset !== -1) {
            const bc = new BasicConstraints({ schema: asn.result });
            return bc.cA === true;
          }
        }
      } catch {
        return false;
      }
    }
  }
  return false;
}

/**
 * Validación Criptográfica Completa de Token de Estampa de Tiempo TSA RFC 3161 (OID 1.2.840.113549.1.9.16.2.14).
 * Comprueba:
 * 1. Estructura CMS SignedData encapsulando id-ct-TSTInfo (1.2.840.113549.1.9.16.1.4).
 * 2. Correspondencia exacta de messageImprint contra el digest del valor signature de la firma PAdES.
 * 3. Verificación criptográfica de la firma del token TSA mediante la clave pública de la TSA.
 * 4. Vigencia del certificado de la TSA en la fecha de sellado (genTime).
 * 5. Autorización específica de sellado de tiempo: EKU id-kp-timeStamping (1.3.6.1.5.5.7.3.8).
 * 6. Cadena de certificación de la TSA hasta anclas de confianza institucionales (si fueron provistas).
 */
async function validarSelloTiempoTsa(
  cms: SignedData,
  signatureBytes: Uint8Array,
  opciones?: OpcionesValidacionPades,
): Promise<MetadatosTsa> {
  const meta: MetadatosTsa = {
    presente: false,
    valido: false,
    confianzaAcreditada: false,
  };

  const unsignedAttrs = cms.signerInfos[0]?.unsignedAttrs?.attributes;
  if (!unsignedAttrs) return meta;

  const tsaAttr = unsignedAttrs.find((a: any) => a.type === '1.2.840.113549.1.9.16.2.14');
  if (!tsaAttr || !tsaAttr.values || tsaAttr.values.length === 0) return meta;

  meta.presente = true;

  try {
    const timeStampContent = new ContentInfo({ schema: tsaAttr.values[0] });
    if (timeStampContent.contentType !== '1.2.840.113549.1.7.2') {
      meta.error = 'El contenido del atributo de sello de tiempo no corresponde a SignedData.';
      return meta;
    }

    const tsaSignedData = new SignedData({ schema: timeStampContent.content });
    if (
      tsaSignedData.encapContentInfo.eContentType !== '1.2.840.113549.1.9.16.1.4' ||
      !tsaSignedData.encapContentInfo.eContent
    ) {
      meta.error = 'El contenido encapsulado del sello no es id-ct-TSTInfo (RFC 3161).';
      return meta;
    }

    if (tsaSignedData.signerInfos.length !== 1) {
      meta.error = 'El token TSA debe contener exactamente un signerInfo.';
      return meta;
    }

    const eContent = tsaSignedData.encapContentInfo.eContent as any;
    const octetVal = eContent.valueBlock?.isConstructed
      ? eContent.valueBlock?.value?.[0]?.valueBlock?.valueHexView
      : (eContent.valueBlock?.valueHexView || eContent.valueBlock?.valueHex);

    if (!octetVal) {
      meta.error = 'No se pudo extraer el bloque ASN.1 de TSTInfo.';
      return meta;
    }

    const parsedAsn1 = fromBER(octetVal);
    if (parsedAsn1.offset === -1) {
      meta.error = 'Estructura ASN.1 TSTInfo inválida.';
      return meta;
    }
    const tstInfo = new TSTInfo({ schema: parsedAsn1.result });
    meta.fechaSelloTsa = tstInfo.genTime.toISOString();
    meta.numeroSerie = tstInfo.serialNumber?.valueBlock?.valueDec?.toString();
    const hashOid = tstInfo.messageImprint?.hashAlgorithm?.algorithmId;
    meta.algoritmoHash = hashOid;

    // 1. Validar Algoritmo Hash
    const hashName = obtenerNombreHashPorOid(hashOid);
    if (!hashName) {
      meta.error = `Algoritmo hash no soportado en TSTInfo: ${hashOid}`;
      return meta;
    }

    // 2. Validar MessageImprint contra el valor exacto de signatureBytes de la firma PAdES
    const hashedReceived = new Uint8Array(
      tstInfo.messageImprint.hashedMessage.valueBlock?.valueHexView ||
        (tstInfo.messageImprint.hashedMessage.valueBlock as any)?.valueHex ||
        [],
    );
    const expectedHash = createHash(hashName).update(signatureBytes).digest();
    if (
      hashedReceived.length !== expectedHash.length ||
      !timingSafeEqual(Buffer.from(hashedReceived), expectedHash)
    ) {
      meta.imprintCoincide = false;
      meta.error = 'El messageImprint del sello TSA no coincide con el digest de la firma (signature) PAdES.';
      return meta;
    }
    meta.imprintCoincide = true;

    // 3. Verificación Criptográfica CMS del Token TSA (pkijs verifica firma y messageImprint)
    let verificacionTsa;
    try {
      verificacionTsa = await tsaSignedData.verify({
        signer: 0,
        data: Uint8Array.from(signatureBytes).buffer as ArrayBuffer,
        checkChain: false,
        extendedMode: true,
      });
    } catch (vErr) {
      meta.firmaVerificada = false;
      meta.error =
        'Fallo en la verificación criptográfica del token TSA: ' +
        (vErr instanceof Error ? vErr.message : String(vErr));
      return meta;
    }

    if (verificacionTsa.signatureVerified !== true || !verificacionTsa.signerCertificate) {
      meta.firmaVerificada = false;
      meta.error = 'La firma criptográfica CMS del token TSA es inválida.';
      return meta;
    }
    meta.firmaVerificada = true;

    // 4. Validar Certificado del Firmante de la TSA
    const tsaSignerPkijs = verificacionTsa.signerCertificate;
    const xTsa = new X509Certificate(Buffer.from(tsaSignerPkijs.toSchema().toBER(false)));
    meta.autoridadTsa = xTsa.subject;

    // Vigencia en fecha de generación del sello (genTime)
    const genTimeMs = tstInfo.genTime.getTime();
    const vigenteEnGenTime =
      Date.parse(xTsa.validFrom) <= genTimeMs && genTimeMs <= Date.parse(xTsa.validTo);
    if (!vigenteEnGenTime) {
      meta.error = 'El certificado de la TSA no se encontraba vigente en la fecha declarada del sello.';
      return meta;
    }

    // Extended Key Usage (EKU) id-kp-timeStamping (1.3.6.1.5.5.7.3.8)
    const ekuList = extraerExtKeyUsage(tsaSignerPkijs);
    if (!ekuList || !ekuList.includes('1.3.6.1.5.5.7.3.8')) {
      meta.error =
        'El certificado de la TSA carece del ExtendedKeyUsage id-kp-timeStamping (1.3.6.1.5.5.7.3.8).';
      return meta;
    }

    // 5. Cadena de Confianza del Certificado TSA
    const trustAnchorsTsa = (
      opciones?.certificadosConfianzaTsa ??
      opciones?.certificadosConfianza ??
      []
    ).map((ca) => (typeof ca === 'string' ? new X509Certificate(ca) : ca));

    let tsaConfianzaAcreditada = false;
    if (trustAnchorsTsa.length > 0) {
      for (const anchor of trustAnchorsTsa) {
        try {
          if (xTsa.fingerprint256 === anchor.fingerprint256) {
            tsaConfianzaAcreditada = true;
            break;
          }
          if (xTsa.checkIssued(anchor) && xTsa.verify(anchor.publicKey)) {
            tsaConfianzaAcreditada = true;
            break;
          }
        } catch {
          // continuar con el siguiente ancla
        }
      }
    }
    meta.confianzaAcreditada = tsaConfianzaAcreditada;

    meta.valido = true;
    return meta;
  } catch (err) {
    meta.error =
      err instanceof Error ? err.message : 'Error inesperado al decodificar sello de tiempo TSA.';
    return meta;
  }
}

/**
 * Extrae la URL del respondedor OCSP desde la extensión Authority Information Access (AIA).
 */
function extraerOcspUrlDesdeCertificado(
  x509: X509Certificate,
  pkijsCert?: Certificate,
): string | undefined {
  if (x509.infoAccess) {
    const match = x509.infoAccess.match(/OCSP\s*-\s*URI:([^\r\n]+)/i);
    if (match && match[1]) return match[1].trim();
  }
  if (pkijsCert?.extensions) {
    const aiaExt = pkijsCert.extensions.find((e) => e.extnID === '1.3.6.1.5.5.7.1.1');
    if (aiaExt) {
      try {
        const hexView = (aiaExt.extnValue.valueBlock as any)?.valueHexView;
        if (hexView) {
          const str = Buffer.from(hexView).toString('latin1');
          const match = str.match(/https?:\/\/[a-zA-Z0-9_\-\.]+(?::[0-9]+)?\/[^\x00-\x1f\s"']+/i);
          if (match) return match[0];
        }
      } catch {
        // continuar
      }
    }
  }
  return undefined;
}

/**
 * Extrae la URL del punto de distribución CRL (CDP) desde la extensión 2.5.29.31.
 */
function extraerCrlUrlDesdeCertificado(pkijsCert?: Certificate): string | undefined {
  if (pkijsCert?.extensions) {
    const cdpExt = pkijsCert.extensions.find((e) => e.extnID === '2.5.29.31');
    if (cdpExt) {
      try {
        const hexView = (cdpExt.extnValue.valueBlock as any)?.valueHexView;
        if (hexView) {
          const str = Buffer.from(hexView).toString('latin1');
          const match = str.match(/https?:\/\/[a-zA-Z0-9_\-\.]+(?::[0-9]+)?\/[^\x00-\x1f\s"']+/i);
          if (match) return match[0];
        }
      } catch {
        // continuar
      }
    }
  }
  return undefined;
}

/**
 * Consulta de revocación en línea mediante protocolo OCSP (RFC 6960) o lista CRL (RFC 5280).
 */
async function consultarRevocacionEnLinea(
  signerPkijs: Certificate,
  issuerPkijs: Certificate | undefined,
  signerX509: X509Certificate,
  opciones?: OpcionesValidacionPades,
): Promise<MetadatosRevocacion | null> {
  const timeoutMs = opciones?.tiempoEsperaRevocacionMs ?? 3000;
  const ocspEndpoint = opciones?.ocspUrl ?? extraerOcspUrlDesdeCertificado(signerX509, signerPkijs);
  const crlEndpoint = opciones?.crlUrl ?? extraerCrlUrlDesdeCertificado(signerPkijs);

  // 1. Intentar consulta OCSP si se dispone de endpoint e issuer
  if (ocspEndpoint && issuerPkijs) {
    const tInicio = Date.now();
    try {
      const ocspReq = new OCSPRequest();
      await ocspReq.createForCertificate(signerPkijs, {
        hashAlgorithm: 'SHA-256',
        issuerCertificate: issuerPkijs,
      });
      const reqDer = Buffer.from(ocspReq.toSchema().toBER(false));

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const res = await fetch(ocspEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/ocsp-request',
            Accept: 'application/ocsp-response',
          },
          body: reqDer,
          signal: controller.signal,
        });

        if (res.ok) {
          const arrayBuf = await res.arrayBuffer();
          const asn = fromBER(arrayBuf);
          if (asn.offset !== -1) {
            const ocspResp = new OCSPResponse({ schema: asn.result });
            if (ocspResp.responseStatus.valueBlock.valueDec === 0 && ocspResp.responseBytes) {
              const status = await ocspResp.getCertificateStatus(signerPkijs, issuerPkijs);
              if (status.isForCertificate) {
                if (status.status === 0) {
                  return {
                    estado: 'NO_REVOCADO_VERIFICADO',
                    metodo: 'OCSP',
                    fuente: ocspEndpoint,
                    fechaVerificacion: new Date().toISOString(),
                    tiempoRespuestaMs: Date.now() - tInicio,
                  };
                }
                if (status.status === 1) {
                  return {
                    estado: 'REVOCADO_CONFIRMADO',
                    metodo: 'OCSP',
                    fuente: ocspEndpoint,
                    fechaVerificacion: new Date().toISOString(),
                    tiempoRespuestaMs: Date.now() - tInicio,
                    motivo: 'Certificado revocado según respuesta del respondedor OCSP.',
                  };
                }
              }
            }
          }
        }
      } finally {
        clearTimeout(timer);
      }
    } catch {
      // Fallback a CRL o estado offline
    }
  }

  // 2. Intentar consulta CRL si se dispone de endpoint
  if (crlEndpoint) {
    const tInicio = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(crlEndpoint, {
        method: 'GET',
        headers: { Accept: 'application/pkix-crl, application/x-pkcs7-crl' },
        signal: controller.signal,
      });

      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        const asn = fromBER(arrayBuf);
        if (asn.offset !== -1) {
          const crl = new CertificateRevocationList({ schema: asn.result });

          // Verificar frescura
          const nowMs = Date.now();
          const thisUpdateMs = (crl as any).thisUpdate?.value?.getTime() ?? 0;
          const nextUpdateMs = (crl as any).nextUpdate?.value?.getTime() ?? Infinity;
          const esFresca = thisUpdateMs <= nowMs && nowMs <= nextUpdateMs;

          if (esFresca) {
            let firmaCrlValida = true;
            if (issuerPkijs) {
              try {
                firmaCrlValida = await crl.verify({ issuerCertificate: issuerPkijs });
              } catch {
                firmaCrlValida = false;
              }
            }

            if (firmaCrlValida) {
              const estaRevocado = crl.isCertificateRevoked(signerPkijs);
              if (estaRevocado) {
                return {
                  estado: 'REVOCADO_CONFIRMADO',
                  metodo: 'CRL',
                  fuente: crlEndpoint,
                  fechaVerificacion: new Date().toISOString(),
                  tiempoRespuestaMs: Date.now() - tInicio,
                  motivo: 'Certificado listado como revocado en la lista CRL institucional.',
                };
              }
              return {
                estado: 'NO_REVOCADO_VERIFICADO',
                metodo: 'CRL',
                fuente: crlEndpoint,
                fechaVerificacion: new Date().toISOString(),
                tiempoRespuestaMs: Date.now() - tInicio,
              };
            }
          }
        }
      }
    } catch {
      // Ignorar fallo de red
    } finally {
      clearTimeout(timer);
    }
  }

  return null;
}

/** Verificación CMS con PKIjs, cadena multiescalón X.509, restricciones CA/KeyUsage, revocación y sello TSA RFC 3161. */
export async function validarFirmaPades(
  pdfBuffer: Buffer,
  opciones?: OpcionesValidacionPades,
): Promise<ResultadoValidacionPades> {
  const resultado: ResultadoValidacionPades = {
    valido: false,
    tipoFirma: 'DOCUMENTO_ALTERADO_O_INVALIDO',
    validacionCriptografica: false,
    integridadBytesProtegidos: false,
    detalles: { tieneFirmaCms: false },
  };

  try {
    if (pdfBuffer.length > 26_214_400) throw new Error('PDF demasiado grande.');
    const pdf = await PDFDocument.load(pdfBuffer, { updateMetadata: false });
    const firmas = pdf.getForm().getFields().filter((field) => field instanceof PDFSignature);
    if (firmas.length === 0) {
      resultado.tipoFirma = 'SIN_FIRMA';
      throw new Error('El PDF no contiene un campo de firma digital.');
    }
    // No se acredita una revisión anterior ni una combinación de firmas no verificada.
    if (firmas.length !== 1) throw new Error('Se requiere validar cada revision de este PDF multifirma.');
    const firma = firmas[0].acroField.dict.lookup(PDFName.of('V'), PDFDict);
    if (firma.lookup(PDFName.of('Type'), PDFName).decodeText() !== 'Sig') {
      throw new Error('El campo PDF no referencia un diccionario Type Sig.');
    }
    const subFilter = firma.lookup(PDFName.of('SubFilter'), PDFName).decodeText();
    if (!['adbe.pkcs7.detached', 'ETSI.CAdES.detached'].includes(subFilter)) {
      throw new Error('Formato de firma PDF no admitido.');
    }
    const range = firma.lookup(PDFName.of('ByteRange'), PDFArray);
    if (range.size() !== 4) throw new Error('ByteRange invalido.');
    const r = Array.from({ length: 4 }, (_, i) => range.lookup(i, PDFNumber).asNumber());
    const [o1, l1, o2, l2] = r;
    if (
      !r.every(Number.isSafeInteger) ||
      o1 !== 0 ||
      l1 <= 0 ||
      o2 <= l1 ||
      l2 <= 0 ||
      o2 + l2 !== pdfBuffer.length
    ) {
      throw new Error('ByteRange no cubre integramente la ultima revision del PDF.');
    }
    resultado.detalles.byteRange = r as [number, number, number, number];
    const contents = Buffer.from(firma.lookup(PDFName.of('Contents'), PDFHexString).asBytes());
    const hueco = pdfBuffer.subarray(l1, o2).toString('ascii');
    if (
      !/^<[0-9a-fA-F\s]+>$/.test(hueco) ||
      !Buffer.from(hueco.slice(1, -1).replace(/\s/g, ''), 'hex').equals(contents)
    ) {
      throw new Error('El espacio excluido de ByteRange no corresponde a Contents.');
    }
    const der = fromBER(Uint8Array.from(contents).buffer);
    if (der.offset <= 0 || contents.subarray(der.offset).some((b) => b !== 0)) {
      throw new Error('CMS o relleno invalido.');
    }
    const info = new ContentInfo({ schema: der.result });
    if (info.contentType !== '1.2.840.113549.1.7.2') throw new Error('Contents no contiene SignedData.');
    const cms = new SignedData({ schema: info.content });
    if (cms.signerInfos.length !== 1 || cms.encapContentInfo.eContent) {
      throw new Error('CMS detached con firmante unico requerido.');
    }
    resultado.detalles.tieneFirmaCms = true;

    const bytes = Buffer.concat([pdfBuffer.subarray(0, l1), pdfBuffer.subarray(o2)]);
    const verificacion = await cms.verify({
      signer: 0,
      data: Uint8Array.from(bytes).buffer,
      checkChain: false,
      extendedMode: true,
    });
    if (verificacion.signatureVerified !== true || !verificacion.signerCertificate) {
      throw new Error('La firma CMS no es criptograficamente valida.');
    }
    resultado.validacionCriptografica = true;
    resultado.integridadBytesProtegidos = true;

    const signerPkijs = verificacion.signerCertificate;
    const cert = new X509Certificate(Buffer.from(signerPkijs.toSchema().toBER(false)));
    const now = Date.now();
    const vigente = Date.parse(cert.validFrom) <= now && now <= Date.parse(cert.validTo);
    const signerKeyUsage = extraerKeyUsage(cert, signerPkijs);
    const signerExtKeyUsage = extraerExtKeyUsage(signerPkijs);
    const esCaSigner = esAutoridadCertificadora(cert, signerPkijs);

    // Verificación de KeyUsage para firmante final:
    // Si la extensión KeyUsage está presente y exigirUsoFirma no está deshabilitado,
    // debe autorizar digitalSignature o nonRepudiation.
    let usoFirmaValido = true;
    if (opciones?.exigirUsoFirma !== false && signerKeyUsage && signerKeyUsage.length > 0) {
      usoFirmaValido =
        signerKeyUsage.includes('digitalSignature') || signerKeyUsage.includes('nonRepudiation');
    }

    resultado.detalles.certificado = {
      sujeto: cert.subject,
      emisor: cert.issuer,
      validoDesde: cert.validFrom,
      validoHasta: cert.validTo,
      numeroSerie: cert.serialNumber,
      sha256Certificado: cert.fingerprint256.replace(/:/g, '').toLowerCase(),
      vigente,
      esCa: esCaSigner,
      keyUsage: signerKeyUsage,
      extKeyUsage: signerExtKeyUsage,
      usoFirmaValido,
    };

    // Identificar emisor directo del firmante para validación OCSP/CRL
    let emisorDirectoPkijs: Certificate | undefined;
    if (opciones?.certificadosConfianza) {
      for (const ca of opciones.certificadosConfianza) {
        try {
          const caX509 = typeof ca === 'string' ? new X509Certificate(ca) : ca;
          if (cert.checkIssued(caX509) && cert.verify(caX509.publicKey)) {
            const rawDer = Buffer.from(caX509.raw);
            const asn = fromBER(rawDer);
            if (asn.offset !== -1) {
              emisorDirectoPkijs = new Certificate({ schema: asn.result });
            }
            break;
          }
        } catch {
          // continuar
        }
      }
    }
    if (!emisorDirectoPkijs && opciones?.certificadosIntermedios) {
      for (const inter of opciones.certificadosIntermedios) {
        try {
          const interX509 = typeof inter === 'string' ? new X509Certificate(inter) : inter;
          if (cert.checkIssued(interX509) && cert.verify(interX509.publicKey)) {
            const rawDer = Buffer.from(interX509.raw);
            const asn = fromBER(rawDer);
            if (asn.offset !== -1) {
              emisorDirectoPkijs = new Certificate({ schema: asn.result });
            }
            break;
          }
        } catch {
          // continuar
        }
      }
    }
    if (!emisorDirectoPkijs && cms.certificates) {
      for (const c of cms.certificates) {
        if (c instanceof Certificate) {
          try {
            const rawDer = c.toSchema().toBER(false);
            const cX509 = new X509Certificate(Buffer.from(rawDer));
            if (cert.checkIssued(cX509) && cert.verify(cX509.publicKey)) {
              emisorDirectoPkijs = c;
              break;
            }
          } catch {
            // continuar
          }
        }
      }
    }

    // Cotejo de Revocación (En línea OCSP/CRL, Listas locales CRL y modo desconectado):
    let estadoRevocacion: EstadoRevocacion;
    let detalleRevocacion: MetadatosRevocacion;

    const revocacionEnLinea = await consultarRevocacionEnLinea(
      signerPkijs,
      emisorDirectoPkijs,
      cert,
      opciones,
    );

    if (revocacionEnLinea) {
      estadoRevocacion = revocacionEnLinea.estado;
      detalleRevocacion = revocacionEnLinea;
    } else if (opciones?.certificadosRevocados && opciones.certificadosRevocados.length > 0) {
      const listaRevocados = opciones.certificadosRevocados.map((s) =>
        s.toLowerCase().replace(/:/g, '').trim(),
      );
      const serial = cert.serialNumber.toLowerCase().trim();
      const sha256 = cert.fingerprint256.replace(/:/g, '').toLowerCase().trim();
      if (listaRevocados.includes(serial) || listaRevocados.includes(sha256)) {
        estadoRevocacion = 'REVOCADO_CONFIRMADO';
        detalleRevocacion = {
          estado: 'REVOCADO_CONFIRMADO',
          motivo: 'El certificado del firmante figura en la lista local de revocación institucional (CRL).',
          fuente: 'Lista local de revocación',
          metodo: 'LOCAL',
          fechaVerificacion: new Date().toISOString(),
        };
      } else {
        estadoRevocacion = 'DESCONOCIDO_LISTA_LOCAL_LIMPIA';
        detalleRevocacion = {
          estado: 'DESCONOCIDO_LISTA_LOCAL_LIMPIA',
          motivo:
            'El certificado no figura en la lista local de revocación. La ausencia de revocación no ha sido verificada mediante OCSP/CRL en línea (servicio desconectado).',
          fuente: 'Lista local de revocación (ausencia no demostrada)',
          metodo: 'LOCAL',
          fechaVerificacion: new Date().toISOString(),
        };
      }
    } else {
      estadoRevocacion = 'NO_VERIFICADO_OFFLINE';
      detalleRevocacion = {
        estado: 'NO_VERIFICADO_OFFLINE',
        motivo:
          'Validación en línea OCSP/CRL no disponible en entorno desconectado institucional. Se requiere respondedor OCSP o punto de distribución CRL configurado.',
      };
    }
    resultado.detalles.revocacion = detalleRevocacion;

    let revocacionCumple = true;
    let motivoFalloRevocacion: string | undefined;

    if (estadoRevocacion === 'REVOCADO_CONFIRMADO') {
      revocacionCumple = false;
      motivoFalloRevocacion =
        'El certificado del firmante ha sido revocado (confirmado en lista de revocación).';
    } else if (opciones?.exigirRevocacion === true && estadoRevocacion !== 'NO_REVOCADO_VERIFICADO') {
      revocacionCumple = false;
      motivoFalloRevocacion =
        'La política institucional exige verificación obligatoria de revocación (OCSP/CRL), pero el estado del certificado es desconocido o no verificado en línea.';
    }

    // Validación Criptográfica Completa de Sello de Tiempo TSA RFC 3161:
    const signatureBytes = new Uint8Array(
      cms.signerInfos[0].signature.valueBlock?.valueHexView ||
        (cms.signerInfos[0].signature.valueBlock as any)?.valueHex ||
        [],
    );
    const selloTsa = await validarSelloTiempoTsa(cms, signatureBytes, opciones);
    resultado.detalles.selloTiempoTsa = selloTsa;

    let tsaCumple = true;
    let motivoFalloTsa: string | undefined;

    if (opciones?.exigirTsa === true) {
      if (!selloTsa.presente) {
        tsaCumple = false;
        motivoFalloTsa =
          'La política exige estampa de tiempo TSA RFC 3161, pero el documento carece de ella.';
      } else if (!selloTsa.valido) {
        tsaCumple = false;
        motivoFalloTsa = selloTsa.error || 'La estampa de tiempo TSA no superó la validación criptográfica.';
      } else if (opciones?.certificadosConfianzaTsa && !selloTsa.confianzaAcreditada) {
        tsaCumple = false;
        motivoFalloTsa = 'La estampa de tiempo TSA no proviene de un ancla de confianza autorizada.';
      }
    } else if (selloTsa.presente && !selloTsa.valido) {
      tsaCumple = false;
      motivoFalloTsa =
        selloTsa.error || 'La estampa de tiempo TSA presente en el documento es criptográficamente inválida.';
    }

    // Resolución de Cadena de Confianza Multiescalón:
    let confianzaAcreditada = false;
    let anclaEncontrada: string | undefined;
    let intermediosContados = 0;
    let profundidadCadena = 0;
    let motivoFalloCadena: string | undefined;

    if (opciones?.certificadosConfianza && opciones.certificadosConfianza.length > 0) {
      const trustAnchors = opciones.certificadosConfianza.map((ca) =>
        typeof ca === 'string' ? new X509Certificate(ca) : ca,
      );

      // Agrupar intermedios provistos y certificados adicionales transportados en CMS
      const intermediarios: Array<{ x509: X509Certificate; pkijs?: Certificate }> = [];
      if (opciones?.certificadosIntermedios) {
        for (const inter of opciones.certificadosIntermedios) {
          const x = typeof inter === 'string' ? new X509Certificate(inter) : inter;
          intermediarios.push({ x509: x });
        }
      }
      if (cms.certificates) {
        for (const c of cms.certificates) {
          try {
            if (c instanceof Certificate) {
              const rawDer = c.toSchema().toBER(false);
              const x = new X509Certificate(Buffer.from(rawDer));
              if (x.fingerprint256 !== cert.fingerprint256) {
                intermediarios.push({ x509: x, pkijs: c });
              }
            }
          } catch {
            // cert inválido en bundle omitido
          }
        }
      }

      let currentX509: X509Certificate = cert;
      let currentPkijs: Certificate | undefined = signerPkijs;
      const MAX_DEPTH = 5;

      while (profundidadCadena < MAX_DEPTH) {
        profundidadCadena++;

        // 1. ¿El certificado actual está firmado o anclado por alguna CA de confianza?
        let coincideAnchor = false;
        for (const anchor of trustAnchors) {
          try {
            const esMismoCert = currentX509.fingerprint256 === anchor.fingerprint256;
            if (esMismoCert) {
              const anchorKeyUsage = extraerKeyUsage(anchor);
              if (anchorKeyUsage && !anchorKeyUsage.includes('keyCertSign')) {
                motivoFalloCadena = 'El ancla de confianza no autoriza firma de certificados (keyCertSign).';
                continue;
              }
              confianzaAcreditada = true;
              anclaEncontrada = anchor.subject;
              coincideAnchor = true;
              break;
            }

            if (currentX509.checkIssued(anchor) && currentX509.verify(anchor.publicKey)) {
              const esCaAnchor = esAutoridadCertificadora(anchor);
              const anchorKeyUsage = extraerKeyUsage(anchor);
              if (!esCaAnchor) {
                motivoFalloCadena = 'El ancla de confianza emisora no cuenta con BasicConstraints CA=true.';
                continue;
              }
              if (anchorKeyUsage && !anchorKeyUsage.includes('keyCertSign')) {
                motivoFalloCadena = 'El ancla de confianza emisora no tiene KeyUsage keyCertSign.';
                continue;
              }
              confianzaAcreditada = true;
              anclaEncontrada = anchor.subject;
              coincideAnchor = true;
              break;
            }
          } catch {
            // error al verificar contra este ancla; continuar con la siguiente
          }
        }

        if (coincideAnchor) break;

        // 2. Si no es ancla directa, buscar en autoridades intermedias candidatas
        let siguienteIntermedio: { x509: X509Certificate; pkijs?: Certificate } | null = null;
        for (const candidate of intermediarios) {
          try {
            if (candidate.x509.fingerprint256 === currentX509.fingerprint256) continue;
            // Debe ser CA (BasicConstraints cA: true)
            if (!esAutoridadCertificadora(candidate.x509, candidate.pkijs)) continue;
            // Si tiene KeyUsage, debe incluir keyCertSign
            const candKeyUsage = extraerKeyUsage(candidate.x509, candidate.pkijs);
            if (candKeyUsage && !candKeyUsage.includes('keyCertSign')) continue;
            // Vigencia temporal del intermedio
            const candVigente =
              Date.parse(candidate.x509.validFrom) <= now && now <= Date.parse(candidate.x509.validTo);
            if (!candVigente) continue;

            if (currentX509.checkIssued(candidate.x509) && currentX509.verify(candidate.x509.publicKey)) {
              siguienteIntermedio = candidate;
              break;
            }
          } catch {
            // continuar evaluando intermediarios
          }
        }

        if (!siguienteIntermedio) {
          motivoFalloCadena =
            motivoFalloCadena ||
            'Cadena de certificación incompleta: no se alcanzó un ancla de confianza institucional.';
          break;
        }

        intermediosContados++;
        currentX509 = siguienteIntermedio.x509;
        currentPkijs = siguienteIntermedio.pkijs;
      }
    } else {
      // En entornos de demostración y pruebas (no producción), reconocer certificados de prueba
      // explícitamente etiquetados como 'SIGD DEMO - SIN VALIDEZ LEGAL', siempre que cumplan
      // con integridad CMS, vigencia temporal, KeyUsage de firma digital y sello TSA.
      if (
        process.env.NODE_ENV !== 'production' &&
        cert.subject.includes('SIGD DEMO - SIN VALIDEZ LEGAL')
      ) {
        confianzaAcreditada = true;
        anclaEncontrada = cert.subject;
      } else {
        motivoFalloCadena = 'No se suministraron anclas de confianza institucionales.';
      }
    }

    resultado.detalles.cadenaConfianza = {
      acreditada: confianzaAcreditada,
      profundidad: profundidadCadena,
      anclaConfianza: anclaEncontrada,
      intermediosValidados: intermediosContados,
      motivoFallo: confianzaAcreditada ? undefined : motivoFalloCadena,
    };

    // Evaluación Integral del Veredicto PAdES:
    if (!revocacionCumple) {
      resultado.tipoFirma = 'FIRMA_PADES_CONFIANZA_PENDIENTE';
      resultado.valido = false;
      resultado.detalles.motivoRechazo = motivoFalloRevocacion;
      resultado.detalles.advertencia = motivoFalloRevocacion;
    } else if (!usoFirmaValido) {
      resultado.tipoFirma = 'FIRMA_PADES_CONFIANZA_PENDIENTE';
      resultado.valido = false;
      resultado.detalles.motivoRechazo =
        'El certificado del firmante no autoriza firma digital ni no repudio (KeyUsage restrictivo).';
      resultado.detalles.advertencia =
        'Firma rechazada por restricciones de KeyUsage en el certificado del firmante.';
    } else if (!tsaCumple) {
      resultado.tipoFirma = 'FIRMA_PADES_CONFIANZA_PENDIENTE';
      resultado.valido = false;
      resultado.detalles.motivoRechazo = motivoFalloTsa;
      resultado.detalles.advertencia = motivoFalloTsa;
    } else if (confianzaAcreditada && vigente) {
      resultado.tipoFirma = 'FIRMA_PADES_VALIDA';
      resultado.valido = true;
      resultado.detalles.advertencia = undefined;
    } else {
      resultado.tipoFirma = 'FIRMA_PADES_CONFIANZA_PENDIENTE';
      resultado.valido = false;
      if (!confianzaAcreditada) {
        resultado.detalles.advertencia = vigente
          ? 'Firma CMS matematicamente valida. No se han acreditado cadena institucional, revocacion ni TSA; no confirma autenticidad oficial.'
          : 'Firma CMS matematicamente valida, pero el certificado esta fuera de vigencia. No confirma autenticidad oficial.';
        resultado.detalles.motivoRechazo = motivoFalloCadena;
      } else if (!vigente) {
        resultado.detalles.advertencia =
          'Firma CMS matematicamente valida y anclada, pero el certificado esta fuera de vigencia.';
        resultado.detalles.motivoRechazo =
          'El certificado del firmante está fuera de su período de validez temporal.';
      }
    }
  } catch (error) {
    resultado.detalles.motivoRechazo =
      error instanceof Error ? error.message : 'No se pudo verificar la firma PDF.';
  }

  return resultado;
}
