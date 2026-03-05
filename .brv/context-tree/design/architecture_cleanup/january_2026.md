EdSteward Architecture Cleanup (January 2026):

1. **Database Pool Consolidation**: The codebase had 11 separate database pools due to architectural pivots (single→multi-tenant→single). Consolidated to single source in `server/config/database.ts`. Other files import from `server/services/database.ts` which uses the shared pool.

2. **Environment Configuration**: Centralized in `server/config/environment.ts` with schema-based validation at startup. Required vars: DATABASE_URL, SESSION_SECRET. Conditional validation for SAML vars. `.env.example` has comprehensive 150-line template.

3. **Authentication Architecture**: Single source of truth is `server/auth/single-tenant-auth.ts` which handles both Local (passport-local with scrypt) and SAML (passport-saml) authentication. Deleted dead auth files: saml.ts, tenant-saml.ts, admin-auth.ts, auth.ts.

4. **MCP Engine Authentication**: Uses Basic Auth with credentials from environment variables MCP_ENGINE_USERNAME and MCP_ENGINE_PASSWORD. Localhost requests bypass auth for local development.

5. **CSP Configuration**: Re-enabled in `server/index.ts` via helmet middleware with directives for scripts, styles, images, fonts, connections (including WebSocket and Okta domains).

6. **File Organization**: Historical docs moved to `references/historical/`. Migration scripts in `scripts/migrations/`. Root contains only essential configs, Docker files, and startup scripts.