import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './client/src'),
      '@shared': resolve(__dirname, './shared'),
    },
  },
  test: {
    // Context7 Best Practice: Enable globals for better Jest-like experience
    globals: true,

    // Context7 Best Practice: Test file patterns for all test types
    include: [
      'client/src/**/*.{test,spec}.{ts,tsx}',
      'shared/**/*.{test,spec}.{ts,tsx}',
      'server/**/*.{test,spec}.{ts,js}',
      'tests/**/*.{test,spec}.{ts,js}',
    ],

    // Context7 Best Practice: Global test configuration
    testTimeout: 10000,
    hookTimeout: 10000,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.git/**',
      '**/coverage/**',
      '**/.next/**',
      // Context7 Best Practice: Exclude E2E tests from Vitest (run with Playwright)
      'tests/e2e/**',
      '**/playwright/**',
    ],

    // Context7 Best Practice: Proper environment configuration
    environment: 'jsdom',

    // Context7 Best Practice: Global setup files
    setupFiles: ['./tests/setup/global.setup.ts'],

    coverage: {
      enabled: false,
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json', 'json-summary'],
      reportsDirectory: './coverage',
      clean: true,
      cleanOnRerun: true,
      include: ['client/src/**/*.{ts,tsx}', 'server/**/*.{ts,js}', 'shared/**/*.{ts,tsx}'],
      exclude: [
        '**/*.d.ts',
        '**/*.test.{ts,tsx,js,jsx}',
        '**/*.spec.{ts,tsx,js,jsx}',
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/coverage/**',
        'client/src/main.tsx',
        'client/src/vite-env.d.ts',
        'server/index.ts',
        'server/migrations/**',
      ],
      thresholds: {
        statements: 0.01,
        branches: 0,
        functions: 0.01,
        lines: 0.01,
      },
    },

    // Reporter configuration
    reporters: ['default'],

    // Test sequence configuration
    sequence: {
      hooks: 'list',
    },
  },
});
