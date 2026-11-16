import { describe, expect, it, vi } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import {
  asignarEvaluador,
  reasignarEvaluador,
  reasignarMasivo,
  obtenerEvaluadorActivo,
  listarHistorialEvaluadores,
  listarDocentesElegibles,
} from '../../../../src/domains/rutadoc/evaluadores.service.js';
import type { ActorRutaDoc } from '../../../../src/domains/rutadoc/rutadoc.types.js';

const EXPEDIENTE_ID = '30000000-0000-4000-8000-000000000001';
const AREA_ACADEMICA_ID = 'a0000000-0000-4000-8000-000000000001';
const USUARIO_COORDINADOR = '10000000-0000-4000-8000-000000000001';
const USUARIO_DOCENTE_1 = '20000000-0000-4000-8000-000000000001';
const USUARIO_DOCENTE_2 = '20000000-0000-4000-8000-000000000002';
const PERSONA_DOCENTE_1 = '50000000-0000-4000-8000-000000000001';
const PERSONA_DOCENTE_2 = '50000000-0000-4000-8000-000000000002';
const PERSONA_SOLICITANTE = '90000000-0000-4000-8000-000000000001';

const actorCoordinador: ActorRutaDoc = {
  id: USUARIO_COORDINADOR,
  roles: ['COORDINADOR_AREA'],
  unidadOrganicaId: AREA_ACADEMICA_ID,
  permisos: [
    { codigo: 'EXPEDIENTE_ASIGNAR', ambito: 'AREA', areaId: AREA_ACADEMICA_ID },
    { codigo: 'EXPEDIENTE_REASIGNAR', ambito: 'AREA', areaId: AREA_ACADEMICA_ID },
    { codigo: 'EXPEDIENTE_LEER', ambito: 'GLOBAL', areaId: null },
  ],
};

const actorSinPermiso: ActorRutaDoc = {
  id: '70000000-0000-4000-8000-000000000001',
  roles: ['DOCENTE'],
  unidadOrganicaId: AREA_ACADEMICA_ID,
  permisos: [
    { codigo: 'EXPEDIENTE_EVALUAR', ambito: 'AREA', areaId: AREA_ACADEMICA_ID },
  ],
};

const actorAdministrador: ActorRutaDoc = {
  id: '80000000-0000-4000-8000-000000000001',
  roles: ['ADMINISTRADOR'],
  unidadOrganicaId: null,
  permisos: [
    { codigo: 'ADMIN_USUARIOS', ambito: 'GLOBAL', areaId: null },
    { codigo: 'CONFIG_SISTEMA', ambito: 'GLOBAL', areaId: null },
  ],
};

const actorGestorApoyoArea: ActorRutaDoc = {
  id: '80000000-0000-4000-8000-000000000002',
  roles: ['GESTOR_APOYO_AREA'],
  unidadOrganicaId: AREA_ACADEMICA_ID,
  permisos: [
    { codigo: 'EXPEDIENTE_LEER', ambito: 'AREA', areaId: AREA_ACADEMICA_ID },
  ],
};

const actorJefeUnidadAcademica: ActorRutaDoc = {
  id: '80000000-0000-4000-8000-000000000003',
  roles: ['JEFE_UNIDAD_ACADEMICA'],
  unidadOrganicaId: AREA_ACADEMICA_ID,
  permisos: [
    { codigo: 'EXPEDIENTE_ASIGNAR', ambito: 'AREA', areaId: AREA_ACADEMICA_ID },
    { codigo: 'EXPEDIENTE_REASIGNAR', ambito: 'AREA', areaId: AREA_ACADEMICA_ID },
    { codigo: 'EXPEDIENTE_LEER', ambito: 'AREA', areaId: AREA_ACADEMICA_ID },
  ],
};

