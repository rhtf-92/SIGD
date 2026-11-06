import 'dotenv/config';
import http from 'node:http';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { construirApp } from '../src/app.js';
import { BusSse } from '../src/modules/corelink/sseStream.service.js';

const PG_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres_password@localhost:5433/sigd_prueba';

async function verifyViolations(): Promise<void> {
  console.log('=== EMPIRICAL VERIFICATION OF INTEGRITY VIOLATIONS ===');
  const pool = new Pool({ connectionString: PG_URL });

  const busSse = new BusSse();
  const app = construirApp(pool, { busSse });
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address() as any;
  const baseUrl = `http://127.0.0.1:${addr.port}`;
  console.log(`Test server running at ${baseUrl}`);

  try {
    // -------------------------------------------------------------------------
    // VIOLATION 1: Facade on PUT /api/v1/admin/roles-permisos
    // -------------------------------------------------------------------------
    console.log('\n--- TESTING VIOLATION 1: Facade on PUT /api/v1/admin/roles-permisos ---');
    const rolRes = await pool.query(`SELECT rol_id, codigo FROM sigd_org.rol_sistema LIMIT 1`);
    const rol = rolRes.rows[0];
    console.log(`Testing with rol: ${rol.codigo} (${rol.rol_id})`);

    const countBefore = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM sigd_org.rol_permiso WHERE rol_id = $1`,
      [rol.rol_id]
    );
    console.log(`Permissions count in DB before PUT: ${countBefore.rows[0].cnt}`);

    // Call PUT /api/v1/admin/roles-permisos
    const putRes = await fetch(`${baseUrl}/api/v1/admin/roles-permisos`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rolId: rol.rol_id,
        permisos: ['PERMISO_FICTICIO_E2E_1', 'PERMISO_FICTICIO_E2E_2'],
      }),
    });
    const putBody = await putRes.json() as any;
    console.log(`PUT response status: ${putRes.status}, body:`, putBody);

    const countAfter = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM sigd_org.rol_permiso WHERE rol_id = $1`,
      [rol.rol_id]
    );
    console.log(`Permissions count in DB after PUT: ${countAfter.rows[0].cnt}`);

    if (putBody.actualizado === true && countBefore.rows[0].cnt === countAfter.rows[0].cnt) {
      console.log('>>> [CONFIRMED INTEGRITY VIOLATION 1] PUT /api/v1/admin/roles-permisos returned { actualizado: true } but ZERO changes were made to PostgreSQL table sigd_org.rol_permiso (Facade Implementation).');
    }

    // -------------------------------------------------------------------------
    // VIOLATION 2: Master Key Password Bypass in auth.router.ts
    // -------------------------------------------------------------------------
    console.log('\n--- TESTING VIOLATION 2: Master Key Bypass in POST /api/v1/auth/login ---');
    // Find or create a user with a distinct password
    const testDni = '77' + Math.floor(100000 + Math.random() * 900000).toString();
    const realPassword = 'SecretRealPassword_999!';
    
    // Register citizen with realPassword
    const regRes = await fetch(`${baseUrl}/api/v1/auth/registro-ciudadano`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipoPersona: 'NATURAL',
        dni: testDni,
        nombres: 'Test',
        apellidoPaterno: 'Bypass',
        apellidoMaterno: 'Audit',
        correo: `bypass_${testDni}@iestpsuiza.edu.pe`,
        celular: '961000000',
        ubigeoDistrito: '250101',
        direccion: 'Av. Test',
        password: realPassword,
        consentimientoDatos: true,
        aceptaNotificaciones: true,
      }),
    });
    console.log(`User registration status: ${regRes.status}`);

    // Now attempt login with BYPASS password 'admin'
    const bypassRes = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identificador: testDni,
        password: 'admin', // Hardcoded bypass!
      }),
    });

    console.log(`Login attempt with bypass password 'admin' status: ${bypassRes.status}`);
    const bypassBody = await bypassRes.json() as any;
    console.log(`Login response accessToken issued: ${Boolean(bypassBody.accessToken || bypassBody.token)}`);

    if (bypassRes.status === 200 && (bypassBody.accessToken || bypassBody.token)) {
      console.log('>>> [CONFIRMED INTEGRITY VIOLATION 2] User account was authenticated and issued a JWT using hardcoded backdoor password "admin" instead of their real password.');
    }

  } finally {
    server.close();
    await pool.end();
  }
}

verifyViolations().catch((err) => {
  console.error('Error during empirical test:', err);
  process.exit(1);
});
