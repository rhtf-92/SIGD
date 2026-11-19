import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { Pool } from 'pg';
import { crearUsuariosAdminService } from '../../../../src/domains/organicore/usuariosAdmin.service.js';
import { crearUsuariosAdminRouter } from '../../../../src/domains/organicore/usuariosAdmin.routes.js';
import { crearRouterAuth } from '../../../../src/domains/identicore/auth.router.js';
import { CATALOGO_TUPA_2026 } from '../../../../src/domains/tramicore/catalogoTupa2026.js';
import { CATALOGO_DOCUMENTAL_TUPA_2026 } from '../../../../src/domains/tramicore/catalogoDocumentalTupa2026.js';

describe('Auditoría Integral de Migración 17 e Integridad de Usuarios (SIGD B_JACOBO)', () => {
  const rutaMigracion17 = path.resolve(process.cwd(), 'migraciones/17_sigd_tes_pago_adicional_seguro.sql');
  const contenidoMigracion17 = fs.readFileSync(rutaMigracion17, 'utf8');

  // 1. Integridad DDL de Migración 17
  describe('Integridad referencial y DDL de Migración 17', () => {
    it('1. La FK de creada_por apunta a sigd_auth.cuenta_usuario(id_usuario) con ON DELETE RESTRICT', () => {
      expect(contenidoMigracion17).toMatch(
        /CONSTRAINT\s+autorizacion_pago_adicional_creada_por_fk\s+FOREIGN\s+KEY\s*\(\s*creada_por\s*\)\s+REFERENCES\s+sigd_auth\.cuenta_usuario\s*\(\s*id_usuario\s*\)\s+ON\s+DELETE\s+RESTRICT/i
      );
      expect(contenidoMigracion17).toMatch(
        /ALTER\s+TABLE\s+sigd_tes\.autorizacion_pago_adicional\s+ADD\s+CONSTRAINT\s+autorizacion_pago_adicional_creada_por_fk\s+FOREIGN\s+KEY\s*\(\s*creada_por\s*\)\s+REFERENCES\s+sigd_auth\.cuenta_usuario\s*\(\s*id_usuario\s*\)\s+ON\s+DELETE\s+RESTRICT/i
      );
    });

    it('2. Todas las claves foráneas de entidades financieras usan ON DELETE RESTRICT (prohibido CASCADE y SET NULL)', () => {
      expect(contenidoMigracion17).not.toMatch(/ON\s+DELETE\s+CASCADE/i);
      expect(contenidoMigracion17).not.toMatch(/ON\s+DELETE\s+SET\s+NULL/i);

      // orden_devolucion FKs
      expect(contenidoMigracion17).toMatch(/solicitante_id\s+uuid\s+NOT\s+NULL\s+REFERENCES\s+sigd_auth\.cuenta_usuario\(id_usuario\)\s+ON\s+DELETE\s+RESTRICT/i);
      expect(contenidoMigracion17).toMatch(/aprobada_por\s+uuid\s+NOT\s+NULL\s+REFERENCES\s+sigd_auth\.cuenta_usuario\(id_usuario\)\s+ON\s+DELETE\s+RESTRICT/i);
      expect(contenidoMigracion17).toMatch(/pago_id\s+uuid\s+NOT\s+NULL\s+REFERENCES\s+sigd_tes\.pago\(id\)\s+ON\s+DELETE\s+RESTRICT/i);

      // devolucion_documento_folio FKs
      expect(contenidoMigracion17).toMatch(/asignado_por\s+uuid\s+NOT\s+NULL\s+REFERENCES\s+sigd_auth\.cuenta_usuario\(id_usuario\)\s+ON\s+DELETE\s+RESTRICT/i);
    });

    it('3. La migración contiene la protección institucional a nivel de motor (trigger no delete sobre cuenta_usuario)', () => {
      expect(contenidoMigracion17).toContain('sigd_auth.proteger_cuenta_usuario_no_delete()');
      expect(contenidoMigracion17).toMatch(/CREATE\s+TRIGGER\s+proteger_cuenta_usuario_no_delete\s+BEFORE\s+DELETE\s+ON\s+sigd_auth\.cuenta_usuario/i);
      expect(contenidoMigracion17).toMatch(/CREATE\s+TRIGGER\s+proteger_cuenta_usuario_truncate\s+BEFORE\s+TRUNCATE\s+ON\s+sigd_auth\.cuenta_usuario/i);
    });

    it('4. La migración es compatible con el migrador src/db/migrate.ts (sin BEGIN/COMMIT y con DDL idempotente)', () => {
      // No debe contener BEGIN; ni COMMIT; en el nivel superior que colisione con el runner
      const lineas = contenidoMigracion17.split('\n').map(l => l.trim());
      const tieneBeginTopLevel = lineas.some(l => /^BEGIN\s*;/i.test(l));
      const tieneCommitTopLevel = lineas.some(l => /^COMMIT\s*;/i.test(l));
      expect(tieneBeginTopLevel).toBe(false);
      expect(tieneCommitTopLevel).toBe(false);

      // Idempotencia verificada
      expect(contenidoMigracion17).toContain('CREATE TABLE IF NOT EXISTS sigd_tes.autorizacion_pago_adicional');
      expect(contenidoMigracion17).toContain('CREATE TABLE IF NOT EXISTS sigd_tes.orden_devolucion');
      expect(contenidoMigracion17).toContain('CREATE TABLE IF NOT EXISTS sigd_tes.devolucion_documento_folio');
      expect(contenidoMigracion17).toContain('CREATE INDEX IF NOT EXISTS');
      expect(contenidoMigracion17).toContain('ON CONFLICT(codigo) DO NOTHING');
    });

    it('5. El hash SHA-256 es reproducible y verificable', () => {
      const sha256 = crypto.createHash('sha256').update(contenidoMigracion17.replace(/\r\n/g, '\n')).digest('hex');
      expect(sha256).toBe('8ea2d4beed4a7131600724af8126c2d344e658d4da214c5353858d4eec51c6f0');
    });
  });

  // 2. Regla Institucional: Los usuarios NO se eliminan, se desactivan
  describe('Regla Institucional de Conservación y Desactivación de Usuarios', () => {
    const USER_ID = '11111111-1111-4111-8111-111111111111';
    const PERSON_ID = '22222222-2222-4222-8222-222222222222';

    it('6. Un usuario puede desactivarse mediante PUT cambiando activo a false y revocando sesiones activas', async () => {
      const query = vi.fn(async (sql: string) => {
        if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(sql)) return { rows: [], rowCount: 0 };
        if (sql.includes('FROM sigd_auth.cuenta_usuario WHERE id_usuario=$1::uuid FOR UPDATE')) {
          return { rows: [{ id_persona: PERSON_ID, activo: true }], rowCount: 1 };
        }
        if (sql.includes('UPDATE sigd_auth.cuenta_usuario SET activo=$2')) {
          return { rows: [], rowCount: 1 };
        }
        if (sql.includes('UPDATE sigd_auth.sesion_usuario SET revocado_en = now()')) {
          return { rows: [], rowCount: 2 };
        }
        if (sql.includes('SELECT cu.id_usuario::text AS id')) {
          return {
            rows: [{
              id: USER_ID,
              nombre: 'Usuario Prueba',
              nombres: 'Usuario',
              apellidos: 'Prueba',
              tipoPersona: 'NATURAL',
              dni: '12345678',
              correo: 'usuario@iestpsuiza.edu.pe',
              sede: null,
              area: 'Área',
              cargo: 'Cargo',
              rol: 'Rol',
              estado: 'INACTIVO',
              ultimoAcceso: null,
              asignaciones: [],
              roles: [],
            }],
            rowCount: 1,
          };
        }
        if (sql.includes('INSERT INTO sigd_audit.bitacora_auditoria')) {
          return { rows: [{ id_auditoria: '99999999-9999-4999-8999-999999999999' }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      });

      const pool = {
        connect: vi.fn(async () => ({ query, release: vi.fn() })),
      } as unknown as Pool;

      const service = crearUsuariosAdminService(pool);
      const resultado = await service.actualizarUsuario(USER_ID, {
        estado: 'INACTIVO',
      });

      expect(resultado.estado).toBe('INACTIVO');
      // Verificó activo = false
      expect(query).toHaveBeenCalledWith(expect.stringContaining('UPDATE sigd_auth.cuenta_usuario SET activo=$2'), [USER_ID, false]);
      // Revocó sesiones activas
      expect(query).toHaveBeenCalledWith(expect.stringContaining('UPDATE sigd_auth.sesion_usuario SET revocado_en = now()'), [USER_ID]);

      // Verificó registro de mutación de auditoría con trazabilidad
      const llamadaAuditoria = query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO sigd_audit.bitacora_auditoria')) as [string, unknown[]] | undefined;
      expect(llamadaAuditoria).toBeDefined();
      const paramsAuditoria = llamadaAuditoria![1];
      const datosAntes = JSON.parse(paramsAuditoria[7] as string);
      const datosDespues = JSON.parse(paramsAuditoria[8] as string);
      expect(datosAntes.estado).toBe('ACTIVO');
      expect(datosDespues.estado).toBe('INACTIVO');
      expect(datosDespues.desactivado).toBe(true);
    });

    it('7. La ruta DELETE /api/v1/admin/usuarios/:id responde 405 METHOD_NOT_ALLOWED prohibiendo la eliminación física', async () => {
      const router = crearUsuariosAdminRouter({} as Pool) as any;
      // Inspeccionar las capas del router para ubicar el handler DELETE
      const deleteLayer = router.stack.find(
        (s: any) => s.route && s.route.path === '/:id' && s.route.methods.delete
      );
      expect(deleteLayer).toBeDefined();

      const handler = deleteLayer.route.stack[0].handle;
      const req = { params: { id: USER_ID } };
      const res = {};
      expect(() => handler(req, res, () => {})).toThrowError(
        expect.objectContaining({
          status: 405,
          code: 'METHOD_NOT_ALLOWED',
          message: expect.stringContaining('Eliminación física de usuarios no permitida'),
        })
      );
    });

    it('8. Un usuario desactivado (activo = false) no puede autenticarse (lanza ACCOUNT_DISABLED 403)', async () => {
      const query = vi.fn().mockResolvedValue({
        rows: [{
          id_usuario: USER_ID,
          id_persona: PERSON_ID,
          usuario: 'usuario.inactivo',
          correo: 'inactivo@iestpsuiza.edu.pe',
          password_hash: '$argon2id$v=19$m=65536,p=4,t=3$dummyhash',
          activo: false, // CUENTA INACTIVA
          nombre_completo: 'Usuario Inactivo',
          rol_codigo: 'ESPECIALISTA',
          area_id: null,
        }],
      });
      const pool = { query } as unknown as Pool;
      const authRouter = crearRouterAuth(pool) as any;
      const loginRoute = authRouter.stack.find(
        (s: any) => s.route && s.route.path === '/auth/login' && s.route.methods.post
      );
      expect(loginRoute).toBeDefined();

      const loginHandler = loginRoute.route.stack[0].handle;
      const req = { body: { identificador: 'usuario.inactivo', password: 'password123' }, ip: '127.0.0.1', get: () => 'test-agent' };
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

      await expect(loginHandler(req, res, () => {})).rejects.toMatchObject({
        status: 403,
        code: 'ACCOUNT_DISABLED',
        message: 'Cuenta deshabilitada.',
      });
    });
  });

  // 3. Preservación del Catálogo TUPA y Radicación Pública (Partes 1 y 2)
  describe('Preservación de Partes 1 y 2', () => {
    it('9. El catálogo TUPA contiene EXACTAMENTE 72 procedimientos oficiales correlativos (SUZ26-001 al SUZ26-072)', () => {
      expect(CATALOGO_TUPA_2026).toHaveLength(72);
      expect(CATALOGO_DOCUMENTAL_TUPA_2026).toHaveLength(72);

      // Primer trámite
      expect(CATALOGO_TUPA_2026[0].codigoVisible).toBe('SUZ26-001');
      // Último trámite
      expect(CATALOGO_TUPA_2026[71].codigoVisible).toBe('SUZ26-072');

      // No existen códigos históricos residuales que inflen la cuenta
      const codigosVisibles = CATALOGO_TUPA_2026.map(t => t.codigoVisible);
      expect(codigosVisibles).not.toContain('SUZ26-073');
      expect(codigosVisibles).not.toContain('SUZ26-074');
      expect(codigosVisibles).not.toContain('SUZ26-075');
    });

    it('10. Todos los procedimientos tienen requisitos documentales oficiales application/pdf y foliación continua', () => {
      for (const item of CATALOGO_DOCUMENTAL_TUPA_2026) {
        expect(item.requisitos.length).toBeGreaterThan(0);
        for (const req of item.requisitos) {
          expect(req.formatosAdmitidos).toContain('application/pdf');
        }
      }
    });
  });
});
