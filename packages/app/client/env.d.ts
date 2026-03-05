/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string
  readonly VITE_TENANT_ID: string
  readonly VITE_WS_URL?: string
  readonly VITE_MCP_WS_URL?: string
  readonly VITE_SENTRY_DSN?: string
  readonly VITE_APP_ENV?: 'development' | 'staging' | 'production'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}