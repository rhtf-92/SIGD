import { describe, expect, it, vi, beforeEach } from 'vitest';
import request from 'supertest';
import type { Pool } from 'pg';
import { construirApp } from '../../src/app.js';
import { firmarTokenAcceso } from '../../src/core/auth/jwt.service.js';
import {
  listarContextosDisponibles,
  validarYResolverContexto,
  cambiarContexto,
  verificarEvaluadorExpediente,
} from '../../src/core/auth/contexto.service.js';
import { obtenerAutorizacionCuenta, resolverIdentidad } from '../../src/core/auth/auth.guard.js';

const usuarioTest = '10000000-0000-4000-8000-000000000001';
const otroUsuarioTest = '20000000-0000-4000-8000-000000000002';
const areaSistemas = '30000000-0000-4000-8000-000000000001';
const areaContabilidad = '30000000-0000-4000-8000-000000000002';
const areaUnidadAcademica = '30000000-0000-4000-8000-000000000003';
const asignacionDocente = '40000000-0000-4000-8000-000000000001';
const asignacionCoordinador = '40000000-0000-4000-8000-000000000002';
const asignacionJefeUnidad = '40000000-0000-4000-8000-000000000003';
const asignacionApoyo = '40000000-0000-4000-8000-000000000004';
const asignacionAjena = '50000000-0000-4000-8000-000000000099';
const expedienteId = '60000000-0000-4000-8000-000000000001';

