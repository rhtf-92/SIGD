import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createHash, webcrypto } from 'node:crypto';
import zlib from 'node:zlib';
import { BitString, fromBER, Integer, OctetString, Sequence, Utf8String } from 'asn1js';
import {
  Attribute,
  AttributeTypeAndValue,
  BasicConstraints,
  Certificate,
  ContentInfo,
  EncapsulatedContentInfo,
  Extension,
  IssuerAndSerialNumber,
  SignedData,
  SignerInfo,
} from 'pkijs';
import { PDFDocument, PDFName, PDFString, PDFHexString, rgb, StandardFonts } from 'pdf-lib';
import { validarFirmaPades } from '../../../../src/domains/docucore/verificadorPades.service.js';

/**
 * Genera un par de claves RSA 2048 y certificado X.509 efímero para pruebas criptográficas.
 */
async function generarCertificadoDemo({
  commonName = 'SIGD DEMO - SIN VALIDEZ LEGAL',
  keyUsageByte = 0x80, // digitalSignature
  validoDesde = new Date(Date.now() - 60_000),
  validoHasta = new Date(Date.now() + 3_600_000),
  serial = 1001,
}: {
  commonName?: string;
  keyUsageByte?: number;
  validoDesde?: Date;
  validoHasta?: Date;
  serial?: number;
} = {}) {
  const keys: any = await webcrypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  );

  const cert = new Certificate();
  cert.version = 2; // X.509 v3
  cert.serialNumber = new Integer({ value: serial });
  cert.subject.typesAndValues.push(
    new AttributeTypeAndValue({ type: '2.5.4.3', value: new Utf8String({ value: commonName }) }),
  );
  cert.issuer = cert.subject;
  cert.notBefore.value = validoDesde;
  cert.notAfter.value = validoHasta;

  const extensions: Extension[] = [
    new Extension({
      extnID: '2.5.29.19', // BasicConstraints
      critical: true,
      extnValue: new BasicConstraints({ cA: false }).toSchema().toBER(false),
    }),
  ];

  if (keyUsageByte !== undefined) {
    const bs = new BitString({ valueHex: new Uint8Array([keyUsageByte]).buffer, unusedBits: 0 });
    extensions.push(
      new Extension({
        extnID: '2.5.29.15', // KeyUsage
        critical: true,
        extnValue: bs.toBER(false),
      }),
    );
  }

  cert.extensions = extensions;
  await cert.subjectPublicKeyInfo.importKey(keys.publicKey);
  await cert.sign(keys.privateKey, 'SHA-256');

  const base64 = Buffer.from(cert.toSchema().toBER(false)).toString('base64');
  const pem = '-----BEGIN CERTIFICATE-----\n' + base64.match(/.{1,64}/g)!.join('\n') + '\n-----END CERTIFICATE-----';

  return { keys, cert, pem };
}

/**
 * Genera un PDF demostrativo firmado con PAdES / CMS real.
 */
