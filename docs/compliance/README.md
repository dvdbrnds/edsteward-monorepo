# EdSteward Compliance Documentation

This folder contains compliance and security policy documentation for EdSteward, designed to support HECVAT (Higher Education Community Vendor Assessment Toolkit) compliance and other regulatory requirements.

## Document Index

| Document | Purpose | HECVAT Section |
|----------|---------|----------------|
| [Information Security Policy](./INFORMATION_SECURITY_POLICY.md) | Comprehensive security framework | Security Controls |
| [Incident Response Plan](./INCIDENT_RESPONSE_PLAN.md) | Security incident procedures | Incident Response |
| [Data Retention Policy](./DATA_RETENTION_POLICY.md) | Data lifecycle management | Data Protection |
| [Privacy Policy](./PRIVACY_POLICY.md) | Privacy practices and FERPA compliance | Privacy |
| [AI Governance Policy](./AI_GOVERNANCE_POLICY.md) | AI/ML system governance (HECVAT 4) | AI Governance |
| [Vendor Management Policy](./VENDOR_MANAGEMENT_POLICY.md) | Third-party vendor risk management | Organization |
| [SOC 2 Control Alignment](./SOC2_CONTROL_ALIGNMENT.md) | SOC 2 TSC control mapping | Organization |
| [Accessibility Conformance Report](./ACCESSIBILITY_CONFORMANCE_REPORT.md) | WCAG 2.1 AA VPAT/ACR | IT Accessibility |
| [Emergency Access Procedure](../EMERGENCY_ACCESS_PROCEDURE.md) | Business continuity access | Business Continuity |

## HECVAT Compliance Summary

### HECVAT Version Support
- **HECVAT Lite**: Supported
- **HECVAT Full**: Supported
- **HECVAT 4.0**: Supported (including AI governance section)

### Key Compliance Areas

| Area | Status | Evidence | Notes |
|------|--------|----------|-------|
| **Security Controls (Product)** | ✅ Compliant | ISP, security headers, MFA, 12-char passwords, account lockout | All 9 product controls compliant. |
| **Data Protection** | ✅ Compliant | Provider-level encryption, tenant isolation | Encryption at rest via AWS/Neon defaults. |
| **Access Control** | ✅ Compliant | RBAC, SSO/SAML/OIDC/CAS, MFA | Fully implemented in code. |
| **Infrastructure** | ✅ Compliant | AWS VPC, Dependabot, CI/CD security scans, Secrets Manager | All 10 infrastructure controls compliant. |
| **Incident Response** | ✅ Compliant | IRP with playbooks | Documented, tabletop exercise planned. |
| **Business Continuity** | ✅ Compliant | Emergency access procedures | Dual auth architecture, DR testing planned. |
| **Data Retention** | ✅ Compliant | Automated retention, 7-year audit logs, secure disposal | VACUUM + data anonymization before deletion. |
| **Privacy** | ✅ Compliant | Privacy policy, self-service data export, secure deletion | All 8 privacy controls compliant. |
| **SOC 2 Alignment** | ✅ Aligned | SOC 2 Control Alignment report, all providers certified | Controls in place, formal cert planned. |
| **Vendor Management** | ✅ Compliant | Vendor Management Policy, all vendors SOC 2 | Tiered risk model with review cadence. |
| **Pen Testing** | ✅ Compliant | Third-party penetration test completed | Annual cadence established. |
| **AI Governance** | ⚠️ Partial (6/7) | AI policy, admin AI toggles, training opt-out | Bias monitoring not yet automated. |
| **Accessibility** | ⚠️ Partial (1/3) | WCAG 2.1 AA code fixes, self-assessed ACR | Runtime testing still needed. |
| **Organizational** | ⚠️ Partial (8/11) | Policies, CI/CD, pen testing, SOC 2 alignment | No dedicated security hire, formal training, or background checks at EdSteward. |
| **FERPA (Case-Specific)** | ⚠️ Partial (4/5) | Privacy policy, tenant isolation | FERPA contract templates/DPAs in development. |

### Overall Score: **46/52 questions compliant (88%)**

## Document Review Schedule

| Document | Review Frequency | Last Reviewed | Next Review |
|----------|------------------|---------------|-------------|
| Information Security Policy | Annual | Feb 2026 | Feb 2027 |
| Incident Response Plan | Semi-annual | Feb 2026 | Aug 2026 |
| Data Retention Policy | Annual | Feb 2026 | Feb 2027 |
| Privacy Policy | Annual | Feb 2026 | Feb 2027 |
| AI Governance Policy | Semi-annual | Feb 2026 | Aug 2026 |
| Vendor Management Policy | Semi-annual | Feb 2026 | Aug 2026 |
| SOC 2 Control Alignment | Annual | Feb 2026 | Feb 2027 |

## Third-Party Certifications

EdSteward leverages infrastructure with the following certifications:

| Provider | Service | Certifications |
|----------|---------|----------------|
| **AWS** | Cloud Infrastructure | SOC 2, ISO 27001, FedRAMP |
| **Neon** | PostgreSQL Database | SOC 2 Type 2 |
| **OpenAI** | AI Services | SOC 2 |
| **Anthropic** | AI Services | SOC 2 |

## Contact

For compliance inquiries:
- **General Support**: support@edsteward.ai
- **David Brandes, Founder & CEO**: david@edsteward.ai

---

*Last Updated: February 2026*
