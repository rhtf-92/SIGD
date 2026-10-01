/**
 * Paridad SQL <-> TypeScript del calendario institucional de MGD.
 *
 * Las vistas materializadas de `docs/00_corelink/07_vistas_materializadas_mgd.sql`
 * calculan TPR, TRO y los tramos de permanencia con `fn_mgd_horas_habiles` y
 * `fn_mgd_dias_habiles_entre`, ambas en SQL. El endpoint de reportes, en cambio,
 * recalcula esas magnitudes en TypeScript (`horasHabilesEntre` /
 * `diasHabilesEntre` en `mgdAnalytics.service.ts`) para los tramos y riesgos que
 * no viven en las vistas.
 *
 * Son dos implementaciones de la MISMA regla, y por eso pueden divergir en
 * silencio: nada en el tipo de retorno lo impide y ambas responden un número
 * plausible. Cuando divergen, el tablero ejecutivo muestra un TPR que no
 * cuadra con el gráfico de permanencia, sin ningún error. Este test es el que
 * convierte esa divergencia en un fallo de build.
 *
 * No es decorativo: esta suite ya detectó dos defectos reales que ninguna otra
 * prueba podía ver.
 *
 *   1. La versión SQL sumaba `INTERVAL '5 hours'` a un `timestamp` sin zona,
 *      con lo que el resultado dependía del `TimeZone` de la sesión. Con el
 *      servidor en `America/Lima` toda ventana se desplazaba cinco horas.
 *   2. Al corregirlo con `AT TIME ZONE '-05:00'`, la ventana pasó a estar cinco
 *      horas desplazada en sentido contrario: PostgreSQL invierte el signo en
 *      las especificaciones numéricas de zona (convención POSIX). La jornada
 *      08:00-16:30 se leía como 03:00-11:30 UTC.
 *
 * Requisitos: un PostgreSQL alcanzable en `DATABASE_URL` con el DDL de
 * `07_vistas_materializadas_mgd.sql` aplicado (esquemas `sigd_tra`, `sigd_rut`,
 * `sigd_org`). Si `DATABASE_URL` no está definida la suite se omite, igual que
 * la suite e2e de tramites.
 */
import { describe, expect, it } from 'vitest';
import { Pool } from 'pg';
import {
  diasHabilesEntre,
  horasHabilesEntre,
} from '../../../../src/domains/corelink/mgdAnalytics.service.js';

const url = process.env.DATABASE_URL;
const describeSiHayBase = url ? describe : describe.skip;

const DIAS = 86_400_000;
const FERIADOS = ['2026-09-24', '2026-10-12', '2026-11-02'];
const INSTANTES_PRUEBA = 90;
const VENTANA_MAXIMA_DIAS = 30;
const TOLERANCIA_HORAS = 1e-4;

describeSiHayBase('mgd: el espejo en TypeScript coincide con las funciones SQL', () => {
  it('las funciones están instaladas', async () => {
    const pool = new Pool({ connectionString: url });
    try {
      const { rows } = await pool.query<{ instalada: boolean }>(
        `SELECT to_regprocedure('sigd_tra.fn_mgd_horas_habiles(timestamptz,timestamptz,date[])') IS NOT NULL
            AND to_regprocedure('sigd_tra.fn_mgd_dias_habiles_entre(timestamptz,timestamptz,date[])') IS NOT NULL
            AS instalada`,
      );
      expect(rows[0]?.instalada).toBe(true);
    } finally {
      await pool.end();
    }
  }, 60_000);

  it('horas y días hábiles coinciden en ventanas cruzando fines de semana y feriados', async () => {
    const pool = new Pool({ connectionString: url });
    try {
      const base = Date.UTC(2026, 8, 1, 0, 0, 0);
      const instantes: Date[] = [];
      let semilla = 42;
      for (let i = 0; i < INSTANTES_PRUEBA; i += 1) {
        semilla = (semilla * 1103515245 + 12345) % 2147483648;
        instantes.push(new Date(base + (semilla % 120) * DIAS + ((semilla >> 7) % 96) * 3_600_000));
      }

      let comparaciones = 0;
      const diferencias: string[] = [];
      for (const desde of instantes) {
        for (const hasta of instantes) {
          if (hasta.getTime() <= desde.getTime()) continue;
          if (Math.abs(hasta.getTime() - desde.getTime()) > VENTANA_MAXIMA_DIAS * DIAS) continue;
          const { rows } = await pool.query<{ h_sql: string; d_sql: string }>(
            `SELECT sigd_tra.fn_mgd_horas_habiles($1, $2, $3::date[]) AS h_sql,
                    sigd_tra.fn_mgd_dias_habiles_entre($1, $2, $3::date[]) AS d_sql`,
            [desde, hasta, FERIADOS],
          );
          const hSql = Number(rows[0].h_sql);
          const dSql = Number(rows[0].d_sql);
          const hTs = horasHabilesEntre(desde, hasta, new Set(FERIADOS));
          const dTs = diasHabilesEntre(desde, hasta, new Set(FERIADOS));
          comparaciones += 1;
          if (Math.abs(hSql - hTs) > TOLERANCIA_HORAS || dSql !== dTs) {
            if (diferencias.length < 10) {
              diferencias.push(`${desde.toISOString()} -> ${hasta.toISOString()} `
                + `| horas sql=${hSql} ts=${hTs} | dias sql=${dSql} ts=${dTs}`);
            }
          }
        }
      }
      // eslint-disable-next-line no-console
      console.log(`[mgd-crosscheck] comparaciones=${comparaciones} diferencias=${diferencias.length}`);
      for (const linea of diferencias) console.log(`[mgd-crosscheck] ${linea}`);
      expect(comparaciones).toBeGreaterThan(1000);
      expect(diferencias).toEqual([]);
    } finally {
      await pool.end();
    }
  }, 600_000);
});
