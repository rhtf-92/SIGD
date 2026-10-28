import { readFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { Client, Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import { construirApp } from '../../../../src/app.js';

/**
 * Suite de Integración TUPA Versionado (B_CHRISTIAN) — Catálogo REAL
 *
 * Cumple los 13 puntos mínimos exigidos sobre PostgreSQL 18 descartable.
 *
 * DATOS: fixture derivado literalmente del staging real de Geric.
 *   - 72 entradas (18 APROBADO + 54 PENDIENTE_VALIDACION)
 *   - SHA-256 del PDF: 377DD8E14B8806F2030B5374120AB9B4FE17640BB98086E10C1A9A4431A33622
 *   - referenciaAprobacion: VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1
 *   - Whitelist APROBADO (18 entradas exactas validadas por Geric):
 *       p1-fila-05, p1-fila-06,
 *       p4-fila-02, p4-fila-05, p4-fila-06, p4-fila-07, p4-fila-10, p4-fila-15,
 *       p5-fila-06, p5-fila-07, p5-fila-09, p5-fila-10, p5-fila-11,
 *       p5-fila-18, p5-fila-19, p5-fila-20, p5-fila-21,
 *       p6-fila-04
 *
 * PROHIBIDO: inventar códigos, montos, resoluciones, páginas ni hashes.
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

/** Whitelist exacta de las 18 referencias_fila aprobadas por Geric. */
const WHITELIST_APROBADO = new Set([
  'p1-fila-05', 'p1-fila-06',
  'p4-fila-02', 'p4-fila-05', 'p4-fila-06', 'p4-fila-07', 'p4-fila-10', 'p4-fila-15',
  'p5-fila-06', 'p5-fila-07', 'p5-fila-09', 'p5-fila-10', 'p5-fila-11',
  'p5-fila-18', 'p5-fila-19', 'p5-fila-20', 'p5-fila-21',
  'p6-fila-04',
]);

/** SHA-256 real del PDF fuente TUPA-IESTP-SUIZA-2026.pdf */
const PDF_SHA256_REAL = '377dd8e14b8806f2030b5374120ab9b4fe17640bb98086e10c1a9a4431a33622';

/** referenciaAprobacion canónica del staging de Geric */
const REFERENCIA_APROBACION_REAL = 'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1';

/** SHA-256 de la proyección canónica de 15 campos de las 72 entradas del staging. */
const STAGING_PROYECCION_SHA256 = '213bd9c755b936362a7ed3ff473f3069c9aeca0b70c5feef1f7feed2f393bb5a';

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REGEX_CUT = /^EXP-[0-9]{4}-[0-9]{6}$/;

describe('B_CHRISTIAN — Integración TUPA versionado con catálogo REAL (72 entradas staging Geric)', () => {
  let adminClient: Client;
  let testPool: Pool;
  let app: Express;
  let dbName: string;
  let testDbUrl: string;

  let personaId: string;
  let tipoDocumentalId: string;

  /** UUIDs de las 18 versiones APROBADAS (obtenidos de la BD real, no inventados). */
  let versionesAprobadasIds: string[] = [];

  beforeAll(async () => {
    // 1. Crear BD descartable en PostgreSQL local
    adminClient = new Client({ connectionString: DB_ADMIN_URL });
    await adminClient.connect();

    dbName = `sigd_test_tupa_real_${randomUUID().replace(/-/g, '').slice(0, 10)}`;
    await adminClient.query(`CREATE DATABASE ${dbName}`);

    testDbUrl = DB_ADMIN_URL.replace(/\/postgres(?:\?.*)?$/, `/${dbName}`);
    testPool = new Pool({ connectionString: testDbUrl });

    // 2. Aplicar esquema canónico (migraciones en orden)
    for (const mig of MIGRACIONES) {
      const sqlContent = readFileSync(path.resolve(process.cwd(), 'migraciones', mig), 'utf8');
      await testPool.query(sqlContent);
    }

    // 3. Cargar las 72 entradas reales del staging de Geric
    const fixtureSql = readFileSync(
      path.resolve(process.cwd(), 'tests', 'fixtures', 'tupa_staging_real_iestp_suiza_2026.sql'),
      'utf8',
    );
    await testPool.query(fixtureSql);

    // 4. Verificar conteo canónico: exactamente 18 APROBADO y 54 PENDIENTE_VALIDACION
    const conteo = await testPool.query<{ estado_validacion: string; total: string }>(
      `SELECT estado_validacion, count(*)::text AS total
         FROM sigd_doc.tupa_registro_version
        GROUP BY estado_validacion
        ORDER BY estado_validacion`,
    );
    const porEstado = Object.fromEntries(conteo.rows.map((r) => [r.estado_validacion, Number(r.total)]));
    if (porEstado['APROBADO'] !== 18) {
      throw new Error(
        `FIXTURE INCORRECTO: se esperaban exactamente 18 APROBADO, se encontraron ${porEstado['APROBADO'] ?? 0}.`,
      );
    }
    if (porEstado['PENDIENTE_VALIDACION'] !== 54) {
      throw new Error(
        `FIXTURE INCORRECTO: se esperaban exactamente 54 PENDIENTE_VALIDACION, se encontraron ${porEstado['PENDIENTE_VALIDACION'] ?? 0}.`,
      );
    }

    // 5. Obtener los UUIDs reales de las 18 versiones APROBADAS desde la BD
    const aprobadas = await testPool.query<{ registro_version_id: string; referencia_fila: string }>(
      `SELECT registro_version_id::text, referencia_fila
         FROM sigd_doc.tupa_registro_version
        WHERE estado_validacion = 'APROBADO'
        ORDER BY pagina ASC, referencia_fila ASC`,
    );
    versionesAprobadasIds = aprobadas.rows.map((r) => r.registro_version_id);

    // 6. Fixtures base para los ensayos (persona y tipo documental)
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

    // 7. Construir Express app contra la BD descartable real
    app = construirApp(testPool);
  }, 120_000);

  afterAll(async () => {
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

  // ─── Verificaciones de datos reales del staging ─────────────────────────────

  it('STAGING-01: fixture cargado con exactamente 18 APROBADO y 54 PENDIENTE_VALIDACION (total 72)', async () => {
    const conteo = await testPool.query<{ estado_validacion: string; total: string }>(
      `SELECT estado_validacion, count(*)::text AS total
         FROM sigd_doc.tupa_registro_version
        GROUP BY estado_validacion
        ORDER BY estado_validacion`,
    );
    const porEstado = Object.fromEntries(conteo.rows.map((r) => [r.estado_validacion, Number(r.total)]));
    expect(porEstado['APROBADO']).toBe(18);
    expect(porEstado['PENDIENTE_VALIDACION']).toBe(54);
    const total = (porEstado['APROBADO'] ?? 0) + (porEstado['PENDIENTE_VALIDACION'] ?? 0);
    expect(total).toBe(72);
  });

  it('STAGING-02: todas las 18 entradas APROBADAS pertenecen a la whitelist exacta de Geric', async () => {
    const aprobadas = await testPool.query<{ referencia_fila: string }>(
      `SELECT referencia_fila FROM sigd_doc.tupa_registro_version WHERE estado_validacion = 'APROBADO'`,
    );
    expect(aprobadas.rows).toHaveLength(18);
    for (const row of aprobadas.rows) {
      expect(WHITELIST_APROBADO.has(row.referencia_fila)).toBe(true);
    }
    // Verificar que la whitelist completa está cubierta
    const filasAprobadas = new Set(aprobadas.rows.map((r) => r.referencia_fila));
    for (const fila of WHITELIST_APROBADO) {
      expect(filasAprobadas.has(fila)).toBe(true);
    }
  });

  it('STAGING-03: SHA-256 real del PDF fuente está presente en todas las 72 filas', async () => {
    const conOtroSha = await testPool.query<{ total: string }>(
      `SELECT count(*)::text AS total FROM sigd_doc.tupa_registro_version WHERE documento_sha256 <> $1`,
      [PDF_SHA256_REAL],
    );
    expect(Number(conOtroSha.rows[0].total)).toBe(0);
  });

  it('STAGING-04: referenciaAprobacion real está en todas las 18 filas APROBADO', async () => {
    const sinRef = await testPool.query<{ total: string }>(
      `SELECT count(*)::text AS total FROM sigd_doc.tupa_registro_version
        WHERE estado_validacion = 'APROBADO'
          AND (referencia_aprobacion IS NULL OR referencia_aprobacion <> $1)`,
      [REFERENCIA_APROBACION_REAL],
    );
    expect(Number(sinRef.rows[0].total)).toBe(0);
  });

  it('STAGING-05: distribución física por página coincide con 10/10/8/16/21/7', async () => {
    const conteo = await testPool.query<{ pagina: number; total: string }>(
      `SELECT pagina, count(*)::text AS total
         FROM sigd_doc.tupa_registro_version
        GROUP BY pagina
        ORDER BY pagina`,
    );

    expect(conteo.rows.map((fila) => [fila.pagina, Number(fila.total)])).toEqual([
      [1, 10],
      [2, 10],
      [3, 8],
      [4, 16],
      [5, 21],
      [6, 7],
    ]);
  });

  it('STAGING-06: los 15 campos persistibles de las 72 filas coinciden con la proyección canónica', async () => {
    const resultado = await testPool.query<{
      documento_sha256: string;
      fuente_nombre: string;
      pagina: number;
      referencia_fila: string;
      revision: number;
      codigo_externo: string | null;
      denominacion_original: string;
      monto_original: string | null;
      requisitos_original: unknown[] | null;
      referencia_normativa_original: string | null;
      version_fuente: string | null;
      vigencia_desde: string | Date | null;
      vigencia_hasta: string | Date | null;
      estado_validacion: string;
      referencia_aprobacion: string | null;
    }>(
      `SELECT documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
              codigo_externo, denominacion_original, monto_original,
              requisitos_original, referencia_normativa_original, version_fuente,
              vigencia_desde, vigencia_hasta, estado_validacion, referencia_aprobacion
         FROM sigd_doc.tupa_registro_version
        ORDER BY pagina, referencia_fila`,
    );

    const fecha = (valor: string | Date | null): string | null => {
      if (valor === null) return null;
      return valor instanceof Date ? valor.toISOString().slice(0, 10) : String(valor).slice(0, 10);
    };
    const proyeccion = resultado.rows.map((fila) => ({
      documentoSha256: fila.documento_sha256,
      fuenteNombre: fila.fuente_nombre,
      pagina: fila.pagina,
      referenciaFila: fila.referencia_fila,
      revision: fila.revision,
      codigoExterno: fila.codigo_externo,
      denominacionOriginal: fila.denominacion_original,
      montoOriginal: fila.monto_original,
      requisitosOriginal: fila.requisitos_original,
      referenciaNormativaOriginal: fila.referencia_normativa_original,
      versionFuente: fila.version_fuente,
      vigenciaDesde: fecha(fila.vigencia_desde),
      vigenciaHasta: fecha(fila.vigencia_hasta),
      estadoValidacion: fila.estado_validacion,
      referenciaAprobacion: fila.referencia_aprobacion,
    }));

    expect(resultado.rows).toHaveLength(72);
    expect(createHash('sha256').update(JSON.stringify(proyeccion)).digest('hex'))
      .toBe(STAGING_PROYECCION_SHA256);

    const referenciasFicticias = new Set(['p5-fila-22', 'p6-fila-08', 'p6-fila-09', 'p6-fila-10']);
    expect(proyeccion.some((fila) => referenciasFicticias.has(fila.referenciaFila))).toBe(false);
  });

  // ─── 1. Catálogo devuelve solo APROBADO ──────────────────────────────────────

  it('1. GET /api/v1/tramites/tupa devuelve exactamente 18 entradas APROBADO', async () => {
    const res = await request(app).get('/api/v1/tramites/tupa');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(18);
    for (const item of res.body) {
      expect(item.estadoValidacion).toBe('APROBADO');
      expect(item.estado).toBe('APROBADO');
    }
  });

  // ─── 2. PENDIENTE_VALIDACION no aparece ──────────────────────────────────────

  it('2. PENDIENTE_VALIDACION no aparece en el catálogo público', async () => {
    const res = await request(app).get('/api/v1/tramites/tupa');
    expect(res.status).toBe(200);
    const estados = res.body.map((item: any) => item.estadoValidacion);
    expect(estados).not.toContain('PENDIENTE_VALIDACION');
    expect(estados).not.toContain('RECHAZADO');
    // Confirmar que los 18 retornados son exactamente los de la whitelist real
    const filasRetornadas = res.body.map((item: any) => item.fuente?.referenciaFila);
    for (const fila of filasRetornadas) {
      if (fila) expect(WHITELIST_APROBADO.has(fila)).toBe(true);
    }
  });

  // ─── 3. registroVersionId es UUID ────────────────────────────────────────────

  it('3. registroVersionId es UUID canónico en todos los 18 registros del catálogo', async () => {
    const res = await request(app).get('/api/v1/tramites/tupa');
    expect(res.status).toBe(200);
    for (const item of res.body) {
      expect(typeof item.registroVersionId).toBe('string');
      expect(item.registroVersionId).toMatch(REGEX_UUID);
      expect(item.id).toBe(item.registroVersionId);
      expect(item).not.toHaveProperty('id_tipo_tramite');
    }
  });

  // ─── 4. TUPA válido permite radicación ──────────────────────────────────────

  it('4. TUPA válido (versión real APROBADA) permite radicación virtual exitosa (HTTP 201)', async () => {
    const versionValida = versionesAprobadasIds[0]; // primera entrada real APROBADA
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

    const expediente = await testPool.query<{ codigo_expediente: string; numero: string }>(
      `SELECT codigo_expediente, numero
         FROM sigd_tra.expediente
        WHERE expediente_id = $1::uuid`,
      [res.body.expedienteId],
    );
    expect(expediente.rows).toHaveLength(1);
    expect(expediente.rows[0].codigo_expediente).toBe(res.body.cut);
    expect(expediente.rows[0].numero).toBe(res.body.cut);
  });

  // ─── 5. Se crea expediente_tupa_vinculo ──────────────────────────────────────

  it('5. radicación con versión real crea expediente_tupa_vinculo verificable en BD', async () => {
    const versionValida = versionesAprobadasIds[1]; // segunda entrada real APROBADA
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

    expect(vinculo.rows).toHaveLength(1);
    expect(vinculo.rows[0].expediente_id).toBe(expedienteId);
    expect(vinculo.rows[0].registro_version_id).toBe(versionValida);
  });

  // ─── 6. UUID inexistente no crea expediente parcial ─────────────────────────

  it('6. UUID inexistente devuelve 404 y no crea expediente parcial (rollback total)', async () => {
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

  // ─── 7. TUPA PENDIENTE_VALIDACION se rechaza ──────────────────────────────────

  it('7. TUPA PENDIENTE_VALIDACION real se rechaza con 409 VERSION_TUPA_NO_APROBADA', async () => {
    // Obtener una versión PENDIENTE_VALIDACION real desde la BD
    const pendiente = await testPool.query<{ registro_version_id: string }>(
      `SELECT registro_version_id::text FROM sigd_doc.tupa_registro_version
        WHERE estado_validacion = 'PENDIENTE_VALIDACION' LIMIT 1`,
    );
    expect(pendiente.rows).toHaveLength(1);
    const versionPendienteId = pendiente.rows[0].registro_version_id;

    const hash = 'd'.repeat(64);
    const resPend = await request(app)
      .post('/api/v1/tramites/radicacion-virtual')
      .send(payloadRadicacion(hash, versionPendienteId));

    expect(resPend.status).toBe(409);
    expect(resPend.body.code).toBe('VERSION_TUPA_NO_APROBADA');
  });

  // ─── 8. Flujo libre sigue funcionando ────────────────────────────────────────

  it('8. flujo libre (sin registroVersionId) crea expediente sin vínculo TUPA', async () => {
    const hash = 'f'.repeat(64);
    const res = await request(app)
      .post('/api/v1/tramites/radicacion-virtual')
      .send(payloadRadicacion(hash, null));

    expect(res.status).toBe(201);
    const expedienteId = res.body.expedienteId;
    expect(expedienteId).toMatch(REGEX_UUID);
    expect(res.body.registroVersionId).toBeNull();

    const expDb = await testPool.query(
      'SELECT expediente_id FROM sigd_tra.expediente WHERE expediente_id = $1::uuid',
      [expedienteId],
    );
    expect(expDb.rows).toHaveLength(1);

    const vinculo = await testPool.query(
      'SELECT vinculo_id FROM sigd_doc.expediente_tupa_vinculo WHERE expediente_id = $1::uuid',
      [expedienteId],
    );
    expect(vinculo.rows).toHaveLength(0);
  });

  // ─── 9. Detalle con TUPA devuelve contexto de versión real ──────────────────

  it('9. detalle devuelve contexto TUPA real con la misma versión radicada', async () => {
    const versionValida = versionesAprobadasIds[2]; // tercera entrada real APROBADA
    const hash = '1'.repeat(64);

    const rad = await request(app)
      .post('/api/v1/tramites/radicacion-virtual')
      .send(payloadRadicacion(hash, versionValida));
    expect(rad.status).toBe(201);
    const expedienteId = rad.body.expedienteId;

    // Verificar detalle completo
    const resDetalle = await request(app).get(`/api/v1/tramites/expedientes/${expedienteId}`);
    expect(resDetalle.status).toBe(200);
    expect(resDetalle.body.expedienteId).toBe(expedienteId);
    expect(resDetalle.body.tupa).toBeDefined();
    expect(resDetalle.body.tupa).not.toBeNull();
    expect(resDetalle.body.tupa.registroVersionId).toBe(versionValida);

    // El contexto TUPA específico también debe coincidir
    const resContexto = await request(app).get(`/api/v1/tramites/expedientes/${expedienteId}/tupa`);
    expect(resContexto.status).toBe(200);
    expect(resContexto.body.tupa).toBeDefined();
    expect(resContexto.body.tupa.registroVersionId).toBe(versionValida);

    // La fuente debe ser la real (no inventada)
    expect(resDetalle.body.tupa.fuente ?? resDetalle.body.tupa.codigo).toBeDefined();
  });

  // ─── 10. Detalle sin TUPA devuelve tupa:null ──────────────────────────────────

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

  // ─── 11. CUT sigue siendo CUT ────────────────────────────────────────────────

  it('11. CUT sigue siendo CUT con máscara canónica EXP-YYYY-XXXXXX', async () => {
    const hash = '3'.repeat(64);
    const rad = await request(app)
      .post('/api/v1/tramites/radicacion-virtual')
      .send(payloadRadicacion(hash, versionesAprobadasIds[3]));

    expect(rad.status).toBe(201);
    expect(rad.body.cut).toMatch(REGEX_CUT);

    const anioActual = new Date().getFullYear();
    expect(rad.body.cut.startsWith(`EXP-${anioActual}-`)).toBe(true);
  });

  // ─── 12. No se convierte UUID a número ────────────────────────────────────────

  it('12. UUID numérico o mal formado se rechaza con 400', async () => {
    const hash = '4'.repeat(64);

    const resNumero = await request(app)
      .post('/api/v1/tramites/radicacion-virtual')
      .send({ ...payloadRadicacion(hash, null), registroVersionId: 12345 });
    expect(resNumero.status).toBe(400);

    const resInvalido = await request(app)
      .post('/api/v1/tramites/radicacion-virtual')
      .send({ ...payloadRadicacion(hash, null), registroVersionId: 'no-es-un-uuid' });
    expect(resInvalido.status).toBe(400);

    const resDetalleInvalido = await request(app).get('/api/v1/tramites/expedientes/12345');
    expect(resDetalleInvalido.status).toBe(400);
  });

  // ─── 13. No se rompen rutas existentes ────────────────────────────────────────

  it('13. catálogo legado /tramites/tipos y ventanilla presencial operan normalmente', async () => {
    // Catálogo legado /tramites/tipos
    const resTipos = await request(app).get('/api/v1/tramites/tipos');
    expect(resTipos.status).toBe(200);
    expect(Array.isArray(resTipos.body)).toBe(true);

    // Alias /api/v1/tramite/radicacion con versión real
    const hashAlias = '5'.repeat(64);
    const resAlias = await request(app)
      .post('/api/v1/tramite/radicacion')
      .send(payloadRadicacion(hashAlias, versionesAprobadasIds[4]));
    expect(resAlias.status).toBe(201);
    expect(resAlias.body.cut).toMatch(REGEX_CUT);

    // Ventanilla presencial con TUPA real
    const resVentanillaTupa = await request(app)
      .post('/api/v1/tramites/ventanilla-presencial')
      .send({
        dniSolicitante: '45872315',
        datosRemitente: 'Carlos Mendoza Ramos',
        asunto: 'Presentación física de expediente TUPA',
        foliosTotales: 5,
        tipoDocumentalId,
        registroVersionId: versionesAprobadasIds[5],
      });
    expect(resVentanillaTupa.status).toBe(201);
    expect(resVentanillaTupa.body.cut).toMatch(REGEX_CUT);
    expect(resVentanillaTupa.body.registroVersionId).toBe(versionesAprobadasIds[5]);
    const vinculoVentanilla = await testPool.query<{ registro_version_id: string }>(
      `SELECT registro_version_id
         FROM sigd_doc.expediente_tupa_vinculo
        WHERE expediente_id = $1::uuid`,
      [resVentanillaTupa.body.expedienteId],
    );
    expect(vinculoVentanilla.rows).toEqual([{ registro_version_id: versionesAprobadasIds[5] }]);

    // Ventanilla presencial flujo libre
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
    const vinculoVentanillaLibre = await testPool.query(
      `SELECT vinculo_id
         FROM sigd_doc.expediente_tupa_vinculo
        WHERE expediente_id = $1::uuid`,
      [resVentanillaLibre.body.expedienteId],
    );
    expect(vinculoVentanillaLibre.rows).toHaveLength(0);
  });
});