const actorCoordinadorOtraArea: ActorRutaDoc = {
  id: '80000000-0000-4000-8000-000000000004',
  roles: ['COORDINADOR_AREA'],
  unidadOrganicaId: 'a0000000-0000-4000-8000-000000000099',
  permisos: [
    { codigo: 'EXPEDIENTE_ASIGNAR', ambito: 'AREA', areaId: 'a0000000-0000-4000-8000-000000000099' },
    { codigo: 'EXPEDIENTE_REASIGNAR', ambito: 'AREA', areaId: 'a0000000-0000-4000-8000-000000000099' },
  ],
};

function crearMockClient(overrides?: {
  evaluadorActivo?: { id_asignacion: string; id_usuario_docente: string } | null;
  docentePersona?: string;
  docenteActivo?: boolean;
}) {
  return {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      // 1. Obtener área y datos del expediente
      if (sql.includes('FROM sigd_tra.expediente e')) {
        return {
          rowCount: 1,
          rows: [{
            area_actual: AREA_ACADEMICA_ID,
            codigo_expediente: 'EXP-2026-001',
            solicitante_id: PERSONA_SOLICITANTE,
          }],
        };
      }

      // 2. Consulta de evaluador activo en expediente_evaluador
      if (sql.includes('FROM sigd_rut.expediente_evaluador') && sql.includes('activo = TRUE')) {
        if (overrides?.evaluadorActivo) {
          return {
            rowCount: 1,
            rows: [overrides.evaluadorActivo],
          };
        }
        return { rowCount: 0, rows: [] };
      }

      // 3. Consulta de cuenta de docente
      if (sql.includes('FROM sigd_auth.cuenta_usuario WHERE id_usuario = $1::uuid')) {
        return {
          rowCount: 1,
          rows: [{
            id_persona: overrides?.docentePersona ?? PERSONA_DOCENTE_1,
            activo: overrides?.docenteActivo ?? true,
          }],
        };
      }

      // 4. Inserción de asignación
      if (sql.includes('INSERT INTO sigd_rut.expediente_evaluador')) {
        return {
          rowCount: 1,
          rows: [{
            id_asignacion: '88888888-0000-4000-8000-000000000001',
            asignado_en: new Date('2026-11-14T10:00:00Z'),
          }],
        };
      }

      // 5. Desactivación de evaluador (UPDATE)
      if (sql.includes('UPDATE sigd_rut.expediente_evaluador')) {
        return { rowCount: 1, rows: [] };
      }

      // 6. Outbox
      if (sql.includes('sigd_audit')) {
        return { rowCount: 1, rows: [{ id_evento: 'event-001' }] };
      }

      return { rowCount: 0, rows: [] };
    }),
  } as unknown as PoolClient;
}

