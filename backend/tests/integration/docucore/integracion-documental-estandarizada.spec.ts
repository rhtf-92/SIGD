import 'dotenv/config';
import crypto from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Pool, type PoolClient } from 'pg';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { documentoStorageService } from '../../../src/core/storage/documento-storage.service.js';
import { generarUrlPresigned } from '../../../src/core/storage/s3-storage.service.js';
import { obtenerConfiguracionS3 } from '../../../src/config/s3.config.js';
import { MesaPartesDigitalService } from '../../../src/domains/tramicore/mesaPartesDigital.service.js';
import { VentanillaPresencialService } from '../../../src/domains/tramicore/ventanillaPresencial.service.js';
import {
  asegurarCedulaAcusePersistida,
  persistirCedulaAcuse,
} from '../../../src/domains/identicore/cedulaAcuse.service.js';

describe('SIGD — Integración Documental Estandarizada (MinIO + SHA-256 + PostgreSQL + Históricos Intactos)', () => {
  let pool: Pool;
  let txClient: PoolClient;
  let isolatedPool: Pool;
  let savepointSeq = 0;

  const s3KeysCleanup = new Set<string>();
  const AREA_DIR_ID = 'a0000000-0000-0000-0000-000000000002';
  const USER_MESA_PARTES = 'a01038b7-7905-4803-9b01-62cbc2d58cca';
  const REG_VERSION_INGLES = '11720d13-da80-433c-8a24-d02cfd2cb5de';

  let totalExpInicial = 0;
  let hashes149Inicial: string[] = [];
  let hashes150Inicial: string[] = [];

  function buildIsolatedPool(): Pool {
    const proxyClient = {
      query: async (text: any, params?: any) => {
        const sql = typeof text === 'string' ? text.trim().toUpperCase() : '';
        if (sql === 'BEGIN') {
          savepointSeq += 1;
          return txClient.query(`SAVEPOINT sp_doc_${savepointSeq}`);
        }
        if (sql === 'COMMIT') {
          return txClient.query(`RELEASE SAVEPOINT sp_doc_${savepointSeq}`);
        }
        if (sql === 'ROLLBACK') {
          return txClient.query(`ROLLBACK TO SAVEPOINT sp_doc_${savepointSeq}`);
        }
        return txClient.query(text, params);
      },
      release: () => {},
    } as unknown as PoolClient;

    return {
      query: (text: any, params?: any) => txClient.query(text, params),
      connect: async () => proxyClient,
    } as unknown as Pool;
  }

  async function crearPdfEntradaSintetico(): Promise<Buffer> {
    const doc = await PDFDocument.create();
    const page = doc.addPage([595.28, 841.89]);
    const font = await doc.embedFont(StandardFonts.Helvetica);
    page.drawText('Solicitud de prueba aislada SIGD', {
      x: 50,
      y: 780,
      size: 13,
      font,
      color: rgb(0, 0, 0),
    });
    return Buffer.from(await doc.save());
  }

  beforeAll(async () => {
    pool = new Pool({
      connectionString:
        process.env.DATABASE_URL ||
        'postgres://postgres:postgres_password@172.20.157.19:5432/sigd_prueba',
    });

    const cntRes = await pool.query<{ total: number }>(
      'SELECT COUNT(*)::int AS total FROM sigd_tra.expediente',
    );
    totalExpInicial = cntRes.rows[0].total;

    const hist149 = await pool.query<{ sha256: string }>(
      `SELECT d.sha256
         FROM sigd_doc.documento_adjunto d
         JOIN sigd_tra.expediente e ON e.expediente_id = d.expediente_tra_id
        WHERE e.codigo_expediente = 'EXP-2026-000149'
        ORDER BY d.creado_en`,
    );
    hashes149Inicial = hist149.rows.map((r) => r.sha256);

    const hist150 = await pool.query<{ sha256: string }>(
      `SELECT d.sha256
         FROM sigd_doc.documento_adjunto d
         JOIN sigd_tra.expediente e ON e.expediente_id = d.expediente_tra_id
        WHERE e.codigo_expediente = 'EXP-2026-000150'
        ORDER BY d.creado_en`,
    );
    hashes150Inicial = hist150.rows.map((r) => r.sha256);

    txClient = await pool.connect();
    await txClient.query('BEGIN');
    isolatedPool = buildIsolatedPool();
  });

  afterAll(async () => {
    for (const key of s3KeysCleanup) {
      await documentoStorageService.eliminarObjetoS3(key).catch(() => null);
    }
    if (txClient) {
      await txClient.query('ROLLBACK').catch(() => {});
      txClient.release();
    }

    const cntPost = await pool.query<{ total: number }>(
      'SELECT COUNT(*)::int AS total FROM sigd_tra.expediente',
    );
    expect(cntPost.rows[0].total).toBe(totalExpInicial);

    const post149 = await pool.query<{ sha256: string }>(
      `SELECT d.sha256
         FROM sigd_doc.documento_adjunto d
         JOIN sigd_tra.expediente e ON e.expediente_id = d.expediente_tra_id
        WHERE e.codigo_expediente = 'EXP-2026-000149'
        ORDER BY d.creado_en`,
    );
    expect(post149.rows.map((r) => r.sha256)).toEqual(hashes149Inicial);

    const post150 = await pool.query<{ sha256: string }>(
      `SELECT d.sha256
         FROM sigd_doc.documento_adjunto d
         JOIN sigd_tra.expediente e ON e.expediente_id = d.expediente_tra_id
        WHERE e.codigo_expediente = 'EXP-2026-000150'
        ORDER BY d.creado_en`,
    );
    expect(post150.rows.map((r) => r.sha256)).toEqual(hashes150Inicial);

    await pool.end();
  });

  it('1. Cargo de Mesa de Partes Digital: PDF válido en MinIO, descarga real y SHA-256 exacto sin duplicados', async () => {
    const pdfEntrada = await crearPdfEntradaSintetico();
    const servicioDigital = new MesaPartesDigitalService(isolatedPool);

    const resultado = await servicioDigital.radicarDigital(
      {
        tipoPersona: 'NATURAL',
        tipoDocumento: 'DNI',
        numeroDocumento: '77112233',
        nombres: 'Lucía',
        apellidoPaterno: 'Mendoza',
        apellidoMaterno: 'Vela',
        correo: 'lucia.doc.test@iestp-suiza.edu.pe',
        celular: '961112233',
        direccion: 'Av. Túpac Amaru 100',
        asunto: 'Solicitud digital de Certificado de Inglés para verificación documental',
        registroVersionId: REG_VERSION_INGLES,
        documentos: [
          {
            nombreArchivo: 'Solicitud_Ingles_Test.pdf',
            mimeType: 'application/pdf',
            base64Content: pdfEntrada.toString('base64'),
            totalPaginas: 1,
          },
        ],
      },
      new Date(),
      txClient,
    );

    const docsRes = await txClient.query<{
      documento_adjunto_id: string;
      nombre_archivo: string;
      s3_bucket: string;
      s3_key: string;
      sha256: string;
      tamano_bytes: number;
    }>(
      `SELECT documento_adjunto_id, nombre_archivo, s3_bucket, s3_key, sha256, tamano_bytes
         FROM sigd_doc.documento_adjunto
        WHERE expediente_tra_id = $1::uuid
        ORDER BY creado_en ASC`,
      [resultado.expedienteId],
    );

    expect(docsRes.rows.length).toBe(2);
    for (const d of docsRes.rows) {
      s3KeysCleanup.add(d.s3_key);
    }

    const docCargo = docsRes.rows.find((d) => d.nombre_archivo.startsWith('Cargo_Mesa_Digital_'));
    expect(docCargo).toBeDefined();
    expect(docsRes.rows.filter((d) => d.nombre_archivo.startsWith('Cargo_Mesa_Digital_')).length).toBe(1);

    const configS3 = obtenerConfiguracionS3();
    const presignedUrl = generarUrlPresigned(
      docCargo!.s3_key,
      { ...configS3, bucket: docCargo!.s3_bucket },
      { metodo: 'GET', expiraSegundos: 120 },
    );
    const resp = await fetch(presignedUrl);
    expect(resp.status).toBe(200);
    const bytesMinio = Buffer.from(await resp.arrayBuffer());
    expect(bytesMinio.subarray(0, 5).toString('utf-8')).toBe('%PDF-');
    expect(bytesMinio.length).toBe(Number(docCargo!.tamano_bytes));

    const shaReal = crypto.createHash('sha256').update(bytesMinio).digest('hex');
    expect(shaReal).toBe(docCargo!.sha256);

    const pdfLoaded = await PDFDocument.load(bytesMinio);
    expect(pdfLoaded.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it('2. Cargo de Ventanilla Presencial y Documento de Atención: MinIO, descarga real y SHA-256 exacto', async () => {
    const ventanilla = new VentanillaPresencialService(isolatedPool);
    const resultado = await ventanilla.registrarExpedienteVentanilla(
      {
        tipoDocumento: 'DNI',
        numeroDocumento: '77445566',
        nombres: 'Mateo',
        apellidos: 'Ríos Paredes',
        datosRemitente: 'Mateo Ríos Paredes',
        correo: 'mateo.doc.test@iestp-suiza.edu.pe',
        asunto: 'Solicitud presencial de Certificado de Inglés TUPA p1-fila-06',
        foliosTotales: 3,
        registroVersionId: REG_VERSION_INGLES,
        idOperadorVentanilla: USER_MESA_PARTES,
      },
      txClient,
    );

    const docsVentanilla = await txClient.query<{
      documento_adjunto_id: string;
      nombre_archivo: string;
      s3_key: string;
      sha256: string;
      tamano_bytes: number;
    }>(
      `SELECT documento_adjunto_id, nombre_archivo, s3_key, sha256, tamano_bytes
         FROM sigd_doc.documento_adjunto
        WHERE expediente_tra_id = $1::uuid`,
      [resultado.expedienteId],
    );
    expect(docsVentanilla.rows.length).toBe(1);
    const cargoPresencial = docsVentanilla.rows[0];
    s3KeysCleanup.add(cargoPresencial.s3_key);

    const bytesCargo = await documentoStorageService.obtenerObjetoS3(cargoPresencial.s3_key);
    expect(bytesCargo.subarray(0, 5).toString('utf-8')).toBe('%PDF-');
    expect(crypto.createHash('sha256').update(bytesCargo).digest('hex')).toBe(cargoPresencial.sha256);
    const loadedCargo = await PDFDocument.load(bytesCargo);
    expect(loadedCargo.getPageCount()).toBeGreaterThanOrEqual(1);

    // Generar, subir, descargar y validar Documento de Atención
    const bufferAtencion = await documentoStorageService.generarResolucionPdf({
      cut: resultado.cut,
      numeroResolucion: 'INF-TEC-INT-2026-001',
      tramiteNombre: 'Certificado de Inglés',
      fechaHora: new Date(),
      administrado: 'Mateo Ríos Paredes',
      resultadoResumen: 'Informe técnico favorable tras validación documental en prueba aislada.',
      observacionInterna: 'Verificación de integridad MinIO + SHA-256.',
      operador: 'Especialista Académico Demo',
      area: 'Subdirección Académica',
    });

    const keyAtencion = documentoStorageService.generarKeyResolucion(resultado.expedienteId);
    const verificado = await documentoStorageService.subirDocumentoPdf({
      s3Key: keyAtencion,
      buffer: bufferAtencion,
    });
    s3KeysCleanup.add(verificado.s3Key);

    const bytesAtencion = await documentoStorageService.obtenerObjetoS3(verificado.s3Key);
    expect(bytesAtencion.subarray(0, 5).toString('utf-8')).toBe('%PDF-');
    expect(crypto.createHash('sha256').update(bytesAtencion).digest('hex')).toBe(verificado.sha256);
    const loadedAtencion = await PDFDocument.load(bytesAtencion);
    expect(loadedAtencion.getPageCount()).toBeGreaterThanOrEqual(1);
    expect(AREA_DIR_ID).toBeTruthy();
  });

  it('3. Cédula de Acuse en MinIO: persistencia, descarga presigned y SHA-256 coincidente sin registros residuales', async () => {
    const personaId = crypto.randomUUID();
    const usuarioId = crypto.randomUUID();
    const notificacionId = crypto.randomUUID();
    const idAcuse = `ACU-2026-${notificacionId.slice(0, 8).toUpperCase()}`;
    const cvdAcuse = `CVD-2026-ACU-${notificacionId.slice(0, 6).toUpperCase()}-7B12`;
    const ahoraIso = new Date().toISOString();
    const docNum = `79${String(Math.floor(Math.random() * 900000) + 100000)}`;

    await txClient.query(
      `INSERT INTO sigd_auth.persona (id_persona, tipo, id_documento) VALUES ($1::uuid, 'NATURAL', $2)`,
      [personaId, docNum],
    );
    await txClient.query(
      `INSERT INTO sigd_auth.persona_natural (id_persona, nombres, apellidos, nombre_completo)
       VALUES ($1::uuid, 'Ciudadano', 'Acuse Test', 'Ciudadano Acuse Test')`,
      [personaId],
    );
    await txClient.query(
      `INSERT INTO sigd_auth.cuenta_usuario (id_usuario, id_persona, usuario, correo, password_hash, activo)
       VALUES ($1::uuid, $2::uuid, $3, $4, '$argon2id$v=19$m=65536,t=3,p=1$c2lnZHRlc3RzYWx0$c2lnZHRlc3RoYXNo', true)`,
      [usuarioId, personaId, `acuse_${docNum}`, `acuse_${docNum}@test.local`],
    );
    await txClient.query(
      `INSERT INTO sigd_auth.notificacion_casilla (
         id, usuario_id, persona_id, correo_destinatario, cut, asunto, tipo_acto,
         estado, fecha_deposito, fecha_lectura, id_acuse, acuse_hash_sha256, acuse_sellado_tiempo, cuerpo
       ) VALUES (
         $1::uuid, $2::uuid, $3::uuid, $4, 'EXP-2026-TESTACU', 'Resolución de prueba aislada', 'RESOLUCION',
         'LEIDO', now(), now(), $5, $6, $7::timestamptz, '{}'::jsonb
       )`,
      [
        notificacionId,
        usuarioId,
        personaId,
        `acuse_${docNum}@test.local`,
        idAcuse,
        'd'.repeat(64),
        ahoraIso,
      ],
    );

    const persistido = await persistirCedulaAcuse(isolatedPool, notificacionId, {
      idNotificacion: notificacionId,
      cut: 'EXP-2026-TESTACU',
      tipoActo: 'RESOLUCION',
      asunto: 'Resolución de prueba aislada para validación de cédula de acuse',
      fechaDeposito: ahoraIso,
      fechaLectura: ahoraIso,
      estadoNotificacion: 'LEIDO',
      idAcuse,
      cvdAcuse,
      acuseSelladoTiempo: ahoraIso,
      acuseHashSha256: 'd'.repeat(64),
      destinatario: {
        nombresCompletos: 'Ciudadano Acuse Test',
        tipoDocumento: 'DNI',
        numeroDocumento: docNum,
        correoPersonal: `acuse_${docNum}@test.local`,
      },
    });

    s3KeysCleanup.add(persistido.s3KeyPdf);
    s3KeysCleanup.add(persistido.s3KeyTxt);

    const descarga = await asegurarCedulaAcusePersistida(isolatedPool, notificacionId, usuarioId, 'pdf');
    expect(descarga.idAcuse).toBe(idAcuse);

    const resp = await fetch(descarga.downloadUrlPdf);
    expect(resp.status).toBe(200);
    const bytesAcuse = Buffer.from(await resp.arrayBuffer());
    expect(bytesAcuse.subarray(0, 5).toString('utf-8')).toBe('%PDF-');
    expect(crypto.createHash('sha256').update(bytesAcuse).digest('hex')).toBe(persistido.sha256Pdf);

    const loaded = await PDFDocument.load(bytesAcuse);
    expect(loaded.getPageCount()).toBeGreaterThanOrEqual(1);
  });
});
