/**
 * Global Teardown institucional para B_JACOBO.
 * Cierre limpio y sin efectos colaterales sobre sigd_jacobo_demo.
 */
export default async function globalTeardown(): Promise<void> {
  console.log('[GLOBAL-TEARDOWN] Cierre ordenado de suite de pruebas finalizado.');
}
