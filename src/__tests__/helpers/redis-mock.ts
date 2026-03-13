/**
 * Reusable Redis client mock.
 *
 * Import `redisMock` in tests and declare the module mock with:
 *
 *   jest.mock('@/lib/redis', () => ({
 *     redis: redisMock,
 *     isRedisReady: jest.fn(() => redisMock.status === 'ready'),
 *     safeRedis: async (fn: () => Promise<unknown>) => {
 *       try { return await fn(); } catch { return null; }
 *     },
 *   }));
 *
 * Call `resetRedisMock()` in `beforeEach` to clear state between tests.
 * Access `redisMock._pipeline` to assert on pipeline-based commands.
 */

export const pipelineMock = {
  setbit: jest.fn().mockReturnThis(),
  getbit: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  get: jest.fn().mockReturnThis(),
  del: jest.fn().mockReturnThis(),
  exists: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue([]),
};

export const redisMock = {
  /** Simulates ioredis `.status`; set to 'reconnecting' to test fail-open paths. */
  status: 'ready' as string,
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  getbit: jest.fn().mockResolvedValue(0),
  setbit: jest.fn().mockResolvedValue(0),
  exists: jest.fn().mockResolvedValue(0),
  eval: jest.fn().mockResolvedValue(null),
  pipeline: jest.fn().mockReturnValue(pipelineMock),
  scan: jest.fn().mockResolvedValue(['0', [] as string[]]),
  ping: jest.fn().mockResolvedValue('PONG'),
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
