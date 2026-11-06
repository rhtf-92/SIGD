import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';
import { verificarSesionActiva } from '../../../../src/core/auth/sesion-activa.js';

const USER = '11111111-1111-4111-8111-111111111111';
const SID = 'session-fingerprint-for-user-111';

function token(overrides: { sid?: string; role?: string } = {}) {
  return firmarTokenAcceso({ sub: USER, sid: overrides.sid ?? SID, roles: [overrides.role ?? 'ESTUDIANTE'] });
}

function poolState(options: { session?: boolean; profile?: boolean; blocked?: boolean } = {}) {
  const query = vi.fn(async (sql: string) => {
    if (sql.includes('FROM sigd_auth.sesion_usuario')) {
      expect(sql).toContain('c.bloqueado_hasta');
      return { rows: options.session === false || options.blocked ? [] : [{ id_usuario: USER, activo: true, revocado_en: null, expira_en: new Date(Date.now() + 60_000) }], rowCount: 1 };
    }
    if (sql.includes('FROM sigd_org.usuario_rol')) {
      expect(sql).toContain('r.vigente');
      return { rows: options.profile === false ? [] : [{ rol_codigo: 'CIUDADANO', permiso_codigo: null }], rowCount: options.profile === false ? 0 : 1 };
    }
    return { rows: [], rowCount: 0 };
  });
  return { query } as unknown as Pool;
}

describe('revalidación de sesión y perfil activo', () => {
  it('acepta solo una sesión activa, no bloqueada y con el perfil aún vigente', async () => {
    const pool = poolState();
    await expect(verificarSesionActiva(pool, token())).resolves.toMatchObject({ sub: USER, rolActivo: 'ESTUDIANTE' });
  });

  it('rechaza una sesión revocada o una cuenta bloqueada', async () => {
    await expect(verificarSesionActiva(poolState({ session: false }), token())).rejects.toThrow();
    await expect(verificarSesionActiva(poolState({ blocked: true }), token())).rejects.toThrow();
  });

  it('rechaza un perfil revocado incluso cuando la sesión sigue vigente', async () => {
    await expect(verificarSesionActiva(poolState({ profile: false }), token())).rejects.toThrow();
  });

  it('rechaza JWT de acceso sin identificador de sesión persistida', async () => {
    const legacyToken = firmarTokenAcceso({ sub: USER, roles: ['ESTUDIANTE'] });
    await expect(verificarSesionActiva(poolState(), legacyToken)).rejects.toThrow();
  });
});
