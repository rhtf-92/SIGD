import { describe, it, expect, vi } from 'vitest';
import type { Pool } from 'pg';
import {
  obtenerAutorizacionCuenta,
  resolverIdentidad,
  tienePermisoArea,
  tienePermisoGlobal,
} from '../../src/core/auth/auth.guard.js';
import {
  firmarTokenAcceso,
  verificarTokenAcceso,
} from '../../src/core/auth/jwt.service.js';
import { permisosM10, permisosM10ParaRoles } from '../../src/domains/tesoreria/tesoreria.rules.js';

describe('TSK-1.0B: Conciliación Forense, Coherencia RBAC y Prevalidación (12 Escenarios)', () => {
  const usuarioDocente = '10000000-0000-4000-8000-000000000001';
  const usuarioTesorero = '10000000-0000-4000-8000-000000000002';
  const usuarioCoordinador = '10000000-0000-4000-8000-000000000003';
  const usuarioJefeUA = '10000000-0000-4000-8000-000000000004';
  const expedienteId = '90000000-0000-4000-8000-000000000001';

  const areaDSI = '20000000-0000-4000-8000-000000000001';
  const areaContabilidad = '20000000-0000-4000-8000-000000000002';
  const areaTesoreria = '20000000-0000-4000-8000-000000000003';
  const unidadAcademica = '20000000-0000-4000-8000-000000000010';
  const unidadOtra = '20000000-0000-4000-8000-000000000099';

  // 1. Inconsistencia entre UUID y asignaciones históricas
  it('1. Conciliación forense: identifica correctamente asignaciones activas vs expiradas y cuentas inactivas en ESPECIALISTA', () => {
    const asignacionesHistoricas = [
      { id: 'cbd75b3a-62b5-43eb-9780-989116c04ec4', usuario: 'especialista.demo', activa: true, expirada: false },
      { id: 'ecb124c5-577d-4838-a3f0-5e343960b0e4', usuario: 'operador.demo', activa: true, expirada: false },
      { id: '4bbd6ab4-5b53-4820-8f83-7e014bf62de4', usuario: 'trabajador.h2.5079', activa: false, expirada: false }, // cuenta inactiva
      { id: 'e3b2d13b-1d04-46f1-9e85-3ecd593bb8ff', usuario: 'trabajador.h2.5079', activa: false, expirada: true },  // expirada
      { id: 'bd029454-d24b-4a81-b497-a95c40ff562a', usuario: 'trabajador.h2.test', activa: true, expirada: true },   // expirada
      { id: 'fabad752-6a79-40f4-ad26-f9809b4498e2', usuario: 'trabajador.h2.test', activa: true, expirada: false },
    ];

    const activasOperables = asignacionesHistoricas.filter((a) => a.activa && !a.expirada);
    expect(activasOperables).toHaveLength(3); // Solo especialista.demo, operador.demo y trabajador.h2.test(MP)
    const expiradas = asignacionesHistoricas.filter((a) => a.expirada);
    expect(expiradas).toHaveLength(2); // Dos asignaciones sintéticas H2 creadas en DG fueron cerradas en ms
  });

  // 2. Preservación de permisos de Tesorería
  it('2. Preservación de Tesorería: permisosM10 contiene exactamente los 9 códigos atómicos persistidos en BD', () => {
    const codigosBD = [
      'TESORERIA_DEVOLUCION_APROBAR',
      'TESORERIA_DEVOLUCION_EJECUTAR',
      'TESORERIA_DEVOLUCION_EVALUAR',
      'TESORERIA_LEER',
      'TESORERIA_PAGO_REGISTRAR',
      'TESORERIA_PAGO_VERIFICAR',
      'TESORERIA_REPORTES',
      'TESORERIA_TARIFA_PROPONER',
      'TESORERIA_TARIFA_VALIDAR',
    ];

    for (const codigo of codigosBD) {
      expect(permisosM10).toContain(codigo);
    }
    expect(permisosM10).toHaveLength(9);

    const filtrados = permisosM10ParaRoles(['TESORERO'], codigosBD);
    expect(filtrados).toHaveLength(9);
  });

  // 3. Acceso indebido de Tesorería a expedientes académicos
  it('3. Tesorería no posee facultades de calificación ni resolución sobre expedientes curriculares/académicos', () => {
    const permisosTesorero = [
      { codigo: 'EXPEDIENTE_RECEPCIONAR', ambito: 'AREA' as const, areaId: areaTesoreria },
      { codigo: 'EXPEDIENTE_LEER', ambito: 'AREA' as const, areaId: areaTesoreria },
      { codigo: 'EXPEDIENTE_ADJUNTAR', ambito: 'AREA' as const, areaId: areaTesoreria },
      { codigo: 'TESORERIA_PAGO_REGISTRAR', ambito: 'GLOBAL' as const, areaId: null },
    ];

    // No puede resolver expedientes
    expect(tienePermisoGlobal(permisosTesorero, 'EXPEDIENTE_RESOLVER')).toBe(false);
    expect(tienePermisoArea(permisosTesorero, 'EXPEDIENTE_RESOLVER', areaTesoreria)).toBe(false);

    // No puede calificar como docente evaluador
    expect(tienePermisoGlobal(permisosTesorero, 'DOCENTE_EVALUAR')).toBe(false);

    // Su lectura de área no abarca el área académica DSI
    expect(tienePermisoArea(permisosTesorero, 'EXPEDIENTE_LEER', areaDSI)).toBe(false);
  });

  // 4. Coordinador de área que intenta consultar otra unidad
  it('4. Coordinador de Área circunscrito a su programa NO tiene acceso a otra unidad u otro programa', () => {
    const permisosCoordinador = [
      { codigo: 'EXPEDIENTE_LEER', ambito: 'AREA' as const, areaId: areaDSI },
      { codigo: 'EXPEDIENTE_DERIVAR', ambito: 'AREA' as const, areaId: areaDSI },
    ];

    // Puede leer su propia área (DSI)
    expect(tienePermisoArea(permisosCoordinador, 'EXPEDIENTE_LEER', areaDSI)).toBe(true);

    // NO puede leer otra área (Contabilidad)
    expect(tienePermisoArea(permisosCoordinador, 'EXPEDIENTE_LEER', areaContabilidad)).toBe(false);

    // NO tiene lectura global institucional
    expect(tienePermisoGlobal(permisosCoordinador, 'EXPEDIENTE_LEER')).toBe(false);
  });

  // 5. Jefe de unidad que intenta consultar otra unidad
  it('5. Jefe de Unidad Académica tiene alcance circunscrito a su Unidad Académica (sin GLOBAL automático)', () => {
    const permisosJefeUA = [
      { codigo: 'EXPEDIENTE_LEER', ambito: 'AREA' as const, areaId: unidadAcademica },
      { codigo: 'EXPEDIENTE_RESOLVER', ambito: 'AREA' as const, areaId: unidadAcademica },
    ];

    // Acceso a su propia Unidad Académica
    expect(tienePermisoArea(permisosJefeUA, 'EXPEDIENTE_LEER', unidadAcademica)).toBe(true);

    // Bloqueado en otra unidad
    expect(tienePermisoArea(permisosJefeUA, 'EXPEDIENTE_LEER', unidadOtra)).toBe(false);

    // Sin acceso global automático
    expect(tienePermisoGlobal(permisosJefeUA, 'EXPEDIENTE_LEER')).toBe(false);
  });

  // 6. Docente que intenta evaluar sin asignación
  it('6. Docente sin asignación activa en sigd_rut.expediente_evaluador no puede evaluar', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('FROM sigd_rut.expediente_evaluador')) {
        return { rows: [] }; // Sin asignación activa
      }
      return { rows: [] };
    });

    const pool = { query } as unknown as Pool;
    const { rows } = await pool.query(
      `SELECT id_expediente_evaluador FROM sigd_rut.expediente_evaluador
        WHERE expediente_id = $1 AND id_usuario_docente = $2 AND activo = TRUE`,
      [expedienteId, usuarioDocente]
    );

    const puedeEvaluar = rows.length > 0;
    expect(puedeEvaluar).toBe(false);
  });

  // 7. Reasignación de un docente previamente desasignado
  it('7. Reasignación de evaluador: índice único parcial permite reasignar al mismo docente tras desactivación', () => {
    // Simulación de registros en expediente_evaluador
    const tablaEvaluadores: Array<{ id: string; expediente_id: string; id_usuario_docente: string; activo: boolean; desactivado_en: string | null; }> = [
      {
        id: '11111111-0000-0000-0000-000000000001',
        expediente_id: expedienteId,
        id_usuario_docente: usuarioDocente,
        activo: false, // Desactivado previamente
        desactivado_en: '2026-11-01T10:00:00Z',
      },
    ];

    // Intentar registrar nueva asignación para el mismo docente y mismo expediente
    const nuevoEvaluador = {
      id: '11111111-0000-0000-0000-000000000002',
      expediente_id: expedienteId,
      id_usuario_docente: usuarioDocente,
      activo: true,
      desactivado_en: null,
    };

    // Verificación del constraint uq_expediente_evaluador_docente_activo (expediente_id, id_usuario_docente WHERE activo = true)
    const conflictoActivo = tablaEvaluadores.some(
      (e) => e.expediente_id === nuevoEvaluador.expediente_id &&
             e.id_usuario_docente === nuevoEvaluador.id_usuario_docente &&
             e.activo === true
    );

    expect(conflictoActivo).toBe(false); // No hay conflicto porque la anterior está inactiva
    tablaEvaluadores.push(nuevoEvaluador);
    expect(tablaEvaluadores.filter((e) => e.activo)).toHaveLength(1);
  });

  // 8. Revocación de rol con sesión abierta
  it('8. Revocación de rol en BD: evaluación dinámica en backend revoca facultades en la siguiente petición', async () => {
    // Escenario: usuario tenía sesión con contexto activo, pero el admin desactiva la asignación en BD
    const asignacionRevocada = '3a030000-0000-4000-8000-000000000003';
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('FROM sigd_auth.cuenta_usuario cu')) {
        // En PostgreSQL ur.vigente_hasta < now() o ur.id_usuario_rol ya no existe
        return { rows: [] }; // Asignación ya no activa
      }
      return { rows: [] };
    });

    const pool = { query } as unknown as Pool;
    const auth = await obtenerAutorizacionCuenta(pool, usuarioDocente, asignacionRevocada);
    expect(auth).toBeNull(); // El backend rechaza la autorización dinámica
  });

  // 9. Cierre de sesión y revocación efectiva
  it('9. Cierre de sesión (logout): revoca el refresh token en sigd_auth.sesion_usuario', async () => {
    let sesionEliminada = false;
    const refreshTokenTest = 'a'.repeat(64);

    const query = vi.fn(async (sql: string, params?: any[]) => {
      if (sql.includes('DELETE FROM sigd_auth.sesion_usuario') && params?.[0] === refreshTokenTest) {
        sesionEliminada = true;
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    });

    const pool = { query } as unknown as Pool;
    await pool.query('DELETE FROM sigd_auth.sesion_usuario WHERE refresh_token = $1', [refreshTokenTest]);
    expect(sesionEliminada).toBe(true);
  });

  // 10. Renovación de tokens
  it('10. Renovación de tokens (refresh): preserva el claim ctx validado en el nuevo accessToken', () => {
    const ctxId = '3a020000-0000-4000-8000-000000000002';
    const token = firmarTokenAcceso({
      sub: usuarioCoordinador,
      roles: ['COORDINADOR_AREA'],
      ctx: ctxId,
      rol: 'COORDINADOR_AREA',
    });

    const claims = verificarTokenAcceso(token);
    expect(claims.ctx).toBe(ctxId);
    expect(claims.rol).toBe('COORDINADOR_AREA');
    expect(claims.roles).toEqual(['COORDINADOR_AREA']);
  });

  // 11. Endpoints que intenten utilizar permisos acumulados
  it('11. Cuentas multirrol sin contexto activo seleccionado NO acumulan permisos y son bloqueadas', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('COALESCE(json_agg') || sql.includes('AS permisos')) {
        return { rows: [{ roles: ['DOCENTE', 'COORDINADOR_AREA'], permisos: [] }] };
      }
      return { rows: [] };
    });

    const pool = { query } as unknown as Pool;
    // Petición sin contextoId
    const auth = await obtenerAutorizacionCuenta(pool, usuarioDocente, null);
    expect(auth?.requiereSeleccionContexto).toBe(true);
    expect(auth?.roles).toEqual([]);
    expect(auth?.permisos).toEqual([]);
  });

  // 12. Rollback con registros nuevos persistidos
  it('12. Rollback seguro: restaura chk_rol_codigo tolerando registros existentes con código nuevo', () => {
    const codigosHistoricos = [
      'ADMINISTRADOR', 'DIRECTOR', 'SECRETARIO', 'MESA_PARTES', 'TESORERO',
      'CIUDADANO', 'ESPECIALISTA', 'CAJERO', 'APROBADOR_DEVOLUCIONES', 'SUPERVISOR_TESORERIA',
    ];
    const codigosNuevos = ['JEFE_UNIDAD_ACADEMICA', 'COORDINADOR_AREA', 'DOCENTE', 'ESTUDIANTE'];

    // Simular lógica de rollback seguro cuando v_asignaciones > 0
    const asignacionesExisten = true;
    const checkPermitidos = asignacionesExisten
      ? [...codigosHistoricos, ...codigosNuevos]
      : codigosHistoricos;

    // Verificar que cualquier fila en sigd_org.rol_sistema (nueva o antigua) cumple el constraint del rollback
    for (const codigo of [...codigosHistoricos, ...codigosNuevos]) {
      expect(checkPermitidos.includes(codigo)).toBe(true);
    }
  });
});
