import { describe, expect, it, vi } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import { RegistroRepository } from '../../../../src/domains/identicore/registro.repository.js';
import type { DatosRegistro } from '../../../../src/domains/identicore/registro.types.js';

const datos: DatosRegistro = {
  tipoDocumento: 'DNI',
  numeroDocumento: '12345678',
  correo: 'ana@example.com',
  celular: '912345678',
  direccion: 'Jr. Lima 123',
  ubigeoDistrito: '250101',
  nombres: 'Ana',
  apellidoPaterno: 'Perez',
  apellidoMaterno: 'Rojas',
  tipoPersona: 'NATURAL',
  partidaRegistral: null,
  aceptaNotificaciones: false,
  ipAddress: null,
};

describe('RegistroRepository', () => {
  it('crea la persona, cuenta, consentimiento y devuelve el id de casilla', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: '1' }] })
      .mockResolvedValueOnce({ rows: [{ existe: false }] })
      .mockResolvedValueOnce({ rows: [{ id: '10' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: '20' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    const cliente = { query, release: vi.fn() } as unknown as PoolClient;
    const pool = { connect: vi.fn().mockResolvedValue(cliente) } as unknown as Pool;

    await expect(new RegistroRepository(pool).registrar(datos, 'argon2id-hash')).resolves.toEqual({
      idPersona: '10',
      casillaId: '20',
      mensaje: 'Registro exitoso',
    });
  });

  it('revierte la transacción y devuelve conflicto ante documento o cuenta duplicados', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: '1' }] })
      .mockResolvedValueOnce({ rows: [{ existe: true }] })
      .mockResolvedValueOnce({ rows: [] });
    const release = vi.fn();
    const cliente = { query, release } as unknown as PoolClient;
    const pool = { connect: vi.fn().mockResolvedValue(cliente) } as unknown as Pool;
    const repository = new RegistroRepository(pool);

    await expect(repository.registrar(datos, 'argon2id-hash')).rejects.toMatchObject({
      status: 409,
      code: 'CITIZEN_ALREADY_EXISTS',
    });

    expect(query).toHaveBeenCalledTimes(4);
    expect(query.mock.calls[3][0]).toBe('ROLLBACK');
    expect(release).toHaveBeenCalledOnce();
  });
});