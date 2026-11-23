import fs from 'node:fs';
import path from 'node:path';
import { createHash, createHmac, webcrypto } from 'node:crypto';
import { Client } from 'pg';
import { PDFDocument, PDFHexString, PDFName, PDFString } from 'pdf-lib';
import { BitString, Integer, ObjectIdentifier, OctetString, UTCTime, Utf8String } from 'asn1js';
import {
  Attribute,
  AttributeTypeAndValue,
  BasicConstraints,
  Certificate,
  ContentInfo,
  EncapsulatedContentInfo,
  ExtendedKeyUsage,
  Extension,
  IssuerAndSerialNumber,
  MessageImprint,
  SignedAndUnsignedAttributes,
  SignedData,
  SignerInfo,
  TSTInfo,
  AlgorithmIdentifier,
} from 'pkijs';
import { obtenerConfiguracionS3 } from '../src/config/s3.config.js';
import { generarUrlPresigned } from '../src/core/storage/s3-storage.service.js';

/**
 * Agente local PAdES para entorno de demostración (NODE_ENV !== 'production').
 * Cumple el mismo protocolo criptográfico de ReFirma RENIEC:
 *   1. Localiza el documento pendiente en estado EN_FIRMA (resolución o certificado_ingles).
 *   2. Descarga el PDF A4 original desde MinIO/S3.
 *   3. Genera certificado X.509 demo autorizado ('SIGD DEMO - SIN VALIDEZ LEGAL'), estampa ByteRange,
 *      CMS SignedData detached + sello de tiempo TSA RFC 3161 verificable criptográficamente.
 *   4. Sube el PDF firmado a MinIO/S3 y despacha POST /api/v1/firma/callback-refirma autenticado con HMAC.
 */
if (process.env.NODE_ENV === 'production') {
  console.error('[REFIRMA-DEMO] Prohibido ejecutar en NODE_ENV=production.');
  process.exit(1);
}

function parseEnvFile(filePath: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!fs.existsSync(filePath)) return out;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const clean = line.trim();
    if (!clean || clean.startsWith('#')) continue;
    const idx = clean.indexOf('=');
    if (idx > 0) {
      const key = clean.slice(0, idx).trim();
      let val = clean.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      out[key] = val;
    }
  }
  return out;
}

function loadEnvLocal(): Record<string, string> {
  const localEnv = parseEnvFile(path.resolve(process.cwd(), '.env'));
  const demoEnvPath = process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, 'SIGD', 'secrets', 'demo-runtime.env')
    : '';
  const demoEnv = demoEnvPath ? parseEnvFile(demoEnvPath) : {};
  return { ...localEnv, ...demoEnv };
}

async function generarCertificadoDemo(commonName: string, isTsa = false) {
  const keys = await webcrypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  );

  const cert = new Certificate();
  cert.version = 2;
  cert.serialNumber = new Integer({ value: isTsa ? 202602 : 202601 });
  cert.subject.typesAndValues.push(
    new AttributeTypeAndValue({ type: '2.5.4.3', value: new Utf8String({ value: commonName }) }),
  );
  cert.issuer = cert.subject;
  cert.notBefore.value = new Date(Date.now() - 120_000);
  cert.notAfter.value = new Date(Date.now() + 86_400_000);

  const extensions: Extension[] = [
    new Extension({ extnID: '2.5.29.19', critical: true, extnValue: new BasicConstraints({ cA: false }).toSchema().toBER(false) }),
    new Extension({ extnID: '2.5.29.15', critical: true, extnValue: new BitString({ valueHex: new Uint8Array([0x80]).buffer, unusedBits: 0 }).toBER(false) }),
  ];

  if (isTsa) {
    extensions.push(
      new Extension({
        extnID: '2.5.29.37',
        critical: true,
        extnValue: new ExtendedKeyUsage({ keyPurposes: ['1.3.6.1.5.5.7.3.8'] }).toSchema().toBER(false),
      }),
    );
  }

  cert.extensions = extensions;
  await cert.subjectPublicKeyInfo.importKey(keys.publicKey);
  await cert.sign(keys.privateKey, 'SHA-256');
  return { keys, cert };
}

