# EdSteward Third-Party Vendor Management Policy

**Document Version**: 1.0
**Effective Date**: February 2026
**Last Reviewed**: February 2026
**Next Review**: August 2026
**Owner**: David Brandes, Founder & CEO

---

## 1. Purpose

This policy establishes EdSteward's requirements for assessing, selecting,
monitoring, and managing third-party vendors that process, store, or have access
to EdSteward systems or customer data. The goal is to ensure that third-party
relationships do not introduce unacceptable risk to EdSteward or its customers.

## 2. Scope

This policy applies to all third-party vendors, service providers, and
subprocessors that:

- Process or store customer data on EdSteward's behalf
- Have access to EdSteward production systems or infrastructure
- Provide services integral to EdSteward's platform operation
- Process data subject to FERPA, GDPR, CCPA, or other regulatory requirements

## 3. Vendor Classification

### 3.1 Risk Tiers

Vendors are classified into risk tiers based on their access to data and systems:

| Tier | Description | Examples | Review Frequency |
|------|-------------|----------|-----------------|
| **Critical** | Stores/processes customer data or hosts production infrastructure | AWS, Neon | Quarterly |
| **High** | Processes data via API but does not store customer data | OpenAI, Anthropic | Semi-annually |
| **Medium** | Provides development tools or non-production services | GitHub, npm registry | Annually |
| **Low** | No access to customer data or production systems | Domain registrar, marketing tools | Every 2 years |

### 3.2 Current Vendor Inventory

| Vendor | Service | Tier | Certifications | Data Access | Last Reviewed |
|--------|---------|------|---------------|-------------|--------------|
| **Amazon Web Services (AWS)** | Cloud infrastructure (ECS Fargate, ALB, S3, CloudWatch, ECR) | Critical | SOC 2 Type 2, ISO 27001, FedRAMP | Hosts all compute and storage | Feb 2026 |
| **Neon** | Serverless PostgreSQL database | Critical | SOC 2 Type 2 | Stores all tenant databases | Feb 2026 |
| **OpenAI** | AI regulation analysis (GPT API) | High | SOC 2 | Public regulatory text only (no PII) | Feb 2026 |
| **Anthropic** | AI document understanding (API) | High | SOC 2 | Public regulatory text only (no PII) | Feb 2026 |
| **GitHub** | Source code repository, CI/CD | Medium | SOC 2 Type 2 | Source code, no customer data | Feb 2026 |

## 4. Vendor Assessment Process

### 4.1 Pre-Engagement Assessment

Before engaging a new vendor, the following must be completed:

1. **Security certification review**: Verify the vendor holds SOC 2, ISO 27001,
   or equivalent certifications
2. **Privacy impact assessment**: Determine what customer data the vendor will
   access, process, or store
3. **Data residency verification**: Confirm data processing occurs in acceptable
   geographic locations (US for EdSteward)
4. **Contractual requirements**: Ensure the vendor agreement includes:
   - Data processing terms and limitations
   - Security incident notification requirements
   - Data return/deletion upon termination
   - Right to audit (or accept SOC 2 report as equivalent)
   - Confidentiality obligations
5. **Regulatory compliance check**: For vendors processing education records,
   verify FERPA compliance capability

### 4.2 Assessment Criteria

| Criteria | Minimum Requirement |
|----------|-------------------|
| Security certifications | SOC 2 or equivalent for Critical/High tier vendors |
| Encryption at rest | AES-256 or equivalent |
| Encryption in transit | TLS 1.2+ |
| Incident notification | Within 72 hours of discovery |
| Data residency | United States |
| Subprocessor transparency | Must disclose subprocessors |
| Business continuity | Documented recovery procedures |

### 4.3 Assessment Documentation

All vendor assessments are documented and retained for the duration of the vendor
relationship plus 2 years. Documentation includes:

- Vendor security questionnaire responses
- Certification copies (SOC 2 reports, ISO certificates)
- Risk assessment findings
- Approval decision and rationale

## 5. Ongoing Monitoring

### 5.1 Periodic Review

Vendors are reviewed on a schedule based on their risk tier (see Section 3.1).
Reviews include:

- Verify current security certifications
- Review any security incidents reported by the vendor
- Assess changes to the vendor's services or data processing
- Review vendor's subprocessor changes
- Evaluate vendor's financial stability and business continuity

### 5.2 Continuous Monitoring

- **Dependabot**: Monitors software dependencies for known vulnerabilities
- **Security advisories**: Subscribe to vendor security advisory feeds
- **Certification tracking**: Track SOC 2 report renewal dates

### 5.3 Incident Response

If a vendor reports a security incident:

1. Evaluate the scope and impact on EdSteward customer data
2. Follow EdSteward's Incident Response Plan for containment and notification
3. Document the incident in the vendor risk register
4. Assess whether the vendor relationship should continue
5. Notify affected customers per the IRP notification procedures

## 6. Data Protection Requirements

### 6.1 AI Vendor Controls

For AI service providers (OpenAI, Anthropic):

- **Data minimization**: Only public regulatory text is sent to AI APIs. No
  student PII, institutional data, or customer evidence is transmitted.
- **Training opt-out**: Explicit training opt-out headers are configured on all
  AI API clients (`X-No-Training: true`).
- **Feature control**: AI features are opt-in (disabled by default) and can be
  toggled per-tenant by administrators.
- **Audit trail**: All AI API interactions are logged for compliance auditing.

### 6.2 Infrastructure Vendor Controls

For infrastructure providers (AWS, Neon):

- **Tenant isolation**: Database-per-tenant architecture ensures no data
  commingling across customers.
- **Encryption**: All data encrypted at rest (provider-managed keys) and in
  transit (TLS).
- **Access control**: Production access restricted to founder/CEO. IAM policies
  follow least-privilege principle.
- **Backup**: Automated backups with defined retention periods.

## 7. Vendor Termination

Upon termination of a vendor relationship:

1. Ensure all customer data is returned or securely deleted per contract terms
2. Revoke all access credentials and API keys
3. Update secrets management to remove vendor-specific secrets
4. Document the termination in the vendor register
5. Identify and implement replacement services if needed
6. Notify affected customers if the change impacts service delivery

## 8. Roles and Responsibilities

| Role | Responsibility |
|------|---------------|
| **CEO / Security Officer** | Approves new Critical/High tier vendors. Conducts vendor risk assessments. |
| **Engineering Team** | Evaluates technical integration security. Monitors dependency vulnerabilities. |
| **Support** | Escalates vendor-related security concerns. |

## 9. Exceptions

Any exceptions to this policy must be documented with:

- Business justification
- Risk assessment of the exception
- Compensating controls implemented
- Approval by the CEO/Security Officer
- Defined expiration date for the exception

## 10. Policy Review

This policy is reviewed semi-annually and updated as needed to reflect changes
in the vendor landscape, regulatory requirements, or EdSteward's risk posture.

---

*Approved by: David Brandes, Founder & CEO*
*Date: February 2026*
