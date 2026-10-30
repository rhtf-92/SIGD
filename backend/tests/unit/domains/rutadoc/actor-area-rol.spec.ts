import type { Request } from 'express';
import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { firmarTokenAcceso } from '../../../../src/core/auth/jwt.service.js';
import { crearJwtActorProvider } from '../../../../src/domains/rutadoc/rutadoc.actor-provider.js';
import { resolverOperadorBigInt } from '../../../../src/domains/rutadoc/derivaciones.service.js';

describe('Área efectiva del actor RutaDoc', () => {
  it('usa el área del rol vigente para autorizar al especialista de la unidad', async () => {
    const areaId = '33333333-3333-3333-3333-333333333333';
    const pool = {
      query: vi.fn(async (sql: string, params: unknown[]) => {
        if (sql.includes('FROM sigd_auth.cuenta_usuario u')) {
          expect(sql).toContain('COALESCE(rol_area.area_id, p.area_id)');
          expect(sql).toContain('r.codigo = ANY($2::text[])');
          expect(params[1]).toEqual(['ESPECIALISTA']);
          return { rows: [{ id_persona: null, area_id: areaId }] };
        }
        if (sql.includes('FROM sigd_tra.expediente')) {
          return { rows: [{ solicitante_id: null, area_destino_id: areaId, estado: 'DERIVADO' }] };
        }
        throw new Error('Consulta inesperada');
      }),
    } as unknown as Pool;
    const token = firmarTokenAcceso({
      sub: '11111111-1111-1111-1111-111111111111',
      roles: ['ESPECIALISTA'],
      expiraSegundos: 300,
    });
    const req = { headers: { authorization: `Bearer ${token}` } } as Request;

    const actor = await crearJwtActorProvider(pool).obtenerActor(req);

    expect(actor?.unidadOrganicaId).toBe(areaId);
    expect(await actor?.puedeVerExpediente?.('22222222-2222-2222-2222-222222222222')).toBe(true);
  });

  it('rechaza un token si la cuenta ya no está activa o falla su consulta', async () => {
    const token = firmarTokenAcceso({
      sub: '11111111-1111-1111-1111-111111111111',
      roles: ['ADMINISTRADOR'],
      expiraSegundos: 300,
    });
    const req = { headers: { authorization: `Bearer ${token}` } } as Request;
    const sinCuenta = { query: vi.fn(async () => ({ rows: [] })) } as unknown as Pool;
    const sinBase = { query: vi.fn(async () => { throw new Error('DB unavailable'); }) } as unknown as Pool;

    expect(await crearJwtActorProvider(sinCuenta).obtenerActor(req)).toBeNull();
    expect(await crearJwtActorProvider(sinBase).obtenerActor(req)).toBeNull();
  });

  it('permite a Mesa leer un expediente con pago pendiente antes de derivar', async () => {
    const pool = { query: vi.fn(async (sql: string) => {
      if (sql.includes('FROM sigd_auth.cuenta_usuario u')) {
        return { rows: [{ id_persona: null, area_id: '33333333-3333-3333-3333-333333333333' }] };
      }
      if (sql.includes('FROM sigd_tra.expediente')) {
        return { rows: [{ solicitante_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', area_destino_id: null, estado: 'PENDIENTE_PAGO' }] };
      }
      throw new Error('Consulta inesperada');
    }) } as unknown as Pool;
    const token = firmarTokenAcceso({ sub: '11111111-1111-1111-1111-111111111111', roles: ['MESA_PARTES'], expiraSegundos: 300 });
    const actor = await crearJwtActorProvider(pool).obtenerActor({ headers: { authorization: `Bearer ${token}` } } as Request);
    expect(await actor?.puedeVerExpediente?.('22222222-2222-2222-2222-222222222222')).toBe(true);
  });

  it('permite leer al operador que derivo aunque no haya area origen y deniega a otro operador', async () => {
    const operador = '11111111-1111-1111-1111-111111111111';
    const area = '33333333-3333-3333-3333-333333333333';
    const pool = { query: vi.fn(async (sql: string, params: unknown[]) => {
      if (sql.includes('FROM sigd_auth.cuenta_usuario u')) {
        return { rows: [{ id_persona: null, area_id: area }] };
      }
      if (sql.includes('FROM sigd_tra.expediente')) {
        return { rows: [{ solicitante_id: null, area_destino_id: '44444444-4444-4444-4444-444444444444', estado: 'DERIVADO' }] };
      }
      if (sql.includes('FROM sigd_rut.movimiento_tramite')) {
        expect(sql).toContain('usuario_operador_id = $3::bigint');
        expect(params[1]).toBe(area);
        return { rows: params[2] === resolverOperadorBigInt(operador) ? [{ uno: 1 }] : [] };
      }
      throw new Error('Consulta inesperada');
    }) } as unknown as Pool;
    const expediente = '22222222-2222-2222-2222-222222222222';
    const actorToken = firmarTokenAcceso({ sub: operador, roles: ['MESA_PARTES'], expiraSegundos: 300 });
    const otroToken = firmarTokenAcceso({ sub: '55555555-5555-5555-5555-555555555555', roles: ['MESA_PARTES'], expiraSegundos: 300 });
    const actor = await crearJwtActorProvider(pool).obtenerActor({ headers: { authorization: `Bearer ${actorToken}` } } as Request);
    const otro = await crearJwtActorProvider(pool).obtenerActor({ headers: { authorization: `Bearer ${otroToken}` } } as Request);
    expect(await actor?.puedeVerExpediente?.(expediente)).toBe(true);
    expect(await otro?.puedeVerExpediente?.(expediente)).toBe(false);
  });
});
