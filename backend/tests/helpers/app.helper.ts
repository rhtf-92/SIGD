import request from 'supertest';
import { construirApp } from '../../src/app.js';
import { obtenerPool, cerrarPool, restaurarBaseE2E } from './database.helper.js';

type Agente = ReturnType<typeof request.agent>;

let agente: Agente | null = null;

export function obtenerAgente(): Agente {
  agente ??= request.agent(construirApp(obtenerPool()));
  return agente;
}

export async function limpiarAmbiente(): Promise<void> {
  agente = null;
  await restaurarBaseE2E();
}

export async function cerrarAmbiente(): Promise<void> {
  agente = null;
  await cerrarPool();
}