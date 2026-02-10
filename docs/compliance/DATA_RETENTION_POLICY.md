# EdSteward Data Retention and Disposal Policy

**Document Version:** 1.0  
**Effective Date:** February 2026  
**Last Reviewed:** February 5, 2026  
**Next Review Date:** February 2027  
**Document Owner:** EdSteward Security Team  

---

## 1. Purpose

This policy establishes guidelines for the retention, archival, and secure disposal of data within EdSteward systems. It ensures compliance with regulatory requirements (FERPA, GDPR, state privacy laws) and HECVAT standards while supporting customer needs for data portability and deletion.

## 2. Scope

This policy applies to:
- All data stored in EdSteward production systems
- Customer (tenant) data including PII and compliance records
- System logs and audit trails
- Backup data and archives
- Development and test environment data

## 3. Data Categories and Retention Periods

### 3.1 Customer Account Data

| Data Type | Description | Retention Period | Disposal Method |
|-----------|-------------|------------------|-----------------|
| **User Profiles** | Names, emails, roles | Active account + 30 days | Secure deletion |
| **Authentication Data** | Password hashes, MFA secrets | Active account + 30 days | Secure deletion |
| **Session Data** | Login sessions, tokens | 24 hours after expiry | Automatic purge |

### 3.2 Compliance Data

| Data Type | Description | Retention Period | Disposal Method |
|-----------|-------------|------------------|-----------------|
| **Regulations** | Compliance requirements | Customer retention + 7 years | Customer-controlled export/delete |
| **Compliance Tasks** | Task assignments, deadlines | Customer retention + 7 years | Customer-controlled |
| **Attestations** | Compliance certifications | Customer retention + 7 years | Customer-controlled |
| **Evidence Files** | Uploaded documents | Customer retention + 7 years | Secure deletion |

### 3.3 Audit and Security Logs

| Data Type | Description | Retention Period | Disposal Method |
|-----------|-------------|------------------|-----------------|
| **Audit Logs** | User actions, compliance changes | 7 years | Automated purge |
| **Application Logs** | System events, errors | 90 days | Automated purge |
| **Access Logs** | Authentication events | 1 year | Automated purge |
| **Security Logs** | Security events, alerts | 1 year | Automated purge |

### 3.4 System and Infrastructure Data

| Data Type | Description | Retention Period | Disposal Method |
|-----------|-------------|------------------|-----------------|
| **CloudWatch Logs** | Container and application logs | 90 days | AWS automatic deletion |
| **Database Backups** | PostgreSQL snapshots | 30 days | Automated rotation |
| **Container Images** | Application images | 90 days (non-production) | ECR lifecycle policy |
| **Terraform State** | Infrastructure state | Indefinite (versioned) | Manual review |

### 3.5 Development and Test Data

| Data Type | Description | Retention Period | Disposal Method |
|-----------|-------------|------------------|-----------------|
| **Test Databases** | Development/staging data | 30 days after project | Secure deletion |
| **Demo Accounts** | Sales demonstration data | 90 days after demo | Secure deletion |
| **Debug Logs** | Development debugging | 7 days | Automatic purge |

## 4. Retention Schedule Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                    DATA RETENTION TIMELINE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Session Data        ████ 24 hours                              │
│  Debug Logs          ████ 7 days                                │
│  Test Data           ████████ 30 days                           │
│  Database Backups    ████████ 30 days                           │
│  Application Logs    ████████████████████ 90 days               │
│  Access Logs         ████████████████████████████████ 1 year    │
│  Security Logs       ████████████████████████████████ 1 year    │
│  Audit Logs          █████████████████████████████████████ 7 yrs│
│  Compliance Data     █████████████████████████████████████ 7 yrs│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 5. Customer Data Rights

### 5.1 Data Portability

Customers have the right to export their data at any time:

**Available Export Formats:**
- Audit trail: CSV export
- Regulations: JSON/CSV export
- Evidence files: Original format + ZIP archive
- Full data export: Complete tenant data package

**Export Request Process:**
1. Customer requests export via admin interface or support
2. System generates export package
3. Export available for download (encrypted)
4. Download link expires after 7 days

### 5.2 Data Deletion Rights

Customers can request deletion of their data:

