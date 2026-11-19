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
    if (evento.tipo_evento === 'tesoreria_notificacion') {
      // The existing SSE bus broadcasts by channel, not by financial owner.
      // Send only a cache-invalidation hint; the authenticated Casilla API
      // resolves ownership. Never broadcast amounts, identity or references.
      const aviso = { tipoEvento: 'tesoreria_notificacion', actualizar: true };
      this.bus.emitirEvento('casilla_notificacion', aviso);
      await this.publicar?.('casilla_notificacion', aviso);
      return;
    }
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
 * y rechaza la entrega mientras IdentiCore no publique su DDL, en lugar de escribir
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
    if (this.verificado === true) return true;
    const resultado = await this.pool
      .query<{ existe: string | null }>('SELECT to_regclass($1)::text AS existe', [this.tabla])
      .catch(() => null);
    this.verificado = Boolean(resultado?.rows[0]?.existe);
    return this.verificado;
  }

  async despachar(evento: EventoPendiente): Promise<void> {
    if (evento.tipo_evento === 'tesoreria_notificacion') {
      await this.despacharFinanciera(evento);
      return;
    }
    if (!EVENTOS_CASILLA.has(evento.tipo_evento)) return;
    if (!(await this.disponible())) throw new Error('Casilla no disponible: no se puede confirmar la entrega del evento.');

    const payload = (evento.payload ?? {}) as Record<string, unknown>;
    const usuarioId = payload.usuario_id;
    const expedienteId = payload.expediente_id;
    const cut = payload.cut;
    const asunto = payload.asunto;

    // Reconocimiento de solicitante presencial sin cuenta habilitada en Casilla (usuario_id === null):
    // Condición permanente legítima: no genera reintentos indefinidos, no crea notificación
    // en casilla, no emite acuse ficticio y registra la causa en la bitácora de auditoría.
    if (usuarioId === null) {
      if (typeof expedienteId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(expedienteId)) {
        await this.pool.query(
          `INSERT INTO sigd_audit.bitacora_auditoria
             (correlation_id, esquema, tabla, operacion, datos_antes, datos_despues, fecha_hora)
           VALUES ($1::uuid, 'sigd_auth', 'notificacion_casilla', 'OMISION_CASILLA_NO_HABILITADA', $2::jsonb, $3::jsonb, clock_timestamp())`,
          [
            evento.correlation_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(evento.correlation_id)
              ? evento.correlation_id
              : '00000000-0000-0000-0000-000000000000',
            JSON.stringify({ id_evento: evento.id_evento, expediente_id: expedienteId, cut: cut ?? null }),
            JSON.stringify({ motivo: 'Solicitante presencial sin cuenta digital en Casilla Electrónica' }),
          ],
        ).catch(() => null);
      }
      return;
    }
    if (typeof usuarioId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(usuarioId)
      || typeof expedienteId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(expedienteId)
      || typeof cut !== 'string' || !cut.trim() || typeof asunto !== 'string' || !asunto.trim()) {
      throw new Error(`El evento ${evento.tipo_evento} no contiene destinatario, expediente, CUT y asunto válidos para Casilla.`);
    }

    const existente = await this.pool.query<{ usuario_id: string | null; cut: string | null }>(
      `SELECT usuario_id, cut FROM ${this.tabla} WHERE referencia = $1 LIMIT 1`,
      [evento.id_evento],
    );
    if (existente.rows.length > 0) {
      if (existente.rows[0].usuario_id !== usuarioId || existente.rows[0].cut !== cut) {
        throw new Error(`La referencia Outbox ${evento.id_evento} ya está asociada a otra notificación.`);
      }
      return;
    }

    const titular = await this.pool.query<{ existe: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM sigd_doc.expediente e
         JOIN sigd_auth.cuenta_usuario c
           ON c.id_persona = e.solicitante_id AND c.id_usuario = $3::uuid AND c.activo = TRUE
        WHERE e.expediente_id = $1::uuid AND e.codigo_expediente = $2
       ) AS existe`,
      [expedienteId, cut, usuarioId],
    );
    if (!titular.rows[0]?.existe) {
      throw new Error(`El destinatario del evento ${evento.tipo_evento} no es el titular activo del expediente.`);
    }

    let documentoUrl: string | null = null;
    if (payload.documento_id !== undefined) {
      const documentoId = payload.documento_id;
      if (typeof documentoId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(documentoId)) {
        throw new Error(`El evento ${evento.tipo_evento} contiene una referencia documental inválida.`);
      }
      const adjunto = await this.pool.query<{ existe: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM sigd_doc.documento_adjunto a
           JOIN sigd_doc.expediente e ON e.expediente_id = a.expediente_id
          WHERE a.documento_adjunto_id = $1::uuid
            AND e.expediente_id = $2::uuid AND e.codigo_expediente = $3
         ) AS existe`,
        [documentoId, expedienteId, cut],
      );
      if (!adjunto.rows[0]?.existe) {
        throw new Error(`El documento indicado por ${evento.tipo_evento} no pertenece al expediente de Casilla.`);
      }
      documentoUrl = `/api/v1/storage/documentos/${documentoId}/download`;
    }

    const correo = typeof payload.correo_destinatario === 'string' ? payload.correo_destinatario : null;
    const tipoActo = typeof payload.tipo_acto === 'string' && payload.tipo_acto.trim()
      ? payload.tipo_acto : evento.tipo_evento;
    const numeroDocumento = typeof payload.numero_documento === 'string' ? payload.numero_documento : null;
    const cuerpo = payload.cuerpo && typeof payload.cuerpo === 'object'
      ? payload.cuerpo : payload;
    await this.pool.query(
      `INSERT INTO ${this.tabla}
         (usuario_id, correo_destinatario, cut, asunto, tipo_acto, numero_documento,
          cuerpo, referencia, estado, documento_url)
       SELECT $1::uuid, $2, $3, $4, $5, $6, $7::jsonb, $8::varchar, 'NO_LEIDO', $9
        WHERE NOT EXISTS (SELECT 1 FROM ${this.tabla} WHERE referencia = $8::varchar)`,
      [usuarioId, correo, cut, asunto, tipoActo, numeroDocumento,
        JSON.stringify(cuerpo), evento.id_evento, documentoUrl],
    );
  }

  private async despacharFinanciera(evento: EventoPendiente): Promise<void> {
    if (!(await this.disponible())) throw new Error('Casilla no disponible para comunicación financiera.');
    const p = evento.payload as Record<string, unknown>;
    const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (typeof p.usuario_id !== 'string' || !uuid.test(p.usuario_id) || typeof p.orden_id !== 'string' || !uuid.test(p.orden_id)
        || typeof p.asunto !== 'string' || !p.asunto.trim()) throw new Error('Evento financiero sin destinatario u orden válidos.');
    const c = await this.pool.connect();
    try {
      await c.query('BEGIN');
      await c.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', ['casilla-financiera:' + evento.id_evento]);
      const orden = await c.query(`SELECT o.codigo FROM sigd_tes.orden_pago o JOIN sigd_auth.cuenta_usuario u ON u.id_usuario=o.ciudadano_id
        WHERE o.id=$1 AND u.id_usuario=$2 AND u.activo AND u.id_persona=o.persona_id`, [p.orden_id, p.usuario_id]);
      if (orden.rows.length !== 1 || orden.rows[0].codigo !== p.referencia_orden) throw new Error('El destinatario no es titular de la orden financiera.');
      const existente = await c.query(`SELECT usuario_id,numero_documento FROM ${this.tabla} WHERE referencia=$1`, [evento.id_evento]);
      if (existente.rows.length) {
        if (existente.rows.length !== 1 || existente.rows[0].usuario_id !== p.usuario_id || existente.rows[0].numero_documento !== orden.rows[0].codigo) throw new Error('Referencia de notificación financiera contradictoria.');
      } else await c.query(`INSERT INTO ${this.tabla}(usuario_id,asunto,tipo_acto,numero_documento,cuerpo,referencia,estado)
        VALUES($1,$2,'COMUNICACION_FINANCIERA',$3,$4::jsonb,$5,'NO_LEIDO')`, [p.usuario_id,p.asunto,orden.rows[0].codigo,JSON.stringify(p.cuerpo ?? {}),evento.id_evento]);
      await c.query('COMMIT');
    } catch (error) { await c.query('ROLLBACK'); throw error; } finally { c.release(); }
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
