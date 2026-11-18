import { describe, it, expect } from 'vitest';
import { runWithContext, getRequestContext, requireRequestContext, crearContexto } from '../../src/shared/request-context/request-context.js';
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

  it('aisla contextos anidados: el contexto hijo no contamina al padre', async () => {
    const idPadre = randomUUID();
    const idHijo = randomUUID();
    let captureAfterChild: string | undefined;

    await runWithContext(crearContexto({ correlation_id: idPadre }), async () => {
      expect(getRequestContext()?.correlation_id).toBe(idPadre);

      await runWithContext(crearContexto({ correlation_id: idHijo }), async () => {
        expect(getRequestContext()?.correlation_id).toBe(idHijo);
      });

      captureAfterChild = getRequestContext()?.correlation_id;
      expect(captureAfterChild).toBe(idPadre);
    });

    expect(getRequestContext()).toBeUndefined();
  });

  it('aisla 3 niveles de anidamiento secuencial', async () => {
    const ids = [randomUUID(), randomUUID(), randomUUID()];
    const capturas: string[] = [];

    await runWithContext(crearContexto({ correlation_id: ids[0] }), async () => {
      capturas.push(getRequestContext()?.correlation_id ?? '');

      await runWithContext(crearContexto({ correlation_id: ids[1] }), async () => {
        capturas.push(getRequestContext()?.correlation_id ?? '');

        await runWithContext(crearContexto({ correlation_id: ids[2] }), async () => {
          capturas.push(getRequestContext()?.correlation_id ?? '');
        });

        capturas.push(getRequestContext()?.correlation_id ?? '');
      });

      capturas.push(getRequestContext()?.correlation_id ?? '');
    });

    expect(capturas).toEqual([ids[0], ids[1], ids[2], ids[1], ids[0]]);
  });

  it('no contamina entre 100 contextos concurrentes con delays aleatorios', async () => {
    const n = 100;
    const ids = Array.from({ length: n }, () => randomUUID());
    const resultados: (string | undefined)[] = new Array(n);

    const tareas = ids.map((id, i) =>
      runWithContext(crearContexto({ correlation_id: id }), async () => {
        const delay = Math.random() * 50;
        await new Promise((r) => setTimeout(r, delay));
        resultados[i] = getRequestContext()?.correlation_id;
      }),
    );

    await Promise.all(tareas);

    for (let i = 0; i < n; i++) {
      expect(resultados[i]).toBe(ids[i]);
    }
  });

  it('requireRequestContext retorna contexto dentro de runWithContext', () => {
    const id = randomUUID();
    let captured: string | undefined;

    runWithContext(crearContexto({ correlation_id: id }), () => {
      captured = requireRequestContext().correlation_id;
    });

    expect(captured).toBe(id);
  });

  it('getRequestContext retorna undefined fuera de contexto', () => {
    expect(getRequestContext()).toBeUndefined();
  });
});
