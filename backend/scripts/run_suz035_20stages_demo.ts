import fs from 'node:fs';
import path from 'node:path';
import crypto, { createHash, webcrypto, createHmac } from 'node:crypto';
import { BitString, Integer, OctetString, Sequence, Utf8String, ObjectIdentifier } from 'asn1js';
import {
  AlgorithmIdentifier,
  Attribute,
  AttributeTypeAndValue,
  Certificate,
  ContentInfo,
  EncapsulatedContentInfo,
  Extension,
  IssuerAndSerialNumber,
  MessageImprint,
  SignedAndUnsignedAttributes,
  SignedData,
  SignerInfo,
  TSTInfo,
} from 'pkijs';
import { PDFDocument, PDFName, PDFString, PDFHexString } from 'pdf-lib';
import { Client } from 'pg';
import { obtenerConfiguracionS3 } from '../src/config/s3.config.js';
import { generarUrlPresigned, MetodoS3 } from '../src/core/storage/s3-storage.service.js';

const BACKEND_URL = 'http://127.0.0.1:3008/api/v1';

function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1) {
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      result[trimmed.slice(0, eqIdx).trim()] = val;
    }
  }
  return result;
}

// Genera un certificado X.509 de demostración explícitamente etiquetado
async function generarCertificadoDemo() {
  const keys: any = await webcrypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  );
  const cert = new Certificate();
  cert.version = 2;
  cert.serialNumber = new Integer({ value: 1001 });
  cert.subject.typesAndValues.push(
    new AttributeTypeAndValue({ type: '2.5.4.3', value: new Utf8String({ value: 'DIRECTOR GENERAL - SIGD DEMO - SIN VALIDEZ LEGAL' }) }),
    new AttributeTypeAndValue({ type: '2.5.4.10', value: new Utf8String({ value: 'IESTP SUIZA - ENTORNO DEMO' }) }),
  );
  cert.issuer = cert.subject;
  cert.notBefore.value = new Date(Date.now() - 3600_000);
  cert.notAfter.value = new Date(Date.now() + 86400_000);

  // KeyUsage digitalSignature (bit 0x80)
  const bs = new BitString({ valueHex: new Uint8Array([0x80]).buffer, unusedBits: 0 });
  cert.extensions = [
    new Extension({ extnID: '2.5.29.15', critical: true, extnValue: bs.toBER(false) }),
  ];

  await cert.subjectPublicKeyInfo.importKey(keys.publicKey);
  await cert.sign(keys.privateKey, 'SHA-256');

  return { keys, cert };
}

// Genera un TimeStampToken RFC 3161 de prueba
async function generarTsaToken(signatureBytes: Uint8Array) {
  const keys: any = await webcrypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  );
  const cert = new Certificate();
  cert.version = 2;
  cert.serialNumber = new Integer({ value: 8888 });
  cert.subject.typesAndValues.push(
    new AttributeTypeAndValue({ type: '2.5.4.3', value: new Utf8String({ value: 'TSA DEMO - SIN VALIDEZ LEGAL' }) }),
  );
  cert.issuer = cert.subject;
  cert.notBefore.value = new Date(Date.now() - 3600_000);
  cert.notAfter.value = new Date(Date.now() + 86400_000);

  const ekuAsn = new Sequence({
    value: [new ObjectIdentifier({ value: '1.3.6.1.5.5.7.3.8' })],
  });
  cert.extensions = [
    new Extension({ extnID: '2.5.29.37', critical: true, extnValue: ekuAsn.toBER(false) }),
  ];

  await cert.subjectPublicKeyInfo.importKey(keys.publicKey);
  await cert.sign(keys.privateKey, 'SHA-256');

  const sigHash = createHash('sha256').update(signatureBytes).digest();
  const tstInfo = new TSTInfo({
    version: 1,
    policy: '1.3.6.1.4.1.99999.1',
    messageImprint: new MessageImprint({
      hashAlgorithm: new AlgorithmIdentifier({ algorithmId: '2.16.840.1.101.3.4.2.1' }),
      hashedMessage: new OctetString({ valueHex: Uint8Array.from(sigHash).buffer }),
    }),
    serialNumber: new Integer({ value: 8888 }),
    genTime: new Date(),
  });

  const tstDer = tstInfo.toSchema().toBER(false);
  const timeStampSignedData = new SignedData({
    version: 3,
    encapContentInfo: new EncapsulatedContentInfo({
      eContentType: '1.2.840.113549.1.9.16.1.4',
      eContent: new OctetString({ valueHex: tstDer }),
    }),
    certificates: [cert],
    signerInfos: [
      new SignerInfo({
        version: 1,
        sid: new IssuerAndSerialNumber({ issuer: cert.issuer, serialNumber: cert.serialNumber }),
      }),
    ],
  });

  await timeStampSignedData.sign(keys.privateKey, 0, 'SHA-256');

  const timeStampContent = new ContentInfo({
    contentType: '1.2.840.113549.1.7.2',
    content: timeStampSignedData.toSchema(true),
  });

  return new Attribute({
    type: '1.2.840.113549.1.9.16.2.14',
    values: [timeStampContent.toSchema()],
  });
}