**Deletion Scope Options:**
- Individual user accounts
- Specific regulations and associated data
- All tenant data (account termination)

**Deletion Process:**
1. Customer submits deletion request
2. Verification of authorization
3. Grace period (30 days) for recovery
4. Permanent deletion executed
5. Deletion confirmation provided

### 5.3 Account Termination

Upon contract termination or customer request:

| Phase | Timeline | Action |
|-------|----------|--------|
| **Notice** | Day 0 | Termination request received |
| **Export** | Days 1-14 | Data export available to customer |
| **Grace Period** | Days 15-44 | Data retained for recovery |
| **Deletion** | Day 45 | All customer data permanently deleted |
| **Confirmation** | Day 46+ | Deletion certificate provided |

## 6. Data Disposal Methods

### 6.1 Secure Deletion Standards

| Data Location | Disposal Method | Verification |
|---------------|-----------------|--------------|
| **PostgreSQL** | `TRUNCATE` with `RESTART IDENTITY`, followed by `VACUUM FULL` | Query confirmation |
| **File Storage** | Secure delete with overwrite | File system verification |
| **Backups** | Natural expiration per retention policy | Backup audit |
| **Logs** | CloudWatch automatic deletion | Retention policy verification |
| **Memory** | Container termination | Process termination |

### 6.2 Disposal Procedures

#### 6.2.1 Database Records

```sql
-- Soft delete first (allows recovery during grace period)
UPDATE users SET deleted_at = NOW() WHERE tenant_id = :tenant_id;

-- After grace period: permanent deletion
DELETE FROM audit_logs WHERE tenant_id = :tenant_id;
DELETE FROM evidence_files WHERE tenant_id = :tenant_id;
DELETE FROM compliance_tasks WHERE tenant_id = :tenant_id;
DELETE FROM regulations WHERE tenant_id = :tenant_id;
DELETE FROM users WHERE tenant_id = :tenant_id;

-- Vacuum to reclaim space
VACUUM FULL;
```

#### 6.2.2 File Storage

```bash
# Secure file deletion with overwrite
shred -vfz -n 3 /uploads/tenant_${TENANT_ID}/*
rm -rf /uploads/tenant_${TENANT_ID}

# S3 objects (if used)
aws s3 rm s3://bucket/tenant_${TENANT_ID}/ --recursive
```

#### 6.2.3 Backup Data

- Backups automatically rotate per retention schedule
- For immediate purge: manual deletion from backup system
- Cross-region replicas included in deletion scope

### 6.3 Deletion Verification

After deletion, verify:
- [ ] No records exist for tenant in production database
- [ ] No files remain in tenant upload directory
- [ ] No tenant references in active logs (outside retention)
- [ ] Backups containing tenant data have rotated
- [ ] Cache entries cleared

## 7. Legal Holds

### 7.1 Legal Hold Process

When litigation or regulatory investigation requires data preservation:

1. **Legal Hold Notice**: Received from legal counsel
2. **Scope Identification**: Determine affected data
3. **Suspension**: Pause automatic deletion for affected data
4. **Preservation**: Data protected from modification/deletion
5. **Documentation**: Log all preservation actions
6. **Release**: Upon legal hold release, resume normal retention

### 7.2 Legal Hold Documentation

Maintain records of:
- Date legal hold initiated
- Scope of data affected
- Custodians notified
- Preservation actions taken
- Date legal hold released

## 8. Implementation

### 8.1 Automated Retention Jobs

EdSteward implements automated data lifecycle management:

```typescript
// Scheduled retention jobs (run daily)
const retentionJobs = {
  // Purge expired sessions (24 hours)
  purgeExpiredSessions: '0 0 * * *',
  
  // Purge old application logs (90 days)
  purgeApplicationLogs: '0 1 * * *',
  
  // Purge access logs (1 year)
  purgeAccessLogs: '0 2 * * *',
  
  // Archive and purge audit logs (7 years)
  archiveAuditLogs: '0 3 * * 0', // Weekly
  
  // Cleanup soft-deleted data past grace period
  purgeDeletedData: '0 4 * * *',
};
```

### 8.2 Database Retention Implementation

