# EdSteward Regulation ID Mapping - URGENT FIX

**Date:** December 1, 2025  
**Issue:** Regulation ID mismatch between MCP Engine and EdSteward  
**Status:** 🔴 CRITICAL - Must fix before Friday demo

---

## PROBLEM IDENTIFIED

EdSteward uses **DIFFERENT regulation IDs** than what we documented:

### Our Documentation (WRONG):
- 51 = FERPA
- 55 = Clery Act
- 61 = Title IX
- 26 = Title IV
- etc.

### EdSteward's Actual IDs (CORRECT):
- **223** = FERPA
- **355** = Clery Act
- **7** = Title IX
- **48** = Title IV
- etc.

**Impact:** All our requests will fail with "regulation not found" errors.

---

## IMMEDIATE ACTIONS NEEDED

### 1. Get Complete ID List from EdSteward

**Request:**
> Can you send us your complete regulation ID list? We need:
> - Regulation ID (your database)
> - Regulation name
> - All 295 regulations (or however many you have)
> 
> Format: CSV, JSON, or table - whatever is easiest

**Why:** We need to create accurate mapping between our slugs and your IDs.

### 2. Test EdSteward Endpoint Health

```bash
# Test health check
curl http://localhost:3000/api/regulation-updates/bulk-import/health
```

**Expected:** Success response showing endpoint is live

### 3. Test with Correct FERPA ID (223)

```bash
curl -X POST http://localhost:3000/api/regulation-updates \
  -H "Content-Type: application/json" \
  -d '{
    "regulationId": 223,
    "name": "FERPA Test from MCP Engine",
    "updatedContent": "Test content for FERPA regulation update with at least 100 characters to pass validation checks and demonstrate successful integration.",
    "summary": "This is a test summary for FERPA to verify endpoint connectivity",
    "status": "pending",
    "metadata": {
      "source": "MCP_ENGINE",
      "timestamp": "2025-12-01T15:00:00Z",
      "mcpEngineId": "family-educational-rights-and-privacy-act-ferpa"
    }
  }'
```

**Expected:** `{"success": true, "updateId": "...", "regulationId": 223}`

---

## WHERE THE WRONG IDs CAME FROM

Our IDs came from `compmat.csv` column `master_key_field`:
- This appears to be a DIFFERENT numbering system
- May be internal MCP Engine IDs or reference system
- NOT the same as EdSteward's database primary keys

**Lesson:** Always verify IDs with the actual database before integration!

---

## SOLUTION APPROACH

### Option A: EdSteward Provides Complete List (RECOMMENDED)

**Steps:**
1. EdSteward exports full regulation list with IDs
2. We create mapping file: `edsteward-regulation-id-map.js`
3. Update delivery system to use correct IDs
4. Test with all 10 demo regulations
5. Verify end-to-end delivery

**Time:** 1-2 hours (mostly waiting for their list)

### Option B: Manual Mapping of Top 10

**Steps:**
1. EdSteward tells us the correct IDs for these 10:
   - FERPA = 223 ✅ (confirmed)
   - Clery Act = 355 ✅ (confirmed)
   - Title IX = 7 ✅ (confirmed)
   - Title IV = 48 ✅ (confirmed)
   - VAWA = ?
   - ADA = ?
   - Section 504 = ?
   - Title VI = ?
   - TEACH Act = ?
   - Drug-Free Schools = ?

2. Hardcode these 10 in delivery system
3. Test Friday demo with just these 10
4. Get full list later for production

**Time:** 30 minutes

---

## CODE CHANGES NEEDED

### File: `src/delivery-system/edsteward-integration.js`

**Current Code (Lines ~50-100):**
```javascript
// ❌ WRONG - Uses master_key_field from compmat.csv
const regulationIdMap = {
  'family-educational-rights-and-privacy-act-ferpa': 51,
  'clery-act': 55,
  'title-ix-of-the-education-amendment-of-1972': 61,
  // etc...
};
```

