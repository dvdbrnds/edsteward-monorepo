# Gold Standard Certification Protocol

## Overview
This protocol defines the process for certifying a regulation console as "Gold Standard" - the highest level of data quality and completeness in the MCP Engine.

## Certification Criteria

### 1. Data Completeness Checklist
- [ ] **Summary**: Clear, authoritative description of the regulation
- [ ] **Requirements**: Explicit list of what institutions must do
- [ ] **Regulation Text**: Legal citation and key provisions
- [ ] **Reporting Requirements**: What must be reported, to whom, when
- [ ] **Source URL**: Link to authoritative source (USC, CFR, etc.)
- [ ] **Agency Information**: Enforcing agency name, contact, URL

### 2. Compliance Tasks (Minimum Categories)
Each regulation should have tasks in these categories as applicable:

| Category | Description | Example |
|----------|-------------|---------|
| `policy` | Written policies that must exist | Privacy Policy, Title IX Policy |
| `documentation` | Records that must be maintained | Disclosure logs, training records |
| `training` | Required staff/student training | Annual FERPA training |
| `notification` | Required notices to students/staff | Annual rights notification |
| `reporting` | External reporting requirements | Annual Security Report |
| `assessment` | Required reviews/audits | Privacy impact assessment |
| `technical` | System/technology requirements | Access controls, encryption |
| `governance` | Organizational requirements | Designate coordinator |
| `response` | Incident response procedures | Complaint handling, investigations |

### 3. Deadlines
- All recurring deadlines with month/day
- Penalty information where known
- Reporting destination (agency/office)

### 4. Task Structure
Each task should have:
- Clear, actionable title
- Description of what must be done
- Priority level (CRITICAL, HIGH, MEDIUM, LOW)
- Assigned role (who is responsible)
- Category

## Certification Workflow

### Step 1: Research
1. Identify primary source (USC, CFR, state statute)
2. Review Department of Education guidance (if federal)
3. Check recent enforcement actions/settlements
4. Review institution-facing compliance guides

### Step 2: Data Population
1. Update regulation record with complete fields
2. Create comprehensive task list (15-50 tasks typical)
3. Create deadline records with full details
4. Verify all source citations

### Step 3: Validation
1. Run LOVV validation (should achieve Level A)
2. Cross-reference with peer institutions' compliance programs
3. Review by compliance SME if available

### Step 4: Certification
1. Create console version snapshot
2. Mark as `gold` status in console_versions table
3. Document certification date and certifier

## FERPA-Specific Requirements

### Key Compliance Areas (34 CFR Part 99)

1. **Annual Notification** (§99.7)
   - Notify students of FERPA rights annually
   - Include: right to inspect, right to amend, consent requirements, directory info opt-out

2. **Access Rights** (§99.10-99.12)
   - 45-day response window for record requests
   - Cannot charge for search/retrieval
   - Must provide copies if student can't inspect in person

3. **Amendment Process** (§99.20-99.22)
   - Process for students to request amendments
   - Hearing procedures if request denied
   - Statement of disagreement option

4. **Consent Requirements** (§99.30-99.31)
   - Prior written consent for disclosures
   - Consent must specify records, purpose, recipient

5. **Directory Information** (§99.37)
   - Define what constitutes directory info
   - Allow students to opt-out
   - Notify before disclosure

6. **Record of Disclosures** (§99.32)
   - Maintain log of each disclosure
   - Available to student upon request
   - Retain for as long as records maintained

7. **Legitimate Educational Interest** (§99.31(a)(1))
   - Define criteria for "need to know"
   - Document in annual notification

8. **Third-Party Servicers** (§99.33)
   - Written agreements with service providers
   - Same use restrictions apply

9. **Health/Safety Emergency** (§99.36)
   - Procedures for emergency disclosures
   - Documentation requirements

10. **Complaints** (§99.63-99.67)
    - Process for receiving complaints
    - Referral to SPPO (Student Privacy Policy Office)

## Task Count Benchmarks

| Regulation Type | Target Task Count |
|-----------------|-------------------|
| Major Federal (FERPA, Title IX, Clery) | 30-60 tasks |
| Federal Secondary | 15-30 tasks |
| State Regulations | 10-20 tasks |

## LOVV Level Requirements for Gold

Must achieve **LOVV Level A**:
- Valid legal citation (USC/CFR)
- Source URL verified
- All required fields populated
- Tasks categorized and complete
