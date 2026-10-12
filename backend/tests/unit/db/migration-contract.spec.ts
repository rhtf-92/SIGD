import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const rutaMigracion = (nombre: string) =>
  fileURLToPath(new URL(`../../../migraciones/${nombre}`, import.meta.url));

const leerMigracion = (nombre: string) => readFileSync(rutaMigracion(nombre), 'utf8');

describe('contrato de migraciones ejecutables', () => {
  it('no inserta una notificación de prueba para un usuario inexistente', () => {
    const auth = leerMigracion('02_sigd_auth.sql');
    expect(auth).toMatch(/'00000000-0000-0000-0000-000000000101',\s*NULL,/);
  });

  it('agrega bloqueo de cuentas mediante una migración incremental', () => {
    const bloqueo = leerMigracion('08_sigd_auth_bloqueo_cuentas.sql');
    expect(bloqueo).toContain('ADD COLUMN IF NOT EXISTS intentos_fallidos');
    expect(bloqueo).toContain('ADD COLUMN IF NOT EXISTS bloqueado_hasta');
  });
});
