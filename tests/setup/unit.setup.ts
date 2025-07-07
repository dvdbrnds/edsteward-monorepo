import { beforeEach, afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'

// Context7 Best Practice: Cleanup React components after each test
afterEach(() => {
  cleanup()
})

// Context7 Best Practice: Mock React Router for frontend tests
vi.mock('wouter', () => ({
  useLocation: vi.fn(() => ['/', vi.fn()]),
  useRoute: vi.fn(() => [false, {}]),
  Link: vi.fn(),
  Route: vi.fn(),
  Router: vi.fn(),
}))

// Context7 Best Practice: Mock API client for unit tests
vi.mock('@/api', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    setTenantId: vi.fn(),
    setAuthHandlers: vi.fn(),
  },
}))

// Context7 Best Practice: Mock react-hook-form
vi.mock('react-hook-form', async () => {
  const actual = await vi.importActual('react-hook-form')
  return {
    ...actual,
    useForm: vi.fn(() => ({
      register: vi.fn(),
      handleSubmit: vi.fn((fn) => fn),
      formState: { errors: {} },
      control: {},
      watch: vi.fn(),
      setValue: vi.fn(),
      getValues: vi.fn(() => ({})),
      reset: vi.fn(),
      trigger: vi.fn(),
      clearErrors: vi.fn(),
    })),
    useFormContext: vi.fn(() => ({
      register: vi.fn(),
      formState: { errors: {} },
      control: {},
      watch: vi.fn(),
      setValue: vi.fn(),
      getValues: vi.fn(() => ({})),
    })),
    Controller: vi.fn(),
  }
})

// Context7 Best Practice: Mock toast notifications
vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({
    toast: vi.fn(),
    dismiss: vi.fn(),
  })),
}))

// Context7 Best Practice: Mock Radix UI components that might cause issues in tests
vi.mock('@radix-ui/react-dialog', () => ({
  Root: vi.fn(),
  Trigger: vi.fn(),
  Portal: vi.fn(),
  Overlay: vi.fn(),
  Content: vi.fn(),
  Title: vi.fn(),
  Description: vi.fn(),
  Close: vi.fn(),
}))

// Context7 Best Practice: Mock recharts for chart components
vi.mock('recharts', () => ({
  ResponsiveContainer: vi.fn(),
  LineChart: vi.fn(),
  Line: vi.fn(),
  XAxis: vi.fn(),
  YAxis: vi.fn(),
  CartesianGrid: vi.fn(),
  Tooltip: vi.fn(),
  Legend: vi.fn(),
  BarChart: vi.fn(),
  Bar: vi.fn(),
  PieChart: vi.fn(),
  Pie: vi.fn(),
  Cell: vi.fn(),
}))

// Context7 Best Practice: Setup DOM testing environment
beforeEach(() => {
  // Reset any DOM state between tests
  document.body.innerHTML = ''
  document.head.innerHTML = ''
  
  // Mock window.scrollTo
  window.scrollTo = vi.fn()
  
  // Mock clipboard API
  Object.assign(navigator, {
    clipboard: {
      writeText: vi.fn(() => Promise.resolve()),
      readText: vi.fn(() => Promise.resolve('')),
    },
  })
}) 