import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import {
  registrarAnotacionInterna,
  listarAnotacionesInternas,
} from '../../../../src/domains/rutadoc/anotacionesInternas.service.js';
import type { ActorRutaDoc } from '../../../../src/domains/rutadoc/rutadoc.types.js';
import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
} from '../../../../src/shared/domain/errors/index.js';

// Mock de insertarEvento en Transactional Outbox
vi.mock('../../../../src/audit/evento-outbox.repository.js', () => ({
  insertarEvento: vi.fn().mockResolvedValue('evt-uuid-12345'),
}));

const EXPEDIENTE_ID = '30000000-0000-4000-8000-000000000001';
const ASIGNACION_ID = '40000000-0000-4000-8000-000000000001';
const AREA_SEC_ID = '2b147b0d-7c8f-434f-b75a-598a1ccb855b';
const AREA_OTRA_ID = '9b000000-0000-4000-8000-000000000099';
const USUARIO_DOCENTE_ASIGNADO = '10000000-0000-4000-8000-000000000001';
const USUARIO_DOCENTE_NO_ASIGNADO = '10000000-0000-4000-8000-000000000002';
const USUARIO_COORDINADOR = '20000000-0000-4000-8000-000000000001';
const USUARIO_SECRETARIO = '30000000-0000-4000-8000-000000000001';
const USUARIO_CIUDADANO = '90000000-0000-4000-8000-000000000001';

const actorDocenteAsignado: ActorRutaDoc = {
  id: USUARIO_DOCENTE_ASIGNADO,
  roles: ['DOCENTE'],
  unidadOrganicaId: AREA_SEC_ID,
  permisos: [{ codigo: 'EXPEDIENTE_EVALUAR', ambito: 'AREA', areaId: AREA_SEC_ID }] as any,
  puedeVerExpediente: vi.fn().mockResolvedValue(true),
};

const actorDocenteNoAsignado: ActorRutaDoc = {
  id: USUARIO_DOCENTE_NO_ASIGNADO,
  roles: ['DOCENTE'],
  unidadOrganicaId: AREA_SEC_ID,
  permisos: [{ codigo: 'EXPEDIENTE_EVALUAR', ambito: 'AREA', areaId: AREA_SEC_ID }] as any,
  puedeVerExpediente: vi.fn().mockResolvedValue(true),
};

const actorCoordinadorArea: ActorRutaDoc = {
  id: USUARIO_COORDINADOR,
  roles: ['COORDINADOR_AREA'],
  unidadOrganicaId: AREA_SEC_ID,
  permisos: [
    { codigo: 'EXPEDIENTE_ASIGNAR', ambito: 'AREA', areaId: AREA_SEC_ID },
    { codigo: 'EXPEDIENTE_EVALUAR', ambito: 'AREA', areaId: AREA_SEC_ID },
  ] as any,
  puedeVerExpediente: vi.fn().mockResolvedValue(true),
};

const actorCoordinadorOtraArea: ActorRutaDoc = {
  id: '20000000-0000-4000-8000-000000000099',
  roles: ['COORDINADOR_AREA'],
  unidadOrganicaId: AREA_OTRA_ID,
  permisos: [{ codigo: 'EXPEDIENTE_ASIGNAR', ambito: 'AREA', areaId: AREA_OTRA_ID }] as any,
  puedeVerExpediente: vi.fn().mockResolvedValue(false),
};

const actorSecretario: ActorRutaDoc = {
  id: USUARIO_SECRETARIO,
  roles: ['SECRETARIO'],
  unidadOrganicaId: AREA_SEC_ID,
  permisos: [
    { codigo: 'EXPEDIENTE_LEER', ambito: 'GLOBAL', areaId: null },
    { codigo: 'EXPEDIENTE_RECEPCIONAR', ambito: 'AREA', areaId: AREA_SEC_ID },
  ] as any,
  puedeVerExpediente: vi.fn().mockResolvedValue(true),
};

