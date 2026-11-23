import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { CATALOGO_DOCUMENTAL_POR_CODIGO } from '../../../../src/domains/tramicore/catalogoDocumentalTupa2026.js';
import {
  proyectarCertificadoIngles,
  registrarVerificacionAcademicaIngles,
} from '../../../../src/domains/docucore/certificadoIngles.service.js';
import { registrarCallbackRefirma } from '../../../../src/domains/docucore/callbackRefirma.service.js';

vi.mock('../../../../src/domains/docucore/verificadorPades.service.js', () => ({
  validarFirmaPades: vi.fn(async () => ({
    valido: true,
    validacionCriptografica: true,
    integridadBytesProtegidos: true,
    tipoFirma: 'FIRMA_PADES_VALIDA',
    detalles: { tieneFirmaCms: true },
  })),
  obtenerPoliticaValidacionPades: vi.fn(() => ({ exigirTsa: false, exigirRevocacion: false })),
}));

const EXP_ID = '11111111-1111-4111-8111-111111111111';
const SOLICITANTE_ID = '00000000-0000-0000-0000-000000000050';
const SEC_AREA_ID = '2b147b0d-7c8f-434f-b75a-598a1ccb855b';
const USUARIO_SEC_ID = '00000000-0000-0000-0000-000000000030';
const USUARIO_DG_ID = '00000000-0000-0000-0000-000000000020';
const REGISTRO_APTO_ID = 'a3400001-0000-4000-8000-000000000050';
const REGISTRO_INCOMPLETO_ID = 'a3400002-0000-4000-8000-000000000051';

