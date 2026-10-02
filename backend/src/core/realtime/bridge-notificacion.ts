import { Client, type Notification } from 'pg';
import type { BusSse } from '../../modules/corelink/sseStream.service.js';
import { reintentar, esperarConJitter } from '../../utils/backoff.util.js';

export const CANAL_NOTIFY = 'sigd_evento_dominio';

export interface EventoDominioNotificado {
  evento: string;
  canal: string | null;
  datos: unknown;
}

export interface OpcionesBridge {
  nombreInstancia?: string;
  maxPayloadBytes?: number;
}

interface EnvelopeNotificado {
  origen: string;
  evento: string;
  datos: unknown;
}

/**
 * Distribuidor de eventos entre réplicas del backend.
 *
 * El patrón Transactional Outbox garantiza que cada réplica escriba sus eventos en
 * `sigd_audit.evento_outbox` dentro de la transacción de negocio, pero el bus SSE
 * vive en memoria: sin este puente, un cliente conectado a la réplica A no
 * recibiría los eventos que la réplica B acaba de despachar. PostgreSQL
 * `LISTEN/NOTIFY` reparte el evento a todas las réplicas sin incorporar Redis
 * (§4.8 del endpoint #55), y la reconexión con `Last-Event-ID` cubre la ventana
 * en que una réplica estuvo desconectada.
 */
export class BridgeNotificacion {
  private readonly bus: BusSse;
  private readonly databaseUrl: string;
  private readonly nombreInstancia: string;
  private readonly maxPayloadBytes: number;
  private cliente: Client | null = null;
  private detenido = false;
  private conectado = false;

  constructor(databaseUrl: string, bus: BusSse, opciones: OpcionesBridge = {}) {
    this.databaseUrl = databaseUrl;
    this.bus = bus;
    this.nombreInstancia = opciones.nombreInstancia ?? `instancia-${process.pid}`;
    this.maxPayloadBytes = opciones.maxPayloadBytes ?? 64 * 1024;
  }

  estaConectado(): boolean {
    return this.conectado;
  }

  async iniciar(): Promise<void> {
    this.detenido = false;

    await reintentar(
      async () => {
        const cliente = new Client({ connectionString: this.databaseUrl });
        cliente.on('notification', (aviso: Notification) => this.recibir(aviso));
        cliente.on('error', (error: Error) => {
          this.conectado = false;
          if (!this.detenido) {
            console.error('[BRIDGE] Conexión de notificación perdida:', error.message);
          }
        });
        await cliente.connect();
        await cliente.query(`LISTEN ${CANAL_NOTIFY}`);
        this.cliente = cliente;
        this.conectado = true;
        console.log(`[BRIDGE] Escuchando el canal ${CANAL_NOTIFY} como ${this.nombreInstancia}.`);
      },
      { intentos: 5, baseMs: 300, techoMs: 4000, nombreOperacion: 'bridge-notificacion-listen' },
    ).catch((error: unknown) => {
      console.error('[BRIDGE] No fue posible suscribirse a NOTIFY; el bus SSE queda local a esta réplica:', error);
    });
  }

  private recibir(aviso: Notification): void {
    if (!aviso.payload) return;
    if (Buffer.byteLength(aviso.payload, 'utf8') > this.maxPayloadBytes) {
      console.warn('[BRIDGE] Notificación descartada por exceder el tamaño máximo de payload.');
      return;
    }

    let envelope: EnvelopeNotificado;
    try {
      envelope = JSON.parse(aviso.payload) as EnvelopeNotificado;
    } catch {
      return;
    }

    if (envelope.origen === this.nombreInstancia) return;
    if (!envelope.evento) return;

    this.bus.emitirEvento(envelope.evento, envelope.datos);
  }

  /**
   * Publica un evento ya despachado por el Outbox para que todas las réplicas
   * lo repartan a sus suscriptores SSE. Se ejecuta después del COMMIT para no
   * ampliar la ventana de bloqueo de la transacción de negocio.
   */
  async publicar(evento: string, datos: unknown): Promise<void> {
    if (!this.conectado || !this.cliente) return;
    const envelope: EnvelopeNotificado = { origen: this.nombreInstancia, evento, datos };
    const payload = JSON.stringify(envelope);
    if (Buffer.byteLength(payload, 'utf8') > this.maxPayloadBytes) return;
    await this.cliente.query(`SELECT pg_notify($1, $2)`, [CANAL_NOTIFY, payload]);
  }

  async detener(): Promise<void> {
    this.detenido = true;
    this.conectado = false;
    const cliente = this.cliente;
    this.cliente = null;
    if (!cliente) return;
    await esperarConJitter(0);
    await cliente.end().catch(() => undefined);
  }
}