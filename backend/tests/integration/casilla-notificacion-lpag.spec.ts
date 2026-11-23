import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { TransactionalTestPool, type HashesTablas, type EstadoSecuencia } from '../helpers/transactional-pool.helper.js';
import { MinioTestHelper } from '../helpers/minio-test.helper.js';
import { firmarTokenAcceso } from '../../src/core/auth/jwt.service.js';
import { construirApp } from '../../src/app.js';
import {
  computarPlazosNotificacionLpag,
  obtenerDiasNoLaborablesInstitucionales,
} from '../../src/domains/identicore/casilla.router.js';
import {
  generarCertificadoAcusePdf,
  type DatosAcusePdf,
} from '../../src/domains/identicore/casillaAcusePdf.service.js';
import type { Express } from 'express';

const envPath = fs.existsSync(path.resolve('.env'))
  ? path.resolve('.env')
  : path.resolve('backend/.env');
dotenv.config({ path: envPath });
process.env.AUTH_JWT_SECRET ??= 'jrxd5PYrvRoesjxXyHin4dGieC_cF0X06l0d_EJ59YiKNPjx4e_9Dq430LowQpyL';
process.env.S3_BUCKET = 'sigd-sandbox-e2e';
process.env.SIGD_SAFE_BOOT = 'false';
process.env.SIGD_READ_ONLY = 'false';

