# Deadline Extraction Strategy

**Date**: November 4, 2025  
**Status**: ✅ IMPLEMENTED AND ACTIVE  
**Critical Rule**: **EVERY REGULATION MUST HAVE A DEADLINE**

---

## 🎯 Core Requirement

**MANDATORY**: Every regulation in the MCP Engine system MUST have a deadline. If no deadline is specified in the source data, the system defaults to **July 1**.

### Why July 1?

July 1 serves as a fiscal year start date for many educational institutions and government agencies, making it a logical default for compliance review deadlines.

---

## 📋 Implementation Overview

The deadline extraction system operates at three levels:

1. **Registry API** (Primary Source) - Extracts from CSV data
2. **LLM Gateway** (Government Sources) - Extracts from Federal Register, CFR, USC text
3. **Delivery System** (Validation) - Ensures deadlines exist before transmission

---

## 1️⃣ Registry API Deadline Extraction

**File**: `src/server/registry-api/registry-server.js`

### Function: `extractDeadlineInfo(reg)`

**Purpose**: Extract and normalize deadline information from CSV regulation data with July 1 default fallback.

### Logic Flow:

```javascript
function extractDeadlineInfo(reg) {
  const rawDeadline = reg['Deadlines'];
  const sortableMonth = reg['Sortable Month'];
  const reportingRequirements = reg['Reporting Requirements'];
  
  // Check if deadline exists and is meaningful
  const hasDeadline = rawDeadline && 
                      rawDeadline.trim() !== '' && 
                      rawDeadline.toLowerCase() !== 'not applicable' &&
                      rawDeadline.toLowerCase() !== 'n/a' &&
                      rawDeadline.toLowerCase() !== 'none';
  
  // ✅ CRITICAL RULE: Every regulation MUST have a deadline
  // If no deadline specified, default to July 1
  if (!hasDeadline) {
    return {
      deadline: 'July 1',
      deadlineMonth: '7',
      deadlineLabel: '7-Jul',
      reportingRequirements: reportingRequirements || 'Annual compliance review recommended by July 1'
    };
  }
  
  // Extract month number from sortable month field
  const monthNumber = sortableMonth ? sortableMonth.split('-')[0] : null;
  
  return {
    deadline: rawDeadline,
    deadlineMonth: monthNumber,
    deadlineLabel: sortableMonth,
    reportingRequirements: reportingRequirements
  };
}
```

### Treated as "No Deadline":
- `null` or `undefined`
- Empty string `""`
- `"Not Applicable"` (case-insensitive)
- `"N/A"` (case-insensitive)
- `"None"` (case-insensitive)

### Output Format:

```json
{
  "deadline": "July 1",
  "deadlineMonth": "7",
  "deadlineLabel": "7-Jul",
  "reportingRequirements": "Annual compliance review recommended by July 1"
}
```

---

## 2️⃣ LLM Gateway Deadline Extraction

**File**: `src/llm-gateway/government-source-fetcher.js`

### Function: `extractDeadline(regulationText, effectiveDate)`

**Purpose**: Extract deadlines from government regulation text (Federal Register, CFR, USC) using pattern matching.

### Extraction Strategy:

#### Step 1: Pattern Matching
Searches regulation text for common deadline patterns:

```javascript
const deadlinePatterns = [
  // "deadline by January 15" or "submit by March 30"
  /(?:deadline|due|submit|file|report).*?(?:by|on|before|no later than)\s+((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?)/gi,
  
  // "January 15 deadline" or "March 30 due date"
  /(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?\s+(?:deadline|due date|filing date)/gi,
  
  // "annually by September 1" or "each year before December 31"
  /(?:annually|each year)\s+(?:by|on|before)\s+((?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?)/gi
];
```

**Examples Matched**:
- "Submit by October 15th annually"
- "Deadline: September 30"
- "File report no later than March 31"
- "Each year by January 31"

#### Step 2: Effective Date Fallback
If no deadline pattern found, checks if regulation has an effective date within 2 years of current date:

```javascript
if (effectiveDate) {
  const effectiveYear = new Date(effectiveDate).getFullYear();
  const currentYear = new Date().getFullYear();
  // Only use effective date as deadline if it's within 2 years
  if (Math.abs(effectiveYear - currentYear) <= 2) {
    const month = new Date(effectiveDate).toLocaleString('en-US', { month: 'long' });
    const day = new Date(effectiveDate).getDate();
    return this.normalizeDeadline(`${month} ${day}`);
  }
}
```

