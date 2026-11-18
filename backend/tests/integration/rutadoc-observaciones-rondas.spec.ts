import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { TransactionalTestPool, type HashesTablas, type EstadoSecuencia } from '../helpers/transactional-pool.helper.js';
import { MinioTestHelper } from '../helpers/minio-test.helper.js';
import { firmarTokenAcceso } from '../../src/core/auth/jwt.service.js';
import { construirApp } from '../../src/app.js';
import type { Express } from 'express';

const envPath = fs.existsSync(path.resolve('.env'))
  ? path.resolve('.env')
  : path.resolve('backend/.env');
dotenv.config({ path: envPath });
process.env.AUTH_JWT_SECRET ??= 'jrxd5PYrvRoesjxXyHin4dGieC_cF0X06l0d_EJ59YiKNPjx4e_9Dq430LowQpyL';
process.env.S3_BUCKET = 'sigd-sandbox-e2e';

describe('Microtarea 4.1 (TSK-DEV-04) — Observaciones, Subsanaciones, Rondas, Preclusión y Suspensión de SLA', () => {
  let txPool: TransactionalTestPool;
  let minioHelper: MinioTestHelper;
  let app: Express;
  let preHashes: HashesTablas;
  let preSecuencia: EstadoSecuencia;
  let conteoMinioInicial: number;

  // Tokens de prueba
  let tokenMp: string;
  let tokenDocente: string;
  let tokenEstudiante: string;
  let tokenAjeno: string;
  let tokenGestorApoyo: string;

  // IDs Constantes de Fixtures
  const ID_INSTITUCION = '018f9805-51aa-7000-8111-2b00c3f00001';
  const AREA_MP = 'a1a3a496-ff7f-45d8-b63c-3e54fcf79de1';
  const AREA_SEC = '2b147b0d-7c8f-434f-b75a-598a1ccb855b';

  const ROL_MP = '7692b3dc-4066-4184-a052-dd715b5eb9e2';
  const ROL_DOC = '3a030000-0000-4000-8000-000000000003';
  const ROL_EST = '3a040000-0000-4000-8000-000000000004';
  const CAP_GESTOR = '4c010000-0000-4000-8000-000000000001';

  // Usuarios
  const USR_MP_ID = '99999999-0000-0000-0000-000000000051';
  const USR_DOC_ID = '99999999-0000-0000-0000-000000000052';
  const USR_EST_ID = '99999999-0000-0000-0000-000000000053';
  const USR_AJENO_ID = '99999999-0000-0000-0000-000000000054';
  const USR_GEST_ID = '99999999-0000-0000-0000-000000000055';

  const PER_MP_ID = '99999999-0000-0000-0000-000000000061';
  const PER_DOC_ID = '99999999-0000-0000-0000-000000000062';
  const PER_EST_ID = '99999999-0000-0000-0000-000000000063';
  const PER_AJENO_ID = '99999999-0000-0000-0000-000000000064';
  const PER_GEST_ID = '99999999-0000-0000-0000-000000000065';

  const CTX_MP = '99999999-0000-0000-0000-000000000071';
  const CTX_DOC = '99999999-0000-0000-0000-000000000072';
  const CTX_EST = '99999999-0000-0000-0000-000000000073';
  const CTX_AJENO = '99999999-0000-0000-0000-000000000074';
  const CTX_GEST = '99999999-0000-0000-0000-000000000075';

  // Expediente y Requisitos
  const ID_EXP = '99999999-0000-0000-0000-000000000080';
  const TIPO_DOC_FUT = 'b7f37bde-ec45-49d0-b28e-fc2ad4341b60';
  const TIPO_TRAMITE_TUPA = '18cc2baf-92e9-4834-bb1f-8e698fc417f2';

  const REQ_1 = '99999999-0000-0000-0000-000000000101';
  const REQ_2 = '99999999-0000-0000-0000-000000000102';

  const DUMMY_HASH_ARGON2 = '$argon2id$v=19$m=65536,p=4,t=3$pZditvO4UISe7Gm8wqo9oA$BuLgyjSdHz1nfbwEN6J21QPg02eBpa6q/z7eaFLuSHs';

  beforeAll(async () => {
    minioHelper = new MinioTestHelper();
    conteoMinioInicial = await minioHelper.contarObjetosEnBucket();
    expect(conteoMinioInicial).toBe(347);

    txPool = new TransactionalTestPool();
    preHashes = await txPool.obtenerHashesTablasCriticas();
    preSecuencia = await txPool.obtenerEstadoSecuenciaAsiento();
    expect(preSecuencia.last_value).toBe('10227');

    await txPool.init();
    const rawClient = txPool.getRawClient();

    // 1. Fixtures Personas y Cuentas
    const usuarios = [
      { id: USR_MP_ID, per: PER_MP_ID, usr: 'operador.mp.test', nom: 'Operador MP', doc: '70000051' },
      { id: USR_DOC_ID, per: PER_DOC_ID, usr: 'docente.test', nom: 'Docente Evaluador', doc: '70000052' },
      { id: USR_EST_ID, per: PER_EST_ID, usr: 'estudiante.test', nom: 'Estudiante Titular', doc: '70000053' },
      { id: USR_AJENO_ID, per: PER_AJENO_ID, usr: 'ajeno.test', nom: 'Estudiante Ajeno', doc: '70000054' },
      { id: USR_GEST_ID, per: PER_GEST_ID, usr: 'gestor.test', nom: 'Gestor Apoyo', doc: '70000055' },
    ];

    for (const u of usuarios) {
      await rawClient.query(`
        INSERT INTO sigd_auth.persona (id_persona, tipo, id_documento)
        VALUES ($1::uuid, 'NATURAL', $2)
      `, [u.per, u.doc]);

      await rawClient.query(`
        INSERT INTO sigd_auth.persona_natural (id_persona, nombres, apellidos, nombre_completo, sexo)
        VALUES ($1::uuid, $2, 'Prueba', $2, 'M')
      `, [u.per, u.nom]);

      await rawClient.query(`
        INSERT INTO sigd_auth.cuenta_usuario (id_usuario, id_persona, usuario, correo, password_hash, activo)
        VALUES ($1::uuid, $2::uuid, $3, $4, $5, true)
      `, [u.id, u.per, u.usr, `${u.usr}@iestp-suiza.edu.pe`, DUMMY_HASH_ARGON2]);

      await rawClient.query(`
        INSERT INTO sigd_auth.usuario_institucion (id_usuario, institucion_id, activo)
        VALUES ($1::uuid, $2::uuid, true)
        ON CONFLICT (id_usuario, institucion_id) DO NOTHING
      `, [u.id, ID_INSTITUCION]);
    }

    // 2. Roles y Capacidades
    // Operador MP
    await rawClient.query(`
      INSERT INTO sigd_org.usuario_rol (
        id_usuario_rol, id_usuario, rol_id, area_id, institucion_id, vigente_desde
      ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, now() - INTERVAL '1 day')
    `, [CTX_MP, USR_MP_ID, ROL_MP, AREA_MP, ID_INSTITUCION]);

    // Docente en SEC
    await rawClient.query(`
      INSERT INTO sigd_org.usuario_rol (
        id_usuario_rol, id_usuario, rol_id, area_id, institucion_id, vigente_desde
      ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, now() - INTERVAL '1 day')
    `, [CTX_DOC, USR_DOC_ID, ROL_DOC, AREA_SEC, ID_INSTITUCION]);

    // Estudiante Titular (Global)
    await rawClient.query(`
      INSERT INTO sigd_org.usuario_rol (
        id_usuario_rol, id_usuario, rol_id, institucion_id, vigente_desde
      ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, now() - INTERVAL '1 day')
    `, [CTX_EST, USR_EST_ID, ROL_EST, ID_INSTITUCION]);

    // Estudiante Ajeno (Global)
    await rawClient.query(`
      INSERT INTO sigd_org.usuario_rol (
        id_usuario_rol, id_usuario, rol_id, institucion_id, vigente_desde
      ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, now() - INTERVAL '1 day')
    `, [CTX_AJENO, USR_AJENO_ID, ROL_EST, ID_INSTITUCION]);

    // Gestor Apoyo en SEC (solo capacidad operativa, sin rol de observación)
    await rawClient.query(`
      INSERT INTO sigd_org.usuario_capacidad (
        id_usuario_capacidad, id_usuario, id_capacidad, area_id, asignado_por, activo, vigente_desde, justificacion
      ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, true, now() - INTERVAL '1 day', 'Capacidad Operativa')
    `, [CTX_GEST, USR_GEST_ID, CAP_GESTOR, AREA_SEC, USR_MP_ID]);

    // 3. Requisitos TUPA para la prueba
    await rawClient.query(`
      INSERT INTO sigd_doc.requisito (requisito_id, tipo_tramite_id, codigo, denominacion, obligatorio, orden)
      VALUES ($1::uuid, $2::uuid, 'REQ-DNI', 'Copia simple del DNI', true, 1)
      ON CONFLICT (requisito_id) DO NOTHING
    `, [REQ_1, TIPO_TRAMITE_TUPA]);

    await rawClient.query(`
      INSERT INTO sigd_doc.requisito (requisito_id, tipo_tramite_id, codigo, denominacion, obligatorio, orden)
      VALUES ($1::uuid, $2::uuid, 'REQ-CONST', 'Constancia de no adeudo', true, 2)
      ON CONFLICT (requisito_id) DO NOTHING
    `, [REQ_2, TIPO_TRAMITE_TUPA]);

    // 4. Expediente de Prueba en EN_CALIFICACION
    await rawClient.query(`
      INSERT INTO sigd_tra.expediente (
        expediente_id, codigo_expediente, numero, tipo_documental_id, solicitante_id, area_destino_id, estado, fecha_radicacion
      ) VALUES (
        $1::uuid, 'EXP-2026-900080', 'EXP-2026-900080', $2::uuid, $3::uuid, $4::uuid, 'EN_CALIFICACION', now()
      )
    `, [ID_EXP, TIPO_DOC_FUT, PER_EST_ID, AREA_MP]);

    await rawClient.query(`
      INSERT INTO sigd_doc.expediente (
        expediente_id, tipo_tramite_id, codigo_expediente, asunto, solicitante_id, fecha_registro
      ) VALUES (
        $1::uuid, $2::uuid, 'EXP-2026-900080', 'Expediente Prueba Observaciones TSK-DEV-04', $3::uuid, now()
      )
    `, [ID_EXP, TIPO_TRAMITE_TUPA, PER_EST_ID]);

    await rawClient.query(`
      INSERT INTO sigd_rut.movimiento_tramite (
        id_movimiento, expediente_id, estado_anterior, evento, estado_nuevo, usuario_operador_id, fecha_hora, datos
      ) VALUES (
        '99999999-0000-0000-0000-000000000081'::uuid, $1::uuid, 'RECEPCIONADO', 'INICIAR_CALIFICACION', 'EN_CALIFICACION', 990000001, now(),
        json_build_object('areaId', $2::text)
      )
    `, [ID_EXP, AREA_MP]);

    // Requisitos asociados al expediente
    await rawClient.query(`
      INSERT INTO sigd_doc.expediente_requisito (id_expediente_requisito, expediente_id, requisito_id, cumplido)
      VALUES ('99999999-0000-0000-0000-000000000091'::uuid, $1::uuid, $2::uuid, false),
             ('99999999-0000-0000-0000-000000000092'::uuid, $1::uuid, $3::uuid, false)
    `, [ID_EXP, REQ_1, REQ_2]);

    // 5. App y Tokens
    app = construirApp(txPool.asPool());

    tokenMp = firmarTokenAcceso({ sub: USR_MP_ID, ctx: CTX_MP, roles: ['MESA_PARTES'] });
    tokenDocente = firmarTokenAcceso({ sub: USR_DOC_ID, ctx: CTX_DOC, roles: ['DOCENTE'] });
    tokenEstudiante = firmarTokenAcceso({ sub: USR_EST_ID, ctx: CTX_EST, roles: ['ESTUDIANTE'] });
    tokenAjeno = firmarTokenAcceso({ sub: USR_AJENO_ID, ctx: CTX_AJENO, roles: ['ESTUDIANTE'] });
    tokenGestorApoyo = firmarTokenAcceso({ sub: USR_GEST_ID, ctx: CTX_GEST, roles: [] });
  });

  afterAll(async () => {
    if (minioHelper) {
      await minioHelper.limpiarClavesDePrueba();
      const conteoFinal = await minioHelper.contarObjetosEnBucket();
      expect(conteoFinal).toBe(conteoMinioInicial);
    }

    if (txPool) {
      await txPool.rollbackRootTransaction();
      const postHashes = await txPool.obtenerHashesTablasCriticas();
      const postSecuencia = await txPool.obtenerEstadoSecuenciaAsiento();
      await txPool.rollbackAndClose();

      for (const [tabla, hashPre] of Object.entries(preHashes)) {
        expect(postHashes[tabla], `Violación de inmutabilidad en tabla ${tabla}`).toBe(hashPre);
      }
      expect(postSecuencia.last_value).toBe('10227');
    }
  });

  it('1. RBAC Negativo — Confirmar que GESTOR_APOYO_AREA no puede formular observaciones', async () => {
    const res = await request(app)
      .post(`/api/v1/expedientes/${ID_EXP}/observar`)
      .set('Authorization', `Bearer ${tokenGestorApoyo}`)
      .send({
        motivo: 'Intento de observación no autorizado por Gestor de Apoyo',
        plazoDias: 5,
      });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('2. RBAC Negativo — Confirmar que GESTOR_APOYO_AREA no puede subsanar expedientes', async () => {
    const res = await request(app)
      .post(`/api/v1/expedientes/${ID_EXP}/subsanar`)
      .set('Authorization', `Bearer ${tokenGestorApoyo}`)
      .send({
        motivo: 'Intento de subsanación no autorizado por Gestor de Apoyo',
      });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('3. RBAC Forense — Confirmar que el rol ESPECIALISTA continúa inexistente en la BD', async () => {
    const client = txPool.getRawClient();
    const res = await client.query(`SELECT 1 FROM sigd_org.rol_sistema WHERE codigo = 'ESPECIALISTA'`);
    expect(res.rowCount).toBe(0);
  });

  it('4. Observación Ronda 1 — Formulación válida de observación con requisito TUPA', async () => {
    const res = await request(app)
      .post(`/api/v1/expedientes/${ID_EXP}/observar`)
      .set('Authorization', `Bearer ${tokenMp}`)
      .send({
        motivo: 'Expediente observado: Copia simple del DNI se encuentra ilegible',
        sustentoTecnico: 'No se distinguen los dígitos del documento de identidad',
        plazoDias: 5,
        tipoObservacion: 'ADMINISTRATIVA',
        requisitos: [
          {
            requisitoId: REQ_1,
            descripcionIncumplimiento: 'El documento adjuntado carece de nitidez suficiente',
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.estado).toBe('OBSERVADO');
    expect(res.body.ronda).toBe(1);
    expect(res.body.slaPaused).toBe(true);

    const client = txPool.getRawClient();

    // Verificar sigd_rut.expediente_observacion
    const obsDb = await client.query<{ ronda: number; estado: string; tipo_observacion: string }>(
      `SELECT ronda, estado, tipo_observacion FROM sigd_rut.expediente_observacion WHERE expediente_id = $1::uuid`,
      [ID_EXP],
    );
    expect(obsDb.rowCount).toBe(1);
    expect(obsDb.rows[0].ronda).toBe(1);
    expect(obsDb.rows[0].estado).toBe('PENDIENTE');
    expect(obsDb.rows[0].tipo_observacion).toBe('ADMINISTRATIVA');

    // Verificar sigd_rut.observacion_requisito
    const reqDb = await client.query<{ requisito_id: string; subsanado: boolean }>(
      `SELECT obr.requisito_id::text, obr.subsanado
         FROM sigd_rut.observacion_requisito obr
         JOIN sigd_rut.expediente_observacion eo ON eo.id_observacion = obr.id_observacion
        WHERE eo.expediente_id = $1::uuid`,
      [ID_EXP],
    );
    expect(reqDb.rowCount).toBe(1);
    expect(reqDb.rows[0].requisito_id).toBe(REQ_1);
    expect(reqDb.rows[0].subsanado).toBe(false);

    // Verificar movimiento inmutable WORM
    const movDb = await client.query<{ evento: string; estado_nuevo: string }>(
      `SELECT evento, estado_nuevo FROM sigd_rut.movimiento_tramite
        WHERE expediente_id = $1::uuid AND evento = 'OBSERVACION'`,
      [ID_EXP],
    );
    expect(movDb.rowCount).toBe(1);
    expect(movDb.rows[0].estado_nuevo).toBe('OBSERVADO');

    // Verificar estado en sigd_tra.expediente
    const expDb = await client.query<{ estado: string }>(
      `SELECT estado FROM sigd_tra.expediente WHERE expediente_id = $1::uuid`,
      [ID_EXP],
    );
    expect(expDb.rows[0].estado).toBe('OBSERVADO');
  });

  it('5. Integridad FSM — Rechazar nueva observación si ya existe una PENDIENTE en el expediente', async () => {
    const res = await request(app)
      .post(`/api/v1/expedientes/${ID_EXP}/observar`)
      .set('Authorization', `Bearer ${tokenMp}`)
      .send({
        motivo: 'Intento de formular segunda observación antes de subsanar la primera',
        plazoDias: 5,
      });

    expect(res.status).toBe(409);
  });

  it('6. RBAC Negativo — Rechazar subsanación presentada por tercero ajeno no titular', async () => {
    const res = await request(app)
      .post(`/api/v1/expedientes/${ID_EXP}/subsanar`)
      .set('Authorization', `Bearer ${tokenAjeno}`)
      .send({
        motivo: 'Intento de subsanación por un tercero no titular',
      });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN');
  });

  it('7. Subsanación Ronda 1 — Estudiante titular subsana formalmente y transiciona a SUBSANADO', async () => {
    const res = await request(app)
      .post(`/api/v1/expedientes/${ID_EXP}/subsanar`)
      .set('Authorization', `Bearer ${tokenEstudiante}`)
      .send({
        motivo: 'Adjunto copia nítida y legible del DNI escaneado',
        sustentoSubsanacion: 'Documento en alta resolución',
        canalRecepcion: 'PORTAL_ESTUDIANTE',
      });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.estado).toBe('SUBSANADO');
    expect(res.body.ronda).toBe(1);
    expect(res.body.slaResumed).toBe(true);

    const client = txPool.getRawClient();

    // Observación previa pasa a SUBSANADA
    const obsDb = await client.query<{ estado: string }>(
      `SELECT estado FROM sigd_rut.expediente_observacion WHERE expediente_id = $1::uuid`,
      [ID_EXP],
    );
    expect(obsDb.rows[0].estado).toBe('SUBSANADA');

    // Requisito marcado como subsanado = true
    const reqDb = await client.query<{ subsanado: boolean }>(
      `SELECT obr.subsanado
         FROM sigd_rut.observacion_requisito obr
         JOIN sigd_rut.expediente_observacion eo ON eo.id_observacion = obr.id_observacion
        WHERE eo.expediente_id = $1::uuid`,
      [ID_EXP],
    );
    expect(reqDb.rows[0].subsanado).toBe(true);

    // Registro en sigd_rut.expediente_subsanacion
    const subDb = await client.query<{ ronda: number; canal_recepcion: string; es_titular: boolean }>(
      `SELECT ronda, canal_recepcion, es_titular FROM sigd_rut.expediente_subsanacion WHERE expediente_id = $1::uuid`,
      [ID_EXP],
    );
    expect(subDb.rowCount).toBe(1);
    expect(subDb.rows[0].ronda).toBe(1);
    expect(subDb.rows[0].es_titular).toBe(true);

    // Movimiento CORRECCION -> SUBSANADO
    const movDb = await client.query<{ evento: string; estado_nuevo: string }>(
      `SELECT evento, estado_nuevo FROM sigd_rut.movimiento_tramite
        WHERE expediente_id = $1::uuid AND evento = 'CORRECCION'`,
      [ID_EXP],
    );
    expect(movDb.rowCount).toBe(1);
    expect(movDb.rows[0].estado_nuevo).toBe('SUBSANADO');

    // Estado general SUBSANADO
    const expDb = await client.query<{ estado: string }>(
      `SELECT estado FROM sigd_tra.expediente WHERE expediente_id = $1::uuid`,
      [ID_EXP],
    );
    expect(expDb.rows[0].estado).toBe('SUBSANADO');
  });

  it('8. Reanudación Procesal — Transicionar SUBSANADO a EN_REVISION', async () => {
    const client = txPool.getRawClient();
    await client.query(`
      INSERT INTO sigd_rut.movimiento_tramite (
        id_movimiento, expediente_id, estado_anterior, evento, estado_nuevo, usuario_operador_id, fecha_hora, datos
      ) VALUES (
        '99999999-0000-0000-0000-000000000083'::uuid, $1::uuid, 'SUBSANADO', 'INICIAR_REVISION', 'EN_REVISION', 990000001, now(),
        json_build_object('motivo', 'Reanudación de calificación tras subsanación de Ronda 1', 'areaId', $2::text)
      )
    `, [ID_EXP, AREA_MP]);

    await client.query(`
      UPDATE sigd_tra.expediente SET estado = 'EN_REVISION' WHERE expediente_id = $1::uuid
    `, [ID_EXP]);

    const expDb = await client.query<{ estado: string }>(
      `SELECT estado FROM sigd_tra.expediente WHERE expediente_id = $1::uuid`,
      [ID_EXP],
    );
    expect(expDb.rows[0].estado).toBe('EN_REVISION');
  });

  it('9. Regla de Preclusión LPAG (Arts. 136 y 142) — Rechazar nueva observación sobre REQ_2 en Ronda 2 sin causa justificada', async () => {
    // REQ_2 no fue observado en Ronda 1. Formular observación en Ronda 2 sin justificación debe fallar con HTTP 422.
    const res = await request(app)
      .post(`/api/v1/expedientes/${ID_EXP}/observar`)
      .set('Authorization', `Bearer ${tokenMp}`)
      .send({
        motivo: 'Observación extemporánea: Falta constancia de no adeudo',
        plazoDias: 5,
        requisitos: [
          {
            requisitoId: REQ_2,
            descripcionIncumplimiento: 'No adjuntó constancia de no adeudo',
          },
        ],
      });

    expect(res.status).toBe(422);
    expect(res.body.code).toBe('ERROR_PRECLUSION_REQUISITOS');
  });

  it('10. Observación Ronda 2 — Reiteración válida de REQ_1 con incremento de ronda a 2', async () => {
    // REQ_1 sí fue observado en Ronda 1. Puede ser reiterado en Ronda 2 legalmente.
    const res = await request(app)
      .post(`/api/v1/expedientes/${ID_EXP}/observar`)
      .set('Authorization', `Bearer ${tokenMp}`)
      .send({
        motivo: 'Reiteración de observación: El DNI adjuntado se encuentra vencido y caduco',
        sustentoTecnico: 'Fecha de caducidad superada según RENIEC',
        plazoDias: 3,
        requisitos: [
          {
            requisitoId: REQ_1,
            descripcionIncumplimiento: 'El DNI presentado venció hace más de 12 meses',
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.ronda).toBe(2);
    expect(res.body.estado).toBe('OBSERVADO');

    const client = txPool.getRawClient();
    const rondasDb = await client.query<{ ronda: number; estado: string }>(
      `SELECT ronda, estado FROM sigd_rut.expediente_observacion WHERE expediente_id = $1::uuid ORDER BY ronda ASC`,
      [ID_EXP],
    );
    expect(rondasDb.rowCount).toBe(2);
    expect(rondasDb.rows[0].ronda).toBe(1);
    expect(rondasDb.rows[0].estado).toBe('SUBSANADA');
    expect(rondasDb.rows[1].ronda).toBe(2);
    expect(rondasDb.rows[1].estado).toBe('PENDIENTE');
  });

  it('11. Subsanación Ronda 2 por Ventanilla — Operador de Mesa de Partes subsana a ruego del administrado', async () => {
    const res = await request(app)
      .post(`/api/v1/expedientes/${ID_EXP}/subsanar`)
      .set('Authorization', `Bearer ${tokenMp}`)
      .send({
        motivo: 'Administrado presenta copia de DNI electrónico vigente por ventanilla presencial',
        sustentoSubsanacion: 'Verificado físicamente en ventanilla de Mesa de Partes',
        canalRecepcion: 'VENTANILLA_MESA_PARTES',
      });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.ronda).toBe(2);
    expect(res.body.estado).toBe('SUBSANADO');
    expect(res.body.canalRecepcion).toBe('VENTANILLA_MESA_PARTES');

    const client = txPool.getRawClient();
    const subsDb = await client.query<{ ronda: number; canal_recepcion: string; es_titular: boolean }>(
      `SELECT ronda, canal_recepcion, es_titular FROM sigd_rut.expediente_subsanacion WHERE expediente_id = $1::uuid ORDER BY ronda ASC`,
      [ID_EXP],
    );
    expect(subsDb.rowCount).toBe(2);
    expect(subsDb.rows[1].ronda).toBe(2);
    expect(subsDb.rows[1].canal_recepcion).toBe('VENTANILLA_MESA_PARTES');
    expect(subsDb.rows[1].es_titular).toBe(false);
  });

  it('12. Historial de Observaciones — Consulta estructurada de rondas, requisitos y subsanaciones', async () => {
    const res = await request(app)
      .get(`/api/v1/expedientes/${ID_EXP}/observaciones`)
      .set('Authorization', `Bearer ${tokenMp}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);

    // Ronda 1
    const r1 = res.body[0];
    expect(r1.ronda).toBe(1);
    expect(r1.estado).toBe('SUBSANADA');
    expect(r1.requisitos.length).toBe(1);
    expect(r1.subsanaciones.length).toBe(1);
    expect(r1.subsanaciones[0].canal).toBe('PORTAL_ESTUDIANTE');

    // Ronda 2
    const r2 = res.body[1];
    expect(r2.ronda).toBe(2);
    expect(r2.estado).toBe('SUBSANADA');
    expect(r2.requisitos.length).toBe(1);
    expect(r2.subsanaciones.length).toBe(1);
    expect(r2.subsanaciones[0].canal).toBe('VENTANILLA_MESA_PARTES');
  });

  it('13. Suspensión de SLA — Cómputo institucional refleja los pliegos de observación', async () => {
    const res = await request(app)
      .get(`/api/v1/expedientes/${ID_EXP}/sla-status`)
      .set('Authorization', `Bearer ${tokenMp}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('diasHabilesLimite');
    expect(res.body).toHaveProperty('diasHabilesTranscurridos');
    expect(res.body).toHaveProperty('diasHabilesSuspendidos');
    expect(res.body).toHaveProperty('diasHabilesConsumidos');
    expect(res.body.diasHabilesConsumidos).toBeLessThanOrEqual(res.body.diasHabilesTranscurridos);
    expect(res.body.estado).toBe('VERDE');
  });
});
