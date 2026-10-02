import type { Pool } from 'pg';
import type { BusSse } from '../modules/corelink/sseStream.service.js';
import type { BridgeNotificacion } from '../core/realtime/bridge-notificacion.js';
import type { EventoPendiente } from './outbox-worker.js';

export interface DestinoNotificacion {
  readonly nombre: string;
  despachar(evento: EventoPendiente): Promise<void>;
}

const EVENTOS_CASILLA = new Set([
  'casilla_notificacion',
  'expediente_observado',
  'expediente_resuelto',
  'resolucion_emitida',
]);

export interface DestinoSseOptions {
  publicarFueraDeTransaccion?: (evento: string, datos: unknown) => Promise<void>;
}

/**
 * Destino de tiempo real: publica el evento en el bus SSE local y lo reparte al
 * resto de réplicas mediante `NOTIFY`, de modo que un `EventSource` conectado a
 * cualquier instancia recibe las notificaciones emitidas por cualquier otra.
 */
export class DestinoSse implements DestinoNotificacion {
  readonly nombre = 'sse';
  private readonly bus: BusSse;
  private readonly publicar?: (evento: string, datos: unknown) => Promise<void>;

  constructor(bus: BusSse, bridge?: BridgeNotificacion | null) {
    this.bus = bus;
    this.publicar = bridge?.publicar.bind(bridge) ?? undefined;
  }

  async despachar(evento: EventoPendiente): Promise<void> {
    const datos = {
      ...(evento.payload as Record<string, unknown>),
      idEvento: evento.id_evento,
      correlationId: evento.correlation_id,
      tipoEvento: evento.tipo_evento,
    };
    this.bus.emitirEvento(evento.tipo_evento, datos);
    await this.publicar?.(evento.tipo_evento, datos);
  }
}

export interface DestinoCasillaOptions {
  tabla?: string;
}

/**
 * Destino de Casilla Electrónica.
 *
 * Las tablas de la Casilla Electrónica pertenecen al subdominio IdentiCore
 * (`B_JAIR`) y todavía no forman parte del DDL canónico desplegado por las
 * migraciones `01`..`06`. Este destino comprueba su existencia con `to_regclass`
 * y queda inactivo mientras IdentiCore no publique su DDL, en lugar de escribir
 * en una tabla inventada. Cuando la tabla exista, el mismo código entrega la
 * notificación sin cambios.
 */
export class DestinoCasilla implements DestinoNotificacion {
  readonly nombre = 'casilla';
  private readonly pool: Pool;
  private readonly tabla: string;
  private verificado: boolean | null = null;

  constructor(pool: Pool, opciones: DestinoCasillaOptions = {}) {
    this.pool = pool;
    this.tabla = opciones.tabla ?? 'sigd_auth.notificacion_casilla';
  }

  async disponible(): Promise<boolean> {
    if (this.verificado !== null) return this.verificado;
    const resultado = await this.pool
      .query<{ existe: string | null }>('SELECT to_regclass($1)::text AS existe', [this.tabla])
      .catch(() => null);
    this.verificado = Boolean(resultado?.rows[0]?.existe);
    return this.verificado;
  }

  async despachar(evento: EventoPendiente): Promise<void> {
    if (!EVENTOS_CASILLA.has(evento.tipo_evento)) return;
    if (!(await this.disponible())) return;

    const payload = (evento.payload ?? {}) as Record<string, unknown>;
    const correo = typeof payload.correo_destinatario === 'string' ? payload.correo_destinatario : null;
    if (!correo) return;

    await this.pool.query(
      `INSERT INTO ${this.tabla} (correo_destinatario, asunto, cuerpo, referencia, estado)
       VALUES ($1, $2, $3::jsonb, $4, 'PENDIENTE')`,
      [
        correo,
        typeof payload.asunto === 'string' ? payload.asunto : evento.tipo_evento,
        JSON.stringify(payload),
        evento.correlation_id ?? evento.id_evento,
      ],
    );
  }
}

export interface ResumenDespacho {
  destinos: string[];
  omitidos: string[];
}

export interface OpcionesDespachador {
  destinos: DestinoNotificacion[];
  onFallo?: (destino: string, error: unknown) => void;
}

/**
 * Despachador compuesto: entrega a todos los destinos y propaga el primer fallo
 * para que el OutboxWorker reintente con backoff exponencial y, agotados los
 * intentos, marque el evento como `FALLIDO` (dead-letter). Ningún destino puede
 * perder un evento en silencio.
 */
export class DespachadorNotificaciones {
  private readonly destinos: DestinoNotificacion[];

  constructor(opciones: OpcionesDespachador | DestinoNotificacion[]) {
    this.destinos = Array.isArray(opciones) ? opciones : opciones.destinos;
  }

  nombres(): string[] {
    return this.destinos.map((d) => d.nombre);
  }

  async despachar(evento: EventoPendiente): Promise<ResumenDespacho> {
    const errores: unknown[] = [];

    for (const destino of this.destinos) {
      try {
        await destino.despachar(evento);
      } catch (error) {
        errores.push(error);
        console.error(`[OUTBOX] Destino ${destino.nombre} falló para ${evento.id_evento}:`, error);
      }
    }

    if (errores.length > 0) {
      throw errores[0];
    }

    return { destinos: this.nombres(), omitidos: [] };
  }
}

export function crearDespachadorPorDefecto(
  bus: BusSse,
  pool: Pool,
  bridge?: BridgeNotificacion | null,
): DespachadorNotificaciones {
  return new DespachadorNotificaciones([
    new DestinoSse(bus, bridge),
    new DestinoCasilla(pool),
  ]);
}