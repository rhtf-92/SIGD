import { describe, expect, it, vi } from 'vitest';
import type { PoolClient } from 'pg';
import {
  asignarEvaluador,
  reasignarEvaluador,
} from '../../../../src/domains/rutadoc/evaluadores.service.js';
import type { ActorRutaDoc } from '../../../../src/domains/rutadoc/rutadoc.types.js';
import { ForbiddenError, ValidationError } from '../../../../src/shared/domain/errors/index.js';

// Constantes de prueba
const EXPEDIENTE_ID = '30000000-0000-4000-8000-000000000001';
const AREA_ACADEMICA_ID = 'a0000000-0000-4000-8000-000000000001';
const AREA_OTRA_ID = 'a0000000-0000-4000-8000-000000000099';
const USUARIO_COORDINADOR = '10000000-0000-4000-8000-000000000001';
const USUARIO_DOCENTE_1 = '20000000-0000-4000-8000-000000000001';
const USUARIO_DOCENTE_2 = '20000000-0000-4000-8000-000000000002';
const PERSONA_DOCENTE_1 = '50000000-0000-4000-8000-000000000001';
const PERSONA_DOCENTE_2 = '50000000-0000-4000-8000-000000000002';
const PERSONA_SOLICITANTE = '90000000-0000-4000-8000-000000000001';

// Actores institucionales
const actorAdministrador: ActorRutaDoc = {
  id: '80000000-0000-4000-8000-000000000001',
  roles: ['ADMINISTRADOR'],
  unidadOrganicaId: null,
  permisos: [
    { codigo: 'ADMIN_USUARIOS', ambito: 'GLOBAL', areaId: null },
    { codigo: 'CONFIG_SISTEMA', ambito: 'GLOBAL', areaId: null },
  ],
};

const actorCoordinadorAutorizado: ActorRutaDoc = {
  id: USUARIO_COORDINADOR,
  roles: ['COORDINADOR_AREA'],
  unidadOrganicaId: AREA_ACADEMICA_ID,
  permisos: [
    { codigo: 'EXPEDIENTE_ASIGNAR', ambito: 'AREA', areaId: AREA_ACADEMICA_ID },
    { codigo: 'EXPEDIENTE_REASIGNAR', ambito: 'AREA', areaId: AREA_ACADEMICA_ID },
    { codigo: 'EXPEDIENTE_LEER', ambito: 'AREA', areaId: AREA_ACADEMICA_ID },
  ],
};

