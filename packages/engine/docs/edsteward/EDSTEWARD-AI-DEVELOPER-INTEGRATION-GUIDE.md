# 🤝 MCP Engine → EdSteward Integration Guide
**For EdSteward AI Developer**

Generated: December 1, 2025  
MCP Engine Version: Phase 5 Complete  
Integration Status: Ready for Testing

---

## EXECUTIVE SUMMARY

The MCP Engine is ready to send real-time regulation updates to EdSteward. This document provides everything your AI developer needs to implement the receiving endpoint on the EdSteward side.

**What MCP Engine Does:**
- Monitors 295 federal + 52 PA state regulations in real-time
- Detects changes using Change Data Capture (CDC)
- Sends HTTP POST with complete regulation data
- Includes structured fields: summary, requirements, deadlines, full text

**What EdSteward Needs to Do:**
- Implement POST `/api/regulation-updates` endpoint
- Accept standardized payload (JSON)
- Store regulation updates in database
- Return success/failure response
- (Optional) Support WebSocket for real-time UI updates

---

## 📋 REQUIRED ENDPOINT

### Endpoint Specification

```
POST {YOUR_EDSTEWARD_URL}/api/regulation-updates
Content-Type: application/json
```

**Required Response Format:**
```json
{
  "success": true,
  "update": {
    "id": 12345,              // Your internal update ID
    "regulationId": 51,       // EdSteward regulation ID (from our mapping)
    "status": "pending"       // Or "received", "processing", etc.
  }
}
```

