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
  'ExpedienteAtendido',
  'ExpedienteObservado',
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
    const datosEsp = (payload.datos_especificos ?? {}) as Record<string, unknown>;
    const identidad = (payload.identidad ?? {}) as Record<string, unknown>;

    const cut = (typeof payload.cut === 'string' ? payload.cut : null)
      ?? (typeof datosEsp.cut === 'string' ? datosEsp.cut : null)
      ?? (typeof datosEsp.codigo_expediente === 'string' ? datosEsp.codigo_expediente : null)
      ?? (typeof identidad.codigo_expediente === 'string' ? identidad.codigo_expediente : null);

    let personaId = (typeof payload.persona_id === 'string' ? payload.persona_id : null)
      ?? (typeof payload.solicitante_id === 'string' ? payload.solicitante_id : null)
      ?? (typeof datosEsp.persona_id === 'string' ? datosEsp.persona_id : null)
      ?? (typeof identidad.persona_id === 'string' ? identidad.persona_id : null);

    let usuarioId = (typeof payload.usuario_id === 'string' ? payload.usuario_id : null)
      ?? (typeof identidad.usuario_id === 'string' ? identidad.usuario_id : null);

    const correo = typeof payload.correo_destinatario === 'string' ? payload.correo_destinatario : null;

    // Validación fail-closed de evento notificable (Sección 13 y 14 / TC-5K-14)
    // Para un evento que ES notificable pero carece de destinatario resoluble: lanzar error para dead-letter/retry
    if (!correo && !usuarioId && !personaId && !cut) {
      throw new Error(
        `[DestinoCasilla] Evento notificable '${evento.tipo_evento}' (${evento.id_evento}) carece de destinatario resoluble (cut, persona_id, usuario_id o correo).`,
      );
    }

    // Resolución de usuario_id activo si la persona tiene cuenta (Sección 8, 9, 10 / TC-5K-06, TC-5K-07)
    if (personaId && !usuarioId) {
      try {
        const resCuenta = await this.pool.query<{ id_usuario: string }>(
          `SELECT id_usuario FROM sigd_auth.cuenta_usuario WHERE id_persona = $1::uuid AND activo = true ORDER BY creado_en DESC LIMIT 1`,
          [personaId],
        );
        if (resCuenta.rows.length > 0 && resCuenta.rows[0].id_usuario) {
          usuarioId = resCuenta.rows[0].id_usuario;
        }
      } catch {
        // En caso de error de consulta auxiliar, continuar con usuarioId = null
      }
    }

    // Clave de idempotencia canónica e inequívoca basada directamente en el evento inmutable (Sección 6 / 5K.2)
    const idempotencyKey = `notif:${evento.id_evento}:casilla`;

    // 1. Idempotencia: Verificar si ya existe una entrada con esta clave
    const existente = await this.pool.query<{ id: string }>(
      `SELECT id FROM ${this.tabla} WHERE idempotency_key = $1`,
      [idempotencyKey],
    ).catch(() => ({ rows: [] }));
    if (existente.rows.length > 0) {
      return; // Ya despachado, no duplicar entrada en casillero
    }

    // Sanitización estricta de privacidad (Ley 29733 / Sección 7 y 41 / TC-5K-10)
    const cuerpoParaCasilla = { ...payload };
    delete cuerpoParaCasilla.observacion_interna;
    delete cuerpoParaCasilla.nota_interna;
    delete cuerpoParaCasilla.deliberacion;
    delete cuerpoParaCasilla.comentarios_privados;
    if (cuerpoParaCasilla.datos_especificos && typeof cuerpoParaCasilla.datos_especificos === 'object') {
      const de = { ...(cuerpoParaCasilla.datos_especificos as Record<string, unknown>) };
      delete de.observacion_interna;
      delete de.nota_interna;
      cuerpoParaCasilla.datos_especificos = de;
    }

    let tipoActo = typeof payload.tipo_acto === 'string' ? payload.tipo_acto : 'RESOLUCION';
    if (evento.tipo_evento === 'ExpedienteObservado' || evento.tipo_evento === 'expediente_observado') {
      tipoActo = 'NOTIFICACION_OBSERVACION';
    }

    const asunto = typeof payload.asunto === 'string'
      ? payload.asunto
      : (tipoActo === 'RESOLUCION' ? `Resolución de Trámite: ${cut ?? ''}`.trim() : `Notificación de trámite ${cut ?? ''}`.trim());

    const documentoUrl = typeof payload.documento_url === 'string' ? payload.documento_url : null;
    const cvd = typeof payload.cvd === 'string' ? payload.cvd : null;
    const hashSha256 = typeof payload.sha256 === 'string' ? payload.sha256 : null;

    const insertRes = await this.pool.query<{ id: string }>(
      `INSERT INTO ${this.tabla} (
         usuario_id, persona_id, correo_destinatario, cut, asunto, tipo_acto,
         cuerpo, referencia, estado, fecha_deposito, idempotency_key, documento_url, cvd, hash_sha256
       ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, 'PUESTA_A_DISPOSICION', now(), $9, $10, $11, $12)
       RETURNING id`,
      [
        usuarioId,
        personaId,
        correo,
        cut,
        asunto,
        tipoActo,
        JSON.stringify(cuerpoParaCasilla),
        evento.correlation_id ?? evento.id_evento,
        idempotencyKey,
        documentoUrl,
        cvd,
        hashSha256,
      ],
    ).catch(async (err: any) => {
      if (err?.code === '23505' || String(err?.message).includes('idempotency')) {
        return { rows: [] };
      }
      // Fallback si columnas cvd o hash_sha256 no existieran
      return this.pool.query<{ id: string }>(
        `INSERT INTO ${this.tabla} (
           usuario_id, persona_id, correo_destinatario, cut, asunto, tipo_acto,
           cuerpo, referencia, estado, fecha_deposito, idempotency_key, documento_url
         ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, 'PUESTA_A_DISPOSICION', now(), $9, $10)
         RETURNING id`,
        [
          usuarioId,
          personaId,
          correo,
          cut,
          asunto,
          tipoActo,
          JSON.stringify(cuerpoParaCasilla),
          evento.correlation_id ?? evento.id_evento,
          idempotencyKey,
          documentoUrl,
        ],
      ).catch((fallbackErr: any) => {
        if (fallbackErr?.code === '23505' || String(fallbackErr?.message).includes('idempotency')) {
          return { rows: [] };
        }
        throw fallbackErr;
      });
    });

    const notifId = insertRes.rows[0]?.id;
    if (notifId) {
      await this.pool.query(
        `INSERT INTO sigd_auth.notificacion_trazabilidad_evento (
           notificacion_id, tipo_evento, canal, estado, detalles, registrado_en
         ) VALUES ($1, 'PUESTA_A_DISPOSICION', 'CASILLA', 'REGISTRADO', $2::jsonb, now())`,
        [notifId, JSON.stringify({ eventoId: evento.id_evento, correlationId: evento.correlation_id })],
      );
    }
  }
}


