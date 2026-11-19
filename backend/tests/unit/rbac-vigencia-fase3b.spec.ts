import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import request from 'supertest';
import type { Pool } from 'pg';
import { construirApp } from '../../src/app.js';
import { firmarTokenAcceso } from '../../src/core/auth/jwt.service.js';
import { obtenerAutorizacionCuenta } from '../../src/core/auth/auth.guard.js';

const usuario = '10000000-0000-4000-8000-000000000001';

describe('Fase 3B · contrato RBAC vigente y controles temporales', () => {
  it('todas las subconsultas de lectura conservan inicio y fin de vigencia', () => {
    for (const ruta of ['../../src/app.ts', '../../src/core/storage/storage.router.ts']) {
      const fuente = fs.readFileSync(new URL(ruta, import.meta.url), 'utf8');
      const consultas = [...fuente.matchAll(/`([^`]*sigd_org\.usuario_rol ur[^`]*)`/g)].map(m=>m[1]);
      expect(consultas.length).toBeGreaterThan(0);
      for (const sql of consultas) {
        const asignaciones = (sql.match(/sigd_org\.usuario_rol ur/g) ?? []).length;
        expect((sql.match(/ur\.vigente_desde\s*<=\s*now\(\)/g) ?? []).length).toBe(asignaciones);
        expect((sql.match(/ur\.vigente_hasta IS NULL OR ur\.vigente_hasta\s*>\s*now\(\)/g) ?? []).length).toBe(asignaciones);
      }
    }
  });

  it('el agregador mantiene el control temporal y excluye sólo el permiso aportado por CIUDADANO', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ roles: ['CIUDADANO', 'ADMINISTRADOR'], permisos: [
      { codigo: 'ADMIN_USUARIOS', ambito: 'GLOBAL', areaId: null },
    ] }] });
    const autorizacion = await obtenerAutorizacionCuenta({ query } as unknown as Pool, usuario, '20000000-0000-4000-8000-000000000001');
    expect(autorizacion?.roles).toEqual(['CIUDADANO', 'ADMINISTRADOR']);
    expect(autorizacion?.permisos).toContainEqual({ codigo: 'ADMIN_USUARIOS', ambito: 'GLOBAL', areaId: null });
    const sql = query.mock.calls[0][0];
    expect(sql).toContain('ur.vigente_desde <= now()');
    expect(sql).toContain('ur.vigente_hasta IS NULL OR ur.vigente_hasta > now()');
    expect(sql).toContain("NOT (r.codigo = 'CIUDADANO' AND p.codigo = 'EXPEDIENTE_LEER')");
  });

  it('un rol del JWT no concede administración si la autorización persistida devuelve ausencia de facultad', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [{ autorizado: false }] });
    const connect = vi.fn();
    const res = await request(construirApp({ query, connect } as unknown as Pool))
      .get('/api/v1/admin/roles-permisos')
      .set('Authorization', 'Bearer '+firmarTokenAcceso({ sub: usuario, roles: ['ADMINISTRADOR'] }));
    expect(res.status).toBe(403);
    expect(query).toHaveBeenCalledOnce(); expect(connect).not.toHaveBeenCalled();
    // El doble sólo verifica HTTP y SQL emitido; los casos temporales se ejecutan
    // realmente en PostgreSQL mediante fase3b-vigencia-readonly.mts.
    expect(query.mock.calls[0][0]).toContain('ur.vigente_desde <= now()');
    expect(query.mock.calls[0][0]).toContain('ur.vigente_hasta > now()');
  });
});