**Error Response Format:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Regulation ID not found"
  }
}
```

---

## 📤 PAYLOAD STRUCTURE

### Complete Payload Example (FERPA)

This is exactly what MCP Engine will POST to your endpoint:

```json
{
  "regulationId": 51,
  "name": "Family Educational Rights and Privacy Act (FERPA)",
  "originalContent": "Previous version of regulation text (if this is an update)...",
  "updatedContent": "Full regulation text from 34 CFR 99. This includes all sections, subsections, and compliance requirements. Educational institutions must provide students with...",
  "status": "pending",
  
  "summary": "FERPA provides students the right to inspect and review their education records, request amendments, and control disclosure of information. Educational institutions must provide annual notification of these rights and maintain procedures for access requests.",
  
  "requirements": "### Key Compliance Requirements\n\n1. **Annual Notification** (34 CFR 99.7)\n   - Inform students of FERPA rights at start of each academic year\n   - Include procedures for inspecting records\n   - Explain amendment request process\n\n2. **Record Access** (34 CFR 99.10)\n   - Provide access within 45 days of request\n   - Student may have representative review records\n   - Institution must provide copies if distance prevents review\n\n3. **Disclosure Controls** (34 CFR 99.30)\n   - Obtain written consent before disclosure\n   - Log all disclosures (except directory info)\n   - Maintain disclosure records for inspection",
  
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
  
  "metadata": {
    "mcpEngineId": "family-educational-rights-and-privacy-act-ferpa",
    "timestamp": "2025-12-01T14:30:00.000Z",
    "enhanced": true,
    "federalRegisterEnhanced": false,
    "structuredFieldsIncluded": true,
    "source": "MCP_ENGINE",
    "regulationSource": "34 CFR 99",
    "dataQualityScore": 95,
    "certaintyGrade": "A"
  }
}
```

---

## 🗺️ REGULATION ID MAPPING

### Top 10 Demo Regulations (Friday Dec 5)

These are the regulations we'll demo to counsel. **CRITICAL: Ensure these IDs exist in EdSteward database.**

| MCP Engine Slug | EdSteward ID | Regulation Name |
|----------------|--------------|-----------------|
| `clery-act` | **55** | Jeanne Clery Disclosure of Campus Security Policy and Campus Crime Statistics Act |
| `family-educational-rights-and-privacy-act-ferpa` | **51** | Family Educational Rights and Privacy Act (FERPA) |
| `title-ix-of-the-education-amendment-of-1972` | **61** | Title IX of the Education Amendments of 1972 |
| `higher-education-act-title-iv-student-financial-a` | **26** | Higher Education Act - Title IV (Student Financial Aid) |
| `violence-against-women-reauthorization-act` | **55** | Violence Against Women Reauthorization Act (VAWA) |
| `americans-with-disabilities-act-of-1990` | **2** | Americans with Disabilities Act of 1990 (ADA) |
| `section-504-of-the-rehabilitation-act-of-1973` | **2** | Section 504 of the Rehabilitation Act of 1973 |
| `title-vi-of-the-civil-rights-act-of-1964` | **62** | Title VI of the Civil Rights Act of 1964 |
| `technology-education-and-copyright-harmonization-a` | **25** | Technology, Education and Copyright Harmonization Act (TEACH Act) |
| `drug-free-schools-and-communities-act` | **60** | Drug-Free Schools and Communities Act |

### All Federal Regulations (295 Total)

The MCP Engine monitors 295 federal regulations. See `compmat.csv` for the complete list with EdSteward ID mappings (column: `master_key_field`).

### PA State Regulations (52 Total)

Pennsylvania state-specific regulations are also monitored. These may need new EdSteward records created.

---

## 🔧 IMPLEMENTATION PROMPT FOR EDSTEWARD AI

### Task: Implement Regulation Update Receiver

**Context:**
Your EdSteward system will receive real-time regulation updates from an external system called MCP Engine. You need to create an API endpoint that accepts these updates, validates them, stores them in your database, and responds appropriately.

**Requirements:**

1. **Create API Endpoint**
   - Route: `POST /api/regulation-updates`
   - Accept JSON payload
   - Validate required fields
   - Return JSON response

2. **Database Schema**
   ```javascript
   // RegulationUpdate model
   {
     id: Integer (auto-increment),
     regulationId: Integer (foreign key to Regulations table),
     name: String,
     originalContent: Text,
     updatedContent: Text (required),
     summary: Text,
     requirements: Text (markdown format),
     filingDeadlines: JSON (array of deadline objects),
     deadline: String,
     deadlineMonth: String,
     deadlineLabel: String,
     reportingRequirements: Text,
     effectiveDate: Date,
     enactedDate: Date,
     status: Enum('pending', 'reviewed', 'approved', 'rejected'),
     metadata: JSON,
     createdAt: DateTime,
     updatedAt: DateTime
   }
   ```

3. **Validation Rules**
   - `regulationId` must exist in Regulations table
   - `updatedContent` is required (min 100 characters)
   - `name` is required
   - `status` defaults to 'pending'
   - Reject if regulation ID not found

4. **Success Response**
   ```javascript
   res.status(200).json({
     success: true,
     update: {
       id: createdUpdate.id,
       regulationId: createdUpdate.regulationId,
       status: createdUpdate.status
     }
   });
   ```

5. **Error Responses**
   - 400: Validation error (missing required fields)
   - 404: Regulation ID not found
   - 500: Internal server error

**Example Implementation (Express.js):**

```javascript
// POST /api/regulation-updates
app.post('/api/regulation-updates', async (req, res) => {
  try {
    const {
      regulationId,
      name,
      originalContent,
      updatedContent,
      summary,
      requirements,
      filingDeadlines,
      deadline,
      deadlineMonth,
      deadlineLabel,
      reportingRequirements,
      effectiveDate,
      enactedDate,
      status,
      metadata
    } = req.body;

    // Validate required fields
    if (!regulationId || !updatedContent || !name) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Missing required fields: regulationId, updatedContent, name'
        }
      });
    }

    // Check if regulation exists in your database
    const regulation = await Regulation.findByPk(regulationId);
    if (!regulation) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'REGULATION_NOT_FOUND',
          message: `Regulation with ID ${regulationId} not found`
        }
      });
    }

    // Create regulation update record
    const update = await RegulationUpdate.create({
      regulationId,
      name,
      originalContent,
      updatedContent,
      summary,
      requirements,
      filingDeadlines: JSON.stringify(filingDeadlines), // If using JSON field
      deadline,
      deadlineMonth,
      deadlineLabel,
      reportingRequirements,
      effectiveDate,
      enactedDate,
      status: status || 'pending',
      metadata: JSON.stringify(metadata)
    });

    // Optional: Trigger notification to admins
    // await notifyAdmins(update);

    // Optional: Emit WebSocket event for real-time UI update
    // io.emit('regulation-update', { updateId: update.id, regulationId });

    res.status(200).json({
      success: true,
      update: {
        id: update.id,
        regulationId: update.regulationId,
        status: update.status
      }
    });

  } catch (error) {
    console.error('Error creating regulation update:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message
      }
    });
  }
});
```

**Testing:**
After implementing, test with this curl command:
```bash
curl -X POST http://localhost:3000/api/regulation-updates \
  -H "Content-Type: application/json" \
  -d '{
    "regulationId": 51,
    "name": "FERPA Test",
    "updatedContent": "Test content for FERPA regulation update",
    "status": "pending",
    "metadata": { "source": "MCP_ENGINE", "timestamp": "2025-12-01T10:00:00Z" }
  }'
