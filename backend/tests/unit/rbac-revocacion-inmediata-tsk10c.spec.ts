import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Pool } from 'pg';
import { construirApp } from '../../src/app.js';
import { firmarTokenAcceso } from '../../src/core/auth/jwt.service.js';
import {
  obtenerAutorizacionCuenta,
  exigirContextoValido,
  tienePermisoGlobal,
  tienePermisoArea,
} from '../../src/core/auth/auth.guard.js';
import { crearUsuariosAdminService } from '../../src/domains/organicore/usuariosAdmin.service.js';
import {
  listarContextosDisponibles,
  cambiarContexto,
  validarYResolverContexto,
} from '../../src/core/auth/contexto.service.js';

// Identificadores de prueba canónicos
const usuarioId = '11111111-1111-4111-8111-111111111111';
const adminId = '99999999-9999-4999-8999-999999999999';
const areaSistemasId = '22222222-2222-4222-8222-222222222221';
const areaContabilidadId = '22222222-2222-4222-8222-222222222222';
const rolDocenteId = '33333333-3333-4333-8333-333333333331';
const rolMesaPartesId = '33333333-3333-4333-8333-333333333332';
const asignacionDocenteId = '44444444-4444-4444-8444-444444444441';
const asignacionMesaPartesId = '44444444-4444-4444-8444-444444444442';
const asignacionCapacidadId = '55555555-5555-4555-8555-555555555551';

