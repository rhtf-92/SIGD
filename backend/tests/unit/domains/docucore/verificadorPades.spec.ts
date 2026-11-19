import { describe, it, expect, vi } from 'vitest';
import { createHash, webcrypto } from 'node:crypto';
import { BitString, fromBER, Integer, OctetString, Sequence, Utf8String } from 'asn1js';
import {
  AlgorithmIdentifier,
  Attribute,
  AttributeTypeAndValue,
  BasicConstraints,
  Certificate,
  CertificateRevocationList,
  ContentInfo,
  EncapsulatedContentInfo,
  Extension,
  IssuerAndSerialNumber,
  MessageImprint,
  RevokedCertificate,
  SignedAndUnsignedAttributes,
  SignedData,
  SignerInfo,
  Time,
  TSTInfo,
} from 'pkijs';
import { PDFDocument, PDFName, PDFString, PDFHexString } from 'pdf-lib';
import { validarFirmaPades } from '../../../../src/domains/docucore/verificadorPades.service.js';

// Certificado efimero SOLO en memoria para probar criptografia; no es evidencia institucional.
async function generarCertificadoPrueba(commonName = 'PRUEBA UNITARIA NO INSTITUCIONAL') {
  const keys: any = await webcrypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  );
  const cert = new Certificate();
  cert.version = 2;
  cert.serialNumber = new Integer({ value: 1 });
  cert.issuer.typesAndValues.push(new AttributeTypeAndValue({ type: '2.5.4.3', value: new Utf8String({ value: commonName }) }));
  cert.subject = cert.issuer;
  cert.notBefore.value = new Date(Date.now() - 60_000);
  cert.notAfter.value = new Date(Date.now() + 60_000);
  await cert.subjectPublicKeyInfo.importKey(keys.publicKey);
  await cert.sign(keys.privateKey, 'SHA-256');
  const base64 = Buffer.from(cert.toSchema().toBER(false)).toString('base64');
  const pem = '-----BEGIN CERTIFICATE-----\n' + base64.match(/.{1,64}/g)!.join('\n') + '\n-----END CERTIFICATE-----';
  return { keys, cert, pem };
}

async function generarCertificadoPersonalizado({
  commonName = 'CERTIFICADO PERSONALIZADO',
  esCa = false,
  keyUsageByte,
  emisorCert,
  claveFirmaEmisor,
  serial = 1,
  validoDesde = new Date(Date.now() - 60_000),
  validoHasta = new Date(Date.now() + 60_000),
}: {
  commonName?: string;
  esCa?: boolean;
  keyUsageByte?: number; // e.g. 0x80 (digitalSignature), 0x04 (keyCertSign), 0x08 (keyAgreement)
  emisorCert?: Certificate;
  claveFirmaEmisor?: any;
  serial?: number;
  validoDesde?: Date;
  validoHasta?: Date;
} = {}) {
  const keys: any = await webcrypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  );
  const cert = new Certificate();
  cert.version = 2;
  cert.serialNumber = new Integer({ value: serial });
  cert.subject.typesAndValues.push(
    new AttributeTypeAndValue({ type: '2.5.4.3', value: new Utf8String({ value: commonName }) }),
  );
  cert.issuer = emisorCert ? emisorCert.subject : cert.subject;
  cert.notBefore.value = validoDesde;
  cert.notAfter.value = validoHasta;

  const extensions: Extension[] = [];
  if (esCa) {
    const bc = new BasicConstraints({ cA: true });
    extensions.push(
      new Extension({ extnID: '2.5.29.19', critical: true, extnValue: bc.toSchema().toBER(false) }),
    );
  }
  if (keyUsageByte !== undefined) {
    const bs = new BitString({ valueHex: new Uint8Array([keyUsageByte]).buffer, unusedBits: 0 });
    extensions.push(
      new Extension({ extnID: '2.5.29.15', critical: true, extnValue: bs.toBER(false) }),
    );
  }
  if (extensions.length > 0) {
    cert.extensions = extensions;
  }

  await cert.subjectPublicKeyInfo.importKey(keys.publicKey);
  const signingKey = claveFirmaEmisor ?? keys.privateKey;
  await cert.sign(signingKey, 'SHA-256');

  const base64 = Buffer.from(cert.toSchema().toBER(false)).toString('base64');
  const pem = '-----BEGIN CERTIFICATE-----\n' + base64.match(/.{1,64}/g)!.join('\n') + '\n-----END CERTIFICATE-----';
  return { keys, cert, pem };
}

