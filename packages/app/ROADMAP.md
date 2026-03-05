# EdSteward Product & Engineering Roadmap

> **Last Updated:** February 12, 2026
> **Version:** v1.4.10
> **Status:** Production (Moravian University live)

---

## Vision

An AI-powered regulatory compliance platform that transforms complex
multi-jurisdictional regulatory data into actionable, user-friendly insights for
higher education institutions.

---

## Current Status

| Area | Status | Notes |
|------|--------|-------|
| **Core Platform** | Production | Live at moravian.edsteward.ai |
| **Staging** | Production | Live at staging.edsteward.ai |
| **Multi-Tenant** | Production | 4 tenants (Moravian, Staging, Dev, Wossamotta) |
| **Admin Console** | Beta (local) | Runs locally, pending AWS deployment |
| **SSO/SAML** | Production | Okta integration for Moravian |
| **MCP Engine** | Production | Regulation updates via AI |
| **Deployment Pipeline** | Production | Staging-first with gated production deploys |
| **Attestation System** | Production | Magic link evidence upload + digital signatures |
| **Compliance Tasks** | Production | Task assignment, DRI, email notifications |

---

## Completed Milestones

### Phase 1: Core Infrastructure

- [x] TypeScript/React frontend with Vite
- [x] PostgreSQL database (Neon serverless)
- [x] Authentication system with role-based access
- [x] Compliance tracking interface
- [x] Responsive design with institutional branding
- [x] AWS ECS/Fargate deployment

### Phase 2: User Management & Content

- [x] User management with password reset
- [x] Commenting system
- [x] Evidence files management
- [x] File upload and storage
- [x] Image and PDF preview
- [x] Secure password hashing (scrypt)

### Phase 3: Regulation Management

- [x] Enhanced regulation list interface
- [x] Multi-jurisdiction support (DOL, PA, Federal)
- [x] Automated regulation data collection
- [x] MCP Engine integration for AI-powered updates
- [x] One-click email attestation system

### Phase 4: Notes & Evidence System

- [x] Comprehensive notes management
- [x] Evidence file uploads with official document flags
- [x] Private/public note visibility
- [x] Audit trail logging

### Phase 5: Multi-Tenant Architecture

- [x] Subdomain-based tenant routing
- [x] Per-tenant database isolation (Neon)
- [x] SAML/SSO per tenant (Okta)
- [x] Tenant-aware rate limiting
- [x] Tenant-aware logging/metrics
- [x] Admin console for tenant management

### Phase 6: Dashboard & UX (January 2026)

- [x] Customizable dashboard widgets
- [x] Drag-and-drop widget reordering
- [x] Widget visibility toggles
- [x] Persistent user preferences (localStorage)
- [x] Version display in navigation

### Phase 7: Deployment Infrastructure (January-February 2026)

- [x] Staging environment (staging.edsteward.ai)
- [x] `deploy-staging.sh` with health checks and deployment records
- [x] `deploy-production.sh` with safety gates (staging-first verification)
- [x] `rollback-production.sh` for quick rollbacks
- [x] `tag-release.sh` for version management
- [x] Docker builds via Colima (macOS)
- [x] ECR image tagging (version + staging-latest/production-latest)
- [x] Deployment records in `deployments/` directory

### Phase 8: Attestation & Evidence UX (February 2026)

- [x] Magic link attestation pages (no login required)
- [x] Drag-and-drop file upload with auto-upload on selection
- [x] Evidence removal from attestation pages
- [x] Always-visible link evidence fields
- [x] Auto-collapse evidence card after upload with smooth scroll to signature
- [x] Compliance task notifications via email

---

## In Progress

### Phase 9: Production Hardening (Q1 2026)

#### Critical Tasks

- [ ] **Institution type configuration rebuild** - Refactor how institution
      types are configured per tenant
- [ ] Move secrets to AWS Secrets Manager
- [ ] Deploy admin console to admin.edsteward.ai

#### Security & Compliance

- [x] Content Security Policy (CSP) enabled
- [x] Remove hardcoded credentials
- [x] Consolidate database connection pools
- [x] Clean up dead authentication code
- [ ] Enable AWS CloudTrail
- [ ] SOC 2 Type II preparation

#### Infrastructure

- [x] Working deploy-staging.sh and deploy-production.sh scripts
- [x] Staging environment (staging.edsteward.ai)
- [x] Post-deployment health checks
- [ ] Replace sleep-based waits with proper ECS waits in deploy scripts
- [ ] Deploy admin console to admin.edsteward.ai
- [ ] Add post-deployment smoke tests (beyond health check)

