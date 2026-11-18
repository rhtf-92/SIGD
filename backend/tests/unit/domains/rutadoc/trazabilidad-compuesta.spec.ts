import { describe, expect, it, vi } from 'vitest';
import { ServicioTrazabilidadRutaDoc } from '../../../../src/domains/rutadoc/trazabilidad.service.js';
import type { RepositorioTrazabilidadRutaDoc } from '../../../../src/domains/rutadoc/trazabilidad.types.js';
import type { ActorRutaDoc } from '../../../../src/domains/rutadoc/rutadoc.types.js';

const institutional: ActorRutaDoc = {
  id: '11111111-1111-1111-1111-111111111111',
  roles: ['MESA_PARTES'],
  puedeVerExpediente: async () => true,
};
const movement = (sequence: string, event: string, id: string) => ({
  movimientoId: id,
  secuencia: sequence,
  fechaHora: '2026-10-29T10:05:00.000Z',
  estadoAnterior: 'REGISTRADO' as const,
  evento: event,
  estadoNuevo: 'RECEPCIONADO' as const,
  usuarioOperadorId: '987654321',
  areaAnteriorId: null,
  areaDestinoId: null,
  areaDestinoNombre: event === 'DERIVACION' ? 'Subdirección Académica' : null,
  remitente: null,
  destinatario: null,
  proveido: null,
  datosAsociados: { notaInterna: 'privada' },
  tipoActuacion: 'NORMAL' as const,
});

describe('Trazabilidad compuesta del expediente', () => {
  it('ordena fuentes físicas, desempata movimientos por secuencia y elimina duplicados', async () => {
    const source = [
      { id: 'RADICACION:a', tipo: 'RADICACION' as const, fechaHora: '2026-10-29T10:00:00.000Z', titulo: 'Solicitud radicada', detalle: 'EXP-2026-000001' },
      { id: 'ORDEN_PAGO:b', tipo: 'ORDEN_PAGO' as const, fechaHora: '2026-10-29T10:00:00.000Z', titulo: 'Orden de pago generada', detalle: 'PAG-2026-000001' },
      { id: 'PAGO_CONFIRMADO:b', tipo: 'PAGO_CONFIRMADO' as const, fechaHora: '2026-10-29T10:04:00.000Z', titulo: 'Pago confirmado', detalle: 'REC-2026-000001' },
    ];
    const repo: RepositorioTrazabilidadRutaDoc = {
      existeExpediente: async () => true,
      listarEventosOrigen: async () => [...source, source[1]],
      listar: async () => [movement('1', 'RECEPCION', 'm1'), movement('2', 'INICIAR_CALIFICACION', 'm2'), movement('3', 'DERIVACION', 'm3')],
    };
    const result = await new ServicioTrazabilidadRutaDoc(repo).obtener('exp', institutional);
    expect(result.eventos?.map((event) => event.tipo)).toEqual([
      'RADICACION', 'ORDEN_PAGO', 'PAGO_CONFIRMADO', 'MOVIMIENTO', 'MOVIMIENTO', 'MOVIMIENTO',
    ]);
    expect(result.eventos?.slice(-3).map((event) => event.titulo)).toEqual([
      'Solicitud recibida', 'Calificación iniciada', 'Derivado a Subdirección Académica',
    ]);
    expect(new Set(result.eventos?.map((event) => event.id)).size).toBe(6);
    expect(result.actuaciones).toHaveLength(3);
  });

  it('no fabrica pago en un expediente sin orden y oculta metadata de movimientos al ciudadano', async () => {
    const repo: RepositorioTrazabilidadRutaDoc = {
      existeExpediente: async () => true,
      listarEventosOrigen: async () => [
        { id: 'RADICACION:a', tipo: 'RADICACION', fechaHora: '2026-10-29T10:00:00.000Z', titulo: 'Solicitud radicada', detalle: 'EXP-2026-000002' },
      ],
      listar: async () => [movement('1', 'RECEPCION', 'm1')],
    };
    const result = await new ServicioTrazabilidadRutaDoc(repo).obtener('exp', { ...institutional, roles: ['CIUDADANO'] });
    expect(result.eventos?.map((event) => event.tipo)).toEqual(['RADICACION', 'MOVIMIENTO']);
    expect(result.actuaciones).toEqual([]);
    expect(JSON.stringify(result.eventos)).not.toContain('notaInterna');
    expect(JSON.stringify(result.eventos)).not.toContain('987654321');
  });

  it('consulta fuentes funcionales solo después de superar BOLA', async () => {
    const listarEventosOrigen = vi.fn();
    const repo: RepositorioTrazabilidadRutaDoc = {
      existeExpediente: async () => true,
      listarEventosOrigen,
      listar: vi.fn(),
    };
    await expect(new ServicioTrazabilidadRutaDoc(repo).obtener('exp', { ...institutional, puedeVerExpediente: async () => false }))
      .rejects.toMatchObject({ status: 403 });
    expect(listarEventosOrigen).not.toHaveBeenCalled();
    expect(repo.listar).not.toHaveBeenCalled();
  });
});