async function generarTsaToken(signatureBytes: Uint8Array): Promise<Attribute> {
  const { keys, cert } = await generarCertificadoDemo('SIGD DEMO - SIN VALIDEZ LEGAL TSA', true);
  const msgHash = createHash('sha256').update(signatureBytes).digest();

  const tstInfo = new TSTInfo({
    version: 1,
    policy: '1.2.3.4.5.6.7',
    messageImprint: new MessageImprint({
      hashAlgorithm: new AlgorithmIdentifier({ algorithmId: '2.16.840.1.101.3.4.2.1' }),
      hashedMessage: new OctetString({ valueHex: Uint8Array.from(msgHash).buffer }),
    }),
    serialNumber: new Integer({ value: Date.now() }),
    genTime: new Date(),
  });

  const encap = new OctetString({ valueHex: tstInfo.toSchema().toBER(false) });
  const tsaCms = new SignedData({
    version: 3,
    encapContentInfo: new EncapsulatedContentInfo({
      eContentType: '1.2.840.113549.1.9.16.1.4',
      eContent: encap,
    }),
    certificates: [cert],
    signerInfos: [
      new SignerInfo({
        version: 1,
        sid: new IssuerAndSerialNumber({ issuer: cert.issuer, serialNumber: cert.serialNumber }),
      }),
    ],
  });

  tsaCms.signerInfos[0].signedAttrs = new SignedAndUnsignedAttributes({
    type: 0,
    attributes: [
      new Attribute({ type: '1.2.840.113549.1.9.3', values: [new ObjectIdentifier({ value: '1.2.840.113549.1.9.16.1.4' })] }),
      new Attribute({ type: '1.2.840.113549.1.9.4', values: [new OctetString({ valueHex: createHash('sha256').update(encap.valueBlock.valueHexView).digest() })] }),
      new Attribute({ type: '1.2.840.113549.1.9.5', values: [new UTCTime({ valueDate: new Date() })] }),
    ],
  });

  await tsaCms.sign(keys.privateKey, 0, 'SHA-256');
  const timeStampContent = new ContentInfo({ contentType: '1.2.840.113549.1.7.2', content: tsaCms.toSchema(true) });
  return new Attribute({ type: '1.2.840.113549.1.9.16.2.14', values: [timeStampContent.toSchema()] });
}

async function firmarPdfConPades(pdfOriginalBytes: Buffer, reason: string): Promise<Buffer> {
  const { keys, cert } = await generarCertificadoDemo('SIGD DEMO - SIN VALIDEZ LEGAL (DIRECTOR GENERAL)');
  const pdfDoc = await PDFDocument.load(pdfOriginalBytes);

  const signature = pdfDoc.context.obj({
    Type: 'Sig',
    Filter: 'Adobe.PPKLite',
    SubFilter: 'adbe.pkcs7.detached',
    ByteRange: [0, 999999999, 999999999, 999999999],
    Contents: PDFHexString.of('0'.repeat(16384)),
    Reason: PDFString.of(reason),
    Location: PDFString.of('Pucallpa, Ucayali, Peru'),
    ContactInfo: PDFString.of('director.general@iestpsuiza.edu.pe'),
    M: PDFString.fromDate(new Date()),
  });

  const field = pdfDoc.context.obj({ FT: 'Sig', T: PDFString.of('FirmaDireccionGeneral'), V: pdfDoc.context.register(signature) });
  pdfDoc.catalog.set(PDFName.of('AcroForm'), pdfDoc.context.register(pdfDoc.context.obj({ Fields: [pdfDoc.context.register(field)], SigFlags: 3 })));

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
    certificates: [cert],
    signerInfos: [
      new SignerInfo({ version: 1, sid: new IssuerAndSerialNumber({ issuer: cert.issuer, serialNumber: cert.serialNumber }) }),
    ],
  });

  const bytes = Buffer.concat([output.subarray(0, start), output.subarray(end)]);
  await cms.sign(keys.privateKey, 0, 'SHA-256', Uint8Array.from(bytes).buffer);

  const rawSig = cms.signerInfos[0].signature.valueBlock.valueHexView || (cms.signerInfos[0].signature.valueBlock as { valueHex: ArrayBuffer }).valueHex;
  cms.signerInfos[0].unsignedAttrs = new SignedAndUnsignedAttributes({ type: 1, attributes: [await generarTsaToken(new Uint8Array(rawSig))] });

  const content = new ContentInfo({ contentType: '1.2.840.113549.1.7.2', content: cms.toSchema(true) });
  const hex = Buffer.from(content.toSchema().toBER(false)).toString('hex');
  output.write(hex.padEnd(16384, '0'), start + 1, 'ascii');
  return output;
}

