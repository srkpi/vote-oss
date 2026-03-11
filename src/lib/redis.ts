import Redis from 'ioredis';

function createClient(): Redis {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error('REDIS_URL environment variable is not set');

  const client = new Redis(url, {
    // Connection
    connectTimeout: 5_000,
    commandTimeout: 3_000,
    keepAlive: 10_000,

    // Retry strategy: exponential back-off up to 30 s, give up after 10 attempts
    maxRetriesPerRequest: 2,
    retryStrategy(times) {
      if (times > 10) return null; // stop retrying – surface the error
      return Math.min(100 * Math.pow(2, times), 30_000);
    },

    // Automatically reconnect on replica-promotion errors
    reconnectOnError(err) {
      return /READONLY/.test(err.message);
    },

    // Don't throw on startup if Redis isn't yet available
    lazyConnect: false,
    enableReadyCheck: true,
    enableOfflineQueue: true,
  });

  client.on('ready', () => console.info('[redis] connected'));
  client.on('reconnecting', () => console.warn('[redis] reconnecting…'));
  client.on('error', (err: Error) => console.error('[redis] error:', err.message));
  client.on('close', () => console.warn('[redis] connection closed'));

  return client;
}

// ---------------------------------------------------------------------------
// Hot-reload safe singleton (Next.js dev mode re-evaluates modules on every
// request, so we stash the client on globalThis to avoid leaking connections).
// ---------------------------------------------------------------------------
const g = globalThis as typeof globalThis & { _redis?: Redis };
if (!g._redis) g._redis = createClient();

export const redis: Redis = g._redis;

// ---------------------------------------------------------------------------
// Availability helper – callers use this to decide whether to fall back to DB
// ---------------------------------------------------------------------------
export function isRedisReady(): boolean {
  return redis.status === 'ready';
}

/**
 * Safely execute a Redis command, returning null on any error.
 * Use this whenever a Redis result is "nice to have" but the app
 * must continue if Redis is down.
 */
export async function safeRedis<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    console.error('[redis] safeRedis caught:', (err as Error).message);
    return null;
  }
}