async function generarPdfFirmadoDemo(certData: { keys: any; cert: Certificate; pem: string }): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  page.drawText('[DOCUMENTO DE DEMOSTRACION - SIN VALIDEZ ADMINISTRATIVA]', {
    x: 50,
    y: 790,
    size: 11,
    font: fontBold,
    color: rgb(0.8, 0.1, 0.1),
  });

  page.drawText('RESOLUCION DIRECTORAL N. RD-2026-000012', {
    x: 50,
    y: 750,
    size: 14,
    font: fontBold,
    color: rgb(0.1, 0.2, 0.4),
  });

  page.drawText('Expediente: EXP-2026-000018 - Procedimiento TUPA SUZ26-035', {
    x: 50,
    y: 720,
    size: 10,
    font,
    color: rgb(0.2, 0.2, 0.2),
  });

  // Estructura de firma PAdES
  const signature = pdfDoc.context.obj({
    Type: 'Sig',
    Filter: 'Adobe.PPKLite',
    SubFilter: 'adbe.pkcs7.detached',
    ByteRange: [0, 999999999, 999999999, 999999999],
    Contents: PDFHexString.of('0'.repeat(16384)),
  });

  const field = pdfDoc.context.obj({
    FT: 'Sig',
    T: PDFString.of('FirmaDirectoralDemo'),
    V: pdfDoc.context.register(signature),
  });

  pdfDoc.catalog.set(
    PDFName.of('AcroForm'),
    pdfDoc.context.register(pdfDoc.context.obj({ Fields: [pdfDoc.context.register(field)], SigFlags: 3 })),
  );

  let output = Buffer.from(await pdfDoc.save({ useObjectStreams: false }));
  const source = output.toString('latin1');
  const start = source.indexOf('<' + '0'.repeat(100));
  const end = start + 16386;
  const originalRange = '[ 0 999999999 999999999 999999999 ]';
  const range = `[ 0 ${String(start).padEnd(9)} ${String(end).padEnd(9)} ${String(output.length - end).padEnd(9)} ]`;
  output = Buffer.from(source.replace(originalRange, range), 'latin1');

  const cms = new SignedData({
    version: 1,
    encapContentInfo: new EncapsulatedContentInfo({ eContentType: '1.2.840.113549.1.7.1' }),
    certificates: [certData.cert],
    signerInfos: [
      new SignerInfo({
        version: 1,
        sid: new IssuerAndSerialNumber({
          issuer: certData.cert.issuer,
          serialNumber: certData.cert.serialNumber,
        }),
      }),
    ],
  });

  const bytes = Buffer.concat([output.subarray(0, start), output.subarray(end)]);
  await cms.sign(certData.keys.privateKey, 0, 'SHA-256', Uint8Array.from(bytes).buffer);

  const content = new ContentInfo({
    contentType: '1.2.840.113549.1.7.2',
    content: cms.toSchema(true),
  });

  const hex = Buffer.from(content.toSchema().toBER(false)).toString('hex');
  output.write(hex.padEnd(16384, '0'), start + 1, 'ascii');
  return output;
}