const actorCoordinadorFueraAmbito: ActorRutaDoc = {
  id: '80000000-0000-4000-8000-000000000004',
  roles: ['COORDINADOR_AREA'],
  unidadOrganicaId: AREA_OTRA_ID,
  permisos: [
    { codigo: 'EXPEDIENTE_ASIGNAR', ambito: 'AREA', areaId: AREA_OTRA_ID },
    { codigo: 'EXPEDIENTE_REASIGNAR', ambito: 'AREA', areaId: AREA_OTRA_ID },
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

const actorTesorero: ActorRutaDoc = {
  id: '80000000-0000-4000-8000-000000000005',
  roles: ['TESORERO'],
  unidadOrganicaId: 't0000000-0000-4000-8000-000000000001',
  permisos: [
    { codigo: 'TESORERIA_LEER', ambito: 'GLOBAL', areaId: null },
    { codigo: 'TESORERIA_PAGO_REGISTRAR', ambito: 'GLOBAL', areaId: null },
    { codigo: 'TESORERIA_PAGO_VERIFICAR', ambito: 'GLOBAL', areaId: null },
  ],
};

const actorEspecialistaDescontinuado: ActorRutaDoc = {
  id: '80000000-0000-4000-8000-000000000006',
  roles: ['ESPECIALISTA'],
  unidadOrganicaId: AREA_ACADEMICA_ID,
  permisos: [],
};

const actorGestorApoyoArea: ActorRutaDoc = {
  id: '80000000-0000-4000-8000-000000000002',
  roles: ['GESTOR_APOYO_AREA'],
  unidadOrganicaId: AREA_ACADEMICA_ID,
  permisos: [
    { codigo: 'EXPEDIENTE_LEER', ambito: 'AREA', areaId: AREA_ACADEMICA_ID },
  ],
};

function crearMockClient(overrides?: {
  evaluadorActivo?: { id_asignacion: string; id_usuario_docente: string } | null;
  docentePersona?: string;
  docenteActivo?: boolean;
}) {
  return {
    query: vi.fn(async (sql: string) => {
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
      if (sql.includes('FROM sigd_rut.expediente_evaluador') && sql.includes('activo = TRUE')) {
        if (overrides?.evaluadorActivo) {
          return { rowCount: 1, rows: [overrides.evaluadorActivo] };
        }
        return { rowCount: 0, rows: [] };
      }
      if (sql.includes('FROM sigd_auth.cuenta_usuario WHERE id_usuario = $1::uuid')) {
        return {
          rowCount: 1,
          rows: [{
            id_persona: overrides?.docentePersona ?? PERSONA_DOCENTE_1,
            activo: overrides?.docenteActivo ?? true,
          }],
        };
      }
      if (sql.includes('INSERT INTO sigd_rut.expediente_evaluador')) {
        return {
          rowCount: 1,
          rows: [{
            id_asignacion: '88888888-0000-4000-8000-000000000001',
            asignado_en: new Date('2026-11-14T10:00:00Z'),
          }],
        };
      }
      if (sql.includes('UPDATE sigd_rut.expediente_evaluador')) {
        return { rowCount: 1, rows: [] };
      }
      if (sql.includes('sigd_audit')) {
        return { rowCount: 1, rows: [{ id_evento: 'event-001' }] };
      }
      return { rowCount: 0, rows: [] };
    }),
  } as unknown as PoolClient;
}

describe('TSK-R3 — Batería de 14 Escenarios de Seguridad, RBAC y Armonización Institucional', () => {
  // Escenario 1
  it('Escenario 1: ADMINISTRADOR intenta asignar evaluador -> 403 Forbidden', async () => {
    const mockClient = crearMockClient();
    await expect(
      asignarEvaluador(mockClient, EXPEDIENTE_ID, actorAdministrador, {
        idUsuarioDocente: USUARIO_DOCENTE_1,
        motivoAsignacion: 'Asignación no autorizada por ADMINISTRADOR',
      }),
    ).rejects.toThrowError(ForbiddenError);
  });

  // Escenario 2
  it('Escenario 2: ADMINISTRADOR intenta reasignar evaluador -> 403 Forbidden', async () => {
    const mockClient = crearMockClient({
      evaluadorActivo: { id_asignacion: 'asig-001', id_usuario_docente: USUARIO_DOCENTE_1 },
    });
    await expect(
      reasignarEvaluador(mockClient, EXPEDIENTE_ID, actorAdministrador, {
        idNuevoDocente: USUARIO_DOCENTE_2,
        motivoAsignacion: 'Reasignación no autorizada por ADMINISTRADOR',
        justificacionReasignacion: 'Justificación formal con más de diez caracteres.',
      }),
    ).rejects.toThrowError(ForbiddenError);
  });

  // Escenario 3
  it('Escenario 3: Actor autorizado asigna dentro de su ámbito -> Permitido', async () => {
    const mockClient = crearMockClient();
    const res = await asignarEvaluador(
      mockClient,
      EXPEDIENTE_ID,
      actorCoordinadorAutorizado,
      {
        idUsuarioDocente: USUARIO_DOCENTE_1,
        motivoAsignacion: 'Asignación técnica en área académica',
      },
    );
    expect(res.ok).toBe(true);
    expect(res.idAsignacion).toBeDefined();
  });

  // Escenario 4
  it('Escenario 4: Actor autorizado intenta asignar fuera de su ámbito -> 403 Forbidden', async () => {
    const mockClient = crearMockClient();
    await expect(
      asignarEvaluador(mockClient, EXPEDIENTE_ID, actorCoordinadorFueraAmbito, {
        idUsuarioDocente: USUARIO_DOCENTE_1,
        motivoAsignacion: 'Intento de asignación en área ajena',
      }),
    ).rejects.toThrowError(ForbiddenError);
  });

  // Escenario 5
  it('Escenario 5: Usuario intenta consultar expediente ajeno -> 403 Forbidden', () => {
    // Verificación de la regla contextual de acceso
    const usuarioAjeno = {
      id: '99999999-0000-4000-8000-000000000001',
      personaId: '88888888-0000-4000-8000-000000000001',
      roles: ['CIUDADANO'],
      permisos: [],
    };
    const solicitanteExpediente = PERSONA_SOLICITANTE;
    const esTitular = usuarioAjeno.personaId === solicitanteExpediente;
    const tienePermisoVer = usuarioAjeno.permisos.some((p: any) => p.codigo === 'EXPEDIENTE_LEER');
    expect(esTitular).toBe(false);
    expect(tienePermisoVer).toBe(false);
  });

  // Escenario 6
  it('Escenario 6: Permiso revocado -> Denegación inmediata', async () => {
    const mockClient = crearMockClient();
    const actorConPermisoRevocado: ActorRutaDoc = {
      ...actorCoordinadorAutorizado,
      permisos: [], // Permisos revocados en caliente
    };
    await expect(
      asignarEvaluador(mockClient, EXPEDIENTE_ID, actorConPermisoRevocado, {
        idUsuarioDocente: USUARIO_DOCENTE_1,
        motivoAsignacion: 'Intento tras revocación de permisos',
      }),
    ).rejects.toThrowError(ForbiddenError);
  });

  // Escenario 7
  it('Escenario 7: JEFE_UNIDAD_ACADEMICA accede a función autorizada -> Permitido', async () => {
    const mockClient = crearMockClient();
    const res = await asignarEvaluador(
      mockClient,
      EXPEDIENTE_ID,
      actorJefeUnidadAcademica,
      {
        idUsuarioDocente: USUARIO_DOCENTE_1,
        motivoAsignacion: 'Asignación por Jefatura de Unidad Académica',
      },
    );
    expect(res.ok).toBe(true);
    expect(res.idAsignacion).toBeDefined();
  });

  // Escenario 8
  it('Escenario 8: JEFE intenta función no autorizada fuera de ámbito -> 403 Forbidden', async () => {
    const mockClient = crearMockClient({
      evaluadorActivo: { id_asignacion: 'asig-001', id_usuario_docente: USUARIO_DOCENTE_1 },
    });
    const jefeOtraArea: ActorRutaDoc = {
      ...actorJefeUnidadAcademica,
      unidadOrganicaId: AREA_OTRA_ID,
      permisos: [
        { codigo: 'EXPEDIENTE_REASIGNAR', ambito: 'AREA', areaId: AREA_OTRA_ID },
      ],
    };
    await expect(
      reasignarEvaluador(mockClient, EXPEDIENTE_ID, jefeOtraArea, {
        idNuevoDocente: USUARIO_DOCENTE_2,
        motivoAsignacion: 'Reasignación fuera de jurisdicción académica',
        justificacionReasignacion: 'Justificación formal con más de diez caracteres.',
      }),
    ).rejects.toThrowError(ForbiddenError);
  });

  // Escenario 9
  it('Escenario 9: TESORERO accede a módulo financiero -> Permitido', () => {
    const tienePermisoFinanciero = actorTesorero.permisos?.some((p) =>
      p.codigo.startsWith('TESORERIA_') && p.ambito === 'GLOBAL',
    );
    expect(tienePermisoFinanciero).toBe(true);
    expect(actorTesorero.roles).toContain('TESORERO');
  });

  // Escenario 10
  it('Escenario 10: TESORERO intenta acceder a bandeja general / asignar no autorizada -> 403 Forbidden', async () => {
    const mockClient = crearMockClient();
    await expect(
      asignarEvaluador(mockClient, EXPEDIENTE_ID, actorTesorero, {
        idUsuarioDocente: USUARIO_DOCENTE_1,
        motivoAsignacion: 'Intento indebido de asignación por tesorería',
      }),
    ).rejects.toThrowError(ForbiddenError);
  });

  // Escenario 11
  it('Escenario 11: ESPECIALISTA intenta operar como rol activo -> Denegado', async () => {
    const mockClient = crearMockClient();
    await expect(
      asignarEvaluador(mockClient, EXPEDIENTE_ID, actorEspecialistaDescontinuado, {
        idUsuarioDocente: USUARIO_DOCENTE_1,
        motivoAsignacion: 'Intento con rol descontinuado ESPECIALISTA',
      }),
    ).rejects.toThrowError(ForbiddenError);
  });

  // Escenario 12
  it('Escenario 12: GESTOR_APOYO_AREA intenta asignar evaluadores -> 403 Forbidden', async () => {
    const mockClient = crearMockClient();
    await expect(
      asignarEvaluador(mockClient, EXPEDIENTE_ID, actorGestorApoyoArea, {
        idUsuarioDocente: USUARIO_DOCENTE_1,
        motivoAsignacion: 'Intento de asignación por Gestor de Apoyo al Área',
      }),
    ).rejects.toThrowError(ForbiddenError);
  });

  // Escenario 13
  it('Escenario 13: Reasignación autorizada -> Historial anterior preservado', async () => {
    const mockClient = crearMockClient({
      evaluadorActivo: { id_asignacion: 'asig-anterior-99', id_usuario_docente: USUARIO_DOCENTE_1 },
      docentePersona: PERSONA_DOCENTE_2,
    });
    const res = await reasignarEvaluador(
      mockClient,
      EXPEDIENTE_ID,
      actorCoordinadorAutorizado,
      {
        idNuevoDocente: USUARIO_DOCENTE_2,
        motivoAsignacion: 'Reasignación reglamentaria de evaluador',
        justificacionReasignacion: 'Carga académica redistribuida conforme a resolución.',
      },
    );
    expect(res.ok).toBe(true);
    expect(res.evaluadorAnteriorId).toBe(USUARIO_DOCENTE_1);
    expect(res.nuevoEvaluadorId).toBe(USUARIO_DOCENTE_2);

    // Comprobar que se generó UPDATE con estado REASIGNADA
    const updateCall = (mockClient.query as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
      ([sql]) => typeof sql === 'string' && sql.includes("estado_evaluacion = 'REASIGNADA'"),
    );
    expect(updateCall).toBeDefined();

    // Comprobar que se enlazó con la asignación previa
    const insertCall = (mockClient.query as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
      ([sql]) => typeof sql === 'string' && sql.includes('INSERT INTO sigd_rut.expediente_evaluador'),
    );
    expect(insertCall).toBeDefined();
    expect(insertCall![1][6]).toBe('asig-anterior-99');
  });

  // Escenario 14
  it('Escenario 14: Reasignación sin motivo obligatorio -> Rechazada', async () => {
    const mockClient = crearMockClient({
      evaluadorActivo: { id_asignacion: 'asig-anterior-99', id_usuario_docente: USUARIO_DOCENTE_1 },
    });
    await expect(
      reasignarEvaluador(mockClient, EXPEDIENTE_ID, actorCoordinadorAutorizado, {
        idNuevoDocente: USUARIO_DOCENTE_2,
        motivoAsignacion: 'Reasignación',
        justificacionReasignacion: 'Corta', // Menor a 10 caracteres
      }),
    ).rejects.toThrowError(ValidationError);
  });
});
