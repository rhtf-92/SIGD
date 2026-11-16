import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import { obtenerAutorizacionCuenta } from '../../../../src/core/auth/auth.guard.js';
import { crearUsuariosAdminService } from '../../../../src/domains/organicore/usuariosAdmin.service.js';

const USUARIO_ID = '10000000-0000-4000-8000-000000000001';
const ADMIN_ID = '20000000-0000-4000-8000-000000000001';
const AREA_ID = '30000000-0000-4000-8000-000000000001';
const CAPACIDAD_ID = '40000000-0000-4000-8000-000000000001';
const ASIGNACION_ID = '50000000-0000-4000-8000-000000000001';

describe('R1: Capacidades Operativas — Conciliación de Esquema y Control de Acceso', () => {

  describe('1. Consulta de capacidades (auth.guard.ts)', () => {
    it('1.1. La consulta utiliza JOIN con capacidad_sistema y no contiene uc.codigo', async () => {
      let sqlEjecutado = '';
      const pool = {
        query: vi.fn(async (sql: string) => {
          sqlEjecutado = sql;
          if (sql.includes('sigd_auth.cuenta_usuario')) {
            // Sin roles directos para forzar consulta de capacidad operativa
            return {
              rows: [{
                roles: [],
                permisos: [],
                unidad_organica_id: null,
              }],
            };
          }
          if (sql.includes('sigd_org.usuario_capacidad')) {
            return {
              rows: [{
                id_asignacion: ASIGNACION_ID,
                codigo: 'GESTOR_APOYO_AREA',
                area_id: AREA_ID,
                permisos: [
                  { codigo: 'EXPEDIENTE_LEER', ambito: 'GLOBAL', areaId: null },
                  { codigo: 'EXPEDIENTE_RECEPCIONAR', ambito: 'AREA', areaId: AREA_ID },
                  { codigo: 'EXPEDIENTE_ADJUNTAR', ambito: 'AREA', areaId: AREA_ID },
                  { codigo: 'EXPEDIENTE_DERIVAR', ambito: 'AREA', areaId: AREA_ID },
                ],
              }],
            };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const auth = await obtenerAutorizacionCuenta(pool, USUARIO_ID, ASIGNACION_ID);

      // Verificación de sintaxis SQL
      expect(sqlEjecutado).not.toContain('uc.codigo');
      expect(sqlEjecutado).toContain('cs.codigo AS codigo');
      expect(sqlEjecutado).toContain('JOIN sigd_org.capacidad_sistema cs ON cs.id_capacidad = uc.id_capacidad AND cs.vigente = TRUE');
      expect(sqlEjecutado).toContain('GROUP BY uc.id_usuario_capacidad, cs.codigo, uc.area_id');

      // Verificación de resultado
      expect(auth).not.toBeNull();
      expect(auth?.roles).toEqual(['GESTOR_APOYO_AREA']);
      expect(auth?.unidadOrganicaId).toBe(AREA_ID);
      expect(auth?.contextoActivoId).toBe(ASIGNACION_ID);
      expect(auth?.requiereSeleccionContexto).toBe(false);
      expect(auth?.contextoRevocado).toBe(false);
    });

    it('1.2. Sanitiza y restringe permisos: EXPEDIENTE_LEER queda confinado a AREA y se eliminan prohibidos', async () => {
      const pool = {
        query: vi.fn(async (sql: string) => {
          if (sql.includes('sigd_auth.cuenta_usuario')) {
            return { rows: [{ roles: [], permisos: [], unidad_organica_id: null }] };
          }
          if (sql.includes('sigd_org.usuario_capacidad')) {
            return {
              rows: [{
                id_asignacion: ASIGNACION_ID,
                codigo: 'GESTOR_APOYO_AREA',
                area_id: AREA_ID,
                permisos: [
                  { codigo: 'EXPEDIENTE_LEER', ambito: 'GLOBAL', areaId: null },
                  { codigo: 'EXPEDIENTE_FIRMAR', ambito: 'AREA', areaId: AREA_ID }, // PROHIBIDO
                  { codigo: 'EXPEDIENTE_ASIGNAR', ambito: 'AREA', areaId: AREA_ID }, // PROHIBIDO
                  { codigo: 'EXPEDIENTE_REASIGNAR', ambito: 'AREA', areaId: AREA_ID }, // PROHIBIDO
                  { codigo: 'EXPEDIENTE_EVALUAR', ambito: 'AREA', areaId: AREA_ID }, // PROHIBIDO
                  { codigo: 'ADMIN_USUARIOS', ambito: 'AREA', areaId: AREA_ID }, // PROHIBIDO
                  { codigo: 'EXPEDIENTE_RECEPCIONAR', ambito: 'AREA', areaId: AREA_ID },
                  { codigo: 'EXPEDIENTE_DERIVAR', ambito: 'AREA', areaId: AREA_ID },
                  { codigo: 'EXPEDIENTE_ADJUNTAR', ambito: 'AREA', areaId: AREA_ID },
                ],
              }],
            };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const auth = await obtenerAutorizacionCuenta(pool, USUARIO_ID, ASIGNACION_ID);
      expect(auth).not.toBeNull();

      const codigosPermisos = auth?.permisos.map((p) => p.codigo);
      expect(codigosPermisos).toContain('EXPEDIENTE_LEER');
      expect(codigosPermisos).toContain('EXPEDIENTE_RECEPCIONAR');
      expect(codigosPermisos).toContain('EXPEDIENTE_DERIVAR');
      expect(codigosPermisos).toContain('EXPEDIENTE_ADJUNTAR');

      // Prohibidos eliminados
      expect(codigosPermisos).not.toContain('EXPEDIENTE_FIRMAR');
      expect(codigosPermisos).not.toContain('EXPEDIENTE_ASIGNAR');
      expect(codigosPermisos).not.toContain('EXPEDIENTE_REASIGNAR');
      expect(codigosPermisos).not.toContain('EXPEDIENTE_EVALUAR');
      expect(codigosPermisos).not.toContain('ADMIN_USUARIOS');

      // Ámbito de EXPEDIENTE_LEER ajustado a AREA
      const permisoLeer = auth?.permisos.find((p) => p.codigo === 'EXPEDIENTE_LEER');
      expect(permisoLeer?.ambito).toBe('AREA');
      expect(permisoLeer?.areaId).toBe(AREA_ID);
    });

    it('1.3. Capacidad vencida o inactiva no se considera vigente y revoca el contexto', async () => {
      const pool = {
        query: vi.fn(async (sql: string) => {
          if (sql.includes('sigd_auth.cuenta_usuario')) {
            return { rows: [{ roles: [], permisos: [], unidad_organica_id: null }] };
          }
          if (sql.includes('sigd_org.usuario_capacidad')) {
            // No devuelve filas porque activo=FALSE o vigente_hasta expiró
            return { rows: [] };
          }
          return { rows: [] };
        }),
      } as unknown as Pool;

      const auth = await obtenerAutorizacionCuenta(pool, USUARIO_ID, ASIGNACION_ID);
      expect(auth).not.toBeNull();
      expect(auth?.contextoRevocado).toBe(true);
      expect(auth?.roles).toEqual([]);
      expect(auth?.permisos).toEqual([]);
      expect(auth?.requiereSeleccionContexto).toBe(true);
    });
  });

  describe('2. Registro administrativo de capacidades (usuariosAdmin.service.ts)', () => {
    it('2.1. Inserción compatible: no inserta uc.codigo e incluye justificacion y asignado_por', async () => {
      let sqlInsert = '';
      let paramsInsert: unknown[] = [];

      const mockClient = {
        query: vi.fn(async (sql: string, params?: unknown[]) => {
          if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return {};
          if (sql.includes('FROM sigd_auth.cuenta_usuario WHERE id_usuario=')) {
            return { rows: [{ id_usuario: USUARIO_ID, activo: true }] };
          }
          if (sql.includes('FROM sigd_org.area')) {
            return { rows: [{ area_id: AREA_ID }] };
          }
          if (sql.includes('FROM sigd_org.capacidad_sistema')) {
            return { rows: [{ id_capacidad: CAPACIDAD_ID }] };
          }
          if (sql.includes('FROM sigd_org.usuario_capacidad') && sql.includes('SELECT id_usuario_capacidad')) {
            return { rows: [] }; // No existe asignación previa
          }
          if (sql.includes('INSERT INTO sigd_org.usuario_capacidad')) {
            sqlInsert = sql;
            paramsInsert = params ?? [];
            return { rows: [{ id_usuario_capacidad: ASIGNACION_ID }] };
          }
          if (sql.includes('sigd_audit.mutacion_registro')) {
            return { rows: [] };
          }
          // SELECT_USUARIOS para retornar usuario
          return {
            rows: [{
              id: USUARIO_ID,
              nombre: 'Usuario Demo',
              nombres: 'Usuario',
              apellidos: 'Demo',
              tipoPersona: 'NATURAL',
              dni: '12345678',
              correo: 'usuario@iestpsuiza.edu.pe',
              sede: null,
              area: 'Área Académica',
              cargo: 'Apoyo',
              rol: null,
              estado: 'ACTIVO',
              ultimoAcceso: null,
              asignaciones: [],
              roles: [],
            }],
          };
        }),
        release: vi.fn(),
      };

      const mockPool = {
        connect: vi.fn(async () => mockClient),
        query: mockClient.query,
      } as unknown as Pool;

      const service = crearUsuariosAdminService(mockPool);
      const resultado = await service.asignarCapacidad(
        USUARIO_ID,
        'GESTOR_APOYO_AREA',
        AREA_ID,
        ADMIN_ID,
        'Asignación para apoyo extraordinario en mesa de partes',
      );

      expect(resultado).toBeDefined();
      expect(sqlInsert).not.toContain('codigo');
      expect(sqlInsert).toContain('INSERT INTO sigd_org.usuario_capacidad');
      expect(sqlInsert).toContain('justificacion');
      expect(sqlInsert).toContain('asignado_por');
      expect(sqlInsert).toContain('area_id');
      expect(sqlInsert).toContain('id_capacidad');
      expect(sqlInsert).toContain('id_usuario');

      // Parámetros: [id, idCapacidad, areaId, justificacionFinal, actorAutenticado]
      expect(paramsInsert[0]).toBe(USUARIO_ID);
      expect(paramsInsert[1]).toBe(CAPACIDAD_ID);
      expect(paramsInsert[2]).toBe(AREA_ID);
      expect(paramsInsert[3]).toBe('Asignación para apoyo extraordinario en mesa de partes');
      expect(paramsInsert[4]).toBe(ADMIN_ID);
    });

    it('2.2. Rechaza asignación duplicada con HTTP 409 CAPACIDAD_YA_ASIGNADA', async () => {
      const mockClient = {
        query: vi.fn(async (sql: string) => {
          if (sql === 'BEGIN' || sql === 'ROLLBACK') return {};
          if (sql.includes('FROM sigd_auth.cuenta_usuario WHERE id_usuario=')) {
            return { rows: [{ id_usuario: USUARIO_ID, activo: true }] };
          }
          if (sql.includes('FROM sigd_org.area')) {
            return { rows: [{ area_id: AREA_ID }] };
          }
          if (sql.includes('FROM sigd_org.capacidad_sistema')) {
            return { rows: [{ id_capacidad: CAPACIDAD_ID }] };
          }
          if (sql.includes('FROM sigd_org.usuario_capacidad') && sql.includes('SELECT id_usuario_capacidad')) {
            // Ya existe una asignación activa
            return { rows: [{ id_usuario_capacidad: ASIGNACION_ID }] };
          }
          return { rows: [] };
        }),
        release: vi.fn(),
      };

      const mockPool = {
        connect: vi.fn(async () => mockClient),
      } as unknown as Pool;

      const service = crearUsuariosAdminService(mockPool);
      await expect(
        service.asignarCapacidad(USUARIO_ID, 'GESTOR_APOYO_AREA', AREA_ID, ADMIN_ID),
      ).rejects.toMatchObject({
        status: 409,
        code: 'CAPACIDAD_YA_ASIGNADA',
      });
    });

    it('2.3. Revocación auditable: marca activo=FALSE y registra desactivado_por, desactivado_en y motivo', async () => {
      let sqlUpdate = '';
      let paramsUpdate: unknown[] = [];

      const mockClient = {
        query: vi.fn(async (sql: string, params?: unknown[]) => {
          if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return {};
          if (sql.includes('FROM sigd_auth.cuenta_usuario WHERE id_usuario=')) {
            return { rows: [{ id_usuario: USUARIO_ID, activo: true }] };
          }
          if (sql.includes('FROM sigd_org.usuario_capacidad') && sql.includes('FOR UPDATE')) {
            return {
              rows: [{
                id_usuario_capacidad: ASIGNACION_ID,
                id_capacidad: CAPACIDAD_ID,
                area_id: AREA_ID,
              }],
            };
          }
          if (sql.includes('UPDATE sigd_org.usuario_capacidad')) {
            sqlUpdate = sql;
            paramsUpdate = params ?? [];
            return { rowCount: 1 };
          }
          if (sql.includes('sigd_audit.mutacion_registro')) {
            return { rows: [] };
          }
          return {
            rows: [{
              id: USUARIO_ID,
              nombre: 'Usuario Demo',
              nombres: 'Usuario',
              apellidos: 'Demo',
              tipoPersona: 'NATURAL',
              dni: '12345678',
              correo: 'usuario@iestpsuiza.edu.pe',
              sede: null,
              area: null,
              cargo: null,
              rol: null,
              estado: 'ACTIVO',
              ultimoAcceso: null,
              asignaciones: [],
              roles: [],
            }],
          };
        }),
        release: vi.fn(),
      };

      const mockPool = {
        connect: vi.fn(async () => mockClient),
        query: mockClient.query,
      } as unknown as Pool;

      const service = crearUsuariosAdminService(mockPool);
      await service.revocarCapacidad(USUARIO_ID, ASIGNACION_ID, ADMIN_ID, 'Término de la asignación temporal');

      expect(sqlUpdate).toContain('UPDATE sigd_org.usuario_capacidad');
      expect(sqlUpdate).toContain('desactivado_por = $2::uuid');
      expect(sqlUpdate).toContain('desactivado_en = now()');
      expect(sqlUpdate).toContain('motivo_desactivacion = COALESCE($3');
      expect(paramsUpdate[0]).toBe(ASIGNACION_ID);
      expect(paramsUpdate[1]).toBe(ADMIN_ID);
      expect(paramsUpdate[2]).toBe('Término de la asignación temporal');
    });
  });

});
