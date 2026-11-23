import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { CATALOGO_DOCUMENTAL_POR_CODIGO } from '../../../../src/domains/tramicore/catalogoDocumentalTupa2026.js';
import {
  proyectarCertificadoEstudios,
  registrarVerificacionAcademicaEstudios,
  CODIGOS_PROCEDIMIENTO_CERTIFICADO_ESTUDIOS,
} from '../../../../src/domains/docucore/certificadoEstudios.service.js';
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

const EXP_ID = '22222222-2222-4222-8222-222222222222';
const SOLICITANTE_ID = '00000000-0000-0000-0000-000000000050';
const SEC_AREA_ID = '2b147b0d-7c8f-434f-b75a-598a1ccb855b';
const DG_AREA_ID = '1a000000-0000-0000-0000-000000000001';
const USUARIO_SEC_ID = '00000000-0000-0000-0000-000000000030';
const USUARIO_DG_ID = '00000000-0000-0000-0000-000000000020';
const REGISTRO_6_SEMESTRES_ID = 'e3400001-0000-4000-8000-000000000050';
const REGISTRO_INCOMPLETO_ID = 'e3400002-0000-4000-8000-000000000051';

describe('SUZ26-034 — Certificado de Estudios Superiores (6 semestres)', () => {
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

  it('1. Configura SUZ26-034 en catálogo institucional TUPA 2026 con S/ 124.00, FUT obligatorio y sin anexos externos', () => {
    expect(CODIGOS_PROCEDIMIENTO_CERTIFICADO_ESTUDIOS).toContain('SUZ26-034');
    expect(CODIGOS_PROCEDIMIENTO_CERTIFICADO_ESTUDIOS).toContain('SUZ26-035');

    const proc = CATALOGO_DOCUMENTAL_POR_CODIGO.get('SUZ26-034') || CATALOGO_DOCUMENTAL_POR_CODIGO.get('SUZ26-035');
    expect(proc).toBeDefined();
    expect(proc?.costoFuente).toContain('124.00');
    expect(proc?.unidadRecepcion).toBe('Mesa de Partes (MP)');
    expect(proc?.unidadResponsable).toContain('Secretaría Académica');
    expect(proc?.autoridadResolutiva).toContain('Dirección General');
    expect(proc?.sinAnexosEspecificos).toBe(true);
  });

  it('2. Bloquea verificación académica FAVORABLE cuando el usuario no ostenta el rol SECRETARIO', async () => {
    const cliente = { query: vi.fn() } as unknown as PoolClient;
    await expect(
      registrarVerificacionAcademicaEstudios(cliente, EXP_ID, USUARIO_DG_ID, ['DIRECTOR'], {
        registroEstudioId: REGISTRO_6_SEMESTRES_ID,
        resultado: 'FAVORABLE',
        observacionesAcademicas: 'Intento de verificación sin rol SECRETARIO.',
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('3. Bloquea verificación académica FAVORABLE si el pago en Tesorería (S/ 124.00) está pendiente', async () => {
    const query = vi.fn().mockImplementation(async (sql: string) => {
      if (sql.includes('FROM sigd_doc.expediente e') && sql.includes('WHERE e.expediente_id = $1::uuid')) {
        return {
          rowCount: 1,
          rows: [{
            expediente_id: EXP_ID,
            codigo_expediente: 'EXP-2026-000341',
            area_id: SEC_AREA_ID,
            area_codigo: 'SEC',
            solicitante_id: SOLICITANTE_ID,
            solicitante_nombre: 'CIUDADANO DEMO ESTUDIANTE',
            solicitante_documento: '00000050',
          }],
        };
      }
      if (sql.includes('FROM sigd_tes.aplicacion_pago')) {
        return {
          rowCount: 1,
          rows: [{
            orden_id: randomUUID(),
            orden_codigo: 'OP-PEND-34',
            importe: '124.00',
            moneda: 'PEN',
            pago_estado: null,
            numero_recibo: null,
            verificado_en: null,
            devolucion_activa: false,
          }],
        };
      }
      if (sql.includes('FROM sigd_doc.registro_estudios_superiores')) {
        return {
          rowCount: 1,
          rows: [{
            registro_estudio_id: REGISTRO_6_SEMESTRES_ID,
            tipo_documento_identidad: 'DNI',
            numero_documento_identidad: '00000050',
            persona_id: SOLICITANTE_ID,
            apellidos_nombres: 'CIUDADANO DEMO ESTUDIANTE',
            codigo_matricula: 'MAT-2021-0050',
            programa_estudios: 'Desarrollo de Sistemas de Información',
            plan_estudios: 'Plan 2020 Modular',
            modalidad_estudio: 'PRESENCIAL',
            total_semestres: 6,
            semestres_aprobados: [
              { semestre: 'I', periodo: '2021-I', creditos: 22, horas: 480, promedioSemestre: 16.5, condicion: 'APROBADO' },
              { semestre: 'II', periodo: '2021-II', creditos: 22, horas: 480, promedioSemestre: 16.8, condicion: 'APROBADO' },
              { semestre: 'III', periodo: '2022-I', creditos: 22, horas: 480, promedioSemestre: 17.0, condicion: 'APROBADO' },
              { semestre: 'IV', periodo: '2022-II', creditos: 22, horas: 480, promedioSemestre: 16.7, condicion: 'APROBADO' },
              { semestre: 'V', periodo: '2023-I', creditos: 21, horas: 480, promedioSemestre: 17.1, condicion: 'APROBADO' },
              { semestre: 'VI', periodo: '2023-II', creditos: 21, horas: 480, promedioSemestre: 17.0, condicion: 'APROBADO' },
            ],
            horas_academicas_totales: 2880,
            creditos_totales: '130.00',
            promedio_final: '16.85',
            nota_minima_aprobatoria: '13.00',
            periodo_ingreso: '2021-I',
            periodo_egreso: '2023-II',
            fecha_inicio: '2021-03-15',
            fecha_termino: '2023-12-22',
            culminado: true,
            aprobado: true,
            numero_acta_final: 'ACT-DSI-IESTPS-2023-0088',
            estado_academico: 'CULMINADO_APROBADO',
            observaciones: '6 semestres concluidos satisfactoriamente',
          }],
        };
      }
      return { rowCount: 0, rows: [] };
    });

    const cliente = { query } as unknown as PoolClient;
    await expect(
      registrarVerificacionAcademicaEstudios(cliente, EXP_ID, USUARIO_SEC_ID, ['SECRETARIO'], {
        registroEstudioId: REGISTRO_6_SEMESTRES_ID,
        resultado: 'FAVORABLE',
        observacionesAcademicas: '6 semestres aprobados verificados pero sin pago.',
      }),
    ).rejects.toMatchObject({ status: 409, code: 'PAGO_TESORERIA_NO_VERIFICADO' });
  });

  it('4. Bloquea verificación académica FAVORABLE si el solicitante no culminó los 6 semestres requeridos', async () => {
    const query = vi.fn().mockImplementation(async (sql: string) => {
      if (sql.includes('FROM sigd_doc.expediente e') && sql.includes('WHERE e.expediente_id = $1::uuid')) {
        return {
          rowCount: 1,
          rows: [{
            expediente_id: EXP_ID,
            codigo_expediente: 'EXP-2026-000341',
            area_id: SEC_AREA_ID,
            area_codigo: 'SEC',
            solicitante_id: SOLICITANTE_ID,
            solicitante_nombre: 'CIUDADANO DEMO ESTUDIANTE',
            solicitante_documento: '00000050',
          }],
        };
      }
      if (sql.includes('FROM sigd_tes.aplicacion_pago')) {
        return {
          rowCount: 1,
          rows: [{
            orden_id: randomUUID(),
            orden_codigo: 'OP-2026-EST-124',
            importe: '124.00',
            moneda: 'PEN',
            pago_estado: 'VERIFICADO',
            numero_recibo: 'RC-2026-00124',
            verificado_en: new Date().toISOString(),
            devolucion_activa: false,
          }],
        };
      }
      if (sql.includes('FROM sigd_doc.registro_estudios_superiores')) {
        return {
          rowCount: 1,
          rows: [{
            registro_estudio_id: REGISTRO_INCOMPLETO_ID,
            tipo_documento_identidad: 'DNI',
            numero_documento_identidad: '00000050',
            persona_id: SOLICITANTE_ID,
            apellidos_nombres: 'CIUDADANO DEMO ESTUDIANTE',
            codigo_matricula: 'MAT-2021-0050',
            programa_estudios: 'Desarrollo de Sistemas de Información',
            plan_estudios: 'Plan 2020 Modular',
            modalidad_estudio: 'PRESENCIAL',
            total_semestres: 4,
            semestres_aprobados: [
              { semestre: 'I', periodo: '2021-I', creditos: 22, horas: 480, promedioSemestre: 16.5, condicion: 'APROBADO' },
              { semestre: 'II', periodo: '2021-II', creditos: 22, horas: 480, promedioSemestre: 16.8, condicion: 'APROBADO' },
              { semestre: 'III', periodo: '2022-I', creditos: 22, horas: 480, promedioSemestre: 17.0, condicion: 'APROBADO' },
              { semestre: 'IV', periodo: '2022-II', creditos: 22, horas: 480, promedioSemestre: 16.7, condicion: 'APROBADO' },
            ],
            horas_academicas_totales: 1920,
            creditos_totales: '88.00',
            promedio_final: '16.75',
            nota_minima_aprobatoria: '13.00',
            periodo_ingreso: '2021-I',
            periodo_egreso: null,
            fecha_inicio: '2021-03-15',
            fecha_termino: null,
            culminado: false,
            aprobado: false,
            numero_acta_final: null,
            estado_academico: 'INCOMPLETO',
            observaciones: 'Solo cursó hasta el IV semestre',
          }],
        };
      }
      return { rowCount: 0, rows: [] };
    });

    const cliente = { query } as unknown as PoolClient;
    await expect(
      registrarVerificacionAcademicaEstudios(cliente, EXP_ID, USUARIO_SEC_ID, ['SECRETARIO'], {
        registroEstudioId: REGISTRO_INCOMPLETO_ID,
        resultado: 'FAVORABLE',
        observacionesAcademicas: 'Intento de dictamen favorable con estudios incompletos (4 semestres).',
      }),
    ).rejects.toMatchObject({ status: 409, code: 'ESTUDIOS_NO_CULMINADOS_O_DESAPROBADOS' });
  });

  it('5. Registra dictamen FAVORABLE y WORM cuando el solicitante tiene los 6 semestres aprobados y pago verificado', async () => {
    const mutaciones: Array<{ tabla: string; operacion: string }> = [];
    const query = vi.fn().mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes('FROM sigd_doc.expediente e') && sql.includes('WHERE e.expediente_id = $1::uuid')) {
        return {
          rowCount: 1,
          rows: [{
            expediente_id: EXP_ID,
            codigo_expediente: 'EXP-2026-000341',
            area_id: SEC_AREA_ID,
            area_codigo: 'SEC',
            solicitante_id: SOLICITANTE_ID,
            solicitante_nombre: 'CIUDADANO DEMO ESTUDIANTE',
            solicitante_documento: '00000050',
          }],
        };
      }
      if (sql.includes('FROM sigd_tes.aplicacion_pago')) {
        return {
          rowCount: 1,
          rows: [{
            orden_id: randomUUID(),
            orden_codigo: 'OP-2026-EST-124',
            importe: '124.00',
            moneda: 'PEN',
            pago_estado: 'VERIFICADO',
            numero_recibo: 'RC-2026-00124',
            verificado_en: new Date().toISOString(),
            devolucion_activa: false,
          }],
        };
      }
      if (sql.includes('FROM sigd_doc.registro_estudios_superiores')) {
        return {
          rowCount: 1,
          rows: [{
            registro_estudio_id: REGISTRO_6_SEMESTRES_ID,
            tipo_documento_identidad: 'DNI',
            numero_documento_identidad: '00000050',
            persona_id: SOLICITANTE_ID,
            apellidos_nombres: 'CIUDADANO DEMO ESTUDIANTE',
            codigo_matricula: 'MAT-2021-0050',
            programa_estudios: 'Desarrollo de Sistemas de Información',
            plan_estudios: 'Plan 2020 Modular',
            modalidad_estudio: 'PRESENCIAL',
            total_semestres: 6,
            semestres_aprobados: [
              { semestre: 'I', periodo: '2021-I', creditos: 22, horas: 480, promedioSemestre: 16.5, condicion: 'APROBADO' },
              { semestre: 'II', periodo: '2021-II', creditos: 22, horas: 480, promedioSemestre: 16.8, condicion: 'APROBADO' },
              { semestre: 'III', periodo: '2022-I', creditos: 22, horas: 480, promedioSemestre: 17.0, condicion: 'APROBADO' },
              { semestre: 'IV', periodo: '2022-II', creditos: 22, horas: 480, promedioSemestre: 16.7, condicion: 'APROBADO' },
              { semestre: 'V', periodo: '2023-I', creditos: 21, horas: 480, promedioSemestre: 17.1, condicion: 'APROBADO' },
              { semestre: 'VI', periodo: '2023-II', creditos: 21, horas: 480, promedioSemestre: 17.0, condicion: 'APROBADO' },
            ],
            horas_academicas_totales: 2880,
            creditos_totales: '130.00',
            promedio_final: '16.85',
            nota_minima_aprobatoria: '13.00',
            periodo_ingreso: '2021-I',
            periodo_egreso: '2023-II',
            fecha_inicio: '2021-03-15',
            fecha_termino: '2023-12-22',
            culminado: true,
            aprobado: true,
            numero_acta_final: 'ACT-DSI-IESTPS-2023-0088',
            estado_academico: 'CULMINADO_APROBADO',
            observaciones: '6 semestres concluidos satisfactoriamente',
          }],
        };
      }
      if (sql.includes('INSERT INTO sigd_doc.verificacion_academica_estudios')) {
        return {
          rowCount: 1,
          rows: [{
            verificacion_id: 'v3400001-0000-4000-8000-000000000001',
            expediente_id: EXP_ID,
            registro_estudio_id: REGISTRO_6_SEMESTRES_ID,
            dni_verificado: '00000050',
            semestres_verificados: 6,
            culminado_verificado: true,
            aprobado_verificado: true,
            pago_tesoreria_verificado: true,
            numero_recibo_tesoreria: 'RC-2026-00124',
            numero_acta_referencia: 'ACT-DSI-IESTPS-2023-0088',
            programa_estudios: 'Desarrollo de Sistemas de Información',
            plan_estudios: 'Plan 2020 Modular',
            creditos_totales: '130.00',
            horas_academicas: 2880,
            promedio_final: '16.85',
            detalle_semestres_verificados: [],
            resultado: 'FAVORABLE',
            observaciones_academicas: 'Constatado en libro de actas: 6 semestres culminados y aprobados.',
            verificado_por: USUARIO_SEC_ID,
            verificado_en: new Date(),
            vigente: true,
          }],
        };
      }
      if (sql.includes('INSERT INTO sigd_audit.bitacora_auditoria')) {
        mutaciones.push({ tabla: 'verificacion_academica_estudios', operacion: 'INSERT' });
        return { rowCount: 1, rows: [{ id: 1 }] };
      }
      if (sql.includes('INSERT INTO sigd_doc.expediente_requisito')) {
        return { rowCount: 2, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    });

    const cliente = { query } as unknown as PoolClient;
    const resultado = await registrarVerificacionAcademicaEstudios(cliente, EXP_ID, USUARIO_SEC_ID, ['SECRETARIO'], {
      registroEstudioId: REGISTRO_6_SEMESTRES_ID,
      resultado: 'FAVORABLE',
      observacionesAcademicas: 'Constatado en libro de actas: 6 semestres culminados y aprobados.',
    });

    expect(resultado.resultado).toBe('FAVORABLE');
    expect(resultado.semestresVerificados).toBe(6);
    expect(resultado.culminadoVerificado).toBe(true);
    expect(resultado.aprobadoVerificado).toBe(true);
    expect(resultado.pagoTesoreriaVerificado).toBe(true);
    expect(mutaciones.some((m) => m.tabla === 'verificacion_academica_estudios')).toBe(true);
  });

  it('6. Proyecta borrador oficial (PDF A4), asigna número BORR-EST-YYYY-XXXX y genera CVD preliminar', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 })),
    );

    const query = vi.fn().mockImplementation(async (sql: string) => {
      if (sql.includes('FROM sigd_doc.expediente e') && sql.includes('WHERE e.expediente_id = $1::uuid')) {
        return {
          rowCount: 1,
          rows: [{
            expediente_id: EXP_ID,
            codigo_expediente: 'EXP-2026-000341',
            area_id: SEC_AREA_ID,
            area_codigo: 'SEC',
            solicitante_id: SOLICITANTE_ID,
            solicitante_nombre: 'CIUDADANO DEMO ESTUDIANTE',
            solicitante_documento: '00000050',
          }],
        };
      }
      if (sql.includes('FROM sigd_tes.aplicacion_pago')) {
        return {
          rowCount: 1,
          rows: [{
            orden_id: randomUUID(),
            orden_codigo: 'OP-2026-EST-124',
            importe: '124.00',
            moneda: 'PEN',
            pago_estado: 'VERIFICADO',
            numero_recibo: 'RC-2026-00124',
            verificado_en: new Date().toISOString(),
            devolucion_activa: false,
          }],
        };
      }
      if (sql.includes('FROM sigd_doc.verificacion_academica_estudios')) {
        return {
          rowCount: 1,
          rows: [{
            verificacion_id: 'v3400001-0000-4000-8000-000000000001',
            expediente_id: EXP_ID,
            registro_estudio_id: REGISTRO_6_SEMESTRES_ID,
            dni_verificado: '00000050',
            semestres_verificados: 6,
            culminado_verificado: true,
            aprobado_verificado: true,
            pago_tesoreria_verificado: true,
            numero_recibo_tesoreria: 'RC-2026-00124',
            numero_acta_referencia: 'ACT-DSI-IESTPS-2023-0088',
            programa_estudios: 'Desarrollo de Sistemas de Información',
            plan_estudios: 'Plan 2020 Modular',
            creditos_totales: '130.00',
            horas_academicas: 2880,
            promedio_final: '16.85',
            detalle_semestres_verificados: [],
            resultado: 'FAVORABLE',
            observaciones_academicas: 'Constatado en libro de actas: 6 semestres culminados y aprobados.',
            verificado_por: USUARIO_SEC_ID,
            verificado_en: new Date(),
            vigente: true,
          }],
        };
      }
      if (sql.includes('FROM sigd_doc.registro_estudios_superiores')) {
        return {
          rowCount: 1,
          rows: [{
            registro_estudio_id: REGISTRO_6_SEMESTRES_ID,
            tipo_documento_identidad: 'DNI',
            numero_documento_identidad: '00000050',
            persona_id: SOLICITANTE_ID,
            apellidos_nombres: 'CIUDADANO DEMO ESTUDIANTE',
            codigo_matricula: 'MAT-2021-0050',
            programa_estudios: 'Desarrollo de Sistemas de Información',
            plan_estudios: 'Plan 2020 Modular',
            modalidad_estudio: 'PRESENCIAL',
            total_semestres: 6,
            semestres_aprobados: [
              { semestre: 'I', periodo: '2021-I', creditos: 22, horas: 480, promedioSemestre: 16.5, condicion: 'APROBADO' },
              { semestre: 'II', periodo: '2021-II', creditos: 22, horas: 480, promedioSemestre: 16.8, condicion: 'APROBADO' },
              { semestre: 'III', periodo: '2022-I', creditos: 22, horas: 480, promedioSemestre: 17.0, condicion: 'APROBADO' },
              { semestre: 'IV', periodo: '2022-II', creditos: 22, horas: 480, promedioSemestre: 16.7, condicion: 'APROBADO' },
              { semestre: 'V', periodo: '2023-I', creditos: 21, horas: 480, promedioSemestre: 17.1, condicion: 'APROBADO' },
              { semestre: 'VI', periodo: '2023-II', creditos: 21, horas: 480, promedioSemestre: 17.0, condicion: 'APROBADO' },
            ],
            horas_academicas_totales: 2880,
            creditos_totales: '130.00',
            promedio_final: '16.85',
            nota_minima_aprobatoria: '13.00',
            periodo_ingreso: '2021-I',
            periodo_egreso: '2023-II',
            fecha_inicio: '2021-03-15',
            fecha_termino: '2023-12-22',
            culminado: true,
            aprobado: true,
            numero_acta_final: 'ACT-DSI-IESTPS-2023-0088',
            estado_academico: 'CULMINADO_APROBADO',
            observaciones: '6 semestres concluidos satisfactoriamente',
          }],
        };
      }
      if (sql.includes('FROM sigd_doc.tipo_documento WHERE codigo = \'CERTIFICADO_ESTUDIOS\'')) {
        return { rowCount: 1, rows: [{ tipo_documental_id: 'd3400001-0000-4000-8000-000000000001' }] };
      }
      if (sql.includes('pg_advisory_xact_lock')) return { rowCount: 1, rows: [] };
      if (sql.includes('max_correlativo')) return { rowCount: 1, rows: [{ max_correlativo: '0' }] };
      if (sql.includes('INSERT INTO sigd_doc.documento_adjunto')) {
        return { rowCount: 1, rows: [{ documento_adjunto_id: 'a3400001-0000-4000-8000-000000000001' }] };
      }
      if (sql.includes('INSERT INTO sigd_doc.certificado_estudios_superiores')) {
        return {
          rowCount: 1,
          rows: [{
            certificado_id: 'c3400001-0000-4000-8000-000000000001',
            expediente_id: EXP_ID,
            verificacion_id: 'v3400001-0000-4000-8000-000000000001',
            numero_borrador: `BORR-EST-${new Date().getFullYear()}-0001`,
            numero_certificado: null,
            titular_persona_id: SOLICITANTE_ID,
            titular_nombre: 'CIUDADANO DEMO ESTUDIANTE',
            titular_documento: '00000050',
            programa_estudios: 'Desarrollo de Sistemas de Información',
            plan_estudios: 'Plan 2020 Modular',
            semestres_acreditados: [],
            horas_academicas: 2880,
            creditos_totales: '130.00',
            promedio_final: '16.85',
            periodo_estudios: '2021-I a 2023-II',
            numero_acta: 'ACT-DSI-IESTPS-2023-0088',
            asunto: 'Certificado de Estudios Superiores (6 semestres)',
            cvd: 'CVD-EST-TEST00000001',
            estado: 'BORRADOR_PENDIENTE_FIRMA',
            documento_adjunto_id: 'a3400001-0000-4000-8000-000000000001',
            proyectado_por: USUARIO_SEC_ID,
            fecha_proyeccion: new Date().toISOString().slice(0, 10),
            firmado_por: null,
            firmado_en: null,
            hash_pades: null,
          }],
        };
      }
      if (sql.includes('INSERT INTO sigd_audit.bitacora_auditoria') || sql.includes('INSERT INTO sigd_audit.evento_outbox')) {
        return { rowCount: 1, rows: [{ id: 1 }] };
      }
      return { rowCount: 0, rows: [] };
    });

    const cliente = { query } as unknown as PoolClient;
    const proyectado = await proyectarCertificadoEstudios(cliente, EXP_ID, USUARIO_SEC_ID, ['SECRETARIO']);

    expect(proyectado.numeroBorrador).toMatch(/^BORR-EST-\d{4}-\d{4}$/);
    expect(proyectado.estado).toBe('BORRADOR_PENDIENTE_FIRMA');
    expect(proyectado.cvd).toMatch(/^CVD-EST-/);
    expect(proyectado.horasAcademicas).toBe(2880);
    expect(proyectado.creditosTotales).toBe(130);
  });

  it('7. Callback Refirma procesa la firma digital PAdES, transiciona expediente a RESUELTO y emite evento Outbox para Casilla', async () => {
    const docAdjuntoId = 'a3400001-0000-4000-8000-000000000001';
    const fakePdfBytes = Buffer.from('%PDF-1.7\n' + 'x'.repeat(200));
    const fakePdfSha = createHash('sha256').update(fakePdfBytes).digest('hex');

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(fakePdfBytes, { status: 200 })),
    );

    const eventosOutbox: Array<{ agregado: string; tipo_evento: string; payload: unknown }> = [];
    const movimientosRutaDoc: Array<{ estado_anterior: string; evento: string; estado_nuevo: string }> = [];

    const query = vi.fn().mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes('FROM sigd_doc.documento_adjunto')) {
        return {
          rowCount: 1,
          rows: [{
            documento_adjunto_id: docAdjuntoId,
            expediente_id: EXP_ID,
            s3_bucket: 'sigd-sandbox-e2e',
          }],
        };
      }
      if (sql.includes('FROM sigd_doc.firma_digital_documento WHERE documento_id = $1')) {
        return { rowCount: 0, rows: [] };
      }
      if (sql.includes('INSERT INTO sigd_doc.firma_digital_documento')) {
        return { rowCount: 1, rows: [{ cvd: 'CVD-EST-FINAL000001' }] };
      }
      if (sql.includes('UPDATE sigd_doc.certificado_estudios_superiores')) {
        return {
          rowCount: 1,
          rows: [{
            certificado_id: 'c3400001-0000-4000-8000-000000000001',
            numero_certificado: 'EST-2026-0001',
          }],
        };
      }
      if (sql.includes('FROM sigd_tra.expediente e') && sql.includes('sigd_rut.estado_actual_expediente')) {
        return {
          rowCount: 1,
          rows: [{
            estado_actual: 'EN_FIRMA',
            area_actual_id: DG_AREA_ID,
          }],
        };
      }
      if (sql.includes('FROM sigd_auth.cuenta_usuario cu') && sql.includes('operador_identidad')) {
        return { rowCount: 1, rows: [{ operador_id: '100000001' }] };
      }
      if (sql.includes('INSERT INTO sigd_rut.movimiento_tramite')) {
        movimientosRutaDoc.push({ estado_anterior: 'EN_FIRMA', evento: 'FIRMA', estado_nuevo: 'RESUELTO' });
        return { rowCount: 1, rows: [] };
      }
      if (sql.includes('UPDATE sigd_tra.expediente SET estado = \'RESUELTO\'')) {
        return { rowCount: 1, rows: [] };
      }
      if (sql.includes('FROM sigd_doc.expediente e') && sql.includes('FROM sigd_auth.cuenta_usuario cu')) {
        return {
          rowCount: 1,
          rows: [{
            usuario_id: '00000000-0000-0000-0000-000000000050',
            cut: 'EXP-2026-000341',
            correo: 'estudiante.demo@iestpsuiza.edu.pe',
          }],
        };
      }
      if (sql.includes('INSERT INTO sigd_audit.evento_outbox')) {
        eventosOutbox.push({
          agregado: 'certificado_estudios',
          tipo_evento: 'certificado_emitido',
          payload: params?.[1],
        });
        return { rowCount: 1, rows: [] };
      }
      if (sql.includes('INSERT INTO sigd_audit.bitacora_auditoria')) {
        return { rowCount: 1, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    });

    const cliente = { query } as unknown as PoolClient;
    const cvd = await registrarCallbackRefirma(cliente, {
      documento_id: docAdjuntoId,
      sha256_firmado: fakePdfSha,
      firmante: 'director.general',
      fecha_sello_tsa: new Date().toISOString(),
      s3_bucket: 'sigd-sandbox-e2e',
      s3_key: 'certificados-estudios/BORR-EST-2026-0001.pdf',
    });

    expect(cvd).toBe('CVD-EST-FINAL000001');
    expect(movimientosRutaDoc).toHaveLength(1);
    expect(movimientosRutaDoc[0].estado_nuevo).toBe('RESUELTO');
    expect(eventosOutbox).toHaveLength(1);
    expect(eventosOutbox[0].tipo_evento).toBe('certificado_emitido');
  });
});
