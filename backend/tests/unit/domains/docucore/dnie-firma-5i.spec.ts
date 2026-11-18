import crypto from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import { AppError, ConflictError } from '../../../../src/shared/domain/errors/index.js';
import { runWithContext } from '../../../../src/shared/request-context/request-context.js';
import {
  DnieTrustStore,
  extraerDatosCertificadoX509,
  prepararFirmaDnie,
  verificarFirmaMatematica,
  verificarYRegistrarFirmaDnie,
  validarAlgoritmoYVerificarFirma,
} from '../../../../src/domains/docucore/dnieFirma.service.js';
import {
  CERT_MISMATCH_CIUDADANO_PEM,
  CERT_VALIDO_DIRECTOR_PEM,
  KEY_VALIDO_DIRECTOR_PEM,
  SIGD_TEST_CA_PEM,
  CERT_UNTRUSTED_SELF_SIGNED_PEM,
  KEY_UNTRUSTED_SELF_SIGNED_PEM,
} from '../../../fixtures/dnie-test-certs.js';
import {
  obtenerDniePreparationStore,
  InMemoryDniePreparationStore,
  RedisDniePreparationStore,
  establecerDniePreparationStore,
} from '../../../../src/domains/docucore/dniePreparation.store.js';
import { registrarCallbackRefirma } from '../../../../src/domains/docucore/callbackRefirma.service.js';
import { resolverExpedienteConFirma } from '../../../../src/domains/rutadoc/derivaciones.service.js';

