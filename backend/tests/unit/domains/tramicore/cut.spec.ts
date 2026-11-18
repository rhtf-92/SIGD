import { describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import {
  CutService,
  REGEX_CUT,
  esCutValido,
  formatearCut,
} from '../../../../src/domains/tramicore/cut.service.js';

/**
 * T-BE-TC-01 · Pruebas de estres concurrente del generador de CUT.
 *
 * Criterios de aceptacion cubiertos:
 *   1. Cero duplicidad de CUT bajo concurrencia forzada (100 llamadas).
 *   2. El CUT cumple estrictamente `^EXP-\d{4}-\d{6}$`.
 *
 * El caso de concurrencia se ejecuta contra la base de datos real cuando existe
 * `TEST_DATABASE_URL`, porque la garantia de unicidad es del motor y no del
 * proceso de Node. Sin esa variable se corre una simulacion atomica equivalente
 * (contador sin espera en el punto de incremento, igual que `nextval()`), que
 * sirve para detectar regresiones de logica sin depender de infraestructura.
 */

const ANIO = 2026;
const TOTAL_LLAMADAS = 100;

/**
 * Conexiones simultaneas contra PostgreSQL. El servidor de pruebas declara
 * `max_connections = 100` y ya consume parte de ese cupo con conexiones del
 * sistema, asi que 100 dedicated excederian el limite.
 */
const CONEXIONES_CONCURRENTES = 20;

/**
 * Pool simulado que replica la semantica de `sigd_tra.fn_generar_cut`: el
 * correlativo se toma de una secuencia cuyo incremento no tiene puntos de
 * espera, por lo que dos llamadas concurrentes nunca obtienen el mismo valor.
 */
function crearPoolSimulado(): Pool {
  let correlativo = 0;
  return {
    query: async (texto: string, parametros?: unknown[]) => {
      if (!texto.includes('fn_generar_cut')) {
        throw new Error(`Consulta no esperada en la simulacion: ${texto}`);
      }
      correlativo += 1;
      const anio = Number(parametros?.[0]);
      return { rows: [{ cut: formatearCut(anio, correlativo) }], rowCount: 1 };
    },
  } as unknown as Pool;
}

describe('T-BE-TC-01 · Generador de CUT EXP-YYYY-XXXXXX', () => {
  describe('Mascara y validacion', () => {
    it('Formatea el correlativo con relleno de ceros a la izquierda', () => {
      expect(formatearCut(ANIO, 1)).toBe('EXP-2026-000001');
      expect(formatearCut(ANIO, 42)).toBe('EXP-2026-000042');
      expect(formatearCut(ANIO, 999999)).toBe('EXP-2026-999999');
    });

    it('Acepta los CUT emitidos y rechaza los que no', () => {
      expect(esCutValido('EXP-2026-000001')).toBe(true);
      expect(REGEX_CUT.test('EXP-2026-000001')).toBe(true);
      expect(REGEX_CUT.test('EXP-2026-0000001')).toBe(false);
      expect(REGEX_CUT.test('EXP-26-000001')).toBe(false);
      expect(REGEX_CUT.test('CUT-2026-000001')).toBe(false);
      expect(REGEX_CUT.test('EXP-2026-ABCDEF')).toBe(false);
    });

    it('Rechaza el ejercicio fiscal fuera del rango admitido', () => {
      expect(() => formatearCut(0, 1)).toThrow(RangeError);
      expect(() => formatearCut(1899, 1)).toThrow(/ANIO_FISCAL_INVALIDO/);
      expect(() => formatearCut(10000, 1)).toThrow(/ANIO_FISCAL_INVALIDO/);
    });

    it('Rechaza correlativos que desbordan la mascara de seis digitos', () => {
      expect(() => formatearCut(ANIO, 1000000)).toThrow(/CORRELATIVO_DESBORDADO/);
      expect(() => formatearCut(ANIO, 0)).toThrow(/CORRELATIVO_INVALIDO/);
    });
  });

  describe('Concurrencia: 100 llamadas simultaneas', () => {
    it('Emite 100 CUTs unicos, correlativos y con la mascara correcta', async () => {
      const servicio = new CutService(crearPoolSimulado());

      const resultados = await Promise.all(
        Array.from({ length: TOTAL_LLAMADAS }, () => servicio.generar(ANIO)),
      );

      const cuts = resultados.map((r) => r.cut);

      expect(cuts).toHaveLength(TOTAL_LLAMADAS);
      expect(new Set(cuts).size).toBe(TOTAL_LLAMADAS);
      expect(cuts.every((cut) => REGEX_CUT.test(cut))).toBe(true);

      // El correlativo debe arrancar en 1 y avanzar de uno en uno: un hueco o un
      // salto delata que la reserva no es atomica.
      const ordenados = [...cuts].sort();
      ordenados.forEach((cut, indice) => {
        expect(cut).toBe(formatearCut(ANIO, indice + 1));
      });
    });

    it('Reporta el ejercicio fiscal del corte recibido', async () => {
      const servicio = new CutService(crearPoolSimulado());
      const [resultado] = await Promise.all([servicio.generarCorriente()]);
      expect(resultado.anio).toBe(CutService.anioFiscalCorriente());
      expect(REGEX_CUT.test(resultado.cut)).toBe(true);
    });

    it('Rechaza una mascara devuelta por la base que no cumple el estandar', async () => {
      const poolInvalido = {
        query: async () => ({ rows: [{ cut: 'CUT-2026-000001' }], rowCount: 1 }),
      } as unknown as Pool;

      await expect(new CutService(poolInvalido).generar(ANIO)).rejects.toThrow(
        /CUT_CON_MASCARA_INVALIDA/,
      );
    });
  });

  describe('Concurrencia contra PostgreSQL real', () => {
    const url = process.env.TEST_DATABASE_URL;

    it.runIf(url)('Emite 100 CUTs unicos desde fn_generar_cut', async () => {
      // El servidor de pruebas admite `max_connections = 100` y ya tiene
      // conexiones del sistema abiertas, asi que no se pueden abrir 100
      // conexiones dedicated. Se disparan las 100 llamadas de forma concurrente
      // sobre un pool acotado: las 100 promesas quedan en vuelo a la vez y
      // PostgreSQL las resuelve en paralelo, que es la condicion que importa
      // para que `nextval()` no sufra serializacion.
      const pool = new Pool({ connectionString: url, max: CONEXIONES_CONCURRENTES });
      try {
        const servicio = new CutService(pool);

        const resultados = await Promise.all(
          Array.from({ length: TOTAL_LLAMADAS }, () => servicio.generar(ANIO)),
        );

        const cuts = resultados.map((r) => r.cut);
        expect(cuts).toHaveLength(TOTAL_LLAMADAS);
        expect(new Set(cuts).size).toBe(TOTAL_LLAMADAS);
        expect(cuts.every((cut) => REGEX_CUT.test(cut))).toBe(true);
      } finally {
        await pool.end();
      }
    });

    it.runIf(url)('No repite correlativo entre conexiones y transacciones distintas', async () => {
      // Cada conexion abre su propia transaccion: si el correlativo se tomara
      // con `SELECT MAX() + 1` o con una tabla de control mal bloqueada, la
      // separacion entre transacciones es justo lo que expone la colision.
      const pool = new Pool({ connectionString: url, max: CONEXIONES_CONCURRENTES });
      try {
        const servicio = new CutService(pool);
        const rondas = Math.ceil(TOTAL_LLAMADAS / CONEXIONES_CONCURRENTES);

        const cortes = await Promise.all(
          Array.from({ length: CONEXIONES_CONCURRENTES }, async () => {
            const cliente = await pool.connect();
            const asignado: string[] = [];
            try {
              for (let i = 0; i < rondas; i += 1) {
                await cliente.query('BEGIN');
                const { cut } = await servicio.generar(ANIO, cliente);
                await cliente.query('COMMIT');
                asignado.push(cut);
              }
            } finally {
              cliente.release();
            }
            return asignado;
          }),
        );

        const todos = cortes.flat();
        expect(todos).toHaveLength(CONEXIONES_CONCURRENTES * rondas);
        expect(new Set(todos).size).toBe(todos.length);
        expect(todos.every((cut) => REGEX_CUT.test(cut))).toBe(true);
      } finally {
        await pool.end();
      }
    });
  });
});
