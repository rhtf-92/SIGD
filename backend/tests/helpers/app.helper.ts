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

export async function limpiarAmbiente(_pool: Pool = obtenerPool()): Promise<void> {
  // Blindaje institucional B_JACOBO: En sigd_jacobo_demo queda estrictamente prohibido
  // ejecutar TRUNCATE o mutaciones masivas. Las pruebas operan en modo no destructivo o con mocks.
  return;
}

export async function cerrarAmbiente(): Promise<void> {
  await cerrarPool();
}
