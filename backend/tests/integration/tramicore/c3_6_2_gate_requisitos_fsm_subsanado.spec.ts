import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { construirApp } from '../../../src/app.js';
import { firmarTokenAcceso } from '../../../src/core/auth/jwt.service.js';

describe('FASE C3.6.2: Gate de Requisitos Documentales y FSM Subsanado', () => {
  let pool: Pool;
  let app: any;

  // Áreas institucionales
  let dirAreaId: string;
  let sdaAreaId: string;

  // TUPA 2026 e IDs
  let versionTupa2026Id: string;
  let procTrasladoExtId: string;
  let procTrasladoExtRegVerId: string;
  let reqDocumentalObligatorioId: string;

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

  let especialistaSdaUsuarioId: string;
  let especialistaSdaPersonaId: string;
  let tokenEspecialistaSda: string;

  let correlativoTest = 750000;

  // Seguimiento de IDs para limpieza de fixtures
  const idsLimpieza = {
    expedientes: new Set<string>(),
    ordenesPago: new Set<string>(),
    evidencias: new Set<string>(),
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

    // 3. Procedimiento p5-fila-21 (Traslado Externo - genera_expediente=true, con 1 requisito DOCUMENTAL obligatorio)
    const resProcTraslado = await pool.query<{ id_procedimiento: string; registro_version_id: string }>(
      `SELECT id_procedimiento, registro_version_id FROM sigd_doc.tupa_procedimiento 
        WHERE id_version = $1 AND codigo_ref = 'p5-fila-21'`,
      [versionTupa2026Id],
    );
    expect(resProcTraslado.rows.length).toBe(1);
    procTrasladoExtId = resProcTraslado.rows[0].id_procedimiento;
    procTrasladoExtRegVerId = resProcTraslado.rows[0].registro_version_id;

    // Requisito documental obligatorio de p5-fila-21
    const resReqDoc = await pool.query<{ id_requisito: string }>(
      `SELECT id_requisito FROM sigd_doc.tupa_requisito_documental
        WHERE registro_version_id = $1 AND tipo_requisito = 'DOCUMENTAL' AND obligatorio = true AND activo = true
        LIMIT 1`,
      [procTrasladoExtRegVerId],
    );
    expect(resReqDoc.rows.length).toBe(1);
    reqDocumentalObligatorioId = resReqDoc.rows[0].id_requisito;

    // 4. Procedimiento p1-fila-06 (Certificado de Inglés - genera_expediente=true, 0 requisitos documentales obligatorios)
    const resProcIngles = await pool.query<{ id_procedimiento: string; registro_version_id: string }>(
      `SELECT id_procedimiento, registro_version_id FROM sigd_doc.tupa_procedimiento 
        WHERE id_version = $1 AND codigo_ref = 'p1-fila-06'`,
      [versionTupa2026Id],
    );
    expect(resProcIngles.rows.length).toBe(1);
    procInglesId = resProcIngles.rows[0].id_procedimiento;
    procInglesRegVerId = resProcIngles.rows[0].registro_version_id;

    // 5. Tipo documental vigente
    const resTipo = await pool.query<{ tipo_documental_id: string }>(
      `SELECT tipo_documental_id FROM sigd_doc.tipo_documento WHERE vigente = true LIMIT 1`,
    );
    tipoDocumentoId = resTipo.rows[0]?.tipo_documental_id;
    expect(tipoDocumentoId).toBeDefined();

    // 6. Cuentas de laboratorio canónicas
    const resUsers = await pool.query<{ id_usuario: string; usuario: string; id_persona: string }>(
      `SELECT id_usuario, usuario, id_persona FROM sigd_auth.cuenta_usuario 
        WHERE usuario IN ('ciudadano_demo', 'mesa_partes_demo', 'especialista_demo')`,
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
      if (u.usuario === 'especialista_demo') {
        especialistaSdaUsuarioId = u.id_usuario;
        especialistaSdaPersonaId = u.id_persona;
      }
    }

    expect(ciudadanoUsuarioId).toBeDefined();
    expect(mesaPartesUsuarioId).toBeDefined();
    expect(especialistaSdaUsuarioId).toBeDefined();

    tokenCiudadano = firmarTokenAcceso({
      sub: ciudadanoUsuarioId,
      roles: ['CIUDADANO'],
    });

    tokenMesaPartes = firmarTokenAcceso({
      sub: mesaPartesUsuarioId,
      roles: ['MESA_PARTES'],
    });

    tokenEspecialistaSda = firmarTokenAcceso({
      sub: especialistaSdaUsuarioId,
      roles: ['ESPECIALISTA'],
    });
  });

  afterAll(async () => {
    const client = await pool.connect();
    try {
      await client.query("SET session_replication_role = 'replica';");

      if (idsLimpieza.expedientes.size > 0) {
        const arr = Array.from(idsLimpieza.expedientes);
        await client.query('DELETE FROM sigd_rut.workflow_instancia WHERE expediente_id = ANY($1::uuid[])', [arr]).catch(() => {});
        await client.query('DELETE FROM sigd_rut.expediente_asignacion WHERE expediente_id = ANY($1::uuid[])', [arr]).catch(() => {});
        await client.query('DELETE FROM sigd_rut.expediente_observacion WHERE expediente_id = ANY($1::uuid[])', [arr]).catch(() => {});
        await client.query('DELETE FROM sigd_doc.expediente_evidencia_requisito WHERE expediente_id = ANY($1::uuid[])', [arr]).catch(() => {});
        await client.query('DELETE FROM sigd_rut.estado_actual_expediente WHERE expediente_id = ANY($1::uuid[])', [arr]).catch(() => {});
        await client.query('DELETE FROM sigd_doc.documento_adjunto WHERE expediente_tra_id = ANY($1::uuid[])', [arr]).catch(() => {});
        await client.query('DELETE FROM sigd_doc.expediente_tupa_vinculo WHERE expediente_id = ANY($1::uuid[])', [arr]).catch(() => {});
        await client.query('DELETE FROM sigd_tra.recibo_pago WHERE orden_pago_id IN (SELECT orden_pago_id FROM sigd_tra.orden_pago WHERE expediente_id = ANY($1::uuid[]))', [arr]).catch(() => {});
        await client.query('DELETE FROM sigd_tra.orden_pago WHERE expediente_id = ANY($1::uuid[])', [arr]).catch(() => {});
        await client.query('DELETE FROM sigd_rut.movimiento_tramite WHERE expediente_id = ANY($1::uuid[])', [arr]).catch(() => {});
        await client.query('DELETE FROM sigd_rut.movimiento_identidad WHERE expediente_id = ANY($1::uuid[])', [arr]).catch(() => {});
        await client.query('DELETE FROM sigd_rut.movimiento_secuencia WHERE expediente_id = ANY($1::uuid[])', [arr]).catch(() => {});
        await client.query('DELETE FROM sigd_tra.asiento_registro WHERE expediente_id = ANY($1::uuid[])', [arr]).catch(() => {});
        await client.query('DELETE FROM sigd_tra.tramite WHERE expediente_id = ANY($1::uuid[])', [arr]).catch(() => {});
        await client.query('DELETE FROM sigd_audit.evento_outbox WHERE payload->>\'expedienteId\' = ANY($1::text[])', [arr]).catch(() => {});
        await client.query('DELETE FROM sigd_tra.expediente WHERE expediente_id = ANY($1::uuid[])', [arr]).catch(() => {});
      }
    } finally {
      await client.query("SET session_replication_role = 'origin';");
      client.release();
      await pool.end();
    }
  });

  /**
   * Helper para crear un expediente de prueba vinculado a un procedimiento TUPA específico
   */
  async function crearExpedientePrueba(opts: {
    codigoRef: string;
    registroVersionId: string;
    idProcedimiento: string;
    estado?: string;
    pagoConfirmado?: boolean;
    areaId?: string;
  }): Promise<{ expedienteId: string; cut: string }> {
    const expId = randomUUID();
    const cut = `EXP-2026-${++correlativoTest}`;
    const areaId = opts.areaId ?? dirAreaId;
    const estado = opts.estado ?? 'EN_CALIFICACION';

    idsLimpieza.expedientes.add(expId);

    // 1. Expediente
    await pool.query(
      `INSERT INTO sigd_tra.expediente (
        expediente_id, codigo_expediente, numero, dni_solicitante, tipo_documental_id,
        solicitante_id, area_destino_id, estado, fecha_radicacion, id_usuario_creador
      ) VALUES (
        $1::uuid, $2, $2, '12345678', $3::uuid,
        $4::uuid, $5::uuid, $6, now(), $7::uuid
      )`,
      [expId, cut, tipoDocumentoId, ciudadanoPersonaId, areaId, estado, ciudadanoUsuarioId],
    );

    // 2. Vínculo TUPA snapshot
    await pool.query(
      `INSERT INTO sigd_doc.expediente_tupa_vinculo (
        expediente_id, registro_version_id, tupa_codigo, tupa_anio, codigo_ref,
        denominacion_snapshot, monto_efectivo, canal_presentacion, unidad_receptora_id,
        unidad_responsable_id, unidad_resolutiva_id
      ) VALUES (
        $1::uuid, $2::uuid, 'TUPA-2026', 2026, $3,
        'Procedimiento C3.6.2 Snapshot', 100.00, 'VIRTUAL', $4::uuid, $5::uuid, $4::uuid
      )`,
      [expId, opts.registroVersionId, opts.codigoRef, dirAreaId, sdaAreaId],
    );

    // 3. Proyección estado actual y secuencia
    await pool.query(
      `INSERT INTO sigd_rut.movimiento_secuencia (expediente_id, ultima_secuencia)
       VALUES ($1::uuid, 1)
       ON CONFLICT (expediente_id) DO UPDATE SET ultima_secuencia = 1`,
      [expId],
    );
    await pool.query(
      `INSERT INTO sigd_rut.estado_actual_expediente (
        expediente_id, secuencia, estado_nuevo, evento, area_actual_id, id_movimiento, fecha_hora, usuario_operador_id
      ) VALUES (
        $1::uuid, 1, $2, 'INICIAR_CALIFICACION', $3, gen_random_uuid(), now(), 0
      ) ON CONFLICT (expediente_id) DO UPDATE SET estado_nuevo = EXCLUDED.estado_nuevo, area_actual_id = EXCLUDED.area_actual_id, fecha_hora = EXCLUDED.fecha_hora`,
      [expId, estado, areaId],
    );

    // 4. Pago confirmado si requerido
    if (opts.pagoConfirmado) {
      const ordenId = randomUUID();
      idsLimpieza.ordenesPago.add(ordenId);
      await pool.query(
        `INSERT INTO sigd_tra.orden_pago (
          orden_pago_id, codigo_pago, expediente_id, solicitante_id, concepto,
          monto, moneda, estado, metodo_pago, fecha_vencimiento, fecha_pago, tesorero_id
        ) VALUES (
          $1::uuid, $2, $3::uuid, $4::uuid, 'Tasa TUPA C3.6.2',
          100.00, 'PEN', 'CONFIRMADO', 'EFECTIVO', now() + interval '30 days', now(), $5::uuid
        )`,
        [ordenId, `PAG-C362-${correlativoTest}`, expId, ciudadanoPersonaId, mesaPartesUsuarioId],
      );
    }

    return { expedienteId: expId, cut };
  }

  // ===========================================================================
  // TC-C3.6.2-01: GATE REQUISITO FALTANTE -> DENY (409) Y DELTA CERO
  // ===========================================================================
  it('TC-C3.6.2-01: Derivación bloqueada si requisito documental obligatorio NO cuenta con evidencia (HTTP 409)', async () => {
    // Procedimiento p5-fila-21: tiene 1 requisito documental obligatorio ("Solicitud en FUT")
    // Pago CONFIRMADO, pero requisito obligatorio SIN evidencia
    const { expedienteId } = await crearExpedientePrueba({
      codigoRef: 'p5-fila-21',
      registroVersionId: procTrasladoExtRegVerId,
      idProcedimiento: procTrasladoExtId,
      pagoConfirmado: true,
      estado: 'EN_CALIFICACION',
    });

    // Contar movimientos previos para verificar delta cero
    const countMovAntes = await pool.query<{ total: string }>(
      `SELECT count(*)::text AS total FROM sigd_rut.movimiento_tramite WHERE expediente_id = $1::uuid`,
      [expedienteId],
    );

    // Mesa de Partes intenta derivar hacia SDA
    const res = await request(app)
      .post(`/api/v1/expedientes/${expedienteId}/derivar`)
      .set('Authorization', `Bearer ${tokenMesaPartes}`)
      .set('x-contexto-operacion', 'INSTITUCIONAL')
      .send({
        destinos: [{ area_destino_id: sdaAreaId, es_copia: false }],
        proveido: 'Pase a SDA para calificación',
      });

    // Debe ser rechazado con 409 REQUISITOS_DOCUMENTALES_PENDIENTES
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('REQUISITOS_DOCUMENTALES_PENDIENTES');

    // Delta cero: 0 movimientos nuevos, estado permanece EN_CALIFICACION
    const countMovDespues = await pool.query<{ total: string }>(
      `SELECT count(*)::text AS total FROM sigd_rut.movimiento_tramite WHERE expediente_id = $1::uuid`,
      [expedienteId],
    );
    expect(countMovDespues.rows[0].total).toBe(countMovAntes.rows[0].total);

    const resExp = await pool.query<{ estado: string }>(
      `SELECT estado FROM sigd_tra.expediente WHERE expediente_id = $1::uuid`,
      [expedienteId],
    );
    expect(resExp.rows[0].estado).toBe('EN_CALIFICACION');
  });

  // ===========================================================================
  // TC-C3.6.2-02: GATE REQUISITO OBSERVADO / NO CONFORME -> DENY (409)
  // ===========================================================================
  it('TC-C3.6.2-02: Derivación bloqueada si requisito documental obligatorio está OBSERVADO/NO CONFORME (HTTP 409)', async () => {
    const { expedienteId } = await crearExpedientePrueba({
      codigoRef: 'p5-fila-21',
      registroVersionId: procTrasladoExtRegVerId,
      idProcedimiento: procTrasladoExtId,
      pagoConfirmado: true,
      estado: 'EN_CALIFICACION',
    });

    // Registrar evidencia con estado_validacion = 'OBSERVADO'
    const evId = randomUUID();
    idsLimpieza.evidencias.add(evId);
    await pool.query(
      `INSERT INTO sigd_doc.expediente_evidencia_requisito (
        id_evidencia, expediente_id, id_requisito, tipo_evidencia, id_persona, id_usuario,
        canal, estado_validacion, observacion, creado_en
      ) VALUES (
        $1::uuid, $2::uuid, $3::uuid, 'DOCUMENTO', $4::uuid, $5::uuid,
        'VIRTUAL', 'OBSERVADO', 'Documento incompleto o borroso', now()
      )`,
      [evId, expedienteId, reqDocumentalObligatorioId, ciudadanoPersonaId, ciudadanoUsuarioId],
    );

    // Intentar derivar
    const res = await request(app)
      .post(`/api/v1/expedientes/${expedienteId}/derivar`)
      .set('Authorization', `Bearer ${tokenMesaPartes}`)
      .set('x-contexto-operacion', 'INSTITUCIONAL')
      .send({
        destinos: [{ area_destino_id: sdaAreaId, es_copia: false }],
        proveido: 'Pase a SDA',
      });

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('REQUISITOS_DOCUMENTALES_PENDIENTES');

    // Estado permanece EN_CALIFICACION
    const resExp = await pool.query<{ estado: string }>(
      `SELECT estado FROM sigd_tra.expediente WHERE expediente_id = $1::uuid`,
      [expedienteId],
    );
    expect(resExp.rows[0].estado).toBe('EN_CALIFICACION');
  });

  // ===========================================================================
  // TC-C3.6.2-03: GATE REQUISITOS CONFORMES + PAGO CONFIRMADO -> ALLOW (200)
  // ===========================================================================
  it('TC-C3.6.2-03: Derivación permitida cuando requisitos documentales están conformes y pago confirmado (HTTP 200)', async () => {
    const { expedienteId } = await crearExpedientePrueba({
      codigoRef: 'p5-fila-21',
      registroVersionId: procTrasladoExtRegVerId,
      idProcedimiento: procTrasladoExtId,
      pagoConfirmado: true,
      estado: 'EN_CALIFICACION',
    });

    // Registrar evidencia conforme (estado_validacion = 'VALIDADO')
    const evId = randomUUID();
    idsLimpieza.evidencias.add(evId);
    await pool.query(
      `INSERT INTO sigd_doc.expediente_evidencia_requisito (
        id_evidencia, expediente_id, id_requisito, tipo_evidencia, id_persona, id_usuario,
        canal, estado_validacion, observacion, validado_por, validado_en, creado_en
      ) VALUES (
        $1::uuid, $2::uuid, $3::uuid, 'DOCUMENTO', $4::uuid, $5::uuid,
        'VIRTUAL', 'VALIDADO', 'Conforme con FUT presentado', $6::uuid, now(), now()
      )`,
      [evId, expedienteId, reqDocumentalObligatorioId, ciudadanoPersonaId, ciudadanoUsuarioId, mesaPartesUsuarioId],
    );

    // Derivar formalmente
    const res = await request(app)
      .post(`/api/v1/expedientes/${expedienteId}/derivar`)
      .set('Authorization', `Bearer ${tokenMesaPartes}`)
      .set('x-contexto-operacion', 'INSTITUCIONAL')
      .send({
        destinos: [{ area_destino_id: sdaAreaId, es_copia: false }],
        proveido: 'Pase a SDA para atención técnica',
      });

    expect(res.status).toBe(200);
    expect(res.body.nuevoEstado).toBe('DERIVADO');

    // Verificar en BD que el expediente quedó DERIVADO hacia SDA
    const resExp = await pool.query<{ estado: string; area_destino_id: string }>(
      `SELECT estado, area_destino_id FROM sigd_tra.expediente WHERE expediente_id = $1::uuid`,
      [expedienteId],
    );
    expect(resExp.rows[0].estado).toBe('DERIVADO');
    expect(resExp.rows[0].area_destino_id).toBe(sdaAreaId);

    // Verificar movimiento WORM
    const resMov = await pool.query<{ estado_nuevo: string }>(
      `SELECT estado_nuevo FROM sigd_rut.movimiento_tramite 
        WHERE expediente_id = $1::uuid ORDER BY secuencia DESC LIMIT 1`,
      [expedienteId],
    );
    expect(resMov.rows[0].estado_nuevo).toBe('DERIVADO');
  });

  // ===========================================================================
  // TC-C3.6.2-04: PROCEDIMIENTO CON 0 REQUISITOS DOCUMENTALES OBLIGATORIOS
  // ===========================================================================
  it('TC-C3.6.2-04: Procedimiento con 0 requisitos documentales obligatorios (p1-fila-06) satisface gate automáticamente', async () => {
    // p1-fila-06 no tiene requisitos documentales obligatorios, solo tasa financiera
    const { expedienteId } = await crearExpedientePrueba({
      codigoRef: 'p1-fila-06',
      registroVersionId: procInglesRegVerId,
      idProcedimiento: procInglesId,
      pagoConfirmado: true,
      estado: 'EN_CALIFICACION',
    });

    // Derivar formalmente
    const res = await request(app)
      .post(`/api/v1/expedientes/${expedienteId}/derivar`)
      .set('Authorization', `Bearer ${tokenMesaPartes}`)
      .set('x-contexto-operacion', 'INSTITUCIONAL')
      .send({
        destinos: [{ area_destino_id: sdaAreaId, es_copia: false }],
        proveido: 'Pase a SDA para emisión de certificado',
      });

    expect(res.status).toBe(200);
    expect(res.body.nuevoEstado).toBe('DERIVADO');
  });

  // ===========================================================================
  // TC-C3.6.2-05: FSM SUBSANADO - /subsanar CULMINA EN SUBSANADO
  // ===========================================================================
  it('TC-C3.6.2-05: Operación /subsanar culmina formalmente en SUBSANADO sin autoavanzar a EN_REVISION', async () => {
    const { expedienteId } = await crearExpedientePrueba({
      codigoRef: 'p1-fila-06',
      registroVersionId: procInglesRegVerId,
      idProcedimiento: procInglesId,
      pagoConfirmado: true,
      estado: 'OBSERVADO',
    });

    // Ciudadano ejecuta subsanación
    const resSubsanar = await request(app)
      .post(`/api/v1/expedientes/${expedienteId}/subsanar`)
      .set('Authorization', `Bearer ${tokenCiudadano}`)
      .send({
        motivo: 'Se adjunta copia corregida del documento solicitado.',
      });

    expect(resSubsanar.status).toBe(200);
    expect(resSubsanar.body.estado).toBe('SUBSANADO');
    expect(resSubsanar.body.estadoRutaDoc).toBe('SUBSANADO');

    // Verificar en BD que el expediente quedó estrictamente en SUBSANADO (NO EN_REVISION)
    const resBD = await pool.query<{ estado: string }>(
      `SELECT estado FROM sigd_tra.expediente WHERE expediente_id = $1::uuid`,
      [expedienteId],
    );
    expect(resBD.rows[0].estado).toBe('SUBSANADO');

    // Verificar proyección de estado actual
    const resProy = await pool.query<{ estado_nuevo: string }>(
      `SELECT estado_nuevo FROM sigd_rut.estado_actual_expediente WHERE expediente_id = $1::uuid`,
      [expedienteId],
    );
    expect(resProy.rows[0].estado_nuevo).toBe('SUBSANADO');

    // Verificar movimiento WORM único: OBSERVADO -> CORRECCION -> SUBSANADO
    const resMov = await pool.query<{ estado_anterior: string; evento: string; estado_nuevo: string }>(
      `SELECT estado_anterior, evento, estado_nuevo 
         FROM sigd_rut.movimiento_tramite 
        WHERE expediente_id = $1::uuid 
        ORDER BY secuencia DESC LIMIT 1`,
      [expedienteId],
    );
    expect(resMov.rows[0].estado_anterior).toBe('OBSERVADO');
    expect(resMov.rows[0].evento).toBe('CORRECCION');
    expect(resMov.rows[0].estado_nuevo).toBe('SUBSANADO');
  });

  // ===========================================================================
  // TC-C3.6.2-06: NO PERMITIR DERIVAR DIRECTAMENTE DESDE SUBSANADO
  // ===========================================================================
  it('TC-C3.6.2-06: No se permite derivar directamente un expediente en estado SUBSANADO (HTTP 400/422)', async () => {
    const { expedienteId } = await crearExpedientePrueba({
      codigoRef: 'p1-fila-06',
      registroVersionId: procInglesRegVerId,
      idProcedimiento: procInglesId,
      pagoConfirmado: true,
      estado: 'SUBSANADO',
    });

    const resDerivar = await request(app)
      .post(`/api/v1/expedientes/${expedienteId}/derivar`)
      .set('Authorization', `Bearer ${tokenMesaPartes}`)
      .set('x-contexto-operacion', 'INSTITUCIONAL')
      .send({
        destinos: [{ area_destino_id: sdaAreaId, es_copia: false }],
        proveido: 'Intento de derivar sin iniciar revisión',
      });

    // Rechazado por estado inválido
    expect([400, 422]).toContain(resDerivar.status);
    expect(resDerivar.body.code).toBe('ESTADO_INVALIDO');
  });

  // ===========================================================================
  // TC-C3.6.2-07: CIUDADANO NO PUEDE INICIAR REVISIÓN (HTTP 403)
  // ===========================================================================
  it('TC-C3.6.2-07: Ciudadano administrado no puede autoavanzar expediente mediante iniciar-revision (HTTP 403)', async () => {
    const { expedienteId } = await crearExpedientePrueba({
      codigoRef: 'p1-fila-06',
      registroVersionId: procInglesRegVerId,
      idProcedimiento: procInglesId,
      pagoConfirmado: true,
      estado: 'SUBSANADO',
    });

    const res = await request(app)
      .post(`/api/v1/expedientes/${expedienteId}/iniciar-revision`)
      .set('Authorization', `Bearer ${tokenCiudadano}`)
      .send({
        motivo: 'Intento ciudadano no autorizado',
      });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('ADMINISTRADO_NO_AUTORIZADO');
  });

  // ===========================================================================
  // TC-C3.6.2-08: ACTOR AUTORIZADO INICIA REVISIÓN FORMAL -> EN_REVISION (HTTP 200)
  // ===========================================================================
  it('TC-C3.6.2-08: Actor institucional autorizado inicia revisión formal transicionando a EN_REVISION con WORM independiente', async () => {
    const { expedienteId } = await crearExpedientePrueba({
      codigoRef: 'p1-fila-06',
      registroVersionId: procInglesRegVerId,
      idProcedimiento: procInglesId,
      pagoConfirmado: true,
      estado: 'SUBSANADO',
    });

    // Funcionario de Mesa de Partes ejecuta iniciar-revision
    const res = await request(app)
      .post(`/api/v1/expedientes/${expedienteId}/iniciar-revision`)
      .set('Authorization', `Bearer ${tokenMesaPartes}`)
      .set('x-contexto-operacion', 'INSTITUCIONAL')
      .send({
        motivo: 'Revisión formal de documentos subsanados',
      });

    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('EN_REVISION');
    expect(res.body.nuevoEstado).toBe('EN_REVISION');

    // Verificar en BD que el expediente quedó en EN_REVISION
    const resBD = await pool.query<{ estado: string }>(
      `SELECT estado FROM sigd_tra.expediente WHERE expediente_id = $1::uuid`,
      [expedienteId],
    );
    expect(resBD.rows[0].estado).toBe('EN_REVISION');

    // Verificar movimiento WORM independiente: SUBSANADO -> INICIAR_REVISION -> EN_REVISION
    const resMov = await pool.query<{ estado_anterior: string; evento: string; estado_nuevo: string }>(
      `SELECT estado_anterior, evento, estado_nuevo 
         FROM sigd_rut.movimiento_tramite 
        WHERE expediente_id = $1::uuid 
        ORDER BY secuencia DESC LIMIT 1`,
      [expedienteId],
    );
    expect(resMov.rows[0].estado_anterior).toBe('SUBSANADO');
    expect(resMov.rows[0].evento).toBe('INICIAR_REVISION');
    expect(resMov.rows[0].estado_nuevo).toBe('EN_REVISION');
  });

  // ===========================================================================
  // TC-C3.6.2-09: CONSULTA CENTRALIZADA DE ELEGIBILIDAD DE DERIVACIÓN
  // ===========================================================================
  it('TC-C3.6.2-09: GET /elegibilidad-derivacion y /resumen exponen contrato unificado de gates', async () => {
    const { expedienteId } = await crearExpedientePrueba({
      codigoRef: 'p5-fila-21',
      registroVersionId: procTrasladoExtRegVerId,
      idProcedimiento: procTrasladoExtId,
      pagoConfirmado: false, // Pago pendiente
      estado: 'EN_CALIFICACION',
    });

    // 1. Consulta al endpoint dedicado
    const resEleg = await request(app)
      .get(`/api/v1/expedientes/${expedienteId}/elegibilidad-derivacion`)
      .set('Authorization', `Bearer ${tokenMesaPartes}`);

    expect(resEleg.status).toBe(200);
    expect(resEleg.body.puedeDerivar).toBe(false);
    expect(resEleg.body.requisitosConformes).toBe(false);
    expect(resEleg.body.pagoConforme).toBe(false);
    expect(resEleg.body.bloqueos).toContain('REQUISITOS_DOCUMENTALES_PENDIENTES');
    expect(resEleg.body.bloqueos).toContain('PAGO_PENDIENTE');

    // 2. Consulta en el consolidado /resumen
    const resResumen = await request(app)
      .get(`/api/v1/expedientes/${expedienteId}/resumen`)
      .set('Authorization', `Bearer ${tokenMesaPartes}`);

    expect(resResumen.status).toBe(200);
    expect(resResumen.body.elegibilidadDerivacion).toBeDefined();
    expect(resResumen.body.elegibilidadDerivacion.puedeDerivar).toBe(false);
    expect(resResumen.body.elegibilidadDerivacion.bloqueos).toContain('REQUISITOS_DOCUMENTALES_PENDIENTES');
    expect(resResumen.body.elegibilidadDerivacion.bloqueos).toContain('PAGO_PENDIENTE');
  });
});