describe('TSK-DEV-05.3 — Notificación Oficial, Casilla Electrónica, Acuse Legal y Cómputo de Plazos LPAG', () => {
  let txPool: TransactionalTestPool;
  let minioHelper: MinioTestHelper;
  let app: Express;
  let preHashes: HashesTablas;
  let preSecuencia: EstadoSecuencia;
  let conteoMinioInicial: number;

  // Tokens JWT
  let tokenDestinatario: string;
  let tokenAjeno: string;

  // IDs Fixtures
  const ID_INSTITUCION = '018f9805-51aa-7000-8111-2b00c3f00001';
  const AREA_MP = 'a1a3a496-ff7f-45d8-b63c-3e54fcf79de1';
  const ROL_CIUDADANO = '97069c21-17c5-4438-b0d0-293aac2c18e9';

  const USR_DEST_ID = '99999999-0000-0000-0000-000000000501';
  const PER_DEST_ID = '99999999-0000-0000-0000-000000000502';
  const CTX_DEST = '99999999-0000-0000-0000-000000000503';

  const USR_AJENO_ID = '99999999-0000-0000-0000-000000000504';
  const PER_AJENO_ID = '99999999-0000-0000-0000-000000000505';
  const CTX_AJENO = '99999999-0000-0000-0000-000000000506';

  // Notificaciones de prueba
  const ID_NOTIF_HABIL = '99999999-0000-0000-0000-000000000601';
  const ID_NOTIF_NOCHE = '99999999-0000-0000-0000-000000000602';
  const ID_NOTIF_FINDE = '99999999-0000-0000-0000-000000000603';
  const ID_NOTIF_FERIADO = '99999999-0000-0000-0000-000000000604';

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

    // 1. Fixtures de Usuarios y Personas
    const usuarios = [
      {
        id: USR_DEST_ID,
        per: PER_DEST_ID,
        usr: 'juan.perez.m53',
        nom: 'Juan',
        ape: 'Pérez Vásquez',
        doc: '70123456',
        correo: 'juan.perez@estudiante.iestp-suiza.edu.pe',
      },
      {
        id: USR_AJENO_ID,
        per: PER_AJENO_ID,
        usr: 'maria.lopez.m53',
        nom: 'María',
        ape: 'López Ríos',
        doc: '70987654',
        correo: 'maria.lopez@estudiante.iestp-suiza.edu.pe',
      },
    ];

    for (const u of usuarios) {
      await rawClient.query(`
        INSERT INTO sigd_auth.persona (id_persona, tipo, id_documento)
        VALUES ($1::uuid, 'NATURAL', $2)
        ON CONFLICT (id_persona) DO NOTHING
      `, [u.per, u.doc]);

      await rawClient.query(`
        INSERT INTO sigd_auth.persona_natural (id_persona, nombres, apellidos, nombre_completo, sexo)
        VALUES ($1::uuid, $2, $3, $4, 'M')
        ON CONFLICT (id_persona) DO NOTHING
      `, [u.per, u.nom, u.ape, `${u.nom} ${u.ape}`]);

      await rawClient.query(`
        INSERT INTO sigd_auth.cuenta_usuario (id_usuario, id_persona, usuario, correo, password_hash, activo)
        VALUES ($1::uuid, $2::uuid, $3, $4, $5, true)
        ON CONFLICT (id_usuario) DO NOTHING
      `, [u.id, u.per, u.usr, u.correo, DUMMY_HASH_ARGON2]);

      await rawClient.query(`
        INSERT INTO sigd_auth.usuario_institucion (id_usuario, institucion_id, activo)
        VALUES ($1::uuid, $2::uuid, true)
        ON CONFLICT DO NOTHING
      `, [u.id, ID_INSTITUCION]);
    }

    // Roles de usuario
    await rawClient.query(`
      INSERT INTO sigd_org.usuario_rol (
        id_usuario_rol, id_usuario, rol_id, area_id, institucion_id, vigente_desde
      ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, now() - INTERVAL '1 day')
    `, [CTX_DEST, USR_DEST_ID, ROL_CIUDADANO, AREA_MP, ID_INSTITUCION]);

    await rawClient.query(`
      INSERT INTO sigd_org.usuario_rol (
        id_usuario_rol, id_usuario, rol_id, area_id, institucion_id, vigente_desde
      ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, now() - INTERVAL '1 day')
    `, [CTX_AJENO, USR_AJENO_ID, ROL_CIUDADANO, AREA_MP, ID_INSTITUCION]);

    // 2. Notificaciones en sigd_auth.notificacion_casilla
    // Notificación 1: Depósito hábil (Miércoles 18/11/2026 a las 10:30 UTC-5 -> 15:30 UTC)
    await rawClient.query(`
      INSERT INTO sigd_auth.notificacion_casilla (
        id, usuario_id, correo_destinatario, cut, asunto, tipo_acto,
        numero_documento, cuerpo, referencia, estado, fecha_deposito,
        hash_sha256, cvd, creado_en
      ) VALUES (
        $1::uuid, $2::uuid, 'juan.perez@estudiante.iestp-suiza.edu.pe',
        'EXP-2026-000901', 'Notificación de Resolución de Titulación', 'Resolución Directoral',
        'RD N° 045-2026-DG-IESTP-SUIZA',
        $3::jsonb, 'EXP-2026-000901', 'NO_LEIDO',
        '2026-11-18 15:30:00+00',
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        'CVD-2026-NOT-000901', '2026-11-18 15:30:00+00'
      )
    `, [
      ID_NOTIF_HABIL,
      USR_DEST_ID,
      JSON.stringify({
        asunto: 'Notificación de Resolución de Titulación',
        resumenLegal: 'Se confiere el título profesional técnico correspondiente.',
        textoCompleto: 'Artículo 1.- Aprobar la expedición del Título Profesional...',
        firmantes: [
          {
            nombre: 'Ing. Rolando Ramírez Peña',
            cargo: 'Director General',
            fechaFirma: '18/11/2026 10:15:00 UTC-5',
            entidadCertificadora: 'RENIEC',
          },
        ],
      }),
    ]);

    // Notificación 2: Depósito nocturno fuera de horario (Miércoles 18/11/2026 a las 19:45 UTC-5 -> 00:45 UTC del 19)
    await rawClient.query(`
      INSERT INTO sigd_auth.notificacion_casilla (
        id, usuario_id, correo_destinatario, cut, asunto, tipo_acto,
        numero_documento, cuerpo, referencia, estado, fecha_deposito,
        hash_sha256, cvd, creado_en
      ) VALUES (
        $1::uuid, $2::uuid, 'juan.perez@estudiante.iestp-suiza.edu.pe',
        'EXP-2026-000902', 'Notificación Nocturna de Trámite Académico', 'Resolución Directoral',
        'RD N° 046-2026-DG-IESTP-SUIZA',
        '{}'::jsonb, 'EXP-2026-000902', 'NO_LEIDO',
        '2026-11-19 00:45:00+00',
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b856',
        'CVD-2026-NOT-000902', '2026-11-19 00:45:00+00'
      )
    `, [ID_NOTIF_NOCHE, USR_DEST_ID]);

    // Notificación 3: Depósito en Fin de Semana (Sábado 21/11/2026 a las 11:00 UTC-5 -> 16:00 UTC)
    await rawClient.query(`
      INSERT INTO sigd_auth.notificacion_casilla (
        id, usuario_id, correo_destinatario, cut, asunto, tipo_acto,
        numero_documento, cuerpo, referencia, estado, fecha_deposito,
        hash_sha256, cvd, creado_en
      ) VALUES (
        $1::uuid, $2::uuid, 'juan.perez@estudiante.iestp-suiza.edu.pe',
        'EXP-2026-000903', 'Notificación en Fin de Semana', 'Resolución Directoral',
        'RD N° 047-2026-DG-IESTP-SUIZA',
        '{}'::jsonb, 'EXP-2026-000903', 'NO_LEIDO',
        '2026-11-21 16:00:00+00',
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b857',
        'CVD-2026-NOT-000903', '2026-11-21 16:00:00+00'
      )
    `, [ID_NOTIF_FINDE, USR_DEST_ID]);

    // Notificación 4: Depósito en Feriado Regional San Juan (Miércoles 24/06/2026 a las 09:30 UTC-5 -> 14:30 UTC)
    await rawClient.query(`
      INSERT INTO sigd_auth.notificacion_casilla (
        id, usuario_id, correo_destinatario, cut, asunto, tipo_acto,
        numero_documento, cuerpo, referencia, estado, fecha_deposito,
        hash_sha256, cvd, creado_en
      ) VALUES (
        $1::uuid, $2::uuid, 'juan.perez@estudiante.iestp-suiza.edu.pe',
        'EXP-2026-000904', 'Notificación en Feriado San Juan Ucayali', 'Resolución Directoral',
        'RD N° 048-2026-DG-IESTP-SUIZA',
        '{}'::jsonb, 'EXP-2026-000904', 'NO_LEIDO',
        '2026-06-24 14:30:00+00',
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b858',
        'CVD-2026-NOT-000904', '2026-06-24 14:30:00+00'
      )
    `, [ID_NOTIF_FERIADO, USR_DEST_ID]);

    // Tokens JWT
    tokenDestinatario = firmarTokenAcceso({
      sub: USR_DEST_ID,
      ctx: CTX_DEST,
      roles: ['CIUDADANO'],
    });

    tokenAjeno = firmarTokenAcceso({
      sub: USR_AJENO_ID,
      ctx: CTX_AJENO,
      roles: ['CIUDADANO'],
    });

    // App Express con pool transaccional
    app = construirApp(txPool.asPool());
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

  describe('Suite 1: Cómputo de Plazos Administrativos (D.S. N° 006-2026-JUS y Ley N° 31736)', () => {
    it('[T01] Depósito en día hábil dentro de horario institucional (08:00 - 17:00) adquiere eficacia el mismo día', async () => {
      const res = await request(app)
        .get(`/api/v1/casilla/notificaciones/${ID_NOTIF_HABIL}`)
        .set('Authorization', `Bearer ${tokenDestinatario}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(ID_NOTIF_HABIL);
      expect(res.body.fechaEfectoLegal).toBe('2026-11-18');
      expect(res.body.fechaInicioImpugnacion).toBe('2026-11-18');
      expect(res.body.plazoImpugnacionDiasHabiles).toBe(15);
      expect(res.body.fechaLimiteImpugnacion).toBe('2026-12-10');
      expect(res.body.validezLegalMensaje).toContain('adquiere eficacia legal el mismo día de su depósito');
      expect(res.body.validezLegalMensaje).toContain('D.S. N° 006-2026-JUS');
      expect(res.body.validezLegalMensaje).toContain('Ley N° 31736');
      expect(res.body.validezLegalMensaje).toContain('Art. 207.2');
    });

    it('[T02] Depósito fuera de horario institucional (>17:00) adquiere eficacia el primer día hábil siguiente', async () => {
      const res = await request(app)
        .get(`/api/v1/casilla/notificaciones/${ID_NOTIF_NOCHE}`)
        .set('Authorization', `Bearer ${tokenDestinatario}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(ID_NOTIF_NOCHE);
      expect(res.body.fechaEfectoLegal).toBe('2026-11-19');
      expect(res.body.fechaInicioImpugnacion).toBe('2026-11-19');
      expect(res.body.plazoImpugnacionDiasHabiles).toBe(15);
      expect(res.body.fechaLimiteImpugnacion).toBe('2026-12-11');
      expect(res.body.validezLegalMensaje).toContain('fuera del horario laboral de atención institucional');
      expect(res.body.validezLegalMensaje).toContain('2026-11-19');
      expect(res.body.validezLegalMensaje).toContain('D.S. N° 006-2026-JUS');
    });

    it('[T03] Depósito en fin de semana (sábado) adquiere eficacia el día lunes hábil siguiente', async () => {
      const res = await request(app)
        .get(`/api/v1/casilla/notificaciones/${ID_NOTIF_FINDE}`)
        .set('Authorization', `Bearer ${tokenDestinatario}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(ID_NOTIF_FINDE);
      expect(res.body.fechaEfectoLegal).toBe('2026-11-23');
      expect(res.body.fechaInicioImpugnacion).toBe('2026-11-23');
      expect(res.body.plazoImpugnacionDiasHabiles).toBe(15);
      expect(res.body.fechaLimiteImpugnacion).toBe('2026-12-15');
      expect(res.body.validezLegalMensaje).toContain('día no laborable institucional');
      expect(res.body.validezLegalMensaje).toContain('2026-11-23');
      expect(res.body.validezLegalMensaje).toContain('D.S. N° 006-2026-JUS');
    });

    it('[T04] Depósito en feriado regional de Ucayali (24 de junio San Juan) adquiere eficacia el siguiente día hábil', async () => {
      const res = await request(app)
        .get(`/api/v1/casilla/notificaciones/${ID_NOTIF_FERIADO}`)
        .set('Authorization', `Bearer ${tokenDestinatario}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(ID_NOTIF_FERIADO);
      expect(res.body.fechaEfectoLegal).toBe('2026-06-25');
      expect(res.body.fechaInicioImpugnacion).toBe('2026-06-25');
      expect(res.body.plazoImpugnacionDiasHabiles).toBe(15);
      // Vencimiento contando 25/06 como Día 1, saltando 29/06 (San Pedro y San Pablo)
      expect(res.body.fechaLimiteImpugnacion).toBe('2026-07-16');
      expect(res.body.validezLegalMensaje).toContain('día no laborable institucional');
      expect(res.body.validezLegalMensaje).toContain('2026-06-25');
    });

    it('[T05] Cómputo procesal con Feriado Regional del 18 de junio (Aniversario creación de Ucayali)', () => {
      // Depósito el 17/06/2026 en horario hábil
      const computo = computarPlazosNotificacionLpag('2026-06-17T10:00:00.000-05:00', []);
      expect(computo.fechaEfectoLegal).toBe('2026-06-17');
      expect(computo.fechaInicioImpugnacion).toBe('2026-06-17');
      expect(computo.plazoImpugnacionDiasHabiles).toBe(15);
      // Salta 18/06 (Identidad Ucayalina), 24/06 (San Juan), 29/06 (San Pedro y San Pablo)
      expect(computo.fechaLimiteImpugnacion).toBe('2026-07-10');
    });

    it('[T06] Exclusión del 13 de octubre como feriado de Ucayali (día hábil laborable en Pucallpa)', () => {
      // Notificación depositada el lunes 12/10/2026 en horario hábil
      const computo = computarPlazosNotificacionLpag('2026-10-12T10:00:00.000-05:00', []);
      expect(computo.fechaEfectoLegal).toBe('2026-10-12');
      expect(computo.fechaInicioImpugnacion).toBe('2026-10-12');
      expect(computo.plazoImpugnacionDiasHabiles).toBe(15);
      // El 13/10/2026 es hábil y cuenta como Día 2. El 01/11 es domingo.
      // Días: 12(1), 13(2), 14(3), 15(4), 16(5), 19(6), 20(7), 21(8), 22(9), 23(10), 26(11), 27(12), 28(13), 29(14), 30(15)
      expect(computo.fechaLimiteImpugnacion).toBe('2026-10-30');
    });

    it('[T07] Exclusión de los feriados nacionales del 8 y 9 de diciembre del cómputo de días hábiles', () => {
      // Cómputo que abarca feriados nacionales del 8 (Inmaculada Concepción) y 9 (Batalla de Ayacucho)
      const computo = computarPlazosNotificacionLpag('2026-11-18T10:00:00.000-05:00', []);
      expect(computo.fechaEfectoLegal).toBe('2026-11-18');
      expect(computo.fechaInicioImpugnacion).toBe('2026-11-18'); // Día 1 (Ley 31736 Art. 5.3)
      expect(computo.fechaLimiteImpugnacion).toBe('2026-12-10'); // Día 15 (salta 8 y 9 de diciembre)
    });

    it('[T08] Cómputo inclusivo del día de eficacia como Día 1 (Art. 5.3 Ley N° 31736)', () => {
      // Verificación de los 3 casos requeridos por la norma a noviembre 2026
      const c1 = computarPlazosNotificacionLpag('2026-11-18T10:00:00.000-05:00', []);
      expect(c1.fechaEfectoLegal).toBe('2026-11-18');
      expect(c1.fechaInicioImpugnacion).toBe('2026-11-18');
      expect(c1.fechaLimiteImpugnacion).toBe('2026-12-10');

      const c2 = computarPlazosNotificacionLpag('2026-11-18T19:30:00.000-05:00', []);
      expect(c2.fechaEfectoLegal).toBe('2026-11-19');
      expect(c2.fechaInicioImpugnacion).toBe('2026-11-19');
      expect(c2.fechaLimiteImpugnacion).toBe('2026-12-11');

      const c3 = computarPlazosNotificacionLpag('2026-11-21T11:00:00.000-05:00', []);
      expect(c3.fechaEfectoLegal).toBe('2026-11-23');
      expect(c3.fechaInicioImpugnacion).toBe('2026-11-23');
      expect(c3.fechaLimiteImpugnacion).toBe('2026-12-15');
    });

    it('[T09] Prórroga de vencimiento en día inhábil conforme al Art. 134.2 del TUO LPAG', () => {
      // Si el vencimiento cayera en día inhábil, se prorroga al primer día hábil siguiente
      const computo = computarPlazosNotificacionLpag('2026-11-18T10:00:00.000-05:00', []);
      const d = new Date(`${computo.fechaLimiteImpugnacion}T12:00:00Z`);
      const diaSem = d.getUTCDay();
      expect(diaSem).not.toBe(0); // No es domingo
      expect(diaSem).not.toBe(6); // No es sábado
    });
  });

  describe('Suite 2: Generación del Certificado Oficial de Acuse en Formato PDF', () => {
    it('[T10] Genera certificado de acuse PDF conforme con cabecera %PDF- y metadatos actualizados', async () => {
      const datosAcuse: DatosAcusePdf = {
        idAcuse: 'ACU-2026-000901',
        cvdAcuse: 'CVD-2026-ACU-000901',
        hashSha256Acuse: 'a1b2c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef0',
        fechaAcuseIso: '2026-11-18T15:35:00.000Z',
        entidadEmisora: 'Instituto de Educación Superior Tecnológico Público «Suiza»',
        unidadEmisora: 'DIRECCIÓN GENERAL',
        cut: 'EXP-2026-000901',
        asunto: 'Notificación de Resolución de Titulación',
        tipoActo: 'Resolución Directoral',
        numeroDocumento: 'RD N° 045-2026-DG-IESTP-SUIZA',
        destinatario: {
          nombresCompletos: 'Juan Pérez Vásquez',
          numeroDocumento: '70123456',
          tipoDocumento: 'DNI',
          direccionCasilla: '70123456@casilla.iestp-suiza.edu.pe',
        },
        fechaDepositoIso: '2026-11-18T15:30:00.000Z',
        fechaEfectoLegalIso: '2026-11-18',
        fechaInicioImpugnacionIso: '2026-11-18',
        fechaLimiteImpugnacionIso: '2026-12-10',
        plazoImpugnacionDiasHabiles: 15,
        notificacionId: ID_NOTIF_HABIL,
      };

      const bufferPdf = await generarCertificadoAcusePdf(datosAcuse);
      expect(bufferPdf).toBeInstanceOf(Buffer);
      expect(bufferPdf.length).toBeGreaterThan(1000);

      // Verificación de número mágico PDF
      const magicBytes = bufferPdf.subarray(0, 5).toString('ascii');
      expect(magicBytes).toBe('%PDF-');
    });
  });

  describe('Suite 3: Integración End-to-End con Base de Datos y Endpoints REST de Casilla', () => {
    it('[T11] Distinción entre depósito y confirmación de recepción (estado previo)', async () => {
      // Antes de confirmar: la notificación existe pero acuse es null y descargar acuse da 409
      const getRes = await request(app)
        .get(`/api/v1/casilla/notificaciones/${ID_NOTIF_HABIL}`)
        .set('Authorization', `Bearer ${tokenDestinatario}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.estado).toBe('NO_LEIDO');
      expect(getRes.body.acuse).toBeNull();
      expect(getRes.body.fechaNotificadoIso).toBeNull();

      const dlRes = await request(app)
        .get(`/api/v1/casilla/notificaciones/${ID_NOTIF_HABIL}/acuse/descargar`)
        .set('Authorization', `Bearer ${tokenDestinatario}`);
      expect(dlRes.status).toBe(409);
      expect(dlRes.body.code).toBe('ACK_NOT_REGISTERED');
    });

    it('[T12] POST /api/v1/casilla/notificaciones/:id/acuse genera idAcuse y persiste sellado en BD', async () => {
      // Intento sin confirmación explícita debe fallar con HTTP 400
      const resSinConf = await request(app)
        .post(`/api/v1/casilla/notificaciones/${ID_NOTIF_HABIL}/acuse`)
        .set('Authorization', `Bearer ${tokenDestinatario}`)
        .send({ confirmacionAdministrado: false });
      expect(resSinConf.status).toBe(400);

      // Con confirmación explícita
      const res = await request(app)
        .post(`/api/v1/casilla/notificaciones/${ID_NOTIF_HABIL}/acuse`)
        .set('Authorization', `Bearer ${tokenDestinatario}`)
        .send({
          confirmacionAdministrado: true,
          metadataCliente: {
            navegador: 'Vitest Automated Browser 1.0',
            zonaHoraria: 'America/Lima',
          },
        });

      expect(res.status).toBe(201);
      const acuse = res.body.data;
      expect(acuse.idAcuse).toMatch(/^ACU-2026-[A-F0-9]{8}$/);
      expect(acuse.hashSha256Acuse).toMatch(/^[a-f0-9]{64}$/i);
      expect(acuse.cvdAcuse).toContain('CVD-');
      expect(acuse.fechaEfectoLegal).toBe('2026-11-18');
      expect(acuse.fechaInicioImpugnacion).toBe('2026-11-18');
      expect(acuse.plazoImpugnacionDiasHabiles).toBe(15);
      expect(acuse.fechaLimiteImpugnacion).toBe('2026-12-10');
      expect(acuse.documentoUrl).toBeDefined();

      // Verificar persistencia física en sigd_auth.notificacion_casilla
      const poolDb = txPool.getRawClient();
      const checkRes = await poolDb.query(
        'SELECT estado, id_acuse, acuse_hash_sha256, acuse_sellado_tiempo FROM sigd_auth.notificacion_casilla WHERE id = $1',
        [ID_NOTIF_HABIL],
      );
      expect(checkRes.rows[0].estado).toBe('NOTIFICADO');
      expect(checkRes.rows[0].id_acuse).toBe(acuse.idAcuse);
      expect(checkRes.rows[0].acuse_sellado_tiempo).not.toBeNull();
    });

    it('[T13] GET /api/v1/casilla/notificaciones/:id/acuse/descargar entrega downloadUrl autorizada con TTL', async () => {
      const res = await request(app)
        .get(`/api/v1/casilla/notificaciones/${ID_NOTIF_HABIL}/acuse/descargar`)
        .set('Authorization', `Bearer ${tokenDestinatario}`);

      expect(res.status).toBe(200);
      expect(res.body.downloadUrl).toBeDefined();
      expect(res.body.expiraEnSegundos).toBe(900);
      expect(res.body.downloadUrl).toContain('/api/v1/casilla/notificaciones/');
      expect(res.body.downloadUrl).toContain('/acuse/archivo?token=');
    });

    it('[T14] Descarga directa vía token entrega el PDF con Content-Type: application/pdf y magic bytes %PDF-', async () => {
      // 1. Obtener la URL con token
      const descRes = await request(app)
        .get(`/api/v1/casilla/notificaciones/${ID_NOTIF_HABIL}/acuse/descargar`)
        .set('Authorization', `Bearer ${tokenDestinatario}`);

      const downloadUrl = descRes.body.downloadUrl;
      const urlParsed = new URL(downloadUrl);
      const pathnameConQuery = urlParsed.pathname + urlParsed.search;

      // 2. Descargar el archivo directamente sin cabecera de autenticación (fetch omit)
      const streamRes = await request(app)
        .get(pathnameConQuery);

      expect(streamRes.status).toBe(200);
      expect(streamRes.headers['content-type']).toBe('application/pdf');
      expect(streamRes.headers['content-disposition']).toContain('.pdf');

      const bodyBuffer = Buffer.from(streamRes.body);
      const magicBytes = bodyBuffer.subarray(0, 5).toString('ascii');
      expect(magicBytes).toBe('%PDF-');
    });

    it('[T15] Control Anti-IDOR: usuario no titular recibe HTTP 403 Forbidden', async () => {
      // Consulta de detalle ajeno
      const resDetalle = await request(app)
        .get(`/api/v1/casilla/notificaciones/${ID_NOTIF_HABIL}`)
        .set('Authorization', `Bearer ${tokenAjeno}`);
      expect(resDetalle.status).toBe(403);

      // Intento de generar acuse sobre notificación ajena
      const resAcuse = await request(app)
        .post(`/api/v1/casilla/notificaciones/${ID_NOTIF_HABIL}/acuse`)
        .set('Authorization', `Bearer ${tokenAjeno}`)
        .send({ confirmacionAdministrado: true });
      expect(resAcuse.status).toBe(403);

      // Intento de solicitar descarga de acuse ajeno
      const resDescarga = await request(app)
        .get(`/api/v1/casilla/notificaciones/${ID_NOTIF_HABIL}/acuse/descargar`)
        .set('Authorization', `Bearer ${tokenAjeno}`);
      expect(resDescarga.status).toBe(403);
    });

    it('[T16] Seguridad documental: no se expone s3Key ni credenciales de almacenamiento en respuestas REST', async () => {
      const res = await request(app)
        .get(`/api/v1/casilla/notificaciones/${ID_NOTIF_HABIL}`)
        .set('Authorization', `Bearer ${tokenDestinatario}`);

      expect(res.status).toBe(200);
      const cuerpoTexto = JSON.stringify(res.body);
      expect(cuerpoTexto).not.toContain('s3Key');
      expect(cuerpoTexto).not.toContain('s3_key');
      expect(cuerpoTexto).not.toContain('minioadmin');
      expect(cuerpoTexto).not.toContain('sigd-expedientes');
    });

    it('[T17] Régimen de Casilla Institucional (Ley N° 31736): no aplica acuse ficticio ni Art. 59.9 CUE/PCM', async () => {
      // Para una notificación no confirmada, el sistema no sintetiza un acuse falso
      const resNoLeida = await request(app)
        .get(`/api/v1/casilla/notificaciones/${ID_NOTIF_NOCHE}`)
        .set('Authorization', `Bearer ${tokenDestinatario}`);

      expect(resNoLeida.status).toBe(200);
      expect(resNoLeida.body.estado).toBe('NO_LEIDO');
      expect(resNoLeida.body.idAcuse).toBeNull();
      expect(resNoLeida.body.acuse).toBeNull();
    });
  });
});
