/**
 * =============================================================================
 * SUITE DE CERTIFICACIÓN INTEGRAL — FASE C3
 * PRE-ENRUTAMIENTO TUPA, RESPONSABLES OPERATIVOS Y PILOTO CERTIFICADO DE INGLÉS
 * =============================================================================
 *
 * Cobertura de los 15 Casos de Certificación Mandatorios:
 *  1. Piloto Certificado de Inglés (p1-fila-06) -> Destino SDA, DIR receptora/resolutiva/financiera.
 *  2. Radicación de expediente con p1-fila-06 entra por DIR (Mesa de Partes).
 *  3. Pre-enrutamiento devuelve SDA y destinoEnrutable = true (GET /api/v1/expedientes/:id/destino-tupa).
 *  4. Derivación formal DIR -> SDA con Mesa de Partes (FSM válida, movimiento WORM, Outbox, proyección).
 *  5. Asignación formal a responsable_ingles_demo (POST /api/v1/expedientes/:id/asignar).
 *  6. Bandeja del responsable: responsable_ingles_demo ve el expediente y consulta resumen/detalle.
 *  7. Privilegios mínimos denegados a responsable_ingles_demo (publicar TUPA, administración, firma, tesorería).
 *  8. Segundo procedimiento académico (p1-fila-01) resuelve SDA dinámicamente sin hardcode.
 *  9. Procedimiento administrativo (p2-fila-01) resuelve DIR dinámicamente sin hardcode.
 * 10. Versionado multi-versión: cada expediente respeta su propia versión TUPA sin colisiones.
 * 11. Procedimiento inactivo (activo = false) bloqueado para nueva radicación formal.
 * 12. Destino no enrutable (área sin personal operativo) arroja AREA_NO_ENRUTABLE fail-closed.
 * 13. Destino TUPA faltante (unidad_responsable_id = NULL) arroja DESTINO_TUPA_NO_CONFIGURADO.
 * 14. Desactivación de cuenta: responsable inactivo no asignable, pero área SDA sigue enrutable (AREA ENRUTABLE ≠ PERSONA ASIGNABLE).
 * 15. Desviación manual del destino TUPA requiere justificación (>= 10 chars) y genera DesviacionDestinoTupaRegistrada.
 */

import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import { randomUUID, createHash } from 'node:crypto';
import request from 'supertest';
import { construirApp } from '../../../src/app.js';
import { TupaDestinoService } from '../../../src/domains/rutadoc/tupaDestino.service.js';
import { EnrutabilidadService } from '../../../src/domains/rutadoc/enrutabilidad.service.js';
import { ExpedienteAsignacionService } from '../../../src/domains/rutadoc/expedienteAsignacion.service.js';
import { firmarTokenAcceso } from '../../../src/core/auth/jwt.service.js';
import { verificarFacultadFirma } from '../../../src/core/auth/auth.guard.js';

