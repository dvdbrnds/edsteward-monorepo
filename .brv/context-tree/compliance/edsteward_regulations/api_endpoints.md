**EdSteward Integration: Correct Endpoints for Regulations - January 7, 2026**

CRITICAL: EdSteward has TWO different endpoints for regulations:

**For UPDATES to EXISTING regulations:**
```
POST /api/regulation-updates
```
- Requires `regulationId` (integer) that already exists in EdSteward
- Used when a regulation changes and needs updating

**For NEW regulations (like GDPR):**
```
POST /api/mcp/regulations/create
```
- Do NOT include `regulationId` - EdSteward auto-assigns
- Include `complianceTasks` array directly
- Returns created regulation ID and task IDs

**To check if regulation exists:**
```
GET /api/mcp/regulations/lookup?name=GDPR
```

**Example successful GDPR creation:**
```javascript
const payload = {
  name: 'General Data Protection Regulation (GDPR)',
  statute: 'EU Regulation 2016/679',
  category: 'Information Technology',
  topic: 'Data Privacy',
  jurisdictionSource: 'international',
  summary: '...',
  requirements: '...',
  filingDeadlines: [...],
  complianceTasks: [26 tasks]
};

// POST to /api/mcp/regulations/create
// Response: { success: true, regulation: { id: 356 }, tasks: [...] }
```

EdSteward Integration class now has:
- `createRegulation(data)` - for NEW regulations
- `sendRegulationUpdate(data)` - for EXISTING regulations  
- `lookupRegulation(name)` - to check if exists