```

Expected response:
```json
{
  "success": true,
  "update": {
    "id": 1,
    "regulationId": 51,
    "status": "pending"
  }
}
```

---

## 🧪 TESTING CHECKLIST

### Pre-Demo Testing (Do This Before Friday)

**Test 1: Health Check**
```bash
curl http://localhost:3000/api/health
```
Expected: `200 OK` with health status

**Test 2: Single Regulation Update (FERPA)**
```bash
curl -X POST http://localhost:3000/api/regulation-updates \
  -H "Content-Type: application/json" \
  -d '{
    "regulationId": 51,
    "name": "FERPA - Test Update",
    "originalContent": "Old text",
    "updatedContent": "Updated FERPA regulation text...",
    "summary": "FERPA provides student rights...",
    "requirements": "### Requirements\n1. Annual notification",
    "filingDeadlines": [{"type": "Annual", "description": "Notification", "date": "Beginning of year"}],
    "status": "pending",
    "metadata": {"source": "MCP_ENGINE"}
  }'
```
Expected: `200 OK` with update ID

**Test 3: All 10 Demo Regulations**
- Send one update for each of the 10 regulations
- Verify all 10 appear in EdSteward database
- Check that EdSteward IDs match (51, 55, 61, 26, 2, 62, 25, 60)

**Test 4: Error Handling**
```bash
# Test missing required field
curl -X POST http://localhost:3000/api/regulation-updates \
  -H "Content-Type: application/json" \
  -d '{"regulationId": 51}'
```
Expected: `400 Bad Request` with validation error

```bash
# Test non-existent regulation ID
curl -X POST http://localhost:3000/api/regulation-updates \
  -H "Content-Type: application/json" \
  -d '{
    "regulationId": 99999,
    "name": "Test",
    "updatedContent": "Test content"
  }'
