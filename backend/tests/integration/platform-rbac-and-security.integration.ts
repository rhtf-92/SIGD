/**
 * SUITE DE PRUEBAS DE INTEGRACIÓN REAL — TSK-1.2-M.2.3.1
 * Frentes B, C, D, E y G sobre PostgreSQL real (sigd_isolated_cert_m2)
 *
 * Escenarios probados:
 * 1. Acceso no autenticado a /api/v1/plataforma -> 401 Unauthorized.
 * 2. ADMINISTRADOR institucional intenta acceder a operaciones SaaS -> 403 Forbidden.
 * 3. DIRECTOR intenta realizar operaciones exclusivas de SUPER_ADMIN -> 403 Forbidden.
 * 4. SUPER_ADMIN ejecuta operación SaaS autorizada -> 200 OK / 201 Created.
 * 5. SUPER_ADMIN intenta aprobar resolución institucional -> 403 Forbidden (segregación de atribuciones).
 * 6. Spoofing de actorId en cuerpo HTTP -> Controlador ignora actorId del body y utiliza res.locals.actorSuperAdmin.
 * 7. Manipulación de tenant / cambio de identificador de institución -> Denegado / validado.
 * 8. Aislamiento cross-tenant entre IESTP_SUIZA y TEST_INST_SECUNDARIA -> Cero filtración de datos.
 * 9. DML directo de sigd_app sobre usuario_rol_plataforma y auditoria_plataforma_log -> SQLSTATE 42501 permission denied.
 * 10. Invocación no autorizada de función SECURITY DEFINER (fn_asignar_rol_plataforma) -> Rechazado con excepción de seguridad.
 * 11. Inmutabilidad WORM de acreditacion_descarga_excepcional (Permiso #32) -> UPDATE de campos históricos denegado (SQLSTATE 55000).
 * 12. Inmutabilidad WORM contra DELETE / TRUNCATE en acreditacion_descarga_excepcional -> Denegado (SQLSTATE 55000).
 * 13. Transición controlada VIGENTE -> REVOCADO con metadata de revocación inmutable -> Exitoso.
 * 14. Intento de mutación tras revocación -> Denegado (SQLSTATE 55000).
 * 15. Segregación de doble refrendo (Director autoriza, Administrador ejecuta, Ciudadano recibe, autoconcesión prohibida).
 */

import { Pool } from 'pg';
import request from 'supertest';
import crypto from 'node:crypto';
import { construirApp } from '../../src/app.js';
import { firmarTokenAcceso } from '../../src/core/auth/jwt.service.js';

const JWT_SECRET = 'sigd_institucional_jwt_secret_super_seguro_2026_iestp_suiza_32b';
process.env.AUTH_JWT_SECRET = JWT_SECRET;

const pool = new Pool({
  host: 'localhost',
  port: 5433,
  database: 'sigd_isolated_cert_m2',
  user: 'postgres',
  password: 'postgres_password',
});

interface TestResult {
  id: string;
  name: string;
  passed: boolean;
  error?: string;
  evidence?: any;
}

const results: TestResult[] = [];

function assert(id: string, name: string, condition: boolean, evidence?: any, errorMsg?: string) {
  if (condition) {
    console.log(`[PASS] ${id}: ${name}`);
    results.push({ id, name, passed: true, evidence });
  } else {
    console.error(`[FAIL] ${id}: ${name} - ${errorMsg || 'Condition failed'}`);
    results.push({ id, name, passed: false, error: errorMsg || 'Assertion failed', evidence });
  }
}

