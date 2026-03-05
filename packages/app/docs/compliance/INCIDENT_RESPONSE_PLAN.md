# EdSteward Incident Response Plan

**Document Version:** 1.0  
**Effective Date:** February 2026  
**Last Reviewed:** February 5, 2026  
**Next Review Date:** August 2026  
**Document Owner:** EdSteward Security Team  

---

## 1. Purpose

This Incident Response Plan (IRP) establishes procedures for detecting, responding to, and recovering from security incidents affecting EdSteward systems and customer data. This plan ensures rapid, coordinated response to minimize impact and meet regulatory notification requirements, including HECVAT compliance and FERPA breach notification obligations.

## 2. Scope

This plan covers:
- Security incidents affecting EdSteward production systems
- Data breaches involving customer (tenant) data
- Service availability incidents
- Unauthorized access attempts
- Malware or ransomware incidents
- Third-party vendor security incidents

## 3. Incident Classification

### 3.1 Severity Levels

| Severity | Description | Examples | Response Time |
|----------|-------------|----------|---------------|
| **Critical (P1)** | Active breach, data exfiltration, or complete service outage | Confirmed data breach, ransomware, production down | Immediate (< 15 min) |
| **High (P2)** | Potential breach, significant service degradation | Unauthorized access attempt, partial outage | < 1 hour |
| **Medium (P3)** | Security vulnerability, minor service impact | Vulnerability discovered, suspicious activity | < 4 hours |
| **Low (P4)** | Security improvement needed, no immediate threat | Policy violation, configuration issue | < 24 hours |

### 3.2 Incident Categories

| Category | Description |
|----------|-------------|
| **Data Breach** | Unauthorized access to or exfiltration of customer data |
| **System Compromise** | Unauthorized access to systems or infrastructure |
| **Availability** | Service disruption or denial of service |
| **Malware** | Malicious software detected in systems |
| **Insider Threat** | Malicious or negligent actions by authorized users |
| **Third-Party** | Security incident at a vendor affecting EdSteward |

## 4. Incident Response Team

### 4.1 Team Structure

| Role | Primary | Backup | Responsibilities |
|------|---------|--------|------------------|
| **Incident Commander** | David Brandes | - | Overall incident leadership, decision authority |
| **Security Lead** | David Brandes | - | Technical investigation, containment |
| **Communications Lead** | David Brandes | - | Customer/stakeholder communications |
| **Technical Lead** | David Brandes | - | System recovery, technical remediation |
| **Legal/Compliance** | External Counsel (as needed) | David Brandes | Legal requirements, regulatory notifications |

### 4.2 Contact Information

**Internal Escalation:**
- Primary Contact: David Brandes - support@edsteward.ai
- Emergency: david@edsteward.ai

**External Contacts:**
- AWS Support: https://console.aws.amazon.com/support/
- Neon Database Support: https://neon.tech/docs/introduction/support
- Legal Counsel: Engage as needed for incidents
- Cyber Insurance: Engage carrier if applicable

## 5. Incident Response Phases

### Phase 1: Detection & Identification

#### 5.1.1 Detection Sources

| Source | Monitoring Method |
|--------|-------------------|
| **CloudWatch Alerts** | Automated metrics and log alerts |
| **Audit Logs** | Suspicious activity patterns |
| **Customer Reports** | Support tickets, direct reports |
| **Vulnerability Scanners** | ECR, npm audit, AWS Inspector |
| **Third-Party Notifications** | Vendor security advisories |
| **External Reports** | Security researchers, bug bounty |

#### 5.1.2 Initial Assessment Checklist

```markdown
[ ] What systems/data are potentially affected?
[ ] Is the incident ongoing or contained?
[ ] What is the potential business/customer impact?
[ ] What severity level applies?
[ ] Who needs to be notified immediately?
[ ] Is this a reportable data breach?
```

#### 5.1.3 Incident Ticket Creation

All incidents must be documented in the incident tracking system with:
- Date/time of detection
- Detection source
- Initial severity classification
- Affected systems/tenants
- Initial responder assigned

### Phase 2: Containment

#### 5.2.1 Short-Term Containment

**Immediate Actions (within 15 minutes for P1):**

| Scenario | Containment Action |
|----------|-------------------|
| **Compromised Credentials** | Revoke sessions, reset credentials, enable MFA |
| **Unauthorized Access** | Block IP/user, isolate affected tenant |
| **Malware Detected** | Isolate container, deploy clean image |
| **Data Exfiltration** | Block egress, preserve logs |
| **DDoS Attack** | Enable WAF rules, scale infrastructure |

#### 5.2.2 Evidence Preservation

**Critical: Preserve all evidence before remediation**

```bash
# CloudWatch logs - extend retention immediately
aws logs put-retention-policy --log-group-name /aws/ecs/edsteward --retention-in-days 365

# Database audit logs - snapshot affected tenant databases
# AWS ECS task logs - export before container termination
# Network flow logs - ensure capture is enabled
```

