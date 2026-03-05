# EdSteward SOC 2 Control Alignment

**Document Version**: 1.0
**Last Updated**: February 2026
**Status**: Controls Aligned (Certification Not Yet Obtained)

## Overview

This document maps EdSteward's implemented security controls to the SOC 2 Trust
Service Criteria (TSC). While EdSteward has not yet obtained a formal SOC 2 Type
2 certification, the controls documented here are implemented and operational,
aligned with SOC 2 requirements. All infrastructure providers (AWS, Neon, OpenAI)
hold their own SOC 2 certifications.

A formal SOC 2 Type 2 audit engagement is planned for when the company scales to
support the cost and organizational overhead of the certification process.

---

## Trust Service Criteria Mapping

### CC1: Control Environment

| Control | Implementation | Evidence |
|---------|---------------|----------|
| CC1.1 - Commitment to integrity and ethical values | Information Security Policy establishes security principles and ethics. AI Governance Policy defines responsible AI use. | `docs/compliance/INFORMATION_SECURITY_POLICY.md`, `docs/compliance/AI_GOVERNANCE_POLICY.md` |
| CC1.2 - Board/management oversight | CEO serves as designated security officer. Security policies reviewed annually. | ISP Section 3: Security Governance |
| CC1.3 - Organizational structure | Roles and responsibilities defined in ISP. RBAC implemented in platform with 5 role levels. | ISP Section 3; `server/middleware/role-based-auth.ts` |
| CC1.4 - Competence commitment | Founding team built the security framework. Security training planned with team growth. | ISP Section 13: Personnel Security |
| CC1.5 - Accountability | Comprehensive audit logging tracks all user actions. 7-year audit log retention. | `server/services/audit.ts`; `server/routes/api/audit.ts` |

### CC2: Communication and Information

| Control | Implementation | Evidence |
|---------|---------------|----------|
| CC2.1 - Internal communication | Security policies documented and accessible. Incident response procedures defined. | `docs/compliance/` directory |
| CC2.2 - External communication | Privacy policy published. HECVAT report available to tenants. Support channels documented. | `docs/compliance/PRIVACY_POLICY.md`; Compliance tab in Admin Settings |
| CC2.3 - Information quality | Input validation (Zod schemas) on all API endpoints. Output encoding for XSS prevention. | `shared/schema.ts`; server-side validation |

### CC3: Risk Assessment

| Control | Implementation | Evidence |
|---------|---------------|----------|
| CC3.1 - Risk identification | Third-party penetration testing completed. Automated vulnerability scanning (Dependabot, npm audit, ECR scan-on-push). | `.github/dependabot.yml`; `.github/workflows/security.yml` |
| CC3.2 - Risk analysis | ISP defines risk assessment framework. Severity levels (P1-P4) for incident classification. | ISP Section 3.2; IRP severity matrix |
| CC3.3 - Fraud risk | Generic login error messages prevent username enumeration. Account lockout after 5 failed attempts. Rate limiting on auth endpoints. | `server/auth.ts` (lockout logic); `server/middleware/rate-limiter.ts` |
| CC3.4 - Change impact analysis | CI/CD pipeline runs security checks on every push/PR. Dependabot monitors dependency risks. | `.github/workflows/security.yml` |

### CC4: Monitoring Activities

| Control | Implementation | Evidence |
|---------|---------------|----------|
| CC4.1 - Ongoing monitoring | AWS CloudWatch alarms for ECS and ALB metrics. Custom monitoring dashboard. Tenant isolation violation monitoring. | `infrastructure/terraform/monitoring.tf` |
| CC4.2 - Deficiency evaluation | Automated dependency vulnerability detection. Container image scanning. ESLint security linting in CI. | `.github/dependabot.yml`; `.github/workflows/security.yml` |

### CC5: Control Activities

| Control | Implementation | Evidence |
|---------|---------------|----------|
| CC5.1 - Control selection | Defense-in-depth approach: network segmentation, application security headers, input validation, authentication controls, encryption. | ISP; `server/index.ts` (Helmet); Terraform VPC |
| CC5.2 - Technology controls | HSTS, CSP, X-Frame-Options security headers. Parameterized queries. Scrypt password hashing. Session management. | `server/index.ts`; `server/auth.ts` |
| CC5.3 - Policy deployment | Policies documented in version-controlled repository. Accessible to all team members. | `docs/compliance/` |

### CC6: Logical and Physical Access Controls

| Control | Implementation | Evidence |
|---------|---------------|----------|
| CC6.1 - Logical access security | RBAC with 5 role levels. SSO/SAML 2.0, OIDC, CAS support. TOTP MFA. 12-character minimum passwords with complexity requirements. Account lockout. | `server/auth.ts`; `server/auth/saml.ts`; `shared/schema.ts` |
| CC6.2 - Access provisioning | Role-based user creation by admins. Tenant-isolated user management. | `server/routes/api/users.ts` |
| CC6.3 - Access removal | User deactivation (soft delete). Automated purge after 30-day grace period with data anonymization. Session invalidation on logout. | `server/services/data-retention.ts` |
| CC6.4 - Access restriction | Database-per-tenant architecture. Tenant middleware validates every request. Private subnets for compute resources. No direct SSH access. | `server/middleware/tenant.ts`; `infrastructure/terraform/main.tf` |
| CC6.5 - Authentication mechanisms | Scrypt password hashing (256-bit). TOTP MFA. Secure session tokens (cryptographically random). Session timeout. | `server/auth.ts`; `server/services/mfa.ts` |
| CC6.6 - Access credential management | AWS Secrets Manager integration for production secrets. Cache TTL-based rotation support. Env var fallback for development. | `server/services/secrets-manager.ts` |
| CC6.7 - Physical access | Managed by AWS (SOC 2, ISO 27001, FedRAMP certified data centers). | AWS compliance certifications |
| CC6.8 - Encryption | HTTPS enforced (HSTS). Database SSL required. S3 AES-256 server-side encryption. Neon encryption at rest. | Helmet config; `.env` (sslmode=require); S3 storage config |

