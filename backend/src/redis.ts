import { createClient } from 'redis';

export const CANAL_INVALIDACION_PERMISOS = 'sigd:rbac:permisos:invalidados';
export const PREFIJO_CLAVE_PERMISOS = 'sigd:rbac:permisos:rol';
export const TTL_PERMISOS_SEGUNDOS = 3600;

export type ConexionRedis = ReturnType<typeof createClient>;

export interface CachePermisos {
  obtener(rol_id: string): Promise<string[] | null>;
  guardar(rol_id: string, permisos: string[]): Promise<void>;
  invalidar(rol_id: string): Promise<void>;
  invalidarTodos(): Promise<void>;
  cerrar(): Promise<void>;
}

export function clavePermisosDeRol(rol_id: string): string {
  return `${PREFIJO_CLAVE_PERMISOS}:${rol_id}`;
}

export function crearConexionRedis(redisUrl: string): ConexionRedis {
  return createClient({ url: redisUrl });
}

export async function conectarRedis(redisUrl: string): Promise<ConexionRedis> {
  const conexion = crearConexionRedis(redisUrl);
  conexion.on('error', (error) => {
    console.error('[REDIS] Error de conexión:', error);
  });
  await conexion.connect();
  return conexion;
}

export function crearCachePermisosRedis(conexion: ConexionRedis): CachePermisos {
  return {
    async obtener(rol_id: string): Promise<string[] | null> {
      const crudo = await conexion.get(clavePermisosDeRol(rol_id));
      if (crudo === null) {
        return null;
      }
      const parseado: unknown = JSON.parse(crudo);
      return Array.isArray(parseado) ? (parseado as string[]) : null;
    },

    async guardar(rol_id: string, permisos: string[]): Promise<void> {
      await conexion.set(clavePermisosDeRol(rol_id), JSON.stringify(permisos), {
        expiration: { type: 'EX', value: TTL_PERMISOS_SEGUNDOS },
      });
    },

    async invalidar(rol_id: string): Promise<void> {
      await conexion.del(clavePermisosDeRol(rol_id));
    },

    async invalidarTodos(): Promise<void> {
      for await (const claves of conexion.scanIterator({
        MATCH: `${PREFIJO_CLAVE_PERMISOS}:*`,
        COUNT: 100,
      })) {
        const lote = Array.isArray(claves) ? claves : [claves];
        if (lote.length > 0) {
          await conexion.del(lote);
        }
      }
    },

    async cerrar(): Promise<void> {
      if (conexion.isOpen) {
        await conexion.quit();
      }
    },
  };
}

export interface SuscripcionInvalidacion {
  cerrar(): Promise<void>;
}

/**
 * Caché deshabilitada: cada consulta va a PostgreSQL. Es el comportamiento seguro
 * cuando Redis no está disponible, porque una caché ausente solo cuesta latencia y
 * nunca concede permisos revoked. Se usa como valor por defecto para no romper
 * `construirApp(pool)` en entornos sin Redis.
 */
export function crearCachePermisosSinCache(): CachePermisos {
  return {
    async obtener(): Promise<string[] | null> {
      return null;
    },
    async guardar(): Promise<void> {
      return;
    },
    async invalidar(): Promise<void> {
      return;
    },
    async invalidarTodos(): Promise<void> {
      return;
    },
    async cerrar(): Promise<void> {
      return;
    },
  };
}

export async function suscribirInvalidaciones(
  conexion: ConexionRedis,
  alInvalidar: (rol_id: string) => Promise<void>,
): Promise<SuscripcionInvalidacion> {
  await conexion.subscribe(CANAL_INVALIDACION_PERMISOS, (mensaje) => {
    const rol_id = parsearMensajeInvalidacion(mensaje);
    if (rol_id !== null) {
      void alInvalidar(rol_id);
    }
  });

  return {
    async cerrar(): Promise<void> {
      if (conexion.isOpen) {
        await conexion.unsubscribe(CANAL_INVALIDACION_PERMISOS);
      }
    },
  };
}

export async function publicarInvalidacion(conexion: ConexionRedis, rol_id: string): Promise<void> {
  await conexion.publish(CANAL_INVALIDACION_PERMISOS, JSON.stringify({ rol_id }));
}

export interface RuntimeCachePermisos {
  cache: CachePermisos;
  comando: ConexionRedis | undefined;
  suscripcion: SuscripcionInvalidacion | undefined;
  cerrar(): Promise<void>;
}

/**
 * Levanta la caché de permisos con Redis 7. Si REDIS_URL no está configurada o el
 * servidor no responde, degrada a caché deshabilitada en lugar de tumbar el proceso:
 * sin caché la autorización sigue siendo correcta, solo pierde el cache-hit.
 */
export async function inicializarCachePermisos(redisUrl?: string): Promise<RuntimeCachePermisos> {
  if (!redisUrl || redisUrl.trim() === '') {
    return { cache: crearCachePermisosSinCache(), comando: undefined, suscripcion: undefined, cerrar: async () => {} };
  }

  try {
    const comando = await conectarRedis(redisUrl);
    const suscriptor = crearConexionRedis(redisUrl);
    await suscriptor.connect();

    const cache = crearCachePermisosRedis(comando);
    const suscripcion = await suscribirInvalidaciones(suscriptor, (rol_id) => cache.invalidar(rol_id));

    return {
      cache,
      comando,
      suscripcion,
      cerrar: async () => {
        await suscripcion.cerrar();
        await cache.cerrar();
        if (suscriptor.isOpen) {
          await suscriptor.quit();
        }
      },
    };
  } catch (error) {
    console.error('[REDIS] No se pudo inicializar la caché; se continúa sin caché.', error);
    return { cache: crearCachePermisosSinCache(), comando: undefined, suscripcion: undefined, cerrar: async () => {} };
  }
}

function parsearMensajeInvalidacion(mensaje: string): string | null {
  try {
    const parseado: unknown = JSON.parse(mensaje);
    if (parseado && typeof parseado === 'object' && 'rol_id' in parseado) {
      const valor = (parseado as { rol_id: unknown }).rol_id;
      return typeof valor === 'string' && valor !== '' ? valor : null;
    }
  } catch {
    return null;
  }
  return null;
}