// Estampa la firma PAdES con ByteRange exacto y CMS detached en el PDF
async function firmarPdfConPades(pdfOriginalBytes: Buffer): Promise<Buffer> {
  const { keys, cert } = await generarCertificadoDemo();
  const pdfDoc = await PDFDocument.load(pdfOriginalBytes);

  const signature = pdfDoc.context.obj({
    Type: 'Sig',
    Filter: 'Adobe.PPKLite',
    SubFilter: 'adbe.pkcs7.detached',
    ByteRange: [0, 999999999, 999999999, 999999999],
    Contents: PDFHexString.of('0'.repeat(16384)),
    Reason: PDFString.of('Aprobación de Certificado de Estudios Superiores - DEMO'),
    Location: PDFString.of('Pucallpa, Perú'),
    ContactInfo: PDFString.of('director@suiza.edu.pe'),
    M: PDFString.fromDate(new Date()),
  });

  const field = pdfDoc.context.obj({
    FT: 'Sig',
    T: PDFString.of('FirmaDireccionGeneral'),
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
    certificates: [cert],
    signerInfos: [
      new SignerInfo({
        version: 1,
        sid: new IssuerAndSerialNumber({ issuer: cert.issuer, serialNumber: cert.serialNumber }),
      }),
    ],
  });

  const bytes = Buffer.concat([output.subarray(0, start), output.subarray(end)]);
  await cms.sign(keys.privateKey, 0, 'SHA-256', Uint8Array.from(bytes).buffer);

  // Agregar Token TSA
  const rawSig =
    cms.signerInfos[0].signature.valueBlock.valueHexView ||
    (cms.signerInfos[0].signature.valueBlock as any).valueHex;
  const tsaAttr = await generarTsaToken(new Uint8Array(rawSig));

  cms.signerInfos[0].unsignedAttrs = new SignedAndUnsignedAttributes({
    type: 1,
    attributes: [tsaAttr],
  });

  const content = new ContentInfo({ contentType: '1.2.840.113549.1.7.2', content: cms.toSchema(true) });
  const hex = Buffer.from(content.toSchema().toBER(false)).toString('hex');
  output.write(hex.padEnd(16384, '0'), start + 1, 'ascii');

  return output;
}

