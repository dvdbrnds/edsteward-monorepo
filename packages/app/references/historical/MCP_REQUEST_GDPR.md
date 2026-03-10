# MCP Engine Request: GDPR Regulation Package

**Priority:** HIGH  
**Requested By:** EdSteward Customer Team  
**Date:** January 7, 2026  
**Customer Impact:** All higher education institutions with international
presence

---

## Executive Summary

GDPR (General Data Protection Regulation) is **NOT currently in the EdSteward
regulation database**. This is a critical gap for higher education institutions
that:

- Recruit international students (especially from EU)
- Have study abroad programs in Europe
- Employ staff from EU countries
- Process any data of EU residents
- Have alumni in the EU

## What We Need from MCP Engine

### 1. Base Regulation Entry

```json
{
  "itemId": "REG-GDPR-2016-679",
  "name": "General Data Protection Regulation (GDPR)",
  "statute": "EU Regulation 2016/679",
  "category": "Information Technology",
  "jurisdictionSource": "international",
  "summary": "The GDPR is a comprehensive data protection law that applies to any organization processing personal data of EU residents, regardless of where the organization is located.",
  "requirements": "Detailed text of GDPR requirements...",
  "filingDeadlines": [
    {
      "type": "breach_notification",
      "date": "72 hours",
      "frequency": "per-incident",
      "description": "Data breach notification to supervisory authority within 72 hours"
    },
    {
      "type": "dsar_response",
      "date": "30 days",
      "frequency": "per-request",
      "description": "Respond to Data Subject Access Requests within 30 days"
    }
  ]
}
```

### 2. Compliance Task Templates (Critical!)

GDPR is complex and needs structured tasks. Higher education IT departments need
clear guidance:

#### Data Mapping & Inventory

- [ ] Create comprehensive data inventory of all EU resident data
- [ ] Document data flows (collection, processing, storage, sharing)
- [ ] Identify lawful basis for each processing activity
- [ ] Map third-party processors and sub-processors

#### Legal Basis & Consent

- [ ] Review and update privacy notices
- [ ] Implement consent management system
- [ ] Document legitimate interest assessments
- [ ] Review contracts with data processors

#### Data Subject Rights

- [ ] Implement DSAR (Data Subject Access Request) process
- [ ] Enable right to erasure ("right to be forgotten")
- [ ] Enable data portability mechanisms
- [ ] Document rectification procedures

#### Security & Breach Response

- [ ] Implement appropriate technical safeguards
- [ ] Create 72-hour breach notification procedure
- [ ] Maintain breach register
- [ ] Conduct regular security assessments

#### Governance

- [ ] Appoint Data Protection Officer (if required)
- [ ] Conduct Data Protection Impact Assessments (DPIAs)
- [ ] Maintain Records of Processing Activities (ROPA)
- [ ] Implement privacy by design in new systems

#### Training & Awareness

- [ ] Annual GDPR training for all staff handling EU data
- [ ] Specialized training for IT staff
- [ ] Document training completion records

### 3. Higher Education Specific Guidance

The MCP package should include guidance specific to universities:

| Data Type        | GDPR Consideration                              |
| ---------------- | ----------------------------------------------- |
| Student Records  | Lawful basis likely "public task" or "contract" |
| Recruitment Data | Requires explicit consent                       |
| Alumni Data      | Review retention periods, consent for marketing |
| Research Data    | Special category data rules apply               |
| Employee Data    | Employment contract basis, but limits apply     |
| Study Abroad     | International transfer safeguards needed        |

## Why This Matters

1. **Fines are significant**: Up to €20 million or 4% of annual global turnover
2. **Extraterritorial scope**: Applies to US universities processing EU data
3. **Student expectations**: International students expect GDPR compliance
4. **Reputational risk**: Data breaches damage institutional reputation
5. **Increasing enforcement**: EU regulators are actively enforcing

## Current Gap Analysis

| Regulation | In System? | Tasks?    | Priority |
| ---------- | ---------- | --------- | -------- |
| FERPA      | ✅ Yes     | ✅ Yes    | -        |
| COPPA      | ✅ Yes     | ❌ No     | Medium   |
| **GDPR**   | ❌ **NO**  | ❌ **NO** | **HIGH** |
| CCPA       | ❌ No      | ❌ No     | Medium   |
| HIPAA      | ❌ No      | ❌ No     | Medium   |

## Delivery Format

Please deliver via the existing MCP integration endpoint:

```
POST /api/regulation-updates
Authorization: Basic dvdbrnds:[REDACTED]
Content-Type: application/json

{
  "regulationId": "REG-GDPR-2016-679",
  "name": "General Data Protection Regulation (GDPR)",
  // ... full regulation data
  "complianceTasks": [
    // ... structured task templates
  ]
}
```

## Timeline Request

- **ASAP**: Base GDPR regulation entry
- **Within 2 weeks**: Full compliance task templates
- **Ongoing**: Updates as EU guidance evolves

---

## Contact

For questions about this request or EdSteward integration specifics, refer to:

- `MCP_ENGINE_INTEGRATION_RESPONSE.md`
- `MCP_ENGINE_COMPLIANCE_TASKS_RESPONSE.md`

**This is a customer-facing gap that needs immediate attention.**
