# Changelog

All notable changes to EdSteward are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.1] - 2026-03-12

### Added
- AI-powered compliance action detection — automatically identifies which of the 4
  compliance steps (attestation, website publish, community communication, agency
  submission) each regulation requires based on statutory analysis
- Template action knowledge base for 17+ key regulations (Clery, FERPA, Title IX,
  ADA, OSHA, HIPAA, GLBA, PA Act 55, etc.) with curated action requirements
- Regex fallback detection for regulations not covered by templates or AI pipeline
- "What's New" changelog page accessible from version badge and user dropdown
- Engine-to-app action sync — correct action types auto-enabled on regulation delivery

### Changed
- Regulation actions now reflect actual statutory obligations instead of defaulting
  to attestation-only
- Sync and create endpoints preserve existing user completion state when updating
  action flags from the engine

## [1.5.0] - 2026-03-09

### Changed
- Monorepo migration: EdSteward and MCP Engine now live in a single
  `edsteward-monorepo` under `packages/app` and `packages/engine` (npm workspaces)
- Consolidated 3 Anthropic API keys (`ANTHROPIC_API_KEY`, `LLM_API_KEY`,
  `REQUIREMENTS_API_KEY`) down to a single `ANTHROPIC_API_KEY` on the engine side
- MCP Engine integration auth (`basicAuthMCP` middleware) now reads
  `MCP_ENGINE_USERNAME` / `MCP_ENGINE_PASSWORD` from env vars instead of
  hardcoded credentials
- Rotated all API keys exposed during brief public repo window:
  Anthropic, Congress.gov, Regulations.gov, GovInfo, CourtListener, Open States,
  MCP_API_KEY, and EDSTEWARD_PASSWORD
- Scrubbed hardcoded secrets from ~30 script files, ~45 doc/reference files,
  2 config JSONs, and 2 source modules across both packages
- Static asset paths in `server/routes/index.ts` now resolve from
  `import.meta.url` instead of `process.cwd()` for monorepo resilience

### Added
- `packages/engine/.env.example` for beta customer onboarding
- Engine `llm-processing.js` falls back to `ANTHROPIC_API_KEY` when
  `LLM_API_KEY` is not set

### Fixed
- `mcp-start.js` typo: `startFrontendServer()` corrected to `startFrontend()`

### Security
- All previously exposed API keys and credentials have been rotated
- `.env` files confirmed untracked via `.gitignore` at repo root
- Engine `.env` removed from git index (`git rm --cached`)

## [1.4.16] - 2026-02-12

### Fixed
- MERGE mode in `/api/mcp/regulations/sync` now deduplicates tasks instead of
  blindly inserting — matches by `taskId` first, then by `title`
- Existing tasks are updated in place; only genuinely new tasks are inserted
- Completed/attested tasks are never overwritten (preserves evidence and signatures)

## [1.4.15] - 2026-02-12

### Fixed
- `applicableforms` column name typo in `acceptRegulationUpdate` — changed to
  `applicable_forms` (with underscore) to match actual database column

## [1.4.14] - 2026-02-12

### Fixed
- `/api/regulation-updates` endpoint rebuilt to accept full MCP Engine payload
  (arrays, nested objects, compliance tasks, executive orders, risk assessments,
  filing deadlines) — previously rejected with Zod validation errors
- Loosened strict enums: `requirementType` now accepts "recommendation",
  "best-practice"; `priority` accepts "critical"; EO fields accept any string
- Reordered validation: MCP Engine schema tried first, simple schema fallback
- `ANY()` SQL bug in sync endpoint REPLACE mode: JS array was not cast to
  PostgreSQL int array — now uses `::int[]` cast

### Added
- `mcp_payload JSONB` column on `regulation_updates` — stores the complete raw
  MCP Engine payload verbatim for CCO review and future reprocessing
- `pending_tasks JSONB` column (ensured on all tenants via migration)
- `originalContent` and `updatedContent` now nullable (MCP Engine sends
  `regulationText` instead)
- GET `/api/regulation-updates/:id` now returns `mcpPayload` in the response
- Migration script: `scripts/migrate-mcp-payload-column.cjs`
- Regulation ID resolution now tries numeric `regulationId` before `itemId` slug

## [1.4.13] - 2026-02-12

### Fixed
- Foreign key constraint violation on compliance task replacement: explicitly
  clear `task_attestation_tokens`, `task_evidence`, `task_activity` before
  deleting tasks in REPLACE mode
- Added `ON DELETE CASCADE` to FK constraints via `migrate-task-fk-cascade.cjs`

## [1.4.12] - 2026-02-12

### Fixed
- Production deployment: MCP_API_KEY stored in AWS Secrets Manager (not SSM
  Parameter Store) to match existing ECS secret handling pattern
