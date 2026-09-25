import type { PoolClient } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { serializeError } from '../../../../src/errors/error-mapper.js';
import { reversionSchema } from '../../../../src/domains/rutadoc/rutadoc.reversion.schemas.js';
import { ServicioReversionRutaDoc } from '../../../../src/domains/rutadoc/rutadoc.reversion.service.js';
import type { RepositorioReversionRutaDoc, FilaCompensacion } from '../../../../src/domains/rutadoc/rutadoc.reversion.repository.js';
import type { ActorRutaDoc } from '../../../../src/domains/rutadoc/rutadoc.types.js';
import type { MovimientoObjetivo } from '../../../../src/domains/rutadoc/rutadoc.reversion.types.js';

const clave = 'd29a4a94-e773-4c8e-9470-f32f180caf7c';
const comando = { movimientoObjetivoId: '2', motivo: 'Corrección administrativa documentada', claveIdempotencia: clave };
const actor: ActorRutaDoc = { id: '7', roles: ['MESA_PARTES'], puedeVerExpediente: () => true };
const objetivo: MovimientoObjetivo = {
  idMovimiento: 'cc423832-82c7-4e30-803f-6a637e40b8f6', expedienteId: '42', secuencia: '2',
  fechaHora: new Date('2026-09-24T10:00:00.000Z'), estadoAnterior: 'RECEPCIONADO',
  estadoNuevo: 'EN_CALIFICACION', evento: 'INICIAR_CALIFICACION',
};
const compensacion: FilaCompensacion = {
  id_movimiento: 'a3401043-807f-41f3-9de8-a042e4b312d4', expediente_id: '42', secuencia: '3',
  estado_anterior: 'EN_CALIFICACION', estado_nuevo: 'RECEPCIONADO',
  fecha_hora: new Date('2026-09-24T10:00:01.123Z'), motivo: comando.motivo,
  correlation_id: 'corr-1', movimiento_objetivo_secuencia: '2', huella_comando: '',
  compensacion_folios: { estado: 'PENDIENTE', movimientoRelacionadoId: objetivo.idMovimiento,
    rangoAfectado: null, referencia: null },
};

function preparar() {
  const repo = {
    conBloqueo: vi.fn(async (_id: string, ejecutar: (cliente: PoolClient) => Promise<unknown>) =>
      ejecutar({} as PoolClient)),
    existeExpediente: vi.fn().mockResolvedValue(true),
    porClave: vi.fn().mockResolvedValue(null),
    objetivo: vi.fn().mockResolvedValue(objetivo),
    yaCompensada: vi.fn().mockResolvedValue(false),
    ultimaActuacion: vi.fn().mockResolvedValue({ tipo: 'NORMAL', secuencia: '2' }),
    insertar: vi.fn().mockResolvedValue(compensacion),
  };
  const politica = vi.fn().mockResolvedValue(true);
  const servicio = new ServicioReversionRutaDoc(repo as unknown as RepositorioReversionRutaDoc, politica);
  return { repo, politica, servicio };
}