Evidence to preserve:
- [ ] Application logs (CloudWatch)
- [ ] Database audit logs
- [ ] Network flow logs
- [ ] Container images (affected versions)
- [ ] Database snapshots
- [ ] User session data

#### 5.2.3 Long-Term Containment

- Deploy patched systems in parallel
- Implement additional monitoring
- Prepare for full remediation
- Maintain business operations where safe

### Phase 3: Eradication

#### 5.3.1 Root Cause Analysis

Document answers to:
1. How did the attacker gain access?
2. What vulnerabilities were exploited?
3. How long was the attacker present?
4. What data was accessed/exfiltrated?
5. Are there any backdoors or persistence mechanisms?

#### 5.3.2 Remediation Actions

| Issue Type | Remediation |
|------------|-------------|
| **Vulnerability** | Patch, deploy updated containers |
| **Compromised Credentials** | Rotate all potentially affected credentials |
| **Configuration Error** | Correct configuration, add validation |
| **Malware** | Clean rebuild from known-good images |
| **Third-Party Compromise** | Rotate API keys, assess vendor |

### Phase 4: Recovery

#### 5.4.1 System Restoration

```markdown
Recovery Checklist:
[ ] Verify remediation is complete
[ ] Restore from clean backups if needed
[ ] Validate system integrity
[ ] Re-enable disabled services gradually
[ ] Implement enhanced monitoring
[ ] Verify all customers can access systems
[ ] Confirm no data loss or corruption
```

#### 5.4.2 Validation Testing

- Run security scans on restored systems
- Verify audit logging is operational
- Test authentication flows
- Confirm tenant isolation is intact
- Validate data integrity

### Phase 5: Post-Incident Activities

#### 5.5.1 Post-Incident Review (PIR)

**Timeline:** Within 5 business days of incident closure

**PIR Agenda:**
1. Incident timeline reconstruction
2. What went well?
3. What could be improved?
4. Root cause confirmation
5. Action items for prevention

#### 5.5.2 Documentation Requirements

| Document | Owner | Timeline |
|----------|-------|----------|
| Incident Report | Security Lead | Within 72 hours |
| Root Cause Analysis | Technical Lead | Within 5 days |
| Customer Communication | Communications Lead | As needed |
| Regulatory Notifications | Legal/Compliance | Per requirements |

## 6. Communication Procedures

### 6.1 Internal Communication

| Severity | Notification | Channel |
|----------|--------------|---------|
| **Critical** | Executive team, all responders | Phone/SMS immediately |
| **High** | Security team, affected team leads | Slack + email |
| **Medium** | Security team | Slack |
| **Low** | Security team | Email/ticket |

### 6.2 Customer Communication

#### 6.2.1 Notification Triggers

Customer notification is **REQUIRED** when:
- Customer data was accessed without authorization
- Service outage exceeds SLA thresholds
- Security vulnerability may affect customer data
- Regulatory notification is required

#### 6.2.2 Communication Templates

**Initial Notification (within 24 hours of confirmed breach):**

```
Subject: Security Incident Notification - EdSteward

Dear [Customer Name],

We are writing to inform you of a security incident that may have 
affected your EdSteward account.

What Happened:
[Brief description of incident]

What Information Was Involved:
[Types of data potentially affected]

What We Are Doing:
[Actions taken to address the incident]

What You Can Do:
[Recommended customer actions]

We take the security of your data seriously and are committed to 
transparency. We will provide updates as our investigation progresses.

Contact: security@edsteward.ai
```

**Status Update Template:**

```
Subject: Security Incident Update - EdSteward

Dear [Customer Name],

This is an update regarding the security incident we notified you 
about on [date].

Investigation Status:
[Current status]

Additional Findings:
[Any new information]

Next Steps:
[What happens next]

Contact: security@edsteward.ai
```

### 6.3 Regulatory Notifications

#### 6.3.1 FERPA Requirements

For incidents involving student education records:
- Notify affected educational institutions
- Institutions responsible for notifying students/parents
- Document notification in incident record

#### 6.3.2 State Breach Notification Laws

| Requirement | Timeline |
|-------------|----------|
| **California (CCPA)** | 72 hours to AG if >500 residents |
| **GDPR (if applicable)** | 72 hours to supervisory authority |
| **Most US States** | "Without unreasonable delay" (typically 30-60 days) |

#### 6.3.3 Notification Decision Tree

```
Is customer data involved? 
├── No → Document, no external notification required
└── Yes → Was data accessed/exfiltrated?
    ├── No → Document, consider proactive notification
    └── Yes → Notification REQUIRED
        ├── Identify affected customers
        ├── Determine regulatory requirements
        ├── Prepare notifications (Legal review)
        └── Send within required timeframes
```

## 7. Specific Incident Playbooks

### 7.1 Playbook: Suspected Data Breach