- Version badge updated to reflect deployed version

## [1.4.11] - 2026-02-12

### Added
- MCP Engine schema alignment: all 3 inbound endpoints now accept 48 regulation
  fields, 21 compliance task fields, and 22 Executive Order fields at full parity
- `X-MCP-API-Key` header authentication across all MCP integration endpoints
  (preferred over Basic Auth, which is now deprecated)
- Database columns: `public_law`, `purpose`, `scope`, `reporting_requirements`,
  `risk_assessment` on regulations; `estimated_effort`, `deliverable`,
  `deliverable_template_url` on compliance_tasks; `affected_sections` on
  eo_regulation_impacts
- Executive Order tables deployed to all tenant databases
- `storage.ts` `acceptRegulationUpdate()` now applies expanded regulation fields,
  full 21-field task schema, and full 22-field EO schema on CCO approval
- Integration test: `scripts/test-mcp-schema-alignment.cjs` (45 assertions)
- Migration scripts: `scripts/migrate-mcp-schema-alignment.cjs`,
  `scripts/migrate-eo-tables-all-tenants.cjs`
- MCP Engine coordination docs: `docs/MCP-ENGINE-BRIEF.md`,
  `docs/MCP-DATA-GAP-AUDIT.md`

### Fixed
- `autoCreateRegulationIfNotExists()` NaN error when passing non-numeric itemId
- Drizzle `db.execute()` result destructuring for EO RETURNING clause
- PostgreSQL `text[]` array handling through Drizzle's `sql` template
- EO impact upsert constraint reference (use column-based ON CONFLICT)
- `reg_key` column expanded from VARCHAR(10) to VARCHAR(100)
- `eo_number` column expanded from VARCHAR(20) to VARCHAR(50)

### Changed
- All MCP endpoints accept `regKey` / `mcpRegKey` as primary identifier
- camelCase is now the canonical naming convention (snake_case still accepted)
- MCP Engine team confirmed fully aligned: 57/57 fields, 153 EO links, 198 tasks

## [1.2.0] - 2026-01-15

### Fixed
- Regulation update accept now properly handles JSONB filing_deadlines field
- Attestation checkmarks display bright green for ALL completed actions (not dimmed)
- Green dot indicator shows for all completed actions regardless of required status
- Compliance tasks data structure in RegulationDetailPage

### Changed
- Removed scale-90 from non-required actions that made them look faded
- Added detailed error messages to accept endpoint for better debugging

## [1.1.0] - 2026-01-06

### Added
- True multi-tenant database architecture with customer isolation
- Wossamotta University demo tenant
- MCP endpoint for creating new regulations with compliance tasks
- Rate limiting for API endpoints
- FERPA and Title IX task seed scripts

### Changed
- Database-per-tenant architecture for security compliance
- MCP Engine integration for bulk regulation imports

## [1.0.0] - 2026-01-02

### Added
- Dark mode support with toggle in navigation
- Executive analytics dashboard with compliance metrics
- Task scheduler with GUI toggle in admin settings
- Bulk operations for compliance tasks
- Mobile responsive menu
- Deadline calendar view on dashboard
- Quick attestation button from dashboard
- Keyboard shortcuts for power users (⌘/Ctrl)
- Email digest options in account settings
- Audit trail CSV export
- "My Tasks" focused view for compliance officers

### Changed
- Updated 47 components with dark mode compatible classes
- Updated 26 pages with dark mode compatible styling
- Improved mobile responsiveness

## [0.9.0] - 2025-12-13

### Added
- One-click email attestation for low-risk regulations
- Task detail view with evidence upload
- Task email links for notifications
- Compliance tasks workflow for complex regulations (Clery Act)
- FERPA/Title IX templates
- Task notifications and analytics
- Hover preview for evidence files with signature display

### Changed
- Major UX redesign: Hero section + accordion layout for regulation detail page
- Enhanced attestation UX
- OKTA sync improvements

## [0.8.0] - 2025-12-04

### Added
- Database backup system for on-prem deployments
- Regulation ownership - compliance officers see only assigned regulations
- Escalation feature for overdue items
- Colored status badges

### Fixed
- Branding logo upload cache issue with cache-busting timestamps
- MCP Engine Integration: UI rich data display, validation range, storage mapping
- Auth and owner filtering
- Actions display issues
- Audit logs SQL syntax error

## [0.7.0] - 2025-11-17

### Added
- Comprehensive frontend system assessment (82% production ready)
- Pre-deployment evidence upload fixes
- Enhanced timeline and UX improvements

### Verified
- Okta SSO role mapping working - compliance officer test successful
- Complete Okta SSO role mapping implementation

### Fixed
- Action updates
- Notifications page dropdown formatting

## [0.6.0] - 2025-10-24

