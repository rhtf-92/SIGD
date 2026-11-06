import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const file = fileURLToPath(new URL('../../../migraciones/17_sigd_admin_settings.sql', import.meta.url));
describe('migración durable de calendario y seguridad', () => {
  it('crea defaults institucionales una sola vez y valida restricciones del servidor', () => {
    expect(existsSync(file)).toBe(true);
    const sql = readFileSync(file, 'utf8');
    expect(sql.match(/CREATE TABLE IF NOT EXISTS/g)).toHaveLength(2);
    expect(sql).toContain("DEFAULT '16:30' CHECK (hora_corte = '16:30')");
    expect(sql).toContain("DEFAULT 'America/Lima'");
    expect(sql).toContain('ON CONFLICT (singleton) DO NOTHING');
    expect(sql).toContain('max_intentos_fallidos BETWEEN 1 AND 20');
    expect(sql).toContain('minutos_bloqueo BETWEEN 1 AND 1440');
    expect(sql).toContain("tabla = 'intento_acceso'");
  });
});
