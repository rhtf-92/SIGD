import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const rutaMigracion = fileURLToPath(
  new URL('../../../migraciones/16_sigd_refresh_token_text.sql', import.meta.url),
);

describe('migración de longitud de refresh token', () => {
  it('permite guardar refresh tokens JWT completos sin truncarlos', () => {
    expect(existsSync(rutaMigracion)).toBe(true);
    const sql = readFileSync(rutaMigracion, 'utf8');
    expect(sql).toMatch(/ALTER\s+COLUMN\s+refresh_token\s+TYPE\s+TEXT/i);
  });
});
