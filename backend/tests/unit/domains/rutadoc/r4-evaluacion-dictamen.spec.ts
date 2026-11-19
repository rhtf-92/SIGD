import { describe, expect, it, vi } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import {
  listarMisEvaluaciones,
  iniciarEvaluacion,
  obtenerDetalleEvaluacion,
  marcarRequisitoEvaluacion,
  registrarObservacionEvaluacion,
  registrarSubsanacionEstudiante,
  reanudarEvaluacionDocente,
  emitirDictamenDocente,
  supervisarEvaluacionesArea,
} from '../../../../src/domains/rutadoc/evaluadores.service.js';
import type { ActorRutaDoc } from '../../../../src/domains/rutadoc/rutadoc.types.js';

const EXPEDIENTE_ID = '30000000-0000-4000-8000-000000000001';
const REQUISITO_ID = '40000000-0000-4000-8000-000000000001';
const AREA_ACADEMICA_ID = 'a0000000-0000-4000-8000-000000000001';
const USUARIO_COORDINADOR = '10000000-0000-4000-8000-000000000001';
const USUARIO_DOCENTE_1 = '20000000-0000-4000-8000-000000000001';
const USUARIO_DOCENTE_AJENO = '20000000-0000-4000-8000-000000000099';
const USUARIO_ESTUDIANTE = '90000000-0000-4000-8000-000000000001';
const USUARIO_ESTUDIANTE_AJENO = '90000000-0000-4000-8000-000000000099';
const USUARIO_MESA_PARTES = '10000000-0000-4000-8000-000000000099';
const AREA_MESA_PARTES_ID = 'a1a3a496-ff7f-45d8-b63c-3e54fcf79de1';

const actorDocente: ActorRutaDoc = {
  id: USUARIO_DOCENTE_1,
  roles: ['DOCENTE'],
  unidadOrganicaId: AREA_ACADEMICA_ID,
  permisos: [
    { codigo: 'EXPEDIENTE_EVALUAR', ambito: 'AREA', areaId: AREA_ACADEMICA_ID },
    { codigo: 'EXPEDIENTE_OBSERVAR', ambito: 'AREA', areaId: AREA_ACADEMICA_ID },
    { codigo: 'EXPEDIENTE_LEER', ambito: 'AREA', areaId: AREA_ACADEMICA_ID },
  ],
};

const actorDocenteAjeno: ActorRutaDoc = {
  id: USUARIO_DOCENTE_AJENO,
  roles: ['DOCENTE'],
  unidadOrganicaId: AREA_ACADEMICA_ID,
  permisos: [
    { codigo: 'EXPEDIENTE_EVALUAR', ambito: 'AREA', areaId: AREA_ACADEMICA_ID },
  ],
};

const actorEstudiante: ActorRutaDoc = {
  id: USUARIO_ESTUDIANTE,
  roles: ['ESTUDIANTE'],
  unidadOrganicaId: null,
  permisos: [
    { codigo: 'EXPEDIENTE_SUBSANAR', ambito: 'GLOBAL', areaId: null },
    { codigo: 'EXPEDIENTE_LEER', ambito: 'GLOBAL', areaId: null },
  ],
};

const actorEstudianteAjeno: ActorRutaDoc = {
  id: USUARIO_ESTUDIANTE_AJENO,
  roles: ['ESTUDIANTE'],
  unidadOrganicaId: null,
  permisos: [
    { codigo: 'EXPEDIENTE_SUBSANAR', ambito: 'GLOBAL', areaId: null },
  ],
};

const actorMesaPartes: ActorRutaDoc = {
  id: USUARIO_MESA_PARTES,
  roles: ['MESA_PARTES'],
  unidadOrganicaId: AREA_MESA_PARTES_ID,
  permisos: [
    { codigo: 'EXPEDIENTE_SUBSANAR', ambito: 'AREA', areaId: AREA_MESA_PARTES_ID },
    { codigo: 'EXPEDIENTE_LEER', ambito: 'AREA', areaId: AREA_MESA_PARTES_ID },
  ],
};

