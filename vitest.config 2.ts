import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

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
    
    // Context7 Best Practice: Coverage configuration
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json', 'json-summary'],
      reportsDirectory: './coverage',
      clean: true,
      cleanOnRerun: true,
      include: [
        'client/src/**/*.{ts,tsx}',
        'server/**/*.{ts,js}',
        'shared/**/*.{ts,tsx}',
      ],
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
      // Context7 Best Practice: Comprehensive coverage thresholds
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80,
        // Context7 Best Practice: Specific thresholds for critical paths
        'client/src/hooks/**/*.{ts,tsx}': {
          statements: 90,
          branches: 85,
          functions: 90,
          lines: 90,
        },
        'server/routes/**/*.{ts,js}': {
          statements: 85,
          branches: 75,
          functions: 85,
          lines: 85,
        },
      },
    },
    
    // Context7 Best Practice: Enhanced reporter configuration
    reporters: [
      'default',
      'verbose',
      'json',
      'html',
    ],
    
    // Context7 Best Practice: Test sequence configuration
    sequence: {
      hooks: 'list', // Run hooks sequentially like Jest
      concurrent: false, // Can be overridden per test
    },
    
    // Context7 Best Practice: Enable auto-stubbing of environment variables
    unstubEnvs: true,
    
    // Context7 Best Practice: Pool configuration for optimal performance
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        isolate: true,
      },
      forks: {
        singleFork: false,
        isolate: true,
      },
    },
  },
}) 