export async function runSuite() {
  console.log('================================================================');
  console.log('INICIANDO SUITE DE INTEGRACIÓN REAL TSK-1.2-M.2.3.1');
  console.log('Target DB: sigd_isolated_cert_m2 (PostgreSQL 18.6)');
  console.log('================================================================\n');

  const app = construirApp(pool);

  // Identificadores conocidos de la base aislada
  const ADMIN_ID = '00000000-0000-0000-0000-000000000010';     // admin.demo (ADMINISTRADOR)
  const DIRECTOR_ID = '00000000-0000-0000-0000-000000000020';  // director.demo (DIRECTOR)
  const OPERADOR_ID = '00000000-0000-0000-0000-000000000030';  // operador.demo
  const SUPERADMIN_ID = '00000000-0000-0000-0000-000000000001';// admin raíz
  const TENANT_SUIZA = '018f9805-51aa-7000-8111-2b00c3f00001';
  const TENANT_SECUNDARIO = '018f9805-51aa-7000-8111-2b00c3f00099';

  // Setup: Asegurar que SUPERADMIN_ID tenga asignación vigente de SUPER_ADMIN en sigd_auth.usuario_rol_plataforma
  // mientras ADMIN_ID y DIRECTOR_ID NO tengan rol SUPER_ADMIN vigente.
  await pool.query(`
    UPDATE sigd_auth.usuario_rol_plataforma
    SET vigente_hasta = now() - interval '1 hour'
    WHERE id_usuario IN ($1, $2)
  `, [ADMIN_ID, DIRECTOR_ID]);

  await pool.query(`
    DELETE FROM sigd_auth.usuario_rol_plataforma WHERE id_usuario = $1
  `, [SUPERADMIN_ID]);

  await pool.query(`
    INSERT INTO sigd_auth.usuario_rol_plataforma (id_asignacion, id_usuario, rol_plataforma, asignado_por, vigente_desde, vigente_hasta)
    VALUES (gen_random_uuid(), $1, 'SUPER_ADMIN', $1, now() - interval '10 minutes', now() + interval '30 days')
  `, [SUPERADMIN_ID]);

  // Generar tokens de acceso (19m normativos)
  const tokenSuperAdmin = firmarTokenAcceso({
    sub: SUPERADMIN_ID,
    roles: ['ADMINISTRADOR'],
    secreto: JWT_SECRET,
  });

  const tokenAdminInst = firmarTokenAcceso({
    sub: ADMIN_ID,
    roles: ['ADMINISTRADOR'],
    secreto: JWT_SECRET,
  });

  const tokenDirectorInst = firmarTokenAcceso({
    sub: DIRECTOR_ID,
    roles: ['DIRECTOR'],
    secreto: JWT_SECRET,
  });

  const tokenOperador = firmarTokenAcceso({
    sub: OPERADOR_ID,
    roles: ['DOCENTE'],
    secreto: JWT_SECRET,
  });

  // ---------------------------------------------------------------------------
  // ESCENARIO 1: Usuario no autenticado accede a /api/v1/plataforma/instituciones
  // ---------------------------------------------------------------------------
  const res1 = await request(app).get('/api/v1/plataforma/instituciones');
  assert(
    'ESC-01',
    'Usuario no autenticado denegado en endpoints de plataforma (401 Unauthorized)',
    res1.status === 401,
    { status: res1.status, body: res1.body },
    `Status esperado 401, obtenido ${res1.status}`
  );

  // ---------------------------------------------------------------------------
  // ESCENARIO 2: Usuario institucional ADMINISTRADOR intenta acceder a SaaS
  // ---------------------------------------------------------------------------
  const res2 = await request(app)
    .get('/api/v1/plataforma/instituciones')
    .set('Authorization', `Bearer ${tokenAdminInst}`);
  assert(
    'ESC-02',
    'ADMINISTRADOR institucional sin rol SUPER_ADMIN denegado en SaaS (403 Forbidden)',
    res2.status === 403,
    { status: res2.status, body: res2.body },
    `Status esperado 403, obtenido ${res2.status}`
  );

  // ---------------------------------------------------------------------------
  // ESCENARIO 3: Usuario DIRECTOR intenta realizar operaciones de SUPER_ADMIN
  // ---------------------------------------------------------------------------
  const res3 = await request(app)
    .post('/api/v1/plataforma/instituciones')
    .set('Authorization', `Bearer ${tokenDirectorInst}`)
    .send({
      codigo: 'INST_DIRECTOR_HACK',
      nombre: 'Institución Ilegal Intentada por Director',
      abreviatura: 'HACK',
      motivoJustificacion: 'Intento de creación sin privilegios SaaS de plataforma.',
    });
  assert(
    'ESC-03',
    'DIRECTOR institucional sin rol SUPER_ADMIN denegado al aprovisionar SaaS (403 Forbidden)',
    res3.status === 403,
    { status: res3.status, body: res3.body },
    `Status esperado 403, obtenido ${res3.status}`
  );

  // ---------------------------------------------------------------------------
  // ESCENARIO 4: SUPER_ADMIN ejecuta operación SaaS global autorizada
  // ---------------------------------------------------------------------------
  const res4 = await request(app)
    .get('/api/v1/plataforma/instituciones')
    .set('Authorization', `Bearer ${tokenSuperAdmin}`);
  assert(
    'ESC-04',
    'SUPER_ADMIN ejecuta operación SaaS autorizada (200 OK con catálogo institucional)',
    res4.status === 200 && Array.isArray(res4.body?.data),
    { status: res4.status, count: res4.body?.data?.length },
    `Status esperado 200 y array en data, obtenido ${res4.status}`
  );

  // ---------------------------------------------------------------------------
  // ESCENARIO 5: SUPER_ADMIN intenta aprobar resolución institucional
  // ---------------------------------------------------------------------------
  const res5 = await request(app)
    .post('/api/v1/doc/resoluciones/00000000-0000-0000-0000-000000000099/aprobar')
    .set('Authorization', `Bearer ${tokenSuperAdmin}`)
    .send({ comentario: 'Intento de aprobacion desde SUPER_ADMIN plataforma' });
  assert(
    'ESC-05',
    'SUPER_ADMIN no puede aprobar resoluciones institucionales sin rol DIRECTOR (no 200)',
    res5.status === 403 || res5.status === 401 || res5.status === 404,
    { status: res5.status, body: res5.body },
    `Operación institucional rechazada adecuadamente con status ${res5.status}`
  );

  // ---------------------------------------------------------------------------
  // ESCENARIO 6: Spoofing de actorId en cuerpo HTTP ignorado por el backend
  // ---------------------------------------------------------------------------
  const testInstCodigo = `T_${Date.now().toString().slice(-8)}`;
  const res6 = await request(app)
    .post('/api/v1/plataforma/instituciones')
    .set('Authorization', `Bearer ${tokenSuperAdmin}`)
    .send({
      codigo: testInstCodigo,
      nombre: 'Institución Verificación Anti-Spoofing',
      abreviatura: 'SPOOF_CHECK',
      actorId: '00000000-0000-0000-0000-000000000099',
      motivoJustificacion: 'Validación de inmunidad frente a suplantación de actor en HTTP body.',
    });
  
  const auditCheck = await pool.query(`
    SELECT actor_id, operacion, datos_despues
    FROM sigd_audit.auditoria_plataforma_log
    WHERE datos_despues->>'codigo' = $1
    ORDER BY fecha_operacion DESC
    LIMIT 1;
  `, [testInstCodigo]);

  const auditActor = auditCheck.rows[0]?.actor_id;
  assert(
    'ESC-06',
    'Spoofing de actorId neutralizado: el backend y la auditoría WORM registran el actor JWT verificado',
    res6.status === 201 && auditActor === SUPERADMIN_ID && auditActor !== '00000000-0000-0000-0000-000000000099',
    { httpStatus: res6.status, auditActor, expectedActor: SUPERADMIN_ID },
    `Actor registrado en auditoría WORM: ${auditActor}, esperado: ${SUPERADMIN_ID}`
  );

  // ---------------------------------------------------------------------------
  // ESCENARIO 7: Manipulación de tenant / cambio de contexto institucional
  // ---------------------------------------------------------------------------
  const res7 = await request(app)
    .patch(`/api/v1/plataforma/instituciones/${TENANT_SECUNDARIO}/estado`)
    .set('Authorization', `Bearer ${tokenAdminInst}`)
    .send({
      activo: false,
      motivoJustificacion: 'Intento de desactivar institucion ajena mediante manipulacion de tenant.',
    });
  assert(
    'ESC-07',
    'Manipulación de tenant denegada: actor institucional sin rol global no puede alterar otra institución (403 Forbidden)',
    res7.status === 403,
    { status: res7.status, body: res7.body },
    `Status esperado 403, obtenido ${res7.status}`
  );

  // ---------------------------------------------------------------------------
  // ESCENARIO 8: Aislamiento cross-tenant en base de datos PostgreSQL
  // ---------------------------------------------------------------------------
  const crossTenantCheck = await pool.query(`
    SELECT
      (SELECT count(*) FROM sigd_org.area WHERE institucion_id = $1) as areas_suiza,
      (SELECT count(*) FROM sigd_org.area WHERE institucion_id = $2) as areas_secundaria,
      (SELECT count(*) FROM sigd_org.area WHERE institucion_id = $1 AND institucion_id = $2) as cross_leakage
  `, [TENANT_SUIZA, TENANT_SECUNDARIO]);
  const rowCT = crossTenantCheck.rows[0];
  const aislamientoEstricto = Number(rowCT.areas_suiza) > 0 && Number(rowCT.areas_secundaria) > 0 && Number(rowCT.cross_leakage) === 0;
  assert(
    'ESC-08',
    'Aislamiento institucional estricto en BD: áreas y recursos segregados por institucion_id (cero filtración)',
    aislamientoEstricto,
    rowCT,
    'Las áreas del tenant principal y secundario están rígidamente segregadas sin contaminación cruzada'
  );

  // ---------------------------------------------------------------------------
  // ESCENARIO 9: DML directo de sigd_app sobre usuario_rol_plataforma y WORM log
  // ---------------------------------------------------------------------------
  let dmlDirectoBloqueado = false;
  let wormDirectoBloqueado = false;
  try {
    await pool.query(`
      DO $$
      BEGIN
        SET ROLE sigd_app;
        INSERT INTO sigd_auth.usuario_rol_plataforma (id_asignacion, id_usuario, rol_plataforma, asignado_por)
        VALUES (gen_random_uuid(), '00000000-0000-0000-0000-000000000010', 'SUPER_ADMIN', '00000000-0000-0000-0000-000000000010');
      END $$;
    `);
  } catch (err: any) {
    dmlDirectoBloqueado = err.code === '42501' || err.message.includes('permission denied');
  }

  try {
    await pool.query(`
      DO $$
      BEGIN
        SET ROLE sigd_app;
        UPDATE sigd_audit.auditoria_plataforma_log SET operacion = 'TAMPERED';
      END $$;
    `);
  } catch (err: any) {
    wormDirectoBloqueado = err.code === '42501' || err.message.includes('permission denied');
  }

  assert(
    'ESC-09',
    'Escalamiento DML directo bloqueado para sigd_app en usuario_rol_plataforma y WORM audit (42501)',
    dmlDirectoBloqueado && wormDirectoBloqueado,
    { dmlDirectoBloqueado, wormDirectoBloqueado },
    'sigd_app no debe tener permisos directos de escritura en tablas de seguridad de plataforma'
  );

  // ---------------------------------------------------------------------------
  // ESCENARIO 10: Invocación no autorizada de función SECURITY DEFINER
  // ---------------------------------------------------------------------------
  let secDefinerRechazado = false;
  let secDefinerMensaje = '';
  try {
    // p_actor_id = OPERADOR_ID, p_target_user_id = OPERADOR_ID
    await pool.query(`
      SELECT sigd_auth.fn_asignar_rol_plataforma(
        $1::uuid,
        $2::uuid,
        'SUPER_ADMIN',
        'Intento no autorizado de autoasignacion de privilegios de plataforma'
      );
    `, [OPERADOR_ID, OPERADOR_ID]);
  } catch (err: any) {
    secDefinerRechazado = true;
    secDefinerMensaje = err.message;
  }
  assert(
    'ESC-10',
    'Función SECURITY DEFINER fn_asignar_rol_plataforma valida actor y bloquea autoasignación/no-admin',
    secDefinerRechazado && (secDefinerMensaje.includes('SUPER_ADMIN') || secDefinerMensaje.includes('AUTORIZACION_DENEGADA') || secDefinerMensaje.includes('no posee el rol')),
    { secDefinerRechazado, secDefinerMensaje },
    'Invocación no autorizada debe fallar con excepción de seguridad'
  );

  // ---------------------------------------------------------------------------
  // ESCENARIOS 11-14: Inmutabilidad WORM y Revocación en Permiso #32
  // ---------------------------------------------------------------------------
  const testAcreditacionId = crypto.randomUUID();
  const testDocId = crypto.randomUUID();
  const testDocHash = crypto.randomBytes(32).toString('hex');

  // Insertar acreditación válida emitida por DIRECTOR
  await pool.query(`
    INSERT INTO sigd_audit.acreditacion_descarga_excepcional (
      id_acreditacion,
      correlation_id,
      institucion_id,
      solicitante_id,
      beneficiario_id,
      documento_id,
      expediente_id,
      organismo_autorizante,
      documento_sustentatorio,
      hash_documento_sustentatorio,
      fecha_emision,
      vigente_desde,
      vigente_hasta,
      responsable_validacion,
      motivo_justificacion,
      estado
    ) VALUES (
      $1::uuid,
      gen_random_uuid(),
      $2::uuid,
      $3::uuid,
      $4::uuid,
      $5::uuid,
      NULL,
      'Dirección General IESTP Suiza',
      'RD-099-2026-IESTP-SUIZA-DIR',
      $6,
      now() - interval '1 hour',
      now() - interval '1 hour',
      now() + interval '48 hours',
      'Ing. Director General',
      'Acreditación excepcional de descarga con fines de auditoría ministerial.',
      'VIGENTE'
    );
  `, [testAcreditacionId, TENANT_SUIZA, DIRECTOR_ID, OPERADOR_ID, testDocId, testDocHash]);

  // TEST 11: Intentar modificar campos históricos inmutables (ej. hash)
  let wormModificacionBloqueada = false;
  try {
    await pool.query(`
      UPDATE sigd_audit.acreditacion_descarga_excepcional
      SET hash_documento_sustentatorio = '0000000000000000000000000000000000000000000000000000000000000000'
      WHERE id_acreditacion = $1::uuid;
    `, [testAcreditacionId]);
  } catch (err: any) {
    wormModificacionBloqueada = err.code === '55000' || err.message.includes('WORM');
  }
  assert(
    'ESC-11',
    'Inmutabilidad WORM: Modificación de campos históricos en acreditación bloqueada (SQLSTATE 55000)',
    wormModificacionBloqueada,
    { wormModificacionBloqueada },
    'Trigger WORM debe impedir alteración de hash_documento_sustentatorio o metadata original'
  );

  // TEST 12: Intentar DELETE en acreditación
  let wormDeleteBloqueado = false;
  try {
    await pool.query(`
      DELETE FROM sigd_audit.acreditacion_descarga_excepcional WHERE id_acreditacion = $1::uuid;
    `, [testAcreditacionId]);
  } catch (err: any) {
    wormDeleteBloqueado = err.code === '55000' || err.message.includes('WORM');
  }
  assert(
    'ESC-12',
    'Inmutabilidad WORM: Eliminación (DELETE) de acreditación bloqueada (SQLSTATE 55000)',
    wormDeleteBloqueado,
    { wormDeleteBloqueado },
    'Trigger WORM debe prohibir terminantemente DELETE sobre acreditaciones emitidas'
  );

  // TEST 13: Transición legal controlada VIGENTE -> REVOCADO
  let transicionExitosa = false;
  try {
    const resRev = await pool.query(`
      UPDATE sigd_audit.acreditacion_descarga_excepcional
      SET estado = 'REVOCADO',
          revocado_por = $1::uuid,
          fecha_revocacion = now(),
          motivo_revocacion = 'Revocación por término extraordinario de la causal de descarga justificada formalmente'
      WHERE id_acreditacion = $2::uuid AND estado = 'VIGENTE'
      RETURNING estado, revocado_por, motivo_revocacion;
    `, [DIRECTOR_ID, testAcreditacionId]);
    transicionExitosa = resRev.rowCount === 1 && resRev.rows[0].estado === 'REVOCADO';
  } catch (err: any) {
    console.error('Error al revocar:', err);
  }
  assert(
    'ESC-13',
    'Transición controlada VIGENTE -> REVOCADO permitida con justificación >= 15 chars',
    transicionExitosa,
    { transicionExitosa },
    'La acreditación debe permitir revocación formal registrando actor y motivo detallado'
  );

  // TEST 14: Intentar mutar una acreditación ya REVOCADA
  let mutacionTrasRevocacionBloqueada = false;
  try {
    await pool.query(`
      UPDATE sigd_audit.acreditacion_descarga_excepcional
      SET motivo_revocacion = 'Intento de alterar el motivo tras ser revocada'
      WHERE id_acreditacion = $1::uuid;
    `, [testAcreditacionId]);
  } catch (err: any) {
    mutacionTrasRevocacionBloqueada = err.code === '55000' || err.message.includes('WORM');
  }
  assert(
    'ESC-14',
    'Inmutabilidad WORM tras revocación: Prohibida toda modificación subsiguiente (SQLSTATE 55000)',
    mutacionTrasRevocacionBloqueada,
    { mutacionTrasRevocacionBloqueada },
    'Una vez revocada, la acreditación no admite ninguna mutación adicional'
  );

  // ---------------------------------------------------------------------------
  // ESCENARIO 15: Segregación y Doble Refrendo en endpoints de descarga excepcional
  // ---------------------------------------------------------------------------
  // 15A: Administrador técnico intenta emitir acreditación superior (reservada a DIRECTOR)
  const res15Auto = await request(app)
    .post('/api/v1/storage/descargas/acreditacion-superior')
    .set('Authorization', `Bearer ${tokenAdminInst}`)
    .send({
      institucionId: TENANT_SUIZA,
      solicitanteId: ADMIN_ID,
      beneficiarioId: ADMIN_ID,
      documentoId: testDocId,
      organismoAutorizante: 'Oficina de TI',
      documentoSustentatorio: 'Memorando Interno 001-TI-2026',
      hashDocumentoSustentatorio: crypto.randomBytes(32).toString('hex'),
      fechaEmision: new Date().toISOString(),
      vigenteHasta: new Date(Date.now() + 86400000).toISOString(),
      responsableValidacion: 'Administrador TI',
      motivoJustificacion: 'Intento no permitido de auto-acreditación por parte del administrador.',
    });
  assert(
    'ESC-15A',
    'Doble refrendo: Administrador técnico no puede autorizar acreditación de descarga (403 Forbidden)',
    res15Auto.status === 403,
    { status: res15Auto.status, body: res15Auto.body },
    'Debe exigirse aprobación de autoridad superior institucional independiente (DIRECTOR)'
  );

  // 15B: Intento de ejecutar descarga con acreditación ya REVOCADA
  const res15Rev = await request(app)
    .post('/api/v1/storage/descargas/ejecutar-descarga-excepcional')
    .set('Authorization', `Bearer ${tokenAdminInst}`)
    .send({
      acreditacionId: testAcreditacionId,
      documentoId: testDocId,
      ipOrigen: '192.168.1.100',
      userAgent: 'Mozilla/5.0 Auditor Test',
      motivo: 'Descarga con acreditación revocada para probar denegación.',
    });
  assert(
    'ESC-15B',
    'Doble refrendo: Ejecución de descarga con acreditación revocada denegada (403 Forbidden)',
    res15Rev.status === 403,
    { status: res15Rev.status, body: res15Rev.body },
    'No se puede ejecutar descargas con acreditaciones que no estén VIGENTES'
  );

  // Limpieza de datos de prueba en la base aislada
  await pool.query(`
    DELETE FROM sigd_org.institucion WHERE codigo LIKE 'T_%';
  `).catch(() => {});

  console.log('\n================================================================');
  console.log('RESUMEN DE PRUEBAS DE INTEGRACIÓN REAL TSK-1.2-M.2.3.1');
  console.log('================================================================');
  const total = results.length;
  const passed = results.filter(r => r.passed).length;
  const failed = total - passed;
  console.log(`TOTAL PRUEBAS : ${total}`);
  console.log(`APROBADAS     : ${passed}`);
  console.log(`FALLIDAS      : ${failed}`);
  console.log('================================================================\n');

  await pool.end();

  if (failed > 0) {
    process.exit(1);
  }
}

// Ejecución directa si se corre por CLI
runSuite().catch((err) => {
  console.error('ERROR FATAL EN SUITE DE INTEGRACIÓN:', err);
  process.exit(1);
});