describe('RutaDoc - Servicio de Gestión de Evaluadores y Asignaciones', () => {
  describe('asignarEvaluador (Asignación Inicial)', () => {
    it('asigna un docente evaluador exitosamente cuando no existe asignación activa previa', async () => {
      const mockClient = crearMockClient();

      const res = await asignarEvaluador(
        mockClient,
        EXPEDIENTE_ID,
        actorCoordinador,
        {
          idUsuarioDocente: USUARIO_DOCENTE_1,
          motivoAsignacion: 'Designación para evaluación de proyecto de titulación',
          observaciones: 'Revisión técnica de expediente',
        },
      );

      expect(res.ok).toBe(true);
      expect(res.idAsignacion).toBe('88888888-0000-4000-8000-000000000001');
      expect(res.mensaje).toContain('exitosamente');

      const insertCall = (mockClient.query as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
        ([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO sigd_rut.expediente_evaluador'),
      );
      expect(insertCall).toBeDefined();
      expect(insertCall![1]).toEqual([
        EXPEDIENTE_ID,
        USUARIO_DOCENTE_1,
        AREA_ACADEMICA_ID,
        USUARIO_COORDINADOR,
        'Designación para evaluación de proyecto de titulación',
        'Revisión técnica de expediente',
      ]);
    });

    it('rechaza la asignación si el actor no cuenta con el permiso EXPEDIENTE_ASIGNAR en el área', async () => {
      const mockClient = crearMockClient();

      await expect(
        asignarEvaluador(mockClient, EXPEDIENTE_ID, actorSinPermiso, {
          idUsuarioDocente: USUARIO_DOCENTE_1,
          motivoAsignacion: 'Asignación no autorizada',
        }),
      ).rejects.toThrow(/No cuenta con facultades/);
    });

    it('rechaza con 403 cuando ADMINISTRADOR intenta asignar evaluador (sin permiso EXPEDIENTE_ASIGNAR)', async () => {
      const mockClient = crearMockClient();

      await expect(
        asignarEvaluador(mockClient, EXPEDIENTE_ID, actorAdministrador, {
          idUsuarioDocente: USUARIO_DOCENTE_1,
          motivoAsignacion: 'Intento de asignación por administrador',
        }),
      ).rejects.toThrow(/No cuenta con facultades/);
    });

    it('rechaza con 403 cuando GESTOR_APOYO_AREA intenta asignar evaluadores', async () => {
      const mockClient = crearMockClient();

      await expect(
        asignarEvaluador(mockClient, EXPEDIENTE_ID, actorGestorApoyoArea, {
          idUsuarioDocente: USUARIO_DOCENTE_1,
          motivoAsignacion: 'Intento de asignación por gestor de apoyo',
        }),
      ).rejects.toThrow(/No cuenta con facultades/);
    });

    it('rechaza con 403 cuando actor autorizado intenta asignar fuera de su ámbito territorial/área', async () => {
      const mockClient = crearMockClient();

      await expect(
        asignarEvaluador(mockClient, EXPEDIENTE_ID, actorCoordinadorOtraArea, {
          idUsuarioDocente: USUARIO_DOCENTE_1,
          motivoAsignacion: 'Intento de asignación fuera de su área',
        }),
      ).rejects.toThrow(/No cuenta con facultades/);
    });

    it('permite a JEFE_UNIDAD_ACADEMICA asignar evaluador dentro de su área autorizada', async () => {
      const mockClient = crearMockClient();

      const res = await asignarEvaluador(
        mockClient,
        EXPEDIENTE_ID,
        actorJefeUnidadAcademica,
        {
          idUsuarioDocente: USUARIO_DOCENTE_1,
          motivoAsignacion: 'Designación aprobada por Jefatura Académica',
          observaciones: 'Evaluación técnica de rigor',
        },
      );

      expect(res.ok).toBe(true);
      expect(res.idAsignacion).toBeDefined();
    });

    it('rechaza la asignación si el expediente ya tiene un evaluador activo', async () => {
      const mockClient = crearMockClient({
        evaluadorActivo: { id_asignacion: 'existente-id', id_usuario_docente: USUARIO_DOCENTE_1 },
      });

      await expect(
        asignarEvaluador(mockClient, EXPEDIENTE_ID, actorCoordinador, {
          idUsuarioDocente: USUARIO_DOCENTE_1,
          motivoAsignacion: 'Segunda asignación simultánea',
        }),
      ).rejects.toThrow(/El expediente ya cuenta con un evaluador activo/);
    });

    it('rechaza por conflicto de interés si el docente designado es el mismo solicitante del trámite', async () => {
      const mockClient = crearMockClient({
        docentePersona: PERSONA_SOLICITANTE, // Misma persona que solicitante
      });

      await expect(
        asignarEvaluador(mockClient, EXPEDIENTE_ID, actorCoordinador, {
          idUsuarioDocente: USUARIO_DOCENTE_1,
          motivoAsignacion: 'Auto-evaluación indebida',
        }),
      ).rejects.toThrow(/Conflicto de interés/);
    });
  });

  describe('reasignarEvaluador (Reasignación Individual)', () => {
    it('desactiva el evaluador previo y crea la nueva asignación enlazada con justificación obligatoria', async () => {
      const mockClient = crearMockClient({
        evaluadorActivo: { id_asignacion: 'asig-previa-001', id_usuario_docente: USUARIO_DOCENTE_1 },
        docentePersona: PERSONA_DOCENTE_2,
      });

      const res = await reasignarEvaluador(
        mockClient,
        EXPEDIENTE_ID,
        actorCoordinador,
        {
          idNuevoDocente: USUARIO_DOCENTE_2,
          motivoAsignacion: 'Reasignación por licencia médica del evaluador titular',
          justificacionReasignacion: 'El evaluador anterior presentó descanso médico por 15 días.',
        },
      );

      expect(res.ok).toBe(true);
      expect(res.evaluadorAnteriorId).toBe(USUARIO_DOCENTE_1);
      expect(res.nuevoEvaluadorId).toBe(USUARIO_DOCENTE_2);

      // Verificar que se desactivó la asignación anterior
      const updateCall = (mockClient.query as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
        ([sql]) => typeof sql === 'string' && sql.includes('UPDATE sigd_rut.expediente_evaluador'),
      );
      expect(updateCall).toBeDefined();
      expect(updateCall![0]).toContain("estado_evaluacion = 'REASIGNADA'");

      // Verificar que se insertó la nueva asignación enlazada
      const insertCall = (mockClient.query as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
        ([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO sigd_rut.expediente_evaluador'),
      );
      expect(insertCall).toBeDefined();
      expect(insertCall![0]).toContain('TRUE'); // es_reasignacion = TRUE en SQL
      expect(insertCall![1][5]).toBe('El evaluador anterior presentó descanso médico por 15 días.'); // justificacion
      expect(insertCall![1][6]).toBe('asig-previa-001'); // asignacion_anterior_id
    });

    it('falla si la justificación de reasignación es menor a 10 caracteres', async () => {
      const mockClient = crearMockClient();

      await expect(
        reasignarEvaluador(mockClient, EXPEDIENTE_ID, actorCoordinador, {
          idNuevoDocente: USUARIO_DOCENTE_2,
          motivoAsignacion: 'Reasignar',
          justificacionReasignacion: 'Corta',
        }),
      ).rejects.toThrow(/al menos 10 caracteres|no son válidos/);
    });

    it('falla si se intenta reasignar al mismo docente que ya está asignado', async () => {
      const mockClient = crearMockClient({
        evaluadorActivo: { id_asignacion: 'asig-previa-001', id_usuario_docente: USUARIO_DOCENTE_1 },
      });

      await expect(
        reasignarEvaluador(mockClient, EXPEDIENTE_ID, actorCoordinador, {
          idNuevoDocente: USUARIO_DOCENTE_1, // Mismo docente
          motivoAsignacion: 'Reasignación al mismo',
          justificacionReasignacion: 'Justificación válida de más de diez caracteres.',
        }),
      ).rejects.toThrow(/El nuevo evaluador debe ser diferente|no son válidos/);
    });

    it('rechaza con 403 cuando ADMINISTRADOR intenta reasignar evaluador (sin permiso EXPEDIENTE_REASIGNAR)', async () => {
      const mockClient = crearMockClient({
        evaluadorActivo: { id_asignacion: 'asig-previa-001', id_usuario_docente: USUARIO_DOCENTE_1 },
      });

      await expect(
        reasignarEvaluador(mockClient, EXPEDIENTE_ID, actorAdministrador, {
          idNuevoDocente: USUARIO_DOCENTE_2,
          motivoAsignacion: 'Reasignación por administrador',
          justificacionReasignacion: 'Justificación válida de reasignación por motivos de gestión.',
        }),
      ).rejects.toThrow(/No cuenta con facultades/);
    });

    it('rechaza con 403 cuando JEFE_UNIDAD_ACADEMICA intenta reasignar en un área fuera de su competencia', async () => {
      const mockClient = crearMockClient({
        evaluadorActivo: { id_asignacion: 'asig-previa-001', id_usuario_docente: USUARIO_DOCENTE_1 },
      });

      const jefeOtraArea: ActorRutaDoc = {
        ...actorJefeUnidadAcademica,
        unidadOrganicaId: 'a0000000-0000-4000-8000-000000000099',
        permisos: [
          { codigo: 'EXPEDIENTE_REASIGNAR', ambito: 'AREA', areaId: 'a0000000-0000-4000-8000-000000000099' },
        ],
      };

      await expect(
        reasignarEvaluador(mockClient, EXPEDIENTE_ID, jefeOtraArea, {
          idNuevoDocente: USUARIO_DOCENTE_2,
          motivoAsignacion: 'Reasignación en área no autorizada',
          justificacionReasignacion: 'Justificación válida de reasignación con longitud suficiente.',
        }),
      ).rejects.toThrow(/No cuenta con facultades/);
    });
  });

  describe('reasignarMasivo (Reasignación en Lote)', () => {
    it('procesa un lote de múltiples expedientes reportando el resultado de cada uno', async () => {
      const exp1 = '30000000-0000-4000-8000-000000000001';
      const exp2 = '30000000-0000-4000-8000-000000000002';

      const mockClient = crearMockClient({
        evaluadorActivo: { id_asignacion: 'asig-lote-previa', id_usuario_docente: USUARIO_DOCENTE_1 },
        docentePersona: PERSONA_DOCENTE_2,
      });

      const res = await reasignarMasivo(mockClient, actorCoordinador, {
        expedienteIds: [exp1, exp2],
        idNuevoDocente: USUARIO_DOCENTE_2,
        motivoAsignacion: 'Reasignación masiva de expedientes del programa académico',
        justificacionReasignacion: 'Redistribución de carga lectiva autorizada por Jefatura Académica.',
      });

      expect(res.ok).toBe(true);
      expect(res.total).toBe(2);
      expect(res.exitosos).toBe(2);
      expect(res.fallidos).toBe(0);
      expect(res.resultados.length).toBe(2);
      expect(res.resultados[0].ok).toBe(true);
      expect(res.resultados[1].ok).toBe(true);
    });
  });

  describe('Inmutabilidad de Custodia y Estado Procesal', () => {
    it('constata que la asignación/reasignación opera exclusivamente sobre expediente_evaluador sin mutar custodia ni estado procesal', async () => {
      const queriesEjecutadas: string[] = [];
      const mockClient = {
        query: vi.fn(async (sql: string) => {
          queriesEjecutadas.push(sql);
          if (sql.includes('FROM sigd_tra.expediente e')) {
            return {
              rowCount: 1,
              rows: [{
                area_actual: AREA_ACADEMICA_ID,
                codigo_expediente: 'EXP-2026-001',
                solicitante_id: PERSONA_SOLICITANTE,
              }],
            };
          }
          if (sql.includes('FROM sigd_rut.expediente_evaluador WHERE expediente_id = $1::uuid AND activo = TRUE')) {
            return { rowCount: 0, rows: [] };
          }
          if (sql.includes('FROM sigd_auth.cuenta_usuario WHERE id_usuario = $1::uuid')) {
            return { rowCount: 1, rows: [{ id_persona: PERSONA_DOCENTE_1, activo: true }] };
          }
          if (sql.includes('INSERT INTO sigd_rut.expediente_evaluador')) {
            return {
              rowCount: 1,
              rows: [{ id_asignacion: '888', asignado_en: new Date() }],
            };
          }
          return { rowCount: 0, rows: [] };
        }),
      } as unknown as PoolClient;

      await asignarEvaluador(mockClient, EXPEDIENTE_ID, actorCoordinador, {
        idUsuarioDocente: USUARIO_DOCENTE_1,
        motivoAsignacion: 'Evaluación técnica de suficiencia',
      });

      // Asegurar que NO se ejecutó ningún UPDATE sobre estado_actual_expediente, expediente_custodia ni tramite
      const tocoCustodia = queriesEjecutadas.some((q) => q.includes('sigd_rut.expediente_custodia'));
      const tocoEstado = queriesEjecutadas.some((q) => q.includes('sigd_rut.estado_actual_expediente') && q.includes('UPDATE'));
      const tocoFsm = queriesEjecutadas.some((q) => q.includes('transicion_estado_tramite'));

      expect(tocoCustodia).toBe(false);
      expect(tocoEstado).toBe(false);
      expect(tocoFsm).toBe(false);
    });
  });
});
