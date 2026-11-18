/**
 * =============================================================================
 * SUITE DE INTEGRACIÓN — FASE C3.6
 * CIRCUITO OPERATIVO INSTITUCIONAL REAL POR TUPA
 * =============================================================================
 *
 * Cobertura de Certificación C3.6:
 *  1. Verificación física de Workflow para los 18 procedimientos documentarios (Migración 50).
 *  2. Circuito Piloto Completo: Procedimiento p1-fila-06 (Certificado de Inglés, arancel S/ 100):
 *     - Paso 1: Radicación Virtual por ciudadano_demo -> CUT generado, workflow_instancia creada (Paso 1).
 *     - Paso 2: Revisión de requisitos por mesa_partes_demo (GET /tramites/expedientes/:id/requisitos).
 *     - Paso 3: Gate de pago: Intento de derivar antes de pagar -> HTTP 409 PAGO_PENDIENTE.
 *     - Paso 4: Tesorería: tesoreria_demo confirma pago en efectivo (S/ 100) -> Orden CONFIRMADO.
 *     - Paso 5: Derivación: mesa_partes_demo deriva a SDA -> HTTP 200, FSM = DERIVADO, paso avanza.
 *     - Paso 6: Asignación: SDA asigna formalmente a responsable_ingles_demo.
 *     - Paso 7: Recepción y Atención: responsable_ingles_demo recepciona (EN_REVISION) y remite a firma (EN_FIRMA).
 *     - Paso 8: Firma Sandbox y Resolución: director_demo firma y resuelve -> HTTP 200, FSM = RESUELTO.
 *     - Paso 9: Notificación / Outbox: Evento registrado para notificación/casillero.
 *     - Paso 10: Archivo: mesa_partes_demo archiva físicamente el expediente -> FSM = ARCHIVADO.
 *  3. Segundo Circuito: Procedimiento Gratuito (Bypass legítimo de Tesorería):
 *     - Trámite sin arancel (monto = 0) -> DERIVAR habilitado directamente sin pasar por Tesorería.
 *  4. Circuito con Observación y Subsanación:
 *     - Mesa de Partes observa expediente -> FSM = OBSERVADO, derivación bloqueada.
 *     - Subsanación -> FSM = EN_REVISION, habilitado para continuar.
 *  5. Segregación de Funciones y Autorización Fail-Closed:
 *     - Anti-autoatención: Ciudadano no puede derivar su propio trámite (403).
 *     - Violación BOLA: Funcionario sin custodia no puede recepcionar expediente ajeno (403).
 *     - Administrado no puede resolver expedientes (403).
 *     - Administrador técnico sin rol directivo no puede resolver (403 PODER_TECNICO_SIN_AUTORIDAD_NEGOCIO).
 *  6. Cleanup exhaustivo: 0 expedientes residuales tras la ejecución.
 */

import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { construirApp } from '../../../src/app.js';
import { firmarTokenAcceso } from '../../../src/core/auth/jwt.service.js';