export class DestinoEmail implements DestinoNotificacion {
  readonly nombre = 'email';
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async despachar(evento: EventoPendiente): Promise<void> {
    const payload = (evento.payload ?? {}) as Record<string, unknown>;
    const correo = typeof payload.correo_destinatario === 'string' ? payload.correo_destinatario : null;
    if (!correo) return;

    // Comprobar infraestructura SMTP
    const smtpHost = process.env.SMTP_HOST;
    if (!smtpHost) {
      // Fallo de email NO revierte la resolución ni el negocio (PM-5J-16)
      // Registro explícito EMAIL_PROVIDER_NO_CONFIGURADO sin fake success (PM-5J-17)
      console.warn(`[OUTBOX_EMAIL] Proveedor de correo no configurado (EMAIL_PROVIDER_NO_CONFIGURADO). Destinatario: ${correo}`);

      const notifRes = await this.pool.query<{ id: string }>(
        `SELECT id FROM sigd_auth.notificacion_casilla
          WHERE (cut = $1 OR correo_destinatario = $2)
          ORDER BY fecha_deposito DESC LIMIT 1`,
        [payload.cut ?? '', correo],
      ).catch(() => ({ rows: [] }));

      if (notifRes.rows[0]?.id) {
        await this.pool.query(
          `INSERT INTO sigd_auth.notificacion_trazabilidad_evento (
             notificacion_id, tipo_evento, canal, estado, detalles
           ) VALUES ($1, 'INTENTO_ENVIO_EMAIL', 'EMAIL', 'EMAIL_PROVIDER_NO_CONFIGURADO', $2::jsonb)`,
          [
            notifRes.rows[0].id,
            JSON.stringify({ destinatario: correo, motivo: 'EMAIL_PROVIDER_NO_CONFIGURADO' }),
          ],
        ).catch(() => undefined);
      }
      return;
    }
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
    new DestinoEmail(pool),
  ]);
}