import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom'

const originalConsoleError = console.error

// Context7 Best Practice: Global test environment setup
beforeAll(() => {
  // Set test environment variables
  process.env.NODE_ENV = 'test'
  process.env.VITE_API_URL = 'http://localhost:3000'
  process.env.VITE_TENANT_ID = 'test-tenant'
  
  // Context7 Best Practice: Mock console methods in tests
  console.error = (...args: any[]) => {
    // Filter out known React/development warnings in tests
    const message = args[0]
    if (
      typeof message === 'string' &&
      (message.includes('Warning:') || 
       message.includes('React does not recognize') ||
       message.includes('validateDOMNesting'))
    ) {
      return
    }
    originalConsoleError(...args)
  }
})

// Context7 Best Practice: Global test cleanup
afterAll(() => {
  // Restore console methods
  console.error = originalConsoleError
})

// Context7 Best Practice: Clear all mocks between tests
beforeEach(() => {
  // Clear all module mocks
  vi.clearAllMocks()
  
  // Reset all spies
  vi.restoreAllMocks()
  
  // Clear localStorage and sessionStorage
  window.localStorage.clear()
  window.sessionStorage.clear()
  
  // Reset fetch mock if it exists
  if (global.fetch && 'mockClear' in global.fetch) {
    (global.fetch as any).mockClear()
  }
})

afterEach(() => {
  // Context7 Best Practice: Cleanup after each test
  vi.clearAllTimers()
  vi.useRealTimers()
})

// Context7 Best Practice: Global fetch mock setup
global.fetch = vi.fn()

// Context7 Best Practice: Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost:3000',
    origin: 'http://localhost:3000',
    protocol: 'http:',
    host: 'localhost:3000',
    hostname: 'localhost',
    port: '3000',
    pathname: '/',
    search: '',
    hash: '',
    assign: vi.fn(),
    reload: vi.fn(),
    replace: vi.fn(),
  },
  writable: true,
})

// Context7 Best Practice: Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Context7 Best Practice: Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Context7 Best Practice: Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Context7 Best Practice: Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn().mockImplementation((cb) => {
  return setTimeout(cb, 0)
})

global.cancelAnimationFrame = vi.fn().mockImplementation((id) => {
  clearTimeout(id)
}) 