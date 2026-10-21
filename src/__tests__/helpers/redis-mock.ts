import { vi } from 'vitest';

/**
 * Reusable Redis client mock.
 *
 * Import `redisMock` in tests and declare the module mock with:
 *
 *   vi.mock('@/lib/redis', async () => {
 *     const { redisMock } = await import('@/__tests__/helpers/redis-mock');
 *     return {
 *       redis: redisMock,
 *       isRedisReady: vi.fn(() => redisMock.status === 'ready'),
 *       safeRedis: async (fn: () => Promise<unknown>) => {
 *         try { return await fn(); } catch { return null; }
 *       },
 *     };
 *   });
 *
 * Call `resetRedisMock()` in `beforeEach` to clear state between tests.
 * Access `redisMock._pipeline` to assert on pipeline-based commands.
 */

export const pipelineMock = {
  setbit: vi.fn().mockReturnThis(),
  getbit: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  get: vi.fn().mockReturnThis(),
  del: vi.fn().mockReturnThis(),
  exists: vi.fn().mockReturnThis(),
  exec: vi.fn().mockResolvedValue([]),
};

export const redisMock = {
  /** Simulates ioredis `.status`; set to 'reconnecting' to test fail-open paths. */
  status: 'ready' as string,
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue('OK'),
  del: vi.fn().mockResolvedValue(1),
  getbit: vi.fn().mockResolvedValue(0),
  setbit: vi.fn().mockResolvedValue(0),
  exists: vi.fn().mockResolvedValue(0),
  eval: vi.fn().mockResolvedValue(null),
  pipeline: vi.fn().mockReturnValue(pipelineMock),
  scan: vi.fn().mockResolvedValue(['0', [] as string[]]),
  ping: vi.fn().mockResolvedValue('PONG'),
};

export function resetRedisMock(): void {
  redisMock.status = 'ready';
  redisMock.get.mockReset().mockResolvedValue(null);
  redisMock.set.mockReset().mockResolvedValue('OK');
  redisMock.del.mockReset().mockResolvedValue(1);
  redisMock.getbit.mockReset().mockResolvedValue(0);
  redisMock.setbit.mockReset().mockResolvedValue(0);
  redisMock.exists.mockReset().mockResolvedValue(0);
  redisMock.eval.mockReset().mockResolvedValue(null);
  redisMock.pipeline.mockReset().mockReturnValue(pipelineMock);
  redisMock.scan.mockReset().mockResolvedValue(['0', []]);
  redisMock.ping.mockReset().mockResolvedValue('PONG');

  pipelineMock.setbit.mockReset().mockReturnThis();
  pipelineMock.getbit.mockReset().mockReturnThis();
  pipelineMock.set.mockReset().mockReturnThis();
  pipelineMock.get.mockReset().mockReturnThis();
  pipelineMock.del.mockReset().mockReturnThis();
  pipelineMock.exists.mockReset().mockReturnThis();
  pipelineMock.exec.mockReset().mockResolvedValue([]);
}

// ---------------------------------------------------------------------------
// Bloom-filter result builders
// ---------------------------------------------------------------------------

/** Build exec() results for a bloom check where ALL bits are set. */
export function bloomHitResults(confirmed: 0 | 1): [null, number][] {
  const bits: [null, number][] = Array.from({ length: 7 }, () => [null, 1]);
  return [...bits, [null, confirmed]]; // 8th entry = EXISTS result
}

/** Build exec() results for a bloom check where at least one bit is 0. */
export function bloomMissResults(): [null, number][] {
  const bits: [null, number][] = Array.from({ length: 7 }, (_, i) => [null, i === 0 ? 0 : 1]);
  return [...bits, [null, 0]];
}