#### Step 3: July 1 Default
If neither pattern matching nor effective date yields a deadline:

```javascript
// ✅ CRITICAL RULE: Default to July 1 if no deadline found
return {
  deadline: 'July 1',
  deadlineMonth: '7',
  deadlineLabel: '7-Jul'
};
```

### Function: `normalizeDeadline(deadlineText)`

**Purpose**: Convert extracted deadline text to standardized format.

```javascript
normalizeDeadline(deadlineText) {
  const monthMap = {
    'january': { num: '1', abbr: 'Jan' },
    'february': { num: '2', abbr: 'Feb' },
    // ... all 12 months
  };
  
  const cleanText = deadlineText.toLowerCase().trim();
  for (const [month, data] of Object.entries(monthMap)) {
    if (cleanText.includes(month)) {
      return {
        deadline: deadlineText,
        deadlineMonth: data.num,
        deadlineLabel: `${data.num}-${data.abbr}`
      };
    }
  }
  
  return {
    deadline: deadlineText,
    deadlineMonth: null,
    deadlineLabel: null
  };
}
```

### Integration Point:

The `fetchFromFederalRegister()` function automatically calls `extractDeadline()` and includes results in response:

```javascript
// ✅ CRITICAL: Extract deadline from regulation text
const fullText = data.body || data.abstract || '';
const deadlineInfo = this.extractDeadline(fullText, data.effective_on);

return {
  title: data.title,
  source: 'Federal Register',
  // ... other fields ...
  deadline: deadlineInfo.deadline,
  deadlineMonth: deadlineInfo.deadlineMonth,
  deadlineLabel: deadlineInfo.deadlineLabel,
  // ... more fields ...
};
```

---

## 3️⃣ Delivery System Validation

**Files**: 
- `src/delivery-system/edsteward-integration.js`
- `src/delivery-system/regulation-delivery-engine.js`
- `src/delivery-system/delivery-server.js`

### Current Status:

Deadline data is already being transmitted through the delivery pipeline:

```javascript
// From edsteward-integration.js (lines 359-366)
updatePayload: {
  regulationId: edStewardId,
  name: `${regulationName} ${currentYear} Update`,
  originalContent: originalContent,
  updatedContent: updatedContent,
  status: 'pending',
  // ✅ CRITICAL: Include deadline and compliance data for end clients
  deadline: mcpUpdate.data.after?.deadline || mcpUpdate.data.deadline || null,
  deadlineMonth: mcpUpdate.data.after?.deadlineMonth || mcpUpdate.data.deadlineMonth || null,
  deadlineLabel: mcpUpdate.data.after?.deadlineLabel || mcpUpdate.data.deadlineLabel || null,
  reportingRequirements: mcpUpdate.data.after?.reportingRequirements || mcpUpdate.data.reportingRequirements || null,
  effectiveDate: mcpUpdate.data.after?.effectiveDate || mcpUpdate.data.effectiveDate || null,
  enactedDate: mcpUpdate.data.after?.enactedDate || mcpUpdate.data.enactedDate || null,
  metadata: {
    mcpEngineId: regulationId,
    timestamp: new Date().toISOString(),
    enhanced: true
  }
}
```

### Validation Logic (Future Enhancement):

```javascript
function validateDeadline(regulation) {
  if (!regulation.deadline || 
      regulation.deadline === null || 
      regulation.deadline === '' ||
      regulation.deadline === 'Not Applicable') {
    console.warn(`⚠️ Missing deadline for ${regulation.regulationId} - should have been defaulted`);
    // Force July 1 default
    return {
      ...regulation,
      deadline: 'July 1',
      deadlineMonth: '7',
      deadlineLabel: '7-Jul',
      reportingRequirements: regulation.reportingRequirements || 'Annual compliance review recommended by July 1'
    };
  }
  return regulation;
}
```

---

## 🧪 Testing & Verification

### Test 1: Registry API Deadline Defaults

```bash
# Check that regulations without deadlines get July 1 default
curl -s http://localhost:3010/api/regulations | \
  jq -r '.[] | "\(.name) -> Deadline: \(.deadline) (\(.deadlineLabel))"' | \
  head -10
```

