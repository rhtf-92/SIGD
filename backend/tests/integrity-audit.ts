import 'dotenv/config';
import http from 'node:http';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { construirApp } from '../src/app.js';
import { BusSse } from '../src/modules/corelink/sseStream.service.js';
import { TablasMaestrasService } from '../src/domains/organicore/tablasMaestras.service.js';

const PG_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres_password@localhost:5433/sigd_prueba';

async function forensicAudit(): Promise<void> {
  console.log('=== SIGD FORENSIC INTEGRITY AUDIT: MILESTONE 1 ===');
  console.log(`Connecting to PostgreSQL at ${PG_URL}...`);
  const pool = new Pool({ connectionString: PG_URL });

  // 1. Verify DB connection
  const client = await pool.connect();
  const dbVer = await client.query('SELECT version();');
  console.log(`[PASS] PostgreSQL Connected: ${dbVer.rows[0].version}`);
  client.release();

  // 2. Start Express app for HTTP test
  const busSse = new BusSse();
  const app = construirApp(pool, { busSse });
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address() as any;
  const baseUrl = `http://127.0.0.1:${addr.port}`;
  console.log(`[PASS] Ephemeral Test Server running on ${baseUrl}`);

  try {
    // -------------------------------------------------------------------------
    // CHECK 1: POST /api/v1/admin/tipos-documento persistence and WORM audit
    // -------------------------------------------------------------------------
    console.log('\n--- CHECK 1: POST /api/v1/admin/tipos-documento Persistence & WORM ---');
    const uniqueSuffix = Date.now().toString(36).toUpperCase();
    const testCode = `AUDIT_${uniqueSuffix}`;
    const testName = `Tipo Doc Forensic Audit ${uniqueSuffix}`;
    const correlationId = crypto.randomUUID();

    const postRes = await fetch(`${baseUrl}/api/v1/admin/tipos-documento`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Correlation-ID': correlationId,
      },
      body: JSON.stringify({
        codigo: testCode,
        nombre: testName,
        extension: 'pdf',
        mimeType: 'application/pdf',
        tamanoMaximoMb: 20,
        exigeFirma: true,
        vigente: true,
      }),
    });

    console.log(`HTTP POST response status: ${postRes.status}`);
    assert.equal(postRes.status, 201, `Expected HTTP 201 Created, received ${postRes.status}`);
    const postBody = await postRes.json() as any;
    console.log(`HTTP POST response body:`, JSON.stringify(postBody));
    assert.equal(postBody.codigo, testCode);

    // Verify row directly in PostgreSQL table sigd_doc.tipo_documento
    const tipoRow = await pool.query(
      `SELECT tipo_documental_id, codigo, nombre, extension, mime_type, tamano_maximo_mb, exige_firma, vigente
       FROM sigd_doc.tipo_documento WHERE codigo = $1`,
      [testCode]
    );
    assert.equal(tipoRow.rowCount, 1, 'Row must exist in sigd_doc.tipo_documento');
    console.log(`[PASS] Row verified in sigd_doc.tipo_documento:`, tipoRow.rows[0]);

    // Verify WORM audit record in sigd_audit.bitacora_auditoria
    const auditRow = await pool.query(
      `SELECT id_auditoria, correlation_id, esquema, tabla, operacion, datos_despues, fecha_hora
       FROM sigd_audit.bitacora_auditoria
       WHERE correlation_id = $1 AND esquema = 'sigd_doc' AND tabla = 'tipo_documento'`,
      [correlationId]
    );
    assert.equal(auditRow.rowCount, 1, 'Audit row must exist in sigd_audit.bitacora_auditoria');
    console.log(`[PASS] WORM Audit row verified:`, auditRow.rows[0]);
    const idAuditoria = auditRow.rows[0].id_auditoria;

    // -------------------------------------------------------------------------
    // CHECK 2: WORM Immutability Invariant (SQLSTATE 23001)
    // -------------------------------------------------------------------------
    console.log('\n--- CHECK 2: WORM Immutability on sigd_audit.bitacora_auditoria ---');
    // Test UPDATE rejection
    let updateRejected = false;
    try {
      await pool.query(
        `UPDATE sigd_audit.bitacora_auditoria SET operacion = 'TAMPERED' WHERE id_auditoria = $1`,
        [idAuditoria]
      );
    } catch (err: any) {
      updateRejected = true;
      console.log(`UPDATE rejection SQLSTATE: ${err.code}, message: "${err.message}"`);
      assert.equal(err.code, '23001', `Expected SQLSTATE 23001, got ${err.code}`);
    }
    assert.ok(updateRejected, 'Direct UPDATE on bitacora_auditoria MUST be rejected');
    console.log(`[PASS] WORM UPDATE invariant enforced with SQLSTATE 23001`);

    // Test DELETE rejection
    let deleteRejected = false;
    try {
      await pool.query(
        `DELETE FROM sigd_audit.bitacora_auditoria WHERE id_auditoria = $1`,
        [idAuditoria]
      );
    } catch (err: any) {
      deleteRejected = true;
      console.log(`DELETE rejection SQLSTATE: ${err.code}, message: "${err.message}"`);
      assert.equal(err.code, '23001', `Expected SQLSTATE 23001, got ${err.code}`);
    }
    assert.ok(deleteRejected, 'Direct DELETE on bitacora_auditoria MUST be rejected');
    console.log(`[PASS] WORM DELETE invariant enforced with SQLSTATE 23001`);

    // Verify row is still intact
    const verifyRow = await pool.query(
      `SELECT id_auditoria, operacion FROM sigd_audit.bitacora_auditoria WHERE id_auditoria = $1`,
      [idAuditoria]
    );
    assert.equal(verifyRow.rowCount, 1, 'Audit record must remain intact');
    assert.equal(verifyRow.rows[0].operacion, 'INSERT', 'Operation must remain unaltered INSERT');
    console.log(`[PASS] Audit row confirmed untouched in database`);

    // -------------------------------------------------------------------------
    // CHECK 3: Resoluciones Proyectar HTTP Endpoint
    // -------------------------------------------------------------------------
    console.log('\n--- CHECK 3: Resoluciones Proyectar HTTP Endpoint ---');
    const expRow = await pool.query(`SELECT expediente_id FROM sigd_doc.expediente LIMIT 1`);
    assert.ok(expRow.rowCount && expRow.rowCount > 0, 'Expediente required');
    const expId = expRow.rows[0].expediente_id;

    const resHttp = await fetch(`${baseUrl}/api/v1/resoluciones/proyectar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expedienteId: expId,
        tipoResolucion: 'DIRECTORAL_ADMINISTRATIVA',
        visto: 'Visto para auditoria forense M1',
        considerandos: ['Considerando 1 de prueba', 'Considerando 2 de prueba'],
        articulos: [{ numero: 1, texto: 'Articulo primero' }],
        distribucion: ['Direccion'],
      }),
    });
    console.log(`POST /api/v1/resoluciones/proyectar status: ${resHttp.status}`);
    assert.equal(resHttp.status, 201, `Expected 201 Created, received ${resHttp.status}`);
    const resBody = await resHttp.json() as any;
    console.log(`Resolution created: id=${resBody.resolucionId}, draft=${resBody.numeroBorrador}`);

    // Verify in DB sigd_doc.resolucion
    const dbRes = await pool.query(
      `SELECT resolucion_id, numero_borrador, estado FROM sigd_doc.resolucion WHERE resolucion_id = $1`,
      [resBody.resolucionId]
    );
    assert.equal(dbRes.rowCount, 1, 'Resolucion must exist in sigd_doc.resolucion');
    assert.equal(dbRes.rows[0].estado, 'BORRADOR_PENDIENTE_FIRMA');
    console.log(`[PASS] Resolution verified in sigd_doc.resolucion:`, dbRes.rows[0]);

    // -------------------------------------------------------------------------
    // CHECK 4: Tablas Maestras 12/12 Catalogs
    // -------------------------------------------------------------------------
    console.log('\n--- CHECK 4: Tablas Maestras Catalogs Availability ---');
    const maestrasService = new TablasMaestrasService(pool);
    const maestras = await maestrasService.listarMaestras(true, true);
    console.log(`Total catalogs defined: ${maestras.total_catalogos}, available: ${maestras.catalogos_disponibles}`);
    assert.equal(maestras.total_catalogos, 12, 'Must have 12 catalogs');
    assert.equal(maestras.catalogos_disponibles, 12, 'All 12 catalogs must be available');
    for (const c of maestras.catalogos) {
      console.log(`  - Catalog '${c.clave}' (${c.esquema}.${c.tabla}): disponible=${c.disponible}, items=${c.total}`);
      assert.equal(c.disponible, true, `Catalog ${c.clave} must be disponible: true`);
    }
    console.log(`[PASS] All 12 catalogs are active and backed by real database tables`);

    console.log('\n======================================================================');
    console.log('>>> FORENSIC VERDICT: ALL INTEGRITY & PERSISTENCE CHECKS PASSED <<<');
    console.log('======================================================================');
  } finally {
    server.close();
    await pool.end();
  }
}

forensicAudit().catch((err) => {
  console.error('FORENSIC AUDIT FAILED:', err);
  process.exit(1);
});
