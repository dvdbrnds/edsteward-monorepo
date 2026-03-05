## MCP Engine Deadline Extraction Implementation

**Date**: November 4, 2025

### CRITICAL RULE
Every regulation in the MCP Engine MUST have a deadline. If no deadline is specified in source data, the system defaults to July 1.

### Implementation Components

**1. Registry API Deadline Extraction**
File: `src/server/registry-api/registry-server.js`

Function `extractDeadlineInfo(reg)` handles deadline extraction from CSV data:
- Checks for valid deadline in CSV 'Deadlines' and 'Sortable Month' columns
- Treats as "no deadline": null, empty string, "Not Applicable", "N/A", "None"
- Returns July 1 default if no valid deadline found
- Returns structured format: `{deadline, deadlineMonth, deadlineLabel, reportingRequirements}`

```javascript
function extractDeadlineInfo(reg) {
  const rawDeadline = reg['Deadlines'];
  const hasDeadline = rawDeadline && 
                      rawDeadline.trim() !== '' && 
                      rawDeadline.toLowerCase() !== 'not applicable';
  
  if (!hasDeadline) {
    return {
      deadline: 'July 1',
      deadlineMonth: '7',
      deadlineLabel: '7-Jul',
      reportingRequirements: reportingRequirements || 'Annual compliance review recommended by July 1'
    };
  }
  // ... extract from CSV data
}
```

**2. LLM Gateway Deadline Extraction**
File: `src/llm-gateway/government-source-fetcher.js`

Function `extractDeadline(regulationText, effectiveDate)` extracts deadlines from government source text:
- Pattern matches for: "deadline by [month day]", "submit by [month day]", "annually by [month day]"
- Falls back to effective date if within 2 years of current date
- Defaults to July 1 if no deadline found in text or effective date

Function `normalizeDeadline(deadlineText)` converts extracted text to standard format:
- Maps month names to numbers (1-12) and abbreviations
- Returns `{deadline, deadlineMonth, deadlineLabel}` structure

Integrated into `fetchFromFederalRegister()` to automatically extract and include deadline data in all government source responses.

**3. Delivery System Integration**
Files: `src/delivery-system/edsteward-integration.js`, `src/delivery-system/regulation-delivery-engine.js`

Deadline data flows through entire delivery pipeline:
- Registry API → Delivery Engine → EdSteward Integration → End Clients
- Payload includes: deadline, deadlineMonth, deadlineLabel, reportingRequirements
- All regulations transmitted with complete deadline information

### Testing & Verification

```bash
# View all deadlines
curl -s http://localhost:3010/api/regulations | jq -r '.[] | "\(.name) -> \(.deadline)"'

# Count July 1 defaults  
curl -s http://localhost:3010/api/regulations | jq '[.[] | select(.deadline == "July 1")] | length'

# Find specific deadlines
curl -s http://localhost:3010/api/regulations | jq -r '.[] | select(.deadline != "July 1" and .deadline != null)'
```

### Why July 1?
July 1 is the fiscal year start date for many educational institutions and government agencies, making it the logical default for compliance review deadlines.

### Documentation
Complete strategy documented in `DEADLINE-EXTRACTION-STRATEGY.md` with:
- Detailed implementation explanation
- Code examples and patterns
- Data flow diagrams
- Testing procedures
- Future enhancement roadmap