# MCP Engine Demo Script

## Overview

**Duration:** 8-10 minutes  
**Audience:** Compliance officers, university administrators, EdTech buyers  
**URLs:**
- MCP Engine Console: `http://localhost:3050`
- EdSteward Client: `http://localhost:3000`

---

## Opening (30 seconds)

> "Today I'll show you how MCP Engine transforms regulatory compliance from a manual, error-prone process into an automated, auditable workflow."

---

## Act 1: The Regulation Console (2 min)

### Navigate to: `http://localhost:3050`

> "This is the MCP Engine dashboard. We currently have **241 federal and state regulations** loaded, each with compliance tasks, deadlines, and risk assessments."

### Click on Title IX (or search for it)

> "Let's look at Title IX. Notice:"

**Key points to highlight:**

| Feature | What to Show |
|---------|--------------|
| Task count | "52 compliance tasks organized hierarchically by category" |
| Statutory role | "Each task has a statutory role - who the law says must do this" |
| Legal citations | "Citations like '34 CFR 106.8' trace directly to federal code" |
| Priority & evidence | "Priority levels and evidence requirements for audit readiness" |

---

## Act 2: Push to Client Workflow (3 min)

### In MCP Engine Console:

1. Click **"Push to Selected Targets"**
2. Select **"Moravian Dev"**
3. Click **Send**

> "Here's where it gets powerful. When regulations change or we update compliance tasks, we don't just dump data into client systems. We use an **approval workflow**."

### Switch to EdSteward: `http://localhost:3000`

Navigate to **Regulation Updates**

> "The client's Chief Compliance Officer sees this pending update. They can:"

- Review what's changing
- See **pending tasks** that will replace existing ones
- **Approve, reject, or defer**

> "This creates an **audit trail** - we can prove the CCO reviewed and accepted these requirements."

---

## Act 3: Statutory Roles & Auto-Assignment (2 min)

### Show a task with statutory role in EdSteward

> "Notice this task says 'Required: **Title IX Coordinator** per **34 CFR 106.8**'"

> "This isn't a suggestion - it's a legal requirement. When approved:"

1. System looks up who's configured as Title IX Coordinator
2. **Auto-assigns** the task to that person
3. If someone else is assigned, system **warns** about the mismatch

> "This prevents the #1 compliance failure: tasks assigned to the wrong people."

### Standard Roles We Track

| Role | Citation |
|------|----------|
| Title IX Coordinator | 34 CFR 106.8 |
| Clery Compliance Officer | 34 CFR 668.46 |
| ADA/504 Coordinator | 34 CFR 104.7 |
| FERPA Compliance Officer | 34 CFR 99.7 |

---

## Act 4: New Tenant Provisioning (1 min)

### Show terminal (or describe):

```bash
# Preview what would be synced
node scripts/provision-tenant.js --customer=new-university --dry-run

# Actually provision a new tenant
node scripts/provision-tenant.js --customer=new-university
```

> "When a new institution onboards, one command provisions their entire compliance system:"

- All 241 regulations
- Thousands of compliance tasks  
- Properly categorized, hierarchical, with legal citations
- Ready for their CCO to review

---

## Closing (30 seconds)

> "MCP Engine solves three problems:"

| Problem | Solution |
|---------|----------|
| **Accuracy** | Tasks tied directly to CFR citations, not interpretations |
| **Accountability** | Statutory roles ensure the right person is responsible |
| **Auditability** | Every change approved by CCO with full history |

> "Questions?"

---

## Backup Talking Points

Use these if asked specific questions:

### Coverage
- 241 regulations (federal + state)
- Higher education focus: Title IX, FERPA, Clery, ADA, HIPAA, etc.
- State-specific: PA, NJ, NY regulations included

### Task Structure
- Hierarchical organization (sections → tasks)
- `requirementType`: Legal requirement vs. best practice
- Evidence requirements for audit documentation

### Integration
- REST API for any compliance system
- Real-time push notifications
- Bulk provisioning for new clients

### Risk Assessment
- Risk scores per regulation
- Enforcement trend tracking
- Prioritization for limited compliance resources

---

## Pre-Demo Checklist

- [ ] PM2 services running (`pm2 status`)
- [ ] MCP Engine Console loads at localhost:3050
- [ ] EdSteward loads at localhost:3000
- [ ] Title IX has 52 tasks with statutory roles
- [ ] Test push works (creates pending update in EdSteward)

### Quick Health Check

```bash
# Check all services
pm2 status

# Test MCP Engine API
curl -s http://localhost:3010/api/regulations | python3 -c "import json,sys; d=json.load(sys.stdin); print(f'{len(d)} regulations loaded')"

# Test EdSteward
curl -s http://localhost:3000/api/health
```

---

## Emergency Fixes

### Services not responding:
```bash
pm2 restart all
```

### Port conflict:
```bash
lsof -ti:3050 | xargs kill -9
pm2 restart frontend
```

### Database issue:
```bash
psql -d mcp_engine -c "SELECT COUNT(*) FROM regulations WHERE is_current = true;"
```