**Need to Change To:**
```javascript
// ✅ CORRECT - Uses EdSteward's actual database IDs
const regulationIdMap = {
  'family-educational-rights-and-privacy-act-ferpa': 223,
  'clery-act': 355,
  'title-ix-of-the-education-amendment-of-1972': 7,
  'higher-education-act-title-iv-student-financial-a': 48,
  // ... need other 6 for top 10 demo
};
```

### Create New File: `src/delivery-system/edsteward-regulation-id-map.js`

```javascript
/**
 * EdSteward Regulation ID Mapping
 * Maps MCP Engine regulation slugs to EdSteward database IDs
 * 
 * SOURCE: EdSteward database export (December 1, 2025)
 * VERIFIED: EdSteward team confirmed these IDs
 */

export const edstewardRegulationIds = {
  // Top 10 Friday Demo Regulations
  'family-educational-rights-and-privacy-act-ferpa': 223,
  'clery-act': 355,  // Jeanne Clery Act
  'title-ix-of-the-education-amendment-of-1972': 7,
  'higher-education-act-title-iv-student-financial-a': 48,
  'violence-against-women-reauthorization-act': null, // TODO: Get from EdSteward
  'americans-with-disabilities-act-of-1990': null, // TODO: Get from EdSteward
  'section-504-of-the-rehabilitation-act-of-1973': null, // TODO: Get from EdSteward
  'title-vi-of-the-civil-rights-act-of-1964': null, // TODO: Get from EdSteward
  'technology-education-and-copyright-harmonization-a': null, // TODO: Get from EdSteward
  'drug-free-schools-and-communities-act': null, // TODO: Get from EdSteward
  
  // TODO: Add remaining 285 regulations when EdSteward provides full list
};

export function getEdStewardId(mcpSlug) {
  const id = edstewardRegulationIds[mcpSlug];
  if (!id) {
    console.warn(`⚠️  No EdSteward ID mapping found for: ${mcpSlug}`);
    return null;
  }
  return id;
}
```

---

## RESPONSE TO EDSTEWARD TEAM

**Send this:**