async function generarTsaTokenParaFirma(
  signatureBytes: Uint8Array,
  opciones?: {
    fecha?: Date;
    tsaCertData?: { keys: any; cert: Certificate; pem: string };
    alterarImprint?: boolean;
    alterarFirmaCms?: boolean;
    omitirEku?: boolean;
    serial?: number;
    validoDesde?: Date;
    validoHasta?: Date;
  },
) {
  const tsaDate = opciones?.fecha ?? new Date();
  let tsaData = opciones?.tsaCertData;
  if (!tsaData) {
    const keys: any = await webcrypto.subtle.generateKey(
      { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true,
      ['sign', 'verify'],
    );
    const cert = new Certificate();
    cert.version = 2;
    cert.serialNumber = new Integer({ value: opciones?.serial ?? 999 });
    cert.subject.typesAndValues.push(
      new AttributeTypeAndValue({ type: '2.5.4.3', value: new Utf8String({ value: 'TSA AUTORIDAD PRUEBA' }) }),
    );
    cert.issuer = cert.subject;
    cert.notBefore.value = opciones?.validoDesde ?? new Date(Date.now() - 60_000);
    cert.notAfter.value = opciones?.validoHasta ?? new Date(Date.now() + 60_000);

    if (opciones?.omitirEku !== true) {
      const ekuSeq = new Sequence({
        value: [new OctetString({ valueHex: new Uint8Array([0x06, 0x08, 0x2b, 0x06, 0x01, 0x05, 0x05, 0x07, 0x03, 0x08]).buffer })],
      });
      // Sequence of OID 1.3.6.1.5.5.7.3.8 (id-kp-timeStamping)
      const ekuAsn = new Sequence({
        value: [new (asn1jsObjectIdentifier())({ value: '1.3.6.1.5.5.7.3.8' })],
      });
      cert.extensions = [
        new Extension({ extnID: '2.5.29.37', critical: true, extnValue: ekuAsn.toBER(false) }),
      ];
    }
    await cert.subjectPublicKeyInfo.importKey(keys.publicKey);
    await cert.sign(keys.privateKey, 'SHA-256');
    const base64 = Buffer.from(cert.toSchema().toBER(false)).toString('base64');
    const pem = '-----BEGIN CERTIFICATE-----\n' + base64.match(/.{1,64}/g)!.join('\n') + '\n-----END CERTIFICATE-----';
    tsaData = { keys, cert, pem };
  }

  let bytesToHash = signatureBytes;
  if (opciones?.alterarImprint) {
    bytesToHash = new Uint8Array([...signatureBytes, 0xff]);
  }
  const sigHash = createHash('sha256').update(bytesToHash).digest();

  const tstInfo = new TSTInfo({
    version: 1,
    policy: '1.3.6.1.4.1.99999.1',
    messageImprint: new MessageImprint({
      hashAlgorithm: new AlgorithmIdentifier({ algorithmId: '2.16.840.1.101.3.4.2.1' }),
      hashedMessage: new OctetString({ valueHex: Uint8Array.from(sigHash).buffer }),
    }),
    serialNumber: new Integer({ value: opciones?.serial ?? 999 }),
    genTime: tsaDate,
  });

  const tstDer = tstInfo.toSchema().toBER(false);
  const timeStampSignedData = new SignedData({
    version: 3,
    encapContentInfo: new EncapsulatedContentInfo({
      eContentType: '1.2.840.113549.1.9.16.1.4',
      eContent: new OctetString({ valueHex: tstDer }),
    }),
    certificates: [tsaData.cert],
    signerInfos: [
      new SignerInfo({
        version: 1,
        sid: new IssuerAndSerialNumber({ issuer: tsaData.cert.issuer, serialNumber: tsaData.cert.serialNumber }),
      }),
    ],
  });

  await timeStampSignedData.sign(tsaData.keys.privateKey, 0, 'SHA-256');

  if (opciones?.alterarFirmaCms) {
    // Corromper la firma criptográfica en el SignerInfo del token TSA
    const rawSig = timeStampSignedData.signerInfos[0].signature.valueBlock.valueHexView;
    const tampered = new Uint8Array(rawSig.slice(0));
    tampered[0] ^= 0xff;
    timeStampSignedData.signerInfos[0].signature.valueBlock.valueHexView = tampered;
    (timeStampSignedData.signerInfos[0].signature.valueBlock as any).valueHex = tampered.buffer;
  }

  const timeStampContent = new ContentInfo({
    contentType: '1.2.840.113549.1.7.2',
    content: timeStampSignedData.toSchema(true),
  });

  const attr = new Attribute({
    type: '1.2.840.113549.1.9.16.2.14',
    values: [timeStampContent.toSchema()],
  });

  return { attr, tsaData };
}

function asn1jsObjectIdentifier() {
  const asn1 = require('asn1js');
  return asn1.ObjectIdentifier;
}

async function pdfCmsDePrueba(
  tipoDiccionario = 'Sig',
  certData?: { keys: any; cert: Certificate; pem: string },
  opciones?: {
    certificadosExtra?: Certificate[];
    unsignedAttrs?: Attribute[];
    generarTsa?:
      | boolean
      | {
          fecha?: Date;
          tsaCertData?: { keys: any; cert: Certificate; pem: string };
          alterarImprint?: boolean;
          alterarFirmaCms?: boolean;
          omitirEku?: boolean;
          serial?: number;
          validoDesde?: Date;
          validoHasta?: Date;
        };
  },
): Promise<Buffer> {
  const { keys, cert } = certData ?? (await generarCertificadoPrueba());
  const pdf = await PDFDocument.create();
  pdf.addPage();
  const signature = pdf.context.obj({
    Type: tipoDiccionario,
    Filter: 'Adobe.PPKLite',
    SubFilter: 'adbe.pkcs7.detached',
    ByteRange: [0, 999999999, 999999999, 999999999],
    Contents: PDFHexString.of('0'.repeat(16384)),
  });
  const field = pdf.context.obj({ FT: 'Sig', T: PDFString.of('Prueba'), V: pdf.context.register(signature) });
  pdf.catalog.set(
    PDFName.of('AcroForm'),
    pdf.context.register(pdf.context.obj({ Fields: [pdf.context.register(field)], SigFlags: 3 })),
  );
  let output = Buffer.from(await pdf.save({ useObjectStreams: false }));
  const source = output.toString('latin1');
  const start = source.indexOf('<' + '0'.repeat(100));
  const end = start + 16386;
  const originalRange = '[ 0 999999999 999999999 999999999 ]';
  const range = `[ 0 ${String(start).padEnd(9)} ${String(end).padEnd(9)} ${String(output.length - end).padEnd(9)} ]`;
  output = Buffer.from(source.replace(originalRange, range), 'latin1');

  const certificates = [cert, ...(opciones?.certificadosExtra ?? [])];
  const cms = new SignedData({
    version: 1,
    encapContentInfo: new EncapsulatedContentInfo({ eContentType: '1.2.840.113549.1.7.1' }),
    certificates,
    signerInfos: [
      new SignerInfo({
        version: 1,
        sid: new IssuerAndSerialNumber({ issuer: cert.issuer, serialNumber: cert.serialNumber }),
      }),
    ],
  });

  const bytes = Buffer.concat([output.subarray(0, start), output.subarray(end)]);
  await cms.sign(keys.privateKey, 0, 'SHA-256', Uint8Array.from(bytes).buffer);

  // Si se solicita TSA auténtica, se computa sobre los bytes exactos de cms.signature
  const attrs: Attribute[] = [...(opciones?.unsignedAttrs ?? [])];
  if (opciones?.generarTsa) {
    const rawSig =
      cms.signerInfos[0].signature.valueBlock.valueHexView ||
      (cms.signerInfos[0].signature.valueBlock as any).valueHex;
    const configTsa = typeof opciones.generarTsa === 'object' ? opciones.generarTsa : {};
    const { attr } = await generarTsaTokenParaFirma(new Uint8Array(rawSig), configTsa);
    attrs.push(attr);
  }

  if (attrs.length > 0) {
    cms.signerInfos[0].unsignedAttrs = new SignedAndUnsignedAttributes({
      type: 1,
      attributes: attrs,
    });
  }

  const content = new ContentInfo({ contentType: '1.2.840.113549.1.7.2', content: cms.toSchema(true) });
  const hex = Buffer.from(content.toSchema().toBER(false)).toString('hex');
  output.write(hex.padEnd(16384, '0'), start + 1, 'ascii');
  return output;
}

describe('Verificacion PDF/CMS real, sin persistencia ni certificados institucionales', () => {
  it('rechaza un CMS correcto asociado a un diccionario que no es Type Sig', async () => {
    const result = await validarFirmaPades(await pdfCmsDePrueba('DocTimeStamp'));
    expect(result.validacionCriptografica).toBe(false);
    expect(result.detalles.motivoRechazo).toContain('Type Sig');
  });

  it('rechaza un PDF normal, aunque sea un documento estructuralmente valido', async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage();
    expect(await validarFirmaPades(Buffer.from(await pdf.save()))).toMatchObject({
      valido: false,
      tipoFirma: 'SIN_FIRMA',
      validacionCriptografica: false,
    });
  });

  it('verifica matematicamente CMS real sin confundir un certificado autofirmado con confianza institucional', async () => {
    const result = await validarFirmaPades(await pdfCmsDePrueba());
    expect(result, JSON.stringify(result)).toMatchObject({
      valido: false,
      validacionCriptografica: true,
      integridadBytesProtegidos: true,
      tipoFirma: 'FIRMA_PADES_CONFIANZA_PENDIENTE',
    });
    expect(result.detalles.selloTiempoTsa?.presente).toBe(false);
  });

  it('rechaza cambios en bytes firmados aunque el CMS y el certificado sigan presentes', async () => {
    const bytes = await pdfCmsDePrueba();
    bytes[bytes.indexOf(Buffer.from('%PDF-')) + 7] ^= 1;
    expect(await validarFirmaPades(bytes)).toMatchObject({ valido: false, validacionCriptografica: false });
  });

  it('rechaza una firma CMS alterada aunque los bytes del PDF, su digest y el certificado se conserven', async () => {
    const bytes = await pdfCmsDePrueba();
    const match = /\/Contents <([0-9a-f]+)>/i.exec(bytes.toString('latin1'))!;
    const der = fromBER(Uint8Array.from(Buffer.from(match[1], 'hex')).buffer);
    const offset = match.index + match[0].indexOf('<') + 1 + (der.offset - 1) * 2;
    bytes.write(bytes.toString('ascii', offset, offset + 2) === 'ff' ? '00' : 'ff', offset, 'ascii');
    expect(await validarFirmaPades(bytes)).toMatchObject({ valido: false, validacionCriptografica: false });
  });

  it('rechaza revisiones o bytes posteriores no cubiertos por ByteRange', async () => {
    const bytes = Buffer.concat([await pdfCmsDePrueba(), Buffer.from('\n% cambio posterior\n')]);
    expect(await validarFirmaPades(bytes)).toMatchObject({ valido: false, validacionCriptografica: false });
  });

  it('acredita FIRMA_PADES_VALIDA cuando el certificado coincide con anclas de confianza provistas', async () => {
    const certData = await generarCertificadoPrueba('AUTORIDAD CERTIFICADORA DEMO');
    const bytes = await pdfCmsDePrueba('Sig', certData);
    const result = await validarFirmaPades(bytes, { certificadosConfianza: [certData.pem] });
    expect(result.validacionCriptografica).toBe(true);
    expect(result.integridadBytesProtegidos).toBe(true);
    expect(result.valido).toBe(true);
    expect(result.tipoFirma).toBe('FIRMA_PADES_VALIDA');
    expect(result.detalles.advertencia).toBeUndefined();
  });

  it('conserva FIRMA_PADES_CONFIANZA_PENDIENTE (valido: false) ante anclas de confianza no coincidentes', async () => {
    const certData = await generarCertificadoPrueba('AUTORIDAD DESCONOCIDA');
    const otraCa = await generarCertificadoPrueba('AUTORIDAD AJENA');
    const bytes = await pdfCmsDePrueba('Sig', certData);
    const result = await validarFirmaPades(bytes, { certificadosConfianza: [otraCa.pem] });
    expect(result.validacionCriptografica).toBe(true);
    expect(result.valido).toBe(false);
    expect(result.tipoFirma).toBe('FIRMA_PADES_CONFIANZA_PENDIENTE');
    expect(result.detalles.advertencia).toContain('No se han acreditado cadena institucional');
  });

  it('acredita cadena multiescalón (Root CA -> Intermediate CA -> Signer) provista mediante certificadosIntermedios', async () => {
    const rootCa = await generarCertificadoPersonalizado({
      commonName: 'ROOT CA INSTITUCIONAL',
      esCa: true,
      keyUsageByte: 0x04, // keyCertSign
      serial: 100,
    });
    const interCa = await generarCertificadoPersonalizado({
      commonName: 'INTERMEDIATE CA INSTITUCIONAL',
      esCa: true,
      keyUsageByte: 0x04, // keyCertSign
      emisorCert: rootCa.cert,
      claveFirmaEmisor: rootCa.keys.privateKey,
      serial: 101,
    });
    const signer = await generarCertificadoPersonalizado({
      commonName: 'FIRMANTE TITULAR',
      esCa: false,
      keyUsageByte: 0x80, // digitalSignature
      emisorCert: interCa.cert,
      claveFirmaEmisor: interCa.keys.privateKey,
      serial: 102,
    });

    const bytes = await pdfCmsDePrueba('Sig', signer);
    const result = await validarFirmaPades(bytes, {
      certificadosConfianza: [rootCa.pem],
      certificadosIntermedios: [interCa.pem],
    });

    expect(result.validacionCriptografica).toBe(true);
    expect(result.valido).toBe(true);
    expect(result.tipoFirma).toBe('FIRMA_PADES_VALIDA');
    expect(result.detalles.cadenaConfianza).toMatchObject({
      acreditada: true,
      anclaConfianza: expect.stringContaining('ROOT CA INSTITUCIONAL'),
      intermediosValidados: 1,
    });
  });

  it('acredita cadena multiescalón cuando el certificado intermedio viaja embebido dentro del CMS SignedData', async () => {
    const rootCa = await generarCertificadoPersonalizado({
      commonName: 'ROOT CA EMBEBIDA',
      esCa: true,
      keyUsageByte: 0x04,
      serial: 200,
    });
    const interCa = await generarCertificadoPersonalizado({
      commonName: 'INTERMEDIATE CA EMBEBIDA',
      esCa: true,
      keyUsageByte: 0x04,
      emisorCert: rootCa.cert,
      claveFirmaEmisor: rootCa.keys.privateKey,
      serial: 201,
    });
    const signer = await generarCertificadoPersonalizado({
      commonName: 'FIRMANTE CON EMBEBIDO',
      esCa: false,
      keyUsageByte: 0x80,
      emisorCert: interCa.cert,
      claveFirmaEmisor: interCa.keys.privateKey,
      serial: 202,
    });

    const bytes = await pdfCmsDePrueba('Sig', signer, {
      certificadosExtra: [interCa.cert],
    });

    const result = await validarFirmaPades(bytes, {
      certificadosConfianza: [rootCa.pem],
    });

    expect(result.validacionCriptografica).toBe(true);
    expect(result.valido).toBe(true);
    expect(result.tipoFirma).toBe('FIRMA_PADES_VALIDA');
    expect(result.detalles.cadenaConfianza?.intermediosValidados).toBe(1);
  });

  it('rechaza autoridad intermedia que no posee BasicConstraints CA=true', async () => {
    const rootCa = await generarCertificadoPersonalizado({
      commonName: 'ROOT CA RECHAZO',
      esCa: true,
      keyUsageByte: 0x04,
      serial: 300,
    });
    const fakeInterCa = await generarCertificadoPersonalizado({
      commonName: 'INTERMEDIATE NO-CA',
      esCa: false,
      keyUsageByte: 0x04,
      emisorCert: rootCa.cert,
      claveFirmaEmisor: rootCa.keys.privateKey,
      serial: 301,
    });
    const signer = await generarCertificadoPersonalizado({
      commonName: 'FIRMANTE RECHAZADO',
      esCa: false,
      keyUsageByte: 0x80,
      emisorCert: fakeInterCa.cert,
      claveFirmaEmisor: fakeInterCa.keys.privateKey,
      serial: 302,
    });

    const bytes = await pdfCmsDePrueba('Sig', signer);
    const result = await validarFirmaPades(bytes, {
      certificadosConfianza: [rootCa.pem],
      certificadosIntermedios: [fakeInterCa.pem],
    });

    expect(result.validacionCriptografica).toBe(true);
    expect(result.valido).toBe(false);
    expect(result.tipoFirma).toBe('FIRMA_PADES_CONFIANZA_PENDIENTE');
    expect(result.detalles.cadenaConfianza?.acreditada).toBe(false);
  });

  it('rechaza autoridad intermedia con KeyUsage que carece de keyCertSign', async () => {
    const rootCa = await generarCertificadoPersonalizado({
      commonName: 'ROOT CA KEYUSAGE',
      esCa: true,
      keyUsageByte: 0x04,
      serial: 400,
    });
    const interSinKeyCertSign = await generarCertificadoPersonalizado({
      commonName: 'INTERMEDIATE SIN KEYCERTSIGN',
      esCa: true,
      keyUsageByte: 0x80, // Solo digitalSignature
      emisorCert: rootCa.cert,
      claveFirmaEmisor: rootCa.keys.privateKey,
      serial: 401,
    });
    const signer = await generarCertificadoPersonalizado({
      commonName: 'FIRMANTE HOJA',
      esCa: false,
      keyUsageByte: 0x80,
      emisorCert: interSinKeyCertSign.cert,
      claveFirmaEmisor: interSinKeyCertSign.keys.privateKey,
      serial: 402,
    });

    const bytes = await pdfCmsDePrueba('Sig', signer);
    const result = await validarFirmaPades(bytes, {
      certificadosConfianza: [rootCa.pem],
      certificadosIntermedios: [interSinKeyCertSign.pem],
    });

    expect(result.valido).toBe(false);
    expect(result.tipoFirma).toBe('FIRMA_PADES_CONFIANZA_PENDIENTE');
    expect(result.detalles.cadenaConfianza?.acreditada).toBe(false);
  });

  it('rechaza certificado de firmante final con KeyUsage restrictivo incompatible', async () => {
    const rootCa = await generarCertificadoPersonalizado({
      commonName: 'ROOT CA COMPATIBLE',
      esCa: true,
      keyUsageByte: 0x04,
      serial: 500,
    });
    const signerKeyAgreementOnly = await generarCertificadoPersonalizado({
      commonName: 'FIRMANTE SOLO KEYAGREEMENT',
      esCa: false,
      keyUsageByte: 0x08, // Solo keyAgreement
      emisorCert: rootCa.cert,
      claveFirmaEmisor: rootCa.keys.privateKey,
      serial: 501,
    });

    const bytes = await pdfCmsDePrueba('Sig', signerKeyAgreementOnly);
    const result = await validarFirmaPades(bytes, {
      certificadosConfianza: [rootCa.pem],
    });

    expect(result.validacionCriptografica).toBe(true);
    expect(result.valido).toBe(false);
    expect(result.tipoFirma).toBe('FIRMA_PADES_CONFIANZA_PENDIENTE');
    expect(result.detalles.certificado?.usoFirmaValido).toBe(false);
    expect(result.detalles.motivoRechazo).toContain('KeyUsage restrictivo');
  });

  it('rechaza firma CMS con certificado expirado fuera de vigencia temporal', async () => {
    const expiredCert = await generarCertificadoPersonalizado({
      commonName: 'FIRMANTE EXPIRADO',
      esCa: false,
      keyUsageByte: 0x80,
      validoDesde: new Date(Date.now() - 120_000),
      validoHasta: new Date(Date.now() - 10_000),
      serial: 600,
    });

    const bytes = await pdfCmsDePrueba('Sig', expiredCert);
    const result = await validarFirmaPades(bytes, {
      certificadosConfianza: [expiredCert.pem],
    });

    expect(result.validacionCriptografica).toBe(true);
    expect(result.valido).toBe(false);
    expect(result.tipoFirma).toBe('FIRMA_PADES_CONFIANZA_PENDIENTE');
    expect(result.detalles.certificado?.vigente).toBe(false);
    expect(result.detalles.advertencia).toContain('fuera de vigencia');
  });

  it('rechaza firma CMS con certificado revocado incluido en lista CRL (REVOCADO_CONFIRMADO)', async () => {
    const rootCa = await generarCertificadoPersonalizado({
      commonName: 'ROOT CA REVOCACION',
      esCa: true,
      keyUsageByte: 0x04,
      serial: 700,
    });
    const signer = await generarCertificadoPersonalizado({
      commonName: 'FIRMANTE REVOCADO',
      esCa: false,
      keyUsageByte: 0x80,
      emisorCert: rootCa.cert,
      claveFirmaEmisor: rootCa.keys.privateKey,
      serial: 701,
    });

    const bytes = await pdfCmsDePrueba('Sig', signer);
    const result = await validarFirmaPades(bytes, {
      certificadosConfianza: [rootCa.pem],
      certificadosRevocados: ['02bd', '701'],
    });

    expect(result.validacionCriptografica).toBe(true);
    expect(result.valido).toBe(false);
    expect(result.tipoFirma).toBe('FIRMA_PADES_CONFIANZA_PENDIENTE');
    expect(result.detalles.revocacion?.estado).toBe('REVOCADO_CONFIRMADO');
    expect(result.detalles.motivoRechazo).toContain('revocado');
  });

  it('audita estado DESCONOCIDO_LISTA_LOCAL_LIMPIA cuando no figura en lista local, documentando falta de verificación en línea', async () => {
    const rootCa = await generarCertificadoPersonalizado({
      commonName: 'ROOT CA LISTA LIMPIA',
      esCa: true,
      keyUsageByte: 0x04,
      serial: 750,
    });
    const signer = await generarCertificadoPersonalizado({
      commonName: 'FIRMANTE NO EN LISTA',
      esCa: false,
      keyUsageByte: 0x80,
      emisorCert: rootCa.cert,
      claveFirmaEmisor: rootCa.keys.privateKey,
      serial: 751,
    });

    const bytes = await pdfCmsDePrueba('Sig', signer);
    const result = await validarFirmaPades(bytes, {
      certificadosConfianza: [rootCa.pem],
      certificadosRevocados: ['99999'], // Signer 751 no está aquí
    });

    expect(result.valido).toBe(true); // Sin exigirRevocacion pasa
    expect(result.detalles.revocacion?.estado).toBe('DESCONOCIDO_LISTA_LOCAL_LIMPIA');
    expect(result.detalles.revocacion?.motivo).toContain('ausencia de revocación no ha sido verificada mediante OCSP/CRL');
  });

  it('política fail-closed: exigirRevocacion: true rechaza documento si no cuenta con estado NO_REVOCADO_VERIFICADO', async () => {
    const rootCa = await generarCertificadoPersonalizado({
      commonName: 'ROOT CA FAIL CLOSED',
      esCa: true,
      keyUsageByte: 0x04,
      serial: 760,
    });
    const signer = await generarCertificadoPersonalizado({
      commonName: 'FIRMANTE REVOCACION EXIGIDA',
      esCa: false,
      keyUsageByte: 0x80,
      emisorCert: rootCa.cert,
      claveFirmaEmisor: rootCa.keys.privateKey,
      serial: 761,
    });

    const bytes = await pdfCmsDePrueba('Sig', signer);
    const result = await validarFirmaPades(bytes, {
      certificadosConfianza: [rootCa.pem],
      certificadosRevocados: ['99999'],
      exigirRevocacion: true,
    });

    expect(result.validacionCriptografica).toBe(true);
    expect(result.valido).toBe(false);
    expect(result.tipoFirma).toBe('FIRMA_PADES_CONFIANZA_PENDIENTE');
    expect(result.detalles.motivoRechazo).toContain('exige verificación obligatoria de revocación (OCSP/CRL)');
  });

  it('exigencia TSA (exigirTsa: true): rechaza documento si no incluye estampa de tiempo RFC 3161', async () => {
    const rootCa = await generarCertificadoPersonalizado({
      commonName: 'ROOT CA TSA REQUERIDA',
      esCa: true,
      keyUsageByte: 0x04,
      serial: 800,
    });
    const signer = await generarCertificadoPersonalizado({
      commonName: 'FIRMANTE SIN TSA',
      esCa: false,
      keyUsageByte: 0x80,
      emisorCert: rootCa.cert,
      claveFirmaEmisor: rootCa.keys.privateKey,
      serial: 801,
    });

    const bytes = await pdfCmsDePrueba('Sig', signer);
    const result = await validarFirmaPades(bytes, {
      certificadosConfianza: [rootCa.pem],
      exigirTsa: true,
    });

    expect(result.validacionCriptografica).toBe(true);
    expect(result.valido).toBe(false);
    expect(result.tipoFirma).toBe('FIRMA_PADES_CONFIANZA_PENDIENTE');
    expect(result.detalles.motivoRechazo).toContain('exige estampa de tiempo TSA');
  });

  it('exigencia TSA (exigirTsa: true): aprueba documento con token TSA RFC 3161 criptográficamente válido, EKU correcto y digest coincidente', async () => {
    const rootCa = await generarCertificadoPersonalizado({
      commonName: 'ROOT CA CON TSA OK',
      esCa: true,
      keyUsageByte: 0x04,
      serial: 900,
    });
    const signer = await generarCertificadoPersonalizado({
      commonName: 'FIRMANTE CON TSA',
      esCa: false,
      keyUsageByte: 0x80,
      emisorCert: rootCa.cert,
      claveFirmaEmisor: rootCa.keys.privateKey,
      serial: 901,
    });

    const bytes = await pdfCmsDePrueba('Sig', signer, {
      generarTsa: true,
    });

    const result = await validarFirmaPades(bytes, {
      certificadosConfianza: [rootCa.pem],
      exigirTsa: true,
    });

    expect(result.validacionCriptografica).toBe(true);
    expect(result.valido).toBe(true);
    expect(result.tipoFirma).toBe('FIRMA_PADES_VALIDA');
    expect(result.detalles.selloTiempoTsa).toMatchObject({
      presente: true,
      valido: true,
      firmaVerificada: true,
      imprintCoincide: true,
      numeroSerie: '999',
    });
  });

  it('rechaza estampa TSA si el messageImprint no coincide con el digest de la firma PAdES', async () => {
    const rootCa = await generarCertificadoPersonalizado({
      commonName: 'ROOT CA IMPRINT',
      esCa: true,
      keyUsageByte: 0x04,
      serial: 920,
    });
    const signer = await generarCertificadoPersonalizado({
      commonName: 'FIRMANTE BAD IMPRINT',
      esCa: false,
      keyUsageByte: 0x80,
      emisorCert: rootCa.cert,
      claveFirmaEmisor: rootCa.keys.privateKey,
      serial: 921,
    });

    const bytes = await pdfCmsDePrueba('Sig', signer, {
      generarTsa: { alterarImprint: true },
    });

    const result = await validarFirmaPades(bytes, {
      certificadosConfianza: [rootCa.pem],
      exigirTsa: true,
    });

    expect(result.valido).toBe(false);
    expect(result.tipoFirma).toBe('FIRMA_PADES_CONFIANZA_PENDIENTE');
    expect(result.detalles.selloTiempoTsa?.imprintCoincide).toBe(false);
    expect(result.detalles.motivoRechazo).toContain('messageImprint del sello TSA no coincide');
  });

  it('rechaza estampa TSA si la firma CMS interna del token de tiempo es inválida/alterada', async () => {
    const rootCa = await generarCertificadoPersonalizado({
      commonName: 'ROOT CA BAD SIG',
      esCa: true,
      keyUsageByte: 0x04,
      serial: 930,
    });
    const signer = await generarCertificadoPersonalizado({
      commonName: 'FIRMANTE BAD TSA SIG',
      esCa: false,
      keyUsageByte: 0x80,
      emisorCert: rootCa.cert,
      claveFirmaEmisor: rootCa.keys.privateKey,
      serial: 931,
    });

    const bytes = await pdfCmsDePrueba('Sig', signer, {
      generarTsa: { alterarFirmaCms: true },
    });

    const result = await validarFirmaPades(bytes, {
      certificadosConfianza: [rootCa.pem],
      exigirTsa: true,
    });

    expect(result.valido).toBe(false);
    expect(result.detalles.selloTiempoTsa?.firmaVerificada).toBe(false);
    expect(result.detalles.motivoRechazo).toMatch(/(Fallo en la verificación criptográfica|La firma criptográfica CMS del token TSA es inválida)/);
  });

  it('rechaza estampa TSA si el certificado de la TSA carece del EKU id-kp-timeStamping (RFC 3161 §2.3)', async () => {
    const rootCa = await generarCertificadoPersonalizado({
      commonName: 'ROOT CA TSA SIN EKU',
      esCa: true,
      keyUsageByte: 0x04,
      serial: 940,
    });
    const signer = await generarCertificadoPersonalizado({
      commonName: 'FIRMANTE TSA SIN EKU',
      esCa: false,
      keyUsageByte: 0x80,
      emisorCert: rootCa.cert,
      claveFirmaEmisor: rootCa.keys.privateKey,
      serial: 941,
    });

    // TSA certificate created with empty/missing EKU id-kp-timeStamping
    const tsaSinEku = await generarCertificadoPersonalizado({
      commonName: 'TSA SIN EKU TIME STAMPING',
      esCa: false,
      keyUsageByte: 0x80,
      serial: 942,
    });

    const bytes = await pdfCmsDePrueba('Sig', signer, {
      generarTsa: { tsaCertData: tsaSinEku, omitirEku: true },
    });

    const result = await validarFirmaPades(bytes, {
      certificadosConfianza: [rootCa.pem],
      exigirTsa: true,
    });

    expect(result.valido).toBe(false);
    expect(result.detalles.selloTiempoTsa?.valido).toBe(false);
    expect(result.detalles.motivoRechazo).toContain('id-kp-timeStamping');
  });

  it('rechaza estampa TSA si el certificado de la TSA estaba fuera de vigencia en genTime', async () => {
    const rootCa = await generarCertificadoPersonalizado({
      commonName: 'ROOT CA TSA EXPIRADA',
      esCa: true,
      keyUsageByte: 0x04,
      serial: 950,
    });
    const signer = await generarCertificadoPersonalizado({
      commonName: 'FIRMANTE TSA EXPIRADA',
      esCa: false,
      keyUsageByte: 0x80,
      emisorCert: rootCa.cert,
      claveFirmaEmisor: rootCa.keys.privateKey,
      serial: 951,
    });

    const bytes = await pdfCmsDePrueba('Sig', signer, {
      generarTsa: {
        validoDesde: new Date(Date.now() - 100_000),
        validoHasta: new Date(Date.now() - 50_000), // Expirado antes de ahora
        fecha: new Date(), // genTime ahora
      },
    });

    const result = await validarFirmaPades(bytes, {
      certificadosConfianza: [rootCa.pem],
      exigirTsa: true,
    });

    expect(result.valido).toBe(false);
    expect(result.detalles.selloTiempoTsa?.valido).toBe(false);
    expect(result.detalles.motivoRechazo).toContain('no se encontraba vigente en la fecha declarada');
  });

  it('rechaza estampa TSA si no proviene de un ancla de confianza TSA autorizada (certificadosConfianzaTsa)', async () => {
    const rootCa = await generarCertificadoPersonalizado({
      commonName: 'ROOT CA PRINCIPAL',
      esCa: true,
      keyUsageByte: 0x04,
      serial: 960,
    });
    const tsaAnchorAjeno = await generarCertificadoPersonalizado({
      commonName: 'TSA ANCHOR AJENO',
      esCa: true,
      keyUsageByte: 0x04,
      serial: 961,
    });
    const signer = await generarCertificadoPersonalizado({
      commonName: 'FIRMANTE TSA NO ANCLADA',
      esCa: false,
      keyUsageByte: 0x80,
      emisorCert: rootCa.cert,
      claveFirmaEmisor: rootCa.keys.privateKey,
      serial: 962,
    });

    const bytes = await pdfCmsDePrueba('Sig', signer, {
      generarTsa: true,
    });

    const result = await validarFirmaPades(bytes, {
      certificadosConfianza: [rootCa.pem],
      certificadosConfianzaTsa: [tsaAnchorAjeno.pem], // No coincide con el certificado efímero de la TSA
      exigirTsa: true,
    });

    expect(result.valido).toBe(false);
    expect(result.detalles.selloTiempoTsa?.confianzaAcreditada).toBe(false);
    expect(result.detalles.motivoRechazo).toContain('no proviene de un ancla de confianza autorizada');
  });

  it('documenta advertencia explícita de entorno desconectado cuando la revocación en línea no está disponible', async () => {
    const rootCa = await generarCertificadoPersonalizado({
      commonName: 'ROOT CA DESCONECTADA',
      esCa: true,
      keyUsageByte: 0x04,
      serial: 1000,
    });
    const bytes = await pdfCmsDePrueba('Sig', rootCa);
    const result = await validarFirmaPades(bytes, {
      certificadosConfianza: [rootCa.pem],
    });

    expect(result.detalles.revocacion).toMatchObject({
      estado: 'NO_VERIFICADO_OFFLINE',
      motivo: expect.stringContaining('entorno desconectado'),
    });
  });

  it('acredita NO_REVOCADO_VERIFICADO cuando la CRL institucional descargada está vigente, firmada y no incluye el certificado', async () => {
    const rootCa = await generarCertificadoPersonalizado({
      commonName: 'ROOT CA CRL LIMPIA',
      esCa: true,
      keyUsageByte: 0x06,
      serial: 1100,
    });
    const signer = await generarCertificadoPersonalizado({
      commonName: 'FIRMANTE CRL LIMPIA',
      esCa: false,
      keyUsageByte: 0x80,
      emisorCert: rootCa.cert,
      claveFirmaEmisor: rootCa.keys.privateKey,
      serial: 1101,
    });

    const crlBytes = await generarCrlDePrueba(rootCa, [9999]);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(crlBytes, {
        status: 200,
        headers: { 'Content-Type': 'application/pkix-crl' },
      }),
    ) as any;

    try {
      const bytes = await pdfCmsDePrueba('Sig', signer);
      const result = await validarFirmaPades(bytes, {
        certificadosConfianza: [rootCa.pem],
        crlUrl: 'http://crl.suiza.edu.pe/ca.crl',
        exigirRevocacion: true,
      });

      expect(result.valido).toBe(true);
      expect(result.detalles.revocacion).toMatchObject({
        estado: 'NO_REVOCADO_VERIFICADO',
        metodo: 'CRL',
        fuente: 'http://crl.suiza.edu.pe/ca.crl',
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('rechaza con REVOCADO_CONFIRMADO cuando la CRL institucional descargada incluye el número de serie del certificado', async () => {
    const rootCa = await generarCertificadoPersonalizado({
      commonName: 'ROOT CA CRL REVOCADO',
      esCa: true,
      keyUsageByte: 0x06,
      serial: 1110,
    });
    const signer = await generarCertificadoPersonalizado({
      commonName: 'FIRMANTE CRL REVOCADO',
      esCa: false,
      keyUsageByte: 0x80,
      emisorCert: rootCa.cert,
      claveFirmaEmisor: rootCa.keys.privateKey,
      serial: 1111,
    });

    const crlBytes = await generarCrlDePrueba(rootCa, [1111]);

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(crlBytes, {
        status: 200,
        headers: { 'Content-Type': 'application/pkix-crl' },
      }),
    ) as any;

    try {
      const bytes = await pdfCmsDePrueba('Sig', signer);
      const result = await validarFirmaPades(bytes, {
        certificadosConfianza: [rootCa.pem],
        crlUrl: 'http://crl.suiza.edu.pe/ca.crl',
        exigirRevocacion: true,
      });

      expect(result.valido).toBe(false);
      expect(result.detalles.revocacion).toMatchObject({
        estado: 'REVOCADO_CONFIRMADO',
        metodo: 'CRL',
        motivo: expect.stringContaining('revocado en la lista CRL'),
      });
      expect(result.detalles.motivoRechazo).toContain('revocado');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('falla cerrado cuando la consulta de revocación en línea da timeout o falla de red bajo exigirRevocacion: true', async () => {
    const rootCa = await generarCertificadoPersonalizado({
      commonName: 'ROOT CA TIMEOUT REV',
      esCa: true,
      keyUsageByte: 0x06,
      serial: 1120,
    });
    const signer = await generarCertificadoPersonalizado({
      commonName: 'FIRMANTE TIMEOUT REV',
      esCa: false,
      keyUsageByte: 0x80,
      emisorCert: rootCa.cert,
      claveFirmaEmisor: rootCa.keys.privateKey,
      serial: 1121,
    });

    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network connection timeout')) as any;

    try {
      const bytes = await pdfCmsDePrueba('Sig', signer);
      const result = await validarFirmaPades(bytes, {
        certificadosConfianza: [rootCa.pem],
        crlUrl: 'http://crl.suiza.edu.pe/ca.crl',
        exigirRevocacion: true,
      });

      expect(result.valido).toBe(false);
      expect(result.detalles.revocacion?.estado).toBe('NO_VERIFICADO_OFFLINE');
      expect(result.detalles.motivoRechazo).toContain('exige verificación obligatoria de revocación');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

async function generarCrlDePrueba(
  issuerCertData: { keys: any; cert: Certificate },
  serialesRevocados: number[] = [],
  fresca = true,
): Promise<Buffer> {
  const crl = new CertificateRevocationList({
    issuer: issuerCertData.cert.subject,
    thisUpdate: new Time({
      type: 0,
      value: fresca ? new Date(Date.now() - 60_000) : new Date(Date.now() - 100_000),
    }),
    nextUpdate: new Time({
      type: 0,
      value: fresca ? new Date(Date.now() + 60_000) : new Date(Date.now() - 10_000),
    }),
    revokedCertificates: serialesRevocados.map(
      (sn) =>
        new RevokedCertificate({
          userCertificate: new Integer({ value: sn }),
          revocationDate: new Time({ type: 0, value: new Date(Date.now() - 30_000) }),
        }),
    ),
  });

  await crl.sign(issuerCertData.keys.privateKey, 'SHA-256');
  return Buffer.from(crl.toSchema().toBER(false));
}