const actorCiudadano: ActorRutaDoc = {
  id: USUARIO_CIUDADANO,
  roles: ['CIUDADANO'],
  puedeVerExpediente: vi.fn().mockResolvedValue(false),
};

function crearMockCliente(opciones?: {
  expedienteExiste?: boolean;
  esDocenteAsignado?: boolean;
  anotacionPadreExiste?: boolean;
}): PoolClient {
  const {
    expedienteExiste = true,
    esDocenteAsignado = true,
    anotacionPadreExiste = true,
  } = opciones ?? {};

  const queryMock = vi.fn().mockImplementation(async (sql: string, params: unknown[]) => {
    // 1. Obtener metadatos del expediente
    if (sql.includes('FROM sigd_tra.expediente e')) {
      if (!expedienteExiste) return { rowCount: 0, rows: [] };
      return {
        rowCount: 1,
        rows: [
          {
            expediente_id: EXPEDIENTE_ID,
            codigo_expediente: 'EXP-2026-000203',
            solicitante_id: '80000000-0000-4000-8000-000000000001',
            area_actual_id: AREA_SEC_ID,
            area_codigo: 'SEC',
          },
        ],
      };
    }

    // 2. Comprobar asignación activa del docente
    if (sql.includes('FROM sigd_rut.expediente_evaluador')) {
      if (!esDocenteAsignado) return { rowCount: 0, rows: [] };
      return {
        rowCount: 1,
        rows: [
          {
            id_asignacion: ASIGNACION_ID,
            id_usuario_docente: USUARIO_DOCENTE_ASIGNADO,
          },
        ],
      };
    }

    // 3. Comprobar existencia de anotación padre
    if (sql.includes('FROM sigd_rut.expediente_anotacion_interna') && sql.includes('anotacion_padre_id')) {
      if (!anotacionPadreExiste) return { rowCount: 0, rows: [] };
      return {
        rowCount: 1,
        rows: [{ id_anotacion: params[0] }],
      };
    }

    // 4. Inserción de la anotación interna
    if (sql.includes('INSERT INTO sigd_rut.expediente_anotacion_interna')) {
      return {
        rowCount: 1,
        rows: [
          {
            id_anotacion: '55555555-5555-4555-8555-555555555555',
            expediente_id: params[0],
            id_asignacion: params[1],
            usuario_id: params[2],
            rol_codigo: params[3],
            area_id: params[4],
            tipo_anotacion: params[5],
            contenido: params[6],
            anotacion_padre_id: params[7],
            creado_en: new Date('2026-11-20T12:00:00.000Z'),
          },
        ],
      };
    }

    // 5. Datos complementarios del autor
    if (sql.includes('FROM sigd_auth.cuenta_usuario cu')) {
      return {
        rowCount: 1,
        rows: [
          {
            nombre_completo: 'Lic. Docente Evaluador',
            usuario: 'docente.demo',
            correo: 'docente.demo@iestpsuiza.edu.pe',
            rol_nombre: 'Docente',
            area_codigo: 'SEC',
            area_nombre: 'Secretaría Académica',
          },
        ],
      };
    }

    return { rowCount: 0, rows: [] };
  });

  return {
    query: queryMock,
    release: vi.fn(),
  } as unknown as PoolClient;
}

