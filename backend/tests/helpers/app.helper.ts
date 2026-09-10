import request from 'supertest';
import { Pool } from 'pg';
import { construirApp } from '../../src/app.js';
import { obtenerPool, cerrarPool } from './database.helper.js';

type Agente = ReturnType<typeof request.agent>;

let agente: Agente | null = null;

export function obtenerAgente(): Agente {
  agente ??= request.agent(construirApp(obtenerPool()));
  return agente;
}

export async function limpiarAmbiente(pool: Pool = obtenerPool()): Promise<void> {
  const tablas: Record<string, string[]> = await pool
    .query(
      `SELECT schemaname, tablename
         FROM pg_tables
        WHERE schemaname IN ('sigd_audit', 'sigd_rut', 'sigd_tra', 'sigd_org')
          AND tablename IN ('evento_outbox', 'bitacora_auditoria', 'movimiento_tramite',
                            'asiento_registro', 'expediente', 'tramite', 'area')
        ORDER BY schemaname, tablename`,
    )
    .then((r) => {
      const porEsquema: Record<string, string[]> = {};
      for (const fila of r.rows) {
        (porEsquema[fila.schemaname] ??= []).push(fila.tablename);
      }
      return porEsquema;
    });

  for (const [esquema, lista] of Object.entries(tablas)) {
    if (lista.length > 0) {
      await pool.query(`TRUNCATE TABLE ${lista.map((t) => `${esquema}.${t}`).join(', ')} CASCADE`);
    }
  }
}

export async function cerrarAmbiente(): Promise<void> {
  await cerrarPool();
}