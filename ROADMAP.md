# EdSteward Product & Engineering Roadmap

> **Last Updated:** January 16, 2026  
> **Version:** 0.9.2-beta  
> **Status:** Beta (Moravian University pilot)

---

## 🎯 Vision

An AI-powered regulatory compliance platform that transforms complex
multi-jurisdictional regulatory data into actionable, user-friendly insights for
higher education institutions.

---

## 📊 Current Status

| Area              | Status        | Notes                                          |
| ----------------- | ------------- | ---------------------------------------------- |
| **Core Platform** | ✅ Production | Live at moravian.edsteward.ai                  |
| **Multi-Tenant**  | ✅ Production | 4 tenants (Moravian, Staging, Dev, Wossamotta) |
| **Admin Console** | ✅ Beta       | Live at localhost:3001, needs AWS deployment   |
| **SSO/SAML**      | ✅ Production | Okta integration for Moravian                  |
| **MCP Engine**    | ✅ Production | Regulation updates via AI                      |

---

## ✅ Completed Milestones

### Phase 1: Core Infrastructure ✓

- [x] TypeScript/React frontend with Vite
- [x] PostgreSQL database (Neon serverless)
- [x] Authentication system with role-based access
- [x] Compliance tracking interface
- [x] Responsive design with institutional branding
- [x] AWS ECS/Fargate deployment

### Phase 2: User Management & Content ✓

- [x] User management with password reset
- [x] Commenting system
- [x] Evidence files management
- [x] File upload and storage
- [x] Image and PDF preview
- [x] Secure password hashing (scrypt)

### Phase 3: Regulation Management ✓

- [x] Enhanced regulation list interface
- [x] Multi-jurisdiction support (DOL, PA, Federal)
- [x] Automated regulation data collection
- [x] MCP Engine integration for AI-powered updates
- [x] One-click email attestation system

### Phase 4: Notes & Evidence System ✓

- [x] Comprehensive notes management
- [x] Evidence file uploads with official document flags
- [x] Private/public note visibility
- [x] Audit trail logging

### Phase 5: Multi-Tenant Architecture ✓

- [x] Subdomain-based tenant routing
- [x] Per-tenant database isolation (Neon)
- [x] SAML/SSO per tenant (Okta)
- [x] Tenant-aware rate limiting
- [x] Tenant-aware logging/metrics
- [x] Admin console for tenant management

### Phase 6: Dashboard & UX (January 2026) ✓

- [x] Customizable dashboard widgets
- [x] Drag-and-drop widget reordering
- [x] Widget visibility toggles
- [x] Persistent user preferences (localStorage)
- [x] Version display in navigation

---

## 🚧 In Progress

### Phase 7: Production Hardening (Q1 2026)

#### Security & Compliance

- [x] Content Security Policy (CSP) enabled
- [x] Remove hardcoded credentials
- [x] Consolidate database connection pools
- [x] Clean up dead authentication code
- [ ] Move secrets to AWS Secrets Manager
- [ ] Enable AWS CloudTrail
- [ ] SOC 2 Type II preparation

#### Infrastructure

- [ ] Create working `deploy-staging.sh` script
- [ ] Replace sleep-based waits with proper ECS waits
- [ ] Add post-deployment smoke tests
- [ ] Deploy admin console to admin.edsteward.ai
- [ ] Set up proper staging environment (staging.edsteward.ai)

#### Monitoring

- [ ] CloudWatch dashboards
- [ ] Error alerting (PagerDuty/Slack)
- [ ] Performance monitoring
- [ ] Uptime monitoring

---

## 📅 Planned Features

### Phase 8: CI/CD Pipeline (Q1 2026)

- [ ] GitHub Actions workflow
- [ ] Automated testing on PR
- [ ] Automated staging deployment (ES-clientside branch)
- [ ] Manual production promotion (main branch)
- [ ] Automated rollback on failure

### Phase 9: AI Integration Enhancement (Q2 2026)

