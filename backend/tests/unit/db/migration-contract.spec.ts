import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const rutaMigracion = (nombre: string) =>
  fileURLToPath(new URL(`../../../migraciones/${nombre}`, import.meta.url));

const leerMigracion = (nombre: string) => readFileSync(rutaMigracion(nombre), 'utf8');

describe('contrato de migraciones ejecutables', () => {
  it('deja el control transaccional al runner', () => {
    const rutaDoc = leerMigracion('06_sigd_rut.sql');

    expect(rutaDoc).not.toMatch(/^\s*BEGIN;\s*$/m);
    expect(rutaDoc).not.toMatch(/^\s*COMMIT;\s*$/m);
  });

  it('publica las columnas que consume el repositorio MGD', () => {
    const reportes = leerMigracion('07_sigd_reportes.sql');

    for (const columna of [
      'actualizado_en',
      'n_radicados',
      'n_atendidos',
      'n_archivados',
      'n_resueltos',
      'n_en_tramite',
      'n_observados',
      'n_resueltos_dentro_plazo',
      'horas_habiles_suma',
      'unidad_organica_id',
      'tramo_permanencia_dias_habiles',
    ]) {
      expect(reportes).toContain(columna);
    }
  });

  it('no depende de la proyección RutaDoc eliminada', () => {
    const reportes = leerMigracion('07_sigd_reportes.sql');

    expect(reportes).not.toContain('estado_actual_tramite');
    expect(reportes).not.toContain('fecha_movimiento');
    expect(reportes).not.toContain('estado_destino');
  });
});