const actorCoordinador: ActorRutaDoc = {
  id: USUARIO_COORDINADOR,
  roles: ['COORDINADOR_AREA'],
  unidadOrganicaId: AREA_ACADEMICA_ID,
  permisos: [
    { codigo: 'EXPEDIENTE_ASIGNAR', ambito: 'AREA', areaId: AREA_ACADEMICA_ID },
    { codigo: 'EXPEDIENTE_REASIGNAR', ambito: 'AREA', areaId: AREA_ACADEMICA_ID },
    { codigo: 'EXPEDIENTE_LEER', ambito: 'AREA', areaId: AREA_ACADEMICA_ID },
  ],
};

describe('R4: Ciclo Funcional de Evaluación, Observaciones, Subsanaciones y Dictamen Docente', () => {
  // HITO 1: Bandeja del docente
  describe('HITO 1: Bandeja funcional del docente', () => {
    it('debe listar las evaluaciones asignadas al docente con sus conteos de resumen', async () => {
      const mockPool = {
        query: vi.fn()
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [
              {
                id_asignacion: '50000000-0000-4000-8000-000000000001',
                expediente_id: EXPEDIENTE_ID,
                codigo_expediente: 'EXP-2026-000412',
                asunto: 'Titulación Profesional DSI',
                estado_expediente: 'EN_REVISION',
                estado_evaluacion: 'EN_EVALUACION',
                asignado_en: new Date('2026-11-10T10:00:00Z'),
                confirmado_recepcion_en: new Date('2026-11-10T10:30:00Z'),
                evaluacion_concluida_en: null,
                resultado_evaluacion: null,
                motivo_asignacion: 'Asignación de jurado calificador',
                observaciones: null,
                area_id: AREA_ACADEMICA_ID,
                area_nombre: 'DSI',
                solicitante_nombre: 'Carlos Mendoza',
              },
            ],
          })
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [
              { nuevos: '2', en_evaluacion: '1', observados: '0', subsanados: '0', concluidos: '3' },
            ],
          }),
      } as unknown as Pool;

      const resultado = await listarMisEvaluaciones(mockPool, actorDocente, {
        limite: 10,
        offset: 0,
      });

      expect(resultado.ok).toBe(true);
      expect(resultado.total).toBe(1);
      expect(resultado.resumen.nuevos).toBe(2);
      expect(resultado.resumen.enEvaluacion).toBe(1);
      expect(resultado.resumen.concluidos).toBe(3);
      expect(resultado.evaluaciones[0].codigoExpediente).toBe('EXP-2026-000412');
      expect(resultado.evaluaciones[0].estadoEvaluacion).toBe('EN_EVALUACION');
    });

    it('debe rechazar la consulta si el actor no tiene identidad', async () => {
      const mockPool = {} as unknown as Pool;
      const actorInvalido = { ...actorDocente, id: '' };

      await expect(listarMisEvaluaciones(mockPool, actorInvalido, { limite: 10, offset: 0 }))
        .rejects.toThrow();
    });
  });

  // HITO 2: Recepción e inicio de evaluación
  describe('HITO 2: Recepción e inicio de evaluación', () => {
    it('debe permitir al docente asignado confirmar recepción e iniciar evaluación', async () => {
      const fechaConfirmacion = new Date('2026-11-14T12:00:00Z');
      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [
              {
                id_asignacion: '50000000-0000-4000-8000-000000000001',
                id_usuario_docente: USUARIO_DOCENTE_1,
                confirmado_recepcion_en: null,
                estado_evaluacion: 'PENDIENTE',
                area_id: AREA_ACADEMICA_ID,
              },
            ],
          })
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ confirmado_recepcion_en: fechaConfirmacion }],
          })
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ id_evento: '00000000-0000-4000-8000-000000000001' }],
          }), // evento outbox
      } as unknown as PoolClient;

      const resultado = await iniciarEvaluacion(mockClient, EXPEDIENTE_ID, actorDocente);

      expect(resultado.ok).toBe(true);
      expect(resultado.estadoEvaluacion).toBe('EN_EVALUACION');
      expect(resultado.confirmadoEn).toBe(fechaConfirmacion.toISOString());
    });

    it('debe rechazar la recepción si el actor no es el docente asignado', async () => {
      const mockClient = {
        query: vi.fn().mockResolvedValueOnce({
          rowCount: 1,
          rows: [
            {
              id_asignacion: '50000000-0000-4000-8000-000000000001',
              id_usuario_docente: USUARIO_DOCENTE_1,
              confirmado_recepcion_en: null,
              estado_evaluacion: 'PENDIENTE',
              area_id: AREA_ACADEMICA_ID,
            },
          ],
        }),
      } as unknown as PoolClient;

      await expect(iniciarEvaluacion(mockClient, EXPEDIENTE_ID, actorDocenteAjeno))
        .rejects.toThrow(/Solo el docente evaluador asignado/);
    });
  });

  // HITO 3: Consulta y calificación de requisitos
  describe('HITO 3: Evaluación documental y requisitos', () => {
    it('debe permitir al docente marcar un requisito como cumplido', async () => {
      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ id_usuario_docente: USUARIO_DOCENTE_1 }],
          })
          .mockResolvedValueOnce({ rowCount: 1 }),
      } as unknown as PoolClient;

      const res = await marcarRequisitoEvaluacion(mockClient, EXPEDIENTE_ID, REQUISITO_ID, true, actorDocente);

      expect(res.ok).toBe(true);
      expect(res.cumplido).toBe(true);
      expect(res.requisitoId).toBe(REQUISITO_ID);
    });
  });

  // HITO 4: Registro de observaciones
  describe('HITO 4: Registro formal de observaciones técnicas', () => {
    it('debe registrar la observación, transicionar el expediente a OBSERVADO y generar evento outbox', async () => {
      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ area_actual: AREA_ACADEMICA_ID, codigo_expediente: 'EXP-2026-000412', solicitante_id: USUARIO_ESTUDIANTE }],
          }) // obtenerAreaActual
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ id_asignacion: '50000000-0000-4000-8000-000000000001', id_usuario_docente: USUARIO_DOCENTE_1, evidencias: {} }],
          }) // asigRes
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ estado_nuevo: 'EN_REVISION' }],
          }) // estadoActualRes
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ data_type: 'bigint' }],
          }) // colInfo
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ operador_id: '990000001' }],
          }) // operador_identidad
          .mockResolvedValueOnce({ rowCount: 1 }) // insert movimiento_tramite
          .mockResolvedValueOnce({ rowCount: 1 }) // update expediente estado
          .mockResolvedValueOnce({ rowCount: 1 }) // update expediente_evaluador
          .mockResolvedValueOnce({ rowCount: 1, rows: [{ id_evento: "00000000-0000-4000-8000-000000000001" }] }), // insert evento outbox
      } as unknown as PoolClient;

      const resultado = await registrarObservacionEvaluacion(mockClient, EXPEDIENTE_ID, actorDocente, {
        motivo: 'Falta adjuntar la constancia de no adeudo de biblioteca debidamente visada',
        sustentoTecnico: 'Conforme al artículo 14 del reglamento TUPA 2026',
        plazoDias: 5,
        requisitosObservados: [REQUISITO_ID],
      });

      expect(resultado.ok).toBe(true);
      expect(resultado.estado).toBe('OBSERVADO');
      expect(resultado.plazoDias).toBe(5);
    });
  });

  // HITO 5: Subsanación por el estudiante
  describe('HITO 5: Subsanación del estudiante', () => {
    it('debe permitir al estudiante presentar subsanación y transicionar a SUBSANADO', async () => {
      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ area_actual: AREA_ACADEMICA_ID, codigo_expediente: 'EXP-2026-000412', solicitante_id: USUARIO_ESTUDIANTE }],
          }) // obtenerAreaActual
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ id_persona: USUARIO_ESTUDIANTE }],
          }) // personaUsuario
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ estado_nuevo: 'OBSERVADO' }],
          }) // estadoActualRes
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ data_type: 'bigint' }],
          }) // colInfo
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ operador_id: '990000002' }],
          }) // operador_identidad
          .mockResolvedValueOnce({ rowCount: 1 }) // insert movimiento_tramite
          .mockResolvedValueOnce({ rowCount: 1 }) // update expediente estado
          .mockResolvedValueOnce({ rowCount: 1 }) // update expediente_evaluador
          .mockResolvedValueOnce({ rowCount: 1, rows: [{ id_evento: "00000000-0000-4000-8000-000000000001" }] }), // insert evento outbox
      } as unknown as PoolClient;

      const resultado = await registrarSubsanacionEstudiante(mockClient, EXPEDIENTE_ID, actorEstudiante, {
        motivo: 'Se adjunta constancia de no adeudo emitida el 12/11/2026 con sello de Biblioteca',
        sustentoSubsanacion: 'Constancia regularizada',
        documentosAdjuntos: ['hash-constancia-pdf-123'],
      });

      expect(resultado.ok).toBe(true);
      expect(resultado.estado).toBe('SUBSANADO');
    });

    it('debe rechazar la subsanación si el actor no es el titular solicitante', async () => {
      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ area_actual: AREA_ACADEMICA_ID, codigo_expediente: 'EXP-2026-000412', solicitante_id: USUARIO_ESTUDIANTE }],
          })
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ id_persona: USUARIO_ESTUDIANTE_AJENO }],
          }),
      } as unknown as PoolClient;

      await expect(registrarSubsanacionEstudiante(mockClient, EXPEDIENTE_ID, actorEstudianteAjeno, {
        motivo: 'Intento de subsanación ajena',
        documentosAdjuntos: [],
      })).rejects.toThrow(/Solo el administrado o estudiante titular/);
    });

    it('debe permitir al operador de Mesa de Partes presentar subsanación en ventanilla física preservando la titularidad canónica del estudiante', async () => {
      const queryMock = vi.fn()
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ area_actual: AREA_ACADEMICA_ID, codigo_expediente: 'EXP-2026-000412', solicitante_id: USUARIO_ESTUDIANTE }],
        }) // obtenerAreaActualExpediente
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ id_persona: USUARIO_MESA_PARTES }],
        }) // personaUsuario
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ valido: true }],
        }) // checkMp
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ estado_nuevo: 'OBSERVADO' }],
        }) // estadoActualRes
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ data_type: 'bigint' }],
        }) // colInfo
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ operador_id: '990000003' }],
        }) // operador_identidad
        .mockResolvedValueOnce({ rowCount: 1 }) // insert movimiento_tramite
        .mockResolvedValueOnce({ rowCount: 1 }) // update expediente estado
        .mockResolvedValueOnce({ rowCount: 1 }) // update expediente_evaluador
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id_evento: "00000000-0000-4000-8000-000000000001" }] }); // outbox

      const mockClient = { query: queryMock } as unknown as PoolClient;

      const resultado = await registrarSubsanacionEstudiante(mockClient, EXPEDIENTE_ID, actorMesaPartes, {
        motivo: 'Subsanación presentada físicamente en Mesa de Partes con documento foliado',
        sustentoSubsanacion: 'Constancia física entregada en ventanilla',
        documentosAdjuntos: ['hash-doc-ventanilla-001'],
      });

      expect(resultado.ok).toBe(true);
      expect(resultado.estado).toBe('SUBSANADO');

      // Verificar que se registró el movimiento con canal VENTANILLA_MESA_PARTES y preservación de solicitanteId
      const callMov = queryMock.mock.calls.find((c: unknown[]) => typeof c[0] === 'string' && c[0].includes('INSERT INTO sigd_rut.movimiento_tramite'));
      expect(callMov).toBeDefined();
      const datosMov = JSON.parse(callMov![1][2]);
      expect(datosMov.canalRecepcion).toBe('VENTANILLA_MESA_PARTES');
      expect(datosMov.presentadoPor).toBe('MESA_PARTES_VENTANILLA');
      expect(datosMov.solicitanteId).toBe(USUARIO_ESTUDIANTE);

      // Verificar que el UPDATE a sigd_tra.expediente solo cambia estado a SUBSANADO y no altera solicitante_id
      const callExp = queryMock.mock.calls.find((c: unknown[]) => typeof c[0] === 'string' && c[0].includes('UPDATE sigd_tra.expediente'));
      expect(callExp).toBeDefined();
      expect(callExp![0]).toBe("UPDATE sigd_tra.expediente SET estado = 'SUBSANADO' WHERE expediente_id = $1::uuid");
    });

    it('debe rechazar la subsanación si el operador con rol MESA_PARTES no tiene asignación activa en el área MP', async () => {
      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ area_actual: AREA_ACADEMICA_ID, codigo_expediente: 'EXP-2026-000412', solicitante_id: USUARIO_ESTUDIANTE }],
          })
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ id_persona: USUARIO_MESA_PARTES }],
          })
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ valido: false }],
          }),
      } as unknown as PoolClient;

      await expect(registrarSubsanacionEstudiante(mockClient, EXPEDIENTE_ID, actorMesaPartes, {
        motivo: 'Subsanación en ventanilla sin asignación activa',
        documentosAdjuntos: [],
      })).rejects.toThrow(/el operador de Mesa de Partes no cuenta con adscripción activa al área de Mesa de Partes/);
    });
  });

  // HITO 6: Reanudación de la evaluación
  describe('HITO 6: Reanudación de la evaluación técnica', () => {
    it('debe permitir al docente asignado reanudar la evaluación transicionando a EN_REVISION', async () => {
      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ area_actual: AREA_ACADEMICA_ID, codigo_expediente: 'EXP-2026-000412', solicitante_id: USUARIO_ESTUDIANTE }],
          })
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ id_usuario_docente: USUARIO_DOCENTE_1 }],
          })
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ estado_nuevo: 'SUBSANADO' }],
          })
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ data_type: 'bigint' }],
          })
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ operador_id: '990000001' }],
          })
          .mockResolvedValueOnce({ rowCount: 1 }) // insert movimiento
          .mockResolvedValueOnce({ rowCount: 1 }) // update expediente
          .mockResolvedValueOnce({ rowCount: 1 }) // update expediente_evaluador
          .mockResolvedValueOnce({ rowCount: 1, rows: [{ id_evento: "00000000-0000-4000-8000-000000000001" }] }), // outbox
      } as unknown as PoolClient;

      const resultado = await reanudarEvaluacionDocente(mockClient, EXPEDIENTE_ID, actorDocente);

      expect(resultado.ok).toBe(true);
      expect(resultado.estado).toBe('EN_REVISION');
    });
  });

  // HITO 7: Emisión de dictamen docente
  describe('HITO 7: Emisión formal del dictamen técnico docente', () => {
    it('debe emitir dictamen favorable, transicionar a ATENDIDO y concluir evaluación', async () => {
      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ area_actual: AREA_ACADEMICA_ID, codigo_expediente: 'EXP-2026-000412', solicitante_id: USUARIO_ESTUDIANTE }],
          })
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ id_asignacion: '50000000-0000-4000-8000-000000000001', id_usuario_docente: USUARIO_DOCENTE_1 }],
          })
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ estado_nuevo: 'EN_REVISION' }],
          })
          .mockResolvedValueOnce({ rowCount: 1 }) // update expediente_evaluador CONCLUIDA
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ data_type: 'bigint' }],
          })
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ operador_id: '990000001' }],
          })
          .mockResolvedValueOnce({ rowCount: 1 }) // insert movimiento ATENCION_TECNICA -> ATENDIDO
          .mockResolvedValueOnce({ rowCount: 1 }) // update expediente ATENDIDO
          .mockResolvedValueOnce({ rowCount: 1, rows: [{ id_evento: "00000000-0000-4000-8000-000000000001" }] }), // outbox DictamenDocenteEmitido
      } as unknown as PoolClient;

      const resultado = await emitirDictamenDocente(mockClient, EXPEDIENTE_ID, actorDocente, {
        resultado: 'FAVORABLE',
        fundamentacion: 'El postulante cumple plenamente con los requisitos académicos, creditaje y EFSRT.',
        recomendaciones: 'Proceder a elevar a Secretaría Académica para proyección resolutiva.',
        requisitosAprobados: [REQUISITO_ID],
      });

      expect(resultado.ok).toBe(true);
      expect(resultado.resultado).toBe('FAVORABLE');
      expect(resultado.estado).toBe('ATENDIDO');
      expect(resultado.concluidoEn).toBeDefined();
    });

    it('debe rechazar la emisión de dictamen por un docente no asignado', async () => {
      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ area_actual: AREA_ACADEMICA_ID, codigo_expediente: 'EXP-2026-000412', solicitante_id: USUARIO_ESTUDIANTE }],
          })
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ id_asignacion: '50000000-0000-4000-8000-000000000001', id_usuario_docente: USUARIO_DOCENTE_1 }],
          }),
      } as unknown as PoolClient;

      await expect(emitirDictamenDocente(mockClient, EXPEDIENTE_ID, actorDocenteAjeno, {
        resultado: 'FAVORABLE',
        fundamentacion: 'Intento no autorizado de dictamen',
        requisitosAprobados: [],
      })).rejects.toThrow(/Solo el docente evaluador asignado/);
    });

    it('debe emitir dictamen desfavorable, transicionar a ATENDIDO y registrar resultado en expediente_evaluador', async () => {
      const queryMock = vi.fn()
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ area_actual: AREA_ACADEMICA_ID, codigo_expediente: 'EXP-2026-000412', solicitante_id: USUARIO_ESTUDIANTE }],
        })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ id_asignacion: '50000000-0000-4000-8000-000000000001', id_usuario_docente: USUARIO_DOCENTE_1 }],
        })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ estado_nuevo: 'EN_REVISION' }],
        })
        .mockResolvedValueOnce({ rowCount: 1 }) // update expediente_evaluador CONCLUIDA
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ data_type: 'bigint' }],
        })
        .mockResolvedValueOnce({
          rowCount: 1,
          rows: [{ operador_id: '990000001' }],
        })
        .mockResolvedValueOnce({ rowCount: 1 }) // insert movimiento ATENCION_TECNICA -> ATENDIDO
        .mockResolvedValueOnce({ rowCount: 1 }) // update expediente ATENDIDO
        .mockResolvedValueOnce({ rowCount: 1, rows: [{ id_evento: "00000000-0000-4000-8000-000000000001" }] }); // outbox DictamenDocenteEmitido

      const mockClient = { query: queryMock } as unknown as PoolClient;

      const resultado = await emitirDictamenDocente(mockClient, EXPEDIENTE_ID, actorDocente, {
        resultado: 'DESFAVORABLE',
        fundamentacion: 'El postulante no cumple con los requisitos técnicos ni acreditación de prácticas pre-profesionales.',
        recomendaciones: 'Se sugiere subsanar en la siguiente convocatoria académica.',
        requisitosAprobados: [],
      });

      expect(resultado.ok).toBe(true);
      expect(resultado.resultado).toBe('DESFAVORABLE');
      expect(resultado.estado).toBe('ATENDIDO');
      expect(resultado.concluidoEn).toBeDefined();

      // Verificar que el resultado_evaluacion guardado en expediente_evaluador fue 'DESFAVORABLE'
      const callEval = queryMock.mock.calls.find((c: unknown[]) => typeof c[0] === 'string' && c[0].includes('UPDATE sigd_rut.expediente_evaluador'));
      expect(callEval).toBeDefined();
      expect(callEval![1][1]).toBe('DESFAVORABLE');

      // Verificar que el movimiento registrado contiene dictamen DESFAVORABLE
      const callMov = queryMock.mock.calls.find((c: unknown[]) => typeof c[0] === 'string' && c[0].includes('INSERT INTO sigd_rut.movimiento_tramite'));
      expect(callMov).toBeDefined();
      const datosMov = JSON.parse(callMov![1][2]);
      expect(datosMov.dictamen).toBe('DESFAVORABLE');
    });
  });

  // HITO 8: Supervisión del Coordinador
  describe('HITO 8: Herramienta de supervisión para Coordinador de Área', () => {
    it('debe permitir al coordinador listar las evaluaciones de su área con cálculo de días', async () => {
      const mockPool = {
        query: vi.fn().mockResolvedValueOnce({
          rowCount: 2,
          rows: [
            {
              id_asignacion: '50000000-0000-4000-8000-000000000001',
              expediente_id: EXPEDIENTE_ID,
              codigo_expediente: 'EXP-2026-000412',
              asunto: 'Titulación DSI',
              docente_nombre: 'Prof. Juan Pérez',
              docente_email: 'jperez@iestp.edu.pe',
              estado_evaluacion: 'EN_EVALUACION',
              estado_expediente: 'EN_REVISION',
              asignado_en: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // hace 2 días
              resultado_evaluacion: null,
            },
            {
              id_asignacion: '50000000-0000-4000-8000-000000000002',
              expediente_id: '30000000-0000-4000-8000-000000000002',
              codigo_expediente: 'EXP-2026-000413',
              asunto: 'Certificado Modular',
              docente_nombre: 'Prof. Ana Gómez',
              docente_email: 'agomez@iestp.edu.pe',
              estado_evaluacion: 'CONCLUIDA',
              estado_expediente: 'ATENDIDO',
              asignado_en: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
              resultado_evaluacion: 'FAVORABLE',
            },
          ],
        }),
      } as unknown as Pool;

      const resultado = await supervisarEvaluacionesArea(mockPool, actorCoordinador);

      expect(resultado.ok).toBe(true);
      expect(resultado.total).toBe(2);
      expect(resultado.evaluaciones[0].diasTranscurridos).toBe(2);
      expect(resultado.evaluaciones[1].resultadoEvaluacion).toBe('FAVORABLE');
    });

    it('debe impedir al coordinador de área consultar una unidad orgánica diferente a la suya', async () => {
      const mockPool = {} as unknown as Pool;
      const areaAjena = 'b0000000-0000-4000-8000-000000000099';

      await expect(supervisarEvaluacionesArea(mockPool, actorCoordinador, areaAjena))
        .rejects.toThrow(/El Coordinador de Área solo puede supervisar su propia unidad orgánica/);
    });

    it('debe rechazar a un docente que intente acceder a la supervisión general de área', async () => {
      const mockPool = {} as unknown as Pool;

      await expect(supervisarEvaluacionesArea(mockPool, actorDocente))
        .rejects.toThrow(/Los docentes evaluadores deben consultar sus expedientes asignados en su bandeja/);
    });
  });

  // SECCIÓN AUDITORÍA RBAC: Segregación institucional y blindaje contra bypass
  describe('AUDITORÍA RBAC: Segregación institucional de responsabilidades y exclusión de bypass', () => {
    const actorAdmin: ActorRutaDoc = {
      id: '80000000-0000-4000-8000-000000000001',
      roles: ['ADMINISTRADOR'],
      unidadOrganicaId: null,
      permisos: [
        { codigo: 'ADMIN_USUARIOS', ambito: 'GLOBAL', areaId: null },
      ],
    };

    it('debe rechazar al ADMINISTRADOR si intenta iniciar una evaluación técnica', async () => {
      const mockClient = {} as unknown as PoolClient;
      await expect(iniciarEvaluacion(mockClient, EXPEDIENTE_ID, actorAdmin))
        .rejects.toThrow(/solo los usuarios con rol institucional DOCENTE pueden ejecutar evaluaciones técnicas/);
    });

    it('debe rechazar al ADMINISTRADOR si intenta formular observaciones docentes', async () => {
      const mockClient = {} as unknown as PoolClient;
      await expect(registrarObservacionEvaluacion(mockClient, EXPEDIENTE_ID, actorAdmin, {
        motivo: 'Observación administrativa indebida',
        plazoDias: 3,
        requisitosObservados: [],
      })).rejects.toThrow(/solo los usuarios con rol institucional DOCENTE pueden ejecutar evaluaciones técnicas/);
    });

    it('debe rechazar al ADMINISTRADOR si intenta emitir un dictamen técnico', async () => {
      const mockClient = {} as unknown as PoolClient;
      await expect(emitirDictamenDocente(mockClient, EXPEDIENTE_ID, actorAdmin, {
        resultado: 'FAVORABLE',
        fundamentacion: 'Dictamen administrativo indebido',
        requisitosAprobados: [],
      })).rejects.toThrow(/solo los usuarios con rol institucional DOCENTE pueden ejecutar evaluaciones técnicas/);
    });

    it('debe rechazar al ADMINISTRADOR si intenta presentar una subsanación en nombre del estudiante', async () => {
      const mockClient = {} as unknown as PoolClient;
      await expect(registrarSubsanacionEstudiante(mockClient, EXPEDIENTE_ID, actorAdmin, {
        motivo: 'Subsanación en sustitución del alumno',
        documentosAdjuntos: [],
      })).rejects.toThrow(/El rol ADMINISTRADOR no puede actuar en sustitución del administrado/);
    });
  });
});