#### Monitoring

- [ ] CloudWatch dashboards
- [ ] Error alerting (PagerDuty/Slack)
- [ ] Performance monitoring
- [ ] Uptime monitoring

---

## Planned Features

### Phase 10: CI/CD Pipeline (Q1 2026)

- [ ] GitHub Actions workflow
- [ ] Automated testing on PR
- [ ] Automated staging deployment
- [ ] Manual production promotion
- [ ] Automated rollback on failure

### Phase 11: AI Integration Enhancement (Q2 2026)

- [ ] AI-driven compliance gap analysis
- [ ] Smart document comparison
- [ ] Natural language regulation queries
- [ ] Compliance risk scoring
- [ ] Automated deadline reminders

### Phase 12: Advanced Reporting (Q2 2026)

- [ ] Custom report builder
- [ ] Compliance scorecards
- [ ] Executive dashboards
- [ ] Export to PDF/Excel
- [ ] Scheduled report delivery

### Phase 13: Industry-Specific Compliance (Q3-Q4 2026)

- [ ] MSCHE accreditation tracking
- [ ] Title IX compliance module
- [ ] Clery Act reporting
- [ ] FERPA compliance tools
- [ ] HIPAA module (for health programs)
- [ ] Research compliance (IRB, OHRP)

---

## Deferred Tasks

> Items intentionally postponed - revisit when triggered

| Task | Trigger to Revisit | Est. Effort | Est. Cost Impact |
|------|-------------------|-------------|-----------------|
| **Container-per-Tenant** | Enterprise customer request, FedRAMP requirement | 1-2 days | +$30-40/tenant/month |
| **Blue/Green Deployments** | Need for zero-downtime deploys | 2-3 days | Minimal |
| **Multi-Region** | International customer, DR requirement | 1 week | +$100-200/month |
| **Kubernetes Migration** | Scale beyond 50 tenants | 2-3 weeks | Variable |
| **Self-Hosted Option** | On-premise customer requirement | 2 weeks | License model change |

---

## Known Issues / Tech Debt

| Issue | Priority | Notes |
|-------|----------|-------|
| Low test coverage | Medium | Unit + integration tests needed (vitest configured) |
| CHANGELOG.md behind | Low | Last entry is v1.2.0, current is v1.4.10 |
| Task notification query error | Low | `$1` parameter error on startup (non-blocking) |
| Sessions are in-memory | Medium | Users must re-login after each deployment |
| Admin console local only | Medium | Needs AWS deployment to admin.edsteward.ai |

---

## Technical Architecture

### Current Stack

```
Frontend:     React 18 + TypeScript + Vite + Tailwind + shadcn/ui
Backend:      Express.js + Node.js + TypeScript (tsx)
Database:     PostgreSQL (Neon Serverless) + Drizzle ORM
Auth:         Passport.js (Local + SAML/Okta) + MFA (TOTP)
Hosting:      AWS ECS Fargate
Container:    Docker (multi-stage, Colima on macOS)
CDN/LB:       AWS ALB with HTTPS termination
DNS:          Route53 + CNAME subdomains
Registry:     AWS ECR (edsteward-multi-tenant)
Admin:        Separate React + Express app (admin-console/)
```

### Multi-Tenant Model

```
┌─────────────────────────────────────────┐
│         Shared Application Layer         │
│  (Single ECS Service, Single Container)  │
├─────────────────────────────────────────┤
│    Tenant Routing (Subdomain-based)      │
├──────────┬──────────┬──────────┬────────┤
│ Moravian │ Staging  │   Dev    │Wossam. │
│   DB     │   DB     │   DB     │  DB    │
└──────────┴──────────┴──────────┴────────┘
```

### Deployment Flow

```
Code Change → Commit & Push → Tag Version → Deploy Staging → Verify → Deploy Production
```

---

## Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Uptime | 99.9% | ~99% |
| Page Load | < 2s | ~1.5s |
| API Response | < 500ms | ~200ms |
| Test Coverage | 80% | Low |
| Active Tenants | 10 by Q2 | 4 |

---

## Key Contacts

- **Product Owner:** David Bernardos
- **Repository:** EdSteward (private, GitHub)
- **Production:** https://moravian.edsteward.ai
- **Staging:** https://staging.edsteward.ai
- **Admin Console:** https://admin.edsteward.ai (pending deployment)

---

_This roadmap is a living document. Update it as priorities change._