### Added
- Comprehensive audit trail system for compliance tracking
- Compliance status card on regulation detail page
- Note creation with validation
- Evidence file upload functionality

### Fixed
- Audit trail schema and role-based auth errors
- Select component empty value error
- Clery Act full text display
- MFA disable functionality for HECVAT 4.0 compliance

## [0.5.0] - 2025-09-29

### Added
- MFA Frontend UI Components
- MFA login challenge system
- HECVAT 4.0: MFA + Emergency Access Implementation

### Fixed
- MFA API calls - correct apiRequest signature
- Okta Role Assignment with diagnostic tools

### Security
- Implement Okta Group-to-Role Mapping with Comprehensive RBAC

## [0.4.0] - 2025-09-23

### Added
- Comprehensive Regulation Version Control System
- Accept All Button for Bulk Regulation Updates Processing
- Enhanced version control prominent for admin users

### Changed
- Configure EdSteward for MCP Engine Bulk Import

### Fixed
- Async import syntax error in routes

## [0.3.0] - 2025-09-10

### Added
- SAML/SSO Authentication (Okta integration)
- Federal Register Enhanced Integration
- Support for 10x richer regulation packages with metadata storage

### Fixed
- Proper ECS deployment process
- SAML endpoint configuration
- Server SAML route updates

### Changed
- Backward compatibility for regulation metadata

## [0.2.4] - 2025-02-27

### Added
- JSDoc documentation to UI components
- Admin user management endpoints
- Adjustable notification settings for admin users
- Automated deadline reminders (90 days, weekly, daily)
- Bug report button on all pages
- Validation page with category statistics
- API endpoint for regulation validation

### Changed
- Enhanced admin section indicators with visual cues
- Purple border for admin-only panels

## [0.2.3] - 2025-02-27

### Added
- Reset password functionality
- Admin user account management

### Fixed
- Changelog version number click behavior
- z.string() import in admin settings

## [0.2.2] - 2025-02-24

### Added
- Pennsylvania state regulations integration
- Completed status field to deadlines

### Fixed
- Deadline status calculation in pie chart
- PA Code jurisdiction handling
- Database query for regulation fetching

## [0.2.1] - 2025-02-21

### Added
- ETL service with CSV processing
- Data export functionality
- Email notification system with NodeMailer

### Fixed
- Pie chart colors to match legend
- Port configuration and fallback logic

## [0.2.0] - 2025-02-20

### Added
- ETL service for data import/export
- Email notifications with NodeMailer
- Deadline notification checker

### Fixed
- Server port handling
- Express import issues

## [0.1.3] - 2025-02-18

### Fixed
- Regulation links click handling
- Navigation to regulation detail page

## [0.1.2] - 2025-02-14

### Added
- Error boundaries throughout application
- Version tag in navigation bar (Alpha v0.1.0)
- Changelog dialog
- Comment schema documentation

### Fixed
- Routing to regulation detail pages
- Invalid Regulation ID handling

## [0.1.1] - 2025-02-13

### Added
- Interactive pie charts for filtering
- Regulation sorting functionality
- Deadline status color indicators
- Requirements URL links (ECFR)
- Navigation improvements

### Changed
- Chart legends with dark grey text
- Pie chart colors to Moravian brand scheme

## [0.1.0] - 2025-02-12

### Added
- Initial release
- User authentication (login/registration)
- Regulations management dashboard
- Moravian University branding
- Compliance overview with pie charts
- Regulation categories (Academic Programs, Accounting, Athletics, etc.)
- Navigation bar with university logo
- Basic CRUD operations for regulations

---

## Version History Summary

| Version | Date | Milestone |
|---------|------|-----------|
| 1.5.1 | 2026-03-12 | Smart compliance actions, changelog page |
| 1.5.0 | 2026-03-09 | Monorepo migration, API key rotation, security scrub |
| 1.4.x | 2026-02-12 | MCP schema alignment, task dedup, EO support |
| 1.2.0 | 2026-01-15 | Demo prep fixes, attestation display |
| 1.1.0 | 2026-01-06 | Multi-tenant architecture |
| 1.0.0 | 2026-01-02 | Dark mode, scheduler, mobile |
| 0.9.0 | 2025-12-13 | Email attestation, compliance tasks |
| 0.8.0 | 2025-12-04 | Database backups, ownership |
| 0.7.0 | 2025-11-17 | Pre-deployment, Okta SSO verified |
| 0.6.0 | 2025-10-24 | Audit trail system |
| 0.5.0 | 2025-09-29 | MFA implementation |
| 0.4.0 | 2025-09-23 | Version control system |
| 0.3.0 | 2025-09-10 | SAML/SSO authentication |
| 0.2.x | 2025-02-20 | ETL, notifications, admin |
| 0.1.0 | 2025-02-12 | Initial release |
