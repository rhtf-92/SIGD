import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { exigirRoles } from '../../src/core/auth/exigirRol.js';
import { firmarTokenAcceso } from '../../src/core/auth/jwt.service.js';

const ID_USUARIO = '11111111-1111-1111-1111-111111111111';

function crearRequest(authorization?: string): Request {
  return {
    get: (nombre: string) =>
      nombre.toLowerCase() === 'authorization' ? authorization : undefined,
    query: {},
  } as unknown as Request;
}

function crearResponse(): Response {
  return {
    locals: {},
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
}

function crearToken(roles: string[]): string {
  return firmarTokenAcceso({ sub: ID_USUARIO, roles });
}

describe('exigirRoles', () => {
  it('responde 401 sin Authorization y no llama next', () => {
    const res = crearResponse();
    const next = vi.fn();

    exigirRoles('ADMINISTRADOR')(crearRequest(), res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      code: 'NO_AUTENTICADO',
      title: 'Debe iniciar sesion.',
      detail: 'Debe iniciar sesion.',
      error: { codigo: 'NO_AUTENTICADO', mensaje: 'Debe iniciar sesion.' },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('responde 403 cuando el token no contiene un rol permitido', () => {
    const res = crearResponse();
    const next = vi.fn();
    const req = crearRequest(`Bearer ${crearToken(['CIUDADANO'])}`);

    exigirRoles('ADMINISTRADOR', 'DIRECTOR')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      code: 'SIN_PERMISO',
      title: 'No tiene permiso para esta operacion.',
      detail: 'No tiene permiso para esta operacion.',
      error: {
        codigo: 'SIN_PERMISO',
        mensaje: 'No tiene permiso para esta operacion.',
      },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('llama next y guarda el id del operador para un rol permitido', () => {
    const res = crearResponse();
    const next = vi.fn();
    const req = crearRequest(`Bearer ${crearToken(['ADMINISTRADOR'])}`);

    exigirRoles('ADMINISTRADOR', 'DIRECTOR')(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.locals['idOperador']).toBe(ID_USUARIO);
  });
});
