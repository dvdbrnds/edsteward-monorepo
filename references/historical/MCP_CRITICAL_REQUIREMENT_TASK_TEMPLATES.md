# 🚨 CRITICAL MCP Engine Requirement: Compliance Task Templates

**Date:** January 6, 2026  
**Priority:** CRITICAL  
**Status:** BLOCKING for full production readiness

---

## The Problem

EdSteward currently has **355 regulations** but only **3 have compliance task templates**:

| Regulation | Tasks | Source |
|------------|-------|--------|
| Clery Act | 42 | Manual template |
| Title IX | 36 | Manual template |
| FERPA | 23 | Manual template |
| **Other 352 regulations** | **0** | ❌ **MISSING** |

**Without task templates, users can only attest to compliance - they cannot track the actual work required.**

---

## What MCP Engine Must Provide

For each regulation that requires more than attestation, MCP Engine should deliver structured compliance tasks:

### Required Data Structure

```json
{
  "regulationId": 123,
  "regulationName": "Americans with Disabilities Act (ADA)",
  "complianceTasks": [
    {
      "tempId": "ada-coordinator",
      "title": "ADA Coordinator Designation",
      "description": "Designate an ADA/504 Coordinator for the institution",
      "assignedRole": "President",
      "priority": "critical",
      "evidenceRequired": true,
      "evidenceType": "document",
      "dueDate": null,
      "children": [
        {
          "tempId": "ada-coordinator-appoint",
          "parentTempId": "ada-coordinator",
          "title": "Formally Appoint ADA Coordinator",
          "description": "Issue formal appointment letter",
          "assignedRole": "President",
          "priority": "critical",
          "evidenceRequired": true,
          "evidenceType": "document"
        },
        {
          "tempId": "ada-coordinator-publish",
          "parentTempId": "ada-coordinator",
          "title": "Publish Contact Information",
          "description": "Post coordinator info on website and in handbooks",
          "assignedRole": "Web Communications",
          "priority": "high",
          "evidenceRequired": true,
          "evidenceType": "link"
        }
      ]
    }
  ]
}
```

### Required Fields per Task

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `tempId` | string | ✅ | Unique template identifier |
| `parentTempId` | string | ❌ | Parent task reference for hierarchy |
| `title` | string | ✅ | Task title (max 200 chars) |
| `description` | string | ✅ | What needs to be done |
| `assignedRole` | string | ✅ | Default role responsible |
| `priority` | enum | ✅ | `low`, `medium`, `high`, `critical` |
| `evidenceRequired` | boolean | ✅ | Whether evidence upload needed |
| `evidenceType` | enum | ✅ | `none`, `document`, `link`, `screenshot`, `attestation`, `form` |
| `evidenceInstructions` | string | ❌ | Guidance on what evidence to provide |
| `dueDate` | string | ❌ | Relative date like "October 1" or ISO date |
| `recurringSchedule` | string | ❌ | `annual`, `quarterly`, `monthly`, etc. |

---

## Regulations Needing Task Templates (Priority Order)

### Tier 1: Critical (Must Have)
These regulations have significant compliance requirements with multiple deadlines:

1. **HIPAA** - Health Insurance Portability and Accountability Act
2. **ADA/Section 504** - Disability accommodations
3. **GLBA** - Gramm-Leach-Bliley Act (financial data)
4. **HEOA** - Higher Education Opportunity Act
5. **Drug-Free Schools and Communities Act**
6. **Solomon Amendment** - Military recruiter access
7. **Campus SaVE Act** - Sexual violence prevention

### Tier 2: High Priority
8. **VAWA** - Violence Against Women Act (some overlap with Clery)
9. **Family Medical Leave Act**
10. **OSHA** - Workplace safety
11. **FLSA** - Fair Labor Standards Act
12. **Copyright/DMCA** compliance
13. **State-specific reporting** (varies by state)

### Tier 3: Important
14. **EEOC/Title VII** - Employment discrimination
15. **Age Discrimination Act**
16. **Immigration Reform and Control Act**
17. **Export Control (ITAR/EAR)**
18. **PCI-DSS** (if handling payments)
19. **GDPR** (if applicable)

---

## API Endpoint for Task Delivery

EdSteward is ready to receive task templates via:

### Endpoint
```
POST /api/regulation-updates
Authorization: Basic dvdbrnds:gabadh
Content-Type: application/json
```

### Payload Format
```json
{
  "regulationId": 123,
  "name": "Americans with Disabilities Act",
  "summary": "...",
  "requirements": "...",
  "complianceTasks": [
    { /* task structure as above */ }
  ]
}
```

### Alternative: Bulk Template Endpoint
```
POST /api/compliance-tasks/bulk
Authorization: Bearer <user-token>
Content-Type: application/json

{
  "regulationId": 123,
  "tasks": [...]
}
```

---

## Impact Without Task Templates

| Without Tasks | With Tasks |
|---------------|------------|
| User can only attest "we comply" | User tracks specific actions |
| No visibility into compliance work | Clear checklist with progress |
| No deadline management | Automated reminders |
| Audit = "trust me" | Audit = documented evidence trail |
| Reactive compliance | Proactive compliance |

---

## Timeline Request

| Milestone | Target Date |
|-----------|-------------|
| Task schema finalized | Immediate |
| Tier 1 regulations (7 regs) | Week 1 |
| Tier 2 regulations (6 regs) | Week 2 |
| Tier 3 regulations (6 regs) | Week 3 |
| Full catalog (~50 complex regs) | Month 1 |

---

## Questions for MCP Team

1. **Data Source**: Where will task templates come from? Legal research? Regulatory guidance?
2. **Maintenance**: How will tasks be updated when regulations change?
3. **Institution Types**: Do task templates vary by institution type (4-year, 2-year, vocational)?
4. **State Variations**: How will state-specific requirements be handled?

---

## Contact

For EdSteward integration questions:
- **API Documentation**: `MCP_ENGINE_INTEGRATION_RESPONSE.md`
- **Task Schema Details**: `MCP_ENGINE_COMPLIANCE_TASKS_RESPONSE.md`
- **Current Templates**: `server/templates/` directory

---

**This is CRITICAL for production readiness. Without comprehensive task templates, EdSteward is a fancy attestation system, not a true compliance management platform.**

