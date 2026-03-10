## MCP Engine ↔ EdSteward Integration v2.0 (January 6, 2026)

### Endpoint & Authentication
- **Endpoint**: `POST /api/regulation-updates`
- **Base URLs**:
  - Production: `https://moravian.edsteward.ai`
  - Staging: `https://staging.edsteward.ai`
  - Development: `http://localhost:3000`
- **Auth**: Basic Auth `Authorization: Basic [REDACTED-BASE64]` (gabadhgabadh)
- **Health Check**: `GET /api/regulation-updates/bulk-import/health`

### Regulation ID System
- EdSteward uses integer IDs in range 1-500 (Master Key Field system)
- MCP Engine uses slugs like `family-educational-rights-and-privacy-act-ferpa`
- Mapping table in `src/delivery-system/edsteward-integration.js`
- Key mappings: FERPA=42, Clery=9, Title IX=7, TEACH Act=55, ADA=2, Section 504=6

### Payload Format
```javascript
{
  regulationId: 42,           // Integer 1-500 (required)
  name: "FERPA",              // String (required)
  status: "pending",          // pending|accepted|rejected|deferred
  originalContent: "...",     // Previous text
  updatedContent: "...",      // New text
  summary: "...",             // Brief summary
  requirements: "• Req 1\n• Req 2", // Newline-separated with bullets
  filingDeadlines: "[{type, date, frequency, description}]", // JSON array string
  metadata: {
    audit: { score, completeness, accuracy },
    templateHint: "ferpa|clery|title-ix",
    changeType: "amendment|content_update",
    source_attribution: "eCFR + Federal Register"
  }
}
```

### Rate Limits
- 100 requests per 15 minutes for general API
- 100ms delay between requests recommended
- Max batch size: 500

### Template Hints
EdSteward has pre-built compliance task templates (Clery ~50 tasks, FERPA ~40 tasks, Title IX ~45 tasks). MCP Engine includes `metadata.templateHint` to suggest which template to apply.