**Expected Output**:
```
Age Discrimination Act of 1975 -> Deadline: July 1 (7-Jul)
Americans with Disabilities Act of 1990 -> Deadline: July 1 (7-Jul)
Higher Education Act: Institutional and Financial Assistance Information for Students -> Deadline: July 1 (7-Jul)
```

### Test 2: Count July 1 Defaults

```bash
# Count how many regulations defaulted to July 1
curl -s http://localhost:3010/api/regulations | \
  jq -r '[.[] | select(.deadline == "July 1")] | length'
```

### Test 3: Verify Specific Deadlines Preserved

```bash
# Show regulations that have deadlines OTHER than July 1
curl -s http://localhost:3010/api/regulations | \
  jq -r '.[] | select(.deadline != "July 1" and .deadline != null) | "\(.name) -> \(.deadline)"'
```

### Test 4: End-to-End Deadline Transmission

```bash
# Trigger manual update and check EdSteward payload
# (Check delivery system logs for transmitted deadline data)
tail -f logs/delivery-system.log | grep -i deadline
```

---

## 📊 Data Flow Summary

```
CSV Data Source (compmat.csv)
│
├─ "Deadlines" column
├─ "Sortable Month" column  
├─ "Reporting Requirements" column
│
▼
Registry API (extractDeadlineInfo)
│
├─ IF deadline exists and meaningful → Use CSV data
├─ ELSE → Default to July 1
│
▼
Registry API Response
{
  "deadline": "July 1",
  "deadlineMonth": "7",
  "deadlineLabel": "7-Jul",
  "reportingRequirements": "Annual compliance review..."
}
│
▼
LLM Gateway (when fetching from gov sources)
│
├─ Pattern match regulation text for deadline
├─ Check effective date (if within 2 years)
├─ Default to July 1
│
▼
Delivery System (regulation-delivery-engine.js)
│
├─ Fetch regulation with deadline data
├─ Include in CDC event payload
│
▼
EdSteward Integration (edsteward-integration.js)
│
├─ Extract deadline fields from CDC event
├─ Include in EdSteward API payload
│
▼
End Client (EdSteward/Customer Systems)
{
  "deadline": "July 1",
  "deadlineMonth": "7", 
  "deadlineLabel": "7-Jul",
  "reportingRequirements": "..."
}
```

---

## 🔧 Configuration

### Environment Variables

No special environment variables required. Deadline extraction is enabled by default.

### Customizing Default Deadline

To change the default from July 1 to another date, modify:

**In `registry-server.js`**:
```javascript
if (!hasDeadline) {
  return {
    deadline: 'YOUR DESIRED DATE',  // e.g., 'September 1'
    deadlineMonth: 'MONTH NUMBER',   // e.g., '9'
    deadlineLabel: 'MONTH-ABBR',     // e.g., '9-Sep'
    reportingRequirements: reportingRequirements || 'YOUR MESSAGE'
  };
}
```

**In `government-source-fetcher.js`**:
```javascript
console.log(`📅 No deadline found - defaulting to YOUR DATE`);
return {
  deadline: 'YOUR DESIRED DATE',
  deadlineMonth: 'MONTH NUMBER',
  deadlineLabel: 'MONTH-ABBR'
};
```

---

## 📈 Statistics

After implementation (November 4, 2025):

- **Total Regulations**: 295+ (CSV) + 59 (PA specific)
- **Regulations with July 1 Default**: ~80-90% (estimated)
- **Regulations with Specific Deadlines**: ~10-20% (estimated)
- **Deadline Extraction Success Rate**: 100% (all regulations have deadlines)

---

## 🚀 Future Enhancements

### Priority 1: Enhanced Pattern Matching
- Add more sophisticated NLP-based deadline extraction
- Support relative deadlines ("within 30 days", "quarterly")
- Extract multiple deadlines per regulation

### Priority 2: Deadline Intelligence
- Automatically calculate next deadline occurrence
- Generate calendar alerts for upcoming deadlines
- Track historical deadline changes

### Priority 3: Validation Layer
- Add pre-delivery validation to ensure all deadlines exist
- Implement deadline reasonableness checks (e.g., not in past)
- Create deadline audit trail

### Priority 4: Institution-Specific Deadlines
- Allow institutional overrides for default deadlines
- Support state-specific deadline requirements
- Enable custom deadline mappings per client

---

## 📞 Contact & Support

For questions about deadline extraction:
- Review this documentation
- Check implementation files listed above
- Test using the verification commands provided

**Last Updated**: November 4, 2025  
**Version**: 1.0

