import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    globals: true,
    include: ['__tests__/**/*.test.ts'],
    setupFiles: ['__tests__/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['utils/autoFill/**'],
      exclude: ['utils/autoFill/index.ts'],
    },
  },
});