describe('Módulo de Anotaciones Internas de Seguimiento (RutaDoc)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. Creación de anotaciones autorizadas (Docente asignado)
  it('1. Permite registrar anotación a docente evaluador con asignación activa', async () => {
    const cliente = crearMockCliente({ esDocenteAsignado: true });
    const resultado = await registrarAnotacionInterna(cliente, EXPEDIENTE_ID, actorDocenteAsignado, {
      tipoAnotacion: 'SEGUIMIENTO',
      contenido: 'Se verifica el cumplimiento de actas semestrales correspondientes al plan curricular.',
    });

    expect(resultado).toBeDefined();
    expect(resultado.expedienteId).toBe(EXPEDIENTE_ID);
    expect(resultado.rolCodigo).toBe('DOCENTE');
    expect(resultado.tipoAnotacion).toBe('SEGUIMIENTO');
    expect(resultado.idAsignacion).toBe(ASIGNACION_ID);
    expect(resultado.contenido).toContain('cumplimiento de actas semestrales');
  });

  // 2. Creación de anotaciones autorizadas (Coordinador de Área)
  it('2. Permite registrar anotación de supervisión al Coordinador de Área', async () => {
    const cliente = crearMockCliente({ esDocenteAsignado: false });
    const resultado = await registrarAnotacionInterna(cliente, EXPEDIENTE_ID, actorCoordinadorArea, {
      tipoAnotacion: 'SUPERVISION',
      contenido: 'Coordinación dispone priorizar la verificación de antecedentes antes del cierre mensual.',
    });

    expect(resultado).toBeDefined();
    expect(resultado.rolCodigo).toBe('COORDINADOR_AREA');
    expect(resultado.tipoAnotacion).toBe('SUPERVISION');
  });

  // 3. Consulta cronológica de anotaciones internas
  it('3. Lista cronológicamente las anotaciones registradas para el expediente', async () => {
    const poolMock = {
      query: vi.fn().mockResolvedValue({
        rowCount: 2,
        rows: [
          {
            id_anotacion: '11111111-1111-4111-8111-111111111111',
            expediente_id: EXPEDIENTE_ID,
            id_asignacion: ASIGNACION_ID,
            usuario_id: USUARIO_DOCENTE_ASIGNADO,
            autor_nombre_completo: 'Lic. Docente Evaluador',
            autor_usuario: 'docente.demo',
            autor_correo: 'docente.demo@iestpsuiza.edu.pe',
            rol_codigo: 'DOCENTE',
            rol_nombre: 'Docente',
            area_id: AREA_SEC_ID,
            area_codigo: 'SEC',
            area_nombre: 'Secretaría Académica',
            tipo_anotacion: 'SEGUIMIENTO',
            contenido: 'Primera anotación técnica.',
            anotacion_padre_id: null,
            creado_en: new Date('2026-11-20T10:00:00.000Z'),
          },
          {
            id_anotacion: '22222222-2222-4222-8222-222222222222',
            expediente_id: EXPEDIENTE_ID,
            id_asignacion: null,
            usuario_id: USUARIO_COORDINADOR,
            autor_nombre_completo: 'Coordinador de Área Demo',
            autor_usuario: 'especialista.demo',
            autor_correo: 'especialista.demo@sandbox.invalid',
            rol_codigo: 'COORDINADOR_AREA',
            rol_nombre: 'Coordinador de Área',
            area_id: AREA_SEC_ID,
            area_codigo: 'SEC',
            area_nombre: 'Secretaría Académica',
            tipo_anotacion: 'SUPERVISION',
            contenido: 'Segunda anotación de supervisión.',
            anotacion_padre_id: '11111111-1111-4111-8111-111111111111',
            creado_en: new Date('2026-11-20T11:00:00.000Z'),
          },
        ],
      }),
    } as unknown as Pool;

    const respuesta = await listarAnotacionesInternas(poolMock, EXPEDIENTE_ID, actorSecretario);
    expect(respuesta.ok).toBe(true);
    expect(respuesta.total).toBe(2);
    expect(respuesta.anotaciones[0].contenido).toBe('Primera anotación técnica.');
    expect(respuesta.anotaciones[1].anotacionPadreId).toBe('11111111-1111-4111-8111-111111111111');
  });

  // 4. Identificación del autor real (no confía en datos del cliente)
  it('4. Asigna siempre el usuario autenticado y su rol efectivo en la persistencia', async () => {
    const cliente = crearMockCliente({ esDocenteAsignado: true });
    const resultado = await registrarAnotacionInterna(cliente, EXPEDIENTE_ID, actorDocenteAsignado, {
      tipoAnotacion: 'SEGUIMIENTO',
      contenido: 'Anotación con autoría resuelta desde el token autenticado.',
    });

    expect(resultado.usuarioId).toBe(USUARIO_DOCENTE_ASIGNADO);
    expect(resultado.rolCodigo).toBe('DOCENTE');
  });

  // 5. Rechazo de docente sin asignación activa en el expediente
  it('5. Rechaza con ForbiddenError a docente que no tiene asignación activa en el expediente', async () => {
    const cliente = crearMockCliente({ esDocenteAsignado: false });
    await expect(
      registrarAnotacionInterna(cliente, EXPEDIENTE_ID, actorDocenteNoAsignado, {
        tipoAnotacion: 'SEGUIMIENTO',
        contenido: 'Intento de registro sin asignación activa.',
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  // 6. Rechazo de usuario de otra área
  it('6. Rechaza con ForbiddenError a coordinador de otra área sin ámbito en el expediente', async () => {
    const cliente = crearMockCliente({ esDocenteAsignado: false });
    await expect(
      registrarAnotacionInterna(cliente, EXPEDIENTE_ID, actorCoordinadorOtraArea, {
        tipoAnotacion: 'SUPERVISION',
        contenido: 'Intento de supervisión en área ajena.',
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  // 7. Consulta de Secretaría Académica (SECRETARIO)
  it('7. Permite a SECRETARIO consultar el historial de anotaciones', async () => {
    const poolMock = {
      query: vi.fn().mockResolvedValue({ rowCount: 0, rows: [] }),
    } as unknown as Pool;

    const respuesta = await listarAnotacionesInternas(poolMock, EXPEDIENTE_ID, actorSecretario);
    expect(respuesta.ok).toBe(true);
    expect(respuesta.anotaciones).toEqual([]);
  });

  // 8. Secretario NO puede registrar anotaciones de evaluación docente
  it('8. Rechaza con ForbiddenError a usuario con rol exclusivo SECRETARIO al intentar registrar', async () => {
    const cliente = crearMockCliente({ esDocenteAsignado: false });
    await expect(
      registrarAnotacionInterna(cliente, EXPEDIENTE_ID, actorSecretario, {
        tipoAnotacion: 'SEGUIMIENTO',
        contenido: 'Intento de secretario de formular anotación técnica de evaluación.',
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  // 9. Protección frente a ciudadanos (POST)
  it('9. Rechaza con ForbiddenError a ciudadanos al intentar registrar anotaciones internas', async () => {
    const cliente = crearMockCliente();
    await expect(
      registrarAnotacionInterna(cliente, EXPEDIENTE_ID, actorCiudadano, {
        tipoAnotacion: 'SEGUIMIENTO',
        contenido: 'Intento de ciudadano de acceder a seguimiento interno.',
      }),
    ).rejects.toThrow(ForbiddenError);
  });

  // 10. Protección frente a ciudadanos (GET)
  it('10. Rechaza con ForbiddenError a ciudadanos al intentar listar anotaciones internas', async () => {
    const poolMock = {} as unknown as Pool;
    await expect(
      listarAnotacionesInternas(poolMock, EXPEDIENTE_ID, actorCiudadano),
    ).rejects.toThrow(ForbiddenError);
  });

  // 11. Persistencia transaccional del evento Outbox
  it('11. Registra el evento ExpedienteAnotacionInternaRegistrada en el Transactional Outbox', async () => {
    const { insertarEvento } = await import('../../../../src/audit/evento-outbox.repository.js');
    const cliente = crearMockCliente({ esDocenteAsignado: true });

    await registrarAnotacionInterna(cliente, EXPEDIENTE_ID, actorDocenteAsignado, {
      tipoAnotacion: 'SEGUIMIENTO',
      contenido: 'Constancia de cotejo de notas con acta central.',
    });

    expect(insertarEvento).toHaveBeenCalledWith(
      cliente,
      expect.objectContaining({
        agregado: 'Expediente',
        tipo_evento: 'ExpedienteAnotacionInternaRegistrada',
        payload: expect.objectContaining({
          identidad: expect.objectContaining({ expediente_id: EXPEDIENTE_ID }),
          contexto: expect.objectContaining({ usuario_autor_id: USUARIO_DOCENTE_ASIGNADO }),
          datos_especificos: expect.objectContaining({ tipo_anotacion: 'SEGUIMIENTO' }),
        }),
      }),
    );
  });

  // 12. Ausencia de cambios en el estado del expediente
  it('12. NO ejecuta sentencias de actualización sobre sigd_rut.estado_actual_expediente', async () => {
    const cliente = crearMockCliente({ esDocenteAsignado: true });
    await registrarAnotacionInterna(cliente, EXPEDIENTE_ID, actorDocenteAsignado, {
      tipoAnotacion: 'SEGUIMIENTO',
      contenido: 'Registro de anotación que debe conservar el estado EN_REVISION.',
    });

    const calls = (cliente.query as any).mock.calls;
    const queries = calls.map((c: any[]) => String(c[0]));
    const tocaEstado = queries.some((q: string) => q.includes('estado_actual_expediente') && q.includes('UPDATE'));
    expect(tocaEstado).toBe(false);
  });

  // 13. Ausencia de alteraciones en el SLA
  it('13. NO invoca lógica de suspensión, pausa ni recalculo de SLA', async () => {
    const cliente = crearMockCliente({ esDocenteAsignado: true });
    await registrarAnotacionInterna(cliente, EXPEDIENTE_ID, actorDocenteAsignado, {
      tipoAnotacion: 'SEGUIMIENTO',
      contenido: 'Anotación técnica sin afectación de cómputo de plazos normativos.',
    });

    const calls = (cliente.query as any).mock.calls;
    const queries = calls.map((c: any[]) => String(c[0]));
    const tocaSla = queries.some((q: string) => q.includes('calendario_laboral') || q.includes('plazo_dias'));
    expect(tocaSla).toBe(false);
  });

  // 14. Ausencia de notificaciones ciudadanas o casilla
  it('14. NO invoca envíos ni notificaciones a la Casilla Electrónica', async () => {
    const cliente = crearMockCliente({ esDocenteAsignado: true });
    await registrarAnotacionInterna(cliente, EXPEDIENTE_ID, actorDocenteAsignado, {
      tipoAnotacion: 'SEGUIMIENTO',
      contenido: 'Anotación estrictamente interna sin notificación externa.',
    });

    const calls = (cliente.query as any).mock.calls;
    const queries = calls.map((c: any[]) => String(c[0]));
    const tocaNotificacion = queries.some((q: string) => q.includes('notificacion_casilla') || q.includes('casilla'));
    expect(tocaNotificacion).toBe(false);
  });

  // 15. Ausencia de registros en observaciones LPAG
  it('15. NO inserta registros en la tabla de observaciones formales LPAG (expediente_observacion)', async () => {
    const cliente = crearMockCliente({ esDocenteAsignado: true });
    await registrarAnotacionInterna(cliente, EXPEDIENTE_ID, actorDocenteAsignado, {
      tipoAnotacion: 'SEGUIMIENTO',
      contenido: 'Separación arquitectónica garantizada frente a observaciones LPAG.',
    });

    const calls = (cliente.query as any).mock.calls;
    const queries = calls.map((c: any[]) => String(c[0]));
    const tocaObservacion = queries.some((q: string) => q.includes('sigd_rut.expediente_observacion'));
    expect(tocaObservacion).toBe(false);
  });
});
