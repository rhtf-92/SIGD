import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';
import type { Pool, PoolClient } from 'pg';
import { crearUsuariosAdminController } from '../../../../src/domains/organicore/usuariosAdmin.controller.js';
import { ValidationError } from '../../../../src/shared/domain/errors/index.js';

describe('P2 — Validación de areaId en creación de usuario (Codex Audit)', () => {
  let mockClient: Partial<PoolClient>;
  let mockPool: Partial<Pool>;
  let controller: ReturnType<typeof crearUsuariosAdminController>;
  let res: Response;
  let next: any;

  beforeEach(() => {
    mockClient = {
      query: vi.fn(),
      release: vi.fn(),
    };
    mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient as PoolClient),
      query: vi.fn().mockResolvedValue({ rowCount: 0, rows: [] } as any),
    };
    controller = crearUsuariosAdminController(
      {} as any,
      mockPool as Pool
    );
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    } as unknown as Response;
    next = vi.fn();
  });

  const baseBody = {
    tipoDocumento: 'DNI',
    numeroDocumento: '74851201',
    nombres: 'Geric',
    apellidos: 'Salas',
    correo: 'geric.salas@iestpsuiza.edu.pe',
    usuario: 'geric_salas',
    password: 'PasswordSegura2026!',
    rolId: 'ADMINISTRADOR',
    activo: true,
  };

  const INEXISTENTE_AREA_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const INACTIVA_AREA_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const VIGENTE_AREA_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

  it('rechaza si areaId tiene formato UUID inválido en schema', async () => {
    const req = {
      body: {
        ...baseBody,
        areaId: 'area-no-uuid',
      },
    } as Request;

    await controller.crearUsuarioInstitucional(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0][0];
    expect(error.name).toBe('ZodError');
  });

  it('rechaza con ValidationError si areaId no existe en sigd_org.area', async () => {
    const req = {
      body: {
        ...baseBody,
        areaId: INEXISTENTE_AREA_ID,
      },
    } as Request;

    // Simular que no hay conflicto de correo ni persona
    (mockClient.query as any).mockImplementation(async (sql: string) => {
      if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
        return { rows: [] };
      }
      if (sql.includes('FROM sigd_org.persona')) {
        return { rows: [] };
      }
      if (sql.includes('INSERT INTO sigd_auth.persona')) {
        return { rows: [{ id_persona: 'p-1' }] };
      }
      if (sql.includes('INSERT INTO sigd_auth.cuenta_usuario')) {
        return { rows: [{ id_usuario: 'u-1' }] };
      }
      if (sql.includes('FROM sigd_org.rol_sistema')) {
        return { rows: [{ rol_id: 'r-1' }] };
      }
      if (sql.includes('FROM sigd_org.area')) {
        // Área NO existe
        return { rows: [] };
      }
      return { rows: [] };
    });

    await controller.crearUsuarioInstitucional(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0][0];
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.message).toMatch(/área institucional especificada no existe/i);
  });

  it('rechaza con ValidationError si areaId existe pero no está vigente', async () => {
    const req = {
      body: {
        ...baseBody,
        areaId: INACTIVA_AREA_ID,
      },
    } as Request;

    (mockClient.query as any).mockImplementation(async (sql: string) => {
      if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
        return { rows: [] };
      }
      if (sql.includes('FROM sigd_org.persona')) {
        return { rows: [] };
      }
      if (sql.includes('INSERT INTO sigd_auth.persona')) {
        return { rows: [{ id_persona: 'p-1' }] };
      }
      if (sql.includes('INSERT INTO sigd_auth.cuenta_usuario')) {
        return { rows: [{ id_usuario: 'u-1' }] };
      }
      if (sql.includes('FROM sigd_org.rol_sistema')) {
        return { rows: [{ rol_id: 'r-1' }] };
      }
      if (sql.includes('FROM sigd_org.area')) {
        // Área existe pero NO está vigente
        return { rows: [{ area_id: INACTIVA_AREA_ID, vigente: false }] };
      }
      return { rows: [] };
    });

    await controller.crearUsuarioInstitucional(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = next.mock.calls[0][0];
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.message).toMatch(/se encuentra inactiva o dada de baja/i);
  });

  it('acepta y registra al usuario si areaId existe y está vigente', async () => {
    const req = {
      body: {
        ...baseBody,
        areaId: VIGENTE_AREA_ID,
      },
    } as Request;

    (mockClient.query as any).mockImplementation(async (sql: string) => {
      if (sql.includes('FROM sigd_auth.cuenta_usuario')) {
        return { rows: [] };
      }
      if (sql.includes('FROM sigd_org.persona')) {
        return { rows: [] };
      }
      if (sql.includes('INSERT INTO sigd_auth.persona')) {
        return { rows: [{ id_persona: 'p-1' }] };
      }
      if (sql.includes('INSERT INTO sigd_auth.cuenta_usuario')) {
        return { rows: [{ id_usuario: 'u-1' }] };
      }
      if (sql.includes('FROM sigd_org.rol_sistema')) {
        return { rows: [{ rol_id: 'r-1' }] };
      }
      if (sql.includes('FROM sigd_org.area')) {
        // Área existe y está vigente
        return { rows: [{ area_id: VIGENTE_AREA_ID, vigente: true }] };
      }
      return { rows: [] };
    });

    await controller.crearUsuarioInstitucional(req, res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        usuario: 'geric_salas',
        mensaje: expect.stringMatching(/exitosamente/i),
      })
    );
  });
});
