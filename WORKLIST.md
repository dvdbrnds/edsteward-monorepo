# EdSteward Work Checklist

> **Last Updated:** 2026-03-25
> **Current Version:** v1.5.13 (all environments in sync)
> **Production:** moravian.edsteward.ai | **Staging:** staging.edsteward.ai

---

## Active / High Priority

- [ ] **Deploy admin console to admin.edsteward.ai** — runs locally on ports 3001/4000 but has no AWS deployment; needed for multi-tenant management
- [ ] **Persistent sessions** — sessions are in-memory (`express-session` default MemoryStore); users must re-login after every ECS deployment. Migrate to `connect-pg-simple` or Redis
- [ ] **SAML request cache** — `globalThis.samlCache` (in-memory Map) in `server/config/saml.ts` will break SAML login on multi-instance or restart. Needs DB or Redis backing
- [ ] **Move remaining secrets to AWS Secrets Manager** — `MCP_API_KEY` migrated in v1.4.12, but other env vars are still baked into ECS task definitions

## Infrastructure / DevOps

- [ ] **CI/CD pipeline (GitHub Actions)** — no automated testing or deployment; all deploys are manual via `deploy-staging.sh` / `deploy-production.sh`
- [ ] **Replace sleep-based waits in deploy scripts** with `aws ecs wait services-stable`
- [ ] **Post-deployment smoke tests** — currently only checks `/api/health`; should verify login flow, regulation list, attestation page load
- [ ] **Uptime monitoring** — no external uptime checks (Pingdom, UptimeRobot, or CloudWatch Synthetics)
- [ ] **Error alerting** — no PagerDuty/Slack/email alerts on server errors or ECS task crashes
- [ ] **CloudWatch dashboards** — no centralized visibility into request rates, error rates, latency, ECS metrics
- [ ] **Enable AWS CloudTrail** — required for SOC 2 and general audit readiness

## Tech Debt

- [ ] **Test coverage is near zero** — vitest configured but almost no tests; unit and integration tests needed for auth, compliance tasks, attestation, MCP sync
- [ ] **In-memory account lockout tracking** (`server/auth.ts`) — resets on server restart; should be database-backed
- [ ] **In-memory tenant metrics** (`server/middleware/tenant-logger.ts`) — resets on restart; consider time-series DB or CloudWatch custom metrics
- [ ] **ROADMAP.md out of date** — last updated at v1.4.10, now at v1.5.13; 13 releases behind
- [ ] **Task notification query error** — `$1` parameter error on startup (non-blocking but noisy)
- [ ] **`package.json` version field** — still `1.0.0` in `packages/app/package.json`, doesn't match actual release version (v1.5.13)

## Security / Compliance

- [ ] **SOC 2 Type II preparation** — no formal controls documentation, audit logging needs review
- [ ] **Rate limiting review** — tenant-aware rate limiting exists but hasn't been audited for completeness
- [ ] **CSP audit** — CSP is enabled but may need tightening as features evolve

## Upcoming Features (Q2 2026)

- [ ] AI-driven compliance gap analysis
- [ ] Natural language regulation queries
- [ ] Custom report builder
- [ ] Compliance scorecards / executive dashboards
- [ ] Export to PDF/Excel
- [ ] Scheduled report delivery
- [ ] Automated deadline reminders (email digests)

## Upcoming Features (Q3-Q4 2026)

- [ ] MSCHE accreditation tracking module
- [ ] Title IX compliance module
- [ ] Clery Act reporting module
- [ ] FERPA compliance tools
- [ ] HIPAA module (for health programs)
- [ ] Research compliance (IRB, OHRP)

## Deferred (Trigger-Based)

| Task | Trigger | Est. Effort |
|------|---------|-------------|
| Container-per-tenant isolation | Enterprise / FedRAMP requirement | 1-2 days |
| Blue/green deployments | Need for zero-downtime deploys | 2-3 days |
| Multi-region | International customer or DR requirement | 1 week |
| Kubernetes migration | Scale beyond 50 tenants | 2-3 weeks |
| Self-hosted option | On-premise customer requirement | 2 weeks |

## Recently Completed (v1.5.0 → v1.5.13)

- [x] Institution type filtering with two-tier taxonomy + taxonomy mismatch fix
- [x] Email bounce handling with delivery tracking and auto-escalation
- [x] RCPT TO pre-flight email verification
- [x] Deadline timeline indicators (color-coded progress bars)
- [x] Confidential evidence handling (external reference instead of upload)
- [x] Regulation disable per institution with reason tracking
- [x] Regulation feedback from users
- [x] Circuit court interpretation tracking with circuit split alerts
- [x] Office/DRI separation for compliance tasks
- [x] Interactive product tour (spotlight onboarding)
- [x] Smart compliance action detection (4 compliance steps)
- [x] DeSales University tenant configuration
- [x] Seed scripts modernized to 21-field task standard
- [x] Monorepo migration + API key rotation + security scrub
- [x] Backup/restore system rewrite for safety
- [x] MCP schema alignment (48 reg fields, 21 task fields, 22 EO fields)
- [x] SAML auth syntax fix (orphaned object literals)

---

_This is a living checklist. Update it as work completes or priorities change._