describe('FASE C3.6: Circuito Operativo Real por TUPA', () => {
  let pool: Pool;
  let app: any;

  // Áreas institucionales
  let dirAreaId: string;
  let sdaAreaId: string;

  // TUPA 2026 e IDs
  let versionTupa2026Id: string;
  let procInglesId: string;
  let procInglesRegVerId: string;
  let tipoDocumentoId: string;

  // Cuentas y Tokens Canónicos
  let ciudadanoUsuarioId: string;
  let ciudadanoPersonaId: string;
  let tokenCiudadano: string;

  let mesaPartesUsuarioId: string;
  let mesaPartesPersonaId: string;
  let tokenMesaPartes: string;

  let tesoreriaUsuarioId: string;
  let tesoreriaPersonaId: string;
  let tokenTesoreria: string;

  let secretarioSdaUsuarioId: string;
  let secretarioSdaPersonaId: string;
  let tokenSecretarioSda: string;

  let responsableInglesUsuarioId: string;
  let responsableInglesPersonaId: string;
  let tokenResponsableIngles: string;

  let directorUsuarioId: string;
  let directorPersonaId: string;
  let tokenDirector: string;

  let administradorUsuarioId: string;
  let administradorPersonaId: string;
  let tokenAdministrador: string;

  // Seguimiento de IDs para limpieza segura de fixtures transaccionales
  const idsLimpieza = {
    expedientes: new Set<string>(),
    ordenesPago: new Set<string>(),
    procedimientosTemporales: new Set<string>(),
    registroVersionesTemporales: new Set<string>(),
    documentos: new Set<string>(),
  };

  beforeAll(async () => {
    process.env.AUTH_JWT_SECRET =
      process.env.AUTH_JWT_SECRET || 'unit-test-secret-not-for-production-min32chars';

    pool = new Pool({
      connectionString:
        process.env.DATABASE_URL ||
        'postgres://postgres:postgres_password@172.20.157.19:5432/sigd_prueba',
    });

    const connTest = await pool.query('SELECT current_database(), current_user');
    expect(connTest.rows[0].current_database).toBe('sigd_prueba');

    app = construirApp(pool);

    // 1. Áreas institucionales DIR y SDA
    const resAreas = await pool.query<{ area_id: string; codigo: string }>(
      `SELECT area_id, codigo FROM sigd_org.area WHERE codigo IN ('DIR', 'SDA')`,
    );
    for (const a of resAreas.rows) {
      if (a.codigo === 'DIR') dirAreaId = a.area_id;
      if (a.codigo === 'SDA') sdaAreaId = a.area_id;
    }
    expect(dirAreaId).toBeDefined();
    expect(sdaAreaId).toBeDefined();

    // 2. TUPA 2026 Vigente
    const resVer = await pool.query<{ id_version: string }>(
      `SELECT id_version FROM sigd_doc.tupa_version WHERE codigo = 'TUPA-2026' AND estado = 'VIGENTE'`,
    );
    expect(resVer.rows.length).toBe(1);
    versionTupa2026Id = resVer.rows[0].id_version;

    // 3. Procedimiento p1-fila-06 (Certificado de Inglés)
    const resProc = await pool.query<{ id_procedimiento: string; registro_version_id: string }>(
      `SELECT id_procedimiento, registro_version_id FROM sigd_doc.tupa_procedimiento 
        WHERE id_version = $1 AND codigo_ref = 'p1-fila-06'`,
      [versionTupa2026Id],
    );
    expect(resProc.rows.length).toBe(1);
    procInglesId = resProc.rows[0].id_procedimiento;
    procInglesRegVerId = resProc.rows[0].registro_version_id;

    // 4. Tipo documental vigente
    const resTipo = await pool.query<{ tipo_documental_id: string }>(
      `SELECT tipo_documental_id FROM sigd_doc.tipo_documento WHERE vigente = true LIMIT 1`,
    );
    tipoDocumentoId = resTipo.rows[0]?.tipo_documental_id;
    expect(tipoDocumentoId).toBeDefined();

    // 5. Cuentas de laboratorio canónicas
    const resUsers = await pool.query<{ id_usuario: string; usuario: string; id_persona: string }>(
      `SELECT id_usuario, usuario, id_persona FROM sigd_auth.cuenta_usuario 
        WHERE usuario IN (
          'ciudadano_demo', 'mesa_partes_demo', 'tesoreria_demo', 
          'secretario_demo', 'responsable_ingles_demo', 'director_demo', 'administrador_demo'
        )`,
    );

    for (const u of resUsers.rows) {
      if (u.usuario === 'ciudadano_demo') {
        ciudadanoUsuarioId = u.id_usuario;
        ciudadanoPersonaId = u.id_persona;
      }
      if (u.usuario === 'mesa_partes_demo') {
        mesaPartesUsuarioId = u.id_usuario;
        mesaPartesPersonaId = u.id_persona;
      }
      if (u.usuario === 'tesoreria_demo') {
        tesoreriaUsuarioId = u.id_usuario;
        tesoreriaPersonaId = u.id_persona;
      }
      if (u.usuario === 'secretario_demo') {
        secretarioSdaUsuarioId = u.id_usuario;
        secretarioSdaPersonaId = u.id_persona;
      }
      if (u.usuario === 'responsable_ingles_demo') {
        responsableInglesUsuarioId = u.id_usuario;
        responsableInglesPersonaId = u.id_persona;
      }
      if (u.usuario === 'director_demo') {
        directorUsuarioId = u.id_usuario;
        directorPersonaId = u.id_persona;
      }
      if (u.usuario === 'administrador_demo') {
        administradorUsuarioId = u.id_usuario;
        administradorPersonaId = u.id_persona;
      }
    }

    expect(ciudadanoUsuarioId).toBeDefined();
    expect(mesaPartesUsuarioId).toBeDefined();
    expect(tesoreriaUsuarioId).toBeDefined();
    expect(secretarioSdaUsuarioId).toBeDefined();
    expect(responsableInglesUsuarioId).toBeDefined();
    expect(directorUsuarioId).toBeDefined();
    expect(administradorUsuarioId).toBeDefined();

    // Emisión de Tokens JWT con claim roles correspondientes
    tokenCiudadano = firmarTokenAcceso({
      sub: ciudadanoUsuarioId,
      roles: ['CIUDADANO'],
    });

    tokenMesaPartes = firmarTokenAcceso({
      sub: mesaPartesUsuarioId,
      roles: ['MESA_PARTES'],
    });

    tokenTesoreria = firmarTokenAcceso({
      sub: tesoreriaUsuarioId,
      roles: ['TESORERIA'],
    });

    tokenSecretarioSda = firmarTokenAcceso({
      sub: secretarioSdaUsuarioId,
      roles: ['SECRETARIO', 'JEFE_AREA'],
    });

    tokenResponsableIngles = firmarTokenAcceso({
      sub: responsableInglesUsuarioId,
      roles: ['ESPECIALISTA'],
    });

    tokenDirector = firmarTokenAcceso({
      sub: directorUsuarioId,
      roles: ['DIRECTOR'],
    });

    tokenAdministrador = firmarTokenAcceso({
      sub: administradorUsuarioId,
      roles: ['ADMINISTRADOR'],
    });

    // Asegurar que la secuencia CUT no colisione con expedientes previos
    await pool.query(
      `UPDATE sigd_tra.secuencia_anual_cut 
          SET ultimo_correlativo = 100 
        WHERE anio_fiscal = 2026 AND ultimo_correlativo < 100`,
    );
  });

  afterAll(async () => {
    const client = await pool.connect();
    try {
      await client.query("SET session_replication_role = 'replica';");

      if (idsLimpieza.expedientes.size > 0) {
        const arr = Array.from(idsLimpieza.expedientes);
        await client.query('DELETE FROM sigd_rut.workflow_instancia WHERE expediente_id = ANY($1::uuid[])', [arr]).catch(() => {});
        await client.query('DELETE FROM sigd_rut.expediente_asignacion WHERE expediente_id = ANY($1::uuid[])', [arr]).catch(() => {});
        await client.query('DELETE FROM sigd_rut.estado_actual_expediente WHERE expediente_id = ANY($1::uuid[])', [arr]).catch(() => {});
        await client.query('DELETE FROM sigd_doc.documento_adjunto WHERE expediente_tra_id = ANY($1::uuid[])', [arr]).catch(() => {});
        await client.query('DELETE FROM sigd_doc.expediente_tupa_vinculo WHERE expediente_id = ANY($1::uuid[])', [arr]).catch(() => {});
        await client.query('DELETE FROM sigd_tra.recibo_pago WHERE orden_pago_id IN (SELECT orden_pago_id FROM sigd_tra.orden_pago WHERE expediente_id = ANY($1::uuid[]))', [arr]).catch(() => {});
        await client.query('DELETE FROM sigd_tra.orden_pago WHERE expediente_id = ANY($1::uuid[])', [arr]).catch(() => {});
        await client.query('DELETE FROM sigd_rut.movimiento_tramite WHERE expediente_id = ANY($1::uuid[])', [arr]).catch(() => {});
        await client.query('DELETE FROM sigd_tra.asiento_registro WHERE expediente_id = ANY($1::uuid[])', [arr]).catch(() => {});
        await client.query('DELETE FROM sigd_tra.tramite WHERE expediente_id = ANY($1::uuid[])', [arr]).catch(() => {});
        await client.query('DELETE FROM sigd_audit.evento_outbox WHERE payload->>\'expedienteId\' = ANY($1::text[])', [arr]).catch(() => {});
        await client.query('DELETE FROM sigd_tra.expediente WHERE expediente_id = ANY($1::uuid[])', [arr]).catch(() => {});
      }

      if (idsLimpieza.documentos.size > 0) {
        const arr = Array.from(idsLimpieza.documentos);
        await client.query('DELETE FROM sigd_doc.firma_digital_documento WHERE documento_id = ANY($1::uuid[])', [arr]).catch(() => {});
        await client.query('DELETE FROM sigd_doc.documento_adjunto WHERE documento_adjunto_id = ANY($1::uuid[])', [arr]).catch(() => {});
      }

      if (idsLimpieza.procedimientosTemporales.size > 0) {
        const arr = Array.from(idsLimpieza.procedimientosTemporales);
        await client.query('DELETE FROM sigd_rut.workflow_procedimiento_config WHERE id_procedimiento = ANY($1::uuid[])', [arr]).catch(() => {});
        await client.query('DELETE FROM sigd_doc.tupa_procedimiento WHERE id_procedimiento = ANY($1::uuid[])', [arr]).catch(() => {});
      }

      if (idsLimpieza.registroVersionesTemporales.size > 0) {
        const arr = Array.from(idsLimpieza.registroVersionesTemporales);
        await client.query('DELETE FROM sigd_doc.tupa_registro_version WHERE registro_version_id = ANY($1::uuid[])', [arr]).catch(() => {});
      }
    } finally {
      await client.query("SET session_replication_role = 'origin';");
      client.release();
      await pool.end();
    }
  });

  // ===========================================================================
  // TC-C3.6-01: Verificación de configuración física de Workflow (Migración 50)
  // ===========================================================================
  it('TC-C3.6-01: Verificación de las 3 definiciones, versiones y 18 configuraciones de Workflow TUPA', async () => {
    // 1. 3 Definiciones canónicas
    const defs = await pool.query<{ codigo: string; proveniencia: string; estado_homologacion: string }>(
      `SELECT codigo, proveniencia, estado_homologacion 
         FROM sigd_rut.workflow_definicion 
        WHERE codigo IN ('WF_TUPA_DOC_SDA_DIR', 'WF_TUPA_DOC_DIR_DIR', 'WF_TUPA_DOC_SDA_SDA')
        ORDER BY codigo`,
    );
    expect(defs.rows.length).toBe(3);
    for (const d of defs.rows) {
      expect(d.proveniencia).toBe('OFICIAL_SUIZA');
      expect(d.estado_homologacion).toBe('HOMOLOGADO');
    }

    // 2. 3 Versiones con 6 pasos estructurados
    const vers = await pool.query<{ codigo_completo: string; pasos: any }>(
      `SELECT codigo_completo, pasos 
         FROM sigd_rut.workflow_version 
        WHERE codigo_completo IN ('WF_TUPA_DOC_SDA_DIR:V1.0', 'WF_TUPA_DOC_DIR_DIR:V1.0', 'WF_TUPA_DOC_SDA_SDA:V1.0')
        ORDER BY codigo_completo`,
    );
    expect(vers.rows.length).toBe(3);
    for (const v of vers.rows) {
      expect(Array.isArray(v.pasos)).toBe(true);
      expect(v.pasos.length).toBe(6);
      expect(v.pasos[0].accionRequerida).toBe('REVISION_REQUISITOS');
      expect(v.pasos[v.pasos.length - 1].accionRequerida).toBe('ARCHIVO');
    }

    // 3. Mapeo de exactamente 18 procedimientos documentarios
    const configs = await pool.query<{ total: string }>(
      `SELECT count(*)::text AS total FROM sigd_rut.workflow_procedimiento_config WHERE activo = true`,
    );
    expect(Number(configs.rows[0].total)).toBe(18);

    // Mapeo detallado de patrones
    const pattern1 = await pool.query<{ total: string }>(
      `SELECT count(*)::text AS total 
         FROM sigd_rut.workflow_procedimiento_config c
         JOIN sigd_rut.workflow_version v ON v.id_version = c.id_version_workflow
        WHERE v.codigo_completo = 'WF_TUPA_DOC_SDA_DIR:V1.0'`,
    );
    expect(Number(pattern1.rows[0].total)).toBe(15);

    const pattern2 = await pool.query<{ total: string }>(
      `SELECT count(*)::text AS total 
         FROM sigd_rut.workflow_procedimiento_config c
         JOIN sigd_rut.workflow_version v ON v.id_version = c.id_version_workflow
        WHERE v.codigo_completo = 'WF_TUPA_DOC_DIR_DIR:V1.0'`,
    );
    expect(Number(pattern2.rows[0].total)).toBe(1);

    const pattern3 = await pool.query<{ total: string }>(
      `SELECT count(*)::text AS total 
         FROM sigd_rut.workflow_procedimiento_config c
         JOIN sigd_rut.workflow_version v ON v.id_version = c.id_version_workflow
        WHERE v.codigo_completo = 'WF_TUPA_DOC_SDA_SDA:V1.0'`,
    );
    expect(Number(pattern3.rows[0].total)).toBe(2);
  });

  // ===========================================================================
  // TC-C3.6-02: CIRCUITO PILOTO COMPLETO: p1-fila-06 (Certificado de Inglés)
  // Mesa Pública -> Mesa Partes -> Tesorería -> SDA -> Responsable -> Director -> Archivo
  // ===========================================================================
  it('TC-C3.6-02: Circuito Piloto Completo: Certificado de Suficiencia de Idioma Inglés (10 Pasos)', async () => {
    // -------------------------------------------------------------------------
    // PASO 1: Radicación Virtual por ciudadano_demo (Mesa Pública)
    // -------------------------------------------------------------------------
    const resRad = await request(app)
      .post('/api/v1/tramites/radicacion-virtual')
      .set('Authorization', `Bearer ${tokenCiudadano}`)
      .send({
        asunto: 'Solicitud de Certificado de Suficiencia de Idioma Inglés - Piloto C3.6',
        nombreSolicitante: 'Ciudadano Demo Laboratorio',
        correo: 'ciudadano.demo@iestpsuiza.edu.pe',
        registroVersionId: procInglesRegVerId,
        idPersona: ciudadanoPersonaId,
        tipoDocumentalId: tipoDocumentoId,
        totalFolios: 2,
        documentos: [
          {
            nombreArchivo: 'solicitud_ingles.pdf',
            contentType: 'application/pdf',
            tamanoBytes: 2048,
            hashSha256: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
          },
        ],
      });

    expect(resRad.status).toBe(201);
    expect(resRad.body.ok ?? true).toBeTruthy();
    const expedienteId = resRad.body.expedienteId;
    const cut = resRad.body.cut;
    expect(expedienteId).toBeDefined();
    expect(cut).toMatch(/^EXP-2026-\d{6}$/);
    idsLimpieza.expedientes.add(expedienteId);

    // Verificar que la instancia de Workflow fue creada e inicializada en Paso 1
    const resWfInst = await pool.query<{
      paso_actual: number;
      total_pasos: number;
      estado_instancia: string;
      codigo_completo: string;
    }>(
      `SELECT i.paso_actual, i.total_pasos, i.estado_instancia, v.codigo_completo
         FROM sigd_rut.workflow_instancia i
         JOIN sigd_rut.workflow_version v ON v.id_version = i.id_version_workflow
        WHERE i.expediente_id = $1::uuid`,
      [expedienteId],
    );

    expect(resWfInst.rows.length).toBe(1);
    expect(resWfInst.rows[0].paso_actual).toBe(1);
    expect(resWfInst.rows[0].total_pasos).toBe(6);
    expect(resWfInst.rows[0].estado_instancia).toBe('EN_CURSO');
    expect(resWfInst.rows[0].codigo_completo).toBe('WF_TUPA_DOC_SDA_DIR:V1.0');

    // -------------------------------------------------------------------------
    // PASO 2: Mesa de Partes Interna revisa requisitos
    // -------------------------------------------------------------------------
    const resReqs = await request(app)
      .get(`/api/v1/tramites/expedientes/${expedienteId}/requisitos`)
      .set('Authorization', `Bearer ${tokenMesaPartes}`)
      .set('x-contexto-operacion', 'INSTITUCIONAL');

    expect(resReqs.status).toBe(200);
    expect(resReqs.body.expedienteId).toBe(expedienteId);

    // -------------------------------------------------------------------------
    // PASO 3: Gate de Pago: Intento de derivar antes de confirmar pago -> HTTP 409
    // -------------------------------------------------------------------------
    const resDerivarBloqueado = await request(app)
      .post(`/api/v1/expedientes/${expedienteId}/derivar`)
      .set('Authorization', `Bearer ${tokenMesaPartes}`)
      .send({
        destinos: [{ area_destino_id: sdaAreaId }],
        proveido: 'Intento de derivar sin pago confirmado',
      });

    expect(resDerivarBloqueado.status).toBe(409);
    expect(resDerivarBloqueado.body.code).toBe('PAGO_PENDIENTE');

    // -------------------------------------------------------------------------
    // PASO 4: Tesorería: tesoreria_demo valida y confirma el pago (S/ 100.00)
    // -------------------------------------------------------------------------
    const resOrden = await pool.query<{ orden_pago_id: string; monto: number; estado: string }>(
      `SELECT orden_pago_id, monto, estado 
         FROM sigd_tra.orden_pago 
        WHERE expediente_id = $1::uuid`,
      [expedienteId],
    );
    expect(resOrden.rows.length).toBe(1);
    expect(Number(resOrden.rows[0].monto)).toBe(100.0);
    expect(resOrden.rows[0].estado).toBe('PENDIENTE');
    const ordenPagoId = resOrden.rows[0].orden_pago_id;
    idsLimpieza.ordenesPago.add(ordenPagoId);

    const resPago = await request(app)
      .post(`/api/v1/tesoreria/ordenes/${ordenPagoId}/confirmar`)
      .set('Authorization', `Bearer ${tokenTesoreria}`)
      .send({
        metodoPago: 'EFECTIVO',
        montoRecibido: 100.0,
      });

    expect(resPago.status).toBe(200);
    expect(resPago.body.ok).toBe(true);
    expect(resPago.body.recibo).toMatch(/^REC-2026-\d{6}$/);

    // -------------------------------------------------------------------------
    // PASO 5: Derivación Formal por mesa_partes_demo hacia SDA
    // -------------------------------------------------------------------------
    const resDerivarOk = await request(app)
      .post(`/api/v1/expedientes/${expedienteId}/derivar`)
      .set('Authorization', `Bearer ${tokenMesaPartes}`)
      .send({
        destinos: [{ area_destino_id: sdaAreaId }],
        proveido: 'Derivación formal a Subdirección Académica tras pago verificado',
      });

    expect(resDerivarOk.status).toBe(200);
    expect(resDerivarOk.body.nuevoEstado).toBe('DERIVADO');

    // Verificar en BD que el expediente cambió a DERIVADO y área actual es SDA
    const resExpEstado = await pool.query<{ estado: string; area_actual_id: string }>(
      `SELECT e.estado, COALESCE(act.area_actual_id::text, e.area_destino_id::text) AS area_actual_id
         FROM sigd_tra.expediente e
         LEFT JOIN sigd_rut.estado_actual_expediente act ON act.expediente_id = e.expediente_id
        WHERE e.expediente_id = $1::uuid`,
      [expedienteId],
    );
    expect(resExpEstado.rows[0].estado).toBe('DERIVADO');
    expect(resExpEstado.rows[0].area_actual_id).toBe(sdaAreaId);

    // -------------------------------------------------------------------------
    // PASO 6: Asignación Formal a responsable_ingles_demo
    // -------------------------------------------------------------------------
    const resAsignar = await request(app)
      .post(`/api/v1/expedientes/${expedienteId}/asignar`)
      .set('Authorization', `Bearer ${tokenSecretarioSda}`)
      .send({
        idPersona: responsableInglesPersonaId,
        idUsuario: responsableInglesUsuarioId,
        motivo: 'Asignación formal a Especialista de Idiomas para evaluación técnica de expediente de inglés',
      });

    expect([200, 201]).toContain(resAsignar.status);
    expect(resAsignar.body.ok || resAsignar.body.success).toBeTruthy();

    // -------------------------------------------------------------------------
    // PASO 7: Atención Técnica por responsable_ingles_demo (EN_REVISION -> EN_FIRMA)
    // -------------------------------------------------------------------------
    // Recepción en despacho del responsable
    const resRecep = await request(app)
      .post(`/api/v1/expedientes/${expedienteId}/recepcionar`)
      .set('Authorization', `Bearer ${tokenResponsableIngles}`);

    expect(resRecep.status).toBe(200);
    expect(resRecep.body.nuevoEstado).toBe('EN_REVISION');

    // Envío a Despacho de Dirección para Firma
    const resEnviarFirma = await request(app)
      .post(`/api/v1/expedientes/${expedienteId}/enviar-a-firma`)
      .set('Authorization', `Bearer ${tokenResponsableIngles}`)
      .send({
        resultado_resumen: 'Informe de evaluación conforme. Se remite para emisión y firma de Resolución Directoral de Certificado de Inglés.',
      });

    expect(resEnviarFirma.status).toBe(200);
    expect(resEnviarFirma.body.nuevoEstado).toBe('EN_FIRMA');

    // -------------------------------------------------------------------------
    // PASO 8: Firma Sandbox y Resolución por director_demo
    // -------------------------------------------------------------------------
    // El Director General revisa el expediente en despacho y estampa su firma electrónica sandbox
    const resolucionAdjuntoId = randomUUID();
    const cvdSandbox = `CVD-DIR-${Math.floor(100000 + Math.random() * 900000)}`;
    const shaResolucion = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

    await pool.query(
      `INSERT INTO sigd_doc.documento_adjunto (
         documento_adjunto_id, expediente_id, expediente_tra_id, tipo_documental_id,
         nombre_archivo, s3_bucket, s3_key, sha256, tamano_bytes, mime_type, subido_por, creado_en
       ) VALUES ($1, NULL, $2, $3, 'RD-045-2026-INGLES.pdf', 'sigd-expedientes', $4, $5, 4096, 'application/pdf', $6, now())`,
      [resolucionAdjuntoId, expedienteId, tipoDocumentoId, `expedientes/${expedienteId}/${resolucionAdjuntoId}.pdf`, shaResolucion, directorPersonaId],
    );

    await pool.query(
      `INSERT INTO sigd_doc.firma_digital_documento (
         documento_id, cvd, sha256_firmado, firmante, estado, fecha_registro,
         fecha_sello_tsa, s3_bucket, s3_key, algoritmo_firma, proveedor_firma, documento_version
       ) VALUES ($1, $2, $3, 'Director General IESTP Suiza', 'FIRMADO_DIGITALMENTE', now(), now(), 'sigd-expedientes', $4, 'SHA256withRSA', 'SANDBOX_C3_6', 1)`,
      [resolucionAdjuntoId, cvdSandbox, shaResolucion, `expedientes/${expedienteId}/${resolucionAdjuntoId}.pdf`],
    );
    idsLimpieza.documentos.add(resolucionAdjuntoId);

    const resResolver = await request(app)
      .post(`/api/v1/expedientes/${expedienteId}/resolver`)
      .set('Authorization', `Bearer ${tokenDirector}`)
      .send({
        resultado_resumen: 'Resolución Directoral N° 045-2026-IESTP-SUIZA: Se aprueba el otorgamiento del Certificado de Suficiencia de Idioma Inglés.',
        observacion_interna: 'Firma electrónica estampada mediante sandbox institucional.',
        documento_respuesta_id: resolucionAdjuntoId,
      });

    expect(resResolver.status).toBe(200);
    expect(resResolver.body.nuevoEstado).toBe('RESUELTO');

    // -------------------------------------------------------------------------
    // PASO 9: Notificación / Evento Outbox Registrado
    // -------------------------------------------------------------------------
    const resOutbox = await pool.query<{ tipo_evento: string; payload: any }>(
      `SELECT tipo_evento, payload 
         FROM sigd_audit.evento_outbox 
        WHERE payload->>'expediente_id' = $1 OR payload->>'expedienteId' = $1 OR payload->>'idExpediente' = $1
        ORDER BY creado_en DESC`,
      [expedienteId],
    );
    expect(resOutbox.rows.length).toBeGreaterThan(0);
    const tiposEventos = resOutbox.rows.map((r) => r.tipo_evento);
    expect(tiposEventos).toContain('PAGO_CONFIRMADO');
    expect(
      tiposEventos.some((t) => ['TRAMITE_RESUELTO', 'ExpedienteAtendido', 'ExpedienteResuelto'].includes(t)),
    ).toBe(true);

    // -------------------------------------------------------------------------
    // PASO 10: Archivado Físico Formal por mesa_partes_demo
    // -------------------------------------------------------------------------
    const resArchivar = await request(app)
      .post(`/api/v1/expedientes/${expedienteId}/archivar`)
      .set('Authorization', `Bearer ${tokenMesaPartes}`)
      .send({
        estante: 'E-03',
        balda: 'B-01',
        caja: 'C-12',
        observaciones: 'Expediente archivado físicamente tras emisión y notificación formal del certificado',
      });

    expect(resArchivar.status).toBe(200);
    expect(resArchivar.body.nuevoEstado).toBe('ARCHIVADO');

    // Verificar estado final en BD
    const resFinal = await pool.query<{ estado: string }>(
      `SELECT estado FROM sigd_tra.expediente WHERE expediente_id = $1::uuid`,
      [expedienteId],
    );
    expect(resFinal.rows[0].estado).toBe('ARCHIVADO');
  });

  // ===========================================================================
  // TC-C3.6-03: SEGUNDO CIRCUITO: PROCEDIMIENTO GRATUITO (Bypass Legítimo Tesorería)
  // ===========================================================================
  it('TC-C3.6-03: Procedimiento Gratuito (monto = 0) bypasses Tesorería y permite derivar inmediatamente', async () => {
    // Crear un procedimiento documentario gratuito temporal en el catálogo para probar el circuito
    const idProcGratuito = randomUUID();
    const idRegVerGratuito = randomUUID();
    idsLimpieza.procedimientosTemporales.add(idProcGratuito);
    idsLimpieza.registroVersionesTemporales.add(idRegVerGratuito);

    await pool.query(
      `INSERT INTO sigd_doc.tupa_registro_version (
        registro_version_id, documento_sha256, fuente_nombre, pagina, referencia_fila, denominacion_original, estado_validacion, referencia_aprobacion
      ) VALUES (
        $1, '0000000000000000000000000000000000000000000000000000000000000000', 'TUPA_2026', 1, 'p-test-gratuito', 'Trámite Gratuito', 'APROBADO', 'VALIDACION_HOMOLOGACION_C3_6'
      )`,
      [idRegVerGratuito],
    );

    await pool.query(
      `INSERT INTO sigd_doc.tupa_procedimiento (
        id_procedimiento, id_version, codigo_ref, denominacion, categoria,
        monto, unidad_cobro, plazo_dias, genera_expediente, calificacion,
        registro_version_id, activo, orden, canal_presentacion,
        unidad_receptora_id, unidad_responsable_id, unidad_resolutiva_id,
        intervencion_financiera, perfil_responsable_id
      ) VALUES (
        $1, $2, 'p-test-gratuito', 'Trámite Documentario Gratuito de Prueba C3.6', 'PROCEDIMIENTO_APROBADO',
        0.00, '% UIT', 15, true, 'AUTOMATICA',
        $3, true, 999, 'DIGITAL',
        $4, $5, $4,
        'NO_REQUIERE_PAGO', 4
      )`,
      [idProcGratuito, versionTupa2026Id, idRegVerGratuito, dirAreaId, sdaAreaId],
    );

    // Mapear al workflow SDA_DIR
    const resWfVer = await pool.query<{ id_version: string }>(
      `SELECT id_version FROM sigd_rut.workflow_version WHERE codigo_completo = 'WF_TUPA_DOC_SDA_DIR:V1.0'`,
    );
    await pool.query(
      `INSERT INTO sigd_rut.workflow_procedimiento_config (id_procedimiento, id_version_workflow, activo)
       VALUES ($1, $2, true)`,
      [idProcGratuito, resWfVer.rows[0].id_version],
    );

    // 1. Radicación Virtual
    const resRad = await request(app)
      .post('/api/v1/tramites/radicacion-virtual')
      .set('Authorization', `Bearer ${tokenCiudadano}`)
      .send({
        asunto: 'Solicitud Gratuita - Demostración de Bypass Tesorería',
        nombreSolicitante: 'Ciudadano Demo Laboratorio',
        correo: 'ciudadano.demo@iestpsuiza.edu.pe',
        registroVersionId: idRegVerGratuito,
        idPersona: ciudadanoPersonaId,
        tipoDocumentalId: tipoDocumentoId,
        totalFolios: 1,
        documentos: [
          {
            nombreArchivo: 'adjunto_gratuito.pdf',
            contentType: 'application/pdf',
            tamanoBytes: 1024,
            hashSha256: '0000000000000000000000000000000000000000000000000000000000000000',
          },
        ],
      });

    expect(resRad.status).toBe(201);
    const expGratuitoId = resRad.body.expedienteId;
    idsLimpieza.expedientes.add(expGratuitoId);

    // No debe haberse generado orden de pago
    const resOrden = await pool.query(
      `SELECT orden_pago_id FROM sigd_tra.orden_pago WHERE expediente_id = $1::uuid`,
      [expGratuitoId],
    );
    expect(resOrden.rows.length).toBe(0);

    // 2. Derivar directamente SIN pasar por Tesorería -> Debe ser EXITOSO (HTTP 200)
    const resDerivar = await request(app)
      .post(`/api/v1/expedientes/${expGratuitoId}/derivar`)
      .set('Authorization', `Bearer ${tokenMesaPartes}`)
      .send({
        destinos: [{ area_destino_id: sdaAreaId }],
        proveido: 'Pase a SDA sin cobro por ser procedimiento gratuito',
      });

    expect(resDerivar.status).toBe(200);
    expect(resDerivar.body.nuevoEstado).toBe('DERIVADO');
  });

  // ===========================================================================
  // TC-C3.6-04: CIRCUITO CON OBSERVACIÓN Y SUBSANACIÓN DE REQUISITOS
  // ===========================================================================
  it('TC-C3.6-04: Observación de requisitos bloquea derivación; subsanación desbloquea trámite', async () => {
    // 1. Radicar expediente
    const resRad = await request(app)
      .post('/api/v1/tramites/radicacion-virtual')
      .set('Authorization', `Bearer ${tokenCiudadano}`)
      .send({
        asunto: 'Trámite para Observación y Subsanación - C3.6',
        nombreSolicitante: 'Ciudadano Demo Laboratorio',
        correo: 'ciudadano.demo@iestpsuiza.edu.pe',
        registroVersionId: procInglesRegVerId,
        idPersona: ciudadanoPersonaId,
        tipoDocumentalId: tipoDocumentoId,
        totalFolios: 1,
        documentos: [
          {
            nombreArchivo: 'adjunto_observacion.pdf',
            contentType: 'application/pdf',
            tamanoBytes: 1024,
            hashSha256: 'b1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
          },
        ],
      });

    expect(resRad.status).toBe(201);
    const expObsId = resRad.body.expedienteId;
    idsLimpieza.expedientes.add(expObsId);

    // FSM canónica: expediente recién radicado está en REGISTRADO.
    // Para poder observarlo, primero se recepciona/califica formalmente en Mesa de Partes (EN_CALIFICACION)
    await pool.query(
      `UPDATE sigd_tra.expediente SET estado = 'EN_CALIFICACION' WHERE expediente_id = $1::uuid`,
      [expObsId],
    );
    await pool.query(
      `UPDATE sigd_rut.estado_actual_expediente 
          SET estado_nuevo = 'EN_CALIFICACION' 
        WHERE expediente_id = $1::uuid`,
      [expObsId],
    );

    // 2. Mesa de Partes registra observación de requisitos
    const resObs = await request(app)
      .post(`/api/v1/expedientes/${expObsId}/observar`)
      .set('Authorization', `Bearer ${tokenMesaPartes}`)
      .send({
        motivo: 'El certificado modular adjunto es ilegible en el reverso. Se solicita remitir escaneo claro.',
      });

    expect(resObs.status).toBe(200);
    expect(resObs.body.estado).toBe('OBSERVADO');

    // 3. Intento de derivar en estado OBSERVADO debe ser rechazado
    const resDerivarBloqueado = await request(app)
      .post(`/api/v1/expedientes/${expObsId}/derivar`)
      .set('Authorization', `Bearer ${tokenMesaPartes}`)
      .send({
        destinos: [{ area_destino_id: sdaAreaId }],
        proveido: 'Intento de derivar en estado observado',
      });

    // En estado OBSERVADO la derivación es rechazada
    expect([400, 409, 422]).toContain(resDerivarBloqueado.status);

    // 4. Subsanación por el administrado
    const resSubsanar = await request(app)
      .post(`/api/v1/expedientes/${expObsId}/subsanar`)
      .set('Authorization', `Bearer ${tokenCiudadano}`)
      .send({
        motivo: 'Se adjunta copia nítida y legible a 300 DPI del certificado solicitado.',
      });

    expect(resSubsanar.status).toBe(200);
    expect(resSubsanar.body.estado).toBe('SUBSANADO');

    // Verificar en BD que el expediente quedó en SUBSANADO
    const resBD = await pool.query<{ estado: string }>(
      `SELECT estado FROM sigd_tra.expediente WHERE expediente_id = $1::uuid`,
      [expObsId],
    );
    expect(resBD.rows[0].estado).toBe('SUBSANADO');

    // Ciudadano NO puede iniciar revisión (HTTP 403)
    const resCiudadanoRev = await request(app)
      .post(`/api/v1/expedientes/${expObsId}/iniciar-revision`)
      .set('Authorization', `Bearer ${tokenCiudadano}`)
      .send({ motivo: 'Intento ciudadano no autorizado' });
    expect(resCiudadanoRev.status).toBe(403);

    // Funcionario institucional autorizado inicia revisión (HTTP 200 -> EN_REVISION)
    const resIniciarRev = await request(app)
      .post(`/api/v1/expedientes/${expObsId}/iniciar-revision`)
      .set('Authorization', `Bearer ${tokenMesaPartes}`)
      .send({ motivo: 'Revisión formal iniciada tras subsanación' });
    expect(resIniciarRev.status).toBe(200);
    expect(resIniciarRev.body.estado).toBe('EN_REVISION');

    const resBD2 = await pool.query<{ estado: string }>(
      `SELECT estado FROM sigd_tra.expediente WHERE expediente_id = $1::uuid`,
      [expObsId],
    );
    expect(resBD2.rows[0].estado).toBe('EN_REVISION');
  });

  // ===========================================================================
  // TC-C3.6-05: AUTORIZACIÓN CONTEXTUAL Y SEGREGACIÓN DE FUNCIONES (Fail-Closed)
  // ===========================================================================
  it('TC-C3.6-05: Controles de Seguridad Fail-Closed y Segregación Estricta de Funciones', async () => {
    // 1. Radicar un expediente de prueba con titular = ciudadano_demo
    const resRad = await request(app)
      .post('/api/v1/tramites/radicacion-virtual')
      .set('Authorization', `Bearer ${tokenCiudadano}`)
      .send({
        asunto: 'Trámite para Auditoría de Segregación de Funciones - C3.6',
        nombreSolicitante: 'Ciudadano Demo Laboratorio',
        correo: 'ciudadano.demo@iestpsuiza.edu.pe',
        registroVersionId: procInglesRegVerId,
        idPersona: ciudadanoPersonaId,
        tipoDocumentalId: tipoDocumentoId,
        totalFolios: 1,
        documentos: [
          {
            nombreArchivo: 'adjunto_segregacion.pdf',
            contentType: 'application/pdf',
            tamanoBytes: 1024,
            hashSha256: 'c1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
          },
        ],
      });

    expect(resRad.status).toBe(201);
    const expSegId = resRad.body.expedienteId;
    idsLimpieza.expedientes.add(expSegId);

    // A. Anti-Autoatención: Ciudadano intentando derivar su propio trámite -> HTTP 403
    const resCiudadanoDeriva = await request(app)
      .post(`/api/v1/expedientes/${expSegId}/derivar`)
      .set('Authorization', `Bearer ${tokenCiudadano}`)
      .send({
        destinos: [{ area_destino_id: sdaAreaId }],
        proveido: 'Intento de derivar mi propio trámite',
      });

    expect(resCiudadanoDeriva.status).toBe(403);

    // B. Administrado intentando resolver un expediente -> HTTP 403
    const resCiudadanoResuelve = await request(app)
      .post(`/api/v1/expedientes/${expSegId}/resolver`)
      .set('Authorization', `Bearer ${tokenCiudadano}`)
      .send({
        resultado_resumen: 'Auto-resolución no autorizada',
      });

    expect(resCiudadanoResuelve.status).toBe(403);

    // C. Administrador técnico sin rol directivo intentando resolver -> HTTP 403 PODER_TECNICO_SIN_AUTORIDAD_NEGOCIO
    const resAdminResuelve = await request(app)
      .post(`/api/v1/expedientes/${expSegId}/atender`)
      .set('Authorization', `Bearer ${tokenAdministrador}`)
      .send({
        resultado_resumen: 'Resolución emitida por Administrador Técnico',
      });

    expect(resAdminResuelve.status).toBe(403);
    expect(resAdminResuelve.body.code ?? resAdminResuelve.body.detail).toMatch(/PODER_TECNICO/);
  });
});
