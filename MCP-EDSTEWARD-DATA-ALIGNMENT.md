# MCP Engine ↔ EdSteward Data Alignment Guide

**Date:** December 1, 2025  
**Purpose:** Ensure complete alignment between MCP Engine's data format and EdSteward's database schema  
**Status:** 🟡 Needs Coordination

---

## 📊 Current Integration Status

### What's Working:
- ✅ API endpoint: `POST /api/regulation-updates` is live
- ✅ Basic field acceptance (regulationId, name, updatedContent)
- ✅ Authentication bypassed for localhost
- ✅ 14 regulation updates delivered (IDs 530-546)

### What Needs Alignment:
- ⚠️ Field mapping and naming conventions
- ⚠️ Data format expectations (string vs JSON vs markdown)
- ⚠️ Optional vs required fields
- ⚠️ Display format for structured data
- ⚠️ Metadata usage and structure

---

## 🗄️ EdSteward Database Schema

### RegulationUpdate Table (Expected by EdSteward):

```sql
CREATE TABLE regulation_updates (
  id                    SERIAL PRIMARY KEY,
  regulation_id         INTEGER NOT NULL REFERENCES regulations(id),
  name                  VARCHAR(255) NOT NULL,
  
  -- Content Fields
  original_content      TEXT,
  updated_content       TEXT NOT NULL,  -- REQUIRED, min 100 chars
  
  -- Structured Fields (High Priority for Counsel Demo)
  summary               TEXT,           -- ~80-400 chars, human-readable
  requirements          TEXT,           -- Markdown format, detailed compliance steps
  filing_deadlines      JSONB,          -- Array of deadline objects
  
  -- Legacy/Additional Deadline Fields
  deadline              VARCHAR(255),   -- Single deadline string
  deadline_month        VARCHAR(50),    -- e.g., "September"
  deadline_label        VARCHAR(100),   -- e.g., "Annual Report Due"
  reporting_requirements TEXT,          -- Text description
  
  -- Date Fields
  effective_date        DATE,
  enacted_date          DATE,
  
  -- Status & Metadata
  status                VARCHAR(50) DEFAULT 'pending', -- pending|reviewed|approved|rejected
  metadata              JSONB,
  
  -- Timestamps
  created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 📤 MCP Engine Payload Format (What We're Sending)

### Current Payload Structure:

```javascript
{
  // CORE FIELDS
  regulationId: 223,                    // Integer, maps to EdSteward's regulation_id
  name: "FERPA",                        // String, regulation name
  
  // CONTENT FIELDS
  originalContent: "",                  // String, previous version (empty for new)
  updatedContent: "Full text...",       // String, REQUIRED, min 100 chars
  
  // STRUCTURED FIELDS (CRITICAL FOR DEMO)
  summary: "Brief summary...",          // String, 80-400 chars
  requirements: "### Markdown...",      // String (markdown), detailed compliance
  filingDeadlines: "[{...}]",           // STRING (JSON.stringified), array of objects
  
  // LEGACY FIELDS (for backward compatibility)
  deadline: "September 1",              // String, simple deadline
  deadlineMonth: null,                  // String or null
  deadlineLabel: null,                  // String or null
  reportingRequirements: null,          // String or null
  
  // DATE FIELDS
  effectiveDate: null,                  // ISO date string or null
  enactedDate: null,                    // ISO date string or null
  
  // STATUS & METADATA
  status: "pending",                    // String enum
  metadata: {                           // Object
    mcpEngineId: "ferpa",
    timestamp: "2025-12-01T...",
    source: "MCP_ENGINE",
    corrected: true
  }
}
```

---

## 🔧 Field-by-Field Alignment

### 1. **regulationId** (CRITICAL)
**MCP Engine:** Sends integer (e.g., 223)  
**EdSteward:** Expects integer, must exist in `regulations` table  
**Status:** ✅ ALIGNED  
**Notes:** We've corrected all 10 demo regulation IDs

### 2. **name**
**MCP Engine:** Sends full regulation name (e.g., "Family Educational Rights and Privacy Act (FERPA)")  
**EdSteward:** Expects VARCHAR(255)  
**Status:** ✅ ALIGNED

### 3. **originalContent**
**MCP Engine:** Sends empty string ("") for new updates  
**EdSteward:** Expects TEXT, optional  
**Status:** ⚠️ NEEDS DISCUSSION  
**Question:** Should we send the *previous* version of the regulation text here for differential view?

### 4. **updatedContent**
**MCP Engine:** Sends full regulation text (855-3,346 chars)  
**EdSteward:** Expects TEXT, REQUIRED, min 100 chars  
**Status:** ✅ ALIGNED  
**Quality:** All 10 regulations now have real CFR/USC content

### 5. **summary** (HIGH PRIORITY)
**MCP Engine:** Sends 97-416 character human-readable summary  
**EdSteward:** Expects TEXT, displayed prominently in UI  
**Status:** ✅ ALIGNED  
**Format:**
```javascript
"Requires institutions to adopt and implement a drug and alcohol abuse prevention 
program that includes annual distribution of standards of conduct, legal sanctions, 
health risks, available treatment programs, and disciplinary sanctions to all students 
and employees. Institutions must conduct a biennial review of program effectiveness."
```

### 6. **requirements** (HIGH PRIORITY)
**MCP Engine:** Sends detailed markdown-formatted compliance steps  
**EdSteward:** Expects TEXT, should be rendered as HTML in UI  
**Status:** ⚠️ NEEDS VERIFICATION  
**Format:**
```markdown
### Drug-Free Schools Act Compliance Requirements

