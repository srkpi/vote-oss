import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    // Real cryptography tests need extra headroom under coverage.
    testTimeout: 15_000,
    setupFiles: ['./vitest.setup.ts', 'allure-vitest/setup'],
    reporters: ['default', ['allure-vitest/reporter', { resultsDir: 'allure-results' }]],
    clearMocks: true,
    mockReset: true,
    restoreMocks: true,
    unstubGlobals: true,
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts', 'src/app/api/**/*.ts'],
      exclude: ['src/**/*.d.ts'],
      reportsDirectory: 'coverage',
    },
  },
});
