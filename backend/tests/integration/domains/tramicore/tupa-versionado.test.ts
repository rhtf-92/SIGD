import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Client, Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import { construirApp } from '../../../../src/app.js';
import { TupaVersionadoService } from '../../../../src/domains/tramicore/tupaVersionado.service.js';
import { RadicacionVirtualService } from '../../../../src/domains/tramicore/radicacionVirtual.service.js';

/**
 * Suite de Pruebas de Integración TUPA Versionado (B_CHRISTIAN)
 * Cumple exhaustivamente con los 13 puntos mínimos exigidos sobre PostgreSQL 18 descartable:
 *
 *  1. catálogo devuelve solo APROBADO
 *  2. PENDIENTE_VALIDACION no aparece
 *  3. registroVersionId es UUID
 *  4. TUPA válido permite radicación
 *  5. se crea expediente_tupa_vinculo
 *  6. UUID inexistente no crea expediente parcial
 *  7. TUPA no aprobado se rechaza
 *  8. flujo libre sigue funcionando
 *  9. detalle con TUPA devuelve contexto
 * 10. detalle sin TUPA devuelve tupa:null
 * 11. CUT sigue siendo CUT
 * 12. no se convierte UUID a número
 * 13. no se rompen rutas existentes
 */

const DB_ADMIN_URL = process.env.TEST_ADMIN_DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/postgres';
const MIGRACIONES = [
  '01_sigd_audit.sql',
  '02_sigd_auth.sql',
  '03_sigd_org.sql',
  '04_sigd_doc.sql',
  '05_sigd_tra.sql',
  '08_sigd_tupa_acoplamiento.sql',
];

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REGEX_CUT = /^EXP-[0-9]{4}-[0-9]{6}$/;

