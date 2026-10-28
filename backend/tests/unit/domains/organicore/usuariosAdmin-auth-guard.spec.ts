import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { requireAdminUsuarios } from '../../../../src/domains/organicore/usuariosAdmin.routes.js';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';
import { UnauthorizedError, ForbiddenError } from '../../../../src/shared/domain/errors/index.js';

describe('F-01 Guard: requireAdminUsuarios', () => {
  const SECRET_KEY = 'test_secret_key_with_at_least_32_characters_long_for_security';
  process.env.AUTH_JWT_SECRET = SECRET_KEY;

  function crearMockReq(token?: string): Request {
    return {
      get: (header: string) => {
        if (header.toLowerCase() === 'authorization') {
          return token ? `Bearer ${token}` : undefined;
        }
        return undefined;
      },
    } as unknown as Request;
  }

  const resMock = {} as Response;

  it('rechaza con 401 UnauthorizedError cuando no se provee cabecera Authorization', () => {
    const req = crearMockReq(undefined);
    const next = vi.fn();

    expect(() => requireAdminUsuarios(req, resMock, next)).toThrow(UnauthorizedError);
    expect(next).not.toHaveBeenCalled();
  });

  it('rechaza con 401 UnauthorizedError cuando el token es inválido o corrupto', () => {
    const req = crearMockReq('invalid.token.signature');
    const next = vi.fn();

    expect(() => requireAdminUsuarios(req, resMock, next)).toThrow(UnauthorizedError);
    expect(next).not.toHaveBeenCalled();
  });

  it('rechaza con 403 ForbiddenError cuando el usuario autenticado tiene rol CIUDADANO', () => {
    const token = firmarTokenAcceso({
      sub: 'usr-ciudadano-001',
      roles: ['CIUDADANO'],
      secreto: SECRET_KEY,
    });
    const req = crearMockReq(token);
    const next = vi.fn();

    expect(() => requireAdminUsuarios(req, resMock, next)).toThrow(ForbiddenError);
    expect(next).not.toHaveBeenCalled();
  });

  it('rechaza con 403 ForbiddenError cuando el usuario institucional tiene rol SECRETARIO o ESPECIALISTA', () => {
    const token = firmarTokenAcceso({
      sub: 'usr-funcionario-001',
      roles: ['SECRETARIO', 'ESPECIALISTA'],
      secreto: SECRET_KEY,
    });
    const req = crearMockReq(token);
    const next = vi.fn();

    expect(() => requireAdminUsuarios(req, resMock, next)).toThrow(ForbiddenError);
    expect(next).not.toHaveBeenCalled();
  });

  it('permite el acceso (invoca next) cuando el usuario tiene rol ADMINISTRADOR', () => {
    const token = firmarTokenAcceso({
      sub: 'usr-admin-001',
      roles: ['ADMINISTRADOR'],
      secreto: SECRET_KEY,
    });
    const req = crearMockReq(token);
    const next = vi.fn();

    requireAdminUsuarios(req, resMock, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('rechaza con 403 ForbiddenError cuando el usuario tiene rol legado / no canónico SUPER_ADMIN', () => {
    const token = firmarTokenAcceso({
      sub: 'usr-superadmin-001',
      roles: ['SUPER_ADMIN'],
      secreto: SECRET_KEY,
    });
    const req = crearMockReq(token);
    const next = vi.fn();

    expect(() => requireAdminUsuarios(req, resMock, next)).toThrow(ForbiddenError);
    expect(next).not.toHaveBeenCalled();
  });
});