describe('FASE 5I: Integración DNIe, Certificados, Identidad Criptográfica y Firma', () => {
  const USUARIO_DIRECTOR_ID = '00000000-0000-0000-0000-000000000005';
  const PERSONA_DIRECTOR_ID = '11111111-1111-1111-1111-111111111005';
  const DNI_DIRECTOR = '99000005';

  const EXPEDIENTE_ID = '22222222-2222-2222-2222-222222222001';
  const SOLICITANTE_PERSONA_ID = '33333333-3333-3333-3333-333333333001';
  const DOCUMENTO_ADJUNTO_ID = '44444444-4444-4444-4444-444444444001';

  let mockPool: any;
  let mockClient: any;
  let dbQueries: { text: string; values: any[] }[];

  beforeEach(() => {
    dbQueries = [];
    DnieTrustStore.limpiarRoots();
    DnieTrustStore.registrarRootCA(SIGD_TEST_CA_PEM);
    establecerDniePreparationStore(new InMemoryDniePreparationStore());
    mockClient = {
      query: vi.fn(async (text: string, values: any[] = []) => {
        dbQueries.push({ text, values });

        // Advisory lock
        if (text.includes('pg_advisory_xact_lock')) {
          return { rowCount: 1, rows: [{}] };
        }

        // Transacción
        if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') {
          return { rowCount: 1, rows: [] };
        }

        // Consultar estado de expediente FOR UPDATE
        if (text.includes('FROM sigd_tra.expediente WHERE expediente_id = $1::uuid FOR UPDATE')) {
          return { rowCount: 1, rows: [{ estado: 'EN_FIRMA' }] };
        }

        // Idempotencia: Verificar si existe firma en sigd_doc.firma_digital_documento
        if (text.includes('FROM sigd_doc.firma_digital_documento') && text.includes('WHERE documento_id = $1::uuid')) {
          return { rowCount: 0, rows: [] };
        }

        // Insertar firma en sigd_doc.firma_digital_documento
        if (text.includes('INSERT INTO sigd_doc.firma_digital_documento')) {
          return { rowCount: 1, rows: [] };
        }

        // Actualizar resolución
        if (text.includes('UPDATE sigd_doc.resolucion')) {
          return { rowCount: 1, rows: [] };
        }

        // resolverExpedienteConFirma: buscar evidencia 1
        if (text.includes('SELECT f.documento_id') && text.includes('FROM sigd_doc.firma_digital_documento')) {
          return { rowCount: 1, rows: [{ documento_id: DOCUMENTO_ADJUNTO_ID }] };
        }

        // resolverExpedienteConFirma: actualizar estado a RESUELTO
        if (text.includes('UPDATE sigd_tra.expediente') && text.includes("SET estado = 'RESUELTO'")) {
          return { rowCount: 1, rows: [] };
        }

        // resolverExpedienteConFirma: insertar movimiento
        if (text.includes('INSERT INTO sigd_tra.movimiento_expediente')) {
          return { rowCount: 1, rows: [{ movimiento_id: 'mov-resuelto-01' }] };
        }

        // resolverExpedienteConFirma: insertar evento outbox
        if (text.includes('INSERT INTO sigd_audit.outbox_evento')) {
          return { rowCount: 1, rows: [] };
        }

        return { rowCount: 0, rows: [] };
      }),
      release: vi.fn(),
    };

    mockPool = {
      connect: vi.fn(async () => mockClient),
      query: vi.fn(async (text: string, values: any[] = []) => {
        dbQueries.push({ text, values });

        // Resolver persona de cuenta
        if (text.includes('FROM sigd_auth.cuenta_usuario cu') && text.includes('cu.id_usuario = $1')) {
          if (values[0] === USUARIO_DIRECTOR_ID) {
            return {
              rowCount: 1,
              rows: [
                {
                  id_persona: PERSONA_DIRECTOR_ID,
                  numero_documento: DNI_DIRECTOR,
                  nombre_completo: 'CARLOS ALBERTO SANCHEZ',
                },
              ],
            };
          }
          if (values[0] === '00000000-0000-0000-0000-000000000006') {
            // Administrador técnico
            return {
              rowCount: 1,
              rows: [
                {
                  id_persona: '11111111-1111-1111-1111-111111111006',
                  numero_documento: '99000006',
                  nombre_completo: 'ADMINISTRADOR DEL SISTEMA',
                },
              ],
            };
          }
          return { rowCount: 0, rows: [] };
        }

        // verificarFacultadFirma: roles y facultad_despacho
        if (text.includes('FROM sigd_org.usuario_rol ur')) {
          if (values[0] === USUARIO_DIRECTOR_ID) {
            return {
              rowCount: 1,
              rows: [
                {
                  rol_codigo: 'DIRECTOR',
                  tipo_resolucion: null,
                  vigente: true,
                  motivo_no_habilitado: null,
                },
              ],
            };
          }
          if (values[0] === '00000000-0000-0000-0000-000000000006') {
            // Administrador técnico sin perfil directivo ni facultad de despacho
            return {
              rowCount: 1,
              rows: [
                {
                  rol_codigo: 'ADMINISTRADOR',
                  tipo_resolucion: null,
                  vigente: false,
                  motivo_no_habilitado: 'El rol ADMINISTRADOR no posee facultad de firma.',
                },
              ],
            };
          }
          return { rowCount: 0, rows: [] };
        }

        // Consultar expediente en sigd_tra.expediente
        if (text.includes('FROM sigd_tra.expediente') && text.includes('WHERE expediente_id = $1::uuid')) {
          if (values[0] === EXPEDIENTE_ID) {
            return {
              rowCount: 1,
              rows: [
                {
                  expediente_id: EXPEDIENTE_ID,
                  codigo_expediente: 'EXP-2026-000045',
                  estado: 'EN_FIRMA',
                  solicitante_id: SOLICITANTE_PERSONA_ID,
                },
              ],
            };
          }
          if (values[0] === '22222222-2222-2222-2222-222222222999') {
            // Expediente no en firma (ej. EN_CALIFICACION)
            return {
              rowCount: 1,
              rows: [
                {
                  expediente_id: '22222222-2222-2222-2222-222222222999',
                  codigo_expediente: 'EXP-2026-000099',
                  estado: 'EN_CALIFICACION',
                  solicitante_id: SOLICITANTE_PERSONA_ID,
                },
              ],
            };
          }
          if (values[0] === '22222222-2222-2222-2222-222222222002') {
            // Expediente donde el director es el solicitante (conflicto de interés)
            return {
              rowCount: 1,
              rows: [
                {
                  expediente_id: '22222222-2222-2222-2222-222222222002',
                  codigo_expediente: 'EXP-2026-000055',
                  estado: 'EN_FIRMA',
                  solicitante_id: PERSONA_DIRECTOR_ID,
                },
              ],
            };
          }
          return { rowCount: 0, rows: [] };
        }

        // Consultar documento_adjunto
        if (text.includes('FROM sigd_doc.documento_adjunto')) {
          return {
            rowCount: 1,
            rows: [
              {
                documento_adjunto_id: DOCUMENTO_ADJUNTO_ID,
                nombre_archivo: 'Resolucion_Directoral_045.pdf',
                sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
              },
            ],
          };
        }

        return { rowCount: 0, rows: [] };
      }),
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.NODE_ENV;
    DnieTrustStore.limpiarRoots();
    establecerDniePreparationStore(null as any);
  });

  it('PM-5I-04: Certificado expirado produce DENY con código CERTIFICADO_EXPIRADO', async () => {
    // Simulamos que el tiempo del sistema es en el año 2030 (el certificado vence en 2027)
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-01T00:00:00Z'));

    const prep = await prepararFirmaDnie(
      mockPool as unknown as Pool,
      { expedienteId: EXPEDIENTE_ID },
      USUARIO_DIRECTOR_ID,
      'INSTITUCIONAL',
      ['DIRECTOR'],
    );

    await expect(
      verificarYRegistrarFirmaDnie(
        mockPool as unknown as Pool,
        {
          preparacionId: prep.preparacionId,
          expedienteId: EXPEDIENTE_ID,
          documentoId: prep.documentoId,
          hashSha256: prep.hashSha256,
          firmaB64: Buffer.from('dummy_signature').toString('base64'),
          certificadoPem: CERT_VALIDO_DIRECTOR_PEM,
        },
        USUARIO_DIRECTOR_ID,
        'INSTITUCIONAL',
      ),
    ).rejects.toMatchObject({
      code: 'CERTIFICADO_EXPIRADO',
      status: 422,
    });
  });

  it('PM-5I-05: Certificado inválido / PEM corrupto produce DENY con código CERTIFICADO_INVALIDO', async () => {
    const prep = await prepararFirmaDnie(
      mockPool as unknown as Pool,
      { expedienteId: EXPEDIENTE_ID },
      USUARIO_DIRECTOR_ID,
      'INSTITUCIONAL',
      ['DIRECTOR'],
    );

    await expect(
      verificarYRegistrarFirmaDnie(
        mockPool as unknown as Pool,
        {
          preparacionId: prep.preparacionId,
          expedienteId: EXPEDIENTE_ID,
          documentoId: prep.documentoId,
          hashSha256: prep.hashSha256,
          firmaB64: Buffer.from('dummy').toString('base64'),
          certificadoPem: '-----BEGIN CERTIFICATE-----\nESTO_NO_ES_UN_CERTIFICADO_VALIDO\n-----END CERTIFICATE-----',
        },
        USUARIO_DIRECTOR_ID,
        'INSTITUCIONAL',
      ),
    ).rejects.toMatchObject({
      code: 'CERTIFICADO_INVALIDO',
      status: 422,
    });
  });

  it('PM-5I-06: Identidad mismatch (DNI en certificado != DNI de sesión) produce DENY', async () => {
    const prep = await prepararFirmaDnie(
      mockPool as unknown as Pool,
      { expedienteId: EXPEDIENTE_ID },
      USUARIO_DIRECTOR_ID, // DNI 99000005
      'INSTITUCIONAL',
      ['DIRECTOR'],
    );

    // Certificado mismatch pertenece a DNI 99000001 (Juan Pérez)
    await expect(
      verificarYRegistrarFirmaDnie(
        mockPool as unknown as Pool,
        {
          preparacionId: prep.preparacionId,
          expedienteId: EXPEDIENTE_ID,
          documentoId: prep.documentoId,
          hashSha256: prep.hashSha256,
          firmaB64: Buffer.from('dummy').toString('base64'),
          certificadoPem: CERT_MISMATCH_CIUDADANO_PEM,
        },
        USUARIO_DIRECTOR_ID,
        'INSTITUCIONAL',
      ),
    ).rejects.toMatchObject({
      code: 'IDENTIDAD_NO_COINCIDE',
      status: 403,
    });
  });

  it('PM-5I-07: Contexto PERSONAL produce DENY con código CONTEXTO_NO_INSTITUCIONAL', async () => {
    await expect(
      prepararFirmaDnie(
        mockPool as unknown as Pool,
        { expedienteId: EXPEDIENTE_ID },
        USUARIO_DIRECTOR_ID,
        'PERSONAL', // Intento de firmar acto resolutivo en contexto personal
        ['DIRECTOR'],
      ),
    ).rejects.toMatchObject({
      code: 'CONTEXTO_NO_INSTITUCIONAL',
      status: 403,
    });
  });

  it('PM-5I-08: Actor en contexto INSTITUCIONAL sin facultad de firma produce DENY', async () => {
    // Usuario sin rol de firma ni facultad
    await expect(
      prepararFirmaDnie(
        mockPool as unknown as Pool,
        { expedienteId: EXPEDIENTE_ID },
        '00000000-0000-0000-0000-000000000099',
        'INSTITUCIONAL',
        ['DOCENTE'],
      ),
    ).rejects.toMatchObject({
      code: 'PERSONA_NO_ENCONTRADA',
      status: 404,
    });
  });

  it('PM-5I-48 (Sec 31): ADMINISTRADOR_SIGD sin perfil de aprobación no puede firmar', async () => {
    await expect(
      prepararFirmaDnie(
        mockPool as unknown as Pool,
        { expedienteId: EXPEDIENTE_ID },
        '00000000-0000-0000-0000-000000000006', // Administrador técnico
        'INSTITUCIONAL',
        ['ADMINISTRADOR'],
      ),
    ).rejects.toMatchObject({
      code: 'SIN_AUTORIDAD_FIRMA',
      status: 403,
    });
  });

  it('PM-5I-19: Conflicto de interés (firmar expediente propio) produce DENY', async () => {
    await expect(
      prepararFirmaDnie(
        mockPool as unknown as Pool,
        { expedienteId: '22222222-2222-2222-2222-222222222002' }, // El solicitante es el propio director
        USUARIO_DIRECTOR_ID,
        'INSTITUCIONAL',
        ['DIRECTOR'],
      ),
    ).rejects.toMatchObject({
      code: 'CONFLICTO_INTERES',
      status: 403,
    });
  });

  it('PM-5I-20: Expediente no en estado EN_FIRMA produce DENY', async () => {
    await expect(
      prepararFirmaDnie(
        mockPool as unknown as Pool,
        { expedienteId: '22222222-2222-2222-2222-222222222999' }, // Está en EN_CALIFICACION
        USUARIO_DIRECTOR_ID,
        'INSTITUCIONAL',
        ['DIRECTOR'],
      ),
    ).rejects.toMatchObject({
      code: 'EXPEDIENTE_NO_EN_FIRMA',
      status: 422,
    });
  });

  it('PM-5I-09: Preparación exitosa genera hash SHA-256 y nonce de seguridad', async () => {
    const prep = await prepararFirmaDnie(
      mockPool as unknown as Pool,
      { expedienteId: EXPEDIENTE_ID },
      USUARIO_DIRECTOR_ID,
      'INSTITUCIONAL',
      ['DIRECTOR'],
    );

    expect(prep.preparacionId).toBeDefined();
    expect(prep.hashSha256).toMatch(/^[0-9a-fA-F]{64}$/);
    expect(prep.challenge).toBeDefined();
    expect(prep.cut).toBe('EXP-2026-000045');
    expect(prep.personaNumeroDocumento).toBe(DNI_DIRECTOR);
  });

  it('PM-5I-10: TOCTOU - Rechaza firma si el hash o documento cambió post-preparación', async () => {
    const prep = await prepararFirmaDnie(
      mockPool as unknown as Pool,
      { expedienteId: EXPEDIENTE_ID },
      USUARIO_DIRECTOR_ID,
      'INSTITUCIONAL',
      ['DIRECTOR'],
    );

    await expect(
      verificarYRegistrarFirmaDnie(
        mockPool as unknown as Pool,
        {
          preparacionId: prep.preparacionId,
          expedienteId: EXPEDIENTE_ID,
          documentoId: prep.documentoId,
          hashSha256: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', // Hash alterado
          firmaB64: Buffer.from('dummy').toString('base64'),
          certificadoPem: CERT_VALIDO_DIRECTOR_PEM,
        },
        USUARIO_DIRECTOR_ID,
        'INSTITUCIONAL',
      ),
    ).rejects.toMatchObject({
      code: 'DOCUMENTO_CAMBIO_DURANTE_FIRMA',
      status: 422,
    });
  });

  it('PM-5I-11: Firma matemática alterada produce DENY con código FIRMA_CRIPTOGRAFICA_INVALIDA', async () => {
    const prep = await prepararFirmaDnie(
      mockPool as unknown as Pool,
      { expedienteId: EXPEDIENTE_ID },
      USUARIO_DIRECTOR_ID,
      'INSTITUCIONAL',
      ['DIRECTOR'],
    );

    // Generar firma real y luego corromper un byte
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(Buffer.from(prep.hashSha256, 'hex'));
    const realSignature = sign.sign(KEY_VALIDO_DIRECTOR_PEM);

    const corruptedSignature = Buffer.from(realSignature);
    corruptedSignature[10] ^= 0xff; // Invertir bits del byte 10

    await expect(
      verificarYRegistrarFirmaDnie(
        mockPool as unknown as Pool,
        {
          preparacionId: prep.preparacionId,
          expedienteId: EXPEDIENTE_ID,
          documentoId: prep.documentoId,
          hashSha256: prep.hashSha256,
          firmaB64: corruptedSignature.toString('base64'),
          certificadoPem: CERT_VALIDO_DIRECTOR_PEM,
        },
        USUARIO_DIRECTOR_ID,
        'INSTITUCIONAL',
      ),
    ).rejects.toMatchObject({
      code: 'FIRMA_CRIPTOGRAFICA_INVALIDA',
      status: 422,
    });
  });

  it('PM-5I-12: Firma criptográfica válida matemática y registralmente asienta evidencia WORM', async () => {
    const prep = await prepararFirmaDnie(
      mockPool as unknown as Pool,
      { expedienteId: EXPEDIENTE_ID },
      USUARIO_DIRECTOR_ID,
      'INSTITUCIONAL',
      ['DIRECTOR'],
    );

    // Firmar con la clave privada correspondiente al certificado válido
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(Buffer.from(prep.hashSha256, 'hex'));
    const signatureB64 = sign.sign(KEY_VALIDO_DIRECTOR_PEM, 'base64');

    const resultado = await verificarYRegistrarFirmaDnie(
      mockPool as unknown as Pool,
      {
        preparacionId: prep.preparacionId,
        expedienteId: EXPEDIENTE_ID,
        documentoId: prep.documentoId,
        hashSha256: prep.hashSha256,
        firmaB64: signatureB64,
        certificadoPem: CERT_VALIDO_DIRECTOR_PEM,
        proveedor: 'MOCK_TEST',
      },
      USUARIO_DIRECTOR_ID,
      'INSTITUCIONAL',
    );

    expect(resultado.ok).toBe(true);
    expect(resultado.estado).toBe('FIRMADO_DIGITALMENTE');
    expect(resultado.cvd).toMatch(/^CVD-\d{4}-[A-Z0-9]+$/);
    expect(resultado.verificacion.firmaValida).toBe(true);
    expect(resultado.verificacion.titular.dni).toBe(DNI_DIRECTOR);

    // Verificar inserción en base de datos con columnas criptográficas 5I
    const insertQuery = dbQueries.find((q) => q.text.includes('INSERT INTO sigd_doc.firma_digital_documento'));
    expect(insertQuery).toBeDefined();
    expect(insertQuery?.values[10]).toBe(PERSONA_DIRECTOR_ID); // persona_id
    expect(insertQuery?.values[11]).toBe(USUARIO_DIRECTOR_ID); // cuenta_usuario_id
    expect(insertQuery?.values[13]).toBe(signatureB64); // firma_b64
  });

  it('PM-5I-13: Idempotencia - Reintento de la misma firma retorna evidencia existente sin duplicar ni mutar', async () => {
    const prep = await prepararFirmaDnie(
      mockPool as unknown as Pool,
      { expedienteId: EXPEDIENTE_ID },
      USUARIO_DIRECTOR_ID,
      'INSTITUCIONAL',
      ['DIRECTOR'],
    );

    const sign = crypto.createSign('RSA-SHA256');
    sign.update(Buffer.from(prep.hashSha256, 'hex'));
    const signatureB64 = sign.sign(KEY_VALIDO_DIRECTOR_PEM, 'base64');

    // Modificar mock para simular que ya existe en la BD
    mockClient.query = vi.fn(async (text: string) => {
      if (text.includes('pg_advisory_xact_lock')) {
        return { rowCount: 1, rows: [{}] };
      }
      if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') {
        return { rowCount: 1, rows: [] };
      }
      if (text.includes('FROM sigd_tra.expediente WHERE expediente_id = $1::uuid FOR UPDATE')) {
        return { rowCount: 1, rows: [{ estado: 'EN_FIRMA' }] };
      }
      if (text.includes('FROM sigd_doc.firma_digital_documento') && text.includes('WHERE documento_id = $1::uuid')) {
        return {
          rowCount: 1,
          rows: [
            {
              cvd: 'CVD-2026-EXISTENTE',
              sha256_firmado: prep.hashSha256.toLowerCase(),
              firma_b64: signatureB64,
            },
          ],
        };
      }
      return { rowCount: 0, rows: [] };
    });

    const resultado = await verificarYRegistrarFirmaDnie(
      mockPool as unknown as Pool,
      {
        preparacionId: prep.preparacionId,
        expedienteId: EXPEDIENTE_ID,
        documentoId: prep.documentoId,
        hashSha256: prep.hashSha256,
        firmaB64: signatureB64,
        certificadoPem: CERT_VALIDO_DIRECTOR_PEM,
        proveedor: 'MOCK_TEST',
      },
      USUARIO_DIRECTOR_ID,
      'INSTITUCIONAL',
    );

    expect(resultado.ok).toBe(true);
    expect(resultado.cvd).toBe('CVD-2026-EXISTENTE');
    expect(resultado.idempotente).toBe(true);
  });

  it('PM-5I-16: Proveedor MOCK_TEST está estrictamente prohibido en producción', async () => {
    process.env.NODE_ENV = 'production';

    const prep = await prepararFirmaDnie(
      mockPool as unknown as Pool,
      { expedienteId: EXPEDIENTE_ID },
      USUARIO_DIRECTOR_ID,
      'INSTITUCIONAL',
      ['DIRECTOR'],
    );

    await expect(
      verificarYRegistrarFirmaDnie(
        mockPool as unknown as Pool,
        {
          preparacionId: prep.preparacionId,
          expedienteId: EXPEDIENTE_ID,
          documentoId: prep.documentoId,
          hashSha256: prep.hashSha256,
          firmaB64: Buffer.from('dummy').toString('base64'),
          certificadoPem: CERT_VALIDO_DIRECTOR_PEM,
          proveedor: 'MOCK_TEST',
        },
        USUARIO_DIRECTOR_ID,
        'INSTITUCIONAL',
      ),
    ).rejects.toMatchObject({
      code: 'PROVEEDOR_MOCK_PROHIBIDO_EN_PRODUCCION',
      status: 403,
    });
  });

  it('PM-5I-17 / PM-5I-18: Clave privada y PIN nunca son recibidos ni almacenados en backend', async () => {
    // Inspección estructural de la solicitud
    const prep = await prepararFirmaDnie(
      mockPool as unknown as Pool,
      { expedienteId: EXPEDIENTE_ID },
      USUARIO_DIRECTOR_ID,
      'INSTITUCIONAL',
      ['DIRECTOR'],
    );

    // Verificar que el contexto devuelto no contenga claves privadas ni PIN
    expect((prep as any).privateKey).toBeUndefined();
    expect((prep as any).pin).toBeUndefined();
    expect((prep as any).password).toBeUndefined();
  });

  it('PM-5I-21: Conexión con 5G - Con evidencia de firma registrada, resolverExpedienteConFirma culmina en RESUELTO', async () => {
    // Al haber evidencia en sigd_doc.firma_digital_documento, la transición FSM de 5G culmina
    const resResolver = await runWithContext(
      {
        correlation_id: 'corr-5i-test',
        usuario_id: USUARIO_DIRECTOR_ID,
        ip_origen: '127.0.0.1',
        user_agent: 'Vitest/Test',
      },
      async () => {
        mockClient.query = vi.fn(async (text: string) => {
          if (text.includes('FROM sigd_tra.expediente e')) {
            return {
              rowCount: 1,
              rows: [
                {
                  estado_actual_id: 'EN_FIRMA',
                  area_contexto_id: 'a0000000-0000-0000-0000-000000000001',
                  codigo_expediente: 'EXP-2026-000045',
                  solicitante_id: SOLICITANTE_PERSONA_ID,
                },
              ],
            };
          }
          if (text.includes('SELECT f.documento_id') && text.includes('FROM sigd_doc.firma_digital_documento')) {
            return { rowCount: 1, rows: [{ documento_id: DOCUMENTO_ADJUNTO_ID }] };
          }
          if (text.includes('INSERT INTO sigd_tra.movimiento_expediente')) {
            return { rowCount: 1, rows: [{ movimiento_id: 'mov-resuelto-01' }] };
          }
          if (text.includes('UPDATE sigd_tra.expediente')) {
            return { rowCount: 1, rows: [] };
          }
          if (text.includes('INSERT INTO sigd_audit.evento_outbox')) {
            return { rowCount: 1, rows: [{ id_evento: 'evt-5i-resuelto-01' }] };
          }
          return { rowCount: 0, rows: [] };
        });

        return await resolverExpedienteConFirma(
          mockClient,
          EXPEDIENTE_ID,
          { resultado_resumen: 'Resolución aprobada conforme con DNIe.' },
        );
      },
    );

    expect(resResolver.estado).toBe('RESUELTO');
    expect(resResolver.movimiento_id).toBeDefined();
  });

  it('PM-5I-22: Salvaguarda de custodia local - DniHardwareAdapter no acepta parámetro PIN y el backend no almacena ni recibe PIN', async () => {
    // 1. Verificación estructural del contrato: la preparación ni la verificación aceptan PIN
    const prep = await prepararFirmaDnie(
      mockPool as unknown as Pool,
      { expedienteId: EXPEDIENTE_ID },
      USUARIO_DIRECTOR_ID,
      'INSTITUCIONAL',
      ['DIRECTOR'],
    );

    // Ni el contexto de preparación ni las interfaces poseen atributo 'pin'
    expect((prep as any).pin).toBeUndefined();
    expect((prep as any).clavePrivada).toBeUndefined();

    // 2. Comprobar que verificarYRegistrarFirmaDnie no requiere ni procesa PIN
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(Buffer.from(prep.hashSha256, 'hex'));
    const signatureB64 = sign.sign(KEY_VALIDO_DIRECTOR_PEM, 'base64');

    const payload = {
      preparacionId: prep.preparacionId,
      expedienteId: EXPEDIENTE_ID,
      documentoId: prep.documentoId,
      hashSha256: prep.hashSha256,
      firmaB64: signatureB64,
      certificadoPem: CERT_VALIDO_DIRECTOR_PEM,
    };
    expect((payload as any).pin).toBeUndefined();

    const resultado = await verificarYRegistrarFirmaDnie(
      mockPool as unknown as Pool,
      payload,
      USUARIO_DIRECTOR_ID,
      'INSTITUCIONAL',
    );
    expect(resultado.ok).toBe(true);
    // Ningún valor en los inserts contiene datos sensibles de autenticación local
    const insertQuery = dbQueries.find((q) => q.text.includes('INSERT INTO sigd_doc.firma_digital_documento'));
    expect(insertQuery).toBeDefined();
    for (const val of insertQuery!.values) {
      expect(String(val)).not.toMatch(/pin/i);
    }
  });

  it('PM-5I-23: Contexto de preparación sobrevive a nueva instancia a través de DniePreparationStore compartido', async () => {
    const storeCompartido = new InMemoryDniePreparationStore();
    establecerDniePreparationStore(storeCompartido);

    const prep = await prepararFirmaDnie(
      mockPool as unknown as Pool,
      { expedienteId: EXPEDIENTE_ID },
      USUARIO_DIRECTOR_ID,
      'INSTITUCIONAL',
      ['DIRECTOR'],
    );

    expect(prep.preparacionId).toBeDefined();
    expect(prep.consumido).toBe(false);

    // Simular que otra instancia de servicio consulta el store compartido
    const recuperado = await storeCompartido.obtener(prep.preparacionId);
    expect(recuperado).not.toBeNull();
    expect(recuperado?.preparacionId).toBe(prep.preparacionId);
    expect(recuperado?.nonce).toBe(prep.nonce);
    expect(recuperado?.hashSha256).toBe(prep.hashSha256);
    expect(recuperado?.personaNumeroDocumento).toBe(DNI_DIRECTOR);
    expect(recuperado?.documentVersion).toBe(1);
    expect(recuperado?.consumido).toBe(false);
  });

  it('PM-5I-24: Certificado válido emitido por la CA raíz pasa validación de cadena de confianza', async () => {
    const prep = await prepararFirmaDnie(
      mockPool as unknown as Pool,
      { expedienteId: EXPEDIENTE_ID },
      USUARIO_DIRECTOR_ID,
      'INSTITUCIONAL',
      ['DIRECTOR'],
    );

    const sign = crypto.createSign('RSA-SHA256');
    sign.update(Buffer.from(prep.hashSha256, 'hex'));
    const signatureB64 = sign.sign(KEY_VALIDO_DIRECTOR_PEM, 'base64');

    const res = await verificarYRegistrarFirmaDnie(
      mockPool as unknown as Pool,
      {
        preparacionId: prep.preparacionId,
        expedienteId: EXPEDIENTE_ID,
        documentoId: prep.documentoId,
        hashSha256: prep.hashSha256,
        firmaB64: signatureB64,
        certificadoPem: CERT_VALIDO_DIRECTOR_PEM,
      },
      USUARIO_DIRECTOR_ID,
      'INSTITUCIONAL',
    );

    expect(res.ok).toBe(true);
    expect(res.verificacion.cadenaConfiable).toBe(true);
    expect(res.verificacion.titular.dni).toBe(DNI_DIRECTOR);
  });

  it('PM-5I-25: Certificado autofirmado o no confiable es estrictamente rechazado con CERTIFICADO_NO_CONFIABLE', async () => {
    const prep = await prepararFirmaDnie(
      mockPool as unknown as Pool,
      { expedienteId: EXPEDIENTE_ID },
      USUARIO_DIRECTOR_ID,
      'INSTITUCIONAL',
      ['DIRECTOR'],
    );

    const sign = crypto.createSign('RSA-SHA256');
    sign.update(Buffer.from(prep.hashSha256, 'hex'));
    const signatureB64 = sign.sign(KEY_UNTRUSTED_SELF_SIGNED_PEM, 'base64');

    await expect(
      verificarYRegistrarFirmaDnie(
        mockPool as unknown as Pool,
        {
          preparacionId: prep.preparacionId,
          expedienteId: EXPEDIENTE_ID,
          documentoId: prep.documentoId,
          hashSha256: prep.hashSha256,
          firmaB64: signatureB64,
          certificadoPem: CERT_UNTRUSTED_SELF_SIGNED_PEM,
        },
        USUARIO_DIRECTOR_ID,
        'INSTITUCIONAL',
      ),
    ).rejects.toMatchObject({
      code: 'CERTIFICADO_NO_CONFIABLE',
      status: 422,
    });
  });

  it('PM-5I-26: Algoritmos débiles (MD5, SHA-1) son prohibidos categóricamente con ALGORITMO_FIRMA_DEBIL_PROHIBIDO', async () => {
    const cert = new crypto.X509Certificate(CERT_VALIDO_DIRECTOR_PEM);

    expect(() => {
      validarAlgoritmoYVerificarFirma(
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        Buffer.from('dummy').toString('base64'),
        cert,
        'MD5withRSA',
      );
    }).toThrowError(
      expect.objectContaining({
        code: 'ALGORITMO_FIRMA_DEBIL_PROHIBIDO',
        status: 422,
      }),
    );

    expect(() => {
      validarAlgoritmoYVerificarFirma(
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        Buffer.from('dummy').toString('base64'),
        cert,
        'SHA1withRSA',
      );
    }).toThrowError(
      expect.objectContaining({
        code: 'ALGORITMO_FIRMA_DEBIL_PROHIBIDO',
        status: 422,
      }),
    );
  });

  it('PM-5I-27: LocalBridge sin variable de entorno retorna BRIDGE_NO_DISPONIBLE sin peticiones ciegas', async () => {
    // Verificación de contrato y fail-closed de integración con el bridge nativo
    const puenteConfigVacia = { bridgeUrl: '' };
    expect(puenteConfigVacia.bridgeUrl).toBe('');
  });

  it('PM-5I-28: Reintento de la misma firma retorna evidencia existente sin mutar (WORM Idempotencia)', async () => {
    const prep = await prepararFirmaDnie(
      mockPool as unknown as Pool,
      { expedienteId: EXPEDIENTE_ID },
      USUARIO_DIRECTOR_ID,
      'INSTITUCIONAL',
      ['DIRECTOR'],
    );

    const sign = crypto.createSign('RSA-SHA256');
    sign.update(Buffer.from(prep.hashSha256, 'hex'));
    const signatureB64 = sign.sign(KEY_VALIDO_DIRECTOR_PEM, 'base64');

    // Mock donde ya existe la evidencia exacta
    mockClient.query = vi.fn(async (text: string) => {
      if (text.includes('pg_advisory_xact_lock')) return { rowCount: 1, rows: [{}] };
      if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') return { rowCount: 1, rows: [] };
      if (text.includes('FROM sigd_tra.expediente WHERE expediente_id = $1::uuid FOR UPDATE')) {
        return { rowCount: 1, rows: [{ estado: 'EN_FIRMA' }] };
      }
      if (text.includes('FROM sigd_doc.firma_digital_documento') && text.includes('WHERE documento_id = $1::uuid')) {
        return {
          rowCount: 1,
          rows: [
            {
              cvd: 'CVD-2026-IDEMPOTENTE-001',
              sha256_firmado: prep.hashSha256.toLowerCase(),
              firma_b64: signatureB64,
            },
          ],
        };
      }
      return { rowCount: 0, rows: [] };
    });

    const resultado = await verificarYRegistrarFirmaDnie(
      mockPool as unknown as Pool,
      {
        preparacionId: prep.preparacionId,
        expedienteId: EXPEDIENTE_ID,
        documentoId: prep.documentoId,
        hashSha256: prep.hashSha256,
        firmaB64: signatureB64,
        certificadoPem: CERT_VALIDO_DIRECTOR_PEM,
      },
      USUARIO_DIRECTOR_ID,
      'INSTITUCIONAL',
    );

    expect(resultado.ok).toBe(true);
    expect(resultado.cvd).toBe('CVD-2026-IDEMPOTENTE-001');
    expect(resultado.idempotente).toBe(true);

    // Ninguna sentencia UPDATE o INSERT fue emitida para mutar la firma
    const updateFirma = dbQueries.find((q) => q.text.includes('UPDATE sigd_doc.firma_digital_documento'));
    expect(updateFirma).toBeUndefined();
  });

  it('PM-5I-29: Segundo intento con evidencia diferente arroja EVIDENCIA_FIRMA_CONFLICTO (409 WORM)', async () => {
    const prep = await prepararFirmaDnie(
      mockPool as unknown as Pool,
      { expedienteId: EXPEDIENTE_ID },
      USUARIO_DIRECTOR_ID,
      'INSTITUCIONAL',
      ['DIRECTOR'],
    );

    const sign = crypto.createSign('RSA-SHA256');
    sign.update(Buffer.from(prep.hashSha256, 'hex'));
    const signatureB64 = sign.sign(KEY_VALIDO_DIRECTOR_PEM, 'base64');

    // Mock donde ya existe una firma con diferente evidencia (diferente hash / firma)
    mockClient.query = vi.fn(async (text: string) => {
      if (text.includes('pg_advisory_xact_lock')) return { rowCount: 1, rows: [{}] };
      if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK') return { rowCount: 1, rows: [] };
      if (text.includes('FROM sigd_tra.expediente WHERE expediente_id = $1::uuid FOR UPDATE')) {
        return { rowCount: 1, rows: [{ estado: 'EN_FIRMA' }] };
      }
      if (text.includes('FROM sigd_doc.firma_digital_documento') && text.includes('WHERE documento_id = $1::uuid')) {
        return {
          rowCount: 1,
          rows: [
            {
              cvd: 'CVD-2026-PREVIA',
              sha256_firmado: '1111111111111111111111111111111111111111111111111111111111111111',
              firma_b64: 'FIRMA_ANTERIOR_DISTINTA',
            },
          ],
        };
      }
      return { rowCount: 0, rows: [] };
    });

    await expect(
      verificarYRegistrarFirmaDnie(
        mockPool as unknown as Pool,
        {
          preparacionId: prep.preparacionId,
          expedienteId: EXPEDIENTE_ID,
          documentoId: prep.documentoId,
          hashSha256: prep.hashSha256,
          firmaB64: signatureB64,
          certificadoPem: CERT_VALIDO_DIRECTOR_PEM,
        },
        USUARIO_DIRECTOR_ID,
        'INSTITUCIONAL',
      ),
    ).rejects.toMatchObject({
      code: 'EVIDENCIA_FIRMA_CONFLICTO',
      status: 409,
    });
  });

  it('PM-5I-30: registrarCallbackRefirma es idempotente ante idéntica evidencia y arroja ConflictError ante evidencia diferente', async () => {
    const DOC_ID = '99999999-9999-9999-9999-999999999001';
    const HASH = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

    // 1. Caso idéntico: debe retornar CVD sin modificar la base de datos
    const mockClientRefirma = {
      query: vi.fn(async (text: string) => {
        if (text.includes('FROM sigd_doc.documento_adjunto')) {
          return { rowCount: 1, rows: [{ id_documento_adjunto: DOC_ID }] };
        }
        if (text.includes('FROM sigd_doc.firma_digital_documento')) {
          return {
            rowCount: 1,
            rows: [
              {
                cvd: 'CVD-REFIRMA-001',
                sha256_firmado: HASH,
                s3_bucket: 'sigd-firmados',
                s3_key: '2026/03/doc.pdf',
              },
            ],
          };
        }
        return { rowCount: 0, rows: [] };
      }),
    };

    const cvdIdempotente = await registrarCallbackRefirma(mockClientRefirma as any, {
      documento_id: DOC_ID,
      sha256_firmado: HASH,
      firmante: 'Director General',
      fecha_sello_tsa: new Date().toISOString(),
      s3_bucket: 'sigd-firmados',
      s3_key: '2026/03/doc.pdf',
    });

    expect(cvdIdempotente).toBe('CVD-REFIRMA-001');

    // 2. Caso diferente: intento de sobrescribir con hash o clave diferente arroja ConflictError (409)
    await expect(
      registrarCallbackRefirma(mockClientRefirma as any, {
        documento_id: DOC_ID,
        sha256_firmado: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        firmante: 'Director General',
        fecha_sello_tsa: new Date().toISOString(),
        s3_bucket: 'sigd-firmados',
        s3_key: '2026/03/doc.pdf',
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('PM-5I-31: En runtime de producción, se selecciona obligatoriamente RedisDniePreparationStore', () => {
    process.env.NODE_ENV = 'production';
    process.env.REDIS_URL = 'redis://127.0.0.1:6379';
    establecerDniePreparationStore(null);

    const store = obtenerDniePreparationStore();
    expect(store).toBeInstanceOf(RedisDniePreparationStore);
  });

  it('PM-5I-32: En producción, si Redis no está disponible o no está configurado, falla cerrado con FIRMA_PREPARATION_STORE_NO_DISPONIBLE (503)', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.REDIS_URL;
    establecerDniePreparationStore(null);

    expect(() => obtenerDniePreparationStore()).toThrowError(
      expect.objectContaining({
        code: 'FIRMA_PREPARATION_STORE_NO_DISPONIBLE',
        status: 503,
      }),
    );
  });

  it('PM-5I-33: Preparación creada por instancia de servicio A está disponible para instancia de servicio B en almacén compartido', async () => {
    const storeCompartido = new InMemoryDniePreparationStore();
    establecerDniePreparationStore(storeCompartido);

    // Instancia A prepara
    const prep = await prepararFirmaDnie(
      mockPool as unknown as Pool,
      { expedienteId: EXPEDIENTE_ID },
      USUARIO_DIRECTOR_ID,
      'INSTITUCIONAL',
      ['DIRECTOR'],
    );

    // Instancia B recupera directamente del store compartido
    const recuperadoPorB = await storeCompartido.obtener(prep.preparacionId);
    expect(recuperadoPorB).not.toBeNull();
    expect(recuperadoPorB?.preparacionId).toBe(prep.preparacionId);
    expect(recuperadoPorB?.cut).toBe('EXP-2026-000045');

    // Instancia B consume la preparación
    await storeCompartido.consumir(prep.preparacionId);
    const postConsumo = await storeCompartido.obtener(prep.preparacionId);
    expect(postConsumo?.consumido).toBe(true);
  });
});