```markdown
IMMEDIATE (0-15 minutes):
1. [ ] Alert Incident Commander
2. [ ] Identify affected tenant(s)
3. [ ] Preserve all logs and evidence
4. [ ] Assess scope: what data, how many records?

CONTAINMENT (15-60 minutes):
5. [ ] Isolate affected systems/accounts
6. [ ] Block attacker access (IP, credentials)
7. [ ] Snapshot affected databases
8. [ ] Enable enhanced logging

INVESTIGATION (1-24 hours):
9. [ ] Analyze logs for access patterns
10. [ ] Determine data accessed/exfiltrated
11. [ ] Identify attack vector
12. [ ] Document timeline

NOTIFICATION (24-72 hours):
13. [ ] Legal review of notification requirements
14. [ ] Prepare customer notifications
15. [ ] Notify affected customers
16. [ ] File regulatory notifications if required

REMEDIATION:
17. [ ] Patch vulnerability
18. [ ] Implement additional controls
19. [ ] Conduct post-incident review
```

### 7.2 Playbook: Ransomware/Malware

```markdown
IMMEDIATE:
1. [ ] Isolate affected containers
2. [ ] Do NOT pay ransom
3. [ ] Preserve system state for forensics
4. [ ] Alert all team members

CONTAINMENT:
5. [ ] Identify infection vector
6. [ ] Check for lateral movement
7. [ ] Verify backup integrity

RECOVERY:
8. [ ] Rebuild from clean images
9. [ ] Restore data from backups
10. [ ] Validate system integrity
11. [ ] Enhanced monitoring
```

### 7.3 Playbook: Unauthorized Access Attempt

```markdown
ASSESSMENT:
1. [ ] Was access successful?
2. [ ] What credentials/vectors were used?
3. [ ] What systems were targeted?

IF UNSUCCESSFUL:
4. [ ] Block source IP
5. [ ] Monitor for repeat attempts
6. [ ] Review account security

IF SUCCESSFUL:
7. [ ] Treat as potential data breach
8. [ ] Follow Data Breach playbook
```

### 7.4 Playbook: Service Outage

```markdown
IMMEDIATE:
1. [ ] Confirm outage scope
2. [ ] Check AWS status page
3. [ ] Identify root cause

COMMUNICATION:
4. [ ] Update status page
5. [ ] Notify affected customers
6. [ ] Provide ETA if known

RESOLUTION:
7. [ ] Implement fix/failover
8. [ ] Verify service restoration
9. [ ] Post-mortem analysis
```

## 8. Testing and Maintenance

### 8.1 Plan Testing

| Test Type | Frequency | Description |
|-----------|-----------|-------------|
| **Tabletop Exercise** | Quarterly | Walk through scenarios with team |
| **Technical Drill** | Semi-annually | Simulated incident response |
| **Full Simulation** | Annually | End-to-end incident test |

### 8.2 Plan Maintenance

- Review after every P1/P2 incident
- Update contact information monthly
- Annual comprehensive review
- Update for infrastructure changes

## 9. Metrics and Reporting

### 9.1 Key Metrics

| Metric | Target |
|--------|--------|
| **Mean Time to Detect (MTTD)** | < 1 hour |
| **Mean Time to Respond (MTTR)** | < 4 hours |
| **Mean Time to Recover** | < 24 hours (P1), < 48 hours (P2) |
| **Customer Notification Time** | < 72 hours |

### 9.2 Reporting Requirements

- Monthly security metrics to leadership
- Quarterly incident summary
- Annual security report
- Incident-specific reports as needed

## 10. Legal Considerations

### 10.1 Privilege Preservation

- Engage legal counsel early in significant incidents
- Label communications as "Attorney-Client Privileged" when appropriate
- Document investigation through legal team when possible

### 10.2 Law Enforcement

- Consult legal counsel before engaging law enforcement
- Preserve evidence according to legal hold procedures
- Cooperate with legitimate law enforcement requests

---

## Appendix A: Quick Reference Card

```
┌─────────────────────────────────────────────────────────┐
│           EDSTEWARD INCIDENT RESPONSE                   │
├─────────────────────────────────────────────────────────┤
│ REPORT INCIDENTS: security@edsteward.ai                 │
│ ON-CALL: [PagerDuty Number]                             │
├─────────────────────────────────────────────────────────┤
│ SEVERITY LEVELS:                                        │
│   P1 (Critical) - Respond in 15 min                     │
│   P2 (High)     - Respond in 1 hour                     │
│   P3 (Medium)   - Respond in 4 hours                    │
│   P4 (Low)      - Respond in 24 hours                   │
├─────────────────────────────────────────────────────────┤
│ FIRST RESPONDER ACTIONS:                                │
│   1. Assess severity                                    │
│   2. Preserve evidence (DON'T delete logs!)             │
│   3. Contain the threat                                 │
│   4. Escalate per severity                              │
│   5. Document everything                                │
└─────────────────────────────────────────────────────────┘
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | February 2026 | EdSteward Security | Initial plan creation |

---

**Approved By:** David Brandes, Founder & CEO  
**Date:** February 5, 2026
