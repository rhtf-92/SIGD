import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ServicioRutaDoc } from '../../../../src/domains/rutadoc/rutadoc.service.js';
import { ESTADOS_POR_PESTANA, type ActorRutaDoc, type FiltrosRutaDoc, type ExpedienteResumen } from '../../../../src/domains/rutadoc/rutadoc.types.js';
import { codificarCursor, decodificarCursor } from '../../../../src/domains/rutadoc/rutadoc.cursor.js';
import { filtrosSchema, idSchema } from '../../../../src/domains/rutadoc/rutadoc.schemas.js';
import type { RepositorioRutaDoc } from '../../../../src/domains/rutadoc/rutadoc.repository.js';

const actor: ActorRutaDoc = { id: 'operador-1', roles: ['MESA_PARTES'], puedeVerExpediente: () => true };
const filtros: FiltrosRutaDoc = { pestana: 'PENDIENTES', limite: 20 };
const expedienteId = 'b85b5c8e-9709-4d60-9a71-7917f7f37e17';
const expedienteAnteriorId = 'b85b5c8e-9709-4d60-9a71-7917f7f37e16';

const fila: ExpedienteResumen = {
  idExpediente: expedienteId, cut: 'EXP-2026-000017', asunto: 'Solicitud',
  fechaRadicacion: '2026-09-24T14:30:00.000Z', estadoActual: 'REGISTRADO', areaActualId: null,
};

function repositorioSimulado(): RepositorioRutaDoc {
  return {
    listar: vi.fn().mockResolvedValue({ elementos: [fila], porEstado: { REGISTRADO: 1 } }),
    obtener: vi.fn().mockResolvedValue({ ...fila, solicitanteId: '4', resumenDocumentos: null, ultimoMovimiento: null, sla: null }),
  };
}

