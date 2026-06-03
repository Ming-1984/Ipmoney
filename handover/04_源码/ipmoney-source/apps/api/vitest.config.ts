import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.spec.ts', 'test/**/*.e2e-spec.ts'],
    environment: 'node',
    setupFiles: ['test/setup.ts'],
    passWithNoTests: false,
  },
});
