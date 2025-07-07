import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest'

// Context7 Best Practice: Integration test environment setup
beforeAll(async () => {
  // Set integration test environment variables
  process.env.NODE_ENV = 'test'
  process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/edsteward_test'
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing'
  process.env.SESSION_SECRET = 'test-session-secret-for-testing'
  
  // Context7 Best Practice: Mock external services for integration tests
  process.env.AWS_ACCESS_KEY_ID = 'test-key'
  process.env.AWS_SECRET_ACCESS_KEY = 'test-secret'
  process.env.AWS_REGION = 'us-east-1'
  process.env.S3_BUCKET = 'test-bucket'
})

// Context7 Best Practice: Mock database connections for integration tests
vi.mock('@neondatabase/serverless', () => ({
  neon: vi.fn(() => ({
    query: vi.fn(),
    transaction: vi.fn(),
  })),
  Pool: vi.fn(() => ({
    query: vi.fn(),
    connect: vi.fn(),
    end: vi.fn(),
  })),
}))

// Context7 Best Practice: Mock external API calls
vi.mock('aws-sdk', () => ({
  S3: vi.fn(() => ({
    upload: vi.fn(() => ({
      promise: vi.fn(() => Promise.resolve({ Location: 'https://test-bucket.s3.amazonaws.com/test-file' })),
    })),
    deleteObject: vi.fn(() => ({
      promise: vi.fn(() => Promise.resolve()),
    })),
  })),
  SES: vi.fn(() => ({
    sendEmail: vi.fn(() => ({
      promise: vi.fn(() => Promise.resolve({ MessageId: 'test-message-id' })),
    })),
  })),
}))

// Context7 Best Practice: Mock nodemailer for email testing
vi.mock('nodemailer', () => ({
  createTransporter: vi.fn(() => ({
    sendMail: vi.fn(() => Promise.resolve({
      messageId: 'test-message-id',
      accepted: ['test@example.com'],
      rejected: [],
    })),
  })),
}))

// Context7 Best Practice: Mock Redis for session testing
vi.mock('redis', () => ({
  createClient: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    exists: vi.fn(),
    expire: vi.fn(),
  })),
}))

// Context7 Best Practice: Mock passport strategies
vi.mock('passport', () => ({
  use: vi.fn(),
  authenticate: vi.fn(() => (req: any, res: any, next: any) => next()),
  initialize: vi.fn(() => (req: any, res: any, next: any) => next()),
  session: vi.fn(() => (req: any, res: any, next: any) => next()),
  serializeUser: vi.fn(),
  deserializeUser: vi.fn(),
}))

vi.mock('passport-local', () => ({
  Strategy: vi.fn(),
}))

// Context7 Best Practice: Mock SAML authentication
vi.mock('@node-saml/passport-saml', () => ({
  Strategy: vi.fn(),
  SAML: vi.fn(),
}))

// Context7 Best Practice: Setup integration test database
beforeEach(async () => {
  // Clear any cached modules
  vi.clearAllMocks()
  
  // Reset database state (mock implementation)
  // In real tests, you might want to use a test database
  global.mockDatabase = {
    users: [],
    regulations: [],
    tenants: [],
  }
})

afterEach(async () => {
  // Cleanup after each integration test
  vi.clearAllTimers()
  vi.restoreAllMocks()
  
  // Clear mock database
  if (global.mockDatabase) {
    global.mockDatabase = {
      users: [],
      regulations: [],
      tenants: [],
    }
  }
})

afterAll(async () => {
  // Global cleanup for integration tests
  vi.restoreAllMocks()
}) 