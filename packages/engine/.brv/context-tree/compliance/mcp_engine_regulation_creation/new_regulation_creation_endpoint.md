## MCP Engine New Regulation Creation Endpoint

Created a new endpoint for MCP Engine to add NEW regulations (like GDPR) with compliance tasks in a single atomic operation.

### Endpoint: `POST /api/mcp/regulations/create`

**Authentication:** Basic Auth (`gabadhgabadh` / Base64: `[REDACTED-BASE64]`)

**Key Features:**
- Creates regulation + all compliance tasks atomically
- Duplicate detection (returns 409 if regulation name already exists)
- Parent/child task relationships via tempId mapping
- Returns EdSteward IDs for created regulation and tasks

### Example Payload:

```json
{
  "name": "General Data Protection Regulation (GDPR)",
  "statute": "EU Regulation 2016/679",
  "category": "Information Technology",
  "topic": "Data Privacy",
  "jurisdictionSource": "international",
  "summary": "...",
  "requirements": "...",
  "complianceTasks": [
    {
      "tempId": "task-1",
      "title": "Appoint Data Protection Officer",
      "assignedRole": "IT Director",
      "priority": "high",
      "evidenceRequired": true,
      "evidenceType": "document"
    }
  ]
}
```

### Response:

```json
{
  "success": true,
  "regulation": {
    "id": 356,
    "itemId": "REG-...",
    "name": "General Data Protection Regulation (GDPR)"
  },
  "tasks": [{"id": 102, "tempId": "task-1", "title": "..."}],
  "taskIdMapping": {"task-1": 102}
}
```

### Additional Endpoints:
- `GET /api/mcp/regulations/lookup?name=GDPR` - Check if regulation exists
- `GET /api/mcp/regulations/:id/tasks` - Get tasks for a regulation

**Important:** The old `/api/regulation-updates` endpoint is for UPDATES to existing regulations. Use `/api/mcp/regulations/create` for NEW regulations.