**Annual Distribution Requirements:**
- Distribute written policy to ALL students taking credit courses
- Distribute written policy to ALL employees
- Must include standards prohibiting unlawful drug/alcohol use
...
```
**Question for EdSteward:** Are you rendering this markdown as HTML or displaying as plain text?

### 7. **filingDeadlines** (HIGH PRIORITY)
**MCP Engine:** Sends **JSON STRING** (not object)  
**EdSteward:** Database expects **JSONB** (PostgreSQL JSON type)  
**Status:** ✅ ALIGNED (we stringify before sending)  
**Format:**
```javascript
// What we send (stringified):
"[{\"type\":\"Annual\",\"description\":\"Policy Distribution\",\"date\":\"Each academic year\",\"recurring\":true},{\"type\":\"Biennial\",\"description\":\"Program Effectiveness Review\",\"date\":\"Every 2 years\",\"recurring\":true}]"

// What EdSteward should parse and store as JSONB:
[
  {
    "type": "Annual",
    "description": "Policy Distribution",
    "date": "Each academic year",
    "recurring": true
  },
  {
    "type": "Biennial",
    "description": "Program Effectiveness Review",
    "date": "Every 2 years",
    "recurring": true
  }
]
```
**Question for EdSteward:** Can you parse this JSON string and store as JSONB? Should we send as object instead?

### 8. **deadline** (Legacy)
**MCP Engine:** Sends single string (e.g., "September 1") or null  
**EdSteward:** Expects VARCHAR(255), optional  
**Status:** ✅ ALIGNED  
**Note:** This is legacy field, `filingDeadlines` is preferred

### 9. **deadlineMonth, deadlineLabel, reportingRequirements**
**MCP Engine:** Currently sends null  
**EdSteward:** Expects strings, optional  
**Status:** ⚠️ UNUSED  
**Question:** Do you need these fields populated, or is `filingDeadlines` sufficient?

### 10. **effectiveDate, enactedDate**
**MCP Engine:** Currently sends null  
**EdSteward:** Expects DATE type  
**Status:** ⚠️ UNUSED  
**Question:** Should we extract and send these dates from regulation text?

### 11. **status**
**MCP Engine:** Sends "pending"  
**EdSteward:** Expects enum('pending', 'reviewed', 'approved', 'rejected')  
**Status:** ✅ ALIGNED  
**Note:** All updates default to "pending" status

### 12. **metadata**
**MCP Engine:** Sends structured object with tracking info  
**EdSteward:** Expects JSONB  
**Status:** ✅ ALIGNED  
**Format:**
```javascript
{
  "mcpEngineId": "ferpa",                    // Our internal slug
  "timestamp": "2025-12-01T19:23:44.374Z",   // Update timestamp
  "source": "MCP_ENGINE",                     // Source system
  "corrected": true,                          // If this is a corrected update
  "note": "Replaced placeholder with real content"  // Optional notes
}
```

---

## 🎨 EdSteward UI Display Recommendations

### For Counsel Demo, EdSteward Should Display:

1. **Summary Section** (Top Priority)
   ```jsx
   <div className="regulation-summary card">
     <h3>📋 Summary</h3>
     <p className="lead">{update.summary}</p>
   </div>
   ```

2. **Requirements Section** (Top Priority)
   ```jsx
   <div className="compliance-requirements card">
     <h3>✅ Compliance Requirements</h3>
     <div dangerouslySetInnerHTML={{
       __html: marked.parse(update.requirements)
     }} />
   </div>
   ```
   **Note:** Requires markdown parser (e.g., `marked` library)

3. **Filing Deadlines Section** (Top Priority)
   ```jsx
   <div className="filing-deadlines card highlight">
     <h3>📅 Important Deadlines</h3>
     {JSON.parse(update.filingDeadlines).map(deadline => (
       <div key={deadline.description} className="deadline-item">
         <span className="badge">{deadline.type}</span>
         <strong>{deadline.description}</strong>: {deadline.date}
         {deadline.recurring && <span className="recurring">↻ Recurring</span>}
       </div>
     ))}
   </div>
   ```

4. **Full Text Section** (Differential View)
   ```jsx
   <div className="regulation-content card">
     <h3>📄 Regulation Text</h3>
     <DifferentialView 
       original={update.originalContent}
       updated={update.updatedContent}
     />
   </div>
   ```

---

## 🚨 Critical Questions for EdSteward Team

### 1. **Markdown Rendering**
- **Question:** Are you rendering `requirements` field as markdown→HTML, or displaying as plain text?
- **Why it matters:** We're sending formatted markdown with headers, bullets, bold text
- **Recommendation:** Use a markdown parser like `marked` or `react-markdown`

### 2. **Filing Deadlines Format**
- **Question:** Can you parse the JSON string we're sending for `filingDeadlines`?
- **Current format:** We send as JSON.stringified string
- **Alternative:** We can send as object if your API accepts it
- **Recommendation:** Store as JSONB in PostgreSQL, render as formatted list in UI

### 3. **Original Content**
- **Question:** Do you want us to send the previous version of regulation text in `originalContent`?
- **Current:** We send empty string ("")
- **Use case:** For differential view showing what changed
- **Recommendation:** If you want diffs, we can send previous version

### 4. **Date Fields**
- **Question:** Should we extract `effectiveDate` and `enactedDate` from regulation text?
- **Current:** We send null
- **Effort:** Medium complexity to parse dates from CFR/USC text
- **Recommendation:** Implement post-Friday demo if needed

### 5. **Legacy Deadline Fields**
- **Question:** Do you need `deadlineMonth`, `deadlineLabel`, `reportingRequirements` populated?
- **Current:** We send null for these
- **Alternative:** `filingDeadlines` JSONB provides richer deadline data
- **Recommendation:** Phase out legacy fields, use `filingDeadlines` array

### 6. **Metadata Usage**
- **Question:** Are you displaying any metadata fields in UI?
- **Current:** We send tracking info (mcpEngineId, timestamp, source, etc.)
- **Use case:** Audit trail, troubleshooting, source tracking
- **Recommendation:** Display source and timestamp in update details view

---

## 📋 Action Items

### For MCP Engine Team (Us):
- [ ] Confirm EdSteward can parse JSON string for `filingDeadlines`
- [ ] Decide if we should populate `originalContent` with previous version
- [ ] Decide if we should extract and send `effectiveDate`/`enactedDate`
- [ ] Verify all 10 regulations display correctly in EdSteward UI

### For EdSteward Team:
- [ ] Confirm database schema matches this document
- [ ] Implement markdown rendering for `requirements` field
- [ ] Implement JSON parsing and display for `filingDeadlines`
- [ ] Create UI components for summary, requirements, deadlines sections
- [ ] Test with the 14 updates we've sent (IDs 530-546)
- [ ] Provide screenshot of how one regulation looks in UI

### For Joint Testing (Thursday):
- [ ] Verify FERPA (ID 223) displays correctly
- [ ] Verify all structured fields render properly
- [ ] Test markdown formatting in requirements section
- [ ] Test deadline display formatting
- [ ] Test differential view for updated content
- [ ] Walk through end-to-end flow for counsel demo

---

## 📊 Current Regulation Data Quality

All 10 demo regulations now have:

| Regulation | ID | Content Chars | Summary Chars | Requirements | Deadlines |
|------------|----|--------------|--------------:|--------------:|----------:|
| FERPA | 223 | 1,872 | 180 | ✅ Yes | 2 |
| Clery | 9 | 2,156 | 97 | ✅ Yes | 3 |
| Title IX | 7 | 2,038 | 200 | ✅ Yes | 2 |
| Title IV | 3 | 3,346 | 396 | ✅ Yes | 3 |
| ADA | 2 | 1,869 | 150 | ✅ Yes | 1 |
| Section 504 | 6 | 1,587 | 170 | ✅ Yes | 1 |
| Title VI | 8 | 855 | 120 | ✅ Yes | 1 |
| TEACH Act | 55 | 3,240 | 416 | ✅ Yes | 2 |
| Drug-Free Schools | 157 | 2,915 | 336 | ✅ Yes | 2 |
| HEOA | 5 | 1,705 | 384 | ✅ Yes | 2 |

**Average:** 2,158 chars content, 245 chars summary, 1.9 deadlines per regulation

---

## 🎯 Friday Demo Readiness

### MCP Engine Side: ✅ READY
- All 10 regulations have real content
- All structured fields populated
- Integration tested and working
- Corrected updates sent (no more placeholders)

### EdSteward Side: ⚠️ NEEDS CONFIRMATION
- Database receiving updates successfully
- UI rendering of structured fields TBD
- Markdown→HTML conversion TBD
- Deadline display formatting TBD

### Joint Testing Needed:
- Visual verification of all 10 regulations
- Markdown rendering test
- Deadline display test
- End-to-end workflow walkthrough

---

## 📞 Next Steps

1. **Immediate:** EdSteward team reviews this document
2. **Today:** EdSteward confirms UI can handle our data format
3. **Wednesday:** Address any format mismatches
4. **Thursday:** Joint testing session
5. **Friday:** Demo to counsel 🎉

---

**Questions or issues?** Both systems are owned by same team, so coordination should be straightforward!

