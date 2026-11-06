import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import { ForbiddenError, NotFoundError } from '../../../../src/shared/domain/errors/index.js';
import { verificarAccesoExpediente } from '../../../../src/domains/docucore/docucore.security.js';

const EXPEDIENTE_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12';
const USUARIO_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13';

function crearPool(respuestas: unknown[]): Pool {
  const query = vi.fn();
  for (const respuesta of respuestas) query.mockResolvedValueOnce(respuesta);
  return { query } as unknown as Pool;
}

describe('autorización DocuCore por expediente (SEC-02)', () => {
  it('responde 404 cuando el expediente no existe', async () => {
    const pool = crearPool([{ rows: [], rowCount: 0 }]);

    await expect(
      verificarAccesoExpediente(pool, USUARIO_ID, EXPEDIENTE_ID),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('responde 403 si el usuario no es titular ni tiene asignación activa', async () => {
    const pool = crearPool([
      { rows: [{ expediente_id: EXPEDIENTE_ID }], rowCount: 1 },
      { rows: [{ autorizado: false }], rowCount: 1 },
    ]);

    await expect(
      verificarAccesoExpediente(pool, USUARIO_ID, EXPEDIENTE_ID),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('permite continuar cuando la consulta de vigencia confirma acceso', async () => {
    const pool = crearPool([
      { rows: [{ expediente_id: EXPEDIENTE_ID }], rowCount: 1 },
      { rows: [{ autorizado: true }], rowCount: 1 },
    ]);

    await expect(
      verificarAccesoExpediente(pool, USUARIO_ID, EXPEDIENTE_ID),
    ).resolves.toBeUndefined();
  });
});
