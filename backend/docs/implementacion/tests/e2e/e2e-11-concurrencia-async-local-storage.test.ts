import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { runWithContext, getRequestContext, crearContexto } from '../../src/shared/request-context/request-context.js';
import { randomUUID } from 'node:crypto';

describe('Concurrencia · AsyncLocalStorage', () => {
  it('aisla el contexto entre ejecuciones simultáneas', async () => {
    const idA = randomUUID();
    const idB = randomUUID();
    const idC = randomUUID();

    const resultados: string[] = [];

    const tareas = [
      runWithContext(crearContexto({ correlation_id: idA }), async () => {
        await new Promise((r) => setTimeout(r, 30));
        resultados.push(`A:${getRequestContext()?.correlation_id}`);
      }),
      runWithContext(crearContexto({ correlation_id: idB }), async () => {
        await new Promise((r) => setTimeout(r, 10));
        resultados.push(`B:${getRequestContext()?.correlation_id}`);
      }),
      runWithContext(crearContexto({ correlation_id: idC }), async () => {
        await new Promise((r) => setTimeout(r, 20));
        resultados.push(`C:${getRequestContext()?.correlation_id}`);
      }),
    ];

    await Promise.all(tareas);

    expect(resultados).toContain(`A:${idA}`);
    expect(resultados).toContain(`B:${idB}`);
    expect(resultados).toContain(`C:${idC}`);
    expect(resultados).toHaveLength(3);
  });

  it('no contamina contexto entre cadena sync y async', async () => {
    const id1 = randomUUID();
    const id2 = randomUUID();
    let captura1: string | undefined;
    let captura2: string | undefined;

    await runWithContext(crearContexto({ correlation_id: id1 }), async () => {
      captura1 = getRequestContext()?.correlation_id;
      await Promise.resolve();
    });

    await runWithContext(crearContexto({ correlation_id: id2 }), async () => {
      captura2 = getRequestContext()?.correlation_id;
    });

    expect(captura1).toBe(id1);
    expect(captura2).toBe(id2);
    expect(captura1).not.toBe(captura2);
  });
});
