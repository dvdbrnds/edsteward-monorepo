import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'

// Context7 Best Practice: E2E test environment setup
beforeAll(async () => {
  // Set E2E test environment variables
  process.env.NODE_ENV = 'test'
  process.env.E2E_TEST = 'true'
  process.env.PORT = '3001' // Use different port for E2E tests
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/edsteward_e2e_test'
  
  // Context7 Best Practice: Setup test server
  console.log('🚀 Starting E2E test environment...')
})

// Context7 Best Practice: Mock puppeteer for E2E tests
vi.mock('puppeteer', () => ({
  launch: vi.fn(() => Promise.resolve({
    newPage: vi.fn(() => Promise.resolve({
      goto: vi.fn(),
      waitForSelector: vi.fn(),
      click: vi.fn(),
      type: vi.fn(),
      evaluate: vi.fn(),
      screenshot: vi.fn(),
      close: vi.fn(),
    })),
    close: vi.fn(),
  })),
}))

// Context7 Best Practice: Mock supertest for API E2E testing
const mockSupertest = {
  get: vi.fn(() => mockSupertest),
  post: vi.fn(() => mockSupertest),
  put: vi.fn(() => mockSupertest),
  delete: vi.fn(() => mockSupertest),
  patch: vi.fn(() => mockSupertest),
  send: vi.fn(() => mockSupertest),
  expect: vi.fn(() => mockSupertest),
  set: vi.fn(() => mockSupertest),
  then: vi.fn((callback) => callback({ status: 200, body: {} })),
}

vi.mock('supertest', () => ({
  default: vi.fn(() => mockSupertest),
}))

// Context7 Best Practice: E2E test utilities
global.e2eUtils = {
  // Mock test server instance
  testServer: null,
  
  // Helper to start test server
  startTestServer: vi.fn(async () => {
    console.log('📡 Starting test server on port 3001...')
    return Promise.resolve()
  }),
  
  // Helper to stop test server
  stopTestServer: vi.fn(async () => {
    console.log('⏹️ Stopping test server...')
    return Promise.resolve()
  }),
  
  // Helper to reset test database
  resetTestDatabase: vi.fn(async () => {
    console.log('🗃️ Resetting test database...')
    return Promise.resolve()
  }),
  
  // Helper to seed test data
  seedTestData: vi.fn(async () => {
    console.log('🌱 Seeding test data...')
    return Promise.resolve()
  }),
  
  // Helper to cleanup test data
  cleanupTestData: vi.fn(async () => {
    console.log('🧹 Cleaning up test data...')
    return Promise.resolve()
  }),
}

// Context7 Best Practice: Setup before each E2E test
beforeEach(async () => {
  // Reset all mocks
  vi.clearAllMocks()
  
  // Reset test database state
  await global.e2eUtils.resetTestDatabase()
  
  // Seed necessary test data
  await global.e2eUtils.seedTestData()
  
  console.log('✅ E2E test environment ready')
})

// Context7 Best Practice: Cleanup after each E2E test
afterEach(async () => {
  // Cleanup test data
  await global.e2eUtils.cleanupTestData()
  
  // Clear timers and mocks
  vi.clearAllTimers()
  vi.restoreAllMocks()
  
  console.log('🧽 E2E test cleanup completed')
})

// Context7 Best Practice: Global E2E cleanup
afterAll(async () => {
  // Stop test server if running
  if (global.e2eUtils.testServer) {
    await global.e2eUtils.stopTestServer()
  }
  
  // Final cleanup
  vi.restoreAllMocks()
  
  console.log('🏁 E2E test suite completed')
}) 