async function main() {
  const docIdArg = process.argv[2];
  if (!docIdArg) {
    console.error('Uso: npx tsx scripts/refirma_demo_agent.ts <documento_adjunto_id>');
    process.exit(1);
  }

  const env = { ...loadEnvLocal(), ...process.env };
  for (const [k, v] of Object.entries(env)) {
    if (process.env[k] === undefined) process.env[k] = v;
  }
  const dbUrl = env.DATABASE_URL || 'postgres://postgres:postgres_password@127.0.0.1:5433/sigd_jacobo_demo';
  const webhookSecret = env.REFIRMA_WEBHOOK_SECRET;
  const backendPort = env.PORT || '3008';
  if (!webhookSecret) throw new Error('Falta REFIRMA_WEBHOOK_SECRET en backend/.env');

  const db = new Client({ connectionString: dbUrl });
  await db.connect();

  try {
    const docRes = await db.query<{
      documento_adjunto_id: string;
      s3_bucket: string;
      s3_key: string;
      nombre_archivo: string;
      estado_exp: string;
    }>(
      `SELECT a.documento_adjunto_id::text, a.s3_bucket, a.s3_key, a.nombre_archivo, rut.estado_nuevo AS estado_exp
         FROM sigd_doc.documento_adjunto a
         JOIN sigd_rut.estado_actual_expediente rut ON rut.expediente_id = a.expediente_id
        WHERE a.documento_adjunto_id = $1::uuid`,
      [docIdArg],
    );
    if (docRes.rowCount !== 1) throw new Error(`Documento ${docIdArg} no encontrado.`);
    const doc = docRes.rows[0];
    if (doc.estado_exp !== 'EN_FIRMA') {
      throw new Error(`El expediente debe encontrarse EN_FIRMA (actual: ${doc.estado_exp}).`);
    }

    const configS3 = { ...obtenerConfiguracionS3(), bucket: doc.s3_bucket };
    const getUrl = generarUrlPresigned(doc.s3_key, configS3, { metodo: 'GET', expiraSegundos: 60 });
    const pdfRes = await fetch(getUrl);
    if (!pdfRes.ok) throw new Error(`No se pudo descargar PDF desde MinIO (${pdfRes.status})`);
    const originalPdf = Buffer.from(await pdfRes.arrayBuffer());

    const signedPdf = await firmarPdfConPades(originalPdf, `Suscripcion Digital PAdES - ${doc.nombre_archivo}`);
    const sha256Firmado = createHash('sha256').update(signedPdf).digest('hex');

    const s3KeyFirmado = doc.s3_key.startsWith('certificados/')
      ? doc.s3_key.replace(/^certificados\/BORR-/, 'certificados/').replace(/\.pdf$/i, '.signed.pdf')
      : doc.s3_key.replace(/\.pdf$/i, '.signed.pdf');

    const putUrl = generarUrlPresigned(s3KeyFirmado, configS3, {
      metodo: 'PUT',
      contentType: 'application/pdf',
      expiraSegundos: 60,
    });
    const putRes = await fetch(putUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/pdf' },
      body: new Uint8Array(signedPdf),
    });
    if (!putRes.ok) throw new Error(`Fallo subida S3 firmado (${putRes.status})`);

    const payload = {
      documento_id: doc.documento_adjunto_id,
      sha256_firmado: sha256Firmado,
      firmante: 'director.demo',
      fecha_sello_tsa: new Date().toISOString(),
      s3_bucket: configS3.bucket,
      s3_key: s3KeyFirmado,
    };
    const rawBody = Buffer.from(JSON.stringify(payload), 'utf8');
    const signature = 'sha256=' + createHmac('sha256', webhookSecret).update(rawBody).digest('hex');

    const cbRes = await fetch(`http://localhost:${backendPort}/api/v1/firma/callback-refirma`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-refirma-signature': signature,
        'x-refirma-timestamp': new Date().toISOString(),
      },
      body: rawBody,
    });
    const cbJson = await cbRes.json();
    if (!cbRes.ok) {
      throw new Error(`Callback ReFirma HTTP ${cbRes.status}: ${JSON.stringify(cbJson)}`);
    }
    console.log('[REFIRMA-DEMO] Firma PAdES completada:', cbJson);
  } finally {
    await db.end();
  }
}

void main();