> Hi EdSteward Team!
> 
> Fantastic news that your endpoint is already live! 🎉
> 
> **Critical Issue Identified:**
> You're absolutely right - we have the wrong regulation IDs. Our documentation listed:
> - FERPA = 51 (WRONG)
> - Clery = 55 (WRONG)
> 
> But your database uses:
> - FERPA = 223 ✅
> - Clery = 355 ✅
> 
> **What We Need (URGENT - for Friday demo):**
> 
> Can you provide the correct EdSteward database IDs for these 10 regulations?
> 
> 1. FERPA = **223** ✅ (confirmed)
> 2. Clery Act = **355** ✅ (confirmed)
> 3. Title IX = **7** ✅ (confirmed)
> 4. Title IV (Student Financial Aid) = **48** ✅ (confirmed - but you mentioned it's the wrong regulation?)
> 5. Violence Against Women Act (VAWA) = **?**
> 6. Americans with Disabilities Act (ADA) = **?**
> 7. Section 504 of Rehabilitation Act = **?**
> 8. Title VI of Civil Rights Act = **?**
> 9. TEACH Act (Copyright) = **?**
> 10. Drug-Free Schools and Communities Act = **?**
> 
> **Also:**
> - For Title IV (#48) - you said it's "currently wrong regulation" - what regulation IS at ID 48? And what ID should Title IV be?
> - Can you send us your full regulation list (all 355)? We'll create a complete mapping.
> 
> **Timeline:**
> - Get IDs: Today/Tuesday
> - Update our mapping: Tuesday afternoon (30 min)
> - Test integration: Thursday
> - Demo: Friday
> 
> **Testing Now:**
> I'll test your health check endpoint immediately and verify FERPA (ID 223) works.
> 
> Thanks for catching this! Much better to fix now than fail during the Friday demo.

---

## TESTING EDSTEWARD ENDPOINT (NOW)

### Test 1: Health Check
```bash
curl http://localhost:3000/api/regulation-updates/bulk-import/health
```

### Test 2: FERPA with Correct ID (223)
```bash
curl -X POST http://localhost:3000/api/regulation-updates \
  -H "Content-Type: application/json" \
  -d '{
    "regulationId": 223,
    "name": "Family Educational Rights and Privacy Act (FERPA)",
    "updatedContent": "Full FERPA regulation text from 34 CFR 99. Educational institutions must provide students with the right to inspect and review their education records, request amendments to records they believe are inaccurate, and control disclosure of information from their records. Institutions must provide annual notification of FERPA rights at the beginning of each academic year.",
    "summary": "FERPA provides students the right to inspect and review their education records, request amendments, and control disclosure of information. Educational institutions must provide annual notification of these rights and maintain procedures for access requests.",
    "requirements": "### Key Compliance Requirements\n\n1. **Annual Notification** (34 CFR 99.7)\n   - Inform students of FERPA rights at start of each academic year\n\n2. **Record Access** (34 CFR 99.10)\n   - Provide access within 45 days of request\n\n3. **Disclosure Controls** (34 CFR 99.30)\n   - Obtain written consent before disclosure",
    "filingDeadlines": [
      {
        "type": "Annual",
        "description": "Annual Notification of FERPA Rights",
        "date": "Beginning of each academic year",
        "recurring": true,
        "citation": "34 CFR 99.7"
      },
      {
        "type": "On Request",
        "description": "Provide Record Access",
        "date": "Within 45 days of request",
        "recurring": false,
        "citation": "34 CFR 99.10"
      }
    ],
    "deadline": "Annual",
    "deadlineMonth": "9",
    "deadlineLabel": "9-September",
    "reportingRequirements": "Annual notification to students at beginning of each academic year",
    "effectiveDate": "1974-11-19",
    "enactedDate": "1974-08-21",
    "status": "pending",
    "metadata": {
      "mcpEngineId": "family-educational-rights-and-privacy-act-ferpa",
      "timestamp": "2025-12-01T15:30:00.000Z",
      "enhanced": true,
      "structuredFieldsIncluded": true,
      "source": "MCP_ENGINE",
      "regulationSource": "34 CFR 99",
      "dataQualityScore": 95,
      "certaintyGrade": "A"
    }
  }'
```

**Expected:** Success with updateId and regulationId 223

### Test 3: Error Handling (Non-existent ID)
```bash
curl -X POST http://localhost:3000/api/regulation-updates \
  -H "Content-Type: application/json" \
  -d '{
    "regulationId": 99999,
    "name": "Test",
    "updatedContent": "Test content"
  }'
```

**Expected:** 404 Not Found with "regulation not found" error

---

## FRIDAY DEMO IMPACT

### Current Status: 🟡 AT RISK

**Without Correct IDs:**
- ❌ All 10 demo regulations will fail
- ❌ "Regulation not found" errors
- ❌ Demo will not work

**With Correct IDs:**
- ✅ All 10 regulations will deliver successfully
- ✅ End-to-end integration works
- ✅ Demo success

**Critical Path:**
1. Get correct IDs from EdSteward (TODAY/TUESDAY)
2. Update mapping file (30 min)
3. Test with corrected IDs (Thursday)
4. Demo Friday

**Risk Level:** MEDIUM (depends on quick response from EdSteward)

---

## ACTION ITEMS

### MCP Engine Team (US)
- [ ] Test EdSteward health endpoint (NOW)
- [ ] Test FERPA with ID 223 (NOW)
- [ ] Request complete ID list from EdSteward (NOW)
- [ ] Create edsteward-regulation-id-map.js file
- [ ] Update edsteward-integration.js with correct mapping
- [ ] Rerun test-edsteward-top-10.js with corrected IDs
- [ ] Verify all 10 regulations deliver successfully

### EdSteward Team
- [ ] Provide correct IDs for 10 demo regulations (TODAY/TUESDAY)
- [ ] Clarify Title IV issue (ID 48 "wrong regulation")
- [ ] Provide full regulation list (355 regulations) for complete mapping
- [ ] Verify endpoint is accessible from MCP Engine
- [ ] Schedule Thursday joint test session

---

**Priority:** 🔴 CRITICAL  
**Timeline:** Fix needed by Tuesday EOD for Thursday testing  
**Demo Impact:** HIGH - Demo will fail without correct IDs  
**Effort:** LOW - Just need EdSteward's ID list, then 30 min to update mapping

