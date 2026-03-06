import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'allure-jest/node',
  preset: 'ts-jest',
  rootDir: '.',
  testMatch: ['<rootDir>/src/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFiles: ['<rootDir>/jest.setup.ts'],
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          module: 'commonjs',
          esModuleInterop: true,
          moduleResolution: 'node',
        },
      },
    ],
    // ✅ Transform ESM-only node_modules (like jose) using Babel
    '^.+\\.js$': 'babel-jest',
  },
  // ✅ Allow jose (and other ESM packages) to be transformed
  transformIgnorePatterns: ['/node_modules/(?!(jose)/)'],
  collectCoverageFrom: ['src/lib/**/*.ts', 'src/app/api/**/*.ts', '!src/**/*.d.ts'],
  coverageDirectory: 'coverage',
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
};

export default config;
