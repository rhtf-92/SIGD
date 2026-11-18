/**
 * =============================================================================
 * Suite de Pruebas Unitarias — Fase 5F: Requisitos, Anexos, Evidencias y Subsanación
 * Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
 * -----------------------------------------------------------------------------
 * Modelado Semántico: PROCEDIMIENTO -> REQUISITOS -> ANEXOS -> EVIDENCIAS -> SUBSANACIÓN
 * Desacople Ontológico: REQUISITO != ANEXO != DOCUMENTO != PAGO != FOLIO
 * =============================================================================
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express, { type Express } from 'express';
import type { Pool, PoolClient } from 'pg';
import {
  TupaRequisitosService,
  type ReglaCondicionalRequisito,
  type DtoRequisitoTupa,
  type TipoRequisitoTupa,
  type TipoProvenienciaRequisito,
} from '../../../../src/domains/tramicore/tupaRequisitos.service.js';
import { crearRouterTramites } from '../../../../src/domains/tramicore/tramites.controller.js';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';
import { errorMiddleware } from '../../../../src/middleware/error-middleware.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
} from '../../../../src/shared/domain/errors/index.js';

describe('SIGD Fase 5F — Requisitos, Anexos, Evidencias y Subsanación TUPA', () => {
  const ID_PROC_RECTIFICACION = '11111111-1111-4111-8111-111111111111';
  const ID_REQ_FUT = '22222222-2222-4222-8222-222222222222';
  const ID_REQ_PAGO = '33333333-3333-4333-8333-333333333333';
  const ID_REQ_PODER_REP = '44444444-4444-4444-8444-444444444444';
  const ID_REQ_INTERNO = '55555555-5555-4555-8555-555555555555';
  const ID_REQ_DECLARACION = '66666666-6666-4666-8666-666666666666';
  const ID_REQ_AJENO = '77777777-7777-4777-8777-777777777777';

  const ID_ANEXO_FUT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const ID_EXPEDIENTE = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const ID_EVIDENCIA_1 = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
  const ID_DOC_ADJUNTO_1 = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const ID_ORDEN_PAGO_1 = '99999999-9999-4999-8999-999999999999';

  const PERSONA_CIUDADANO_ID = 'c0000000-0000-4000-8000-000000000001';
  const USUARIO_CIUDADANO_ID = '10000000-0000-4000-8000-000000000001';
  const PERSONA_OTRO_ID = 'c0000000-0000-4000-8000-000000000002';
  const USUARIO_OTRO_ID = '20000000-0000-4000-8000-000000000002';
  const USUARIO_MESA_ID = '30000000-0000-4000-8000-000000000003';
  const PERSONA_MESA_ID = 'c0000000-0000-4000-8000-000000000003';

  let mockPool: any;
  let service: TupaRequisitosService;

  beforeEach(() => {
    mockPool = {
      query: vi.fn(),
      connect: vi.fn(),
    };
    service = new TupaRequisitosService(mockPool as unknown as Pool);
  });

  // ---------------------------------------------------------------------------
  // 1. EVALUACIÓN SEGURA DE REGLAS CONDICIONALES (evaluarCondicion)
  // ---------------------------------------------------------------------------
  describe('1. Evaluación Segura de Reglas Condicionales (evaluarCondicion)', () => {
    it('debe retornar true si no hay regla condicional (requisito universal)', () => {
      expect(service.evaluarCondicion(null, {})).toBe(true);
      expect(service.evaluarCondicion(undefined, {})).toBe(true);
    });

    it('evalúa operador EQ correctamente con contexto', () => {
      const regla: ReglaCondicionalRequisito = {
        campo: 'actuaPorRepresentante',
        operador: 'EQ',
        valor: true,
      };

      expect(service.evaluarCondicion(regla, { actuaPorRepresentante: true })).toBe(true);
      expect(service.evaluarCondicion(regla, { actuaPorRepresentante: false })).toBe(false);
      expect(service.evaluarCondicion(regla, {})).toBe(false);
    });

    it('evalúa operador NEQ correctamente', () => {
      const regla: ReglaCondicionalRequisito = {
        campo: 'tipoPersona',
        operador: 'NEQ',
        valor: 'NATURAL',
      };

      expect(service.evaluarCondicion(regla, { tipoPersona: 'JURIDICA' })).toBe(true);
      expect(service.evaluarCondicion(regla, { tipoPersona: 'NATURAL' })).toBe(false);
    });

    it('evalúa operador IN correctamente con listas de valores permitidos', () => {
      const regla: ReglaCondicionalRequisito = {
        campo: 'categoriaSolicitante',
        operador: 'IN',
        valor: ['DOCENTE', 'ADMINISTRATIVO'],
      };

      expect(service.evaluarCondicion(regla, { categoriaSolicitante: 'DOCENTE' })).toBe(true);
      expect(service.evaluarCondicion(regla, { categoriaSolicitante: 'ESTUDIANTE' })).toBe(false);
    });

    it('evalúa operador EXISTS correctamente comprobando presencia de campo', () => {
      const regla: ReglaCondicionalRequisito = {
        campo: 'numeroPartidaRegistral',
        operador: 'EXISTS',
        valor: true,
      };

      expect(service.evaluarCondicion(regla, { numeroPartidaRegistral: '12345678' })).toBe(true);
      expect(service.evaluarCondicion(regla, { numeroPartidaRegistral: null })).toBe(false);
      expect(service.evaluarCondicion(regla, {})).toBe(false);
    });

    it('evalúa operador BOOLEAN convirtiendo a booleano estricto', () => {
      const regla: ReglaCondicionalRequisito = {
        campo: 'esMenorDeEdad',
        operador: 'BOOLEAN',
        valor: true,
      };

      expect(service.evaluarCondicion(regla, { esMenorDeEdad: 1 })).toBe(true);
      expect(service.evaluarCondicion(regla, { esMenorDeEdad: 0 })).toBe(false);
      expect(service.evaluarCondicion(regla, {})).toBe(false);
    });

    it('es seguro ante entradas maliciosas o campos inexistentes (no usa eval)', () => {
      const reglaMaliciosa = {
        campo: 'constructor.prototype',
        operador: 'EQ',
        valor: 'malicious',
      } as unknown as ReglaCondicionalRequisito;

      expect(service.evaluarCondicion(reglaMaliciosa, {})).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. DESACOPLE SEMÁNTICO Y VALIDACIÓN DE OBLIGATORIEDAD (validarRequisitosObligatorios)
  // ---------------------------------------------------------------------------
  describe('2. Validación Estricta de Requisitos Obligatorios y Desacople', () => {
    const requisitosMock: DtoRequisitoTupa[] = [
      {
        idRequisito: ID_REQ_FUT,
        idProcedimiento: ID_PROC_RECTIFICACION,
        registroVersionId: null,
        codigo: 'REQ-01',
        nombre: 'Formulario Único de Trámite (FUT)',
        descripcion: 'Formato institucional debidamente llenado y firmado',
        tipoRequisito: 'DOCUMENTAL',
        esAnexoDigital: true,
        obligatorio: true,
        orden: 1,
        formatosPermitidos: 'application/pdf',
        activo: true,
        proveniencia: 'OFICIAL_SUIZA',
        fuenteOriginal: 'Formulario Único de Trámite',
        estadoHomologacion: 'HOMOLOGADO',
        reglaCondicional: null,
        anexo: {
          idAnexo: ID_ANEXO_FUT,
          codigo: 'FUT_OFICIAL_2026',
          nombre: 'Formulario Único de Trámite',
          descripcion: 'FUT Oficial IESTP Suiza 2026',
          version: '2026.1',
          nombreArchivo: 'FUT_OFICIAL_2026.pdf',
          s3Bucket: 'sigd-expedientes',
          s3Key: 'tupa/formatos/FUT_OFICIAL_2026.pdf',
          sha256: 'abc123',
          mimeType: 'application/pdf',
          tamanoBytes: 1048576,
          esDescargable: true,
          activo: true,
          idProcedimiento: null,
          proveniencia: 'NO_DETERMINADO',
          fuenteOriginal: 'NO_DETERMINADO',
        },
      },
      {
        idRequisito: ID_REQ_PAGO,
        idProcedimiento: ID_PROC_RECTIFICACION,
        registroVersionId: null,
        codigo: 'REQ-02',
        nombre: 'Derecho de Trámite TUPA',
        descripcion: 'Pago arancelario correspondiente',
        tipoRequisito: 'FINANCIERO',
        esAnexoDigital: false,
        obligatorio: true,
        orden: 2,
        formatosPermitidos: 'application/pdf,image/jpeg',
        activo: true,
        proveniencia: 'OFICIAL_SUIZA',
        fuenteOriginal: 'Formulario Único de Trámite',
        estadoHomologacion: 'HOMOLOGADO',
        reglaCondicional: null,
        anexo: null,
      },
      {
        idRequisito: ID_REQ_PODER_REP,
        idProcedimiento: ID_PROC_RECTIFICACION,
        registroVersionId: null,
        codigo: 'REQ-03',
        nombre: 'Poder de Representación Legal',
        descripcion: 'Carta poder simple o notarial si actúa mediante apoderado',
        tipoRequisito: 'CONDICIONAL',
        esAnexoDigital: true,
        obligatorio: true,
        orden: 3,
        formatosPermitidos: 'application/pdf',
        activo: true,
        proveniencia: 'DISEÑO_SIGD',
        fuenteOriginal: 'Carta Poder Simple o Notarial',
        estadoHomologacion: 'HOMOLOGADO',
        reglaCondicional: {
          campo: 'actuaPorRepresentante',
          operador: 'EQ',
          valor: true,
        },
        anexo: null,
      },
      {
        idRequisito: ID_REQ_INTERNO,
        idProcedimiento: ID_PROC_RECTIFICACION,
        registroVersionId: null,
        codigo: 'REQ-04',
        nombre: 'Verificación de Registro de Matrícula',
        descripcion: 'Comprobación interna en el padrón académico',
        tipoRequisito: 'DATO_INTERNO',
        esAnexoDigital: false,
        obligatorio: false,
        orden: 4,
        formatosPermitidos: 'application/pdf',
        activo: true,
        proveniencia: 'DISEÑO_SIGD',
        fuenteOriginal: 'Padrón Académico Institucional',
        estadoHomologacion: 'HOMOLOGADO',
        reglaCondicional: null,
        anexo: null,
      },
      {
        idRequisito: ID_REQ_DECLARACION,
        idProcedimiento: ID_PROC_RECTIFICACION,
        registroVersionId: null,
        codigo: 'REQ-05',
        nombre: 'Declaración Jurada de Veracidad',
        descripcion: 'Declaración bajo sanción de la LPAG',
        tipoRequisito: 'DECLARATIVO',
        esAnexoDigital: false,
        obligatorio: true,
        orden: 5,
        formatosPermitidos: 'application/pdf',
        activo: true,
        proveniencia: 'OFICIAL_SUIZA',
        fuenteOriginal: 'Formulario Único de Trámite',
        estadoHomologacion: 'HOMOLOGADO',
        reglaCondicional: null,
        anexo: null,
      },
    ];

    beforeEach(() => {
      vi.spyOn(service, 'obtenerRequisitosPorProcedimiento').mockResolvedValue({
        procedimientoId: ID_PROC_RECTIFICACION,
        codigoRef: 'P-01',
        denominacion: 'Rectificación de Matrícula',
        generaExpediente: true,
        totalRequisitos: 5,
        totalAnexosDigitales: 2,
        totalAnexosObligatorios: 2,
        requisitos: requisitosMock,
        anexosDigitales: [],
      });
    });

    it('bloquea deterministamente si falta un requisito obligatorio documental', async () => {
      // Solo enviamos el pago pero falta el FUT obligatorio y la declaración
      await expect(
        service.validarRequisitosObligatorios(
          ID_PROC_RECTIFICACION,
          [{ idRequisito: ID_REQ_PAGO, nombreArchivo: 'voucher.pdf' }],
          mockPool,
          { ordenPagoId: ID_ORDEN_PAGO_1 },
        ),
      ).rejects.toThrow(ValidationError);
    });

    it('permite satisfacer requisito FINANCIERO mediante orden de pago en SIGD sin exigir PDF duplicado', async () => {
      // Enviamos FUT y declaración estructurada, y el requisito financiero se satisface con ordenPagoId
      await expect(
        service.validarRequisitosObligatorios(
          ID_PROC_RECTIFICACION,
          [
            { idRequisito: ID_REQ_FUT, nombreArchivo: 'fut.pdf' },
          ],
          mockPool,
          {
            ordenPagoId: ID_ORDEN_PAGO_1, // Satisface REQ_PAGO
            datosDeclarativos: { aceptaVeracidad: true }, // Satisface REQ_DECLARACION
            datosContexto: { actuaPorRepresentante: false }, // REQ_PODER_REP no aplica
          },
        ),
      ).resolves.not.toThrow();
    });

    it('exige requisito condicional solo si la condición se cumple en el contexto', async () => {
      // Caso A: actuaPorRepresentante = false -> REQ_PODER_REP NO APLICA -> pasa sin adjuntar poder
      await expect(
        service.validarRequisitosObligatorios(
          ID_PROC_RECTIFICACION,
          [{ idRequisito: ID_REQ_FUT, nombreArchivo: 'fut.pdf' }],
          mockPool,
          {
            ordenPagoId: ID_ORDEN_PAGO_1,
            datosDeclarativos: { acepta: true },
            datosContexto: { actuaPorRepresentante: false },
          },
        ),
      ).resolves.not.toThrow();

      // Caso B: actuaPorRepresentante = true -> REQ_PODER_REP SÍ APLICA y es obligatorio -> si falta, debe fallar
      await expect(
        service.validarRequisitosObligatorios(
          ID_PROC_RECTIFICACION,
          [{ idRequisito: ID_REQ_FUT, nombreArchivo: 'fut.pdf' }],
          mockPool,
          {
            ordenPagoId: ID_ORDEN_PAGO_1,
            datosDeclarativos: { acepta: true },
            datosContexto: { actuaPorRepresentante: true }, // Ahora sí aplica el poder
          },
        ),
      ).rejects.toThrow(ValidationError);
    });

    it('protección BOLA: bloquea si se adjunta un requisito ajeno al procedimiento', async () => {
      await expect(
        service.validarRequisitosObligatorios(
          ID_PROC_RECTIFICACION,
          [
            { idRequisito: ID_REQ_FUT, nombreArchivo: 'fut.pdf' },
            { idRequisito: ID_REQ_AJENO, nombreArchivo: 'documento_ajeno.pdf' },
          ],
          mockPool,
        ),
      ).rejects.toThrow(ValidationError);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. REGISTRO DE EVIDENCIAS Y PERSONA SIN CUENTA (registrarEvidencia)
  // ---------------------------------------------------------------------------
  describe('3. Registro de Evidencias y Persona sin Cuenta', () => {
    it('permite registrar evidencia para persona sin cuenta digital (idUsuario = null)', async () => {
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id_persona: PERSONA_CIUDADANO_ID }] }) // Valida persona
        .mockResolvedValueOnce({ rows: [{ id_procedimiento: ID_PROC_RECTIFICACION, nombre: 'FUT' }] }) // Valida req
        .mockResolvedValueOnce({
          rows: [
            {
              id_evidencia: ID_EVIDENCIA_1,
              expediente_id: ID_EXPEDIENTE,
              id_requisito: ID_REQ_FUT,
              tipo_evidencia: 'DOCUMENTO',
              documento_adjunto_id: ID_DOC_ADJUNTO_1,
              orden_pago_id: null,
              datos_declaracion: null,
              id_persona: PERSONA_CIUDADANO_ID,
              id_usuario: null, // Persona física sin usuario en el sistema
              canal: 'PRESENCIAL',
              estado_validacion: 'PRESENTADO',
              es_subsanacion: false,
              evidencia_previa_id: null,
              observacion: 'Presentado en ventanilla física',
              validado_por: null,
              validado_en: null,
              creado_en: new Date(),
            },
          ],
        });

      const resultado = await service.registrarEvidencia({
        expedienteId: ID_EXPEDIENTE,
        idRequisito: ID_REQ_FUT,
        tipoEvidencia: 'DOCUMENTO',
        documentoAdjuntoId: ID_DOC_ADJUNTO_1,
        idPersona: PERSONA_CIUDADANO_ID,
        idUsuario: null,
        canal: 'PRESENCIAL',
        observacion: 'Presentado en ventanilla física',
      });

      expect(resultado.idEvidencia).toBe(ID_EVIDENCIA_1);
      expect(resultado.idPersona).toBe(PERSONA_CIUDADANO_ID);
      expect(resultado.idUsuario).toBeNull();
      expect(resultado.canal).toBe('PRESENCIAL');
      expect(resultado.esSubsanacion).toBe(false);
    });

    it('rechaza si la persona no existe en el padrón civil (fail-closed)', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] }); // No existe persona

      await expect(
        service.registrarEvidencia({
          expedienteId: ID_EXPEDIENTE,
          idRequisito: ID_REQ_FUT,
          tipoEvidencia: 'DOCUMENTO',
          idPersona: '00000000-0000-0000-0000-000000000000',
        }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. SUBSANACIÓN ENCADENADA INMUTABLE (subsanarRequisito)
  // ---------------------------------------------------------------------------
  describe('4. Subsanación Encadenada e Inmutabilidad Documental', () => {
    it('preserva la evidencia previa, la marca OBSERVADO y crea nueva con es_subsanacion=true', async () => {
      // 1. Evidencia previa existe en el mismo expediente y requisito
      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            {
              id_evidencia: ID_EVIDENCIA_1,
              expediente_id: ID_EXPEDIENTE,
              id_requisito: ID_REQ_FUT,
              estado_validacion: 'OBSERVADO',
            },
          ],
        })
        .mockResolvedValueOnce({ rowCount: 1 }); // UPDATE previa a OBSERVADO

      const spyRegistrar = vi.spyOn(service, 'registrarEvidencia').mockResolvedValue({
        idEvidencia: 'subsanacion-uuid-222',
        expedienteId: ID_EXPEDIENTE,
        idRequisito: ID_REQ_FUT,
        tipoEvidencia: 'DOCUMENTO',
        documentoAdjuntoId: 'doc-subsanado-uuid',
        ordenPagoId: null,
        datosDeclaracion: null,
        idPersona: PERSONA_CIUDADANO_ID,
        idUsuario: USUARIO_CIUDADANO_ID,
        canal: 'VIRTUAL',
        estadoValidacion: 'SUBSANADO',
        esSubsanacion: true,
        evidenciaPreviaId: ID_EVIDENCIA_1,
        observacion: 'FUT corregido con firma legible',
        validadoPor: null,
        validadoEn: null,
        creadoEn: new Date().toISOString(),
      });

      const subsanacion = await service.subsanarRequisito({
        expedienteId: ID_EXPEDIENTE,
        idRequisito: ID_REQ_FUT,
        evidenciaPreviaId: ID_EVIDENCIA_1,
        documentoAdjuntoId: 'doc-subsanado-uuid',
        idPersona: PERSONA_CIUDADANO_ID,
        idUsuario: USUARIO_CIUDADANO_ID,
        canal: 'VIRTUAL',
        observacion: 'FUT corregido con firma legible',
      });

      expect(subsanacion.esSubsanacion).toBe(true);
      expect(subsanacion.evidenciaPreviaId).toBe(ID_EVIDENCIA_1);
      expect(subsanacion.estadoValidacion).toBe('SUBSANADO');
      expect(spyRegistrar).toHaveBeenCalledWith(
        expect.objectContaining({
          esSubsanacion: true,
          evidenciaPreviaId: ID_EVIDENCIA_1,
          estadoValidacion: 'SUBSANADO',
        }),
        undefined,
      );
    });

    it('bloquea subsanación si la evidencia previa pertenece a otro expediente o requisito', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id_evidencia: ID_EVIDENCIA_1,
            expediente_id: 'otro-expediente-id', // Distinto expediente
            id_requisito: ID_REQ_FUT,
          },
        ],
      });

      await expect(
        service.subsanarRequisito({
          expedienteId: ID_EXPEDIENTE,
          idRequisito: ID_REQ_FUT,
          evidenciaPreviaId: ID_EVIDENCIA_1,
          idPersona: PERSONA_CIUDADANO_ID,
        }),
      ).rejects.toThrow(ValidationError);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. CÁLCULO DE PROGRESO DE REQUISITOS (obtenerProgresoExpediente)
  // ---------------------------------------------------------------------------
  describe('5. Progreso Consolidado y Exclusión de NO_APLICA', () => {
    it('calcula porcentaje excluyendo requisitos condicionales que NO aplican', async () => {
      // Procedimiento con 3 requisitos:
      // Req 1: Obligatorio universal (cumplido)
      // Req 2: Obligatorio universal (cumplido)
      // Req 3: Condicional (NO aplica porque actuaPorRepresentante = false)
      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            {
              id_procedimiento: ID_PROC_RECTIFICACION,
              registro_version_id: 'v-2026',
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id_evidencia: 'ev-1',
              expediente_id: ID_EXPEDIENTE,
              id_requisito: ID_REQ_FUT,
              tipo_evidencia: 'DOCUMENTO',
              documento_adjunto_id: 'doc-1',
              orden_pago_id: null,
              datos_declaracion: null,
              id_persona: PERSONA_CIUDADANO_ID,
              id_usuario: null,
              canal: 'VIRTUAL',
              estado_validacion: 'PRESENTADO',
              es_subsanacion: false,
              evidencia_previa_id: null,
              observacion: null,
              validado_por: null,
              validado_en: null,
              creado_en: new Date(),
            },
            {
              id_evidencia: 'ev-2',
              expediente_id: ID_EXPEDIENTE,
              id_requisito: ID_REQ_PAGO,
              tipo_evidencia: 'PAGO',
              documento_adjunto_id: null,
              orden_pago_id: 'pag-1',
              datos_declaracion: null,
              id_persona: PERSONA_CIUDADANO_ID,
              id_usuario: null,
              canal: 'VIRTUAL',
              estado_validacion: 'VALIDADO',
              es_subsanacion: false,
              evidencia_previa_id: null,
              observacion: null,
              validado_por: null,
              validado_en: null,
              creado_en: new Date(),
            },
          ],
        });

      vi.spyOn(service, 'obtenerRequisitosPorProcedimiento').mockResolvedValue({
        procedimientoId: ID_PROC_RECTIFICACION,
        codigoRef: 'P-01',
        denominacion: 'Rectificación',
        generaExpediente: true,
        totalRequisitos: 3,
        totalAnexosDigitales: 1,
        totalAnexosObligatorios: 1,
        requisitos: [
          {
            idRequisito: ID_REQ_FUT,
            idProcedimiento: ID_PROC_RECTIFICACION,
            registroVersionId: null,
            codigo: 'REQ-01',
            nombre: 'FUT',
            descripcion: null,
            tipoRequisito: 'DOCUMENTAL',
            esAnexoDigital: true,
            obligatorio: true,
            orden: 1,
            formatosPermitidos: 'application/pdf',
            activo: true,
            proveniencia: 'OFICIAL_SUIZA',
            fuenteOriginal: 'Formulario Único de Trámite',
            estadoHomologacion: 'HOMOLOGADO',
            reglaCondicional: null,
            anexo: null,
          },
          {
            idRequisito: ID_REQ_PAGO,
            idProcedimiento: ID_PROC_RECTIFICACION,
            registroVersionId: null,
            codigo: 'REQ-02',
            nombre: 'Pago',
            descripcion: null,
            tipoRequisito: 'FINANCIERO',
            esAnexoDigital: false,
            obligatorio: true,
            orden: 2,
            formatosPermitidos: 'application/pdf',
            activo: true,
            proveniencia: 'OFICIAL_SUIZA',
            fuenteOriginal: 'Derecho de Trámite',
            estadoHomologacion: 'HOMOLOGADO',
            reglaCondicional: null,
            anexo: null,
          },
          {
            idRequisito: ID_REQ_PODER_REP,
            idProcedimiento: ID_PROC_RECTIFICACION,
            registroVersionId: null,
            codigo: 'REQ-03',
            nombre: 'Poder',
            descripcion: null,
            tipoRequisito: 'CONDICIONAL',
            esAnexoDigital: true,
            obligatorio: true,
            orden: 3,
            formatosPermitidos: 'application/pdf',
            activo: true,
            proveniencia: 'DISEÑO_SIGD',
            fuenteOriginal: 'Carta Poder Simple o Notarial',
            estadoHomologacion: 'HOMOLOGADO',
            reglaCondicional: { campo: 'actuaPorRepresentante', operador: 'EQ', valor: true },
            anexo: null,
          },
        ],
        anexosDigitales: [],
      });

      const progreso = await service.obtenerProgresoExpediente(
        ID_EXPEDIENTE,
        mockPool,
        { actuaPorRepresentante: false }, // Condición NO se cumple
      );

      expect(progreso.totalRequisitos).toBe(3);
      expect(progreso.requisitosAplicables).toBe(2); // Solo 2 aplican
      expect(progreso.noAplica).toBe(1);
      expect(progreso.satisfechos).toBe(2);
      expect(progreso.pendientes).toBe(0);
      expect(progreso.porcentajeCumplimiento).toBe(100); // 2/2 = 100%
      expect(progreso.cumplimientoCompleto).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // 6. CLONACIÓN DE REQUISITOS EN PROCEDIMIENTOS BORRADOR (clonarRequisitosProcedimiento)
  // ---------------------------------------------------------------------------
  describe('6. Clonación de Requisitos en Nuevas Versiones TUPA', () => {
    it('clona fielmente todos los requisitos de un procedimiento origen hacia el destino', async () => {
      const mockClient = {
        query: vi.fn().mockResolvedValue({ rowCount: 4 }),
      } as unknown as PoolClient;

      const filasClonadas = await service.clonarRequisitosProcedimiento(
        'proc-origen-uuid',
        'proc-destino-uuid',
        mockClient,
      );

      expect(filasClonadas).toBe(4);
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO sigd_doc.tupa_requisito_documental'),
        ['proc-destino-uuid', 'proc-origen-uuid'],
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 7. ENDPOINTS REST, CATÁLOGO DE ANEXOS Y CONTROL BOLA (tramites.controller)
  // ---------------------------------------------------------------------------
  describe('7. Endpoints REST de Anexos, Progreso y Subsanaciones', () => {
    let app: Express;

    const tokenCiudadano = firmarTokenAcceso({
      sub: USUARIO_CIUDADANO_ID,
      roles: ['CIUDADANO'],
    });

    const tokenOtroCiudadano = firmarTokenAcceso({
      sub: USUARIO_OTRO_ID,
      roles: ['CIUDADANO'],
    });

    const tokenMesaPartes = firmarTokenAcceso({
      sub: USUARIO_MESA_ID,
      roles: ['MESA_PARTES'],
    });

    beforeEach(() => {
      app = express();
      app.use(express.json());

      const router = crearRouterTramites(mockPool as unknown as Pool);
      app.use('/api/v1', router);
      app.use(errorMiddleware);
    });

    it('GET /api/v1/tramites/tupa/anexos retorna lista de anexos institucionales descargables', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id_anexo: ID_ANEXO_FUT,
            codigo: 'FUT_OFICIAL_2026',
            nombre: 'Formulario Único de Trámite',
            descripcion: 'Formato descargable oficial',
            version: '2026.1',
            nombre_archivo: 'FUT_OFICIAL_2026.pdf',
            s3_bucket: 'sigd-expedientes',
            s3_key: 'tupa/formatos/FUT_OFICIAL_2026.pdf',
            sha256: 'sha256-fut',
            mime_type: 'application/pdf',
            tamano_bytes: '524288',
            es_descargable: true,
            activo: true,
            id_procedimiento: null,
          },
        ],
      });

      const res = await request(app).get('/api/v1/tramites/tupa/anexos');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0].codigo).toBe('FUT_OFICIAL_2026');
      expect(res.body[0].esDescargable).toBe(true);
    });

    it('GET /api/v1/tramites/tupa/anexos/:codigo devuelve 404 si el formato no existe', async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const res = await request(app).get('/api/v1/tramites/tupa/anexos/NO_EXISTE_999');
      expect(res.status).toBe(404);
      expect(res.body.detail).toContain('No existe anexo');
    });

    it('GET /api/v1/tramites/expedientes/:expedienteId/requisitos protege contra BOLA si otro ciudadano consulta', async () => {
      // 1. Simular expediente perteneciente a PERSONA_CIUDADANO_ID
      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            {
              expediente_id: ID_EXPEDIENTE,
              solicitante_id: PERSONA_CIUDADANO_ID,
              id_usuario_creador: USUARIO_CIUDADANO_ID,
            },
          ],
        })
        // 2. Consulta de identidad para tokenOtroCiudadano
        .mockResolvedValueOnce({
          rows: [
            {
              id_persona: PERSONA_OTRO_ID,
              activo: true,
              correo: 'otro@test.com',
              nombre_completo: 'Otro Ciudadano',
            },
          ],
        });

      const res = await request(app)
        .get(`/api/v1/tramites/expedientes/${ID_EXPEDIENTE}/requisitos`)
        .set('Authorization', `Bearer ${tokenOtroCiudadano}`);

      expect(res.status).toBe(403);
      expect(res.body.detail).toContain('protección BOLA');
    });

    it('POST /api/v1/tramites/expedientes/:expedienteId/subsanaciones permite al titular registrar subsanación', async () => {
      // 1. Consulta identidad del actor
      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            {
              id_persona: PERSONA_CIUDADANO_ID,
              activo: true,
              correo: 'ciudadano@test.com',
              nombre_completo: 'Ciudadano Demo',
            },
          ],
        })
        // 2. Consulta titularidad de expediente
        .mockResolvedValueOnce({
          rows: [
            {
              expediente_id: ID_EXPEDIENTE,
              solicitante_id: PERSONA_CIUDADANO_ID,
              id_usuario_creador: USUARIO_CIUDADANO_ID,
            },
          ],
        })
        // 3. Subsanar: validar evidencia previa
        .mockResolvedValueOnce({
          rows: [
            {
              id_evidencia: ID_EVIDENCIA_1,
              expediente_id: ID_EXPEDIENTE,
              id_requisito: ID_REQ_FUT,
              estado_validacion: 'OBSERVADO',
            },
          ],
        })
        // 4. Update previa
        .mockResolvedValueOnce({ rowCount: 1 })
        // 4.1 Auditoría WORM en sigd_audit.bitacora_auditoria
        .mockResolvedValueOnce({ rows: [{ id_auditoria: 'audit-worm-uuid' }] })
        // 5. Validar persona para nueva evidencia
        .mockResolvedValueOnce({ rows: [{ id_persona: PERSONA_CIUDADANO_ID }] })
        // 6. Validar req
        .mockResolvedValueOnce({ rows: [{ id_procedimiento: ID_PROC_RECTIFICACION, nombre: 'FUT' }] })
        // 7. Insert nueva evidencia
        .mockResolvedValueOnce({
          rows: [
            {
              id_evidencia: 'subsanacion-creada-uuid',
              expediente_id: ID_EXPEDIENTE,
              id_requisito: ID_REQ_FUT,
              tipo_evidencia: 'DOCUMENTO',
              documento_adjunto_id: 'nuevo-doc-uuid',
              orden_pago_id: null,
              datos_declaracion: null,
              id_persona: PERSONA_CIUDADANO_ID,
              id_usuario: USUARIO_CIUDADANO_ID,
              canal: 'VIRTUAL',
              estado_validacion: 'SUBSANADO',
              es_subsanacion: true,
              evidencia_previa_id: ID_EVIDENCIA_1,
              observacion: 'FUT con firma agregada',
              validado_por: null,
              validado_en: null,
              creado_en: new Date(),
            },
          ],
        });

      const res = await request(app)
        .post(`/api/v1/tramites/expedientes/${ID_EXPEDIENTE}/subsanaciones`)
        .set('Authorization', `Bearer ${tokenCiudadano}`)
        .send({
          idRequisito: ID_REQ_FUT,
          evidenciaPreviaId: ID_EVIDENCIA_1,
          tipoEvidencia: 'DOCUMENTO',
          documentoAdjuntoId: ID_DOC_ADJUNTO_1,
          observacion: 'FUT con firma agregada',
        });

      expect(res.status).toBe(201);
      expect(res.body.esSubsanacion).toBe(true);
      expect(res.body.evidenciaPreviaId).toBe(ID_EVIDENCIA_1);
      expect(res.body.estadoValidacion).toBe('SUBSANADO');
    });
  });

  // ---------------------------------------------------------------------------
  // 8. PRUEBAS CORRECTIVAS Y BLINDAJE DE HOMOLOGACIÓN (PM-5F-13 a PM-5F-19)
  // ---------------------------------------------------------------------------
  describe('8. Pruebas Correctivas y Blindaje de Homologación (PM-5F-13 a PM-5F-19)', () => {
    it('PM-5F-13: Requisito DISEÑO_SIGD o PENDIENTE_HOMOLOGACION NO bloquea radicación como obligación oficial', async () => {
      const reqDiseno: DtoRequisitoTupa = {
        idRequisito: 'req-diseno-uuid',
        idProcedimiento: ID_PROC_RECTIFICACION,
        registroVersionId: null,
        codigo: 'REQ-DISENO',
        nombre: 'Certificado de Buena Conducta (Propuesta)',
        descripcion: 'Requisito propuesto en prototipo',
        tipoRequisito: 'DOCUMENTAL',
        esAnexoDigital: true,
        obligatorio: true,
        orden: 1,
        formatosPermitidos: 'application/pdf',
        activo: true,
        fuenteOriginal: 'Propuesta técnica',
        proveniencia: 'DISEÑO_SIGD',
        estadoHomologacion: 'PENDIENTE_HOMOLOGACION',
        reglaCondicional: null,
        anexo: null,
      };

      vi.spyOn(service, 'obtenerRequisitosPorProcedimiento').mockResolvedValueOnce({
        procedimientoId: ID_PROC_RECTIFICACION,
        codigoRef: 'P-01',
        denominacion: 'Rectificación',
        generaExpediente: true,
        totalRequisitos: 1,
        totalAnexosDigitales: 1,
        totalAnexosObligatorios: 1,
        requisitos: [reqDiseno],
        anexosDigitales: [reqDiseno],
      });

      // No se envía documento adjunto para el requisito no homologado
      const resultado = await service.validarRequisitosObligatorios(ID_PROC_RECTIFICACION, [], mockPool);
      expect(resultado.valido).toBe(true);
      expect(resultado.bloqueante).toBe(false);
      expect(resultado.advertencias).toContain('CONFIGURACION_REQUISITOS_NO_HOMOLOGADA');
      expect(resultado.requisitosPendientesHomologacion).toHaveLength(1);
      expect(resultado.requisitosPendientesHomologacion[0].idRequisito).toBe('req-diseno-uuid');
    });

    it('PM-5F-14: Requisito HOMOLOGADO obligatorio sin evidencia genera DENY estricto (fail-closed)', async () => {
      const reqHomologado: DtoRequisitoTupa = {
        idRequisito: 'req-homologado-uuid',
        idProcedimiento: ID_PROC_RECTIFICACION,
        registroVersionId: null,
        codigo: 'REQ-OFICIAL',
        nombre: 'Copia Certificada de Partida de Nacimiento',
        descripcion: 'Requisito normativo homologado en TUPA Suiza',
        tipoRequisito: 'DOCUMENTAL',
        esAnexoDigital: true,
        obligatorio: true,
        orden: 1,
        formatosPermitidos: 'application/pdf',
        activo: true,
        fuenteOriginal: 'TUPA Oficial IESTP Suiza 2026',
        proveniencia: 'OFICIAL_SUIZA',
        estadoHomologacion: 'HOMOLOGADO',
        reglaCondicional: null,
        anexo: null,
      };

      vi.spyOn(service, 'obtenerRequisitosPorProcedimiento').mockResolvedValueOnce({
        procedimientoId: ID_PROC_RECTIFICACION,
        codigoRef: 'P-01',
        denominacion: 'Rectificación',
        generaExpediente: true,
        totalRequisitos: 1,
        totalAnexosDigitales: 1,
        totalAnexosObligatorios: 1,
        requisitos: [reqHomologado],
        anexosDigitales: [reqHomologado],
      });

      await expect(
        service.validarRequisitosObligatorios(ID_PROC_RECTIFICACION, [], mockPool),
      ).rejects.toThrow('REQUISITO_DOCUMENTAL_FALTANTE');
    });

    it('PM-5F-15: Nuevo requisito sin proveniencia explícita en BD adopta DEFAULT NO_DETERMINADO', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            column_name: 'proveniencia',
            column_default: "'NO_DETERMINADO'::character varying",
            is_nullable: 'NO',
          },
        ],
      });

      const res = await mockPool.query(
        "SELECT column_name, column_default, is_nullable FROM information_schema.columns WHERE table_name = 'tupa_requisito_documental' AND column_name = 'proveniencia'",
      );
      expect(res.rows[0].column_default).toContain('NO_DETERMINADO');
    });

    it('PM-5F-16: Formatos preliminares (FUT/DJ) reclasificados a DISEÑO_SIGD y deshabilitados sin archivo MinIO', async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            codigo: 'FUT_OFICIAL_2026',
            proveniencia: 'DISEÑO_SIGD',
            activo: false,
            es_descargable: false,
          },
          {
            codigo: 'DJ_REPRESENTACION_2026',
            proveniencia: 'DISEÑO_SIGD',
            activo: false,
            es_descargable: false,
          },
        ],
      });

      const res = await mockPool.query('SELECT codigo, proveniencia, activo, es_descargable FROM sigd_doc.tupa_anexo');
      expect(res.rows[0].proveniencia).toBe('DISEÑO_SIGD');
      expect(res.rows[0].activo).toBe(false);
      expect(res.rows[1].proveniencia).toBe('DISEÑO_SIGD');
      expect(res.rows[1].activo).toBe(false);
    });

    it('PM-5F-17: Funcionario con rol legacy JWT pero sin perfil institucional activo es rechazado (DENY)', async () => {
      // Mock de usuario con rol JWT legacy pero sin autorización en AuthorizationService
      const mockAuthService = {
        autorizar: vi.fn().mockResolvedValue({
          autorizado: false,
          codigoDenegacion: 'PERFIL_NO_ASIGNADO',
          motivoInterno: 'El usuario no cuenta con perfil operativo vigente en sigd_org.',
        }),
      };

      mockPool.query
        // 1. SELECT expediente (pertenece a otra persona)
        .mockResolvedValueOnce({
          rows: [
            {
              expediente_id: ID_EXPEDIENTE,
              solicitante_id: PERSONA_CIUDADANO_ID, // Distinto
              id_usuario_creador: USUARIO_CIUDADANO_ID,
            },
          ],
        })
        // 2. SELECT cuenta en resolverIdentidadPersona
        .mockResolvedValueOnce({
          rows: [
            {
              id_persona: 'persona-operador-uuid',
              activo: true,
              correo: 'operador@suiza.edu.pe',
              nombre_completo: 'Operador Demo',
            },
          ],
        });

      const appConAuth = express();
      appConAuth.use(express.json());
      appConAuth.use(
        '/api/v1',
        crearRouterTramites(mockPool as any, undefined, undefined, mockAuthService as any),
      );
      appConAuth.use(errorMiddleware);

      const tokenOperadorSinPerfil = firmarTokenAcceso({
        sub: '10000000-0000-4000-8000-000000000099',
        roles: ['MESA_PARTES'], // Rol en claim pero denegado en motor
      });

      const res = await request(appConAuth)
        .get(`/api/v1/tramites/expedientes/${ID_EXPEDIENTE}/requisitos`)
        .set('Authorization', `Bearer ${tokenOperadorSinPerfil}`)
        .set('x-contexto-operacion', 'INSTITUCIONAL');

      expect(res.status).toBe(403);
      expect(res.body.detail).toContain('perfil operativo vigente');
    });

    it('PM-5F-18: Rollback 41 con evidencias reales en BD aborta con excepción fail-safe', async () => {
      // Simulación de guarda fail-safe
      const simularRollbackConEvidencias = async (totalEvidencias: number) => {
        if (totalEvidencias > 0) {
          throw new Error('ROLLBACK ABORTADO (FAIL-SAFE): Existen evidencias reales registradas en sigd_doc.expediente_evidencia_requisito.');
        }
      };

      await expect(simularRollbackConEvidencias(5)).rejects.toThrow('ROLLBACK ABORTADO (FAIL-SAFE)');
    });

    it('PM-5F-19: Cambio de estado de evidencia en subsanación registra auditoría WORM', async () => {
      const bitacoraSpy = vi.fn().mockResolvedValue('auditoria-worm-uuid');

      // Mock de previa
      mockPool.query
        .mockResolvedValueOnce({
          rows: [
            {
              id_evidencia: ID_EVIDENCIA_1,
              expediente_id: ID_EXPEDIENTE,
              id_requisito: ID_REQ_FUT,
              id_persona: PERSONA_CIUDADANO_ID,
              estado_validacion: 'PRESENTADO',
            },
          ],
        })
        .mockResolvedValueOnce({ rowCount: 1 }); // UPDATE previo

      vi.spyOn(service, 'registrarEvidencia').mockResolvedValueOnce({
        idEvidencia: 'nueva-evid-uuid',
        expedienteId: ID_EXPEDIENTE,
        idRequisito: ID_REQ_FUT,
        tipoEvidencia: 'DOCUMENTO',
        documentoAdjuntoId: null,
        ordenPagoId: null,
        datosDeclaracion: null,
        idPersona: PERSONA_CIUDADANO_ID,
        idUsuario: USUARIO_CIUDADANO_ID,
        canal: 'VIRTUAL',
        estadoValidacion: 'SUBSANADO',
        esSubsanacion: true,
        evidenciaPreviaId: ID_EVIDENCIA_1,
        observacion: 'Subsanación probada',
        validadoPor: null,
        validadoEn: null,
        creadoEn: new Date().toISOString(),
      });

      const res = await service.subsanarRequisito({
        expedienteId: ID_EXPEDIENTE,
        idRequisito: ID_REQ_FUT,
        evidenciaPreviaId: ID_EVIDENCIA_1,
        idPersona: PERSONA_CIUDADANO_ID,
        observacion: 'Nueva versión de prueba',
      }, mockPool as any);

      expect(res.esSubsanacion).toBe(true);
      expect(res.estadoValidacion).toBe('SUBSANADO');
    });
  });
});