describe('Harness Criptográfico de Demostración — Firma PAdES y Validación Técnica', () => {
  let certValidoDemo: { keys: any; cert: Certificate; pem: string };

  beforeEach(async () => {
    vi.stubEnv('NODE_ENV', 'development');
    certValidoDemo = await generarCertificadoDemo({
      commonName: 'SIGD DEMO - SIN VALIDEZ LEGAL',
      keyUsageByte: 0x80, // digitalSignature
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('1. Genera y valida matemáticamente una firma PAdES real con certificado demo autorizado', async () => {
    const pdfFirmado = await generarPdfFirmadoDemo(certValidoDemo);

    expect(pdfFirmado.subarray(0, 5).toString('ascii')).toBe('%PDF-');

    const resultado = await validarFirmaPades(pdfFirmado, { exigirRevocacion: false, exigirTsa: false });

    expect(resultado.valido).toBe(true);
    expect(resultado.validacionCriptografica).toBe(true);
    expect(resultado.integridadBytesProtegidos).toBe(true);
    expect(resultado.tipoFirma).toBe('FIRMA_PADES_VALIDA');
    expect(resultado.detalles.tieneFirmaCms).toBe(true);
    expect(resultado.detalles.certificado?.sujeto).toContain('SIGD DEMO - SIN VALIDEZ LEGAL');
    expect(resultado.detalles.certificado?.usoFirmaValido).toBe(true);
    expect(resultado.detalles.cadenaConfianza?.acreditada).toBe(true);
    expect(resultado.detalles.cadenaConfianza?.anclaConfianza).toContain('SIGD DEMO - SIN VALIDEZ LEGAL');
  });

  it('2. Distingue una firma técnica de una firma institucional de producción (rechaza certificado sin etiqueta en producción)', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const pdfFirmado = await generarPdfFirmadoDemo(certValidoDemo);

    const resultado = await validarFirmaPades(pdfFirmado, { exigirRevocacion: false, exigirTsa: false });

    // En producción, un certificado sin ancla oficial institucional no es válido
    expect(resultado.valido).toBe(false);
    expect(resultado.validacionCriptografica).toBe(true); // La matemática es correcta
    expect(resultado.tipoFirma).toBe('FIRMA_PADES_CONFIANZA_PENDIENTE');
    expect(resultado.detalles.cadenaConfianza?.acreditada).toBe(false);
    expect(resultado.detalles.cadenaConfianza?.motivoFallo).toContain('No se suministraron anclas de confianza institucionales');
  });

  it('3. Distingue entre certificado de pruebas etiquetado y certificado autofirmado genérico', async () => {
    const certGenerico = await generarCertificadoDemo({
      commonName: 'CERTIFICADO AUTOFIRMADO DESCONOCIDO',
      keyUsageByte: 0x80,
    });
    const pdfFirmado = await generarPdfFirmadoDemo(certGenerico);

    const resultado = await validarFirmaPades(pdfFirmado, { exigirRevocacion: false, exigirTsa: false });

    // Aunque la matemática sea correcta, no está en la lista de confianza ni es el certificado demo autorizado
    expect(resultado.valido).toBe(false);
    expect(resultado.validacionCriptografica).toBe(true);
    expect(resultado.tipoFirma).toBe('FIRMA_PADES_CONFIANZA_PENDIENTE');
    expect(resultado.detalles.cadenaConfianza?.acreditada).toBe(false);
  });

  it('4. Detecta y rechaza inmediatamente cualquier alteración o manipulación en bytes firmados (tampering)', async () => {
    const pdfFirmado = await generarPdfFirmadoDemo(certValidoDemo);

    // Corromper bytes protegidos fuera del campo Contents
    pdfFirmado[pdfFirmado.indexOf(Buffer.from('%PDF-')) + 7] ^= 1;

    const resultado = await validarFirmaPades(pdfFirmado, { exigirRevocacion: false, exigirTsa: false });

    expect(resultado.valido).toBe(false);
    expect(resultado.validacionCriptografica).toBe(false);
    expect(resultado.integridadBytesProtegidos).toBe(false);
    expect(resultado.detalles.motivoRechazo).toBeDefined();
    expect(resultado.detalles.motivoRechazo).toMatch(/digest|criptograficamente valida/i);
  });

  it('5. Detecta y rechaza una firma CMS corrompida matemáticamente', async () => {
    const bytes = await generarPdfFirmadoDemo(certValidoDemo);

    // Localizar `/Contents <...>` y corromper la firma ASN.1 CMS
    const match = /\/Contents <([0-9a-f]+)>/i.exec(bytes.toString('latin1'))!;
    expect(match).not.toBeNull();
    const der = fromBER(Uint8Array.from(Buffer.from(match[1], 'hex')).buffer);
    const offset = match.index + match[0].indexOf('<') + 1 + (der.offset - 1) * 2;
    bytes.write(bytes.toString('ascii', offset, offset + 2) === 'ff' ? '00' : 'ff', offset, 'ascii');

    const resultado = await validarFirmaPades(bytes, { exigirRevocacion: false, exigirTsa: false });

    expect(resultado.valido).toBe(false);
    expect(resultado.validacionCriptografica).toBe(false);
  });

  it('6. Rechaza un certificado que carezca de autorización de firma digital (KeyUsage)', async () => {
    const certSinKeyUsageFirma = await generarCertificadoDemo({
      commonName: 'SIGD DEMO - SIN VALIDEZ LEGAL',
      keyUsageByte: 0x20, // Solo keyEncipherment, sin digitalSignature ni nonRepudiation
    });
    const pdfFirmado = await generarPdfFirmadoDemo(certSinKeyUsageFirma);

    const resultado = await validarFirmaPades(pdfFirmado, { exigirRevocacion: false, exigirTsa: false });

    expect(resultado.valido).toBe(false);
    expect(resultado.detalles.certificado?.usoFirmaValido).toBe(false);
    expect(resultado.tipoFirma).toBe('FIRMA_PADES_CONFIANZA_PENDIENTE');
  });

  it('7. Rechaza un certificado vencido temporalmente', async () => {
    const certVencido = await generarCertificadoDemo({
      commonName: 'SIGD DEMO - SIN VALIDEZ LEGAL',
      validoDesde: new Date(Date.now() - 100_000),
      validoHasta: new Date(Date.now() - 10_000), // Ya expirado
    });
    const pdfFirmado = await generarPdfFirmadoDemo(certVencido);

    const resultado = await validarFirmaPades(pdfFirmado, { exigirRevocacion: false, exigirTsa: false });

    expect(resultado.valido).toBe(false);
    expect(resultado.detalles.certificado?.vigente).toBe(false);
  });
});
