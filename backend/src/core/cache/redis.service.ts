import { Redis } from 'ioredis';

let redisClient: Redis | null = null;
let isRedisConnected = false;

export function getRedisClient(): Redis | null {
  if (redisClient) return isRedisConnected ? redisClient : null;
  const url = process.env.REDIS_URL;
  if (!url) return null;

  try {
    redisClient = new Redis(url, {
      maxRetriesPerRequest: 1,
      connectTimeout: 2000,
      enableOfflineQueue: false,
      lazyConnect: false,
      retryStrategy(times) {
        if (process.env.NODE_ENV === 'test') return null;
        return Math.min(times * 100, 3000);
      },
    });

    redisClient.on('connect', () => {
      isRedisConnected = true;
    });

    redisClient.on('ready', () => {
      isRedisConnected = true;
    });

    redisClient.on('error', (_err) => {
      isRedisConnected = false;
    });

    redisClient.on('close', () => {
      isRedisConnected = false;
    });

    return redisClient;
  } catch {
    isRedisConnected = false;
    return null;
  }
}

export async function getCached<T>(key: string): Promise<T | null> {
  const client = getRedisClient();
  if (!client || !isRedisConnected) return null;
  try {
    const raw = await client.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function setCached(key: string, value: unknown, ttlSeconds = 3600): Promise<void> {
  const client = getRedisClient();
  if (!client || !isRedisConnected) return;
  try {
    const serialized = JSON.stringify(value);
    await client.set(key, serialized, 'EX', ttlSeconds);
  } catch {
    // Fail-soft: no bloquear la operación de negocio si Redis falla
  }
}

export async function invalidateCache(keyOrPattern: string): Promise<void> {
  const client = getRedisClient();
  if (!client || !isRedisConnected) return;
  try {
    if (keyOrPattern.includes('*')) {
      const keys = await client.keys(keyOrPattern);
      if (keys.length > 0) {
        await client.del(...keys);
      }
    } else {
      await client.del(keyOrPattern);
    }
  } catch {
    // Fail-soft
  }
}

const RATE_LIMIT_LUA = `
local current = redis.call('INCR', KEYS[1])
local ttl = redis.call('TTL', KEYS[1])
if ttl == -1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
    ttl = tonumber(ARGV[1])
end
return {current, ttl}
`;

export async function rateLimitDistributed(
  key: string,
  windowSeconds: number,
  maxLimit: number,
): Promise<{ count: number; allowed: boolean; retryAfter: number } | null> {
  const client = getRedisClient();
  if (!client || !isRedisConnected) return null;

  try {
    const rawResult = (await client.eval(RATE_LIMIT_LUA, 1, key, windowSeconds)) as [number | string, number | string];
    const count = Number(rawResult[0]);
    const ttl = Number(rawResult[1]);
    const retryAfter = Math.max(1, ttl);
    const allowed = count <= maxLimit;
    return { count, allowed, retryAfter };
  } catch (err) {
    console.warn(`[RedisRateLimit] Error ejecutando Lua script para ${key}:`, err);
    return null;
  }
}
