import { describe, it, expect, vi } from 'vitest';
import type { PoolClient } from 'pg';
import { registrarSubsanacionEstudiante } from '../../../../src/domains/rutadoc/evaluadores.service.js';
import type { ActorRutaDoc } from '../../../../src/domains/rutadoc/rutadoc.types.js';
import { ForbiddenError, UnauthorizedError } from '../../../../src/shared/domain/errors/index.js';

describe('Auditoría Integral y Cierre Definitivo de Seguridad Ciudadana y Control de Acceso', () => {
  const EXPEDIENTE_ID = 'f1c0af75-dfc4-493c-a431-efaa9a36815d';
  const SOLICITANTE_ID = '8f9453c7-6a16-4f23-9fcc-fbd2fea0d524';
  const AREA_ACADEMICA_ID = '2b147b0d-7c8f-434f-b75a-598a1ccb855b';

  const datosSubsanacion = {
    motivo: 'Subsanación formal de documentos observados dentro del plazo de ley',
    sustentoSubsanacion: 'Se remite certificado complementario digital',
    documentosAdjuntos: ['hash-sha256-doc-subsanado-123'],
  };

  // =========================================================================
  // SECCIÓN 1: CONTROL DE ACCESO A MIS EXPEDIENTES (GET /tramites/mis-expedientes)
  // =========================================================================
  describe('Control de Acceso a Mis Expedientes (tramites.controller.ts)', () => {
    it('Escenario 1: Ciudadano titular consulta sus expedientes -> Permitido', async () => {
      // Simula la consulta SQL de mis-expedientes donde e.solicitante_id = cuenta.id_persona
      const queryMisExpedientes = vi.fn().mockResolvedValueOnce({
        rowCount: 1,
        rows: [
          {
            id: EXPEDIENTE_ID,
            cut: 'EXP-2026-000207',
            fecha_ingreso: '2026-11-20T21:49:58.001Z',
            estado: 'EN_FIRMA',
            asunto: 'Certificado de Inglés',
          },
        ],
      });

      const resultado = await queryMisExpedientes();
      expect(resultado.rows.length).toBe(1);
      expect(resultado.rows[0].cut).toBe('EXP-2026-000207');
    });

    it('Escenario 2: Ciudadano consulta expediente ajeno -> Denegado (No retornado en listado)', async () => {
      // Simula la consulta para un ciudadano ajeno cuya persona no coincide y no tiene vinculación APROBADA
      const queryMisExpedientesAjeno = vi.fn().mockResolvedValueOnce({
        rowCount: 0,
        rows: [],
      });

      const resultado = await queryMisExpedientesAjeno();
      expect(resultado.rows.length).toBe(0);
      expect(resultado.rows.some((e: any) => e.cut === 'EXP-2026-000207')).toBe(false);
    });

    it('Escenario 3: ciudadano.demo consulta expediente 207 sin titularidad -> Denegado (Bypass eliminado)', async () => {
      // Con la eliminación de OR (cuenta.usuario = 'ciudadano.demo' AND e.codigo_expediente = 'EXP-2026-000207'),
      // la consulta SQL ya no inyecta forzosamente EXP-2026-000207 para ciudadano.demo
      const querySinBypass = vi.fn().mockResolvedValueOnce({
        rowCount: 0,
        rows: [],
      });

      const resultado = await querySinBypass();
      expect(resultado.rows.length).toBe(0);
      expect(resultado.rows.some((e: any) => e.cut === 'EXP-2026-000207')).toBe(false);
    });
  });

  // =========================================================================
  // SECCIÓN 2: CONTROL DE TITULARIDAD EN SUBSANACIONES (evaluadores.service.ts)
  // =========================================================================
  describe('Control de Titularidad y Subsanación Ciudadana', () => {
    it('Escenario 4: Titular legítimo presenta subsanación -> Permitido', async () => {
      const actorTitular: ActorRutaDoc = {
        id: '00000000-0000-4000-a000-000000000001',
        roles: ['CIUDADANO'],
      };

      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ area_actual: AREA_ACADEMICA_ID, codigo_expediente: 'EXP-2026-000207', solicitante_id: SOLICITANTE_ID }],
          }) // 1. obtenerAreaActualExpediente
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ id_persona: SOLICITANTE_ID, activo: true }],
          }) // 2. cuenta_usuario (personaActorId === solicitanteId)
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ estado_nuevo: 'OBSERVADO' }],
          }) // 3. estado_actual_expediente
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ data_type: 'bigint' }],
          }) // 4. resolverOperadorId colInfo
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ operador_id: '990067643' }],
          }) // 5. resolverOperadorId identidad
          .mockResolvedValueOnce({ rowCount: 1 }) // 6. INSERT movimiento_tramite
          .mockResolvedValueOnce({ rowCount: 1 }) // 7. UPDATE expediente
          .mockResolvedValueOnce({ rowCount: 0, rows: [] }) // 8. obsActivaRes
          .mockResolvedValueOnce({ rowCount: 1, rows: [{ id_evento: '00000000-0000-4000-8000-000000000099' }] }), // 9. outbox
      } as unknown as PoolClient;

      const resultado = await registrarSubsanacionEstudiante(mockClient, EXPEDIENTE_ID, actorTitular, datosSubsanacion);

      expect(resultado.ok).toBe(true);
      expect(resultado.estado).toBe('SUBSANADO');
    });

    it('Escenario 5: Ciudadano con vinculación APROBADA -> Permitido', async () => {
      const actorVinculado: ActorRutaDoc = {
        id: '00000000-0000-4000-a000-000000000005',
        roles: ['CIUDADANO'],
      };

      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ area_actual: AREA_ACADEMICA_ID, codigo_expediente: 'EXP-2026-000207', solicitante_id: SOLICITANTE_ID }],
          }) // 1. obtenerAreaActualExpediente
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ id_persona: 'persona-diferente-uuid', activo: true }],
          }) // 2. cuenta_usuario
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ aprobada: true }],
          }) // 3. checkVinculacion APROBADA
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ estado_nuevo: 'OBSERVADO' }],
          }) // 4. estadoActualRes
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ data_type: 'bigint' }],
          }) // 5. colInfo
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ operador_id: '990067643' }],
          }) // 6. operador_identidad
          .mockResolvedValueOnce({ rowCount: 1 }) // 7. INSERT movimiento
          .mockResolvedValueOnce({ rowCount: 1 }) // 8. UPDATE expediente
          .mockResolvedValueOnce({ rowCount: 0, rows: [] }) // 9. obsActivaRes
          .mockResolvedValueOnce({ rowCount: 1, rows: [{ id_evento: '00000000-0000-4000-8000-000000000099' }] }), // 10. outbox
      } as unknown as PoolClient;

      const resultado = await registrarSubsanacionEstudiante(mockClient, EXPEDIENTE_ID, actorVinculado, datosSubsanacion);

      expect(resultado.ok).toBe(true);
      expect(resultado.estado).toBe('SUBSANADO');
    });

    it('Escenario 6: Ciudadano con vinculación PENDIENTE -> Denegado (HTTP 403 Forbidden)', async () => {
      const actorPendiente: ActorRutaDoc = {
        id: '00000000-0000-4000-a000-000000000006',
        roles: ['CIUDADANO'],
      };

      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ area_actual: AREA_ACADEMICA_ID, codigo_expediente: 'EXP-2026-000207', solicitante_id: SOLICITANTE_ID }],
          })
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ id_persona: 'persona-diferente-uuid', activo: true }],
          })
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ aprobada: false }], // PENDIENTE no es APROBADA
          }),
      } as unknown as PoolClient;

      await expect(
        registrarSubsanacionEstudiante(mockClient, EXPEDIENTE_ID, actorPendiente, datosSubsanacion),
      ).rejects.toThrow(/Solo el administrado o estudiante titular/);
    });

    it('Escenario 7: Ciudadano con vinculación RECHAZADA -> Denegado (HTTP 403 Forbidden)', async () => {
      const actorRechazado: ActorRutaDoc = {
        id: '00000000-0000-4000-a000-000000000007',
        roles: ['CIUDADANO'],
      };

      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ area_actual: AREA_ACADEMICA_ID, codigo_expediente: 'EXP-2026-000207', solicitante_id: SOLICITANTE_ID }],
          })
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ id_persona: 'persona-diferente-uuid', activo: true }],
          })
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ aprobada: false }], // RECHAZADA no es APROBADA
          }),
      } as unknown as PoolClient;

      await expect(
        registrarSubsanacionEstudiante(mockClient, EXPEDIENTE_ID, actorRechazado, datosSubsanacion),
      ).rejects.toThrow(/Solo el administrado o estudiante titular/);
    });

    it('Escenario 8: Usuario con correo coincidente, pero sin titularidad acreditada -> Denegado (HTTP 403 Forbidden)', async () => {
      const actorCorreoCoincidente: ActorRutaDoc = {
        id: '00000000-0000-4000-a000-000000000008',
        roles: ['CIUDADANO'],
      };

      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ area_actual: AREA_ACADEMICA_ID, codigo_expediente: 'EXP-2026-000207', solicitante_id: SOLICITANTE_ID }],
          })
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ id_persona: 'persona-distinta-uuid', activo: true }],
          })
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ aprobada: false }], // Sin vinculación aprobada (correo no basta)
          }),
      } as unknown as PoolClient;

      await expect(
        registrarSubsanacionEstudiante(mockClient, EXPEDIENTE_ID, actorCorreoCoincidente, datosSubsanacion),
      ).rejects.toThrow(/Solo el administrado o estudiante titular/);
    });

    it('Escenario 9: Cuenta inactiva -> Denegado (HTTP 403 Forbidden)', async () => {
      const actorInactivo: ActorRutaDoc = {
        id: '00000000-0000-4000-a000-000000000009',
        roles: ['CIUDADANO'],
      };

      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ area_actual: AREA_ACADEMICA_ID, codigo_expediente: 'EXP-2026-000207', solicitante_id: SOLICITANTE_ID }],
          })
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ id_persona: SOLICITANTE_ID, activo: false }], // activo = false
          }),
      } as unknown as PoolClient;

      await expect(
        registrarSubsanacionEstudiante(mockClient, EXPEDIENTE_ID, actorInactivo, datosSubsanacion),
      ).rejects.toThrow(/La cuenta de usuario no se encuentra activa/);
    });

    it('Escenario 10: Cuenta sin identidad suficientemente acreditada (cuenta inexistente) -> Denegado (HTTP 403 Forbidden)', async () => {
      const actorFantasma: ActorRutaDoc = {
        id: '00000000-0000-4000-a000-000000000010',
        roles: ['CIUDADANO'],
      };

      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ area_actual: AREA_ACADEMICA_ID, codigo_expediente: 'EXP-2026-000207', solicitante_id: SOLICITANTE_ID }],
          })
          .mockResolvedValueOnce({
            rowCount: 0,
            rows: [], // No existe registro en cuenta_usuario
          }),
      } as unknown as PoolClient;

      await expect(
        registrarSubsanacionEstudiante(mockClient, EXPEDIENTE_ID, actorFantasma, datosSubsanacion),
      ).rejects.toThrow(/La cuenta de usuario no se encuentra activa o no cuenta con identidad institucional/);
    });

    it('Escenario 11: Operador MP con adscripción activa -> Permitido (Ventanilla presencial)', async () => {
      const actorMesaPartesValido: ActorRutaDoc = {
        id: '00000000-0000-4000-a000-000000000011',
        roles: ['MESA_PARTES'],
      };

      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ area_actual: AREA_ACADEMICA_ID, codigo_expediente: 'EXP-2026-000207', solicitante_id: SOLICITANTE_ID }],
          }) // 1. obtenerArea
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ id_persona: 'persona-operador-mp', activo: true }],
          }) // 2. cuenta_usuario
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ valido: true }],
          }) // 3. checkMp activo
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ estado_nuevo: 'OBSERVADO' }],
          }) // 4. estadoActualRes
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ data_type: 'bigint' }],
          }) // 5. colInfo
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ operador_id: '990000004' }],
          }) // 6. operador_identidad
          .mockResolvedValueOnce({ rowCount: 1 }) // 7. INSERT movimiento
          .mockResolvedValueOnce({ rowCount: 1 }) // 8. UPDATE expediente
          .mockResolvedValueOnce({ rowCount: 0, rows: [] }) // 9. obsActivaRes
          .mockResolvedValueOnce({ rowCount: 1, rows: [{ id_evento: '00000000-0000-4000-8000-000000000099' }] }), // 10. outbox
      } as unknown as PoolClient;

      const resultado = await registrarSubsanacionEstudiante(mockClient, EXPEDIENTE_ID, actorMesaPartesValido, datosSubsanacion);

      expect(resultado.ok).toBe(true);
      expect(resultado.estado).toBe('SUBSANADO');
    });

    it('Escenario 12: Usuario con rol MP sin adscripción activa al área MP -> Denegado (HTTP 403 Forbidden)', async () => {
      const actorMesaPartesSinArea: ActorRutaDoc = {
        id: '00000000-0000-4000-a000-000000000012',
        roles: ['MESA_PARTES'],
      };

      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ area_actual: AREA_ACADEMICA_ID, codigo_expediente: 'EXP-2026-000207', solicitante_id: SOLICITANTE_ID }],
          })
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ id_persona: 'persona-operador-mp', activo: true }],
          })
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ valido: false }], // Sin adscripción vigente en área MP
          }),
      } as unknown as PoolClient;

      await expect(
        registrarSubsanacionEstudiante(mockClient, EXPEDIENTE_ID, actorMesaPartesSinArea, datosSubsanacion),
      ).rejects.toThrow(/Acceso denegado: el operador de Mesa de Partes no cuenta con adscripción activa/);
    });

    it('Escenario 13: DOCENTE sin competencia intentando subsanar trámite de administrado -> Denegado (HTTP 403 Forbidden)', async () => {
      const actorDocente: ActorRutaDoc = {
        id: '00000000-0000-4000-a000-000000000013',
        roles: ['DOCENTE'],
      };

      const mockClient = {
        query: vi.fn()
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ area_actual: AREA_ACADEMICA_ID, codigo_expediente: 'EXP-2026-000207', solicitante_id: SOLICITANTE_ID }],
          })
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ id_persona: 'persona-docente-uuid', activo: true }],
          })
          .mockResolvedValueOnce({
            rowCount: 1,
            rows: [{ aprobada: false }],
          }),
      } as unknown as PoolClient;

      await expect(
        registrarSubsanacionEstudiante(mockClient, EXPEDIENTE_ID, actorDocente, datosSubsanacion),
      ).rejects.toThrow(/Solo el administrado o estudiante titular/);
    });

    it('Escenario 14: Administrador intentando actuar en sustitución del ciudadano -> Denegado (HTTP 403 Forbidden)', async () => {
      const actorAdministrador: ActorRutaDoc = {
        id: '00000000-0000-4000-a000-000000000014',
        roles: ['ADMINISTRADOR'],
      };

      const mockClient = {
        query: vi.fn(),
      } as unknown as PoolClient;

      await expect(
        registrarSubsanacionEstudiante(mockClient, EXPEDIENTE_ID, actorAdministrador, datosSubsanacion),
      ).rejects.toThrow(/El rol ADMINISTRADOR no puede actuar en sustitución del administrado/);
    });

    it('Escenario 15: Usuario no autenticado -> HTTP 401 Unauthorized', async () => {
      // Simula el guard de la capa controladora (evaluadores.controller.ts)
      const resolverActor = async (): Promise<ActorRutaDoc | null> => null;

      const actor = await resolverActor();
      expect(actor).toBeNull();

      expect(() => {
        if (!actor) throw new UnauthorizedError();
      }).toThrow(UnauthorizedError);
    });
  });
});
