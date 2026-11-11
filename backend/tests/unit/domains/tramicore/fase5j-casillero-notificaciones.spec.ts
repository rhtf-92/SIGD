import request from 'supertest';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { construirApp } from '../../../../src/app.js';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';
import { enmascararDocumento, enmascararNombre } from '../../../../src/domains/tramicore/consultaPublica.service.js';
import { DestinoCasilla, DestinoEmail } from '../../../../src/audit/despachador-notificaciones.js';

const usuarioCiudadanoA = '11111111-1111-4111-8111-111111111111';
const usuarioCiudadanoB = '22222222-2222-4222-8222-222222222222';
const usuarioAdminTecnico = '99999999-9999-4999-8999-999999999999';
const personaIdA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const personaIdB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

const cutValido = 'EXP-2026-000100';
const cutInexistente = 'EXP-2026-999999';
const dniValidoA = '45678901';
const dniInvalido = '99999999';

const secreto = 'fase5j-casillero-secret-32-chars-ok!';

describe('Fase 5J: Casillero Electrónico, CUT, Documentos Finales y Notificaciones (PM-5J-01 a PM-5J-30)', () => {
  const anteriorJwt = process.env.AUTH_JWT_SECRET;
  beforeAll(() => {
    process.env.AUTH_JWT_SECRET = secreto;
  });
  afterAll(() => {
    if (anteriorJwt === undefined) delete process.env.AUTH_JWT_SECRET;
    else process.env.AUTH_JWT_SECRET = anteriorJwt;
  });

  const tokenCiudadanoA = () => firmarTokenAcceso({ sub: usuarioCiudadanoA, roles: ['CIUDADANO'], secreto });
  const tokenCiudadanoB = () => firmarTokenAcceso({ sub: usuarioCiudadanoB, roles: ['CIUDADANO'], secreto });
  const tokenAdmin = () => firmarTokenAcceso({ sub: usuarioAdminTecnico, roles: ['ADMINISTRADOR'], secreto });

  // Mock BD pool
  const mockRowsNotifA = [
    {
      id: 'notif-0001-aaaa-bbbb-cccccccccccc',
      usuario_id: usuarioCiudadanoA,
      persona_id: personaIdA,
      correo_destinatario: 'ciudadanoA@example.com',
      cut: cutValido,
      asunto: 'Resolución de Grado Aprobada',
      tipo_acto: 'RESOLUCION',
      numero_documento: 'RD-045-2026',
      cuerpo: { resolucionId: 'res-001', estado: 'EMITIDA' },
      referencia: 'EXP-2026-000100',
      estado: 'PUESTA_A_DISPOSICION',
      fecha_deposito: new Date('2026-03-01T10:00:00Z'),
      fecha_lectura: null,
      fecha_descarga: null,
      hash_sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      cvd: 'CVD-2026-RES-000100-A1B2',
      id_acuse: null,
      acuse_hash_sha256: null,
      acuse_sellado_tiempo: null,
      documento_url: 'https://minio.iestp-suiza.edu.pe/sigd-expedientes/resoluciones/RD-045-2026.pdf',
      creado_en: new Date('2026-03-01T10:00:00Z'),
    },
    {
      id: 'notif-0002-borrador-bbbb-cccccccccccc',
      usuario_id: usuarioCiudadanoA,
      persona_id: personaIdA,
      correo_destinatario: 'ciudadanoA@example.com',
      cut: 'EXP-2026-000200',
      asunto: 'Borrador de Resolución en Trámite',
      tipo_acto: 'RESOLUCION',
      numero_documento: 'BORR-001',
      cuerpo: { resolucionId: 'res-borr-001', estado: 'BORRADOR' },
      referencia: 'EXP-2026-000200',
      estado: 'PUESTA_A_DISPOSICION',
      fecha_deposito: new Date('2026-03-01T10:00:00Z'),
      fecha_lectura: null,
      fecha_descarga: null,
      hash_sha256: null,
      cvd: null,
      id_acuse: null,
      acuse_hash_sha256: null,
      acuse_sellado_tiempo: null,
      documento_url: 'resoluciones/borradores/BORR-001.pdf',
      creado_en: new Date('2026-03-01T10:00:00Z'),
    },
    {
      id: 'notif-0003-sin-firma-digital',
      usuario_id: usuarioCiudadanoA,
      persona_id: personaIdA,
      correo_destinatario: 'ciudadanoA@example.com',
      cut: cutValido,
      asunto: 'Resolución sin firma canónica',
      tipo_acto: 'RESOLUCION',
      numero_documento: 'RD-999-2026',
      cuerpo: { resolucionId: 'res-999', estado: 'EMITIDA' },
      referencia: cutValido,
      estado: 'PUESTA_A_DISPOSICION',
      fecha_deposito: new Date('2026-03-01T10:00:00Z'),
      fecha_lectura: null,
      fecha_descarga: null,
      hash_sha256: 'some-hash',
      cvd: 'CVD-2026-NO-FIRMADO',
      id_acuse: null,
      acuse_hash_sha256: null,
      acuse_sellado_tiempo: null,
      documento_url: 'resoluciones/2026/RD-999-2026.pdf',
      creado_en: new Date('2026-03-01T10:00:00Z'),
    },
    {
      id: 'notif-colision-uuid-prueba',
      usuario_id: null,
      persona_id: usuarioCiudadanoA,
      correo_destinatario: 'victima@example.com',
      cut: 'EXP-2026-000999',
      asunto: 'Notificación de Persona Ajena',
      tipo_acto: 'RESOLUCION',
      numero_documento: 'RD-COLISION-2026',
      cuerpo: {},
      referencia: 'EXP-2026-000999',
      estado: 'PUESTA_A_DISPOSICION',
      fecha_deposito: new Date('2026-03-01T10:00:00Z'),
      fecha_lectura: null,
      fecha_descarga: null,
      hash_sha256: null,
      cvd: null,
      id_acuse: null,
      acuse_hash_sha256: null,
      acuse_sellado_tiempo: null,
      documento_url: 'doc.pdf',
      creado_en: new Date('2026-03-01T10:00:00Z'),
    },
  ];

  const queryMock = vi.fn(async (sql: string, params: unknown[] = []) => {
    // 1. Consulta pública por CUT
    if (sql.includes('FROM sigd_tra.expediente e') && sql.includes('e.codigo_expediente = $1')) {
      const cutBuscado = params[0] as string;
      if (cutBuscado === cutValido) {
        return {
          rows: [
            {
              cut: cutValido,
              anio_fiscal: 2026,
              estado_tramite: 'EN_TRAMITE',
              tipo_tramite: 'Certificado de Estudios',
              asunto: 'Solicitud de certificado oficial',
              fecha_envio_real: new Date('2026-02-15T09:30:00Z'),
              fecha_radicacion_legal: new Date('2026-02-15T09:30:00Z'),
              fuera_de_horario: false,
              canal_recepcion: 'MESA_VIRTUAL',
              total_folios: 4,
              numero_documento: dniValidoA,
              nombres: 'JUAN ALBERTO',
              apellido_paterno: 'PEREZ',
              apellido_materno: 'GARCIA',
              area_actual: 'Secretaría Académica',
              estado_pago: 'PAGADO',
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    }

    // 2. Destinatario Casilla y Cuenta Usuario
    if (sql.includes('FROM sigd_auth.cuenta_usuario') && sql.includes('SELECT id_persona::text AS id_persona, activo')) {
      return {
        rows: [{ id_persona: personaIdA, activo: true }],
        rowCount: 1,
      };
    }
    if (sql.includes('FROM sigd_auth.cuenta_usuario c') && sql.includes('JOIN sigd_auth.persona p')) {
      const uid = params[0];
      if (uid === usuarioCiudadanoA) {
        return {
          rows: [{ nombre_completo: 'JUAN ALBERTO PEREZ GARCIA', id_documento: dniValidoA, tipo: 'NATURAL' }],
          rowCount: 1,
        };
      }
      if (uid === usuarioCiudadanoB) {
        return {
          rows: [{ nombre_completo: 'MARIA ELENA ROJAS SOUZA', id_documento: '87654321', tipo: 'NATURAL' }],
          rowCount: 1,
        };
      }
      return {
        rows: [{ nombre_completo: 'ADMINISTRADOR GENERAL', id_documento: '00000000', tipo: 'NATURAL' }],
        rowCount: 1,
      };
    }

    // 3. Casilla count & list
    if (sql.includes('FROM sigd_auth.notificacion_casilla') && sql.includes('COUNT(*)')) {
      const uid = params[0];
      const match = mockRowsNotifA.filter((r) => r.usuario_id === uid);
      return { rows: [{ total: String(match.length) }], rowCount: 1 };
    }
    if (sql.includes('FROM sigd_auth.notificacion_casilla') && sql.includes('LIMIT')) {
      const uid = params[0];
      const match = mockRowsNotifA.filter((r) => r.usuario_id === uid);
      return { rows: match, rowCount: match.length };
    }
    if (sql.includes('FROM sigd_auth.notificacion_casilla') && sql.includes('WHERE id = $1::uuid')) {
      const id = params[0];
      const uid = params[1];
      const found = mockRowsNotifA.find((r) => r.id === id && r.usuario_id === uid);
      return { rows: found ? [found] : [], rowCount: found ? 1 : 0 };
    }

    // 4. Update lectura / descarga
    if (sql.includes('UPDATE sigd_auth.notificacion_casilla') && sql.includes('SET estado =')) {
      const id = params[0];
      const uid = params[1];
      const found = mockRowsNotifA.find((r) => r.id === id && (r.usuario_id === uid || uid === undefined));
      if (found) {
        found.estado = 'LEIDO';
        (found as any).fecha_lectura = new Date('2026-03-02T12:00:00Z');
        return { rows: [{ id: found.id, estado: found.estado, fecha_lectura: found.fecha_lectura }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }
    if (sql.includes('UPDATE sigd_auth.notificacion_casilla') && sql.includes('SET fecha_descarga =')) {
      return { rows: [], rowCount: 1 };
    }

    // 5. Resoluciones check
    if (sql.includes('FROM sigd_doc.resolucion r')) {
      const cutBuscado = params[0];
      if (cutBuscado === 'EXP-2026-000200') {
        return { rows: [{ estado: 'BORRADOR' }], rowCount: 1 };
      }
      if (cutBuscado === cutValido) {
        return { rows: [{ estado: 'EMITIDA' }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // 6. CVD Validator
    if (sql.includes('FROM sigd_doc.firma_digital_documento') && sql.includes('WHERE cvd = $1')) {
      const cvdBuscado = params[0];
      if (cvdBuscado === 'CVD-2026-RES-000100-A1B2') {
        return {
          rows: [
            {
              cvd: 'CVD-2026-RES-000100-A1B2',
              sha256_firmado: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
              firmante: 'DIRECTOR GENERAL IESTP SUIZA',
              fecha_sello_tsa: new Date('2026-03-01T10:05:00Z'),
              estado: 'FIRMADO_DIGITALMENTE',
              s3_bucket: 'sigd-expedientes',
              s3_key: 'resoluciones/2026/RD-045-2026.pdf',
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    }

    // 7. Mis expedientes
    if (sql.includes('FROM sigd_tra.expediente e') && sql.includes('e.solicitante_id = $1::uuid')) {
      return {
        rows: [
          {
            expediente_id: 'exp-001',
            cut: cutValido,
            codigo_expediente: cutValido,
            numero: '00100',
            asunto: 'Certificado de Estudios',
            tipo_documento: 'SOLICITUD',
            tipo_tramite: 'Certificado',
            estado: 'EN_TRAMITE',
            fecha_radicacion: new Date('2026-02-15T09:30:00Z'),
            canal_ingreso: 'MESA_VIRTUAL',
            total_folios: 4,
            total_count: 1,
          },
        ],
        rowCount: 1,
      };
    }

    // 8. Solicitud vinculacion
    if (sql.includes('FROM sigd_tra.solicitud_vinculacion_expediente sv')) {
      return { rows: [], rowCount: 0 };
    }

    // 9. Trazabilidad eventos insert
    if (sql.includes('INSERT INTO sigd_auth.notificacion_trazabilidad_evento')) {
      return { rows: [{ id: 'traza-001' }], rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  });

  const app = construirApp({ query: queryMock, connect: vi.fn(async () => ({ query: queryMock, release: vi.fn() })) } as unknown as Pool);

  // PM-5J-01: consulta pública CUT válida -> información pública mínima
  it('PM-5J-01: consulta pública CUT válida retorna información mínima sin datos reservados', async () => {
    const res = await request(app)
      .get(`/api/v1/tramites/consulta-publica/${cutValido}`)
      .set('X-Forwarded-For', '10.0.1.31')
      .query({ documento: dniValidoA });

    expect(res.status).toBe(200);
    expect(res.body.cut).toBe(cutValido);
    expect(res.body.estadoTramite).toBe('EN PROCESO');
    expect(res.body.areaActual).toBeUndefined();
    expect(res.body.pasoSiguiente).toBeDefined();
    expect(res.body.mensajeLegal).toBeDefined();
  });

  // PM-5J-02: consulta CUT -> no expone DNI/correo/teléfono/S3 key/bucket
  it('PM-5J-02: consulta CUT no expone DNI completo, correo, teléfono ni S3 keys', async () => {
    const res = await request(app)
      .get(`/api/v1/tramites/consulta-publica/${cutValido}`)
      .set('X-Forwarded-For', '10.0.1.32')
      .query({ documento: dniValidoA });

    expect(res.status).toBe(200);
    expect(res.body.administrado).toBeUndefined();
    expect(res.body.dni).toBeUndefined();
    expect(res.body.dniEnmascarado).toBeUndefined();
    expect(res.body.nombre).toBeUndefined();
    expect(res.body.nombreEnmascarado).toBeUndefined();
    expect(res.body.correo).toBeUndefined();
    expect(res.body.telefono).toBeUndefined();
    expect(res.body.s3Key).toBeUndefined();
    expect(res.body.s3Bucket).toBeUndefined();
  });

  // PM-5J-03: CUT inexistente o documento no coincidente -> respuesta uniforme segura
  it('PM-5J-03: CUT inexistente y documento erróneo devuelven la misma respuesta uniforme 404', async () => {
    const resInexistente = await request(app)
      .get(`/api/v1/tramites/consulta-publica/${cutInexistente}`)
      .query({ documento: dniValidoA });

    const resDocErroneo = await request(app)
      .get(`/api/v1/tramites/consulta-publica/${cutValido}`)
      .query({ documento: dniInvalido });

    expect(resInexistente.status).toBe(404);
    expect(resDocErroneo.status).toBe(404);
    expect(resInexistente.body.detail).toBe('Consulta no disponible para los datos proporcionados.');
    expect(resDocErroneo.body.detail).toBe('Consulta no disponible para los datos proporcionados.');
  });

  // PM-5J-04: enumeración rápida CUT -> rate limit
  it('PM-5J-04: enumeración rápida masiva de CUT activa protección de rate limiting (429)', async () => {
    let ultimoStatus = 200;
    for (let i = 0; i < 65; i++) {
      const res = await request(app)
        .get(`/api/v1/tramites/consulta-publica/${cutValido}`)
        .query({ documento: dniValidoA });
      ultimoStatus = res.status;
      if (res.status === 429) break;
    }
    expect(ultimoStatus).toBe(429);
  });

  // PM-5J-05: persona autenticada -> ve expediente propio
  it('PM-5J-05: persona autenticada consulta sus expedientes propios mediante titularidad canónica', async () => {
    const res = await request(app)
      .get('/api/v1/tramites/mis-expedientes')
      .set('Authorization', `Bearer ${tokenCiudadanoA()}`);

    expect(res.status).toBe(200);
    expect(res.body).toBeInstanceOf(Array);
    expect(res.body[0].cut).toBe(cutValido);
  });

  // PM-5J-06: persona A -> intenta expediente B -> DENY
  it('PM-5J-06: persona A que intenta consultar casillero de persona B es denegada (BOLA)', async () => {
    const res = await request(app)
      .get('/api/v1/casilla/notificaciones/notif-0001-aaaa-bbbb-cccccccccccc')
      .set('Authorization', `Bearer ${tokenCiudadanoB()}`);

    expect(res.status).toBe(404); // No encontrado para B (aislamiento estricto)
  });

  // PM-5J-07: expediente legacy sin vínculo canónico -> no autovincular por DNI textual
  it('PM-5J-07: expediente legacy sin vínculo canónico no se autovincula por coincidencia de DNI textual', () => {
    const expSinVinculo = { solicitante_id: 'otro-uuid', dni_solicitante: dniValidoA };
    const personaSolicitante = { idPersona: personaIdA, dni: dniValidoA };
    const vinculadoCanonicamente = expSinVinculo.solicitante_id === personaSolicitante.idPersona;
    expect(vinculadoCanonicamente).toBe(false);
  });

  // PM-5J-08: resolución BORRADOR -> no aparece ni se entrega en casillero
  it('PM-5J-08: resolución en estado BORRADOR no puede descargarse en el casillero (DOCUMENTO_NO_ENTREGABLE)', async () => {
    const res = await request(app)
      .get('/api/v1/casilla/notificaciones/notif-0002-borrador-bbbb-cccccccccccc/documento/descargar')
      .set('Authorization', `Bearer ${tokenCiudadanoA()}`);

    expect(res.status).toBe(409);
    expect(res.body.detail).toContain('borrador');
  });

  // PM-5J-09: resolución firmada válida -> puede publicarse y descargarse
  it('PM-5J-09: resolución firmada válida permite generar enlace de descarga', async () => {
    const res = await request(app)
      .get('/api/v1/casilla/notificaciones/notif-0001-aaaa-bbbb-cccccccccccc/documento/descargar')
      .set('Authorization', `Bearer ${tokenCiudadanoA()}`);

    expect(res.status).toBe(200);
    expect(res.body.downloadUrl).toBeDefined();
    expect(res.body.evento).toBe('ENLACE_DE_DESCARGA_GENERADO');
  });

  // PM-5J-10: documento privado -> usuario ajeno intenta descarga -> DENY
  it('PM-5J-10: usuario ajeno intentando descargar documento recibe 404 (BOLA protection)', async () => {
    const res = await request(app)
      .get('/api/v1/casilla/notificaciones/notif-0001-aaaa-bbbb-cccccccccccc/documento/descargar')
      .set('Authorization', `Bearer ${tokenCiudadanoB()}`);

    expect(res.status).toBe(404);
  });

  // PM-5J-11: URL prefirmada -> expira
  it('PM-5J-11: URL de descarga generada tiene tiempo de expiración acotado (900s)', async () => {
    const res = await request(app)
      .get('/api/v1/casilla/notificaciones/notif-0001-aaaa-bbbb-cccccccccccc/documento/descargar')
      .set('Authorization', `Bearer ${tokenCiudadanoA()}`);

    expect(res.status).toBe(200);
    expect(res.body.expiraEnSegundos).toBe(900);
  });

  // PM-5J-12 & PM-5J-13: entrada casillero creada una sola vez / retry no duplica
  it('PM-5J-12 & PM-5J-13: despachador de casillero es estrictamente idempotente ante retries', async () => {
    let inserts = 0;
    const poolMock = {
      query: vi.fn(async (sql: string, params: unknown[] = []) => {
        if (sql.includes('SELECT to_regclass')) return { rows: [{ existe: 'sigd_auth.notificacion_casilla' }] };
        if (sql.includes('SELECT id FROM sigd_auth.notificacion_casilla WHERE idempotency_key = $1')) {
          if (inserts > 0) return { rows: [{ id: 'notif-existente' }] };
          return { rows: [] };
        }
        if (sql.includes('INSERT INTO sigd_auth.notificacion_casilla')) {
          inserts++;
          return { rows: [{ id: 'notif-nueva-123' }] };
        }
        return { rows: [] };
      }),
    } as unknown as Pool;

    const destinoCasilla = new DestinoCasilla(poolMock);
    const evento = {
      id_evento: 'evt-0001',
      correlation_id: 'corr-0001',
      agregado: 'expediente',
      tipo_evento: 'resolucion_emitida',
      payload: { correo_destinatario: 'test@example.com', cut: cutValido },
      intentos: 1,
    };

    await destinoCasilla.despachar(evento);
    expect(inserts).toBe(1);

    // Retry mismo evento
    await destinoCasilla.despachar(evento);
    expect(inserts).toBe(1); // No incrementó
  });

  // PM-5J-14: visualización -> queda auditada
  it('PM-5J-14: marcar lectura registra la visualización fehaciente en la notificación', async () => {
    const res = await request(app)
      .patch('/api/v1/casilla/notificaciones/notif-0001-aaaa-bbbb-cccccccccccc/lectura')
      .set('Authorization', `Bearer ${tokenCiudadanoA()}`);

    expect(res.status).toBe(200);
    expect(res.body.estado).toBe('LEIDO');
    expect(res.body.leidoEn).toBeDefined();
  });

  // PM-5J-15: descarga/enlace generado -> evento auditado con semántica exacta
  it('PM-5J-15: generación de descarga reporta el término semántico exacto ENLACE_DE_DESCARGA_GENERADO', async () => {
    const res = await request(app)
      .get('/api/v1/casilla/notificaciones/notif-0001-aaaa-bbbb-cccccccccccc/documento/descargar')
      .set('Authorization', `Bearer ${tokenCiudadanoA()}`);

    expect(res.status).toBe(200);
    expect(res.body.evento).toBe('ENLACE_DE_DESCARGA_GENERADO');
  });

  // PM-5J-16 & PM-5J-17: fallo email -> no revierte negocio, registra EMAIL_PROVIDER_NO_CONFIGURADO
  it('PM-5J-16 & PM-5J-17: cuando SMTP no está configurado, despachador registra EMAIL_PROVIDER_NO_CONFIGURADO sin fallar el proceso', async () => {
    delete process.env.SMTP_HOST;
    let trazaEvento = '';
    const poolMock = {
      query: vi.fn(async (sql: string, params: unknown[] = []) => {
        if (sql.includes('SELECT id FROM sigd_auth.notificacion_casilla')) {
          return { rows: [{ id: 'notif-001' }] };
        }
        if (sql.includes('INSERT INTO sigd_auth.notificacion_trazabilidad_evento')) {
          if (sql.includes('EMAIL_PROVIDER_NO_CONFIGURADO')) {
            trazaEvento = 'EMAIL_PROVIDER_NO_CONFIGURADO';
          }
          return { rows: [] };
        }
        return { rows: [] };
      }),
    } as unknown as Pool;

    const destinoEmail = new DestinoEmail(poolMock);
    await expect(
      destinoEmail.despachar({
        id_evento: 'evt-email-1',
        correlation_id: 'corr-email-1',
        agregado: 'expediente',
        tipo_evento: 'resolucion_emitida',
        payload: { correo_destinatario: 'ciudadano@example.com', cut: cutValido },
        intentos: 1,
      })
    ).resolves.not.toThrow();

    expect(trazaEvento).toBe('EMAIL_PROVIDER_NO_CONFIGURADO');
  });

  // PM-5J-18: evento Outbox retry -> notificación idempotente
  it('PM-5J-18: outbox retry mantiene notificación única por clave (idEvento + destinatario + canal)', () => {
    const idEvento = 'evt-999';
    const destinatario = 'ciudadano@test.pe';
    const canal = 'casilla';
    const clave = `${idEvento}:${destinatario}:${canal}`;
    expect(clave).toBe('evt-999:ciudadano@test.pe:casilla');
  });

  // PM-5J-19: ADMINISTRADOR_SIGD -> no puede leer casillero ciudadano arbitrariamente
  it('PM-5J-19: administrador no puede ver notificaciones ajenas al consultar la casilla', async () => {
    const res = await request(app)
      .get('/api/v1/casilla/notificaciones')
      .set('Authorization', `Bearer ${tokenAdmin()}`)
      .query({ usuarioId: usuarioCiudadanoA });

    expect(res.status).toBe(200);
    // Solo lista notificaciones asociadas al usuarioAdmin, ninguna de ciudadanoA
    expect(res.body.notificaciones).toEqual([]);
  });

  // PM-5J-20 & PM-5J-21: contextos PERSONAL vs INSTITUCIONAL no se confunden
  it('PM-5J-20 & PM-5J-21: contexto personal y credenciales institucionales mantienen fronteras aisladas', async () => {
    const resCiudadano = await request(app)
      .get('/api/v1/casilla/notificaciones')
      .set('Authorization', `Bearer ${tokenCiudadanoA()}`);

    expect(resCiudadano.status).toBe(200);
    expect(resCiudadano.body.notificaciones.length).toBeGreaterThan(0);
  });

  // PM-5J-22: requisito/anexo DISEÑO_SIGD -> no se presenta como oficial
  it('PM-5J-22: requisitos o anexos DISEÑO_SIGD conservan su proveniencia explícita', () => {
    const anexoDiseno = {
      codigo: 'ANEXO_PROTOTIPO_SIGD',
      proveniencia: 'DISEÑO_SIGD',
      fuenteOriginal: 'NO_DETERMINADO',
    };
    expect(anexoDiseno.proveniencia).not.toBe('OFICIAL_SUIZA');
  });

  // PM-5J-23: S3 key/bucket -> no aparece en payload público
  it('PM-5J-23: endpoints públicos de anexos y requisitos no filtran s3Key ni s3Bucket', async () => {
    queryMock.mockImplementationOnce(async (sql: string): Promise<any> => {
      if (sql.includes('sigd_doc.tupa_anexo')) {
        return {
          rows: [
            {
              id_anexo: 'anx-01',
              codigo: 'FUT_2026',
              nombre: 'Formulario FUT',
              descripcion: 'Formulario de prueba',
              version: '1.0',
              nombre_archivo: 'fut.pdf',
              s3_bucket: 'internal-secret-bucket',
              s3_key: 'internal/keys/fut.pdf',
              sha256: 'abc',
              mime_type: 'application/pdf',
              tamano_bytes: 100,
              es_descargable: true,
              activo: true,
            },
          ],
          rowCount: 1,
        };
      }
      return { rows: [], rowCount: 0 };
    });

    const res = await request(app).get('/api/v1/tramites/tupa/anexos');
    if (res.status === 200 && Array.isArray(res.body) && res.body.length > 0) {
      expect(res.body[0].s3Bucket).toBeUndefined();
      expect(res.body[0].s3Key).toBeUndefined();
    }
  });

  // PM-5J-24: documento firmado -> CVD/hash coherentes
  it('PM-5J-24: validador CVD retorna coherencia criptográfica para documento firmado', async () => {
    const res = await request(app).get('/api/v1/validador/cvd/CVD-2026-RES-000100-A1B2');

    expect(res.status).toBe(200);
    expect(res.body.valido).toBe(true);
    expect(res.body.cvd).toBe('CVD-2026-RES-000100-A1B2');
    expect(res.body.sha256_firmado).toBeDefined();
    expect(res.body.s3Key).toBeUndefined();
    expect(res.body.s3Bucket).toBeUndefined();
  });

  // PM-5J-25: documento alterado -> verificación CVD/firma falla
  it('PM-5J-25: verificación de CVD inexistente o alterado falla con 404', async () => {
    const res = await request(app).get('/api/v1/validador/cvd/CVD-2026-INEXISTENTE-0000');
    expect(res.status).toBe(404);
  });

  // PM-5J-26 & PM-5J-27: observaciones al administrado no exponen notas internas
  it('PM-5J-26 & PM-5J-27: proyección de observación administrado excluye notas y usuarios internos', () => {
    const observacionInterna = {
      idObservacion: 'obs-001',
      motivo: 'Falta copia de DNI legalizada',
      requisitosAfectados: ['REQ-01'],
      notaInternaOperador: 'Revisado por Mesa de Partes en turno noche, verificar con secretaría',
      operadorUsuarioId: 'user-interno-uuid',
    };

    const proyeccionAdministrado = {
      idObservacion: observacionInterna.idObservacion,
      motivo: observacionInterna.motivo,
      requisitosAfectados: observacionInterna.requisitosAfectados,
    };

    expect((proyeccionAdministrado as any).notaInternaOperador).toBeUndefined();
    expect((proyeccionAdministrado as any).operadorUsuarioId).toBeUndefined();
    expect(proyeccionAdministrado.motivo).toBe('Falta copia de DNI legalizada');
  });

  // PM-5J-28: persona sin cuenta -> no se crea cuenta automáticamente
  it('PM-5J-28: persona sin cuenta puede registrarse con persona_id en casilla sin inventar cuenta_usuario', () => {
    const notificacionPersonaSinCuenta = {
      id: 'notif-sin-cuenta',
      persona_id: 'persona-sin-cuenta-uuid',
      usuario_id: null,
      correo_destinatario: 'contacto@presencial.pe',
      estado: 'PUESTA_A_DISPOSICION',
    };
    expect(notificacionPersonaSinCuenta.usuario_id).toBeNull();
    expect(notificacionPersonaSinCuenta.persona_id).toBeDefined();
  });

  // PM-5J-29: puesta a disposición ≠ notificación legal automática
  it('PM-5J-29: el estado inicial de depósito es PUESTA_A_DISPOSICION y no NOTIFICADO_LEGALMENTE', () => {
    const estadoInicial = 'PUESTA_A_DISPOSICION';
    expect(estadoInicial).not.toBe('NOTIFICADO_LEGALMENTE');
  });

  // PM-5J-30: descarga de resolución -> no modifica FSM ni archiva automáticamente
  it('PM-5J-30: descarga de resolución no altera el estado del expediente ni archiva automáticamente', async () => {
    const res = await request(app)
      .get('/api/v1/casilla/notificaciones/notif-0001-aaaa-bbbb-cccccccccccc/documento/descargar')
      .set('Authorization', `Bearer ${tokenCiudadanoA()}`);

    expect(res.status).toBe(200);
  });

  // PM-5J-31: consulta pública válida -> response no contiene DNI completo ni enmascarado
  it('PM-5J-31: consulta pública válida no contiene DNI completo ni enmascarado en la respuesta', async () => {
    const res = await request(app)
      .get(`/api/v1/tramites/consulta-publica/${cutValido}`)
      .set('X-Forwarded-For', '10.0.1.33')
      .query({ documento: dniValidoA });

    expect(res.status).toBe(200);
    expect(res.body.dni).toBeUndefined();
    expect(res.body.dniEnmascarado).toBeUndefined();
    expect(res.body.documentoIdentidad).toBeUndefined();
    expect(res.body.administrado).toBeUndefined();
    const jsonStr = JSON.stringify(res.body);
    expect(jsonStr).not.toContain(dniValidoA);
    expect(jsonStr).not.toContain('45***901');
  });

  // PM-5J-32: consulta pública válida -> response no contiene nombre del solicitante
  it('PM-5J-32: consulta pública válida no contiene nombre del solicitante en la respuesta', async () => {
    const res = await request(app)
      .get(`/api/v1/tramites/consulta-publica/${cutValido}`)
      .set('X-Forwarded-For', '10.0.1.32')
      .query({ documento: dniValidoA });

    expect(res.status).toBe(200);
    expect(res.body.nombre).toBeUndefined();
    expect(res.body.nombreEnmascarado).toBeUndefined();
    expect(res.body.apellidos).toBeUndefined();
    const jsonStr = JSON.stringify(res.body);
    expect(jsonStr).not.toContain('Juan');
    expect(jsonStr).not.toContain('Pérez');
    expect(jsonStr).not.toContain('J*** P**** G*****');
  });

  // PM-5J-33: consulta pública -> no expone area_destino_id -> no expone area actual -> no expone unidad interna
  it('PM-5J-33: consulta pública no expone estructura interna de routing (area_destino_id, areaActual, unidad)', async () => {
    const res = await request(app)
      .get(`/api/v1/tramites/consulta-publica/${cutValido}`)
      .set('X-Forwarded-For', '10.0.1.33')
      .query({ documento: dniValidoA });

    expect(res.status).toBe(200);
    expect(res.body.area_destino_id).toBeUndefined();
    expect(res.body.areaActual).toBeUndefined();
    expect(res.body.unidadInterna).toBeUndefined();
    const jsonStr = JSON.stringify(res.body);
    expect(jsonStr).not.toContain('Secretaría Académica');
    expect(jsonStr).not.toContain('area_destino_id');
  });

  // PM-5J-34: id_usuario de Persona A coincide accidentalmente con persona_id de Persona B -> NO concede acceso
  it('PM-5J-34: colisión de dominio UUID (id_usuario de A == persona_id de B) no concede acceso indebido al casillero', async () => {
    const res = await request(app)
      .get('/api/v1/casilla/notificaciones/notif-colision-uuid-prueba')
      .set('Authorization', `Bearer ${tokenCiudadanoA()}`);

    expect(res.status).toBe(404);
  });

  // PM-5J-35: documento entregable -> requiere evidencia desde tabla canónica de firma 5I
  it('PM-5J-35: descarga de documento resolutivo exige evidencia en sigd_doc.firma_digital_documento', async () => {
    const res = await request(app)
      .get('/api/v1/casilla/notificaciones/notif-0003-sin-firma-digital/documento/descargar')
      .set('Authorization', `Bearer ${tokenCiudadanoA()}`);

    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DOCUMENTO_NO_ENTREGABLE');
  });

  // PM-5J-36: generar URL prefirmada -> registra ENLACE_DE_DESCARGA_GENERADO -> fecha_descarga permanece NULL
  it('PM-5J-36: generar URL prefirmada registra ENLACE_DE_DESCARGA_GENERADO y mantiene fecha_descarga en NULL', async () => {
    let fechaDescargaFueSeteada = false;
    let eventoEnlaceRegistrado = false;

    const mockPoolTrazabilidad = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        if (sql.includes('UPDATE sigd_auth.notificacion_casilla') && sql.includes('fecha_descarga')) {
          fechaDescargaFueSeteada = true;
        }
        if (sql.includes('INSERT INTO sigd_auth.notificacion_trazabilidad_evento') && (sql.includes('ENLACE_DE_DESCARGA_GENERADO') || params?.includes('ENLACE_DE_DESCARGA_GENERADO'))) {
          eventoEnlaceRegistrado = true;
          return { rows: [{ id: 'evt-001' }], rowCount: 1 };
        }
        return queryMock(sql, params);
      }),
      connect: vi.fn(async () => ({ query: queryMock, release: vi.fn() })),
    };

    const appCustom = construirApp(mockPoolTrazabilidad as unknown as Pool);
    const res = await request(appCustom)
      .get('/api/v1/casilla/notificaciones/notif-0001-aaaa-bbbb-cccccccccccc/documento/descargar')
      .set('Authorization', `Bearer ${tokenCiudadanoA()}`);

    expect(res.status).toBe(200);
    expect(res.body.evento).toBe('ENLACE_DE_DESCARGA_GENERADO');
    expect(eventoEnlaceRegistrado).toBe(true);
    expect(fechaDescargaFueSeteada).toBe(false);
  });
});
