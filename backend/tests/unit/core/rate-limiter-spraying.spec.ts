import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response } from 'express';
import { crearRateLimiter, extraerIpCliente } from '../../../src/middleware/rate-limiter.middleware.js';

describe('SEC-10: Rate Limiter — Mitigación de Password Spraying y Trust Proxy', () => {
  beforeEach(() => {
    delete process.env.TRUST_PROXY;
  });

  it('extraerIpCliente: ignora x-forwarded-for si TRUST_PROXY no está configurado (evita spoofing)', () => {
    const mockReq = {
      ip: '192.168.1.50',
      socket: { remoteAddress: '192.168.1.50' },
      headers: {
        'x-forwarded-for': '203.0.113.195, 10.0.0.1',
      },
    } as unknown as Request;

    const ip = extraerIpCliente(mockReq);
    expect(ip).toBe('192.168.1.50');
  });

  it('extraerIpCliente: respeta el primer IP de x-forwarded-for cuando TRUST_PROXY=true', () => {
    process.env.TRUST_PROXY = 'true';
    const mockReq = {
      ip: '10.0.0.1',
      socket: { remoteAddress: '10.0.0.1' },
      headers: {
        'x-forwarded-for': '203.0.113.195, 10.0.0.1',
      },
    } as unknown as Request;

    const ip = extraerIpCliente(mockReq);
    expect(ip).toBe('203.0.113.195');
  });

  it('bloquea tras superar maxIntentosPorIp mitigando ataques de Password Spraying horizontal', () => {
    const limiter = crearRateLimiter({
      windowMs: 60 * 1000,
      maxIntentos: 5,
      maxIntentosPorIp: 10,
    });

    const ipAtacante = '198.51.100.22';

    // Simular 10 intentos a 10 usuarios distintos desde la misma IP
    for (let i = 1; i <= 10; i++) {
      let nextCalled = false;
      const req = {
        ip: ipAtacante,
        socket: { remoteAddress: ipAtacante },
        body: { identificador: `usuario_${i}` },
        headers: {},
      } as unknown as Request;

      const res = {
        setHeader: vi.fn(),
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      } as unknown as Response;

      limiter(req, res, () => { nextCalled = true; });
      expect(nextCalled).toBe(true);
    }

    // El intento 11 hacia un usuario_11 nuevo debe ser bloqueado por IP global
    let blockedCode: string | null = null;
    let blockedStatus = 0;

    const req11 = {
      ip: ipAtacante,
      socket: { remoteAddress: ipAtacante },
      body: { identificador: 'usuario_11_nuevo' },
      headers: {},
    } as unknown as Request;

    const res11 = {
      setHeader: vi.fn(),
      status: vi.fn((code: number) => {
        blockedStatus = code;
        return res11;
      }),
      json: vi.fn((body: any) => {
        blockedCode = body?.code;
      }),
    } as unknown as Response;

    let next11Called = false;
    limiter(req11, res11, () => { next11Called = true; });

    expect(next11Called).toBe(false);
    expect(blockedStatus).toBe(429);
    expect(blockedCode).toBe('RATE_LIMIT_IP_EXCEEDED');
  });
});