```
Expected: `404 Not Found` with regulation not found error

---

## 🔗 ENVIRONMENT CONFIGURATION

### What MCP Engine Needs From You

Please provide the following configuration details:

1. **EdSteward Base URL**
   ```
   Example: http://localhost:3000
   Or: https://edsteward.yourschool.edu
   ```

2. **API Endpoint Path** (if different from `/api/regulation-updates`)
   ```
   Default: POST {BASE_URL}/api/regulation-updates
   Custom: ?
   ```

3. **Authentication** (if required)
   ```
   Options:
   - None (no auth required)
   - API Key: Provide key and header name
   - Bearer Token: Provide token
   - Basic Auth: Provide username/password
   ```

4. **WebSocket URL** (optional, for real-time updates)
   ```
   Example: ws://localhost:3000/ws
   Or: wss://edsteward.yourschool.edu/websocket
   ```

5. **Rate Limiting** (if any)
   ```
   Max requests per minute: ?
   Burst limit: ?
   ```

### MCP Engine Configuration

Once you provide the above, I'll configure MCP Engine with:

```bash
# .env configuration
EDSTEWARD_URL=http://localhost:3000
EDSTEWARD_API_KEY=your-api-key-if-needed
EDSTEWARD_WS_URL=ws://localhost:3000/ws
```

---

## 🚀 FRIDAY DEMO WORKFLOW

### What Will Happen During Demo

1. **MCP Engine Running**
   - Monitoring 295 federal regulations
   - Delivery system active on port 3051

2. **Trigger Manual Update** (Live Demo)
   ```bash
   # We'll trigger an update for one of the 10 regulations
   # For example, FERPA (ID: 51)
   node test-single-regulation-delivery.js ferpa
   ```

3. **MCP Engine Sends Update**
   - Detects "change" (simulated for demo)
   - Packages complete payload
   - POSTs to EdSteward endpoint

4. **EdSteward Receives Update**
   - Your endpoint validates payload
   - Stores in database
   - Returns success response

5. **Confirmation**
   - MCP Engine logs success
   - EdSteward UI shows new update (if you have real-time updates)
   - Counsel sees end-to-end integration working

### Demo Talking Points

"The MCP Engine monitors 295 federal education regulations in real-time. When a regulation changes, it's automatically detected, processed, and delivered to EdSteward within seconds. Let me show you..."

[Trigger update]

"There - the system just detected a change to FERPA, packaged the complete regulation text, summary, requirements, and deadlines, and sent it to EdSteward. You can see the update now in EdSteward's database with status 'pending' for review."

---

## 📊 PAYLOAD FIELD REFERENCE

### Required Fields

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `regulationId` | Integer | EdSteward regulation ID | `51` |
| `name` | String | Regulation display name | `"FERPA"` |
| `updatedContent` | String (Text) | Full regulation text | `"Educational institutions must..."` |

### Structured Data Fields (Recommended)

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `summary` | String | 2-3 paragraph summary | `"FERPA provides students..."` |
| `requirements` | String (Markdown) | Compliance requirements | `"### Key Requirements\n1. Annual notification..."` |
| `filingDeadlines` | Array[Object] | Deadline objects | `[{type: "Annual", date: "Sept 1"}]` |

### Legacy Deadline Fields (For Backward Compatibility)

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `deadline` | String | Human-readable deadline | `"Annual"` |
| `deadlineMonth` | String | Month number (1-14) | `"9"` |
| `deadlineLabel` | String | Full label | `"9-September"` |
| `reportingRequirements` | String | What must be filed | `"Annual notification"` |
| `effectiveDate` | Date | When regulation took effect | `"1974-11-19"` |
| `enactedDate` | Date | When regulation was passed | `"1974-08-21"` |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `originalContent` | String | Previous version (for updates) |
| `status` | Enum | `"pending"`, `"reviewed"`, etc. |
| `metadata` | Object | Additional context and tracking data |

### Metadata Object

```json
{
  "mcpEngineId": "family-educational-rights-and-privacy-act-ferpa",
  "timestamp": "2025-12-01T14:30:00.000Z",
  "enhanced": true,
  "federalRegisterEnhanced": false,
  "structuredFieldsIncluded": true,
  "source": "MCP_ENGINE",
  "regulationSource": "34 CFR 99",
  "dataQualityScore": 95,
  "certaintyGrade": "A"
}
```

---

## 🐛 TROUBLESHOOTING

### Common Issues

**Issue 1: Connection Refused**
```
Error: connect ECONNREFUSED 127.0.0.1:3000
```
**Solution:** Ensure EdSteward server is running on the specified port.

**Issue 2: 404 Not Found**
```
Error: POST /api/regulation-updates returned 404
```
**Solution:** Verify endpoint path is correct. Check your route configuration.

**Issue 3: 400 Validation Error**
```
Error: Missing required fields
```
**Solution:** Check that your endpoint validation matches expected payload structure.

**Issue 4: Regulation ID Not Found**
```
Error: Regulation with ID 51 not found
```
**Solution:** Ensure EdSteward database has records for all 10 demo regulation IDs.

**Issue 5: Timeout**
```
Error: Request timeout after 10000ms
```
**Solution:** Check network connectivity. Increase timeout if needed. Optimize database queries.

### Debug Mode

Enable verbose logging in MCP Engine:
```bash
DEBUG=mcp:delivery npm start
```

This will show detailed logs of every EdSteward integration attempt.

---

## 📞 COORDINATION CHECKLIST

### Before Friday Demo

- [ ] EdSteward AI implements POST `/api/regulation-updates` endpoint
- [ ] Endpoint tested with curl (see Testing Checklist above)
- [ ] All 10 demo regulation IDs exist in EdSteward database (51, 55, 61, 26, 2, 62, 25, 60)
- [ ] EdSteward provides base URL to MCP Engine team
- [ ] MCP Engine configures EDSTEWARD_URL environment variable
- [ ] End-to-end test: MCP Engine → EdSteward (one regulation)
- [ ] End-to-end test: All 10 demo regulations
- [ ] Verify updates appear in EdSteward database
- [ ] Confirm response format matches specification
- [ ] Test error handling (invalid ID, missing fields)
- [ ] (Optional) WebSocket notifications working
- [ ] Demo rehearsal with both systems running

### Day of Demo

- [ ] Both systems running and healthy
- [ ] Network connectivity verified
- [ ] Test regulation update ready to trigger
- [ ] EdSteward UI ready to show received update
- [ ] Backup plan if network issues (show logs instead)

---

## 🎯 SUCCESS CRITERIA

**Integration is successful when:**

✅ MCP Engine can POST to EdSteward endpoint  
✅ EdSteward accepts and stores regulation updates  
✅ All 10 demo regulations have correct EdSteward IDs  
✅ Payload includes all structured fields (summary, requirements, deadlines)  
✅ EdSteward responds with success/failure appropriately  
✅ Updates appear in EdSteward database immediately  
✅ Error handling works for invalid requests  
✅ End-to-end demo completes in < 5 seconds  

---

## 📧 CONTACT & NEXT STEPS

**Immediate Next Steps:**

1. EdSteward AI: Implement endpoint using code example above
2. EdSteward AI: Test with curl commands provided
3. EdSteward AI: Provide base URL to MCP Engine team
4. Both teams: Run end-to-end integration test
5. Both teams: Demo rehearsal Thursday Dec 4

**Questions?**

If EdSteward AI has questions or needs clarification:
- Check this document first (it's comprehensive!)
- Review payload example for FERPA (complete working example)
- Test with curl commands (no MCP Engine required initially)
- Coordinate timing for joint integration test

---

**Document Version:** 1.0  
**Last Updated:** December 1, 2025  
**Status:** ✅ Ready for EdSteward Implementation  
**Est. Implementation Time:** 1-2 hours for EdSteward AI  
**Demo Date:** Friday, December 5, 2025  

