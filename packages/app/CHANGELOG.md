# Changelog

All notable changes to EdSteward are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.11] - 2026-03-17

### Added
- **RCPT TO pre-flight email verification** — before sending any outbound email,
  the system resolves the recipient's MX records and probes with SMTP `RCPT TO`
  to detect invalid addresses before the message is sent. Catches non-existent
  domains (no MX records) and addresses rejected by providers that enforce
  recipient validation (e.g., Gmail, Outlook.com). Results are cached for 10
  minutes. Timeouts and probe errors are treated as inconclusive — the send
  proceeds. Does not block sends for catch-all servers (e.g., Exchange).

## [1.5.10] - 2026-03-17

### Added
- **Email bounce handling system** — all outbound emails are now logged to an
  `email_delivery_log` table with SMTP response codes, message IDs, and delivery
  status tracking
- **Automatic bounce escalation** — when an email to a DRI bounces (SMTP 5xx),
  the system automatically notifies the regulation/task escalation contact and
  all CCO/admin users, and creates an in-app notification
- **User email status tracking** — `users.email_status` column flags addresses
  as `valid`, `bounced`, or `unverified`; permanent SMTP rejections auto-flag
  the user
- **Delivery issues admin panel** — new "Email Delivery Issues" section at the
  top of the Notifications tab in admin settings, showing delivered/bounced/failed
  counts, a filterable table of issues, and a "Resolve" action that resets the
  user's email status
- **Bounce warning on notifications page** — red alert banner when unresolved
  delivery issues exist, linking to the admin panel
- **DRI email status indicator** — task detail dialog shows a red "bounced"
  badge next to any assigned user whose email is flagged, giving CCOs immediate
  visibility into unreachable DRIs
- Admin API endpoints: `GET /api/admin/email-delivery-issues` and
  `POST /api/admin/email-delivery-issues/:id/resolve`

### Changed
- `EmailService.sendEmail()` now delegates to `sendEmailTracked()` internally,
  logging every send attempt while preserving backward compatibility (still
  returns boolean)
- Task notifications, deadline notifications, attestation emails, compliance
  task emails, and manual notifications all pass entity context to the delivery
  tracker for richer audit data
- `compliance_tasks` API queries now include `emailStatus` in user selects

## [1.5.9] - 2026-03-16

### Added
- **Deadline timeline indicator** — regulation list now shows a color-coded
  horizontal progress bar for each regulation's next deadline (green 30+ days,
  yellow 15-30, orange 7-14, red <7, pulsing red when overdue) with a day
  count label underneath
- CCOs now see all regulations with deadlines in the next 30 days, regardless
  of ownership assignment

## [1.5.8] - 2026-03-16

### Added
- **Confidential evidence handling** — engine auto-detects tasks involving
  protected data (FERPA records, conduct reports, health info) and sets
  evidence type to external reference; attestation UI shows "Where is this
  evidence maintained?" input instead of file upload for confidential tasks
- **Disable regulation per institution** — admins can disable regulations that
  don't apply, with reason tracking; disabled regulations filtered from listing
- **Regulation feedback button** — any user can submit corrections,
  clarifications, or additional context about a regulation from its detail page
- **DeSales University** tenant configuration in registry and engine customers
- **GitHub Issues** templates for bug reports, feature requests, and regulation
  data issues
- **Interactive product tour** — spotlight-guided onboarding that highlights
  navigation elements with positioned tooltips (triggers after first login)
- Backfill script for retroactively flagging confidential compliance tasks

### Changed
- `compliance_tasks` schema: new `is_confidential`, `confidential_data_types`,
  `external_system_reference` columns
- New `disabled_regulations` and `regulation_feedback` tables
- Evidence type enum extended with `external_reference` and `self_attestation`
- MCP Engine LLM prompt now extracts confidential data types per compliance task

## [1.5.6] - 2026-03-14

### Added
- **Federal circuit court interpretation tracking** — EdSteward now tracks how
  different federal circuit courts interpret each regulation, highlighting
  circuit splits and binding precedent that varies by geographic location
- Circuit interpretations panel on each regulation detail page, showing your
  institution's circuit alongside other circuits' rulings
- Active circuit split alerts when circuits disagree on the same regulation
- CCO review workflow for incoming circuit interpretations (review, address, dismiss)
- Impact severity and interpretation type badges (stricter, broader, narrower,
  divergent, vacated) for quick triage
- MCP Engine delivers circuit interpretation data alongside regulation updates
- Initial circuit data for Title IX, FERPA, Clery Act, and GLBA

### Changed
- All 300 regulation console pages in the MCP Engine now include circuit
  court interpretation sections and executive order sections
- Fixed a redirect bug affecting all Engine console pages

## [1.5.5] - 2026-03-14

### Added
- Canonical office vs DRI (Directly Responsible Individual) separation for
  compliance tasks — reports reference the office (e.g., "Office of General
  Counsel"), while attestation signing is assigned to a specific individual
- New `office_name` and `office_email` columns on `role_assignments`; new
  `responsible_office` and `responsible_office_email` columns on `compliance_tasks`
- Office information auto-populated from role assignments during MCP sync
- Attestation completion now CCs the responsible office email
- Admin console institution assessment tool with compliance analyzer, external
  checks, and website scanner services

### Changed
- Task display across the app now shows "Office — DRI Name" format (task list,
  detail dialog, differential view, notifications, attestation page)
- Role assignments admin UI includes canonical office name/email fields with
  clear DRI vs office labeling
- "Compliance" tab in admin settings renamed to "HECVAT" for clarity

### Fixed
- **Backup/restore system completely rewritten for safety** — restores previously
  could destroy the database with no recovery path (search_path poisoning from
  pg_dump on Neon pooled connections, and missing safety net on failed restores)
- Restore now creates an automatic safety backup before touching any data;
  if the restore fails or verification fails, the original data is recovered
  automatically
- pg_dump output sanitized at creation time to strip `set_config('search_path')`
  and Neon-specific `\restrict` commands that poison pooled connections
- Restore UI now shows real-time progress with phase indicators (safety backup →
  applying data → verifying) instead of silently dismissing the dialog
- Dialog stays open during restore and cannot be accidentally closed

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
| 1.5.6 | 2026-03-14 | Circuit court interpretations, console sync |
| 1.5.5 | 2026-03-14 | Office/DRI separation, backup safety, assessment tool |
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
