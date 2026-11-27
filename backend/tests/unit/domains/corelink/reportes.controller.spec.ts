import { describe, expect, it, vi } from 'vitest';

import { crearControladorReportes } from '../../../../src/domains/corelink/reportes.controller.js';

describe('Controlador de reportes: degradación del resumen', () => {
  it('devuelve KPIs en cero cuando la lectura del servicio falla', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = { json: vi.fn().mockReturnThis() };
    const req = {
      query: {
        periodoDesde: '2026-01',
        periodoHasta: '2026-12',
        unidadOrganicaId: 'unidad-1',
      },
    };
    const actorProvider = {
      obtenerActor: vi.fn(async () => ({
        id: 'director',
        roles: ['DIRECTOR'],
        unidadOrganicaId: null,
        puedeVerExpediente: () => true,
      })),
    };
    const servicio = {
      resumen: vi.fn(async () => {
        throw new Error('fallo de base de datos');
      }),
    };
    const controlador = crearControladorReportes(
      actorProvider as never,
      servicio as never,
      {} as never,
    );

    await controlador.resumen(req as never, res as never, (() => {}) as never);

    expect(res.json).toHaveBeenCalledTimes(1);
    const cuerpo = res.json.mock.calls[0][0];
    expect(cuerpo.periodo).toBe('2026-01 — 2026-12');
    expect(cuerpo.unidadOrganicaId).toBe('unidad-1');
    expect(cuerpo.actualizadoEn).toBeNull();
    expect(cuerpo.vtep.valor).toBe(0);
    expect(cuerpo.contadores.nRadicados).toBe(0);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
