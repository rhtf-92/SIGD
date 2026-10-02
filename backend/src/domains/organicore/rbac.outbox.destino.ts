import type { EventoPendiente } from '../../audit/outbox-worker.js';
import type { DestinoNotificacion } from '../../audit/despachador-notificaciones.js';
import { publicarInvalidacion, type CachePermisos, type ConexionRedis } from '../../redis.js';
import { AGREGADO_RBAC, TIPO_EVENTO_RBAC_MODIFICADA } from './rbac.service.js';

/**
 * Destino del outbox canonico para la invalidacion de permisos (OC-11).
 *
 * `RbacService.actualizarPermisosDeRol` escribe el evento en
 * `sigd_audit.evento_outbox` dentro de la misma transaccion que modifica
 * `sigd_org.rol_permiso`. Este destino es el otro extremo: lo consume el
 * `OutboxWorker` de `src/audit/outbox-worker.ts` con reintentos, backoff
 * exponencial y dead-letter, de modo que un Redis caido en el instante del commit
 * no deja permisos revocados sirviéndose desde caché.
 *
 * No es un mecanismo paralelo: se apoya en la tabla, el worker y el despachador
 * compuestos que main ya ejecuta en `src/server.ts`.
 */
export class DestinoRbacInvalidacion implements DestinoNotificacion {
  readonly nombre = 'rbac';

  constructor(
    private readonly cache: CachePermisos,
    private readonly redis?: ConexionRedis,
  ) {}

  async despachar(evento: EventoPendiente): Promise<void> {
    if (evento.agregado !== AGREGADO_RBAC || evento.tipo_evento !== TIPO_EVENTO_RBAC_MODIFICADA) {
      return;
    }

    const payload = (evento.payload ?? {}) as Record<string, unknown>;
    const rol_id = typeof payload.rol_id === 'string' ? payload.rol_id.trim() : '';
    if (rol_id === '') {
      // Se propaga el error a proposito: el worker reintentara y, agotados los
      // intentos, dejara el evento en dead-letter en vez de marcarlo procesado.
      throw new Error(
        `Evento ${evento.id_evento} de tipo ${evento.tipo_evento} sin payload.rol_id utilizable.`,
      );
    }

    await this.cache.invalidar(rol_id);
    if (this.redis) {
      await publicarInvalidacion(this.redis, rol_id);
    }
  }
}