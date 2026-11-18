import { EventEmitter } from 'node:events';
import type { Response } from 'express';

export type CanalSse = 'casilla' | 'expedientes' | 'sla';

export const CANALES_SSE: CanalSse[] = ['casilla', 'expedientes', 'sla'];

export const EVENTO_CASILLA = 'casilla_notificacion';
export const EVENTO_TRANSICION = 'expediente_transicion';
export const EVENTO_SLA = 'sla_alerta';

const EVENTO_A_CANAL: Record<string, CanalSse> = {
  [EVENTO_CASILLA]: 'casilla',
  [EVENTO_TRANSICION]: 'expedientes',
  [EVENTO_SLA]: 'sla',
};

export const HEARTBEAT_SEGUNDOS = 15;

interface Suscriptor {
  id: number;
  res: Response;
  canales: Set<CanalSse>;
}

interface EventoBufferizado {
  id: number;
  evento: string;
  carga: string;
}

export class BusSse extends EventEmitter {
  private readonly suscriptores = new Map<number, Suscriptor>();
  private readonly maxEventosPorSuscriptor: number;
  private readonly buffer: EventoBufferizado[] = [];
  private siguienteId = 1;
  private contadorEvento = 0;

  constructor(maxEventosPorSuscriptor = 100) {
    super();
    this.setMaxListeners(0);
    this.maxEventosPorSuscriptor = maxEventosPorSuscriptor;
  }

  suscribir(res: Response, canales: CanalSse[]): number {
    const id = this.siguienteId++;
    this.suscriptores.set(id, { id, res, canales: new Set(canales) });
    return id;
  }

  cancelar(id: number): void {
    this.suscriptores.delete(id);
  }

  cantidadSuscriptores(): number {
    return this.suscriptores.size;
  }

  emitirEvento(evento: string, datos: unknown): void {
    const canal = EVENTO_A_CANAL[evento];
    this.contadorEvento += 1;
    const idEvento = this.contadorEvento;
    const carga = JSON.stringify(datos);

    this.registrarEnBuffer({ id: idEvento, evento, carga });

    for (const suscriptor of this.suscriptores.values()) {
      if (canal && !suscriptor.canales.has(canal)) continue;
      this.escribir(suscriptor.res, `id: ${idEvento}\nevent: ${evento}\ndata: ${carga}\n\n`);
    }
  }

  /**
   * Reproduce los eventos posteriores a `ultimoEventoId` para una reconexión
   * transparente del `EventSource`. Devuelve los ids realmente reproducidos.
   */
  replayDesde(ultimoEventoId: number, res: Response, canales: Set<CanalSse>): number[] {
    const pendientes = this.buffer.filter((e) => e.id > ultimoEventoId);
    const reproducidos: number[] = [];

    for (const entrada of pendientes) {
      const canal = EVENTO_A_CANAL[entrada.evento];
      if (canal && !canales.has(canal)) continue;
      this.escribir(res, `id: ${entrada.id}\nevent: ${entrada.evento}\ndata: ${entrada.carga}\n\n`);
      reproducidos.push(entrada.id);
    }

    return reproducidos;
  }

  private registrarEnBuffer(entrada: EventoBufferizado): void {
    this.buffer.push(entrada);
    if (this.buffer.length > this.maxEventosPorSuscriptor) {
      this.buffer.splice(0, this.buffer.length - this.maxEventosPorSuscriptor);
    }
  }

  emitirHeartbeat(): void {
    const trama = `:heartbeat ${new Date().toISOString()}\n\n`;
    for (const suscriptor of this.suscriptores.values()) {
      this.escribir(suscriptor.res, trama);
    }
  }

  cerrarTodos(): void {
    for (const suscriptor of this.suscriptores.values()) {
      try {
        suscriptor.res.end();
      } catch {
        // la respuesta ya estaba cerrada: no hay acción adicional
      }
    }
    this.suscriptores.clear();
  }

  private escribir(res: Response, trama: string): void {
    if (res.writableEnded) {
      return;
    }
    try {
      res.write(trama);
    } catch {
      // conexión caída a mitad de escritura: se limpia en el evento 'close'
    }
  }
}

export function parsearCanales(entrada: string | undefined): CanalSse[] {
  if (!entrada || entrada.trim() === '') {
    return CANALES_SSE;
  }
  const solicitados = entrada
    .split(',')
    .map((c) => c.trim().toLowerCase())
    .filter((c): c is CanalSse => (CANALES_SSE as string[]).includes(c));
  return solicitados.length > 0 ? solicitados : CANALES_SSE;
}