describe('SUZ26-006 — Certificado de Inglés (Opción A: estudios culminados y aprobados en IESTP Suiza)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('S3_ENDPOINT', 'http://127.0.0.1:9000');
    vi.stubEnv('S3_ACCESS_KEY', 'minioadmin');
    vi.stubEnv('S3_SECRET_KEY', 'minioadmin');
    vi.stubEnv('S3_BUCKET', 'sigd-sandbox-e2e');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('1. Configura SUZ26-006 como VALIDADO con ruta MP -> SEC -> DG y sin exigir constancias académicas externas al ciudadano', () => {
    const proc = CATALOGO_DOCUMENTAL_POR_CODIGO.get('SUZ26-006');
    expect(proc).toBeDefined();
    expect(proc?.estadoValidacion).toBe('VALIDADO');
    expect(proc?.costoFuente).toBe('S/ 100.00');
    expect(proc?.unidadRecepcion).toBe('Mesa de Partes (MP)');
    expect(proc?.unidadResponsable).toBe('Secretaría Académica (SEC)');
    expect(proc?.autoridadResolutiva).toBe('Dirección General (DG)');
    expect(proc?.plazoDias).toBe(5);
    expect(proc?.silencioAdministrativo).toBe('POSITIVO');
    expect(proc?.requisitos).toHaveLength(1);
    expect(proc?.requisitos[0].codigo).toBe('FUT');
    expect(proc?.anexos).toHaveLength(0);
  });

  it('2. Bloquea verificación académica FAVORABLE cuando el rol no corresponde a Secretaría Académica', async () => {
    const cliente = { query: vi.fn() } as unknown as PoolClient;
    await expect(
      registrarVerificacionAcademicaIngles(cliente, EXP_ID, USUARIO_DG_ID, ['DIRECTOR'], {
        registroEstudioId: REGISTRO_APTO_ID,
        resultado: 'FAVORABLE',
        observacionesAcademicas: 'Intento de verificación por rol no autorizado.',
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('3. Bloquea verificación académica FAVORABLE si el pago en Tesorería aún está pendiente', async () => {
    const query = vi.fn().mockImplementation(async (sql: string) => {
      if (sql.includes('FOR UPDATE OF e')) {
        return {
          rowCount: 1,
          rows: [{
            expediente_id: EXP_ID,
            cut: 'EXP-2026-009001',
            estado_actual: 'EN_REVISION',
            area_actual_id: SEC_AREA_ID,
            area_actual_codigo: 'SEC',
            solicitante_id: SOLICITANTE_ID,
            solicitante_dni: '00000050',
            codigo_tramite: 'SUZ26-006',
          }],
        };
      }
      if (sql.includes('FROM sigd_org.usuario_rol')) return { rowCount: 1, rows: [{ autorizado: true }] };
      if (sql.includes('FROM sigd_tes.aplicacion_pago')) {
        return {
          rowCount: 1,
          rows: [{
            orden_id: randomUUID(),
            orden_codigo: 'OP-PEND-1',
            importe: '100.00',
            moneda: 'PEN',
            pago_estado: null,
            numero_recibo: null,
            verificado_en: null,
            devolucion_activa: false,
          }],
        };
      }
      if (sql.includes('FROM sigd_doc.registro_estudios_ingles')) {
        return {
          rowCount: 1,
          rows: [{
            registro_estudio_id: REGISTRO_APTO_ID,
            tipo_documento_identidad: 'DNI',
            numero_documento_identidad: '00000050',
            persona_id: SOLICITANTE_ID,
            apellidos_nombres: 'Sr. Ciudadano Administrado Demo',
            codigo_matricula: 'EST-IDI-2024-0050',
            programa_estudios: 'Centro de Idiomas IESTP Suiza',
            modalidad_estudio: 'ESTUDIOS_INGLES_IESTP_SUIZA',
            nivel_alcanzado: 'Inglés Básico I-III e Intermedio I-III',
            ciclos_modulos_aprobados: [{ modulo: 'Inglés Básico I', periodo: '2024-I', horas: 60, nota: 17, estado: 'APROBADO' }],
            horas_academicas_totales: 360,
            creditos_totales: '18.00',
            promedio_final: '17.50',
            nota_minima_aprobatoria: '13.00',
            fecha_inicio: '2024-03-18',
            fecha_termino: '2025-07-25',
            culminado: true,
            aprobado: true,
            numero_acta_final: 'ACT-IDI-IESTPS-2025-0142',
            estado_academico: 'CULMINADO_APROBADO',
            observaciones: null,
          }],
        };
      }
      return { rowCount: 0, rows: [] };
    });

    const cliente = { query } as unknown as PoolClient;
    await expect(
      registrarVerificacionAcademicaIngles(cliente, EXP_ID, USUARIO_SEC_ID, ['SECRETARIO'], {
        registroEstudioId: REGISTRO_APTO_ID,
        resultado: 'FAVORABLE',
        observacionesAcademicas: 'Verificación de prueba sin pago verificado.',
      }),
    ).rejects.toMatchObject({ status: 409, code: 'PAGO_TESORERIA_REQUERIDO' });
  });

  it('4. Rechaza dictamen FAVORABLE cuando el antecedente académico está INCOMPLETO en Opción A', async () => {
    const query = vi.fn().mockImplementation(async (sql: string) => {
      if (sql.includes('FOR UPDATE OF e')) {
        return {
          rowCount: 1,
          rows: [{
            expediente_id: EXP_ID,
            cut: 'EXP-2026-009002',
            estado_actual: 'EN_REVISION',
            area_actual_id: SEC_AREA_ID,
            area_actual_codigo: 'SEC',
            solicitante_id: SOLICITANTE_ID,
            solicitante_dni: '00000050',
            codigo_tramite: 'SUZ26-006',
          }],
        };
      }
      if (sql.includes('FROM sigd_org.usuario_rol')) return { rowCount: 1, rows: [{ autorizado: true }] };
      if (sql.includes('FROM sigd_tes.aplicacion_pago')) {
        return {
          rowCount: 1,
          rows: [{
            orden_id: randomUUID(),
            orden_codigo: 'OP-OK-1',
            importe: '100.00',
            moneda: 'PEN',
            pago_estado: 'VERIFICADO',
            numero_recibo: '1001',
            verificado_en: new Date().toISOString(),
            devolucion_activa: false,
          }],
        };
      }
      if (sql.includes('FROM sigd_doc.registro_estudios_ingles')) {
        return {
          rowCount: 1,
          rows: [{
            registro_estudio_id: REGISTRO_INCOMPLETO_ID,
            tipo_documento_identidad: 'DNI',
            numero_documento_identidad: '00000050',
            persona_id: SOLICITANTE_ID,
            apellidos_nombres: 'Sr. Ciudadano Administrado Demo',
            codigo_matricula: 'EST-2',
            programa_estudios: 'Centro de Idiomas IESTP Suiza',
            modalidad_estudio: 'ESTUDIOS_INGLES_IESTP_SUIZA',
            nivel_alcanzado: 'Inglés Básico II',
            ciclos_modulos_aprobados: [{ modulo: 'Inglés Básico I', periodo: '2025-I', horas: 60, nota: 15, estado: 'APROBADO' }],
            horas_academicas_totales: 120,
            creditos_totales: '6.00',
            promedio_final: '15.00',
            nota_minima_aprobatoria: '13.00',
            fecha_inicio: '2025-04-01',
            fecha_termino: null,
            culminado: false,
            aprobado: false,
            numero_acta_final: 'ACT-INC-1',
            estado_academico: 'INCOMPLETO',
            observaciones: null,
          }],
        };
      }
      if (sql.includes('FROM sigd_rut.expediente_observacion')) return { rowCount: 1, rows: [{ total: '0' }] };
      if (sql.includes('FROM sigd_doc.expediente doc_exp')) return { rowCount: 1, rows: [{ faltantes: '0' }] };
      return { rowCount: 0, rows: [] };
    });

    const cliente = { query } as unknown as PoolClient;
    await expect(
      registrarVerificacionAcademicaIngles(cliente, EXP_ID, USUARIO_SEC_ID, ['SECRETARIO'], {
        registroEstudioId: REGISTRO_INCOMPLETO_ID,
        resultado: 'FAVORABLE',
        observacionesAcademicas: 'Intento de aprobar estudios incompletos.',
      }),
    ).rejects.toMatchObject({ status: 409, code: 'ANTECEDENTE_ACADEMICO_NO_APTO' });
  });

  it('5. Proyecta Certificado de Inglés PDF A4 y registra firma PAdES emitiendo evento certificado_emitido', async () => {
    let uploadedBytes: Buffer | null = null;
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'PUT' && init.body) {
        uploadedBytes = Buffer.from(init.body as Uint8Array);
        return new Response(null, { status: 200 });
      }
      return new Response(uploadedBytes ?? Buffer.from('%PDF-1.4\n%%EOF'));
    }));

    const verifId = randomUUID();
    const certId = randomUUID();
    const adjId = randomUUID();

    const queryProj = vi.fn().mockImplementation(async (sql: string) => {
      if (sql.includes('FOR UPDATE OF e')) {
        return {
          rowCount: 1,
          rows: [{
            expediente_id: EXP_ID,
            cut: 'EXP-2026-009003',
            estado_actual: 'EN_REVISION',
            area_actual_id: SEC_AREA_ID,
            area_actual_codigo: 'SEC',
            solicitante_id: SOLICITANTE_ID,
            solicitante_dni: '00000050',
            codigo_tramite: 'SUZ26-006',
          }],
        };
      }
      if (sql.includes('FROM sigd_org.usuario_rol')) return { rowCount: 1, rows: [{ autorizado: true }] };
      if (sql.includes('FROM sigd_tra.expediente e')) {
        return {
          rowCount: 1,
          rows: [{
            expediente_id: EXP_ID,
            cut: 'EXP-2026-009003',
            estado_actual: 'EN_REVISION',
            area_actual_id: SEC_AREA_ID,
            area_actual_codigo: 'SEC',
            solicitante_id: SOLICITANTE_ID,
            solicitante_nombre: 'Sr. Ciudadano Administrado Demo',
            solicitante_dni: '00000050',
            codigo_tramite: 'SUZ26-006',
            denominacion_tramite: 'Certificado de Inglés',
          }],
        };
      }
      if (sql.includes('FROM sigd_tes.aplicacion_pago')) {
        return {
          rowCount: 1,
          rows: [{
            orden_id: randomUUID(),
            orden_codigo: 'OP-OK-9003',
            importe: '100.00',
            moneda: 'PEN',
            pago_estado: 'VERIFICADO',
            numero_recibo: '9003',
            verificado_en: new Date().toISOString(),
            devolucion_activa: false,
          }],
        };
      }
      if (sql.includes('AS faltantes')) return { rowCount: 1, rows: [{ faltantes: '0', obs_pendientes: '0' }] };
      if (sql.includes('FROM sigd_doc.registro_estudios_ingles')) {
        return {
          rowCount: 1,
          rows: [{
            registro_estudio_id: REGISTRO_APTO_ID,
            tipo_documento_identidad: 'DNI',
            numero_documento_identidad: '00000050',
            persona_id: SOLICITANTE_ID,
            apellidos_nombres: 'Sr. Ciudadano Administrado Demo',
            codigo_matricula: 'EST-IDI-2024-0050',
            programa_estudios: 'Centro de Idiomas IESTP Suiza',
            modalidad_estudio: 'ESTUDIOS_INGLES_IESTP_SUIZA',
            nivel_alcanzado: 'Inglés Básico I-III e Intermedio I-III',
            ciclos_modulos_aprobados: [{ modulo: 'Inglés Básico I', periodo: '2024-I', horas: 60, nota: 17, estado: 'APROBADO' }],
            horas_academicas_totales: 360,
            creditos_totales: '18.00',
            promedio_final: '17.50',
            nota_minima_aprobatoria: '13.00',
            fecha_inicio: '2024-03-18',
            fecha_termino: '2025-07-25',
            culminado: true,
            aprobado: true,
            numero_acta_final: 'ACT-IDI-IESTPS-2025-0142',
            estado_academico: 'CULMINADO_APROBADO',
            observaciones: null,
          }],
        };
      }
      if (sql.includes('FROM sigd_doc.verificacion_academica_ingles')) {
        return {
          rowCount: 1,
          rows: [{
            verificacion_id: verifId,
            expediente_id: EXP_ID,
            registro_estudio_id: REGISTRO_APTO_ID,
            dni_verificado: '00000050',
            culminado_verificado: true,
            aprobado_verificado: true,
            pago_tesoreria_verificado: true,
            numero_recibo_tesoreria: '9003',
            numero_acta_referencia: 'ACT-IDI-IESTPS-2025-0142',
            nivel_acreditado: 'Inglés Básico I-III e Intermedio I-III',
            horas_academicas: 360,
            promedio_final: '17.50',
            detalle_modulos_verificados: [],
            resultado: 'FAVORABLE',
            observaciones_academicas: 'Estudios verificados y aprobados.',
            verificado_por: USUARIO_SEC_ID,
            verificador_nombre: 'Lic. Operador Académico Demo',
            verificado_en: new Date().toISOString(),
          }],
        };
      }
      if (sql.includes('FROM sigd_doc.certificado_ingles c')) {
        return {
          rowCount: uploadedBytes ? 1 : 0,
          rows: uploadedBytes
            ? [{
                certificado_id: certId,
                expediente_id: EXP_ID,
                verificacion_id: verifId,
                numero_borrador: 'BORR-CERT-ING-2026-000001',
                numero_certificado: null,
                titular_nombre: 'Sr. Ciudadano Administrado Demo',
                titular_documento: '00000050',
                programa_o_centro: 'Centro de Idiomas IESTP Suiza',
                nivel_estudios: 'Inglés Básico I-III e Intermedio I-III',
                modulos_acreditados: [],
                horas_academicas: 360,
                promedio_final: '17.50',
                periodo_estudios: '2024-03-18 al 2025-07-25',
                numero_acta: 'ACT-IDI-IESTPS-2025-0142',
                asunto: 'Certificado de Idioma Inglés',
                estado: 'BORRADOR_PENDIENTE_FIRMA',
                documento_adjunto_id: adjId,
                fecha_proyeccion: '2026-11-19',
                firmado_por: null,
                firmante_nombre: null,
                firmado_en: null,
                hash_pades: null,
                cvd: null,
              }]
            : [],
        };
      }
      if (sql.includes('FROM sigd_doc.tipo_documento')) return { rowCount: 1, rows: [{ tipo_documental_id: randomUUID() }] };
      if (sql.includes('FROM sigd_org.facultad_despacho')) return { rowCount: 1, rows: [{ nombre: 'Dr. Director General Demo' }] };
      if (sql.includes('INSERT INTO sigd_doc.documento_adjunto')) return { rowCount: 1, rows: [{ documento_adjunto_id: adjId }] };
      if (sql.includes('AS folio_inicio')) return { rowCount: 1, rows: [{ folio_inicio: 2 }] };
      if (sql.includes('INSERT INTO sigd_doc.certificado_ingles')) return { rowCount: 1, rows: [{ certificado_id: certId }] };
      if (sql.includes('INSERT INTO sigd_audit.evento_outbox')) return { rowCount: 1, rows: [{ id_evento: randomUUID() }] };
      return { rowCount: 1, rows: [{ max_correlativo: '0' }] };
    });

    const certificado = await proyectarCertificadoIngles(
      { query: queryProj } as unknown as PoolClient,
      EXP_ID,
      USUARIO_SEC_ID,
      ['SECRETARIO'],
    );

    expect(certificado.numeroBorrador).toBe('BORR-CERT-ING-2026-000001');
    expect(certificado.estado).toBe('BORRADOR_PENDIENTE_FIRMA');
    expect(uploadedBytes).not.toBeNull();
    expect(uploadedBytes!.subarray(0, 5).toString('utf8')).toBe('%PDF-');

    // Simular recepción de callback ReFirma PAdES autenticado sobre certificados/
    const sha256Firmado = createHash('sha256').update(uploadedBytes!).digest('hex');
    const outboxInserts: unknown[][] = [];
    const callbackQuery = vi.fn().mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.trim().startsWith('SELECT') && sql.includes('FROM sigd_doc.documento_adjunto')) {
        return { rowCount: 1, rows: [{ documento_adjunto_id: adjId, expediente_id: EXP_ID, s3_bucket: 'sigd-sandbox-e2e' }] };
      }
      if (sql.includes('FROM sigd_doc.firma_digital_documento')) return { rowCount: 0, rows: [] };
      if (sql.includes('INSERT INTO sigd_doc.firma_digital_documento')) return { rowCount: 1, rows: [{ cvd: 'CVD-2026-CERT99887766' }] };
      if (sql.includes('UPDATE sigd_doc.resolucion')) return { rowCount: 0, rows: [] };
      if (sql.includes('UPDATE sigd_doc.certificado_ingles')) {
        return { rowCount: 1, rows: [{ certificado_id: certId, numero_certificado: 'CERT-ING-2026-000001' }] };
      }
      if (sql.includes('FOR UPDATE OF e')) return { rowCount: 1, rows: [{ estado_actual: 'EN_FIRMA', area_actual_id: '05f2ee8f-c90f-4239-898c-3ac113afc424' }] };
      if (sql.includes('cu.id_usuario AS usuario_id')) return { rowCount: 1, rows: [{ usuario_id: SOLICITANTE_ID, cut: 'EXP-2026-009003', correo: 'ciudadano@demo' }] };
      if (sql.includes('INSERT INTO sigd_audit.evento_outbox')) {
        outboxInserts.push(params ?? []);
        return { rowCount: 1, rows: [{ id_evento: randomUUID() }] };
      }
      return { rowCount: 1, rows: [] };
    });

    const cvd = await registrarCallbackRefirma(
      { query: callbackQuery } as unknown as PoolClient,
      {
        documento_id: adjId,
        sha256_firmado: sha256Firmado,
        firmante: 'director.demo',
        fecha_sello_tsa: new Date().toISOString(),
        s3_bucket: 'sigd-sandbox-e2e',
        s3_key: 'certificados/CERT-ING-2026-000001.signed.pdf',
      },
    );

    expect(cvd).toBe('CVD-2026-CERT99887766');
    expect(outboxInserts).toHaveLength(1);
    const outboxPayload = JSON.parse(String(outboxInserts[0][1]));
    expect(outboxPayload.tipo_acto).toBe('certificado_emitido');
    expect(outboxPayload.numero_documento).toBe('CERT-ING-2026-000001');
  });
});
