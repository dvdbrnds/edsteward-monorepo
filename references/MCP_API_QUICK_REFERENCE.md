# EdSteward MCP API Quick Reference

**Base URL**: `https://moravian.edsteward.ai/api/mcp/`  
**Authentication**: `X-MCP-API-Key: your-api-key-here`  
**Content-Type**: `application/json`

---

## 🚀 **Core Endpoints**

### **Push Regulation Update**
```bash
curl -X POST https://moravian.edsteward.ai/api/mcp/versions/4903 \
  -H "Content-Type: application/json" \
  -H "X-MCP-API-Key: your-api-key-here" \
  -d '{
    "regulationId": 4903,
    "content": "# Updated regulation content...",
    "source": "your_system_name",
    "sourceId": "update-2025-01-19-001"
  }'
```

### **Check Sync Status**
```bash
curl -X GET https://moravian.edsteward.ai/api/mcp/sync-status \
  -H "X-MCP-API-Key: your-api-key-here"
```

### **Get Latest Version**
```bash
curl -X GET https://moravian.edsteward.ai/api/mcp/versions/4903/latest \
  -H "X-MCP-API-Key: your-api-key-here"
```

### **Register Conflict**
```bash
curl -X POST https://moravian.edsteward.ai/api/mcp/conflicts/4903 \
  -H "Content-Type: application/json" \
  -H "X-MCP-API-Key: your-api-key-here" \
  -d '{
    "regulationId": 4903,
    "localVersionId": 1233,
    "remoteVersionId": "update-2025-01-19-002",
    "conflicts": [...]
  }'
```

---

## 📊 **Status Codes**

- **200**: Success
- **201**: Created (new version)
- **400**: Bad Request (validation error)
- **401**: Unauthorized (missing API key)
- **403**: Forbidden (invalid API key)
- **404**: Not Found (regulation doesn't exist)
- **500**: Internal Server Error

---

## 🔧 **Environment Variables**

```bash
MCP_API_KEY=your-256-bit-api-key-here
MORAVIAN_DATABASE_URL=postgresql://user:pass@host:5432/edsteward_moravian
```

---

## 📝 **Sample Payload**

```json
{
  "regulationId": 4903,
  "content": "# Regulation Title\n\n## Requirements\n...",
  "source": "central_system",
  "sourceId": "batch-20250119-001",
  "validationStatus": [
    {
      "level": "A",
      "passed": true,
      "errors": [],
      "validatedAt": "2025-01-19T18:30:45Z"
    }
  ]
}
```

---

## 🔍 **Health Check**

```bash
curl https://moravian.edsteward.ai/api/health
```

**For complete documentation, see `REMOTE_UPDATE_SYSTEM_DOCUMENTATION.md`**