import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { construirApp } from '../../src/app.js';

// MT48: todas las consultas se resuelven con dobles, sin PostgreSQL real.
const ruta = '/api/v1/admin/maestras/tipo-documento';

describe('Catálogo documental · endpoint PostgreSQL V2', () => {
  it('devuelve los UUID y datos del catálogo usando exclusivamente columnas V2 vigentes', async () => {
    const tipos = [{ tipo_documental_id: randomUUID(), codigo: 'TIPO_UNITARIO', nombre: 'Documento del doble', vigente: true }];
    const query = vi.fn(async (_sql: string) => ({ rows: tipos, rowCount: tipos.length }));
    const app = construirApp({ query } as unknown as Pool);

    const res = await request(app).get(ruta);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(tipos);
    expect(query).toHaveBeenCalledOnce();
    const sql = query.mock.calls[0][0];
    expect(sql).toContain('SELECT tipo_documental_id, codigo, nombre, vigente');
    expect(sql).toContain('FROM sigd_doc.tipo_documento');
    expect(sql).toContain('WHERE vigente = TRUE');
    expect(sql).not.toMatch(/\b(?:id|descripcion|dias_atencion_legal|INSERT|UPDATE|DELETE)\b/);
  });

  it('devuelve [] cuando el catálogo está vacío, sin opciones sustitutas', async () => {
    const query = vi.fn(async () => ({ rows: [], rowCount: 0 }));
    const res = await request(construirApp({ query } as unknown as Pool)).get(ruta);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    expect(query).toHaveBeenCalledOnce();
  });

  it('propaga un fallo SQL al middleware de errores y no responde con éxito ficticio', async () => {
    const query = vi.fn(async () => { throw Object.assign(new Error('Error SQL sintético del catálogo'), { code: '42703' }); });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const res = await request(construirApp({ query } as unknown as Pool)).get(ruta);
      expect(res.status).toBe(500);
      expect(res.headers['content-type']).toContain('application/problem+json');
      expect(res.body).toMatchObject({ status: 500, instance: ruta });
      expect(Array.isArray(res.body)).toBe(false);
      expect(log).toHaveBeenCalled();
      expect(query).toHaveBeenCalledOnce();
    } finally {
      log.mockRestore();
    }
  });
});