- [ ] AI-driven compliance gap analysis
- [ ] Smart document comparison
- [ ] Natural language regulation queries
- [ ] Compliance risk scoring
- [ ] Automated deadline reminders

### Phase 10: Advanced Reporting (Q2 2026)

- [ ] Custom report builder
- [ ] Compliance scorecards
- [ ] Executive dashboards
- [ ] Export to PDF/Excel
- [ ] Scheduled report delivery

### Phase 11: Industry-Specific Compliance (Q3-Q4 2026)

- [ ] MSCHE accreditation tracking
- [ ] Title IX compliance module
- [ ] Clery Act reporting
- [ ] FERPA compliance tools
- [ ] HIPAA module (for health programs)
- [ ] Research compliance (IRB, OHRP)

---

## ⏸️ Deferred Tasks

> Items intentionally postponed - revisit when triggered

| Task                       | Trigger to Revisit                               | Est. Effort | Est. Cost Impact     |
| -------------------------- | ------------------------------------------------ | ----------- | -------------------- |
| **Container-per-Tenant**   | Enterprise customer request, FedRAMP requirement | 1-2 days    | +$30-40/tenant/month |
| **Blue/Green Deployments** | Need for zero-downtime deploys                   | 2-3 days    | Minimal              |
| **Multi-Region**           | International customer, DR requirement           | 1 week      | +$100-200/month      |
| **Kubernetes Migration**   | Scale beyond 50 tenants                          | 2-3 weeks   | Variable             |
| **Self-Hosted Option**     | On-premise customer requirement                  | 2 weeks     | License model change |

---

## 🐛 Known Issues / Tech Debt

| Issue                          | Priority | Notes                         |
| ------------------------------ | -------- | ----------------------------- |
| No automated tests             | Medium   | Need unit + integration tests |
| Manual deployments             | Medium   | CI/CD pipeline needed         |
| Staging environment incomplete | Medium   | staging.edsteward.ai not live |
| Documentation gaps             | Low      | API docs incomplete           |

---

## 🏗️ Technical Architecture

### Current Stack

```
Frontend:     React 18 + TypeScript + Vite
Backend:      Express + Node.js 18
Database:     PostgreSQL (Neon Serverless)
Auth:         Passport.js (Local + SAML)
Hosting:      AWS ECS Fargate
Container:    Docker (multi-stage build)
CDN/LB:       AWS ALB
DNS:          Route53 + CNAME subdomains
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

---

## 📈 Success Metrics

| Metric         | Target   | Current |
| -------------- | -------- | ------- |
| Uptime         | 99.9%    | ~99%    |
| Page Load      | < 2s     | ~1.5s   |
| API Response   | < 500ms  | ~200ms  |
| Test Coverage  | 80%      | 0%      |
| Active Tenants | 10 by Q2 | 4       |

---

## 🗓️ Release Schedule

| Version | Target Date | Focus                            |
| ------- | ----------- | -------------------------------- |
| 0.9.3   | Jan 2026    | Staging environment, smoke tests |
| 0.9.4   | Feb 2026    | CI/CD pipeline                   |
| 0.9.5   | Feb 2026    | Monitoring & alerting            |
| 1.0.0   | Mar 2026    | Production-ready release         |
| 1.1.0   | Q2 2026     | AI enhancements                  |
| 1.2.0   | Q2 2026     | Advanced reporting               |

---

## 📝 How to Update This Roadmap

1. **Completed items:** Move to "Completed Milestones" section with date
2. **New features:** Add to appropriate "Planned Features" phase
3. **Deferred work:** Add to "Deferred Tasks" with trigger condition
4. **Tech debt:** Add to "Known Issues / Tech Debt"
5. **Update "Last Updated" date** at the top

---

## 📞 Key Contacts

- **Product Owner:** David Bernardos
- **Repository:** EdSteward (private)
- **Production:** https://moravian.edsteward.ai
- **Admin Console:** https://admin.edsteward.ai (pending deployment)

---

_This roadmap is a living document. Update it as priorities change._
