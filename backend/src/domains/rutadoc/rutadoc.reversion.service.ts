import { createHash } from 'node:crypto';
import { AppError } from '../../shared/domain/errors/app-error.js';
import { ConflictError } from '../../shared/domain/errors/conflict-error.js';
import { ForbiddenError } from '../../shared/domain/errors/forbidden-error.js';
import { NotFoundError } from '../../shared/domain/errors/not-found-error.js';
import { UnauthorizedError } from '../../shared/domain/errors/unauthorized-error.js';
import { esIdExpediente } from './rutadoc.cursor.js';
import { RepositorioReversionRutaDoc, type FilaCompensacion } from './rutadoc.reversion.repository.js';
import type {
  ComandoReversion, CompensacionFolios, PoliticaReversionRutaDoc,
  PrepararCompensacionFolios, ResultadoReversion,
} from './rutadoc.reversion.types.js';
import type { ActorRutaDoc } from './rutadoc.types.js';

export const prepararCompensacionPendiente: PrepararCompensacionFolios = (objetivo) => ({
  estado: 'PENDIENTE',
  movimientoRelacionadoId: objetivo.idMovimiento,
  rangoAfectado: null,
  referencia: null,
});

function huellaComando(expedienteId: string, comando: ComandoReversion): string {
  return createHash('sha256').update(JSON.stringify({
    operacion: 'REVERSION_ADMINISTRATIVA', expedienteId,
    movimientoObjetivoId: comando.movimientoObjetivoId, motivo: comando.motivo,
  })).digest('hex');
}

function respuesta(fila: FilaCompensacion): ResultadoReversion {
  return {
    expedienteId: fila.expediente_id,
    movimientoRevertidoId: fila.movimiento_objetivo_secuencia,
    movimientoCompensatorioId: fila.secuencia,
    movimientoCompensatorioUuid: fila.id_movimiento,
    estadoAntesDeReversion: fila.estado_anterior,
    estadoRestaurado: fila.estado_nuevo,
    motivo: fila.motivo,
    fechaHora: fila.fecha_hora.toISOString(),
    compensacionFolios: fila.compensacion_folios,
    correlationId: fila.correlation_id,
  };
}

export class ServicioReversionRutaDoc {
  constructor(
    private readonly repositorio: RepositorioReversionRutaDoc,
    private readonly puedeRevertir: PoliticaReversionRutaDoc = () => false,
    private readonly prepararFolios: PrepararCompensacionFolios = prepararCompensacionPendiente,
  ) {}

  async revertir(expedienteId: string, comando: ComandoReversion,
    actor: ActorRutaDoc, correlationId: string): Promise<ResultadoReversion> {
    if (!esIdExpediente(actor.id)) throw new UnauthorizedError();
    const huella = huellaComando(expedienteId, comando);
    return this.repositorio.conBloqueo(expedienteId, async (cliente) => {
      if (!await this.repositorio.existeExpediente(cliente, expedienteId)) {
        throw new NotFoundError({ detail: 'El expediente no existe.' });
      }
      if (!actor.puedeVerExpediente || !await actor.puedeVerExpediente(expedienteId) ||
          !await this.puedeRevertir(actor, expedienteId)) {
        throw new ForbiddenError();
      }

      const anterior = await this.repositorio.porClave(cliente, expedienteId, comando.claveIdempotencia);
      if (anterior) {
        if (anterior.huella_comando !== huella ||
            anterior.movimiento_objetivo_secuencia !== comando.movimientoObjetivoId) {
          throw new ConflictError({ code: 'CLAVE_IDEMPOTENCIA_REUTILIZADA',
            message: 'La clave de idempotencia ya corresponde a otra reversión.' });
        }
        return respuesta(anterior);
      }

      const objetivo = await this.repositorio.objetivo(cliente, expedienteId, comando.movimientoObjetivoId);
      if (!objetivo) {
        throw new NotFoundError({ detail: 'El movimiento objetivo no existe en el expediente.' });
      }
      if (objetivo.secuencia === '1') {
        throw new AppError({ status: 422, code: 'MOVIMIENTO_INICIAL_NO_REVERSIBLE',
          message: 'El movimiento inicial no puede revertirse.' });
      }
      if (await this.repositorio.yaCompensada(cliente, objetivo)) {
        throw new ConflictError({ code: 'ACTUACION_YA_COMPENSADA',
          message: 'La actuación ya fue compensada.' });
      }
      const ultima = await this.repositorio.ultimaActuacion(cliente, expedienteId);
      if (!ultima || ultima.tipo !== 'NORMAL' || ultima.secuencia !== objetivo.secuencia) {
        throw new ConflictError({ code: 'ACTUACION_DESACTUALIZADA',
          message: 'La actuación objetivo ya no es la última efectiva.' });
      }

      const folios: CompensacionFolios = this.prepararFolios(objetivo);
      const creada = await this.repositorio.insertar(cliente, {
        objetivo, usuarioOperadorId: actor.id, motivo: comando.motivo,
        claveIdempotencia: comando.claveIdempotencia, huellaComando: huella,
        correlationId, compensacionFolios: folios,
      });
      return respuesta(creada);
    });
  }
}
