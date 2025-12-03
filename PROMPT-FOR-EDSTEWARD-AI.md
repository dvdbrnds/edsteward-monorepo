# 🤖 Prompt for EdSteward AI Developer

**Copy and paste this entire message to EdSteward AI:**

---

Hi! I need you to implement a regulation update receiver endpoint for our EdSteward system. The MCP Engine will be sending real-time regulation updates to us, and we need to accept and store them.

## What You Need to Build

**Endpoint:** `POST /api/regulation-updates`

**Time Estimate:** 1-2 hours

**Complete Implementation Guide:** `EDSTEWARD-AI-DEVELOPER-INTEGRATION-GUIDE.md` (attached - 60 pages with everything you need)

---

## Quick Start: Copy This Code

Here's the complete Express.js implementation you can copy directly:

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
      filingDeadlines: JSON.stringify(filingDeadlines),
      deadline,
      deadlineMonth,
      deadlineLabel,
      reportingRequirements,
      effectiveDate,
      enactedDate,
      status: status || 'pending',
      metadata: JSON.stringify(metadata)
    });

    // Return success response
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

---

## Database Schema

You'll need a `RegulationUpdate` model with these fields:

```javascript
{
  id: Integer (auto-increment, primary key),
  regulationId: Integer (foreign key to Regulations table),
  name: String,
  originalContent: Text,
  updatedContent: Text (required),
  summary: Text,
  requirements: Text,
  filingDeadlines: JSON,
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

---

## Example Payload You'll Receive

Here's what the MCP Engine will POST (FERPA example):

```json
{
  "regulationId": 51,
  "name": "Family Educational Rights and Privacy Act (FERPA)",
  "originalContent": "Previous version...",
  "updatedContent": "Full regulation text from 34 CFR 99. Educational institutions must provide students with the right to inspect and review their education records, request amendments, and control disclosure of information...",
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
  "reportingRequirements": "Annual notification to students",
  "effectiveDate": "1974-11-19",
  "enactedDate": "1974-08-21",
  
  "metadata": {
    "mcpEngineId": "family-educational-rights-and-privacy-act-ferpa",
    "timestamp": "2025-12-01T14:30:00.000Z",
    "enhanced": true,
    "structuredFieldsIncluded": true,
    "source": "MCP_ENGINE"
  }
}
```

---

## Critical: These 10 Regulation IDs Must Exist

Before testing, verify these IDs exist in your Regulations table:

| EdSteward ID | Regulation Name |
|--------------|-----------------|
| **51** | FERPA |
| **55** | Clery Act |
| **61** | Title IX |
| **26** | Title IV (Student Financial Aid) |
| **2** | ADA / Section 504 |
| **62** | Title VI |
| **25** | TEACH Act |
| **60** | Drug-Free Schools Act |

---

## Testing Instructions

### 1. Test with curl

After implementing, test with this command:

```bash
curl -X POST http://localhost:3000/api/regulation-updates \
  -H "Content-Type: application/json" \
  -d '{
    "regulationId": 51,
    "name": "FERPA Test",
    "updatedContent": "Test content for FERPA regulation update with at least 100 characters to pass validation checks.",
    "summary": "This is a test summary for FERPA",
    "status": "pending",
    "metadata": {
      "source": "MCP_ENGINE",
      "timestamp": "2025-12-01T10:00:00Z"
    }
  }'
```

**Expected Response:**
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

### 2. Test Error Handling

```bash
# Test missing required field
curl -X POST http://localhost:3000/api/regulation-updates \
  -H "Content-Type: application/json" \
  -d '{"regulationId": 51}'
```

**Expected:** 400 Bad Request with validation error

```bash
# Test non-existent regulation ID
curl -X POST http://localhost:3000/api/regulation-updates \
  -H "Content-Type: application/json" \
  -d '{
    "regulationId": 99999,
    "name": "Test",
    "updatedContent": "Test content with sufficient length to pass validation requirements."
  }'
```

**Expected:** 404 Not Found with regulation not found error

---

## When You're Done

1. **Test with curl** (both success and error cases)
2. **Verify data appears** in your RegulationUpdates table
3. **Reply with:**
   - ✅ Endpoint is live at: `http://your-url-here`
   - ✅ All 10 regulation IDs verified in database
   - ✅ curl tests passed

We'll then run our automated integration test to verify end-to-end delivery.

---

## Timeline

- **Implement:** Today/Tuesday (1-2 hours)
- **Joint Test:** Thursday Dec 4
- **Demo:** Friday Dec 5

---

## Questions?

Check the complete implementation guide first: `EDSTEWARD-AI-DEVELOPER-INTEGRATION-GUIDE.md`

It includes:
- ✅ Full database schema details
- ✅ Additional code examples
- ✅ Troubleshooting guide
- ✅ Friday demo workflow
- ✅ All 295 regulation ID mappings

---

## What You Get

Once implemented, you'll receive:
- ✅ Real-time regulation updates from MCP Engine
- ✅ Complete data: full text (1200-2200 chars)
- ✅ Professional summaries (80-2200 chars)
- ✅ Structured deadlines (2-3 per regulation)
- ✅ Compliance requirements (markdown formatted)
- ✅ All metadata for tracking and auditing

---

**We're ready on our side - just need your endpoint! 🚀**

Let us know when you're done and we'll test the integration together.

