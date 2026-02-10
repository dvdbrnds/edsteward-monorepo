# EdSteward Information Security Policy

**Document Version:** 1.0  
**Effective Date:** February 2026  
**Last Reviewed:** February 5, 2026  
**Next Review Date:** February 2027  
**Document Owner:** EdSteward Security Team  

---

## 1. Purpose

This Information Security Policy establishes the security framework, principles, and requirements for protecting EdSteward's information systems, customer data, and operations. This policy ensures compliance with higher education security requirements, including HECVAT (Higher Education Community Vendor Assessment Toolkit) standards.

## 2. Scope

This policy applies to:
- All EdSteward employees, contractors, and third-party service providers
- All information systems, applications, and infrastructure operated by EdSteward
- All customer (tenant) data processed, stored, or transmitted by EdSteward
- All environments including production, staging, development, and disaster recovery

## 3. Security Governance

### 3.1 Security Responsibilities

| Role | Responsibilities |
|------|------------------|
| **Executive Leadership** | Strategic security direction, resource allocation, risk acceptance |
| **Security Team** | Policy development, security operations, incident response |
| **Development Team** | Secure coding practices, vulnerability remediation |
| **Operations Team** | System hardening, monitoring, patch management |
| **All Personnel** | Compliance with security policies, security awareness |

### 3.2 Security Review Cadence

- **Policy Review**: Annual (or after significant changes)
- **Risk Assessment**: Annual
- **Penetration Testing**: Annual (third-party)
- **Vulnerability Scanning**: Continuous (automated)
- **Access Reviews**: Quarterly
- **Security Training**: Annual (all staff)

## 4. Information Classification

### 4.1 Data Classification Levels

| Classification | Description | Examples |
|----------------|-------------|----------|
| **Confidential** | Highly sensitive data requiring maximum protection | Customer PII, authentication credentials, encryption keys |
| **Internal** | Business-sensitive data for internal use | System configurations, internal documentation, audit logs |
| **Public** | Information approved for public release | Marketing materials, public documentation |

### 4.2 Customer Data Protection

EdSteward processes the following types of customer data:
- **Personally Identifiable Information (PII)**: Names, email addresses, institutional affiliations
- **Compliance Records**: Regulatory compliance status, attestations, deadlines
- **Evidence Files**: Documents uploaded by customers for compliance purposes
- **Audit Trails**: User activity logs within the platform

All customer data is classified as **Confidential** and subject to:
- Encryption at rest (AES-256)
- Encryption in transit (TLS 1.2+)
- Tenant isolation (database-per-tenant architecture)
- Access controls based on least privilege

## 5. Access Control

### 5.1 Authentication Requirements

| Requirement | Implementation |
|-------------|----------------|
| **Multi-Factor Authentication** | TOTP-based MFA available for all users |
| **Single Sign-On (SSO)** | SAML 2.0, OpenID Connect, CAS supported |
| **Password Policy** | Minimum 12 characters, complexity requirements enforced |
| **Session Management** | Automatic timeout, secure session tokens |
| **Failed Login Protection** | Account lockout after 5 failed attempts |

### 5.2 Authorization Model

EdSteward implements Role-Based Access Control (RBAC):

| Role | Permissions |
|------|-------------|
| **Administrator** | Full system access, user management, configuration |
| **Compliance Officer** | Regulation management, task assignment, attestations |
| **User** | View assigned regulations, complete tasks, upload evidence |
| **Read-Only** | View-only access to assigned content |

### 5.3 Tenant Isolation

- **Database Isolation**: Each tenant has a dedicated PostgreSQL database
- **Network Isolation**: Tenant traffic logically separated
- **Session Isolation**: Tenant context validated on every request
- **No Cross-Tenant Access**: Users cannot access other tenants' data

## 6. Infrastructure Security

### 6.1 Cloud Infrastructure (AWS)

| Component | Security Controls |
|-----------|-------------------|
| **Compute (ECS Fargate)** | Private subnets, security groups, no SSH access |
| **Load Balancer (ALB)** | TLS termination, WAF-ready, DDoS protection |
| **Database (Neon PostgreSQL)** | Encryption at rest, SSL connections required |
| **Storage** | Encryption at rest, access logging enabled |
| **Secrets** | AWS Secrets Manager, environment variable injection |

### 6.2 Network Security

- **VPC Architecture**: Public/private subnet separation
- **Security Groups**: Least-privilege network access rules
- **TLS Enforcement**: All external traffic encrypted (TLS 1.2+)
- **HTTPS Only**: HTTP redirected to HTTPS in production

### 6.3 Container Security

- **Base Images**: Official, minimal base images only
- **Vulnerability Scanning**: ECR scan-on-push enabled
- **No Root Access**: Containers run as non-root users
- **Immutable Infrastructure**: Containers rebuilt for updates

## 7. Application Security

### 7.1 Secure Development Practices

- **Code Review**: All changes require peer review
- **Static Analysis**: ESLint security rules enforced
- **Dependency Scanning**: Automated vulnerability detection in dependencies
- **Input Validation**: All user input validated and sanitized
- **Output Encoding**: Protection against XSS attacks

### 7.2 Security Headers

