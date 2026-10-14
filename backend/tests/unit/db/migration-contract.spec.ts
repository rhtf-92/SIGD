import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const rutaMigracion = (nombre: string) =>
  fileURLToPath(new URL(`../../../migraciones/${nombre}`, import.meta.url));

const leerMigracion = (nombre: string) => readFileSync(rutaMigracion(nombre), 'utf8');

describe('contrato de migraciones ejecutables', () => {
  it('no inserta una notificación de prueba para un usuario inexistente', () => {
    const auth = leerMigracion('02_sigd_auth.sql');
    expect(auth).toContain('FROM sigd_auth.cuenta_usuario AS u');
    expect(auth).toContain("WHERE u.id_usuario = '00000000-0000-0000-0000-000000000001'::uuid");
  });

  it('agrega bloqueo de cuentas mediante una migración incremental', () => {
    const bloqueo = leerMigracion('08_sigd_auth_bloqueo_cuentas.sql');
    expect(bloqueo).toContain('ADD COLUMN IF NOT EXISTS intentos_fallidos');
    expect(bloqueo).toContain('ADD COLUMN IF NOT EXISTS bloqueado_hasta');
  });

  it('persiste el perfil activo por sesión con una migración posterior y compatible', () => {
    const perfilActivo = leerMigracion('09_sigd_auth_perfil_activo.sql');
    expect(perfilActivo).toContain('ADD COLUMN IF NOT EXISTS rol_activo_id');
    expect(perfilActivo).toContain('REFERENCES sigd_org.rol_sistema (rol_id)');
    expect(perfilActivo).not.toContain('DROP TABLE');
    expect(perfilActivo).not.toContain('06_sigd_rut');
    expect(perfilActivo).not.toContain('07_sigd_reportes');
  });
});
