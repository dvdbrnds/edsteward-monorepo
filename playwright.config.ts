import { defineConfig, devices } from '@playwright/test';

/**
 * Context7 Best Practice: Environment-aware configuration
 * Support for different environments with proper defaults
 */
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const CI = !!process.env.CI;

export default defineConfig({
  // Context7 Best Practice: Organized test directory structure
  testDir: './tests/e2e',
  
  // Context7 Best Practice: Comprehensive test execution settings
  fullyParallel: true,
  forbidOnly: CI, // Prevent test.only in CI
  retries: CI ? 2 : 0, // Retry failed tests in CI
  workers: CI ? 1 : undefined, // Limit workers in CI
  
  // Context7 Best Practice: Multiple reporter formats for comprehensive reporting
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    CI ? ['github'] : ['list']
  ],
  
  // Context7 Best Practice: Global test configuration
  use: {
    baseURL: BASE_URL,
    
    // Context7 Best Practice: Comprehensive trace and debug settings
    trace: 'on-first-retry',
    video: 'retain-on-failure',
    screenshot: 'only-on-failure',
    
    // Context7 Best Practice: Timeout configuration
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },
  
  // Context7 Best Practice: Multi-project setup with setup/teardown dependencies
  projects: [
    // Setup project for authentication and database preparation
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      teardown: 'cleanup',
    },
    
    // Cleanup project for resource cleanup
    {
      name: 'cleanup',
      testMatch: /.*\.teardown\.ts/,
    },

    // Context7 Best Practice: Browser-specific test projects with authentication
    {
      name: 'admin-chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/admin.json',
      },
      dependencies: ['setup'],
      testMatch: '**/admin/**/*.spec.ts',
    },
    
    {
      name: 'user-chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
      testMatch: '**/user/**/*.spec.ts',
    },
    
    {
      name: 'guest-chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: { cookies: [], origins: [] }, // No authentication
      },
      dependencies: ['setup'],
      testMatch: '**/guest/**/*.spec.ts',
    },
    
    // Context7 Best Practice: Cross-browser testing with Firefox and Safari
    {
      name: 'admin-firefox',
      use: {
        ...devices['Desktop Firefox'],
        storageState: 'playwright/.auth/admin.json',
      },
      dependencies: ['setup'],
      testMatch: '**/critical/**/*.spec.ts', // Only critical tests on Firefox
    },
    
    {
      name: 'admin-webkit',
      use: {
        ...devices['Desktop Safari'],
        storageState: 'playwright/.auth/admin.json',
      },
      dependencies: ['setup'],
      testMatch: '**/critical/**/*.spec.ts', // Only critical tests on Safari
    },
    
    // Context7 Best Practice: Mobile testing
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
      testMatch: '**/mobile/**/*.spec.ts',
    },
    
    {
      name: 'mobile-safari',
      use: {
        ...devices['iPhone 12'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
      testMatch: '**/mobile/**/*.spec.ts',
    },
  ],
  
  // Context7 Best Practice: Web server configuration for local testing
  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: !CI,
    timeout: 120 * 1000, // 2 minutes to start
    stdout: 'ignore',
    stderr: 'pipe',
  },
  
  // Context7 Best Practice: Output directory for test artifacts
  outputDir: 'test-results',
}); 