EdSteward implements the following security headers:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Content-Security-Policy: default-src 'self'; script-src 'self' ...
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
X-Robots-Tag: noindex, nofollow
```

### 7.3 API Security

- **Authentication Required**: All API endpoints require authentication
- **Rate Limiting**: Protection against abuse and DoS
- **Input Validation**: Schema validation on all requests
- **Audit Logging**: All API calls logged with user context

## 8. Cryptographic Controls

### 8.1 Encryption Standards

| Use Case | Algorithm | Key Length |
|----------|-----------|------------|
| **Data at Rest** | AES-256-GCM | 256-bit |
| **Data in Transit** | TLS 1.2+ | 2048-bit RSA / ECDHE |
| **Password Hashing** | bcrypt | Cost factor 12 |
| **MFA Secrets** | AES-256-CBC | 256-bit |
| **Session Tokens** | Cryptographically random | 256-bit |

### 8.2 Key Management

- Encryption keys stored in AWS Secrets Manager
- Key rotation performed annually (or on compromise)
- Separation of keys between environments
- No hardcoded credentials in source code

## 9. Monitoring and Logging

### 9.1 Logging Requirements

| Log Type | Retention | Purpose |
|----------|-----------|---------|
| **Application Logs** | 90 days | Operational monitoring, debugging |
| **Audit Logs** | 1 year | Compliance, security investigations |
| **Access Logs** | 90 days | Security monitoring |
| **Error Logs** | 90 days | Incident investigation |

### 9.2 Security Monitoring

- **Real-time Alerting**: Critical security events trigger immediate alerts
- **Log Analysis**: Centralized logging via AWS CloudWatch
- **Anomaly Detection**: Unusual access patterns flagged for review
- **Compliance Dashboards**: Audit log summaries for reporting

### 9.3 Audit Trail

All compliance-impacting actions are logged including:
- User authentication events (login, logout, MFA)
- Data access and modifications
- Administrative actions
- File uploads and downloads
- Attestation completions

## 10. Vulnerability Management

### 10.1 Vulnerability Scanning

| Type | Frequency | Tool |
|------|-----------|------|
| **Container Scanning** | On every push | AWS ECR |
| **Dependency Scanning** | Daily | npm audit, Dependabot |
| **Infrastructure Scanning** | Weekly | AWS Inspector |
| **Penetration Testing** | Annual | Third-party vendor |

### 10.2 Patch Management

- **Critical Vulnerabilities**: Patched within 24-48 hours
- **High Vulnerabilities**: Patched within 7 days
- **Medium Vulnerabilities**: Patched within 30 days
- **Low Vulnerabilities**: Patched within 90 days

## 11. Third-Party Security

### 11.1 Vendor Assessment

All third-party vendors processing customer data must:
- Provide evidence of security certifications (SOC 2, ISO 27001)
- Sign data processing agreements
- Undergo security review before integration
- Be monitored for security incidents

### 11.2 Current Third-Party Services

| Vendor | Service | Certifications |
|--------|---------|----------------|
| **AWS** | Cloud Infrastructure | SOC 2, ISO 27001, FedRAMP |
| **Neon** | PostgreSQL Database | SOC 2 Type 2 |
| **OpenAI** | AI Analysis | SOC 2 |
| **Anthropic** | AI Analysis | SOC 2 |

## 12. Physical Security

EdSteward operates entirely in cloud infrastructure (AWS). Physical security is managed by AWS and covered under their compliance certifications:

- AWS data centers are SOC 2, ISO 27001, and FedRAMP certified
- Physical access to data centers requires multi-factor authentication
- 24/7 security monitoring and surveillance
- Environmental controls (fire suppression, climate control)

## 13. Personnel Security

### 13.1 Background Checks

- All employees undergo background verification
- Access to production systems requires additional verification
- Contractors bound by security agreements

### 13.2 Security Training

- **Onboarding**: Security awareness training within first week
- **Annual Training**: Mandatory security refresher for all staff
- **Role-Specific**: Secure coding training for developers
- **Phishing Awareness**: Regular simulated phishing exercises

### 13.3 Termination Procedures

- Access revoked immediately upon termination
- All company devices and credentials returned
- Exit interview includes security reminders
- Access audit performed post-termination

## 14. Compliance

### 14.1 Regulatory Requirements

EdSteward maintains compliance with:
- **FERPA**: Family Educational Rights and Privacy Act
- **HECVAT**: Higher Education Community Vendor Assessment Toolkit
- **GDPR**: General Data Protection Regulation (where applicable)
- **State Privacy Laws**: California, Virginia, Colorado, etc.

### 14.2 Audit Support

EdSteward provides:
- Annual SOC 2 Type 2 audit (planned)
- HECVAT questionnaire responses
- Security documentation upon request
- Customer audit cooperation

## 15. Policy Violations

### 15.1 Reporting

Security policy violations should be reported to:
- Email: security@edsteward.ai
- Internal: Security incident reporting system

### 15.2 Consequences

Violations may result in:
- Disciplinary action up to and including termination
- Access revocation
- Legal action where applicable

## 16. Policy Review and Updates

This policy is reviewed:
- Annually (mandatory)
- After significant security incidents
- When regulatory requirements change
- When infrastructure changes significantly

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | February 2026 | EdSteward Security | Initial policy creation |

---

**Approved By:** David Brandes, Founder & CEO  
**Date:** February 5, 2026