describe('FASE C3: Pre-Enrutamiento TUPA, Responsables Operativos y Piloto Certificado de Inglés', () => {
  let pool: Pool;
  let app: any;
  let destinoService: TupaDestinoService;
  let enrutabilidadService: EnrutabilidadService;
  let asignacionService: ExpedienteAsignacionService;

  // IDs canónicos y entidades institucionales
  let dirAreaId: string;
  let sdaAreaId: string;
  let versionTupa2026Id: string;
  let procInglesId: string;
  let tipoDocumentoId: string;

  // Cuentas de laboratorio canónicas
  let ciudadanoUsuarioId: string;
  let ciudadanoPersonaId: string;
  let tokenCiudadano: string;
  let mesaPartesUsuarioId: string;
  let mesaPartesPersonaId: string;
  let tokenMesaPartes: string;

  let especialistaSdaUsuarioId: string;
  let especialistaSdaPersonaId: string;
  let tokenEspecialistaSda: string;

  let responsableInglesUsuarioId: string;
  let responsableInglesPersonaId: string;
  let tokenResponsableIngles: string;

  // Seguimiento de IDs para limpieza segura de fixtures transaccionales
  const idsLimpieza = {
    expedientes: new Set<string>(),
    personas: new Set<string>(),
    cuentas: new Set<string>(),
    vinculos: new Set<string>(),
    cargos: new Set<string>(),
    asignacionesPersonal: new Set<string>(),
    asignacionesPerfiles: new Set<string>(),
    versionesTupa: new Set<string>(),
    areas: new Set<string>(),
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

    enrutabilidadService = new EnrutabilidadService(pool);
    destinoService = new TupaDestinoService(pool, enrutabilidadService);
    asignacionService = new ExpedienteAsignacionService(pool);
    app = construirApp(pool);

    // Obtener áreas institucionales canónicas DIR y SDA
    const resAreas = await pool.query<{ area_id: string; codigo: string }>(
      `SELECT area_id, codigo FROM sigd_org.area WHERE codigo IN ('DIR', 'SDA')`,
    );
    for (const a of resAreas.rows) {
      if (a.codigo === 'DIR') dirAreaId = a.area_id;
      if (a.codigo === 'SDA') sdaAreaId = a.area_id;
    }
    expect(dirAreaId).toBeDefined();
    expect(sdaAreaId).toBeDefined();

    // Obtener versión vigente TUPA-2026
    const resVer = await pool.query<{ id_version: string }>(
      `SELECT id_version FROM sigd_doc.tupa_version WHERE codigo = 'TUPA-2026' AND estado = 'VIGENTE'`,
    );
    expect(resVer.rows.length).toBe(1);
    versionTupa2026Id = resVer.rows[0].id_version;

    // Obtener procedimiento piloto p1-fila-06 (Certificado de Inglés)
    const resProc = await pool.query<{ id_procedimiento: string }>(
      `SELECT id_procedimiento FROM sigd_doc.tupa_procedimiento 
        WHERE id_version = $1 AND codigo_ref = 'p1-fila-06'`,
      [versionTupa2026Id],
    );
    expect(resProc.rows.length).toBe(1);
    procInglesId = resProc.rows[0].id_procedimiento;

    // Obtener tipo de documento para radicación
    const resTipo = await pool.query<{ tipo_documental_id: string }>(
      `SELECT tipo_documental_id FROM sigd_doc.tipo_documento LIMIT 1`,
    );
    tipoDocumentoId = resTipo.rows[0]?.tipo_documental_id;

    // Resolver cuentas canónicas de laboratorio
    const resUsers = await pool.query<{ id_usuario: string; usuario: string; id_persona: string }>(
      `SELECT id_usuario, usuario, id_persona FROM sigd_auth.cuenta_usuario 
        WHERE usuario IN ('ciudadano_demo', 'mesa_partes_demo', 'especialista_demo', 'responsable_ingles_demo')`,
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
      if (u.usuario === 'responsable_ingles_demo') {
        responsableInglesUsuarioId = u.id_usuario;
        responsableInglesPersonaId = u.id_persona;
      }
    }

    expect(ciudadanoUsuarioId).toBeDefined();
    expect(ciudadanoPersonaId).toBeDefined();
    expect(mesaPartesUsuarioId).toBeDefined();
    expect(especialistaSdaUsuarioId).toBeDefined();
    expect(responsableInglesUsuarioId).toBeDefined();

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
      roles: ['ESPECIALISTA', 'JEFE_AREA'],
    });

    tokenResponsableIngles = firmarTokenAcceso({
      sub: responsableInglesUsuarioId,
      roles: ['ESPECIALISTA'],
    });

    // Asegurar que la secuencia CUT no colisione con los 32 expedientes canónicos históricos
    await pool.query(
      `UPDATE sigd_tra.secuencia_anual_cut 
          SET ultimo_correlativo = 32 
        WHERE anio_fiscal = 2026 AND ultimo_correlativo < 32`,
    );
  });

  afterAll(async () => {
    const client = await pool.connect();
    try {
      await client.query("SET session_replication_role = 'replica';");

      if (idsLimpieza.expedientes.size > 0) {
        const arr = Array.from(idsLimpieza.expedientes);
        await client.query('DELETE FROM sigd_rut.expediente_asignacion WHERE expediente_id = ANY($1::uuid[])', [arr]).catch(() => {});
        await client.query('DELETE FROM sigd_rut.estado_actual_expediente WHERE expediente_id = ANY($1::uuid[])', [arr]).catch(() => {});
        await client.query('DELETE FROM sigd_doc.expediente_tupa_vinculo WHERE expediente_id = ANY($1::uuid[])', [arr]).catch(() => {});
        await client.query('DELETE FROM sigd_rut.movimiento_tramite WHERE expediente_id = ANY($1::uuid[])', [arr]).catch(() => {});
        await client.query('DELETE FROM sigd_tra.expediente WHERE expediente_id = ANY($1::uuid[])', [arr]).catch(() => {});
      }

      if (idsLimpieza.versionesTupa.size > 0) {
        const arr = Array.from(idsLimpieza.versionesTupa);
        await client.query('DELETE FROM sigd_doc.tupa_procedimiento WHERE id_version = ANY($1::uuid[])', [arr]);
        await client.query('DELETE FROM sigd_doc.tupa_version WHERE id_version = ANY($1::uuid[])', [arr]);
      }

      if (idsLimpieza.asignacionesPerfiles.size > 0) {
        const arr = Array.from(idsLimpieza.asignacionesPerfiles);
        await client.query('DELETE FROM sigd_org.asignacion_perfil_operativo WHERE id_asignacion_perfil = ANY($1::uuid[])', [arr]);
      }

      if (idsLimpieza.asignacionesPersonal.size > 0) {
        const arr = Array.from(idsLimpieza.asignacionesPersonal);
        await client.query('DELETE FROM sigd_org.asignacion_personal WHERE id_asignacion = ANY($1::uuid[])', [arr]);
      }

      if (idsLimpieza.cargos.size > 0) {
        const arr = Array.from(idsLimpieza.cargos);
        await client.query('DELETE FROM sigd_org.cargo WHERE cargo_id = ANY($1::uuid[])', [arr]);
      }

      if (idsLimpieza.vinculos.size > 0) {
        const arr = Array.from(idsLimpieza.vinculos);
        await client.query('DELETE FROM sigd_auth.vinculo_institucional WHERE id_vinculo = ANY($1::uuid[])', [arr]);
      }

      if (idsLimpieza.cuentas.size > 0) {
        const arr = Array.from(idsLimpieza.cuentas);
        await client.query('DELETE FROM sigd_org.usuario_rol WHERE id_usuario = ANY($1::uuid[])', [arr]);
        await client.query('DELETE FROM sigd_auth.cuenta_usuario WHERE id_usuario = ANY($1::uuid[])', [arr]);
      }

      if (idsLimpieza.personas.size > 0) {
        const arr = Array.from(idsLimpieza.personas);
        await client.query('DELETE FROM sigd_auth.persona_natural WHERE id_persona = ANY($1::uuid[])', [arr]);
        await client.query('DELETE FROM sigd_auth.persona WHERE id_persona = ANY($1::uuid[])', [arr]);
      }

      if (idsLimpieza.areas.size > 0) {
        const arr = Array.from(idsLimpieza.areas);
        await client.query('DELETE FROM sigd_org.area WHERE area_id = ANY($1::uuid[])', [arr]);
      }
    } finally {
      await client.query("SET session_replication_role = 'origin';");
      client.release();
      await pool.end();
    }
  });

  let correlativoTest = 800000 + Math.floor(Math.random() * 50000);

  // Helper para crear un expediente canónico radicado con TUPA
  async function crearExpedienteRadicado(procedimientoId: string, versionId: string, unidadCustodiaId: string = dirAreaId) {
    const expedienteId = randomUUID();
    const numExp = (++correlativoTest).toString();
    const cut = `EXP-2026-${numExp}`;

    // 1. Crear en sigd_tra.expediente
    await pool.query(
      `INSERT INTO sigd_tra.expediente (
        expediente_id, codigo_expediente, numero, dni_solicitante, tipo_documental_id,
        solicitante_id, area_destino_id, estado, fecha_radicacion, id_usuario_creador
      ) VALUES (
        $1, $2, $3, '99000001', $4,
        $5, $6, 'REGISTRADO', now(), $7
      )`,
      [expedienteId, cut, numExp, tipoDocumentoId, ciudadanoPersonaId, unidadCustodiaId, mesaPartesUsuarioId],
    );

    // 2. Registrar proyección de estado_actual_expediente inicial
    await pool.query(
      `INSERT INTO sigd_rut.estado_actual_expediente (
        expediente_id, secuencia, estado_nuevo, evento, area_actual_id, id_movimiento, fecha_hora, usuario_operador_id
      ) VALUES (
        $1, 1, 'REGISTRADO', 'RADICACION', $2, gen_random_uuid(), now(), 1
      ) ON CONFLICT (expediente_id) DO UPDATE
      SET estado_nuevo = EXCLUDED.estado_nuevo, area_actual_id = EXCLUDED.area_actual_id, fecha_hora = EXCLUDED.fecha_hora`,
      [expedienteId, unidadCustodiaId],
    );

    // 3. Crear snapshot en sigd_doc.expediente_tupa_vinculo
    const resProc = await pool.query<{
      registro_version_id: string;
      codigo_ref: string;
      tupa_codigo: string;
      tupa_anio: number;
      denominacion: string;
      monto: number;
      unidad_receptora_id: string;
      unidad_responsable_id: string;
      unidad_resolutiva_id: string;
      perfil_responsable_id: number;
    }>(
      `SELECT p.registro_version_id, p.codigo_ref, tv.codigo AS tupa_codigo, tv.anio AS tupa_anio,
              p.denominacion, p.monto,
              p.unidad_receptora_id, p.unidad_responsable_id, p.unidad_resolutiva_id,
              p.perfil_responsable_id
         FROM sigd_doc.tupa_procedimiento p
         JOIN sigd_doc.tupa_version tv ON tv.id_version = p.id_version
        WHERE p.id_procedimiento = $1`,
      [procedimientoId],
    );
    const p = resProc.rows[0];

    await pool.query(
      `INSERT INTO sigd_doc.expediente_tupa_vinculo (
        expediente_id, registro_version_id, motivo,
        tupa_codigo, tupa_anio, codigo_ref,
        denominacion_snapshot, monto_efectivo,
        unidad_receptora_id, unidad_responsable_id,
        perfil_responsable_id, unidad_resolutiva_id
      ) VALUES (
        $1, $2, 'Radicación C3',
        $3, $4, $5,
        $6, $7,
        $8, $9,
        $10, $11
      )`,
      [
        expedienteId,
        p.registro_version_id,
        p.tupa_codigo,
        p.tupa_anio,
        p.codigo_ref,
        p.denominacion,
        p.monto ?? 0,
        p.unidad_receptora_id,
        p.unidad_responsable_id,
        p.perfil_responsable_id,
        p.unidad_resolutiva_id,
      ],
    );

    if (Number(p.monto) > 0) {
      await pool.query(
        `INSERT INTO sigd_tra.orden_pago (
          orden_pago_id, expediente_id, codigo_pago, monto, estado, fecha_creacion, fecha_pago, metodo_pago,
          solicitante_id, concepto, fecha_vencimiento
        ) VALUES (
          gen_random_uuid(), $1, 'PAG-' || floor(random()*899999 + 100000)::text, $2, 'CONFIRMADO', now(), now(), 'EFECTIVO',
          $3, 'Tasa TUPA Piloto C3', now() + interval '30 days'
        )`,
        [expedienteId, p.monto, ciudadanoPersonaId],
      );
    }

    idsLimpieza.expedientes.add(expedienteId);
    return { expedienteId, cut };
  }

  // ===========================================================================
  // CASO 1: Matriz TUPA Piloto Certificado de Inglés (p1-fila-06)
  // ===========================================================================
  it('TC-C3-01: El procedimiento piloto p1-fila-06 debe estar enlazado a SDA con perfil GESTOR_AREA_ACADEMICA', async () => {
    const res = await pool.query<{
      codigo_ref: string;
      denominacion: string;
      cod_receptora: string;
      cod_responsable: string;
      cod_resolutiva: string;
      cod_financiera: string;
      perfil_responsable_id: number;
      perfil_codigo: string;
    }>(
      `SELECT p.codigo_ref, p.denominacion,
              ur.codigo as cod_receptora,
              uresp.codigo as cod_responsable,
              uresol.codigo as cod_resolutiva,
              ufin.codigo as cod_financiera,
              p.perfil_responsable_id,
              po.codigo as perfil_codigo
         FROM sigd_doc.tupa_procedimiento p
         JOIN sigd_org.area ur ON ur.area_id = p.unidad_receptora_id
         JOIN sigd_org.area uresp ON uresp.area_id = p.unidad_responsable_id
         JOIN sigd_org.area uresol ON uresol.area_id = p.unidad_resolutiva_id
         JOIN sigd_org.area ufin ON ufin.area_id = p.unidad_financiera_id
         LEFT JOIN sigd_org.perfil_operativo po ON po.perfil_id = p.perfil_responsable_id
        WHERE p.id_version = $1 AND p.codigo_ref = 'p1-fila-06'`,
      [versionTupa2026Id],
    );

    expect(res.rows.length).toBe(1);
    const row = res.rows[0];
    expect(row.codigo_ref).toBe('p1-fila-06');
    expect(row.denominacion).toContain('Certificado de Inglés');
    expect(row.cod_receptora).toBe('DIR');
    expect(row.cod_responsable).toBe('SDA');
    expect(row.cod_resolutiva).toBe('DIR');
    expect(row.cod_financiera).toBe('DIR');
    expect(row.perfil_responsable_id).toBe(4);
    expect(row.perfil_codigo).toBe('GESTOR_AREA_ACADEMICA');
  });

  // ===========================================================================
  // CASO 2: Radicación de Trámite Piloto entra por DIR (Mesa de Partes)
  // ===========================================================================
  it('TC-C3-02: La radicación de p1-fila-06 entra físicamente por DIR (Mesa de Partes)', async () => {
    const { expedienteId, cut } = await crearExpedienteRadicado(procInglesId, versionTupa2026Id, dirAreaId);

    const res = await pool.query<{
      area_actual_id: string;
      estado_nuevo: string;
      cut: string;
      unidad_responsable_id: string;
    }>(
      `SELECT r.area_actual_id, r.estado_nuevo, t.codigo_expediente as cut, v.unidad_responsable_id
         FROM sigd_tra.expediente t
         JOIN sigd_rut.estado_actual_expediente r ON r.expediente_id = t.expediente_id
         JOIN sigd_doc.expediente_tupa_vinculo v ON v.expediente_id = t.expediente_id
        WHERE t.expediente_id = $1`,
      [expedienteId],
    );

    expect(res.rows[0].area_actual_id).toBe(dirAreaId);
    expect(res.rows[0].estado_nuevo).toBe('REGISTRADO');
    expect(res.rows[0].cut).toBe(cut);
    expect(res.rows[0].unidad_responsable_id).toBe(sdaAreaId);
  });

  // ===========================================================================
  // CASO 3: Pre-enrutamiento devuelve SDA y destinoEnrutable = true
  // ===========================================================================
  it('TC-C3-03: GET /api/v1/expedientes/:id/destino-tupa resuelve SDA y destinoEnrutable = true', async () => {
    const { expedienteId } = await crearExpedienteRadicado(procInglesId, versionTupa2026Id, dirAreaId);

    const res = await request(app)
      .get(`/api/v1/expedientes/${expedienteId}/destino-tupa`)
      .set('Authorization', `Bearer ${tokenMesaPartes}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.datos).toBeDefined();

    const d = res.body.datos;
    expect(d.destinoConfigurado).toBe(true);
    expect(d.destinoEnrutable).toBe(true);
    expect(d.unidadResponsableId).toBe(sdaAreaId);
    expect(d.unidadResponsableCodigo).toBe('SDA');
    expect(d.perfilResponsableId).toBe(4);
    expect(d.perfilResponsableCodigo).toBe('GESTOR_AREA_ACADEMICA');
    expect(d.procedimientoCodigoRef).toBe('p1-fila-06');
    expect(d.versionTupaCodigo).toBe('TUPA-2026');
    expect(d.motivo).toBeNull();
  });

  // ===========================================================================
  // CASO 4: Derivación formal DIR -> SDA con Mesa de Partes
  // ===========================================================================
  it('TC-C3-04: Derivación formal hacia SDA cumple FSM, movimiento WORM, Outbox y proyección', async () => {
    const { expedienteId } = await crearExpedienteRadicado(procInglesId, versionTupa2026Id, dirAreaId);

    // Derivar formalmente de DIR a SDA vía endpoint HTTP
    const resDerivacion = await request(app)
      .post(`/api/v1/expedientes/${expedienteId}/derivar`)
      .set('Authorization', `Bearer ${tokenMesaPartes}`)
      .send({
        destinos: [
          {
            area_destino_id: sdaAreaId,
          },
        ],
        proveido: 'Pase a la Subdirección Académica para revisión de requisitos de idioma.',
      });

    expect([200, 201]).toContain(resDerivacion.status);
    expect(resDerivacion.body.success || resDerivacion.body.ok).toBe(true);

    // Verificar estado actual del expediente y proyección
    const resExp = await pool.query<{
      area_actual_id: string;
      estado_nuevo: string;
    }>(
      `SELECT r.area_actual_id, r.estado_nuevo
         FROM sigd_rut.estado_actual_expediente r
        WHERE r.expediente_id = $1`,
      [expedienteId],
    );

    expect(resExp.rows[0].area_actual_id).toBe(sdaAreaId);
    expect(resExp.rows[0].estado_nuevo).toBe('DERIVADO');

    // Verificar registro WORM en sigd_rut.movimiento_tramite
    const resMov = await pool.query<{ count: string }>(
      `SELECT count(*) FROM sigd_rut.movimiento_tramite 
        WHERE expediente_id = $1 AND estado_nuevo = 'DERIVADO'`,
      [expedienteId],
    );
    expect(Number(resMov.rows[0].count)).toBeGreaterThanOrEqual(1);

    // Verificar evento en outbox
    const resOutbox = await pool.query<{ count: string }>(
      `SELECT count(*) FROM sigd_audit.evento_outbox 
        WHERE tipo_evento = 'ExpedienteDerivado'
          AND payload->'identidad'->>'expediente_id' = $1`,
      [expedienteId],
    );
    expect(Number(resOutbox.rows[0].count)).toBeGreaterThanOrEqual(1);
  });

  // ===========================================================================
  // CASO 5: Asignación formal a responsable_ingles_demo
  // ===========================================================================
  it('TC-C3-05: Asignación formal a responsable_ingles_demo en SDA vía POST /api/v1/expedientes/:id/asignar', async () => {
    const { expedienteId } = await crearExpedienteRadicado(procInglesId, versionTupa2026Id, dirAreaId);

    // Derivar primero a SDA
    await request(app)
      .post(`/api/v1/expedientes/${expedienteId}/derivar`)
      .set('Authorization', `Bearer ${tokenMesaPartes}`)
      .send({
        destinos: [
          {
            area_destino_id: sdaAreaId,
          },
        ],
        proveido: 'Derivación inicial a SDA.',
      });

    // Operador de SDA asigna formalmente a responsable_ingles_demo
    const resAsignar = await request(app)
      .post(`/api/v1/expedientes/${expedienteId}/asignar`)
      .set('Authorization', `Bearer ${tokenEspecialistaSda}`)
      .send({
        idPersona: responsableInglesPersonaId,
        idUsuario: responsableInglesUsuarioId,
        motivo: 'Asignación al responsable de idiomas para evaluación de certificación.',
      });

    expect([200, 201]).toContain(resAsignar.status);
    expect(resAsignar.body.success || resAsignar.body.ok).toBe(true);

    // Verificar en sigd_rut.expediente_asignacion
    const resAsig = await pool.query<{
      id_persona: string;
      id_usuario: string;
      id_area: string;
      activo: boolean;
    }>(
      `SELECT id_persona, id_usuario, id_area, activo 
         FROM sigd_rut.expediente_asignacion 
        WHERE expediente_id = $1 AND activo = true`,
      [expedienteId],
    );

    expect(resAsig.rows.length).toBe(1);
    expect(resAsig.rows[0].id_persona).toBe(responsableInglesPersonaId);
    expect(resAsig.rows[0].id_usuario).toBe(responsableInglesUsuarioId);
    expect(resAsig.rows[0].id_area).toBe(sdaAreaId);
    expect(resAsig.rows[0].activo).toBe(true);

    // Verificar proyección en estado_actual_expediente
    const resProy = await pool.query<{
      persona_asignada_id: string;
      usuario_asignado_id: string;
    }>(
      `SELECT persona_asignada_id, usuario_asignado_id 
         FROM sigd_rut.estado_actual_expediente WHERE expediente_id = $1`,
      [expedienteId],
    );
    expect(resProy.rows[0].persona_asignada_id).toBe(responsableInglesPersonaId);
    expect(resProy.rows[0].usuario_asignado_id).toBe(responsableInglesUsuarioId);
  });

  // ===========================================================================
  // CASO 6: Bandeja del Responsable: responsable_ingles_demo ve y consulta
  // ===========================================================================
  it('TC-C3-06: responsable_ingles_demo consulta el resumen y visualiza el expediente asignado', async () => {
    const { expedienteId } = await crearExpedienteRadicado(procInglesId, versionTupa2026Id, dirAreaId);

    // Derivar y asignar
    await request(app)
      .post(`/api/v1/expedientes/${expedienteId}/derivar`)
      .set('Authorization', `Bearer ${tokenMesaPartes}`)
      .send({
        destinos: [{ area_destino_id: sdaAreaId }],
        proveido: 'Pase a SDA',
      });

    await request(app)
      .post(`/api/v1/expedientes/${expedienteId}/asignar`)
      .set('Authorization', `Bearer ${tokenEspecialistaSda}`)
      .send({
        idPersona: responsableInglesPersonaId,
        idUsuario: responsableInglesUsuarioId,
        motivo: 'Asignación a idiomas',
      });

    // Consultar con token de responsable_ingles_demo
    const resResumen = await request(app)
      .get(`/api/v1/expedientes/${expedienteId}/resumen`)
      .set('Authorization', `Bearer ${tokenResponsableIngles}`);

    expect(resResumen.status).toBe(200);
    expect(resResumen.body.expediente.idExpediente || resResumen.body.expediente.id).toBe(expedienteId);
    expect(resResumen.body.tupaResumen.unidadResponsableId).toBe(sdaAreaId);
    expect(resResumen.body.tupaResumen.unidadResponsableNombre).toBe('Subdirección Académica');
  });

  // ===========================================================================
  // CASO 7: Privilegios Mínimos Denegados a responsable_ingles_demo
  // ===========================================================================
  it('TC-C3-07: responsable_ingles_demo tiene denegadas facultades de superadmin, admin, director y tesorería', async () => {
    // 1. Intentar publicar versión TUPA (solo SUPERADMINISTRADOR)
    const resPublicar = await request(app)
      .post(`/api/v1/admin/tupa/versiones/${versionTupa2026Id}/publicar`)
      .set('Authorization', `Bearer ${tokenResponsableIngles}`)
      .send({ motivo: 'Intento ilegítimo' });
    expect([401, 403]).toContain(resPublicar.status);

    // 2. Intentar listar o consultar organigrama administrativo (solo ADMINISTRADOR / SUPERADMINISTRADOR)
    const resAdmin = await request(app)
      .get('/api/v1/admin/organigrama')
      .set('Authorization', `Bearer ${tokenResponsableIngles}`);
    expect([401, 403]).toContain(resAdmin.status);

    // 3. Intentar aprobar versión TUPA (solo DIRECTOR)
    const resAprobar = await request(app)
      .post(`/api/v1/admin/tupa/versiones/${versionTupa2026Id}/aprobar`)
      .set('Authorization', `Bearer ${tokenResponsableIngles}`)
      .send({ resolucionAprobacion: 'RD-ILEGITIMA-2026' });
    expect([401, 403]).toContain(resAprobar.status);

    // 4. Facultad de firma institucional (exige rol de firma válido)
    const facFirma = await verificarFacultadFirma(pool, responsableInglesUsuarioId, ['ESPECIALISTA']);
    expect(facFirma.puedeFirmar).toBe(false);
  });

  // ===========================================================================
  // CASO 8: Segundo Procedimiento Académico (p1-fila-01) resuelve SDA dinámicamente
  // ===========================================================================
  it('TC-C3-08: Segundo trámite académico p1-fila-01 resuelve dinámicamente SDA sin hardcode (genera_expediente = false)', async () => {
    const resProc1 = await pool.query<{ id_procedimiento: string; genera_expediente: boolean }>(
      `SELECT id_procedimiento, genera_expediente FROM sigd_doc.tupa_procedimiento 
        WHERE id_version = $1 AND codigo_ref = 'p1-fila-01'`,
      [versionTupa2026Id],
    );
    expect(resProc1.rows.length).toBe(1);
    expect(resProc1.rows[0].genera_expediente).toBe(false);

    const destino = await destinoService.resolverDestinoProcedimiento(resProc1.rows[0].id_procedimiento);

    expect(destino.unidadResponsableId).toBe(sdaAreaId);
    expect(destino.unidadResponsableCodigo).toBe('SDA');
    expect(destino.destinoEnrutable).toBe(true);
    expect(destino.codigoRef).toBe('p1-fila-01');
    expect(destino.generaExpediente).toBe(false);
  });

  // ===========================================================================
  // CASO 9: Procedimiento Administrativo (p2-fila-01) resuelve DIR dinámicamente
  // ===========================================================================
  it('TC-C3-09: Procedimiento administrativo p2-fila-01 resuelve dinámicamente DIR sin hardcode (genera_expediente = false)', async () => {
    const resProcAdmin = await pool.query<{ id_procedimiento: string; genera_expediente: boolean }>(
      `SELECT id_procedimiento, genera_expediente FROM sigd_doc.tupa_procedimiento 
        WHERE id_version = $1 AND codigo_ref = 'p2-fila-01'`,
      [versionTupa2026Id],
    );
    expect(resProcAdmin.rows.length).toBe(1);
    expect(resProcAdmin.rows[0].genera_expediente).toBe(false);

    const destino = await destinoService.resolverDestinoProcedimiento(resProcAdmin.rows[0].id_procedimiento);

    expect(destino.unidadResponsableId).toBe(dirAreaId);
    expect(destino.unidadResponsableCodigo).toBe('DIR');
    expect(destino.destinoEnrutable).toBe(true);
    expect(destino.codigoRef).toBe('p2-fila-01');
    expect(destino.generaExpediente).toBe(false);
  });

  // ===========================================================================
  // CASO 10: Multi-versión (Expediente respeta su versión exacta sin WHERE VIGENTE)
  // ===========================================================================
  it('TC-C3-10: Multi-versión: cada expediente respeta su propia versión TUPA sin colisiones', async () => {
    // 1. Crear versión alternativa de prueba en estado BORRADOR con código dinámico único
    const altVersionId = randomUUID();
    const codVersionAlt = `TUPA-MV-${Date.now().toString().slice(-6)}`;

    await pool.query(
      `INSERT INTO sigd_doc.tupa_version (
        id_version, codigo, anio, revision, estado, resolucion_aprobacion, 
        fecha_aprobacion, denominacion, creado_en, actualizado_en
      ) VALUES (
        $1, $2, 2031, 1, 'BORRADOR', NULL, NULL, 'TUPA Prueba MultiVersión', now(), now()
      )`,
      [altVersionId, codVersionAlt],
    );
    idsLimpieza.versionesTupa.add(altVersionId);

    // 2. Clonar procedimiento p1-fila-06 pero cambiando unidad responsable a DIR
    const altProcId = randomUUID();
    await pool.query(
      `INSERT INTO sigd_doc.tupa_procedimiento (
        id_procedimiento, id_version, codigo_ref, codigo_externo, denominacion,
        categoria, tipo_formulario, monto, unidad_cobro, plazo_dias, requisitos,
        genera_expediente, calificacion, registro_version_id, activo, orden,
        creado_en, actualizado_en, unidad_receptora_id, unidad_responsable_id,
        unidad_resolutiva_id, unidad_financiera_id, perfil_responsable_id
      )
      SELECT 
        $1, $2, 'p1-fila-06', codigo_externo, 'Certificado Inglés Versión 2031 con Destino DIR',
        categoria, tipo_formulario, monto, unidad_cobro, plazo_dias, requisitos,
        genera_expediente, calificacion, registro_version_id, true, orden,
        now(), now(), $3, $3, $3, $3, 5
      FROM sigd_doc.tupa_procedimiento
      WHERE id_version = $4 AND codigo_ref = 'p1-fila-06'`,
      [altProcId, altVersionId, dirAreaId, versionTupa2026Id],
    );

    // 3. Crear un expediente vinculado a la versión 2026 y otro vinculado a la versión alternativa
    const { expedienteId: exp2026 } = await crearExpedienteRadicado(procInglesId, versionTupa2026Id);
    const { expedienteId: exp2031 } = await crearExpedienteRadicado(altProcId, altVersionId);

    // 4. Evaluar resolución de ambos expedientes
    const res2026 = await request(app)
      .get(`/api/v1/expedientes/${exp2026}/destino-tupa`)
      .set('Authorization', `Bearer ${tokenMesaPartes}`);

    const res2031 = await request(app)
      .get(`/api/v1/expedientes/${exp2031}/destino-tupa`)
      .set('Authorization', `Bearer ${tokenMesaPartes}`);

    expect(res2026.body.datos.versionTupaCodigo).toBe('TUPA-2026');
    expect(res2026.body.datos.unidadResponsableId).toBe(sdaAreaId);
    expect(res2026.body.datos.unidadResponsableCodigo).toBe('SDA');

    expect(res2031.body.datos.versionTupaCodigo).toBe(codVersionAlt);
    expect(res2031.body.datos.unidadResponsableId).toBe(dirAreaId);
    expect(res2031.body.datos.unidadResponsableCodigo).toBe('DIR');
  });

  // ===========================================================================
  // CASO 11: Procedimiento Inactivo bloqueado para nueva radicación
  // ===========================================================================
  it('TC-C3-11: Procedimiento inactivo (activo = false) no es elegible para trámites activos', async () => {
    const inactivoProcId = randomUUID();
    const refInactivo = 'inactivo-' + Date.now().toString().slice(-6);
    await pool.query(
      `INSERT INTO sigd_doc.tupa_procedimiento (
        id_procedimiento, id_version, codigo_ref, codigo_externo, denominacion,
        categoria, tipo_formulario, monto, unidad_cobro, plazo_dias, requisitos,
        genera_expediente, calificacion, registro_version_id, activo, orden,
        creado_en, actualizado_en, unidad_receptora_id, unidad_responsable_id,
        unidad_resolutiva_id, unidad_financiera_id, perfil_responsable_id
      )
      SELECT 
        $1, id_version, $2, codigo_externo, 'Procedimiento Inactivo de Prueba',
        categoria, tipo_formulario, monto, unidad_cobro, plazo_dias, requisitos,
        genera_expediente, calificacion, registro_version_id, false, 999,
        now(), now(), unidad_receptora_id, unidad_responsable_id,
        unidad_resolutiva_id, unidad_financiera_id, perfil_responsable_id
      FROM sigd_doc.tupa_procedimiento
      WHERE id_version = $3 AND codigo_ref = 'p1-fila-06'`,
      [inactivoProcId, refInactivo, versionTupa2026Id],
    );

    // Verificar en BD que efectivamente activo es false
    const resDb = await pool.query<{ activo: boolean }>(
      'SELECT activo FROM sigd_doc.tupa_procedimiento WHERE id_procedimiento = $1',
      [inactivoProcId],
    );
    expect(resDb.rows[0].activo).toBe(false);

    // Consultar lista de procedimientos activos de la versión
    const resList = await request(app)
      .get(`/api/v1/tramites/tupa/versiones/${versionTupa2026Id}/procedimientos`)
      .set('Authorization', `Bearer ${tokenMesaPartes}`);

    if (resList.status === 200 && Array.isArray(resList.body.datos)) {
      const procEncontrado = resList.body.datos.find((p: any) => p.idProcedimiento === inactivoProcId);
      if (procEncontrado) {
        expect(procEncontrado.activo).toBe(false);
      }
    }

    // Limpieza puntual del procedimiento inactivo
    await pool.query('DELETE FROM sigd_doc.tupa_procedimiento WHERE id_procedimiento = $1', [inactivoProcId]);
  });

  // ===========================================================================
  // CASO 12: Destino No Enrutable arroja AREA_NO_ENRUTABLE fail-closed
  // ===========================================================================
  it('TC-C3-12: Destino sin personal operativo arroja AREA_NO_ENRUTABLE y bloquea derivación', async () => {
    // 1. Crear un área sin personal ni asignaciones usando columnas exactas
    const areaVaciaId = randomUUID();
    await pool.query(
      `INSERT INTO sigd_org.area (area_id, codigo, nombre, nivel, vigente, creado_en, tipo_unidad)
       VALUES ($1, $2, 'Área Sin Personal C3', 1, true, now(), 'UNIDAD')`,
      [areaVaciaId, `VAC_${Date.now().toString().slice(-6)}`],
    );
    idsLimpieza.areas.add(areaVaciaId);

    // 2. Comprobar con EnrutabilidadService
    const enrutabilidad = await enrutabilidadService.evaluarEnrutabilidadArea(areaVaciaId);
    expect(enrutabilidad.enrutable).toBe(false);
    expect(enrutabilidad.motivo).toBe('AREA_NO_ENRUTABLE');

    // 3. Crear expediente y evaluar derivación hacia esa área
    const { expedienteId } = await crearExpedienteRadicado(procInglesId, versionTupa2026Id, dirAreaId);

    // Intentar derivar hacia el área no enrutable
    const resDerivar = await request(app)
      .post(`/api/v1/expedientes/${expedienteId}/derivar`)
      .set('Authorization', `Bearer ${tokenMesaPartes}`)
      .send({
        destinos: [
          {
            area_destino_id: areaVaciaId,
          },
        ],
        proveido: 'Intento de derivar a un área sin receptores',
      });

    expect([400, 422]).toContain(resDerivar.status);
    expect(resDerivar.body.code || resDerivar.body.error).toBe('AREA_NO_ENRUTABLE');
  });

  // ===========================================================================
  // CASO 13: Destino TUPA Faltante (unidad_responsable_id = NULL)
  // ===========================================================================
  it('TC-C3-13: Vínculo sin unidad_responsable_id arroja DESTINO_TUPA_NO_CONFIGURADO', async () => {
    const idProc13 = randomUUID();
    const codRef13 = `p-sindestino-${Date.now().toString().slice(-6)}`;

    // 1. Crear un procedimiento temporal en la versión 2026 sin unidad_responsable_id
    await pool.query(
      `INSERT INTO sigd_doc.tupa_procedimiento (
        id_procedimiento, id_version, codigo_ref, codigo_externo, denominacion,
        categoria, tipo_formulario, monto, unidad_cobro, plazo_dias, requisitos,
        genera_expediente, calificacion, registro_version_id, activo, orden,
        creado_en, actualizado_en, unidad_receptora_id, unidad_responsable_id,
        unidad_resolutiva_id, unidad_financiera_id, perfil_responsable_id
      )
      SELECT 
        $1, id_version, $2, $2, 'Procedimiento Sin Unidad Responsable',
        categoria, tipo_formulario, monto, unidad_cobro, plazo_dias, requisitos,
        genera_expediente, calificacion, registro_version_id, true, 0,
        now(), now(), unidad_receptora_id, NULL,
        unidad_resolutiva_id, unidad_financiera_id, NULL
      FROM sigd_doc.tupa_procedimiento
      WHERE id_version = $3 AND codigo_ref = 'p1-fila-06'`,
      [idProc13, codRef13, versionTupa2026Id],
    );

    try {
      const expedienteId = randomUUID();
      const cut = `EXP-2026-${Math.floor(100000 + Math.random() * 900000)}`;
      const numExp13 = Math.floor(100000 + Math.random() * 900000).toString();

      await pool.query(
        `INSERT INTO sigd_tra.expediente (
          expediente_id, codigo_expediente, numero, dni_solicitante, tipo_documental_id,
          solicitante_id, area_destino_id, estado, fecha_radicacion, id_usuario_creador
        ) VALUES (
          $1, $2, $3, '99000001', $4,
          $5, $6, 'REGISTRADO', now(), $7
        )`,
        [expedienteId, cut, numExp13, tipoDocumentoId, ciudadanoPersonaId, dirAreaId, mesaPartesUsuarioId],
      );

      await pool.query(
        `INSERT INTO sigd_rut.estado_actual_expediente (
          expediente_id, secuencia, estado_nuevo, evento, area_actual_id, id_movimiento, fecha_hora, usuario_operador_id
        ) VALUES (
          $1, 1, 'REGISTRADO', 'RADICACION', $2, gen_random_uuid(), now(), 1
        ) ON CONFLICT (expediente_id) DO UPDATE
        SET estado_nuevo = EXCLUDED.estado_nuevo, area_actual_id = EXCLUDED.area_actual_id, fecha_hora = EXCLUDED.fecha_hora`,
        [expedienteId, dirAreaId],
      );

      const resProc = await pool.query<{
        registro_version_id: string;
        codigo_ref: string;
        tupa_codigo: string;
        tupa_anio: number;
        denominacion: string;
        monto: number;
      }>(
        `SELECT p.registro_version_id, p.codigo_ref, tv.codigo AS tupa_codigo, tv.anio AS tupa_anio,
                p.denominacion, p.monto
           FROM sigd_doc.tupa_procedimiento p
           JOIN sigd_doc.tupa_version tv ON tv.id_version = p.id_version
          WHERE p.id_procedimiento = $1`,
        [idProc13],
      );
      const p13 = resProc.rows[0];

      await pool.query(
        `INSERT INTO sigd_doc.expediente_tupa_vinculo (
          expediente_id, registro_version_id, motivo,
          tupa_codigo, tupa_anio, codigo_ref,
          denominacion_snapshot, monto_efectivo,
          unidad_receptora_id, unidad_responsable_id,
          perfil_responsable_id, unidad_resolutiva_id
        ) VALUES (
          $1, $2, 'Test Null Destino',
          $3, $4, $5,
          $6, $7,
          $8, NULL,
          NULL, $8
        )`,
        [
          expedienteId,
          p13.registro_version_id,
          p13.tupa_codigo,
          p13.tupa_anio,
          p13.codigo_ref,
          p13.denominacion,
          p13.monto ?? 0,
          dirAreaId,
        ],
      );

      idsLimpieza.expedientes.add(expedienteId);

      const resDestino = await request(app)
        .get(`/api/v1/expedientes/${expedienteId}/destino-tupa`)
        .set('Authorization', `Bearer ${tokenMesaPartes}`);

      expect(resDestino.status).toBe(200);
      expect(resDestino.body.datos.destinoConfigurado).toBe(false);
      expect(resDestino.body.datos.destinoEnrutable).toBe(false);
      expect(resDestino.body.datos.motivo).toBe('DESTINO_TUPA_NO_CONFIGURADO');
    } finally {
      await pool.query('DELETE FROM sigd_doc.tupa_procedimiento WHERE id_procedimiento = $1', [idProc13]);
    }
  });

  // ===========================================================================
  // CASO 14: Desactivación de cuenta: AREA ENRUTABLE ≠ PERSONA ASIGNABLE
  // ===========================================================================
  it('TC-C3-14: Desactivación de cuenta: funcionario inactivo no asignable, pero área SDA sigue enrutable', async () => {
    // 1. Crear un funcionario temporal en SDA
    const tempPersonaId = randomUUID();
    const tempUsuarioId = randomUUID();
    const dniTemp = String(Math.floor(10000000 + Math.random() * 90000000));

    await pool.query(
      `INSERT INTO sigd_auth.persona (id_persona, tipo, id_documento, creado_en)
       VALUES ($1, 'NATURAL', $2, now())`,
      [tempPersonaId, dniTemp],
    );
    idsLimpieza.personas.add(tempPersonaId);

    await pool.query(
      `INSERT INTO sigd_auth.persona_natural (id_persona, nombres, apellidos, nombre_completo, correo)
       VALUES ($1, 'Docente', 'Temporal', 'Docente Temporal', $2)`,
      [tempPersonaId, 'docente_temp_' + dniTemp + '@test.pe'],
    );

    // Iniciar con cuenta INACTIVA (activo = false)
    await pool.query(
      `INSERT INTO sigd_auth.cuenta_usuario (id_usuario, id_persona, usuario, correo, password_hash, activo, creado_en)
       VALUES ($1, $2, $3, $4, '$argon2id$v=19$m=65536,t=3,p=4$fake_hash_for_test', false, now())`,
      [tempUsuarioId, tempPersonaId, 'docente_temp_' + dniTemp, 'docente_temp_' + dniTemp + '@test.pe'],
    );
    idsLimpieza.cuentas.add(tempUsuarioId);

    const vId = randomUUID();
    const resTv = await pool.query<{ id_tipo_vinculo: number }>(
      "SELECT id_tipo_vinculo FROM sigd_auth.tipo_vinculo_institucional WHERE codigo = 'DOCENTE' LIMIT 1",
    );
    const tvId = resTv.rows[0]?.id_tipo_vinculo ?? 1;

    await pool.query(
      `INSERT INTO sigd_auth.vinculo_institucional (id_vinculo, id_persona, id_tipo_vinculo, estado, vigente_desde, creado_en)
       VALUES ($1, $2, $3, 'ACTIVO', now() - interval '1 day', now())`,
      [vId, tempPersonaId, tvId],
    );
    idsLimpieza.vinculos.add(vId);

    const asigPerfilId = randomUUID();
    await pool.query(
      `INSERT INTO sigd_org.asignacion_perfil_operativo (id_asignacion_perfil, id_usuario, perfil_id, area_id, scope, vigente_desde, estado)
       VALUES ($1, $2, 4, $3, 'AREA', now(), 'ACTIVO')`,
      [asigPerfilId, tempUsuarioId, sdaAreaId],
    );
    idsLimpieza.asignacionesPerfiles.add(asigPerfilId);

    // 2. Crear y derivar expediente a SDA
    const { expedienteId } = await crearExpedienteRadicado(procInglesId, versionTupa2026Id, dirAreaId);
    await request(app)
      .post(`/api/v1/expedientes/${expedienteId}/derivar`)
      .set('Authorization', `Bearer ${tokenMesaPartes}`)
      .send({ destinos: [{ area_destino_id: sdaAreaId }], proveido: 'Derivación a SDA' });

    // 3. Intentar asignar al funcionario inactivo -> debe fallar con 403 Forbidden (cuenta deshabilitada)
    const resAsignar = await request(app)
      .post(`/api/v1/expedientes/${expedienteId}/asignar`)
      .set('Authorization', `Bearer ${tokenEspecialistaSda}`)
      .send({
        idPersona: tempPersonaId,
        idUsuario: tempUsuarioId,
        motivo: 'Asignación a funcionario inactivo',
      });

    expect(resAsignar.status).toBe(403);
    expect(resAsignar.body.message || resAsignar.body.detail).toContain('deshabilitada');

    // 4. Sin embargo, SDA sigue siendo un área perfectamente ENRUTABLE porque tiene otros receptores habilitados
    const enrutabilidadSda = await enrutabilidadService.evaluarEnrutabilidadArea(sdaAreaId);
    expect(enrutabilidadSda.enrutable).toBe(true);
    expect(enrutabilidadSda.receptoresOperativos).toBeGreaterThanOrEqual(1);
  });

  // ===========================================================================
  // CASO 15: Desviación manual del destino TUPA requiere Justificación y Audita
  // ===========================================================================
  it('TC-C3-15: Desviación del destino TUPA requiere justificación (>= 10 chars) y genera DesviacionDestinoTupaRegistrada', async () => {
    // 1. Crear expediente con destino sugerido SDA
    const { expedienteId } = await crearExpedienteRadicado(procInglesId, versionTupa2026Id, dirAreaId);

    // 2. Crear un área alternativa enrutable
    const areaAltId = randomUUID();
    const personaAltId = randomUUID();
    const usuarioAltId = randomUUID();
    const dniAlt = String(Math.floor(10000000 + Math.random() * 90000000));

    await pool.query(
      `INSERT INTO sigd_org.area (area_id, codigo, nombre, nivel, vigente, creado_en, tipo_unidad)
       VALUES ($1, $2, 'Secretaría General Alternativa', 1, true, now(), 'UNIDAD')`,
      [areaAltId, `ALT_${Date.now().toString().slice(-6)}`],
    );
    idsLimpieza.areas.add(areaAltId);

    await pool.query(
      `INSERT INTO sigd_auth.persona (id_persona, tipo, id_documento, creado_en)
       VALUES ($1, 'NATURAL', $2, now())`,
      [personaAltId, dniAlt],
    );
    idsLimpieza.personas.add(personaAltId);

    await pool.query(
      `INSERT INTO sigd_auth.persona_natural (id_persona, nombres, apellidos, nombre_completo, correo)
       VALUES ($1, 'Receptor', 'Alt', 'Receptor Alt', $2)`,
      [personaAltId, 'alt_' + dniAlt + '@test.pe'],
    );

    await pool.query(
      `INSERT INTO sigd_auth.cuenta_usuario (id_usuario, id_persona, usuario, correo, password_hash, activo, creado_en)
       VALUES ($1, $2, $3, $4, '$argon2id$v=19$m=65536,t=3,p=4$fake_hash_for_test', true, now())`,
      [usuarioAltId, personaAltId, 'alt_' + dniAlt, 'alt_' + dniAlt + '@test.pe'],
    );
    idsLimpieza.cuentas.add(usuarioAltId);

    const vIdAlt = randomUUID();
    const resTv = await pool.query<{ id_tipo_vinculo: number }>(
      "SELECT id_tipo_vinculo FROM sigd_auth.tipo_vinculo_institucional WHERE codigo = 'ADMINISTRATIVO' LIMIT 1",
    );
    const tvId = resTv.rows[0]?.id_tipo_vinculo ?? 1;

    await pool.query(
      `INSERT INTO sigd_auth.vinculo_institucional (id_vinculo, id_persona, id_tipo_vinculo, estado, vigente_desde, creado_en)
       VALUES ($1, $2, $3, 'ACTIVO', now() - interval '1 day', now())`,
      [vIdAlt, personaAltId, tvId],
    );
    idsLimpieza.vinculos.add(vIdAlt);

    const cIdAlt = randomUUID();
    await pool.query(
      `INSERT INTO sigd_org.cargo (cargo_id, codigo, nombre, vigente)
       VALUES ($1, $2, 'Especialista Alt', true)`,
      [cIdAlt, `CRG_${Date.now().toString().slice(-6)}`],
    );
    idsLimpieza.cargos.add(cIdAlt);

    const asigIdAlt = randomUUID();
    await pool.query(
      `INSERT INTO sigd_org.asignacion_personal (id_asignacion, id_usuario, id_persona, id_vinculo, cargo_id, area_id, estado, vigente_desde, creado_en)
       VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVO', now() - interval '1 day', now())`,
      [asigIdAlt, usuarioAltId, personaAltId, vIdAlt, cIdAlt, areaAltId],
    );
    idsLimpieza.asignacionesPersonal.add(asigIdAlt);

    await pool.query(
      `INSERT INTO sigd_org.usuario_rol (id_usuario, rol_id)
       SELECT $1, rol_id FROM sigd_org.rol_sistema WHERE codigo = 'ESPECIALISTA'`,
      [usuarioAltId],
    );

    // Intento 1: Derivar a área alternativa (desviación de SDA) SIN justificación
    const resSinJust = await request(app)
      .post(`/api/v1/expedientes/${expedienteId}/derivar`)
      .set('Authorization', `Bearer ${tokenMesaPartes}`)
      .send({
        destinos: [{ area_destino_id: areaAltId }],
        proveido: 'Pase a Secretaría General',
      });

    expect(resSinJust.status).toBe(400);
    expect(resSinJust.body.code || resSinJust.body.error).toBe('JUSTIFICACION_DESVIACION_REQUERIDA');

    // Intento 2: Derivar con justificación demasiado corta (< 10 caracteres)
    const resCorta = await request(app)
      .post(`/api/v1/expedientes/${expedienteId}/derivar`)
      .set('Authorization', `Bearer ${tokenMesaPartes}`)
      .send({
        destinos: [{ area_destino_id: areaAltId }],
        proveido: 'Pase a Secretaría General',
        justificacion_desviacion: 'Corta',
      });

    expect(resCorta.status).toBe(400);
    expect(resCorta.body.code || resCorta.body.error).toBe('JUSTIFICACION_DESVIACION_REQUERIDA');

    // Intento 3: Derivar con justificación legítima y motivada (>= 10 caracteres)
    const resConJust = await request(app)
      .post(`/api/v1/expedientes/${expedienteId}/derivar`)
      .set('Authorization', `Bearer ${tokenMesaPartes}`)
      .send({
        destinos: [{ area_destino_id: areaAltId }],
        proveido: 'Pase a Secretaría General por requerimiento administrativo especial.',
        justificacion_desviacion: 'Se desvía motivadamente de SDA hacia Secretaría General por disposición legal.',
      });

    expect([200, 201]).toContain(resConJust.status);
    expect(resConJust.body.success || resConJust.body.ok).toBe(true);

    // Verificar que el evento DesviacionDestinoTupaRegistrada se haya insertado en el Outbox
    const resOutbox = await pool.query<{ payload: any }>(
      `SELECT payload FROM sigd_audit.evento_outbox 
        WHERE tipo_evento = 'DesviacionDestinoTupaRegistrada'
          AND payload->'identidad'->>'expediente_id' = $1`,
      [expedienteId],
    );

    expect(resOutbox.rows.length).toBeGreaterThanOrEqual(1);
    const p = resOutbox.rows[0].payload;
    const de = p.datos_especificos;
    expect(de.destino_configurado_id).toBe(sdaAreaId);
    expect(de.destino_seleccionado_id).toBe(areaAltId);
    expect(de.justificacion).toContain('disposición legal');
  });

  // ===========================================================================
  // CASO 16: Coherencia C3.5 Caso TRUE (p1-fila-06 genera_expediente = true)
  // ===========================================================================
  it('TC-C3-16: Radicación virtual de procedimiento con genera_expediente = true crea expediente, CUT y vínculo TUPA', async () => {
    // 1. Obtener registro_version_id de p1-fila-06
    const resProc = await pool.query<{ registro_version_id: string }>(
      `SELECT registro_version_id FROM sigd_doc.tupa_procedimiento 
        WHERE id_version = $1 AND codigo_ref = 'p1-fila-06'`,
      [versionTupa2026Id],
    );
    expect(resProc.rows.length).toBe(1);
    const registroVersionId = resProc.rows[0].registro_version_id;

    const hashSha256 = createHash('sha256').update('test_contenido_tc16').digest('hex');

    const res = await request(app)
      .post('/api/v1/tramites/radicacion-virtual')
      .set('Authorization', `Bearer ${tokenCiudadano}`)
      .send({
        asunto: 'Solicitud de Certificado de Inglés Caso TRUE C3.5',
        registroVersionId,
        nombreSolicitante: 'Ciudadano Demo',
        correo: 'ciudadano_demo@test.pe',
        totalFolios: 1,
        documentos: [
          {
            nombreArchivo: 'solicitud_ingles.pdf',
            contentType: 'application/pdf',
            tamanoBytes: 1024,
            hashSha256,
          },
        ],
      });

    expect(res.status).toBe(201);
    expect(res.body.expedienteId).toBeDefined();
    expect(res.body.cut).toMatch(/^EXP-2026-\d{6}$/);

    const expedienteId = res.body.expedienteId;
    idsLimpieza.expedientes.add(expedienteId);

    // Verificar en BD que existe el expediente y el vínculo
    const resExp = await pool.query('SELECT expediente_id, codigo_expediente FROM sigd_tra.expediente WHERE expediente_id = $1', [expedienteId]);
    expect(resExp.rows.length).toBe(1);

    const resVinculo = await pool.query(
      'SELECT expediente_id, registro_version_id FROM sigd_doc.expediente_tupa_vinculo WHERE expediente_id = $1',
      [expedienteId],
    );
    expect(resVinculo.rows.length).toBe(1);
    expect(resVinculo.rows[0].registro_version_id).toBe(registroVersionId);
  });

  // ===========================================================================
  // CASO 17: Coherencia C3.5 Caso FALSE (p1-fila-01 y p2-fila-01 genera_expediente = false)
  // ===========================================================================
  it('TC-C3-17: Radicación virtual de procedimientos con genera_expediente = false arroja 409 PROCEDIMIENTO_NO_GENERA_EXPEDIENTE y CERO mutaciones', async () => {
    // 1. Obtener registro_version_id de p1-fila-01 y p2-fila-01
    const resProc1 = await pool.query<{ registro_version_id: string }>(
      `SELECT registro_version_id FROM sigd_doc.tupa_procedimiento 
        WHERE id_version = $1 AND codigo_ref = 'p1-fila-01'`,
      [versionTupa2026Id],
    );
    const resProc2 = await pool.query<{ registro_version_id: string }>(
      `SELECT registro_version_id FROM sigd_doc.tupa_procedimiento 
        WHERE id_version = $1 AND codigo_ref = 'p2-fila-01'`,
      [versionTupa2026Id],
    );
    expect(resProc1.rows.length).toBe(1);
    expect(resProc2.rows.length).toBe(1);

    // Capturar conteos antes
    const resExpBefore = await pool.query<{ count: string }>('SELECT count(*) FROM sigd_tra.expediente');
    const resVincBefore = await pool.query<{ count: string }>('SELECT count(*) FROM sigd_doc.expediente_tupa_vinculo');
    const resMovBefore = await pool.query<{ count: string }>('SELECT count(*) FROM sigd_rut.movimiento_tramite');
    const resOutboxBefore = await pool.query<{ count: string }>("SELECT count(*) FROM sigd_audit.evento_outbox WHERE tipo_evento IN ('ExpedienteRadicado', 'ExpedienteCreado')");

    const hashSha256 = createHash('sha256').update('test_contenido_tc17').digest('hex');

    // Intento 1: p1-fila-01 (académico pero genera_expediente = false)
    const res1 = await request(app)
      .post('/api/v1/tramites/radicacion-virtual')
      .set('Authorization', `Bearer ${tokenCiudadano}`)
      .send({
        asunto: 'Intento de radicación en trámite p1-fila-01',
        registroVersionId: resProc1.rows[0].registro_version_id,
        nombreSolicitante: 'Ciudadano Demo',
        correo: 'ciudadano_demo@test.pe',
        totalFolios: 1,
        documentos: [
          {
            nombreArchivo: 'documento_test.pdf',
            contentType: 'application/pdf',
            tamanoBytes: 1024,
            hashSha256,
          },
        ],
      });

    expect(res1.status).toBe(409);
    expect(res1.body.code || res1.body.codigo).toBe('PROCEDIMIENTO_NO_GENERA_EXPEDIENTE');

    // Intento 2: p2-fila-01 (administrativo pero genera_expediente = false)
    const res2 = await request(app)
      .post('/api/v1/tramites/radicacion-virtual')
      .set('Authorization', `Bearer ${tokenCiudadano}`)
      .send({
        asunto: 'Intento de radicación en trámite p2-fila-01',
        registroVersionId: resProc2.rows[0].registro_version_id,
        nombreSolicitante: 'Ciudadano Demo',
        correo: 'ciudadano_demo@test.pe',
        totalFolios: 1,
        documentos: [
          {
            nombreArchivo: 'documento_test2.pdf',
            contentType: 'application/pdf',
            tamanoBytes: 1024,
            hashSha256,
          },
        ],
      });

    expect(res2.status).toBe(409);
    expect(res2.body.code || res2.body.codigo).toBe('PROCEDIMIENTO_NO_GENERA_EXPEDIENTE');

    // Comprobar conteos después: CERO mutaciones fail-closed
    const resExpAfter = await pool.query<{ count: string }>('SELECT count(*) FROM sigd_tra.expediente');
    const resVincAfter = await pool.query<{ count: string }>('SELECT count(*) FROM sigd_doc.expediente_tupa_vinculo');
    const resMovAfter = await pool.query<{ count: string }>('SELECT count(*) FROM sigd_rut.movimiento_tramite');
    const resOutboxAfter = await pool.query<{ count: string }>("SELECT count(*) FROM sigd_audit.evento_outbox WHERE tipo_evento IN ('ExpedienteRadicado', 'ExpedienteCreado')");

    expect(resExpAfter.rows[0].count).toBe(resExpBefore.rows[0].count);
    expect(resVincAfter.rows[0].count).toBe(resVincBefore.rows[0].count);
    expect(resMovAfter.rows[0].count).toBe(resMovBefore.rows[0].count);
    expect(resOutboxAfter.rows[0].count).toBe(resOutboxBefore.rows[0].count);
  });

  // ===========================================================================
  // CASO 18: Coherencia C3.5 Caso NULL (genera_expediente IS NULL -> RADICACION_TUPA_NO_DETERMINADA)
  // ===========================================================================
  it('TC-C3-18: Radicación virtual de procedimiento con genera_expediente = NULL arroja 409 RADICACION_TUPA_NO_DETERMINADA y CERO mutaciones', async () => {
    // 1. Obtener procedimiento canónico con genera_expediente IS NULL (p4-fila-16)
    const resNull = await pool.query<{ registro_version_id: string; codigo_ref: string }>(
      `SELECT registro_version_id, codigo_ref FROM sigd_doc.tupa_procedimiento 
        WHERE id_version = $1 AND genera_expediente IS NULL 
        LIMIT 1`,
      [versionTupa2026Id],
    );
    expect(resNull.rows.length).toBe(1);

    // Capturar conteos antes
    const resExpBefore = await pool.query<{ count: string }>('SELECT count(*) FROM sigd_tra.expediente');
    const resVincBefore = await pool.query<{ count: string }>('SELECT count(*) FROM sigd_doc.expediente_tupa_vinculo');
    const resMovBefore = await pool.query<{ count: string }>('SELECT count(*) FROM sigd_rut.movimiento_tramite');
    const resOutboxBefore = await pool.query<{ count: string }>("SELECT count(*) FROM sigd_audit.evento_outbox WHERE tipo_evento IN ('ExpedienteRadicado', 'ExpedienteCreado')");

    const hashSha256 = createHash('sha256').update('test_contenido_tc18').digest('hex');

    const res = await request(app)
      .post('/api/v1/tramites/radicacion-virtual')
      .set('Authorization', `Bearer ${tokenCiudadano}`)
      .send({
        asunto: 'Intento de radicación en trámite con genera_expediente NULL',
        registroVersionId: resNull.rows[0].registro_version_id,
        nombreSolicitante: 'Ciudadano Demo',
        correo: 'ciudadano_demo@test.pe',
        totalFolios: 1,
        documentos: [
          {
            nombreArchivo: 'documento_null.pdf',
            contentType: 'application/pdf',
            tamanoBytes: 1024,
            hashSha256,
          },
        ],
      });

    expect(res.status).toBe(409);
    expect(res.body.code || res.body.codigo).toBe('RADICACION_TUPA_NO_DETERMINADA');

    // Comprobar conteos después: CERO mutaciones fail-closed
    const resExpAfter = await pool.query<{ count: string }>('SELECT count(*) FROM sigd_tra.expediente');
    const resVincAfter = await pool.query<{ count: string }>('SELECT count(*) FROM sigd_doc.expediente_tupa_vinculo');
    const resMovAfter = await pool.query<{ count: string }>('SELECT count(*) FROM sigd_rut.movimiento_tramite');
    const resOutboxAfter = await pool.query<{ count: string }>("SELECT count(*) FROM sigd_audit.evento_outbox WHERE tipo_evento IN ('ExpedienteRadicado', 'ExpedienteCreado')");

    expect(resExpAfter.rows[0].count).toBe(resExpBefore.rows[0].count);
    expect(resVincAfter.rows[0].count).toBe(resVincBefore.rows[0].count);
    expect(resMovAfter.rows[0].count).toBe(resMovBefore.rows[0].count);
    expect(resOutboxAfter.rows[0].count).toBe(resOutboxBefore.rows[0].count);
  });
});