describe('B_CHRISTIAN — Pruebas de integración de backend TUPA versionado', () => {
  let adminClient: Client;
  let testPool: Pool;
  let app: Express;
  let dbName: string;
  let testDbUrl: string;

  let personaId: string;
  let tipoDocumentalId: string;
  let versionesAprobadasIds: string[] = [];
  let versionPendienteId: string;
  let versionRechazadaId: string;

  beforeAll(async () => {
    // 1. Crear BD descartable en PostgreSQL local
    adminClient = new Client({ connectionString: DB_ADMIN_URL });
    await adminClient.connect();

    dbName = `sigd_test_tupa_${randomUUID().replace(/-/g, '').slice(0, 10)}`;
    await adminClient.query(`CREATE DATABASE ${dbName}`);

    testDbUrl = DB_ADMIN_URL.replace(/\/postgres(?:\?.*)?$/, `/${dbName}`);
    testPool = new Pool({ connectionString: testDbUrl });

    // 2. Aplicar migraciones canónicas
    for (const mig of MIGRACIONES) {
      const sqlContent = readFileSync(path.resolve(process.cwd(), 'migraciones', mig), 'utf8');
      await testPool.query(sqlContent);
    }

    // 3. Crear fixtures base para los ensayos
    const personaRes = await testPool.query<{ id_persona: string }>(
      `INSERT INTO sigd_auth.persona (tipo, id_documento)
       VALUES ('NATURAL', '45872315')
       RETURNING id_persona::text`,
    );
    personaId = personaRes.rows[0].id_persona;

    const tipoDocRes = await testPool.query<{ tipo_documental_id: string }>(
      `INSERT INTO sigd_doc.tipo_documento (codigo, nombre, extension, mime_type, tamano_maximo_mb, exige_firma, vigente)
       VALUES ('SOL', 'Solicitud General', 'pdf', 'application/pdf', 25, FALSE, TRUE)
       RETURNING tipo_documental_id::text`,
    );
    tipoDocumentalId = tipoDocRes.rows[0].tipo_documental_id;

    // 4. Insertar las 18 entradas APROBADAS del catálogo TUPA del prototipo
    const shaFuente = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
    versionesAprobadasIds = [];

    for (let i = 1; i <= 18; i++) {
      const codExt = `TUPA-2026-${String(i).padStart(3, '0')}`;
      const denominacion = `Procedimiento Administrativo TUPA N° ${i} IESTP Suiza`;
      const monto = i % 2 === 0 ? `${(i * 12.5).toFixed(2)}` : '0.00';
      const requisitos = JSON.stringify([
        `Requisito obligatorio 1 del trámite ${i}`,
        `Comprobante de pago tasa institucional ${i}`,
      ]);

      const res = await testPool.query<{ registro_version_id: string }>(
        `INSERT INTO sigd_doc.tupa_registro_version (
           documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
           codigo_externo, denominacion_original, monto_original, requisitos_original,
           version_fuente, vigencia_desde, vigencia_hasta, estado_validacion, referencia_aprobacion
         ) VALUES (
           $1, 'TUPA-IESTP-SUIZA-2026.pdf', $2, $3, 1,
           $4, $5, $6, $7::jsonb,
           '2026-v1.0', '2026-01-01', '2026-12-31', 'APROBADO', 'RD N° 045-2026-GR-UCAYALI-DRE'
         ) RETURNING registro_version_id::text`,
        [shaFuente, i, `Fila-${i}`, codExt, denominacion, monto, requisitos],
      );
      versionesAprobadasIds.push(res.rows[0].registro_version_id);
    }

    // 5. Insertar registros no aprobados (PENDIENTE_VALIDACION y RECHAZADO)
    const pendRes = await testPool.query<{ registro_version_id: string }>(
      `INSERT INTO sigd_doc.tupa_registro_version (
         documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
         codigo_externo, denominacion_original, estado_validacion
       ) VALUES (
         $1, 'TUPA-BORRADOR.pdf', 99, 'Fila-99', 1,
         'TUPA-BORRADOR-001', 'Procedimiento en evaluación no aprobado', 'PENDIENTE_VALIDACION'
       ) RETURNING registro_version_id::text`,
      [shaFuente],
    );
    versionPendienteId = pendRes.rows[0].registro_version_id;

    const rechRes = await testPool.query<{ registro_version_id: string }>(
      `INSERT INTO sigd_doc.tupa_registro_version (
         documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
         codigo_externo, denominacion_original, estado_validacion
       ) VALUES (
         $1, 'TUPA-RECHAZADO.pdf', 100, 'Fila-100', 1,
         'TUPA-RECHAZADO-001', 'Procedimiento derogado o rechazado', 'RECHAZADO'
       ) RETURNING registro_version_id::text`,
      [shaFuente],
    );
    versionRechazadaId = rechRes.rows[0].registro_version_id;

    // 6. Construir Express app
    app = construirApp(testPool);
  }, 60000);

  afterAll(async () => {
    // Cerrar pools y destruir BD descartable
    if (testPool) await testPool.end();
    if (adminClient) {
      await adminClient.query(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
        [dbName],
      );
      await adminClient.query(`DROP DATABASE IF EXISTS ${dbName}`);
      await adminClient.end();
    }
  });

  const payloadRadicacion = (hash: string, versionId?: string | null) => ({
    asunto: 'Solicitud de emisión de constancia de egresado 2026',
    idPersona: personaId,
    tipoDocumentalId,
    registroVersionId: versionId ?? undefined,
    nombreSolicitante: 'Ana Quispe Ramos',
    correo: 'ana.quispe@estudiante.iestpsuiza.edu.pe',
    totalFolios: 3,
    documentos: [
      {
        nombreArchivo: 'solicitud_firmada.pdf',
        contentType: 'application/pdf',
        tamanoBytes: 102400,
        hashSha256: hash,
      },
    ],
  });

  // 1. Catálogo devuelve solo APROBADO
  it('1. catálogo devuelve solo APROBADO (las 18 entradas aprobadas)', async () => {
    const res = await request(app).get('/api/v1/tramites/tupa');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(18);

    for (const item of res.body) {
      expect(item.estadoValidacion).toBe('APROBADO');
      expect(item.estado).toBe('APROBADO');
      expect(item.denominacion).toContain('Procedimiento Administrativo TUPA N°');
      // No debe inventar campos prohibidos
      expect(item.plazo).toBeUndefined();
      expect(item.silencioAdministrativo).toBeUndefined();
      expect(item.baseLegal).toBeUndefined();
    }
  });

  // 2. PENDIENTE_VALIDACION no aparece
  it('2. PENDIENTE_VALIDACION y RECHAZADO no aparecen en el catálogo', async () => {
    const res = await request(app).get('/api/v1/tramites/tupa');
    expect(res.status).toBe(200);

    const ids = res.body.map((item: any) => item.registroVersionId);
    expect(ids).not.toContain(versionPendienteId);
    expect(ids).not.toContain(versionRechazadaId);

    const estados = res.body.map((item: any) => item.estadoValidacion);
    expect(estados).not.toContain('PENDIENTE_VALIDACION');
    expect(estados).not.toContain('RECHAZADO');
  });

  // 3. registroVersionId es UUID
  it('3. registroVersionId es UUID canónico en todos los registros devueltos', async () => {
    const res = await request(app).get('/api/v1/tramites/tupa');
    expect(res.status).toBe(200);

    for (const item of res.body) {
      expect(typeof item.registroVersionId).toBe('string');
      expect(item.registroVersionId).toMatch(REGEX_UUID);
      // id e id_tipo_tramite de compatibilidad también coinciden
      expect(item.id).toBe(item.registroVersionId);
      expect(item.id_tipo_tramite).toBe(item.registroVersionId);
    }
  });

  // 4. TUPA válido permite radicación
  it('4. TUPA válido permite radicación virtual exitosa (HTTP 201)', async () => {
    const versionValida = versionesAprobadasIds[0];
    const hash = 'a'.repeat(64);

    const res = await request(app)
      .post('/api/v1/tramites/radicacion-virtual')
      .send(payloadRadicacion(hash, versionValida));

    expect(res.status).toBe(201);
    expect(res.body.expedienteId).toMatch(REGEX_UUID);
    expect(res.body.cut).toMatch(REGEX_CUT);
    expect(res.body.registroVersionId).toBe(versionValida);
    expect(res.body.cargoDigital).toBeDefined();
    expect(res.body.cargoDigital.codigo).toMatch(/^CARGO-/);
  });

  // 5. Se crea expediente_tupa_vinculo
  it('5. se crea expediente_tupa_vinculo con expediente_id y registro_version_id reales', async () => {
    const versionValida = versionesAprobadasIds[1];
    const hash = 'b'.repeat(64);

    const res = await request(app)
      .post('/api/v1/tramites/radicacion-virtual')
      .send(payloadRadicacion(hash, versionValida));

    expect(res.status).toBe(201);
    const expedienteId = res.body.expedienteId;

    const vinculo = await testPool.query<{
      vinculo_id: string;
      expediente_id: string;
      registro_version_id: string;
    }>(
      `SELECT vinculo_id, expediente_id, registro_version_id
         FROM sigd_doc.expediente_tupa_vinculo
        WHERE expediente_id = $1::uuid`,
      [expedienteId],
    );

    expect(vinculo.rows.length).toBe(1);
    expect(vinculo.rows[0].expediente_id).toBe(expedienteId);
    expect(vinculo.rows[0].registro_version_id).toBe(versionValida);
  });

  // 6. UUID inexistente no crea expediente parcial
  it('6. UUID inexistente no crea expediente parcial (404 y rollback total)', async () => {
    const uuidFantasma = randomUUID();
    const hash = 'c'.repeat(64);

    const cuentaAntes = await testPool.query<{ n: string }>('SELECT count(*)::text as n FROM sigd_tra.expediente');

    const res = await request(app)
      .post('/api/v1/tramites/radicacion-virtual')
      .send(payloadRadicacion(hash, uuidFantasma));

    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body.status).toBe(404);

    const cuentaDespues = await testPool.query<{ n: string }>('SELECT count(*)::text as n FROM sigd_tra.expediente');
    expect(cuentaDespues.rows[0].n).toBe(cuentaAntes.rows[0].n);
  });

  // 7. TUPA no aprobado se rechaza
  it('7. TUPA no aprobado (PENDIENTE_VALIDACION o RECHAZADO) se rechaza con error de negocio', async () => {
    const hash1 = 'd'.repeat(64);
    const resPend = await request(app)
      .post('/api/v1/tramites/radicacion-virtual')
      .send(payloadRadicacion(hash1, versionPendienteId));

    expect(resPend.status).toBe(409);
    expect(resPend.body.code).toBe('VERSION_TUPA_NO_APROBADA');

    const hash2 = 'e'.repeat(64);
    const resRech = await request(app)
      .post('/api/v1/tramites/radicacion-virtual')
      .send(payloadRadicacion(hash2, versionRechazadaId));

    expect(resRech.status).toBe(409);
    expect(resRech.body.code).toBe('VERSION_TUPA_NO_APROBADA');
  });

  // 8. Flujo libre sigue funcionando
  it('8. flujo libre sigue funcionando: sin registroVersionId crea expediente normalmente sin vínculo TUPA', async () => {
    const hash = 'f'.repeat(64);
    const res = await request(app)
      .post('/api/v1/tramites/radicacion-virtual')
      .send(payloadRadicacion(hash, null));

    expect(res.status).toBe(201);
    const expedienteId = res.body.expedienteId;
    expect(expedienteId).toMatch(REGEX_UUID);
    expect(res.body.registroVersionId).toBeNull();

    // Comprobar que en la BD el expediente existe pero NO tiene vinculo TUPA
    const expDb = await testPool.query('SELECT expediente_id FROM sigd_tra.expediente WHERE expediente_id = $1::uuid', [expedienteId]);
    expect(expDb.rows.length).toBe(1);

    const vinculo = await testPool.query('SELECT vinculo_id FROM sigd_doc.expediente_tupa_vinculo WHERE expediente_id = $1::uuid', [expedienteId]);
    expect(vinculo.rows.length).toBe(0);
  });

  // 9. Detalle con TUPA devuelve contexto
  it('9. detalle con TUPA devuelve contexto TUPA poblado', async () => {
    const versionValida = versionesAprobadasIds[2];
    const hash = '1'.repeat(64);

    const rad = await request(app)
      .post('/api/v1/tramites/radicacion-virtual')
      .send(payloadRadicacion(hash, versionValida));
    expect(rad.status).toBe(201);
    const expedienteId = rad.body.expedienteId;

    // Consulta de detalle completo
    const resDetalle = await request(app).get(`/api/v1/tramites/expedientes/${expedienteId}`);
    expect(resDetalle.status).toBe(200);
    expect(resDetalle.body.expedienteId).toBe(expedienteId);
    expect(resDetalle.body.tupa).toBeDefined();
    expect(resDetalle.body.tupa.registroVersionId).toBe(versionValida);
    expect(resDetalle.body.tupa.denominacion).toContain('Procedimiento Administrativo TUPA N° 3');
    expect(resDetalle.body.tupa.codigo).toBe('TUPA-2026-003');

    // Endpoint específico de contexto TUPA
    const resContexto = await request(app).get(`/api/v1/tramites/expedientes/${expedienteId}/tupa`);
    expect(resContexto.status).toBe(200);
    expect(resContexto.body.tupa).toBeDefined();
    expect(resContexto.body.tupa.registroVersionId).toBe(versionValida);
  });

  // 10. Detalle sin TUPA devuelve tupa:null
  it('10. detalle sin TUPA devuelve tupa:null sin generar error', async () => {
    const hash = '2'.repeat(64);
    const rad = await request(app)
      .post('/api/v1/tramites/radicacion-virtual')
      .send(payloadRadicacion(hash, null));
    expect(rad.status).toBe(201);
    const expedienteId = rad.body.expedienteId;

    const resDetalle = await request(app).get(`/api/v1/tramites/expedientes/${expedienteId}`);
    expect(resDetalle.status).toBe(200);
    expect(resDetalle.body.tupa).toBeNull();

    const resContexto = await request(app).get(`/api/v1/tramites/expedientes/${expedienteId}/tupa`);
    expect(resContexto.status).toBe(200);
    expect(resContexto.body.tupa).toBeNull();
  });

  // 11. CUT sigue siendo CUT
  it('11. CUT sigue siendo CUT con máscara canónica EXP-YYYY-XXXXXX', async () => {
    const hash = '3'.repeat(64);
    const rad = await request(app)
      .post('/api/v1/tramites/radicacion-virtual')
      .send(payloadRadicacion(hash, versionesAprobadasIds[4]));

    expect(rad.status).toBe(201);
    expect(rad.body.cut).toMatch(REGEX_CUT);

    const anioActual = new Date().getFullYear();
    expect(rad.body.cut.startsWith(`EXP-${anioActual}-`)).toBe(true);
  });

  // 12. No se convierte UUID a número
  it('12. no se convierte UUID a número: formatos inválidos o numéricos son rechazados con 400', async () => {
    const hash = '4'.repeat(64);

    // Enviar número en lugar de UUID para registroVersionId
    const resNumero = await request(app)
      .post('/api/v1/tramites/radicacion-virtual')
      .send({ ...payloadRadicacion(hash, null), registroVersionId: 12345 });
    expect(resNumero.status).toBe(400);

    // Enviar string no UUID
    const resInvalido = await request(app)
      .post('/api/v1/tramites/radicacion-virtual')
      .send({ ...payloadRadicacion(hash, null), registroVersionId: 'no-es-un-uuid' });
    expect(resInvalido.status).toBe(400);

    // Enviar id no UUID al detalle
    const resDetalleInvalido = await request(app).get('/api/v1/tramites/expedientes/12345');
    expect(resDetalleInvalido.status).toBe(400);
  });

  // 13. No se rompen rutas existentes
  it('13. no se rompen rutas existentes: catálogo legado y ventanilla presencial operan', async () => {
    // Catálogo legado /tramites/tipos
    const resTipos = await request(app).get('/api/v1/tramites/tipos');
    expect(resTipos.status).toBe(200);
    expect(Array.isArray(resTipos.body)).toBe(true);

    // Alias /api/v1/tramite/radicacion
    const hashAlias = '5'.repeat(64);
    const resAlias = await request(app)
      .post('/api/v1/tramite/radicacion')
      .send(payloadRadicacion(hashAlias, versionesAprobadasIds[5]));
    expect(resAlias.status).toBe(201);
    expect(resAlias.body.cut).toMatch(REGEX_CUT);

    // Ventanilla presencial con TUPA
    const resVentanillaTupa = await request(app)
      .post('/api/v1/tramites/ventanilla-presencial')
      .send({
        dniSolicitante: '45872315',
        datosRemitente: 'Carlos Mendoza Ramos',
        asunto: 'Presentación física de expediente TUPA',
        foliosTotales: 5,
        tipoDocumentalId,
        registroVersionId: versionesAprobadasIds[6],
      });
    expect(resVentanillaTupa.status).toBe(201);
    expect(resVentanillaTupa.body.cut).toMatch(REGEX_CUT);
    expect(resVentanillaTupa.body.registroVersionId).toBe(versionesAprobadasIds[6]);

    // Ventanilla presencial flujo libre (sin TUPA)
    const resVentanillaLibre = await request(app)
      .post('/api/v1/tramites/ventanilla-presencial')
      .send({
        dniSolicitante: '45872315',
        datosRemitente: 'Carlos Mendoza Ramos',
        asunto: 'Presentación física de trámite libre',
        foliosTotales: 2,
        tipoDocumentalId,
      });
    expect(resVentanillaLibre.status).toBe(201);
    expect(resVentanillaLibre.body.cut).toMatch(REGEX_CUT);
    expect(resVentanillaLibre.body.registroVersionId).toBeNull();
  });
});