```sql
-- Table for tracking deletion requests
CREATE TABLE data_deletion_requests (
  id SERIAL PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL,
  request_type VARCHAR(50) NOT NULL, -- 'user', 'regulation', 'full_tenant'
  entity_id INTEGER,
  requested_by INTEGER REFERENCES users(id),
  requested_at TIMESTAMP DEFAULT NOW(),
  grace_period_ends TIMESTAMP,
  deleted_at TIMESTAMP,
  deletion_confirmed BOOLEAN DEFAULT FALSE,
  confirmation_sent_at TIMESTAMP
);

-- Index for efficient retention queries
CREATE INDEX idx_deletion_grace_period ON data_deletion_requests(grace_period_ends) 
  WHERE deleted_at IS NULL;
```

### 8.3 CloudWatch Log Retention

Update Terraform configuration for 90-day retention:

```hcl
resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/aws/ecs/${var.project_name}"
  retention_in_days = 90  # Updated from 7 days
  tags = local.common_tags
}

resource "aws_cloudwatch_log_group" "audit" {
  name              = "/aws/ecs/${var.project_name}/audit"
  retention_in_days = 2557  # 7 years for audit logs
  tags = local.common_tags
}
```

## 9. Exceptions

### 9.1 Extended Retention

Data may be retained beyond standard periods for:
- Active legal holds
- Ongoing security investigations
- Regulatory requirements (documented)
- Customer contract requirements (documented)

### 9.2 Early Deletion

Data may be deleted before retention period expires:
- Upon verified customer request
- In response to valid legal order
- For security incident remediation (with documentation)

## 10. Compliance Mapping

### 10.1 HECVAT Requirements

| HECVAT Question | Policy Section | Compliance |
|-----------------|----------------|------------|
| Data retention periods defined | Section 3 | ✅ |
| Secure disposal methods | Section 6 | ✅ |
| Customer data deletion rights | Section 5 | ✅ |
| Audit log retention | Section 3.3 | ✅ |

### 10.2 FERPA Requirements

- Student education records retained per institutional requirements
- Customers control retention of their compliance data
- Deletion available upon institutional request

### 10.3 GDPR Requirements (where applicable)

- Data minimization principles applied
- Right to erasure supported (Section 5.2)
- Data portability enabled (Section 5.1)
- Retention periods documented and enforced

## 11. Monitoring and Auditing

### 11.1 Retention Compliance Monitoring

| Check | Frequency | Owner |
|-------|-----------|-------|
| Automated job execution | Daily | DevOps |
| Data age analysis | Weekly | Security |
| Deletion request processing | Weekly | Support |
| Backup rotation verification | Monthly | DevOps |
| Policy compliance audit | Quarterly | Security |

### 11.2 Metrics

- Number of records past retention period
- Average deletion request processing time
- Backup rotation compliance rate
- Storage utilization trends

## 12. Roles and Responsibilities

| Role | Responsibility |
|------|----------------|
| **Security Team** | Policy ownership, compliance monitoring |
| **DevOps** | Automated job maintenance, infrastructure |
| **Support** | Customer deletion request processing |
| **Legal** | Legal hold management, regulatory guidance |
| **Engineering** | Retention feature implementation |

---

## Appendix A: Retention Quick Reference

```
┌────────────────────────────────────────────────────────────┐
│              DATA RETENTION QUICK REFERENCE                 │
├────────────────────────────────────────────────────────────┤
│ SESSION DATA           │  24 hours after expiry            │
│ DEBUG LOGS             │  7 days                           │
│ DATABASE BACKUPS       │  30 days (rolling)                │
│ APPLICATION LOGS       │  90 days                          │
│ ACCESS/SECURITY LOGS   │  1 year                           │
│ AUDIT LOGS             │  7 years                          │
│ CUSTOMER COMPLIANCE    │  Customer control + 7 years       │
├────────────────────────────────────────────────────────────┤
│ DELETION GRACE PERIOD  │  30 days                          │
│ EXPORT AVAILABILITY    │  14 days                          │
└────────────────────────────────────────────────────────────┘
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | February 2026 | EdSteward Security | Initial policy creation |

---

**Approved By:** David Brandes, Founder & CEO  
**Date:** February 5, 2026