describe('Reversión administrativa RutaDoc', () => {
  it('acepta el cuerpo válido y elimina espacios periféricos del motivo', () => {
    expect(reversionSchema.parse({ ...comando, motivo: ` ${comando.motivo} ` })).toEqual(comando);
  });

  it('rechaza ID objetivo no BIGINT positivo', () => {
    for (const id of ['0', '-2', 'abc', '9223372036854775808']) {
      expect(() => reversionSchema.parse({ ...comando, movimientoObjetivoId: id })).toThrow();
    }
  });

  it('rechaza motivo demasiado corto, largo y campos de actor enviados por el cliente', () => {
    expect(() => reversionSchema.parse({ ...comando, motivo: 'corto' })).toThrow();
    expect(() => reversionSchema.parse({ ...comando, motivo: 'x'.repeat(1001) })).toThrow();
    expect(() => reversionSchema.parse({ ...comando, usuarioOperadorId: '7' })).toThrow();
    expect(() => reversionSchema.parse({ ...comando, rol: 'DIRECTOR' })).toThrow();
  });

  it('rechaza clave de idempotencia no UUID', () => {
    expect(() => reversionSchema.parse({ ...comando, claveIdempotencia: '123' })).toThrow();
  });

  it('rechaza actor sin identificador confiable y no abre transacción', async () => {
    const { repo, servicio } = preparar();
    await expect(servicio.revertir('42', comando, { ...actor, id: 'operador' }, 'corr-1'))
      .rejects.toMatchObject({ status: 401 });
    expect(repo.conBloqueo).not.toHaveBeenCalled();
  });

  it('deniega permiso después de leer existencia bajo el lock', async () => {
    const { repo, politica, servicio } = preparar();
    politica.mockResolvedValue(false);
    await expect(servicio.revertir('42', comando, actor, 'corr-1'))
      .rejects.toMatchObject({ status: 403 });
    expect(repo.existeExpediente).toHaveBeenCalledOnce();
    expect(repo.objetivo).not.toHaveBeenCalled();
  });

  it('responde 404 cuando el expediente no existe', async () => {
    const { repo, servicio } = preparar();
    repo.existeExpediente.mockResolvedValue(false);
    await expect(servicio.revertir('42', comando, actor, 'corr-1'))
      .rejects.toMatchObject({ status: 404 });
  });

  it('responde 404 cuando el movimiento no existe o pertenece a otro expediente', async () => {
    const { repo, servicio } = preparar();
    repo.objetivo.mockResolvedValue(null);
    await expect(servicio.revertir('42', comando, actor, 'corr-1'))
      .rejects.toMatchObject({ status: 404 });
    expect(repo.objetivo).toHaveBeenCalledWith(expect.anything(), '42', '2');
  });

  it('impide revertir el primer movimiento', async () => {
    const { repo, servicio } = preparar();
    repo.objetivo.mockResolvedValue({ ...objetivo, secuencia: '1' });
    await expect(servicio.revertir('42', { ...comando, movimientoObjetivoId: '1' }, actor, 'corr-1'))
      .rejects.toMatchObject({ status: 422, code: 'MOVIMIENTO_INICIAL_NO_REVERSIBLE' });
  });

  it('rechaza una actuación que ya no es la última efectiva', async () => {
    const { repo, servicio } = preparar();
    repo.ultimaActuacion.mockResolvedValue({ tipo: 'NORMAL', secuencia: '3' });
    await expect(servicio.revertir('42', comando, actor, 'corr-1'))
      .rejects.toMatchObject({ status: 409, code: 'ACTUACION_DESACTUALIZADA' });
  });

  it('rechaza una actuación ya compensada', async () => {
    const { repo, servicio } = preparar();
    repo.yaCompensada.mockResolvedValue(true);
    await expect(servicio.revertir('42', comando, actor, 'corr-1'))
      .rejects.toMatchObject({ status: 409, code: 'ACTUACION_YA_COMPENSADA' });
  });

  it('inserta compensación y devuelve el estado anterior persistido', async () => {
    const { repo, servicio } = preparar();
    const resultado = await servicio.revertir('42', comando, actor, 'corr-1');
    expect(repo.insertar).toHaveBeenCalledOnce();
    expect(repo.insertar.mock.calls[0][1]).toMatchObject({ objetivo,
      usuarioOperadorId: '7', correlationId: 'corr-1' });
    expect(resultado).toMatchObject({ expedienteId: '42', movimientoRevertidoId: '2',
      movimientoCompensatorioId: '3', estadoAntesDeReversion: 'EN_CALIFICACION',
      estadoRestaurado: 'RECEPCIONADO', compensacionFolios: { estado: 'PENDIENTE' } });
  });

  it('repite la misma clave sin insertar otro movimiento', async () => {
    const { repo, servicio } = preparar();
    const primero = await servicio.revertir('42', comando, actor, 'corr-1');
    const huella = repo.insertar.mock.calls[0][1].huellaComando as string;
    repo.porClave.mockResolvedValue({ ...compensacion, huella_comando: huella });
    const repetido = await servicio.revertir('42', comando, actor, 'corr-2');
    expect(repetido).toEqual(primero);
    expect(repo.insertar).toHaveBeenCalledOnce();
  });

  it('rechaza reutilizar la misma clave con contenido diferente', async () => {
    const { repo, servicio } = preparar();
    repo.porClave.mockResolvedValue({ ...compensacion, huella_comando: 'otra' });
    await expect(servicio.revertir('42', comando, actor, 'corr-1'))
      .rejects.toMatchObject({ status: 409, code: 'CLAVE_IDEMPOTENCIA_REUTILIZADA' });
    expect(repo.insertar).not.toHaveBeenCalled();
  });

  it('rechaza reutilizar la misma clave con otro movimiento objetivo', async () => {
    const { repo, servicio } = preparar();
    repo.porClave.mockResolvedValue({ ...compensacion, huella_comando: 'huella-original' });
    await expect(servicio.revertir('42', { ...comando, movimientoObjetivoId: '3' }, actor, 'corr-1'))
      .rejects.toMatchObject({ status: 409, code: 'CLAVE_IDEMPOTENCIA_REUTILIZADA' });
    expect(repo.insertar).not.toHaveBeenCalled();
  });

  it('propaga fallos internos para que RFC 7807 los sanee', async () => {
    const { repo, servicio } = preparar();
    repo.insertar.mockRejectedValue(new Error('detalle SQL privado'));
    const error = await servicio.revertir('42', comando, actor, 'corr-1').catch((e: unknown) => e);
    expect(serializeError(error)).toMatchObject({ status: 500, code: 'INTERNAL_ERROR' });
    expect(serializeError(error).detail).not.toContain('SQL');
  });
});
