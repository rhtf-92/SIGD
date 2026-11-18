import { describe, it, expect, vi } from 'vitest';
import type { PoolClient, Pool } from 'pg';
import request from 'supertest';
import { insertarEvento } from '../../../src/audit/evento-outbox.repository.js';
import { construirApp } from '../../../src/app.js';
import { firmarTokenAcceso } from '../../../src/core/auth/jwt.service.js';

describe('DAT-03 & DAT-04: Evento Outbox Robustness and Acumular Outbox', () => {
  it('DAT-03: insertarEvento genera UUID aleatorio si contexto es nulo (evita violar NOT NULL)', async () => {
    let capturedQuery = '';
    let capturedParams: any[] = [];

    const mockClient = {
      query: vi.fn(async (queryText: string, params?: any[]) => {
        capturedQuery = queryText;
        capturedParams = params ?? [];
        return { rows: [{ id_evento: 'evt-uuid-generated-1' }], rowCount: 1 };
      }),
    } as unknown as PoolClient;

    const idEvento = await insertarEvento(mockClient, {
      agregado: 'Expediente',
      tipo_evento: 'ExpedientePrueba',
      payload: { clave: 'valor' },
    });

    expect(idEvento).toBe('evt-uuid-generated-1');
    expect(capturedQuery).toContain('INSERT INTO sigd_audit.evento_outbox');
    expect(capturedParams[0]).toBeDefined();
    expect(capturedParams[0]).not.toBeNull();
    // Debe ser un UUIDv4 válido (36 caracteres con guiones)
    expect(capturedParams[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('DAT-04: POST /api/v1/expedientes/:id/acumular emite evento ExpedienteAcumulado al outbox transaccional', async () => {
    const principalId = '11111111-1111-1111-1111-111111111111';
    const accesorioId = '22222222-2222-2222-2222-222222222222';
    const token = firmarTokenAcceso({
      sub: 'usuario-operador-1',
      roles: ['MESA_PARTES'],
      expiraSegundos: 300,
    });

    const executedQueries: string[] = [];
    let outboxPayload: any = null;

    const fakeClient = {
      query: vi.fn(async (queryText: string, params?: any[]) => {
        executedQueries.push(queryText);
        if (queryText.includes('acumular_expediente')) {
          return { rows: [{ id_acumulacion: 'acum-uuid-1' }], rowCount: 1 };
        }
        if (queryText.includes('INSERT INTO sigd_audit.evento_outbox')) {
          outboxPayload = JSON.parse(params?.[3] ?? '{}');
          return { rows: [{ id_evento: 'evt-acum-1' }], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      }),
      release: vi.fn(),
    };

    const fakePool = {
      query: vi.fn(async (queryText: string) => {
        if (queryText.includes('FROM sigd_auth.cuenta_usuario')) {
          return { rows: [{ id_usuario: 'usr-1', rol_codigo: 'MESA_PARTES' }], rowCount: 1 };
        }
        if (queryText.includes('sigd_tra.expediente')) {
          return {
            rows: [
              {
                solicitante_id: 'usr-1',
                area_destino_id: 'area-1',
                estado: 'REGISTRADO',
              },
            ],
            rowCount: 1,
          };
        }
        return { rows: [], rowCount: 1 };
      }),
      connect: vi.fn(async () => fakeClient),
    } as unknown as Pool;

    const app = construirApp(fakePool);

    const res = await request(app)
      .post(`/api/v1/expedientes/${principalId}/acumular`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        expedienteAccesorioId: accesorioId,
        actoResolutivo: 'Resolución Directoral 045-2026',
      });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.idAcumulacion).toBe('acum-uuid-1');

    // Validar que se emitió el evento ExpedienteAcumulado antes de COMMIT
    expect(executedQueries.some(q => q.includes('acumular_expediente'))).toBe(true);
    expect(executedQueries.some(q => q.includes('INSERT INTO sigd_audit.evento_outbox'))).toBe(true);
    expect(executedQueries).toContain('BEGIN');
    expect(executedQueries).toContain('COMMIT');
    expect(outboxPayload).toMatchObject({
      expediente_principal_id: principalId,
      expediente_accesorio_id: accesorioId,
      acto_resolutivo: 'Resolución Directoral 045-2026',
      id_acumulacion: 'acum-uuid-1',
    });
  });
});