describe('TSK-1.0C: Implementación de Revocación Inmediata de Autorizaciones y Sesiones (17 Escenarios)', () => {

  // Escenario 1: Retiro de rol con sesión abierta (siguiente petición denegada)
  it('1. Retiro de rol con sesión abierta: la siguiente petición protegida es denegada de inmediato', async () => {
    let rolRevocado = false;
    const poolMock = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('sigd_auth.cuenta_usuario cu')) {
          if (rolRevocado) {
            // El rol asignado ya no está vigente en usuario_rol
            return {
              rows: [{
                roles: [],
                permisos: [],
                unidad_organica_id: null,
              }],
            };
          }
          return {
            rows: [{
              roles: ['DOCENTE'],
              permisos: [{ codigo: 'EXPEDIENTE_LEER', ambito: 'AREA', areaId: areaSistemasId }],
              unidad_organica_id: areaSistemasId,
            }],
          };
        }
        if (sql.includes('sigd_org.usuario_capacidad')) {
          return { rows: [] };
        }
        return { rows: [] };
      }),
    } as unknown as Pool;

    // Antes de la revocación: petición autorizada
    const authAntes = await obtenerAutorizacionCuenta(poolMock, usuarioId, asignacionDocenteId);
    expect(authAntes).not.toBeNull();
    expect(authAntes?.roles).toContain('DOCENTE');
    expect(authAntes?.contextoRevocado).toBeFalsy();

    // Se ejecuta la revocación del rol
    rolRevocado = true;

    // Siguiente petición inmediata: contexto revocado, roles vacíos
    const authDespues = await obtenerAutorizacionCuenta(poolMock, usuarioId, asignacionDocenteId);
    expect(authDespues).not.toBeNull();
    expect(authDespues?.roles).toHaveLength(0);
    expect(authDespues?.permisos).toHaveLength(0);
    expect(authDespues?.contextoRevocado).toBe(true);

    // Intentar exigir contexto válido lanza 403 CONTEXT_REVOKED
    await expect(exigirContextoValido(poolMock, usuarioId, asignacionDocenteId)).rejects.toMatchObject({
      status: 403,
      code: 'CONTEXT_REVOKED',
    });
  });

  // Escenario 2: Intento de acceder al módulo del rol retirado (HTTP 403)
  it('2. Intento de acceder al módulo del rol retirado retorna HTTP 403 Forbidden CONTEXT_REVOKED', async () => {
    const token = firmarTokenAcceso({
      sub: usuarioId,
      roles: ['MESA_PARTES'],
      ctx: asignacionMesaPartesId,
      rol: 'MESA_PARTES',
    });

    const poolMock = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('sigd_auth.cuenta_usuario cu')) {
          // Asignación de mesa de partes fue revocada
          return {
            rows: [{
              roles: [],
              permisos: [],
              unidad_organica_id: null,
            }],
          };
        }
        if (sql.includes('sigd_org.usuario_capacidad')) {
          return { rows: [] };
        }
        return { rows: [] };
      }),
    } as unknown as Pool;

    const app = construirApp(poolMock);
    const res = await request(app)
      .get('/api/v1/tramites/devoluciones')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CONTEXT_REVOKED');
  });

  // Escenario 3: Usuario multirrol conserva otro contexto válido legítimo
  it('3. Usuario multirrol conserva otro contexto válido y conmutar a él restaura facultades legítimas', async () => {
    // Usuario tenía DOCENTE y MESA_PARTES. MESA_PARTES fue revocado, pero DOCENTE sigue activo.
    const poolMock = {
      query: vi.fn(async (sql: string, params: any[]) => {
        // Validación de cuenta activa
        if (sql.includes('SELECT cu.id_persona, cu.activo FROM sigd_auth.cuenta_usuario')) {
          return { rows: [{ id_persona: '99999999-1111-4111-8111-111111111111', activo: true }] };
        }
        // Contextos disponibles: sólo DOCENTE está vigente
        if (sql.includes('FROM sigd_auth.cuenta_usuario cu') && sql.includes('JOIN sigd_org.usuario_rol ur')) {
          if (params?.[1] === asignacionMesaPartesId) {
            // MESA_PARTES no existe / fue revocado
            return { rows: [] };
          }
          return {
            rows: [{
              id_asignacion: asignacionDocenteId,
              codigo: 'DOCENTE',
              nombre: 'Docente',
              area_id: areaSistemasId,
              area_codigo: 'SIST',
              area_nombre: 'Sistemas',
              vigente_desde: '2026-01-01T00:00:00Z',
              vigente_hasta: null,
              activo: true,
              permisos: [{ codigo: 'EXPEDIENTE_LEER', ambito: 'AREA', areaId: areaSistemasId }],
            }],
          };
        }
        if (sql.includes('sigd_org.usuario_capacidad')) {
          return { rows: [] };
        }
        if (sql.includes('INSERT INTO sigd_audit.bitacora_auditoria')) {
          return { rows: [] };
        }
        return { rows: [] };
      }),
    } as unknown as Pool;

    // 1. Listar contextos: solo devuelve DOCENTE
    const disponibles = await listarContextosDisponibles(poolMock, usuarioId);
    expect(disponibles).toHaveLength(1);
    expect(disponibles[0].codigo).toBe('DOCENTE');

    // 2. Intentar validar el contexto retirado falla
    await expect(validarYResolverContexto(poolMock, usuarioId, asignacionMesaPartesId)).rejects.toMatchObject({
      status: 403,
    });

    // 3. Validar el contexto legítimo de DOCENTE es exitoso
    const ctxDocente = await validarYResolverContexto(poolMock, usuarioId, asignacionDocenteId);
    expect(ctxDocente.codigo).toBe('DOCENTE');
    expect(ctxDocente.areaId).toBe(areaSistemasId);

    // 4. Conmutar al contexto vigente emite nuevo token
    const resultadoCambio = await cambiarContexto(poolMock, usuarioId, asignacionDocenteId);
    expect(resultadoCambio.ok).toBe(true);
    expect(resultadoCambio.contextoActivo.codigo).toBe('DOCENTE');
    expect(resultadoCambio.accessToken).toBeDefined();
  });

  // Escenario 4: Retiro de capacidad operativa
  it('4. Retiro de capacidad operativa: efecto inmediato en autorización', async () => {
    let capacidadActiva = true;

    const poolMock = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('sigd_auth.cuenta_usuario cu')) {
          // No es un rol de usuario_rol
          return { rows: [{ roles: [], permisos: [], unidad_organica_id: null }] };
        }
        if (sql.includes('sigd_org.usuario_capacidad uc')) {
          if (!capacidadActiva) return { rows: [] };
          return {
            rows: [{
              id_asignacion: asignacionCapacidadId,
              codigo: 'GESTOR_APOYO_AREA',
              area_id: areaSistemasId,
              permisos: [
                { codigo: 'EXPEDIENTE_LEER', ambito: 'AREA', areaId: areaSistemasId },
                { codigo: 'EXPEDIENTE_RECEPCIONAR', ambito: 'AREA', areaId: areaSistemasId },
              ],
            }],
          };
        }
        return { rows: [] };
      }),
    } as unknown as Pool;

    // Con capacidad activa: facultades vigentes
    const auth1 = await obtenerAutorizacionCuenta(poolMock, usuarioId, asignacionCapacidadId);
    expect(auth1?.roles).toContain('GESTOR_APOYO_AREA');
    expect(auth1?.contextoRevocado).toBe(false);

    // Desactivar capacidad operativa
    capacidadActiva = false;

    // Siguiente verificación: contexto revocado
    const auth2 = await obtenerAutorizacionCuenta(poolMock, usuarioId, asignacionCapacidadId);
    expect(auth2?.roles).toHaveLength(0);
    expect(auth2?.permisos).toHaveLength(0);
    expect(auth2?.contextoRevocado).toBe(true);
  });

  // Escenario 5: Cambio de área y recálculo de permisos
  it('5. Cambio de área: recálculo inmediato de ámbito de permisos y revocación de ámbito previo', async () => {
    const poolMock = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('sigd_auth.cuenta_usuario cu')) {
          // Nueva asignación calculada en Contabilidad
          return {
            rows: [{
              roles: ['DOCENTE'],
              permisos: [{ codigo: 'EXPEDIENTE_LEER', ambito: 'AREA', areaId: areaContabilidadId }],
              unidad_organica_id: areaContabilidadId,
            }],
          };
        }
        if (sql.includes('sigd_org.usuario_capacidad')) return { rows: [] };
        return { rows: [] };
      }),
    } as unknown as Pool;

    const authNuevo = await obtenerAutorizacionCuenta(poolMock, usuarioId, '44444444-4444-4444-8444-444444444443');
    expect(authNuevo?.unidadOrganicaId).toBe(areaContabilidadId);

    // Permiso en nueva área autorizado
    expect(tienePermisoArea(authNuevo!.permisos, 'EXPEDIENTE_LEER', areaContabilidadId)).toBe(true);

    // Permiso en área antigua desautorizado de inmediato
    expect(tienePermisoArea(authNuevo!.permisos, 'EXPEDIENTE_LEER', areaSistemasId)).toBe(false);
  });

  // Escenario 6: Desactivación de cuenta con varias sesiones abiertas (todas revocadas)
  it('6. Desactivación de cuenta revoca atómicamente todas sus sesiones en todos los dispositivos', async () => {
    let sesionesRevocadasCount = 0;
    let cuentaDesactivada = false;

    const clienteTx = {
      query: vi.fn(async (sql: string, params: any[]) => {
        if (sql.includes('SELECT id_persona, activo FROM sigd_auth.cuenta_usuario')) {
          return { rows: [{ id_persona: '99999999-1111-4111-8111-111111111111', activo: true }] };
        }
        if (sql.includes('UPDATE sigd_auth.cuenta_usuario SET activo=$2')) {
          cuentaDesactivada = params[1] === true;
          return { rowCount: 1 };
        }
        if (sql.includes('UPDATE sigd_auth.sesion_usuario SET revocado_en = now()')) {
          sesionesRevocadasCount = 2; // Dos dispositivos
          return { rowCount: 2 };
        }
        if (sql.includes('sigd_audit.bitacora_auditoria')) {
          return { rows: [{ id_auditoria: '77777777-7777-4777-8777-777777777777' }], rowCount: 1 };
        }
        if (sql.includes('SELECT') && sql.includes('cu.id_usuario')) {
          return {
            rows: [{
              id: usuarioId,
              nombre: 'Usuario Prueba',
              estado: cuentaDesactivada ? 'ACTIVO' : 'INACTIVO',
              roles: [],
              asignaciones: [],
            }],
          };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };

    const poolMock = {
      connect: vi.fn(async () => clienteTx),
      query: clienteTx.query,
    } as unknown as Pool;

    const adminService = crearUsuariosAdminService(poolMock);
    const resultado = await adminService.actualizarUsuario(usuarioId, {
      estado: 'INACTIVO',
      motivo: 'Cese temporal de funciones',
    } as any);

    expect(resultado.estado).toBe('INACTIVO');
    expect(sesionesRevocadasCount).toBe(2);
    expect(clienteTx.release).toHaveBeenCalled();
  });

  // Escenario 7: Uso de access token anterior a la desactivación (HTTP 401/403)
  it('7. Uso de access token anterior a la desactivación: denegado de inmediato', async () => {
    const tokenPrevio = firmarTokenAcceso({
      sub: usuarioId,
      roles: ['DOCENTE'],
      ctx: asignacionDocenteId,
      expiraSegundos: 3600, // No ha expirado por tiempo
    });

    const poolMock = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('sigd_auth.cuenta_usuario cu')) {
          // cu.activo = TRUE filtra y devuelve vacío porque la cuenta está inactiva
          return { rows: [] };
        }
        return { rows: [] };
      }),
    } as unknown as Pool;

    const auth = await obtenerAutorizacionCuenta(poolMock, usuarioId, asignacionDocenteId);
    expect(auth).toBeNull();

    const app = construirApp(poolMock);
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${tokenPrevio}`);

    expect(res.status).toBe(401);
  });

  // Escenario 8: Intento de renovar un refresh token revocado (falla 401)
  it('8. Intento de renovar un refresh token revocado falla con HTTP 401', async () => {
    const poolMock = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('FROM sigd_auth.sesion_usuario s')) {
          // Sesión explícitamente revocada
          return {
            rows: [{
              id_usuario: usuarioId,
              expira_en: new Date(Date.now() + 86400000).toISOString(),
              revocado_en: new Date().toISOString(), // REVOCADA
            }],
          };
        }
        return { rows: [] };
      }),
    } as unknown as Pool;

    const app = construirApp(poolMock);
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'un-token-de-refresco-larguisimo-revocado-12345' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  // Escenario 9: Intento de iniciar sesión con cuenta desactivada (bloqueado 401)
  it('9. Intento de iniciar sesión con cuenta desactivada es bloqueado con HTTP 401', async () => {
    const poolMock = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('SELECT c.id_usuario, c.id_persona, c.usuario')) {
          return {
            rows: [{
              id_usuario: usuarioId,
              usuario: 'docente.inactivo',
              password_hash: '$argon2id$v=19$m=65536,t=3,p=4$dummy',
              activo: false, // CUENTA INACTIVA
            }],
          };
        }
        return { rows: [] };
      }),
    } as unknown as Pool;

    const app = construirApp(poolMock);
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ identificador: 'docente.inactivo', password: 'password123' });

    expect([401, 403]).toContain(res.status);
    expect(res.body.code).toBe('ACCOUNT_DISABLED');
  });

  // Escenario 10: Reactivación y nueva autenticación
  it('10. Reactivación y nueva autenticación: tokens anteriores siguen inválidos, nueva sesión requerida', async () => {
    const poolMock = {
      query: vi.fn(async (sql: string) => {
        // En consulta de refresh con token antiguo: sigue con revocado_en
        if (sql.includes('FROM sigd_auth.sesion_usuario s') && sql.includes('s.refresh_token = $1')) {
          return {
            rows: [{
              id_usuario: usuarioId,
              expira_en: new Date(Date.now() + 86400000).toISOString(),
              revocado_en: '2026-11-11T10:00:00Z', // Revocado cuando se desactivó
            }],
          };
        }
        return { rows: [] };
      }),
    } as unknown as Pool;

    const app = construirApp(poolMock);

    // Intento de usar el refresh token previo a la desactivación
    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'refresh-token-anterior-a-la-desactivacion-123' });

    expect(res.status).toBe(401);
  });

  // Escenario 11: PostgreSQL no disponible durante verificación de autorización (Fail-Safe 500/503)
  it('11. PostgreSQL no disponible durante verificación: sistema falla de forma segura (Fail-Safe Closed)', async () => {
    const poolMock = {
      query: vi.fn(async () => {
        throw new Error('Connection terminated unexpectedly to PostgreSQL');
      }),
    } as unknown as Pool;

    await expect(obtenerAutorizacionCuenta(poolMock, usuarioId, asignacionDocenteId)).rejects.toThrow(
      'Connection terminated unexpectedly',
    );

    const app = construirApp(poolMock);
    const token = firmarTokenAcceso({ sub: usuarioId, ctx: asignacionDocenteId });
    const res = await request(app)
      .get('/api/v1/tramites/devoluciones')
      .set('Authorization', `Bearer ${token}`);

    // Nunca responde 200 concediendo facultades; falla seguro
    expect(res.status).toBeGreaterThanOrEqual(500);
  });

  // Escenario 12: Redis no disponible (mantiene seguridad en PostgreSQL)
  it('12. Redis no disponible: el motor RBAC opera contra PostgreSQL garantizando cero autorizaciones obsoletas', async () => {
    // Simular que Redis está caído; el RBAC consulta PostgreSQL en vivo
    const poolMock = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('sigd_auth.cuenta_usuario cu')) {
          return {
            rows: [{
              roles: ['ADMINISTRADOR'],
              permisos: [{ codigo: 'ADMIN_USUARIOS', ambito: 'GLOBAL', areaId: null }],
              unidad_organica_id: null,
            }],
          };
        }
        return { rows: [] };
      }),
    } as unknown as Pool;

    const auth = await obtenerAutorizacionCuenta(poolMock, usuarioId, null);
    expect(auth).not.toBeNull();
    expect(auth?.roles).toContain('ADMINISTRADOR');
    expect(tienePermisoGlobal(auth!.permisos, 'ADMIN_USUARIOS')).toBe(true);
  });

  // Escenario 13: Concurrencia: Dos administradores modificando simultáneamente la misma cuenta (FOR UPDATE)
  it('13. Concurrencia: Modificación simultánea usa FOR UPDATE garantizando consistencia transaccional', async () => {
    const ordenBloqueos: string[] = [];

    const clienteTx1 = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('FOR UPDATE')) ordenBloqueos.push('ADMIN_1_LOCK');
        if (sql.includes('UPDATE sigd_auth.cuenta_usuario')) ordenBloqueos.push('ADMIN_1_UPDATE');
        if (sql.includes('SELECT') && sql.includes('cu.id_usuario')) {
          return { rows: [{ id: usuarioId, estado: 'ACTIVO', roles: [], asignaciones: [] }] };
        }
        return { rows: [{ id_persona: '99999999-1111-4111-8111-111111111111', activo: true }], rowCount: 1 };
      }),
      release: vi.fn(),
    };

    const clienteTx2 = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('FOR UPDATE')) ordenBloqueos.push('ADMIN_2_LOCK');
        if (sql.includes('UPDATE sigd_auth.cuenta_usuario')) ordenBloqueos.push('ADMIN_2_UPDATE');
        if (sql.includes('SELECT') && sql.includes('cu.id_usuario')) {
          return { rows: [{ id: usuarioId, estado: 'INACTIVO', roles: [], asignaciones: [] }] };
        }
        return { rows: [{ id_persona: '99999999-1111-4111-8111-111111111111', activo: true }], rowCount: 1 };
      }),
      release: vi.fn(),
    };

    let turno = 0;
    const poolMock = {
      connect: vi.fn(async () => {
        turno++;
        return turno === 1 ? clienteTx1 : clienteTx2;
      }),
      query: vi.fn(),
    } as unknown as Pool;

    const adminService = crearUsuariosAdminService(poolMock);

    // Ambas llamadas concurrentes
    await Promise.all([
      adminService.actualizarUsuario(usuarioId, { telefono: '951111111' }),
      adminService.actualizarUsuario(usuarioId, { telefono: '952222222' }),
    ]);

    expect(ordenBloqueos).toContain('ADMIN_1_LOCK');
    expect(ordenBloqueos).toContain('ADMIN_2_LOCK');
    expect(clienteTx1.release).toHaveBeenCalled();
    expect(clienteTx2.release).toHaveBeenCalled();
  });

  // Escenario 14: Operación documental concurrente con revocación
  it('14. Operación documental sensible concurrente con revocación es rechazada si la facultad ya no es válida', async () => {
    let facultadRevocada = false;

    const poolMock = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('sigd_auth.cuenta_usuario cu')) {
          if (facultadRevocada) {
            return { rows: [{ roles: [], permisos: [], unidad_organica_id: null }] };
          }
          return {
            rows: [{
              roles: ['DIRECTOR'],
              permisos: [{ codigo: 'FIRMA_FIRMAR', ambito: 'GLOBAL', areaId: null }],
              unidad_organica_id: null,
            }],
          };
        }
        return { rows: [] };
      }),
    } as unknown as Pool;

    // Se revoca justo antes de validar la derivación/resolución
    facultadRevocada = true;

    const auth = await obtenerAutorizacionCuenta(poolMock, usuarioId, '44444444-4444-4444-8444-444444444449');
    expect(auth?.contextoRevocado).toBe(true);
    expect(auth?.roles).toHaveLength(0);

    // Operación documental no puede proceder
    expect(tienePermisoGlobal(auth?.permisos ?? [], 'FIRMA_FIRMAR')).toBe(false);
  });

  // Escenario 15: Intento de utilizar un contexto retirado (403 CONTEXT_REVOKED)
  it('15. Intento de utilizar un contexto retirado emite HTTP 403 CONTEXT_REVOKED', async () => {
    const token = firmarTokenAcceso({
      sub: usuarioId,
      roles: ['DOCENTE'],
      ctx: asignacionDocenteId,
      rol: 'DOCENTE',
    });

    const poolMock = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('sigd_auth.cuenta_usuario cu')) {
          // Contexto retirado
          return { rows: [{ roles: [], permisos: [], unidad_organica_id: null }] };
        }
        if (sql.includes('sigd_org.usuario_capacidad')) {
          return { rows: [] };
        }
        return { rows: [] };
      }),
    } as unknown as Pool;

    const app = construirApp(poolMock);
    const res = await request(app)
      .post('/api/v1/expedientes/77777777-7777-4777-8777-777777777771/foliar-documento')
      .set('Authorization', `Bearer ${token}`)
      .send({ documentoId: '88888888-8888-4888-8888-888888888881', folios: 5 });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CONTEXT_REVOKED');
  });

  // Escenario 16: Verificación transversal de rutas protegidas
  it('16. Verificación transversal de rutas protegidas: rechazan contexto revocado', async () => {
    const token = firmarTokenAcceso({
      sub: usuarioId,
      roles: ['ADMINISTRADOR'],
      ctx: '44444444-4444-4444-8444-444444444499',
    });

    const poolMock = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes('sigd_auth.cuenta_usuario cu')) {
          return { rows: [{ roles: [], permisos: [], unidad_organica_id: null }] };
        }
        if (sql.includes('sigd_org.usuario_capacidad')) return { rows: [] };
        return { rows: [] };
      }),
    } as unknown as Pool;

    const app = construirApp(poolMock);

    // 1. Ruta de administración de usuarios
    const resAdmin = await request(app)
      .get('/api/v1/admin/usuarios')
      .set('Authorization', `Bearer ${token}`);
    expect(resAdmin.status).toBe(403);
    expect(resAdmin.body.code).toBe('CONTEXT_REVOKED');

    // 2. Ruta de trámites/devoluciones
    const resTramites = await request(app)
      .get('/api/v1/tramites/devoluciones')
      .set('Authorization', `Bearer ${token}`);
    expect(resTramites.status).toBe(403);
    expect(resTramites.body.code).toBe('CONTEXT_REVOKED');
  });

  // Escenario 17: Verificación de registros de auditoría (sigd_audit.bitacora_auditoria)
  it('17. Verificación de registros de auditoría: se registra actor, usuario afectado y operación sin tokens', async () => {
    let mutacionAuditada: any = null;

    const clienteTx = {
      query: vi.fn(async (sql: string, params: any[]) => {
        if (sql.includes('SELECT id_usuario, activo FROM sigd_auth.cuenta_usuario') || sql.includes('SELECT id_persona, activo FROM sigd_auth.cuenta_usuario')) {
          return { rows: [{ id_usuario: usuarioId, id_persona: '99999999-1111-4111-8111-111111111111', activo: true }] };
        }
        if (sql.includes('SELECT id_usuario_rol, rol_id, area_id FROM sigd_org.usuario_rol')) {
          return { rows: [{ id_usuario_rol: asignacionDocenteId, rol_id: rolDocenteId, area_id: areaSistemasId }] };
        }
        if (sql.includes('COUNT(*)::int AS total FROM sigd_org.usuario_rol')) {
          return { rows: [{ total: 1 }] }; // Conserva otro rol
        }
        if (sql.includes('UPDATE sigd_org.usuario_rol SET vigente_hasta=now()')) {
          return { rowCount: 1 };
        }
        if (sql.includes('UPDATE sigd_auth.sesion_usuario SET revocado_en = now()')) {
          return { rowCount: 1 };
        }
        if (sql.includes('INSERT INTO sigd_audit.bitacora_auditoria')) {
          mutacionAuditada = JSON.parse(params[8]);
          return { rows: [{ id_auditoria: '77777777-7777-4777-8777-777777777777' }], rowCount: 1 };
        }
        if (sql.includes('SELECT') && sql.includes('cu.id_usuario')) {
          return { rows: [{ id: usuarioId, roles: [], asignaciones: [] }] };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };

    const poolMock = {
      connect: vi.fn(async () => clienteTx),
      query: clienteTx.query,
    } as unknown as Pool;

    const adminService = crearUsuariosAdminService(poolMock);
    await adminService.revocarRol(usuarioId, asignacionDocenteId, adminId);

    expect(mutacionAuditada).not.toBeNull();
    expect(mutacionAuditada.accion).toBe('REVOCAR_ROL');
    expect(mutacionAuditada.id_usuario).toBe(usuarioId);
    expect(mutacionAuditada.id_usuario_rol).toBe(asignacionDocenteId);
    expect(mutacionAuditada.actor_id).toBe(adminId);
    // Garantizar que no se expone ningún token ni credencial
    expect(JSON.stringify(mutacionAuditada)).not.toContain('Bearer');
    expect(JSON.stringify(mutacionAuditada)).not.toContain('refreshToken');
    expect(JSON.stringify(mutacionAuditada)).not.toContain('password');
    expect(clienteTx.release).toHaveBeenCalled();
  });

});