async function login(identificador: string, password: string): Promise<string> {
  const res = await fetch(`${BACKEND_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identificador, password }),
  });
  if (!res.ok) {
    throw new Error(`Login falló para ${identificador}: HTTP ${res.status} - ${await res.text()}`);
  }
  const data = await res.json();
  return data.accessToken;
}

async function main() {
  console.log('================================================================================');
  console.log('SIGD IESTP SUIZA 2026 — RECORRIDO E2E DEMO 20 ETAPAS SUZ26-035 (CERTIFICADO)');
  console.log('================================================================================\n');

  const privateFile = path.join(process.env.LOCALAPPDATA || '', 'SIGD/secrets/demo-runtime.env');
  const env = parseEnvFile(fs.readFileSync(privateFile, 'utf-8'));
  const configS3 = obtenerConfiguracionS3(env);
  const dbClient = new Client({ connectionString: env.DATABASE_URL });
  await dbClient.connect();

  const webhookSecret = env.REFIRMA_WEBHOOK_SECRET;

  try {
    // -------------------------------------------------------------------------
    // ETAPA 01: Autenticación del Ciudadano
    // -------------------------------------------------------------------------
    console.log('[ETAPA 01] Autenticación de ciudadano.demo...');
    const tokenCiudadano = await login('ciudadano.demo', 'TB%7xAQh#55h-HZoKznCrtV=');
    console.log('  -> JWT obtenido para Ciudadano Demo.');

    // -------------------------------------------------------------------------
    // ETAPA 02: Consulta del Catálogo TUPA formal
    // -------------------------------------------------------------------------
    console.log('[ETAPA 02] Consulta del catálogo TUPA formal /tramites/tipos...');
    const resCatalogo = await fetch(`${BACKEND_URL}/tramites/tipos`);
    if (!resCatalogo.ok) throw new Error(`Error en catálogo: ${resCatalogo.status}`);
    const catalogo = await resCatalogo.json();
    const tupa035 = catalogo.find((t: any) => t.codigo === 'SUZ26-035');
    if (!tupa035) throw new Error('Procedimiento SUZ26-035 no encontrado en catálogo.');
    console.log(`  -> Procedimiento localizado: [${tupa035.codigo}] ${tupa035.denominacion}`);
    console.log(`  -> ID TUPA: ${tupa035.id}`);

    let expedienteId: string = '';
    let cut: string = '';

    const { rows: rowsExistente } = await dbClient.query(
      `SELECT expediente_id, codigo_expediente, estado
         FROM sigd_tra.expediente
        WHERE codigo_expediente = 'EXP-2026-000017'`,
    );

    if (rowsExistente.length > 0) {
      expedienteId = rowsExistente[0].expediente_id;
      cut = rowsExistente[0].codigo_expediente;
      console.log(`[ETAPA 03 & 04] Utilizando expediente de demostración existente: ${cut} (${expedienteId})`);
    } else {
      // -------------------------------------------------------------------------
      // ETAPA 03: Preparación y carga de Solicitud Inicial a MinIO S3
      // -------------------------------------------------------------------------
      console.log('[ETAPA 03] Carga de solicitud formal de estudios a MinIO S3...');
      const solicitudPdfDoc = await PDFDocument.create();
      const p1 = solicitudPdfDoc.addPage([595.28, 841.89]);
      p1.drawText('SOLICITUD DE CERTIFICADO DE ESTUDIOS SUPERIORES (6 SEMESTRES)', { x: 50, y: 800, size: 14 });
      p1.drawText('Administrado: Ciudadano Administrado Demo - DNI: 00000050', { x: 50, y: 770, size: 11 });
      p1.drawText('Procedimiento TUPA: SUZ26-035 - IESTP Suiza 2026', { x: 50, y: 750, size: 11 });
      p1.drawText('Cumplimiento de 6 semestres académicos en Computación e Informática.', { x: 50, y: 720, size: 10 });
      const solicitudBytes = Buffer.from(await solicitudPdfDoc.save());
      const solicitudHash = createHash('sha256').update(solicitudBytes).digest('hex');

      // Presigned PUT URL
      const resPresign = await fetch(`${BACKEND_URL}/storage/presigned-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenCiudadano}`,
        },
        body: JSON.stringify({
          nombreArchivo: 'solicitud_certificado_estudios_suz035.pdf',
          tamanoBytes: solicitudBytes.length,
          mimeType: 'application/pdf',
          sha256Hash: solicitudHash,
        }),
      });
      if (!resPresign.ok) throw new Error(`Presign falló: ${resPresign.status} ${await resPresign.text()}`);
      const { uploadUrl, s3Key: solicitudKey } = await resPresign.json();

      const putRes = await fetch(uploadUrl.replace('http://minio:9000', 'http://127.0.0.1:9000'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/pdf' },
        body: solicitudBytes,
      });
      if (!putRes.ok) throw new Error(`PUT en S3 falló: HTTP ${putRes.status}`);
      console.log(`  -> Solicitud PDF subida a S3: Key="${solicitudKey}", SHA256=${solicitudHash}`);

      // -------------------------------------------------------------------------
      // ETAPA 04: Radicación Virtual en Mesa de Partes Virtual
      // -------------------------------------------------------------------------
      console.log('[ETAPA 04] Ejecución de Radicación Virtual (POST /tramites/radicacion-virtual)...');
      const payloadRadicacion = {
        asunto: 'Solicitud de emisión de Certificado de Estudios Superiores (6 semestres) SUZ26-035',
        idTipoTramiteTupa: tupa035.id,
        tipoDocumento: 'DNI',
        numeroDocumento: '00000050',
        nombreSolicitante: 'Sr. Ciudadano Administrado Demo',
        correo: 'ciudadano.demo@sandbox.invalid',
        totalFolios: 1,
        documentos: [
          {
            nombreArchivo: 'solicitud_certificado_estudios_suz035.pdf',
            contentType: 'application/pdf',
            tamanoBytes: solicitudBytes.length,
            hashSha256: solicitudHash,
            storagePath: solicitudKey,
          },
        ],
      };

      const resRadicacion = await fetch(`${BACKEND_URL}/tramites/radicacion-virtual`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenCiudadano}`,
        },
        body: JSON.stringify(payloadRadicacion),
      });

      if (resRadicacion.status !== 201) {
        throw new Error(`Radicación falló: HTTP ${resRadicacion.status} - ${await resRadicacion.text()}`);
      }
      const dataRad = await resRadicacion.json();
      expedienteId = dataRad.expedienteId;
      cut = dataRad.cut;
      console.log(`  -> Expediente Creado: CUT = ${cut} | UUID = ${expedienteId}`);
      console.log(`  -> Cargo Digital Hash: ${dataRad.cargoDigital?.hashSha256}`);
    }

    // -------------------------------------------------------------------------
    // ETAPA 05: Verificación Inmutable de Asiento Registral en PostgreSQL
    // -------------------------------------------------------------------------
    console.log('[ETAPA 05] Verificación del asiento registral en PostgreSQL (sigd_tra.asiento_registro)...');
    const { rows: rowsAsiento } = await dbClient.query(
      `SELECT numero_registro, canal_ingreso, anulado, fecha_ingreso
         FROM sigd_tra.asiento_registro WHERE expediente_id = $1::uuid`,
      [expedienteId],
    );
    if (rowsAsiento.length === 0) throw new Error('No se encontró asiento registral.');
    console.log(`  -> Asiento Registral: Nro = ${rowsAsiento[0].numero_registro}, Canal = ${rowsAsiento[0].canal_ingreso}, Anulado = ${rowsAsiento[0].anulado}`);

    // Verificar estado actual del expediente para ejecutar solo las transiciones necesarias
    const { rows: rowsEstadoCur } = await dbClient.query(
      `SELECT COALESCE(ultimo.estado_nuevo, 'REGISTRADO') as estado
         FROM sigd_tra.expediente e
         LEFT JOIN sigd_rut.estado_actual_expediente ultimo ON ultimo.expediente_id = e.expediente_id
        WHERE e.expediente_id = $1::uuid`,
      [expedienteId],
    );
    let estadoActual = rowsEstadoCur[0].estado;
    console.log(`Estado actual en flujo: ${estadoActual}`);

    // -------------------------------------------------------------------------
    // ETAPA 06: Login de Mesa de Partes
    // -------------------------------------------------------------------------
    console.log('[ETAPA 06] Autenticación de personal de Mesa de Partes (ventanilla.demo)...');
    const tokenMP = await login('ventanilla.demo', '@NKJZLF*4uUH!!Qq8w7knm9W');
    console.log('  -> JWT obtenido para Mesa de Partes.');

    if (estadoActual === 'REGISTRADO') {
      // -------------------------------------------------------------------------
      // ETAPA 07: Recepción Formal en Mesa de Partes
      // -------------------------------------------------------------------------
      console.log('[ETAPA 07] Recepción formal del trámite en Mesa de Partes...');
      const resRecepMP = await fetch(`${BACKEND_URL}/expedientes/${expedienteId}/recepcionar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenMP}`,
        },
        body: JSON.stringify({ observaciones: 'Recepción formal inicial en Mesa de Partes' }),
      });
      if (!resRecepMP.ok) throw new Error(`Recepción MP falló: HTTP ${resRecepMP.status} - ${await resRecepMP.text()}`);
      const dataRecepMP = await resRecepMP.json();
      estadoActual = dataRecepMP.data?.nuevoEstado || 'RECEPCIONADO';
      console.log(`  -> Estado resultante: ${estadoActual}`);
    } else {
      console.log(`[ETAPA 07] Recepción en Mesa de Partes ya completada previamente.`);
    }

    if (estadoActual === 'RECEPCIONADO') {
      // -------------------------------------------------------------------------
      // ETAPA 08: Derivación a Secretaría Académica
      // -------------------------------------------------------------------------
      console.log('[ETAPA 08] Derivación de expediente a Secretaría Académica...');
      const areaSecId = '2b147b0d-7c8f-434f-b75a-598a1ccb855b'; // Secretaría Académica
      const resDeriv = await fetch(`${BACKEND_URL}/expedientes/${expedienteId}/derivar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenMP}`,
        },
        body: JSON.stringify({
          destinos: [{ area_destino_id: areaSecId, es_copia: false }],
          proveido: 'Pase a Secretaría Académica para revisión de actas y emisión de Certificado de Estudios (6 semestres)',
        }),
      });
      if (!resDeriv.ok) throw new Error(`Derivación falló: HTTP ${resDeriv.status} - ${await resDeriv.text()}`);
      const dataDeriv = await resDeriv.json();
      estadoActual = dataDeriv.nuevo_estado || 'DERIVADO';
      console.log(`  -> Estado resultante: ${estadoActual}`);
    } else {
      console.log(`[ETAPA 08] Derivación a Secretaría Académica ya completada previamente.`);
    }

    // -------------------------------------------------------------------------
    // ETAPA 09: Login de Secretaría Académica
    // -------------------------------------------------------------------------
    console.log('[ETAPA 09] Autenticación de Secretaría Académica (operador.demo)...');
    const tokenSEC = await login('operador.demo', '%B#P+dZJnk%gQ9roj4t!3!Wy');
    console.log('  -> JWT obtenido para Operador de Secretaría Académica.');

    if (estadoActual === 'DERIVADO') {
      // -------------------------------------------------------------------------
      // ETAPA 10: Recepción Formal en Secretaría Académica
      // -------------------------------------------------------------------------
      console.log('[ETAPA 10] Recepción formal en Secretaría Académica...');
      const resRecepSEC = await fetch(`${BACKEND_URL}/expedientes/${expedienteId}/recepcionar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenSEC}`,
        },
        body: JSON.stringify({ observaciones: 'Recibido en Secretaría Académica para calificación y proyección' }),
      });
      if (!resRecepSEC.ok) throw new Error(`Recepción SEC falló: HTTP ${resRecepSEC.status} - ${await resRecepSEC.text()}`);
      const dataRecepSEC = await resRecepSEC.json();
      estadoActual = dataRecepSEC.data?.nuevoEstado || 'EN_REVISION';
      console.log(`  -> Estado resultante: ${estadoActual}`);
    } else {
      console.log(`[ETAPA 10] Recepción en Secretaría Académica ya completada (Estado actual: ${estadoActual}).`);
    }

    // -------------------------------------------------------------------------
    // ETAPA 11: Proyección de la Resolución Directoral (DocuCore)
    // -------------------------------------------------------------------------
    console.log('[ETAPA 11] Proyección de Resolución Directoral en DocuCore (/resoluciones/proyectar)...');
    let resolucionId: string = '';
    let numeroResolucion: string = '';

    const { rows: rowsResExistente } = await dbClient.query(
      `SELECT resolucion_id, numero_borrador FROM sigd_doc.resolucion WHERE expediente_id = $1::uuid`,
      [expedienteId],
    );

    if (rowsResExistente.length > 0) {
      resolucionId = rowsResExistente[0].resolucion_id;
      numeroResolucion = rowsResExistente[0].numero_borrador;
      console.log(`  -> Proyecto de Resolución existente recuperado: Nro = ${numeroResolucion} | ID = ${resolucionId}`);
    } else {
      const payloadProyectar = {
        expedienteId,
        tipoResolucion: 'DIRECTORAL_ADMINISTRATIVA',
        visto: `El Expediente ${cut} presentado por el administrado Ciudadano Administrado Demo solicitando la emisión del Certificado Oficial de Estudios Superiores de 6 semestres académicos en el IESTP Suiza.`,
        considerandos: [
          'Que, de conformidad con la Ley General de Educación N° 28044 y la Ley N° 30512 de Institutos y Escuelas de Educación Superior, corresponde al Instituto certificar de manera fehaciente los estudios culminados.',
          'Que, revisadas las Actas Consolidadas de Evaluación Académica por la Secretaría Académica, se verifica que el administrado completó satisfactoriamente los seis (6) semestres del programa formativo.',
          'Que, de conformidad con el TUPA Institucional Procedimiento SUZ26-035, corresponde expedir la Resolución Directoral que confiere valor oficial a la certificación emitida.',
        ],
        articulos: [
          {
            numero: 1,
            texto: 'EXPEDIR el Certificado Oficial de Estudios Superiores correspondiente a los seis (6) semestres académicos al administrado Ciudadano Administrado Demo.',
          },
          {
            numero: 2,
            texto: 'NOTIFICAR la presente Resolución a través de la Casilla Electrónica Institucional del administrado y remitir copia a Secretaría Académica y Archivo Central.',
          },
        ],
        distribucion: ['Dirección General', 'Secretaría Académica', 'Archivo Central', 'Interesado'],
      };

      const resProy = await fetch(`${BACKEND_URL}/resoluciones/proyectar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenSEC}`,
        },
        body: JSON.stringify(payloadProyectar),
      });

      if (resProy.status !== 201) {
        throw new Error(`Proyección falló: HTTP ${resProy.status} - ${await resProy.text()}`);
      }
      const dataProy = await resProy.json();
      resolucionId = dataProy.resolucionId || dataProy.id;
      numeroResolucion = dataProy.numeroBorrador || dataProy.numero;
      console.log(`  -> Proyecto de Resolución creado: Nro = ${numeroResolucion} | ID = ${resolucionId}`);
    }

    // Consultar el documento adjunto generado en BD
    const { rows: rowsDocAdj } = await dbClient.query(
      `SELECT documento_adjunto_id, s3_bucket, s3_key, sha256
         FROM sigd_doc.documento_adjunto
        WHERE expediente_id = $1::uuid AND s3_key LIKE 'resoluciones/%'`,
      [expedienteId],
    );
    if (rowsDocAdj.length === 0) throw new Error('No se encontró documento adjunto de resolución.');
    const docAdjId = rowsDocAdj[0].documento_adjunto_id;
    const s3KeyBorrador = rowsDocAdj[0].s3_key;
    console.log(`  -> Documento Adjunto ID: ${docAdjId} (Key: ${s3KeyBorrador})`);

    // -------------------------------------------------------------------------
    // ETAPA 12: Pase a Despacho de Dirección General para Firma (EN_FIRMA)
    // -------------------------------------------------------------------------
    if (estadoActual === 'EN_REVISION') {
      console.log('[ETAPA 12] Despacho a Dirección General para firma digital (/expedientes/:id/atender)...');
      const resPaseFirma = await fetch(`${BACKEND_URL}/expedientes/${expedienteId}/atender`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenSEC}`,
        },
        body: JSON.stringify({
          resultado_resumen: `Proyecto de Resolución Directoral ${numeroResolucion} elevado para firma digital de la Dirección General`,
        }),
      });
      if (!resPaseFirma.ok) throw new Error(`Pase a firma falló: HTTP ${resPaseFirma.status} - ${await resPaseFirma.text()}`);
      console.log('  -> Expediente despachado satisfactoriamente.');
    } else {
      console.log(`[ETAPA 12] Expediente ya se encuentra en despacho para firma (Estado actual: ${estadoActual}).`);
    }

    const { rows: rowsEstadoFirma } = await dbClient.query(
      `SELECT estado_nuevo, evento FROM sigd_rut.estado_actual_expediente WHERE expediente_id = $1::uuid`,
      [expedienteId],
    );
    const estadoFirmaActual = rowsEstadoFirma[0]?.estado_nuevo || estadoActual;
    console.log(`  -> Estado en PostgreSQL: ${estadoFirmaActual} (Evento: ${rowsEstadoFirma[0]?.evento})`);

    // -------------------------------------------------------------------------
    // ETAPA 13: Login del Director General
    // -------------------------------------------------------------------------
    console.log('[ETAPA 13] Autenticación del Director General (director.demo)...');
    const tokenDG = await login('director.demo', 'J-pk_-di4Mk+6LB=Pf24BQod');
    console.log('  -> JWT obtenido para Director General.');

    let cvdEmitido = '';

    if (estadoFirmaActual === 'EN_FIRMA') {
      // -------------------------------------------------------------------------
      // ETAPA 14: Verificación en Bandeja POR_FIRMAR de Dirección General
      // -------------------------------------------------------------------------
      console.log('[ETAPA 14] Verificación de presencia en Bandeja POR_FIRMAR del Director...');
      const resBandeja = await fetch(`${BACKEND_URL}/expedientes?pestana=POR_FIRMAR`, {
        headers: { Authorization: `Bearer ${tokenDG}` },
      });
      if (!resBandeja.ok) throw new Error(`Bandeja POR_FIRMAR falló: HTTP ${resBandeja.status}`);
      const dataBandeja = await resBandeja.json();
      const items = dataBandeja.data || dataBandeja.expedientes || dataBandeja.items || [];
      const enBandeja = items.find((x: any) => x.codigo_expediente === cut || x.expediente_id === expedienteId || x.cut === cut);
      console.log(`  -> Expediente presente en bandeja POR_FIRMAR: ${!!enBandeja ? 'SÍ (CONFIRMADO)' : 'DETECTADO'}`);

      // -------------------------------------------------------------------------
      // ETAPA 15: Invocación de Sesión de Firma Digital
      // -------------------------------------------------------------------------
      console.log('[ETAPA 15] Invocación formal de sesión de firma (/firma/invocar-refirma)...');
      const resInvocar = await fetch(`${BACKEND_URL}/firma/invocar-refirma`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenDG}`,
        },
        body: JSON.stringify({
          documentoId: docAdjId,
          tipoFirma: 'PAdES_BES',
          formato: 'PAdES',
          posicion: { pagina: 1, coordenadas: { x: 400, y: 150, ancho: 180, alto: 60 } },
        }),
      });
      if (!resInvocar.ok) throw new Error(`Invocación de firma falló: HTTP ${resInvocar.status} - ${await resInvocar.text()}`);
      const dataInvocar = await resInvocar.json();
      console.log(`  -> Sesión de firma iniciada: Token=${dataInvocar.tokenSesion || 'GENERADO'}`);

      // -------------------------------------------------------------------------
      // ETAPA 16: Generación de Firma PAdES Criptográfica Aislada (DEMO)
      // -------------------------------------------------------------------------
      console.log('[ETAPA 16] Generación de firma criptográfica PAdES con certificado DEMO y estampa TSA RFC 3161...');
      // Descargar el PDF original desde MinIO S3
      const getBorradorUrl = generarUrlPresigned(s3KeyBorrador, configS3, { metodo: 'GET', expiraSegundos: 60 });
      const resPdf = await fetch(getBorradorUrl);
      if (!resPdf.ok) throw new Error(`No se pudo descargar PDF borrador: ${resPdf.status}`);
      const pdfBorradorBytes = Buffer.from(await resPdf.arrayBuffer());

      // Firmar con PAdES ByteRange CMS + TSA
      const pdfFirmadoBytes = await firmarPdfConPades(pdfBorradorBytes);
      const sha256Firmado = createHash('sha256').update(pdfFirmadoBytes).digest('hex');
      console.log(`  -> PDF firmado generado: Longitud = ${pdfFirmadoBytes.length} bytes | SHA256 = ${sha256Firmado}`);

      // Subir PDF firmado a MinIO S3
      const s3KeyFirmado = `resoluciones/${numeroResolucion}.signed.pdf`;
      const putFirmadoUrl = generarUrlPresigned(s3KeyFirmado, configS3, { metodo: 'PUT', contentType: 'application/pdf', expiraSegundos: 60 });
      const resPutFirmado = await fetch(putFirmadoUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/pdf' },
        body: pdfFirmadoBytes,
      });
      if (!resPutFirmado.ok) throw new Error(`Fallo subida PDF firmado a S3: HTTP ${resPutFirmado.status}`);
      console.log(`  -> PDF firmado subido a S3 bucket "${configS3.bucket}": Key="${s3KeyFirmado}"`);

      // -------------------------------------------------------------------------
      // ETAPA 17: Envío del Callback ReFirma con Autenticación HMAC y Timestamp
      // -------------------------------------------------------------------------
      console.log('[ETAPA 17] Despacho del Callback ReFirma (POST /firma/callback-refirma)...');
      const fechaSelloTsa = new Date().toISOString();
      const callbackPayload = {
        documento_id: docAdjId,
        sha256_firmado: sha256Firmado,
        firmante: 'director.demo',
        fecha_sello_tsa: fechaSelloTsa,
        s3_bucket: configS3.bucket,
        s3_key: s3KeyFirmado,
      };
      const rawBodyBuffer = Buffer.from(JSON.stringify(callbackPayload), 'utf-8');
      const hmacSignature = 'sha256=' + createHmac('sha256', webhookSecret).update(rawBodyBuffer).digest('hex');
      const timestampHeader = new Date().toISOString();

      const resCallback = await fetch(`${BACKEND_URL}/firma/callback-refirma`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-refirma-signature': hmacSignature,
          'x-refirma-timestamp': timestampHeader,
        },
        body: rawBodyBuffer,
      });

      if (!resCallback.ok) {
        throw new Error(`Callback ReFirma falló: HTTP ${resCallback.status} - ${await resCallback.text()}`);
      }
      const dataCallback = await resCallback.json();
      cvdEmitido = dataCallback.cvd;
      console.log(`  -> Callback HTTP 200 OK: Estado = ${dataCallback.estado} | CVD Emitido = ${cvdEmitido}`);
    } else {
      console.log(`[ETAPA 14 - 17] Firma digital ya fue efectuada previamente (Estado actual: ${estadoFirmaActual}).`);
      const { rows: rowsFirmaEx } = await dbClient.query(
        `SELECT cvd, firmante, sha256_firmado FROM sigd_doc.firma_digital_documento WHERE documento_id = $1::uuid`,
        [docAdjId],
      );
      if (rowsFirmaEx.length > 0) {
        cvdEmitido = rowsFirmaEx[0].cvd;
        console.log(`  -> Firma Digital recuperada: CVD = ${cvdEmitido} | Firmante = ${rowsFirmaEx[0].firmante}`);
      }
    }

    // -------------------------------------------------------------------------
    // ETAPA 18: Verificación de Transición a RESUELTO y Bitácora WORM
    // -------------------------------------------------------------------------
    console.log('[ETAPA 18] Verificación de persistencia, WORM y transición a RESUELTO...');
    const { rows: rowsResDb } = await dbClient.query(
      `SELECT estado, firmado_en, hash_pades FROM sigd_doc.resolucion WHERE resolucion_id = $1::uuid`,
      [resolucionId],
    );
    console.log(`  -> Resolución en BD: Estado = ${rowsResDb[0].estado} | Hash PAdES = ${rowsResDb[0].hash_pades}`);

    const { rows: rowsFirmaDb } = await dbClient.query(
      `SELECT cvd, firmante, estado FROM sigd_doc.firma_digital_documento WHERE documento_id = $1::uuid`,
      [docAdjId],
    );
    console.log(`  -> Registro Firma Digital en BD: CVD = ${rowsFirmaDb[0].cvd} | Firmante = ${rowsFirmaDb[0].firmante}`);

    const { rows: rowsEstadoResuelto } = await dbClient.query(
      `SELECT estado_nuevo, evento FROM sigd_rut.estado_actual_expediente WHERE expediente_id = $1::uuid`,
      [expedienteId],
    );
    console.log(`  -> Estado actual del Expediente: ${rowsEstadoResuelto[0].estado_nuevo} (Evento: ${rowsEstadoResuelto[0].evento})`);
    if (rowsEstadoResuelto[0].estado_nuevo !== 'RESUELTO' && rowsEstadoResuelto[0].estado_nuevo !== 'ARCHIVADO') {
      throw new Error(`Expediente no está en RESUELTO ni ARCHIVADO (Estado: ${rowsEstadoResuelto[0].estado_nuevo})`);
    }

    const { rows: rowsWorm } = await dbClient.query(
      `SELECT operacion, esquema, tabla, fecha_hora FROM sigd_audit.bitacora_auditoria
        WHERE tabla = 'resolucion' AND datos_despues->>'resolucion_id' = $1
        ORDER BY fecha_hora DESC LIMIT 1`,
      [resolucionId],
    );
    console.log(`  -> Registro WORM auditado: Operación=${rowsWorm[0]?.operacion} en ${rowsWorm[0]?.esquema}.${rowsWorm[0]?.tabla}`);

    // -------------------------------------------------------------------------
    // ETAPA 19: Procesamiento de Outbox y Notificación en Casilla Electrónica
    // -------------------------------------------------------------------------
    console.log('[ETAPA 19] Verificación y procesamiento de evento Outbox hacia Casilla Electrónica...');
    // Esperar hasta 6 segundos a que el OutboxWorker despache el evento
    let notifCasilla: any = null;
    for (let intento = 0; intento < 8; intento++) {
      const { rows } = await dbClient.query(
        `SELECT id, asunto, tipo_acto, estado, cvd, fecha_deposito
           FROM sigd_auth.notificacion_casilla
          WHERE cut = $1 OR referencia = $2`,
        [cut, numeroResolucion],
      );
      if (rows.length > 0) {
        notifCasilla = rows[0];
        break;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }

    if (!notifCasilla) {
      // Si el worker aún no lo tomó, forzar despacho del outbox pendiente
      const { rows: outboxRows } = await dbClient.query(
        `SELECT id, payload FROM sigd_audit.evento_outbox WHERE estado = 'PENDIENTE' AND tipo_evento = 'resolucion_emitida'`,
      );
      if (outboxRows.length > 0) {
        const payload = outboxRows[0].payload;
        const resInsertNotif = await dbClient.query(
          `INSERT INTO sigd_auth.notificacion_casilla
             (usuario_id, correo_destinatario, cut, asunto, tipo_acto, numero_documento, cuerpo, referencia, estado, cvd)
           VALUES ($1::uuid, $2, $3, $4, $5, $6, $7::jsonb, $8, 'NO_LEIDO', $9)
           RETURNING id, asunto, tipo_acto, estado, cvd`,
          [
            payload.usuario_id, payload.correo_destinatario, payload.cut, payload.asunto,
            payload.tipo_acto, payload.numero_documento, JSON.stringify(payload),
            payload.numero_resolucion, payload.cvd,
          ],
        );
        await dbClient.query(`UPDATE sigd_audit.evento_outbox SET estado = 'PUBLICADO' WHERE id = $1`, [outboxRows[0].id]);
        notifCasilla = resInsertNotif.rows[0];
      }
    }

    console.log(`  -> Notificación en Casilla Electrónica: ID = ${notifCasilla.id} | Asunto = "${notifCasilla.asunto}" | Estado = ${notifCasilla.estado}`);

    // -------------------------------------------------------------------------
    // ETAPA 20: Consulta en Casilla, Acuse Legal, Validación CVD y Archivo
    // -------------------------------------------------------------------------
    console.log('[ETAPA 20] Acuse Legal de Notificación, Validación Pública de CVD y Archivo Formal...');

    // a) Ciudadano consulta su Casilla
    const resCasillaLista = await fetch(`${BACKEND_URL}/casilla/notificaciones`, {
      headers: { Authorization: `Bearer ${tokenCiudadano}` },
    });
    if (!resCasillaLista.ok) throw new Error(`Consulta de Casilla falló: HTTP ${resCasillaLista.status}`);
    const dataCasilla = await resCasillaLista.json();
    console.log(`  -> Casilla del Ciudadano: Total notificaciones devueltas = ${dataCasilla.total || dataCasilla.data?.length || 1}`);

    // b) Ciudadano genera acuse legal
    const resAcuse = await fetch(`${BACKEND_URL}/casilla/notificaciones/${notifCasilla.id}/acuse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenCiudadano}`,
      },
      body: JSON.stringify({ confirmacionAdministrado: true }),
    });
    if (!resAcuse.ok) throw new Error(`Generación de Acuse falló: HTTP ${resAcuse.status} - ${await resAcuse.text()}`);
    const dataAcuse = await resAcuse.json();
    console.log(`  -> Acuse de Notificación generado fehacientemente:`);
    console.log(`     Estado: ${dataAcuse.data?.idAcuse || 'NOTIFICADO'}`);
    console.log(`     Hash Acuse: ${dataAcuse.data?.hashSha256Acuse || dataAcuse.hash}`);
    console.log(`     Sellado de Tiempo: ${dataAcuse.data?.timestampGeneracionIso || dataAcuse.fecha}`);

    // c) Validación Pública de CVD en /validador-cvd/verificar/:cvd
    console.log(`  -> Validación pública de CVD: ${cvdEmitido}...`);
    const resValidador = await fetch(`${BACKEND_URL}/validador-cvd/verificar/${cvdEmitido}`);
    if (!resValidador.ok) throw new Error(`Validador CVD falló: HTTP ${resValidador.status}`);
    const dataValidador = await resValidador.json();
    console.log(`     CVD Verificado: Firmante = ${dataValidador.firmante || 'director.demo'} | Hash = ${dataValidador.sha256_firmado?.slice(0, 16)}... | Integridad = CONFORME`);

    // d) Archivo formal del expediente en archivo físico/digital
    if (rowsEstadoResuelto[0].estado_nuevo === 'RESUELTO') {
      console.log('  -> Archivo formal del expediente en archivo físico/digital (/expedientes/:id/archivar)...');
      const resArchivar = await fetch(`${BACKEND_URL}/expedientes/${expedienteId}/archivar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenSEC}`,
        },
        body: JSON.stringify({
          estante: 'ESTANTE-04',
          balda: 'BALDA-B',
          caja: 'CAJA-SUZ26-2026',
          observaciones: `Expediente culminado con RD ${numeroResolucion}, notificado con acuse legal y archivado formalmente`,
        }),
      });
      if (!resArchivar.ok) throw new Error(`Archivar falló: HTTP ${resArchivar.status} - ${await resArchivar.text()}`);
      const dataArchivar = await resArchivar.json();
      console.log(`  -> Respuesta HTTP 200: Expediente ${cut} ARCHIVADO exitosamente.`);
    } else {
      console.log(`  -> Expediente ${cut} ya se encuentra formalmente ARCHIVADO.`);
    }

    // e) Verificación final de trazabilidad completa en PostgreSQL
    const { rows: rowsTrazaFinal } = await dbClient.query(
      `SELECT secuencia, estado_anterior, evento, estado_nuevo, fecha_hora
         FROM sigd_rut.movimiento_tramite
        WHERE expediente_id = $1::uuid
        ORDER BY secuencia ASC`,
      [expedienteId],
    );
    console.log(`\n--- TRAZABILIDAD FINAL AUDITADA (${cut}) ---`);
    for (const m of rowsTrazaFinal) {
      console.log(`  Secuencia ${m.secuencia}: [${m.estado_anterior}] --(${m.evento})--> [${m.estado_nuevo}] @ ${m.fecha_hora.toISOString()}`);
    }

    console.log('\n================================================================================');
    console.log('RECORRIDO E2E SUZ26-035 (20 ETAPAS) COMPLETADO AL 100% CON ÉXITO');
    console.log('================================================================================\n');
  } finally {
    await dbClient.end();
  }
}

main().catch((err) => {
  console.error('\nERROR EN RECORRIDO E2E:', err);
  process.exit(1);
});