describe('Consulta RutaDoc', () => {
  it('mapea exactamente las seis pestañas a los diez estados sin solapamientos', () => {
    expect(ESTADOS_POR_PESTANA).toEqual({
      PENDIENTES: ['REGISTRADO', 'RECEPCIONADO', 'EN_CALIFICACION'],
      EN_TRAMITE: ['EN_REVISION', 'OBSERVADO', 'SUBSANADO'],
      DERIVADOS: ['DERIVADO'], POR_FIRMAR: ['EN_FIRMA'],
      ATENDIDOS: ['RESUELTO'], ARCHIVADOS: ['ARCHIVADO'],
    });
    const estados = Object.values(ESTADOS_POR_PESTANA).flat();
    expect(new Set(estados).size).toBe(10);
  });

  it('codifica y decodifica una posición opaca con versión y filtros vinculados', () => {
    const posicion = { fechaRadicacion: fila.fechaRadicacion, idExpediente: fila.idExpediente };
    const codificado = codificarCursor(posicion, filtros);
    expect(codificado).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(decodificarCursor(codificado, filtros)).toEqual(posicion);
  });

  it('rechaza cursor malformado, alterado o usado con otros filtros', () => {
    expect(() => decodificarCursor('%', filtros)).toThrow();
    expect(() => decodificarCursor(Buffer.from('{"v":2}').toString('base64url'), filtros)).toThrow();
    expect(() => decodificarCursor(Buffer.from(JSON.stringify({ v: 1,
      fecha_radicacion: fila.fechaRadicacion, id_expediente: '17', filtros: 'legado',
    })).toString('base64url'), filtros)).toThrow();
    const cursor = codificarCursor({ fechaRadicacion: fila.fechaRadicacion, idExpediente: expedienteId }, filtros);
    expect(() => decodificarCursor(cursor, { ...filtros, terminoBusqueda: 'otro' })).toThrow();
    expect(() => decodificarCursor(codificarCursor({ fechaRadicacion: fila.fechaRadicacion,
      idExpediente: '17' }, filtros), filtros)).toThrow();
  });

  it('acepta límites 1, 20 por defecto y 100', () => {
    expect(filtrosSchema.parse({ pestana: 'PENDIENTES', limite: '1' }).limite).toBe(1);
    expect(filtrosSchema.parse({ pestana: 'PENDIENTES' }).limite).toBe(20);
    expect(filtrosSchema.parse({ pestana: 'PENDIENTES', limite: '100' }).limite).toBe(100);
  });

  it('rechaza límites fuera de rango y parámetros de paginación antiguos', () => {
    for (const limite of ['0', '101', '-1', '1.5', 'NaN']) {
      expect(() => filtrosSchema.parse({ pestana: 'PENDIENTES', limite })).toThrow(z.ZodError);
    }
    expect(() => filtrosSchema.parse({ pestana: 'PENDIENTES', pagina: '2' })).toThrow(z.ZodError);
  });

  it('valida fechas reales y un rango ordenado', () => {
    expect(filtrosSchema.parse({ pestana: 'PENDIENTES', fechaDesde: '2026-09-01', fechaHasta: '2026-09-30' }).fechaDesde)
      .toBe('2026-09-01');
    for (const valores of [
      { fechaDesde: '2026-02-30' },
      { fechaHasta: '2026-13-01' },
      { fechaDesde: '2026-10-01', fechaHasta: '2026-09-30' },
    ]) expect(() => filtrosSchema.parse({ pestana: 'PENDIENTES', ...valores })).toThrow(z.ZodError);
  });

  it('valida el UUID de expediente sin convertir decimales legados', () => {
    expect(idSchema.parse(expedienteId)).toBe(expedienteId);
    for (const id of ['0', '-1', '17', 'abc', '9223372036854775807']) {
      expect(() => idSchema.parse(id)).toThrow(z.ZodError);
    }
  });

  it('delega al repositorio con los estados de la pestaña y construye contadores', async () => {
    const repo = repositorioSimulado();
    const resultado = await new ServicioRutaDoc(repo).listar(filtros, actor);
    expect(repo.listar).toHaveBeenCalledWith(filtros, ESTADOS_POR_PESTANA.PENDIENTES, null);
    expect(resultado.elementos).toEqual([fila]);
    expect(resultado.contadores).toEqual({ PENDIENTES: 1, EN_TRAMITE: 0, DERIVADOS: 0,
      POR_FIRMAR: 0, ATENDIDOS: 0, ARCHIVADOS: 0 });
  });

  it('recorta limite + 1 y emite cursor desde el último elemento visible', async () => {
    const repo = repositorioSimulado();
    vi.mocked(repo.listar).mockResolvedValue({ elementos: [fila, { ...fila, idExpediente: expedienteAnteriorId }], porEstado: {} });
    const resultado = await new ServicioRutaDoc(repo).listar({ ...filtros, limite: 1 }, actor);
    expect(resultado.elementos).toEqual([fila]);
    expect(resultado.tieneMas).toBe(true);
    expect(decodificarCursor(resultado.siguienteCursor!, { ...filtros, limite: 1 })).toEqual({
      fechaRadicacion: fila.fechaRadicacion, idExpediente: fila.idExpediente,
    });
  });

  it('responde 404 cuando el expediente no existe', async () => {
    const repo = repositorioSimulado();
    vi.mocked(repo.obtener).mockResolvedValue(null);
    await expect(new ServicioRutaDoc(repo).obtener(expedienteId, actor)).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });

  it('propaga el fallo de repositorio para que el middleware lo sanee', async () => {
    const repo = repositorioSimulado();
    const error = new Error('secret-sql-details');
    vi.mocked(repo.listar).mockRejectedValue(error);
    await expect(new ServicioRutaDoc(repo).listar(filtros, actor)).rejects.toBe(error);
  });

  it('deniega bandeja sin rol autorizado y detalle sin política de visibilidad', async () => {
    const servicio = new ServicioRutaDoc(repositorioSimulado());
    await expect(servicio.listar(filtros, { id: 'x', roles: ['ESTUDIANTE'] }))
      .rejects.toMatchObject({ status: 403 });
    await expect(servicio.obtener(expedienteId, { id: 'x', roles: ['MESA_PARTES'] }))
      .rejects.toMatchObject({ status: 403 });
  });
});