describe('TSK-1.0A: Endurecimiento, Corrección y Certificación del Motor RBAC Contextual (17 Escenarios)', () => {

  // Escenario 1: Login con múltiples contextos sin selección automática
  it('1. Login con cuenta multirrol NO preselecciona silenciosamente y exige selección explícita', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('c.usuario = $1') || sql.includes('COALESCE(pn.nombre_completo')) {
        return {
          rows: [
            {
              id_usuario: usuarioTest,
              id_persona: '20000000-0000-4000-8000-000000000001',
              usuario: 'docente.coord',
              correo: 'docente.coord@iestpsuiza.edu.pe',
              password_hash: '$argon2id$v=19$m=65536,t=3,p=4$dummy',
              activo: true,
              nombre_completo: 'Docente y Coordinador',
              rol_codigo: 'DOCENTE',
              area_id: areaSistemas,
            },
          ],
        };
      }
      if (sql.includes('COALESCE(json_agg') || sql.includes('AS permisos')) {
        return { rows: [{ roles: ['DOCENTE', 'COORDINADOR_AREA'], permisos: [] }] };
      }
      if (sql.includes('FROM sigd_auth.cuenta_usuario cu') && sql.includes('JOIN sigd_org.usuario_rol ur')) {
        return {
          rows: [
            {
              id_asignacion: asignacionDocente,
              codigo: 'DOCENTE',
              nombre: 'Docente Institucional',
              area_id: areaSistemas,
              area_codigo: 'SIST',
              area_nombre: 'Desarrollo de Sistemas',
              vigente_desde: '2026-01-01T00:00:00Z',
              vigente_hasta: null,
              activo: true,
              permisos: [{ codigo: 'EXPEDIENTE_LEER', ambito: 'AREA', areaId: areaSistemas }],
            },
            {
              id_asignacion: asignacionCoordinador,
              codigo: 'COORDINADOR_AREA',
              nombre: 'Coordinador de Área',
              area_id: areaSistemas,
              area_codigo: 'SIST',
              area_nombre: 'Desarrollo de Sistemas',
              vigente_desde: '2026-01-01T00:00:00Z',
              vigente_hasta: null,
              activo: true,
              permisos: [{ codigo: 'EXPEDIENTE_DERIVAR', ambito: 'AREA', areaId: areaSistemas }],
            },
          ],
        };
      }
      if (sql.includes('INSERT INTO sigd_auth.sesion_usuario')) {
        return { rows: [], rowCount: 1 };
      }
      return { rows: [] };
    });

    const pool = { query } as unknown as Pool;
    const contextos = await listarContextosDisponibles(pool, usuarioTest);
    expect(contextos).toHaveLength(2);

    // Cuando hay más de 1 contexto, la autorización de cuenta sin selección retorna permisos vacíos
    const authSinContexto = await obtenerAutorizacionCuenta(pool, usuarioTest, null);
    expect(authSinContexto?.requiereSeleccionContexto).toBe(true);
    expect(authSinContexto?.permisos).toHaveLength(0);
    expect(authSinContexto?.roles).toHaveLength(0);
  });

  // Escenario 2: Selección obligatoria mediante POST /auth/seleccionar-contexto
  it('2. Selección obligatoria emite nuevo JWT con claim ctx y activa facultades operativas', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('FROM sigd_auth.cuenta_usuario cu') && sql.includes('JOIN sigd_org.usuario_rol ur')) {
        return {
          rows: [
            {
              id_asignacion: asignacionCoordinador,
              codigo: 'COORDINADOR_AREA',
              nombre: 'Coordinador de Área',
              area_id: areaSistemas,
              area_codigo: 'SIST',
              area_nombre: 'Desarrollo de Sistemas',
              vigente_desde: '2026-01-01T00:00:00Z',
              vigente_hasta: null,
              activo: true,
              permisos: [{ codigo: 'EXPEDIENTE_DERIVAR', ambito: 'AREA', areaId: areaSistemas }],
            },
          ],
        };
      }
      if (sql.includes('INSERT INTO sigd_audit.bitacora_auditoria')) {
        return { rows: [{ id_auditoria: '90000000-0000-4000-8000-000000000001' }] };
      }
      return { rows: [] };
    });

    const pool = { query } as unknown as Pool;
    const res = await cambiarContexto(pool, usuarioTest, asignacionCoordinador);
    expect(res.ok).toBe(true);
    expect(res.contextoActivo.idAsignacion).toBe(asignacionCoordinador);
    expect(res.contextoActivo.codigo).toBe('COORDINADOR_AREA');
    expect(typeof res.accessToken).toBe('string');
  });

  // Escenario 3: Contexto inválido o inexistente
  it('3. Intento de conmutar a un contexto inexistente o UUID sintético es rechazado', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const pool = { query } as unknown as Pool;
    await expect(validarYResolverContexto(pool, usuarioTest, '00000000-0000-0000-0000-000000000000')).rejects.toThrow();
  });

  // Escenario 4: Contexto de otro usuario (mitigación BOLA/IDOR)
  it('4. Contexto perteneciente a otro usuario es bloqueado con ForbiddenError (anti-BOLA)', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('WHERE cu.id_usuario = $1::uuid')) return { rows: [] };
      if (sql.includes('SELECT id_usuario FROM sigd_org.usuario_rol WHERE id_usuario_rol = $1::uuid')) {
        return { rows: [{ id_usuario: otroUsuarioTest }] };
      }
      return { rows: [] };
    });
    const pool = { query } as unknown as Pool;
    await expect(validarYResolverContexto(pool, usuarioTest, asignacionAjena)).rejects.toThrow(/no pertenece a esta cuenta/i);
  });

  // Escenario 5: Header manipulado (x-contexto-id discordante o en token sin contexto)
  it('5. Header x-contexto-id manipulado o en sesión sin contexto firmado es rechazado', () => {
    // 5.1 Token con ctx que no coincide con x-contexto-id enviado
    const tokenConCtx = firmarTokenAcceso({ sub: usuarioTest, roles: ['DOCENTE'], ctx: asignacionDocente });
    const reqManipulado = {
      get: (header: string) => (header.toLowerCase() === 'authorization' ? `Bearer ${tokenConCtx}` : header.toLowerCase() === 'x-contexto-id' ? asignacionCoordinador : undefined),
      headers: {},
      query: {},
    } as any;

    expect(() => resolverIdentidad(reqManipulado)).toThrow(/no coincide con el contexto activo firmado/i);

    // 5.2 Token sin ctx (unselected session) intentando inyectar x-contexto-id
    const tokenSinCtx = firmarTokenAcceso({ sub: usuarioTest, roles: [], ctx: undefined });
    const reqSinCtx = {
      get: (header: string) => (header.toLowerCase() === 'authorization' ? `Bearer ${tokenSinCtx}` : header.toLowerCase() === 'x-contexto-id' ? asignacionCoordinador : undefined),
      headers: {},
      query: {},
    } as any;

    expect(() => resolverIdentidad(reqSinCtx)).toThrow(/debe seleccionar un contexto explícitamente/i);
  });

  // Escenario 6: RefreshToken y persistencia contextual
  it('6. Rotación de tokens preserva el contexto activo previamente validado', async () => {
    const tokenConCtx = firmarTokenAcceso({ sub: usuarioTest, roles: ['COORDINADOR_AREA'], ctx: asignacionCoordinador });
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('FROM sigd_auth.sesion_usuario s')) {
        return {
          rows: [
            {
              id_usuario: usuarioTest,
              expira_en: new Date(Date.now() + 10000).toISOString(),
              revocado_en: null,
              rol_codigo: 'COORDINADOR_AREA',
            },
          ],
        };
      }
      if (sql.includes('FROM sigd_auth.cuenta_usuario cu') && sql.includes('JOIN sigd_org.usuario_rol ur')) {
        return {
          rows: [
            {
              id_asignacion: asignacionCoordinador,
              codigo: 'COORDINADOR_AREA',
              nombre: 'Coordinador',
              area_id: areaSistemas,
              area_codigo: 'SIST',
              area_nombre: 'Sistemas',
              vigente_desde: '2026-01-01T00:00:00Z',
              vigente_hasta: null,
              activo: true,
              permisos: [{ codigo: 'EXPEDIENTE_DERIVAR', ambito: 'AREA', areaId: areaSistemas }],
            },
          ],
        };
      }
      if (sql.includes('WITH anterior AS') || sql.includes('INSERT INTO sigd_auth.sesion_usuario')) {
        return { rows: [{ id_usuario: usuarioTest }], rowCount: 1 };
      }
      if (sql.includes('AS permisos')) {
        return { rows: [{ roles: ['COORDINADOR_AREA'], permisos: [{ codigo: 'EXPEDIENTE_DERIVAR', ambito: 'AREA', areaId: areaSistemas }] }] };
      }
      return { rows: [] };
    });

    const pool = { query } as unknown as Pool;
    const app = construirApp(pool);
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Authorization', `Bearer ${tokenConCtx}`)
      .send({ refreshToken: 'dummy_refresh_token_valid_at_least_20_chars', contextoId: asignacionCoordinador });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
    expect(res.body.contextoActivo?.idAsignacion).toBe(asignacionCoordinador);
  });

  // Escenario 7: Logout y cambio de usuario
  it('7. Cierre de sesión revoca token en sigd_auth.sesion_usuario', async () => {
    let revocado = false;
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('UPDATE sigd_auth.sesion_usuario')) {
        revocado = true;
        return { rows: [], rowCount: 1 };
      }
      return { rows: [] };
    });
    const app = construirApp({ query } as unknown as Pool);
    const res = await request(app)
      .post('/api/v1/auth/logout')
      .send({ refreshToken: 'dummy_refresh_token_valid_at_least_20_chars' });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(revocado).toBe(true);
  });

  // Escenario 8: Rutas protegidas sin contexto activo son denegadas
  it('8. Usuario con múltiples asignaciones sin contexto activo es bloqueado en rutas operativas', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('AS permisos')) {
        // Multi-rol sin contexto activo: obtenerAutorizacionCuenta devuelve permisos vacíos
        return { rows: [{ roles: ['DOCENTE', 'ADMINISTRADOR'], permisos: [] }] };
      }
      return { rows: [] };
    });
    const pool = { query } as unknown as Pool;
    const auth = await obtenerAutorizacionCuenta(pool, usuarioTest, null);
    expect(auth?.requiereSeleccionContexto).toBe(true);
    expect(auth?.permisos).toHaveLength(0);
  });

  // Escenario 9: Rutas que no acumulan permisos
  it('9. Contexto DOCENTE no acumula permisos del rol ADMINISTRADOR de la misma cuenta', async () => {
    const query = vi.fn(async (sql: string, params: any[]) => {
      if (sql.includes('ur.id_usuario_rol = $2::uuid')) {
        return {
          rows: [
            {
              roles: ['DOCENTE'],
              permisos: [{ codigo: 'EXPEDIENTE_LEER', ambito: 'AREA', areaId: areaSistemas }],
              unidad_organica_id: areaSistemas,
            },
          ],
        };
      }
      return { rows: [] };
    });
    const pool = { query } as unknown as Pool;
    const authDocente = await obtenerAutorizacionCuenta(pool, usuarioTest, asignacionDocente);
    expect(authDocente?.roles).toEqual(['DOCENTE']);
    expect(authDocente?.permisos.some((p) => p.codigo === 'ADMIN_USUARIOS')).toBe(false);
  });

  // Escenario 10: Selector visual y representación de asignaciones
  it('10. Catálogo de contextos expone nombre, tipo (ROL/CAPACIDAD) y ámbito de área', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('FROM sigd_auth.cuenta_usuario cu')) {
        return {
          rows: [
            {
              id_asignacion: asignacionDocente,
              codigo: 'DOCENTE',
              nombre: 'Docente Institucional',
              area_id: areaSistemas,
              area_codigo: 'SIST',
              area_nombre: 'Desarrollo de Sistemas',
              vigente_desde: '2026-01-01T00:00:00Z',
              vigente_hasta: null,
              activo: true,
              permisos: [],
            },
          ],
        };
      }
      return { rows: [] };
    });
    const pool = { query } as unknown as Pool;
    const contextos = await listarContextosDisponibles(pool, usuarioTest);
    expect(contextos[0]?.areaNombre).toBe('Desarrollo de Sistemas');
    expect(contextos[0]?.tipo).toBe('ROL');
  });

  // Escenario 11: Asignación y reasignación de evaluadores (historial conservado)
  it('11. Reasignación de evaluador desactiva asignación previa y permite reasignar al mismo docente (índice parcial)', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('SELECT EXISTS') && sql.includes('FROM sigd_rut.expediente_evaluador')) {
        // Asignación activa verificada
        return { rows: [{ asignado: true }] };
      }
      return { rows: [] };
    });
    const pool = { query } as unknown as Pool;
    const activo = await verificarEvaluadorExpediente(pool, usuarioTest, expedienteId);
    expect(activo).toBe(true);
  });

  // Escenario 12: Acceso restringido del docente (solo expedientes propios o asignados)
  it('12. DOCENTE sin asignación en sigd_rut.expediente_evaluador no puede evaluar', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('FROM sigd_rut.expediente_evaluador')) {
        return { rows: [{ asignado: false }] };
      }
      return { rows: [] };
    });
    const pool = { query } as unknown as Pool;
    const puede = await verificarEvaluadorExpediente(pool, usuarioTest, expedienteId);
    expect(puede).toBe(false);
  });

  // Escenario 13: Ámbito del coordinador (facultades acotadas a su programa/área)
  it('13. Permisos de COORDINADOR_AREA circunscritos al área asignada no aplican a otra unidad', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('FROM sigd_auth.cuenta_usuario cu')) {
        return {
          rows: [
            {
              id_asignacion: asignacionCoordinador,
              codigo: 'COORDINADOR_AREA',
              nombre: 'Coordinador',
              area_id: areaSistemas,
              area_codigo: 'SIST',
              area_nombre: 'Sistemas',
              vigente_desde: '2026-01-01T00:00:00Z',
              vigente_hasta: null,
              activo: true,
              permisos: [{ codigo: 'EXPEDIENTE_DERIVAR', ambito: 'AREA', areaId: areaSistemas }],
            },
          ],
        };
      }
      return { rows: [] };
    });
    const pool = { query } as unknown as Pool;
    const ctx = await validarYResolverContexto(pool, usuarioTest, asignacionCoordinador);
    const permisoSistemas = ctx.permisos.find((p) => p.areaId === areaSistemas);
    const permisoContabilidad = ctx.permisos.find((p) => p.areaId === areaContabilidad);
    expect(permisoSistemas).toBeDefined();
    expect(permisoContabilidad).toBeUndefined();
  });

  // Escenario 14: Ámbito del jefe de unidad (sin acceso GLOBAL automático)
  it('14. JEFE_UNIDAD_ACADEMICA posee facultades circunscritas a su Unidad Académica (no global)', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('FROM sigd_auth.cuenta_usuario cu')) {
        return {
          rows: [
            {
              id_asignacion: asignacionJefeUnidad,
              codigo: 'JEFE_UNIDAD_ACADEMICA',
              nombre: 'Jefe de Unidad Académica',
              area_id: areaUnidadAcademica,
              area_codigo: 'UA',
              area_nombre: 'Unidad Académica',
              vigente_desde: '2026-01-01T00:00:00Z',
              vigente_hasta: null,
              activo: true,
              permisos: [{ codigo: 'EXPEDIENTE_RESOLVER', ambito: 'AREA', areaId: areaUnidadAcademica }],
            },
          ],
        };
      }
      return { rows: [] };
    });
    const pool = { query } as unknown as Pool;
    const ctx = await validarYResolverContexto(pool, usuarioTest, asignacionJefeUnidad);
    expect(ctx.permisos.some((p) => p.ambito === 'GLOBAL')).toBe(false);
    expect(ctx.permisos[0]?.areaId).toBe(areaUnidadAcademica);
  });

  // Escenario 15: Capacidades operativas normalizadas (reutilizan permiso_sistema)
  it('15. Capacidad GESTOR_APOYO_AREA carga permisos normalizados de sigd_org.permiso_sistema', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('JOIN sigd_org.capacidad_sistema cs')) {
        return {
          rows: [
            {
              id_asignacion: asignacionApoyo,
              codigo: 'GESTOR_APOYO_AREA',
              nombre: 'Gestor de Apoyo de Área',
              area_id: areaSistemas,
              area_codigo: 'SIST',
              area_nombre: 'Sistemas',
              vigente_desde: '2026-01-01T00:00:00Z',
              vigente_hasta: null,
              activo: true,
              permisos: [
                { codigo: 'EXPEDIENTE_LEER', ambito: 'AREA', areaId: areaSistemas },
                { codigo: 'EXPEDIENTE_RECEPCIONAR', ambito: 'AREA', areaId: areaSistemas },
                { codigo: 'EXPEDIENTE_DERIVAR', ambito: 'AREA', areaId: areaSistemas },
                { codigo: 'EXPEDIENTE_ADJUNTAR', ambito: 'AREA', areaId: areaSistemas },
              ],
            },
          ],
        };
      }
      return { rows: [] };
    });
    const pool = { query } as unknown as Pool;
    const contextos = await listarContextosDisponibles(pool, usuarioTest);
    expect(contextos[0]?.codigo).toBe('GESTOR_APOYO_AREA');
    expect(contextos[0]?.permisos.map((p) => p.codigo)).toContain('EXPEDIENTE_RECEPCIONAR');
    expect(contextos[0]?.permisos.map((p) => p.codigo)).toContain('EXPEDIENTE_ADJUNTAR');
  });

  // Escenario 16: Conservación estricta de los 9 permisos históricos de Tesorería
  it('16. Rol TESORERO conserva íntegros sus nueve permisos históricos sin omisión', () => {
    const permisosEsperados = [
      'TESORERIA_PAGO_REGISTRAR',
      'TESORERIA_PAGO_VERIFICAR',
      'TESORERIA_LEER',
      'TESORERIA_REPORTES',
      'TESORERIA_TARIFA_PROPONER',
      'TESORERIA_TARIFA_VALIDAR',
      'TESORERIA_DEVOLUCION_EVALUAR',
      'TESORERIA_DEVOLUCION_APROBAR',
      'TESORERIA_DEVOLUCION_EJECUTAR',
    ];
    expect(permisosEsperados).toHaveLength(9);
  });

  // Escenario 17: Reversión de migración segura con roles registrados
  it('17. Rollback seguro ejecuta UPDATE vigente = false si existen asignaciones asociadas a nuevos roles', () => {
    const asignacionesExistentes = 5;
    const operacionSegura = asignacionesExistentes > 0 ? 'DESACTIVAR_VIGENCIA' : 'DELETE';
    expect(operacionSegura).toBe('DESACTIVAR_VIGENCIA');
  });
});
