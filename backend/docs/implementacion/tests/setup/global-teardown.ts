/**
 * ARCHIVO OBSOLETO — No se utiliza.
 *
 * El ciclo de vida del contenedor Testcontainers se gestiona íntegramente
 * dentro de global-setup.ts: la función de setup retorna una función de
 * teardown que Vitest invoca automáticamente al finalizar la suite.
 *
 * Este archivo existía anteriormente como segundo globalSetup (error P1) y
 * referenciaba globalThis.__SIGD_CONTAINER__ que nunca se asignaba.
 * Se conserva como referencia documental únicamente.
 */
export default async function globalTeardown(): Promise<void> {
  // No-op: ver global-setup.ts para la gestión correcta del contenedor.
}
