import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Pool, PoolClient } from 'pg';
import request from 'supertest';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { MesaPartesDigitalService } from '../../../src/domains/tramicore/mesaPartesDigital.service.js';
import { DocumentoStorageService } from '../../../src/core/storage/documento-storage.service.js';
import { SQL_LISTAR_RUTADOC } from '../../../src/domains/rutadoc/rutadoc.repository.js';
import { construirApp } from '../../../src/app.js';

describe('SIGD — Verificación Funcional E2E: Radicación Pública Mesa de Partes Digital', () => {
  let pool: Pool;
  let client: PoolClient;
  let storageService: DocumentoStorageService;
  let mesaPartesService: MesaPartesDigitalService;
  let app: any;

  const AREA_DIR_ID = 'a0000000-0000-0000-0000-000000000002';
  const REG_VERSION_INGLES = '11720d13-da80-433c-8a24-d02cfd2cb5de';
  const REG_VERSION_ESTUDIOS_6SEM = '6fcb1ea2-e73e-4dd4-a8bb-b6c8774671e6';

  const minioKeysToCleanup: string[] = [];

  beforeAll(async () => {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres_password@172.20.157.19:5432/sigd_prueba',
    });
    client = await pool.connect();
    storageService = new DocumentoStorageService();
    mesaPartesService = new MesaPartesDigitalService(pool);
    app = construirApp(pool);
  });

  afterAll(async () => {
    // Limpieza de objetos MinIO generados durante la prueba
    for (const key of minioKeysToCleanup) {
      await storageService.eliminarObjetoS3(key).catch(() => null);
    }
    if (client) {
      client.release();
    }
    await pool.end();
  });

  it('1. HTTP Boundary: El middleware express.json acepta payloads con PDF base64 > 100 KB sin error 413 Payload Too Large', async () => {
    // Generar un payload con string simulado de ~300 KB (supera el límite por defecto de 100 KB)
    const largeDummyBase64 = 'A'.repeat(300 * 1024);

    const res = await request(app)
      .post('/api/v1/tramites/mesa-partes-digital')
      .send({
        tipoPersona: 'NATURAL',
        tipoDocumento: 'DNI',
        numeroDocumento: '00000000',
        correo: 'correo-invalido', // Provoca 400 Validation Error por schema, demostrando que superó el body parser
        asunto: 'Test payload size',
        registroVersionId: REG_VERSION_INGLES,
        documentos: [{
          nombreArchivo: 'test.pdf',
          base64Content: largeDummyBase64,
        }],
      });

    // Debe ser 400 VALIDATION_ERROR y NO 413 Payload Too Large ni 500 INTERNAL_ERROR
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.invalidParams).toBeDefined();
    expect(res.body.invalidParams.some((p: any) => p.name.includes('correo'))).toBe(true);
  });

  it('2. Flujo completo de radicación digital para Certificado de Inglés con PDF real de 2 páginas', async () => {
    await client.query('BEGIN'); // Transacción aislada para no ensuciar BD operativa

    try {
      // Crear PDF sintético real de 2 páginas
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      
      const page1 = pdfDoc.addPage([595.28, 841.89]);
      page1.drawText('SOLICITUD FORMAL: CERTIFICADO DE INGLES', { x: 50, y: 780, size: 14, font, color: rgb(0, 0, 0) });
      page1.drawText('Administrado: Juan Alberto Quispe Mamani', { x: 50, y: 750, size: 12, font });
      page1.drawText('Folio 1 de 2', { x: 50, y: 720, size: 10, font });

      const page2 = pdfDoc.addPage([595.28, 841.89]);
      page2.drawText('ANEXO / PETITORIO FUNDAMENTADO', { x: 50, y: 780, size: 14, font, color: rgb(0, 0, 0) });
      page2.drawText('Expongo: He culminado los 4 ciclos del nivel intermedio de ingles.', { x: 50, y: 750, size: 11, font });
      page2.drawText('Folio 2 de 2', { x: 50, y: 720, size: 10, font });

      const pdfBytes = await pdfDoc.save();
      const pdfBase64 = Buffer.from(pdfBytes).toString('base64');

      // Invocar servicio pasando el cliente de la transacción aislada
      const resultado = await mesaPartesService.radicarDigital(
        {
          tipoPersona: 'NATURAL',
          tipoDocumento: 'DNI',
          numeroDocumento: '44556677',
          nombres: 'JUAN ALBERTO',
          apellidoPaterno: 'QUISPE',
          apellidoMaterno: 'MAMANI',
          correo: 'juan.quispe.test@example.com',
          celular: '961234567',
          direccion: 'Av. Centenario Km 4.5, Pucallpa',
          asunto: 'Solicitud formal de Certificado de Inglés conforme a normativa TUPA',
          registroVersionId: REG_VERSION_INGLES,
          documentos: [
            {
              idRequisito: undefined, // Solicitud Principal
              nombreArchivo: 'Solicitud_Certificado_Ingles.pdf',
              mimeType: 'application/pdf',
              base64Content: pdfBase64,
              totalPaginas: 2,
            },
          ],
        },
        new Date(),
        client,
      );

      // A) Comprobar respuesta del trámite
      expect(resultado).toBeDefined();
      expect(resultado.expedienteId).toMatch(/^[0-9a-f-]{36}$/);
      expect(resultado.cut).toMatch(/^EXP-2026-\d{6}$/);
      expect(resultado.totalFolios).toBe(2);
      expect(resultado.cargoDigital.codigo).toMatch(/^CARGO-[0-9A-F]{8}$/);
      expect(resultado.cargoDigital.totalFolios).toBe(2);
      expect(resultado.trackingUrl).toContain(encodeURIComponent(resultado.cut));

      // B) Comprobar Orden de Pago coherente
      expect(resultado.ordenPago).toBeDefined();
      expect(resultado.ordenPago?.monto).toBe(100.00);
      expect(resultado.ordenPago?.codigoPago).toMatch(/^PAG-2026-\d{6}$/);
      expect(resultado.ordenPago?.concepto).toContain('Certificado de Inglés');

      // C) Comprobar persistencia del expediente en BD
      const expRes = await client.query<{
        codigo_expediente: string;
        estado: string;
        area_destino_id: string;
        id_usuario_creador: string | null;
      }>(
        `SELECT codigo_expediente, estado, area_destino_id, id_usuario_creador
           FROM sigd_tra.expediente
          WHERE expediente_id = $1::uuid`,
        [resultado.expedienteId],
      );
      expect(expRes.rows.length).toBe(1);
      const expFila = expRes.rows[0];
      expect(expFila.codigo_expediente).toBe(resultado.cut);
      expect(expFila.estado).toBe('PENDIENTE_PAGO'); // Correcto: trámite arancelado pasa a PENDIENTE_PAGO
      expect(expFila.area_destino_id).toBe(AREA_DIR_ID); // Asignado canónicamente a DIR
      expect(expFila.id_usuario_creador).toBeNull(); // Radicación pública sin cuenta

      // D) Comprobar visibilidad y proyección inicial en DIR
      const rutRes = await client.query<{
        estado_nuevo: string;
        area_actual_id: string;
      }>(
        `SELECT estado_nuevo, area_actual_id
           FROM sigd_rut.estado_actual_expediente
          WHERE expediente_id = $1::uuid`,
        [resultado.expedienteId],
      );
      expect(rutRes.rows.length).toBe(1);
      expect(rutRes.rows[0].estado_nuevo).toBe('REGISTRADO');
      expect(rutRes.rows[0].area_actual_id).toBe(AREA_DIR_ID);

      // Comprobar que aparece en la bandeja institucional de DIR
      const bandejaDir = await client.query(SQL_LISTAR_RUTADOC, [
        resultado.cut, AREA_DIR_ID, null, null, ['REGISTRADO'], null, null, 10,
      ]);
      expect(bandejaDir.rows.some((r: any) => r.id_expediente === resultado.expedienteId)).toBe(true);

      // E) Comprobar documentos almacenados y foliación continua
      const docsRes = await client.query<{
        documento_adjunto_id: string;
        nombre_archivo: string;
        s3_key: string;
        tamano_bytes: number;
        sha256: string;
      }>(
        `SELECT documento_adjunto_id, nombre_archivo, s3_key, tamano_bytes, sha256
           FROM sigd_doc.documento_adjunto
          WHERE expediente_tra_id = $1::uuid
          ORDER BY creado_en ASC`,
        [resultado.expedienteId],
      );
      expect(docsRes.rows.length).toBe(2); // Solicitud Principal + Cargo Digital

      const docPresentado = docsRes.rows[0];
      expect(docPresentado.nombre_archivo).toBe('Solicitud_Certificado_Ingles.pdf');
      expect(Number(docPresentado.tamano_bytes)).toBe(pdfBytes.length);
      expect(docPresentado.sha256).toBeDefined();
      minioKeysToCleanup.push(docPresentado.s3_key);

      const docCargo = docsRes.rows[1];
      expect(docCargo.nombre_archivo).toContain('Cargo_Mesa_Digital');
      minioKeysToCleanup.push(docCargo.s3_key);

      // Foliación en sigd_tra.expediente_documento_folio
      const foliosRes = await client.query<{ folio_inicio: number; folio_fin: number }>(
        `SELECT folio_inicio, folio_fin
           FROM sigd_tra.expediente_documento_folio
          WHERE expediente_id = $1::uuid AND id_documento = $2::uuid`,
        [resultado.expedienteId, docPresentado.documento_adjunto_id],
      );
      expect(foliosRes.rows.length).toBe(1);
      expect(foliosRes.rows[0].folio_inicio).toBe(1);
      expect(foliosRes.rows[0].folio_fin).toBe(2);

      // F) Comprobar orden de pago en sigd_tra.orden_pago
      const ordenRes = await client.query<{
        codigo_pago: string;
        estado: string;
        monto: string;
      }>(
        `SELECT codigo_pago, estado, monto
           FROM sigd_tra.orden_pago
          WHERE expediente_id = $1::uuid`,
        [resultado.expedienteId],
      );
      expect(ordenRes.rows.length).toBe(1);
      expect(ordenRes.rows[0].codigo_pago).toBe(resultado.ordenPago?.codigoPago);
      expect(ordenRes.rows[0].estado).toBe('PENDIENTE');
      expect(Number(ordenRes.rows[0].monto)).toBe(100.00);

      // G) Comprobar asiento de registro
      const asientoRes = await client.query<{ canal_ingreso: string }>(
        `SELECT canal_ingreso FROM sigd_tra.asiento_registro WHERE expediente_id = $1::uuid`,
        [resultado.expedienteId],
      );
      expect(asientoRes.rows.length).toBe(1);
      expect(asientoRes.rows[0].canal_ingreso).toBe('MESA_VIRTUAL');

      // H) Rollback obligatorio para no dejar rastro operativo
    } finally {
      await client.query('ROLLBACK');
    }

    // Verificar post-rollback: La BD no debe contener el expediente de prueba
    const postCheck = await pool.query(
      `SELECT count(*) AS total FROM sigd_tra.expediente WHERE dni_solicitante = '44556677'`,
    );
    expect(Number(postCheck.rows[0].total)).toBe(0);
  });

  it('3. HTTP 201: El endpoint POST /api/v1/tramites/mesa-partes-digital responde 201 y CUT válido con PDF permitido', async () => {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]);
    page.drawText('SOLICITUD FORMAL CERTIFICADO DE INGLES');
    const pdfBytes = await pdfDoc.save();
    const pdfBase64 = Buffer.from(pdfBytes).toString('base64');

    const mockResultado = {
      expedienteId: '99999999-9999-9999-9999-999999999999',
      cut: 'EXP-2026-000155',
      codigoVerificacion: 'ABCD1234',
      trackingUrl: 'https://sigd.iestp-suiza.edu.pe/consulta-publica?cut=EXP-2026-000155',
      totalFolios: 1,
      ordenPago: {
        codigoPago: 'PAG-2026-000155',
        monto: 100.0,
        concepto: 'Derecho de Trámite TUPA: Certificado de Inglés',
        fechaVencimiento: new Date().toISOString(),
      },
      cargoDigital: {
        codigo: 'CARGO-12345678',
        totalFolios: 1,
        documentoAdjuntoId: '88888888-8888-8888-8888-888888888888',
      },
    };

    const spy = vi.spyOn(MesaPartesDigitalService.prototype, 'radicarDigital').mockResolvedValueOnce(mockResultado as any);

    const res = await request(app)
      .post('/api/v1/tramites/mesa-partes-digital')
      .send({
        tipoPersona: 'NATURAL',
        tipoDocumento: 'DNI',
        numeroDocumento: '77889900',
        nombres: 'MARIA ELENA',
        apellidoPaterno: 'RODRIGUEZ',
        apellidoMaterno: 'TORRES',
        correo: 'maria.rodriguez@example.com',
        asunto: 'Solicitud formal de Certificado de Inglés con PDF permitido',
        registroVersionId: REG_VERSION_INGLES,
        documentos: [
          {
            nombreArchivo: 'Solicitud_Ingles.pdf',
            mimeType: 'application/pdf',
            base64Content: pdfBase64,
            totalPaginas: 1,
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.cut).toBe('EXP-2026-000155');
    expect(res.body.cut).toMatch(/^EXP-2026-\d{6}$/);
    expect(res.body.totalFolios).toBe(1);
    expect(res.body.ordenPago).toBeDefined();
    expect(res.body.cargoDigital).toBeDefined();
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });

  it('4. Procedimiento Certificado de Estudios Superiores (6 Semestres) con persona existente y dirección actualizada', async () => {
    await client.query('BEGIN'); // Transacción aislada para 0 contaminación

    try {
      // 1. Crear o asegurar persona existente en el padrón con DNI de prueba
      const testDni = '99000001'; // DNI del ciudadano demo
      const personaCheck = await client.query<{ id_persona: string }>(
        'SELECT id_persona FROM sigd_auth.persona WHERE id_documento = $1 LIMIT 1',
        [testDni],
      );
      expect(personaCheck.rows.length).toBeGreaterThanOrEqual(1);

      // 2. Crear PDF sintético real
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595.28, 841.89]);
      page.drawText('SOLICITUD: CERTIFICADO DE ESTUDIOS SUPERIORES (6 SEMESTRES)');
      const pdfBytes = await pdfDoc.save();
      const pdfBase64 = Buffer.from(pdfBytes).toString('base64');

      // 3. Invocar radicarDigital para Certificado de Estudios Superiores (6 Semestres)
      // Debe actualizar direccion y ubigeo_distrito SIN fallar por la columna inexistente actualizado_en
      const resultado = await mesaPartesService.radicarDigital(
        {
          tipoPersona: 'NATURAL',
          tipoDocumento: 'DNI',
          numeroDocumento: testDni,
          nombres: 'JUAN ALBERTO',
          apellidoPaterno: 'QUISPE',
          apellidoMaterno: 'MAMANI',
          correo: 'ciudadano.demo@suiza.edu.pe',
          celular: '961000001',
          direccion: 'Av. Centenario Km 4.5, Pucallpa',
          ubigeoDistrito: '250101',
          asunto: 'Solicitud formal de Certificado de Estudios Superiores (6 Semestres)',
          registroVersionId: REG_VERSION_ESTUDIOS_6SEM,
          documentos: [
            {
              nombreArchivo: 'Solicitud_Certificado_Estudios.pdf',
              mimeType: 'application/pdf',
              base64Content: pdfBase64,
            },
          ],
        },
        new Date(),
        client,
      );

      // Verificaciones:
      // A) CUT canónico generado
      expect(resultado.cut).toMatch(/^EXP-2026-\d{6}$/);

      // B) Orden de pago por S/ 124.00 generada
      expect(resultado.ordenPago).toBeDefined();
      expect(Number(resultado.ordenPago!.monto)).toBe(124.00);
      expect(resultado.ordenPago!.codigoPago).toMatch(/^PAG-2026-\d{6}$/);

      // C) Asiento de registro persistido en MESA_VIRTUAL
      const asientoRes = await client.query(
        'SELECT canal_ingreso, asunto FROM sigd_tra.asiento_registro WHERE expediente_id = $1::uuid',
        [resultado.expedienteId],
      );
      expect(asientoRes.rows.length).toBe(1);
      expect(asientoRes.rows[0].canal_ingreso).toBe('MESA_VIRTUAL');

      // D) Estado inicial PENDIENTE_PAGO por tener arancel TUPA
      const expRes = await client.query(
        'SELECT estado, area_destino_id FROM sigd_tra.expediente WHERE expediente_id = $1::uuid',
        [resultado.expedienteId],
      );
      expect(expRes.rows[0].estado).toBe('PENDIENTE_PAGO');
      expect(expRes.rows[0].area_destino_id).toBe(AREA_DIR_ID);

      // E) Dirección actualizada en sigd_auth.persona
      const persRes = await client.query(
        'SELECT direccion, ubigeo_distrito FROM sigd_auth.persona WHERE id_persona = $1::uuid',
        [personaCheck.rows[0].id_persona],
      );
      expect(persRes.rows[0].direccion).toBe('Av. Centenario Km 4.5, Pucallpa');
      expect(persRes.rows[0].ubigeo_distrito).toBe('250101');

      if ((resultado.cargoDigital as any)?.documentoAdjuntoId) {
        minioKeysToCleanup.push((resultado.cargoDigital as any).documentoAdjuntoId);
      }
    } finally {
      await client.query('ROLLBACK'); // Cero contaminación de la base de datos operativa
    }
  });
});