### CC7: System Operations

| Control | Implementation | Evidence |
|---------|---------------|----------|
| CC7.1 - Infrastructure management | Infrastructure as Code (Terraform). Immutable container deployments. ECS Fargate serverless compute. | `infrastructure/terraform/main.tf`; `Dockerfile` |
| CC7.2 - Change management | Git version control. CI/CD security pipeline. Automated dependency updates via Dependabot. Code review process. | `.github/workflows/security.yml`; `.github/dependabot.yml` |
| CC7.3 - Configuration management | Terraform manages infrastructure state. Docker containers rebuilt for updates. Non-root container execution. Alpine minimal base images. | `Dockerfile`; Terraform state |
| CC7.4 - Incident detection | AWS CloudWatch alarms. Application-level security logging (syslog). Auth event logging with IP and user-agent capture. | `server/services/syslog.ts`; `infrastructure/terraform/monitoring.tf` |
| CC7.5 - Incident response | Documented IRP with playbooks for data breach, ransomware, unauthorized access, and service outage. Severity-based response times. | `docs/compliance/INCIDENT_RESPONSE_PLAN.md` |

### CC8: Change Management

| Control | Implementation | Evidence |
|---------|---------------|----------|
| CC8.1 - Change authorization | All changes go through Git. CI pipeline validates builds. Security checks required on PRs. | `.github/workflows/security.yml` |

### CC9: Risk Mitigation

| Control | Implementation | Evidence |
|---------|---------------|----------|
| CC9.1 - Vendor risk management | Vendor Management Policy documents assessment and monitoring process. All current vendors SOC 2 certified. | `docs/compliance/VENDOR_MANAGEMENT_POLICY.md` |
| CC9.2 - Business continuity | Emergency access procedures. Dual auth architecture. AWS/Neon redundancy and automated backups. | `docs/EMERGENCY_ACCESS_PROCEDURE.md` |

### A1: Availability

| Control | Implementation | Evidence |
|---------|---------------|----------|
| A1.1 - Availability commitments | AWS ECS Fargate with ALB for high availability. Neon serverless PostgreSQL with built-in redundancy. | `infrastructure/terraform/main.tf` |
| A1.2 - Recovery mechanisms | Automated backup system. Database backup and restore functionality. Emergency access procedures. | `server/services/backup-service.ts`; `docs/EMERGENCY_ACCESS_PROCEDURE.md` |

### C1: Confidentiality

| Control | Implementation | Evidence |
|---------|---------------|----------|
| C1.1 - Confidentiality commitments | Privacy Policy published. FERPA compliance documented. No data sold or shared for marketing. No tracking scripts. | `docs/compliance/PRIVACY_POLICY.md` |
| C1.2 - Confidential data disposal | Automated data retention with defined periods. Data anonymization before deletion. VACUUM after purge. | `server/services/data-retention.ts` |

### PI1: Processing Integrity

| Control | Implementation | Evidence |
|---------|---------------|----------|
| PI1.1 - Processing accuracy | Zod schema validation on all inputs. Type-safe TypeScript throughout. Parameterized database queries. | `shared/schema.ts`; Drizzle ORM |
| PI1.2 - Error handling | Structured error responses. Comprehensive logging. Graceful degradation on service failures. | Application-wide error handling |

### P1: Privacy

| Control | Implementation | Evidence |
|---------|---------------|----------|
| P1.1 - Privacy notice | Privacy Policy covers collection, use, disclosure, retention. FERPA, GDPR, CCPA provisions. | `docs/compliance/PRIVACY_POLICY.md` |
| P1.2 - Data subject rights | Self-service "Download My Data" export. Legal export for admins. Correction via account settings. Deletion via admin request. | `server/routes/api/data-export.ts`; `server/routes/api/legal-export.ts` |
| P1.3 - Data minimization | Only essential data collected. Session cookies only (no tracking). AI processes only public regulatory text. | Code review; Privacy Policy |
| P1.4 - Data retention | Defined retention periods. Automated purge jobs. 7-year audit log retention. Secure disposal with VACUUM. | `server/services/data-retention.ts`; `docs/compliance/DATA_RETENTION_POLICY.md` |

---

## Gap Analysis for Formal Certification

| Gap | Impact | Remediation Plan |
|-----|--------|-----------------|
| No formal SOC 2 Type 2 audit | Cannot provide Type 2 attestation letter | Engage audit firm when company scales |
| Dedicated security team not yet hired | Single point of dependency on founder | Planned hire with growth |
| Formal security training program | Required for SOC 2 CC1.4 | To be implemented with team growth |
| Tabletop exercise for IRP | IRP untested in simulation | Planned for 2026 |
| DR testing | Recovery procedures untested | Planned for 2026 |

---

## Conclusion

EdSteward has implemented controls aligned with all five SOC 2 Trust Service
Categories (Security, Availability, Confidentiality, Processing Integrity, and
Privacy). The remaining gaps are organizational maturity items that will be
addressed as the company scales. All infrastructure providers maintain their own
SOC 2 certifications.

---

*Prepared by: David Brandes, Founder & CEO*
*Date: February 2026*
