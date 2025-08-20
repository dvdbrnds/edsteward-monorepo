# EdSteward Regulation Update Differential View Specification

## Overview

The EdSteward Regulation Update system provides a sophisticated differential
view for compliance officers to review, analyze, and approve regulation changes.
This document explains how the differential view works and specifies the correct
payload format for the MCP Engine to deliver regulation updates.

## System Architecture

### 1. Data Flow

```
MCP Engine → HTTP POST → EdSteward API → Database Storage → Differential View → User Review → Approval/Rejection
```

### 2. Core Components

- **Diff Calculator Service**: Computes word-level differences using the `diff`
  library
- **Differential View Component**: React component with multiple view modes
- **API Endpoints**: Handle CRUD operations for regulation updates
- **Database Storage**: Persistent storage with audit trail

## Differential View Features

### 1. Three View Modes

#### **Diff View** (Primary)

- **Purpose**: Shows inline differences with color-coded changes
- **Visual**: Green highlighting for additions, red with strikethrough for
  removals
- **Technology**: Uses `diffWords()` from the `diff` library for word-level
  comparison
- **Display**: Renders as inline text with `<span>` elements for each change

#### **Side-by-Side View**

- **Purpose**: Shows original and updated content in parallel columns
- **Layout**: Two-column grid layout
- **Content**: Left column shows original regulation text, right column shows
  updated text
- **Use Case**: Ideal for reviewing large blocks of text changes

#### **Statistics View**

- **Purpose**: Provides quantitative analysis of changes
- **Metrics**:
  - Added content percentage and character count
  - Removed content percentage and character count
  - Total change percentage
  - Document length comparison (before/after)
- **Visualization**: Progress bars showing change proportions

### 2. Change Calculation Algorithm

The system uses the following algorithm to calculate differences:

```typescript
// Word-level diff using the 'diff' library
const differences = diffWords(originalText, updatedText);

// Statistical calculations
addedChars = sum of all added text lengths
removedChars = sum of all removed text lengths
changedChars = addedChars + removedChars

// Percentage calculations (based on original text length)
addedPercentage = (addedChars / originalLength) * 100
removedPercentage = (removedChars / originalLength) * 100
changedPercentage = (changedChars / originalLength) * 100
```

### 3. User Actions

- **Accept**: Approves the update and applies changes to the regulation
- **Reject**: Rejects the update with mandatory reason and signature
- **Defer**: Postpones review for later consideration
- All actions require digital signature for audit compliance

## MCP Engine Payload Specification

### Current Working Format

Based on the terminal logs showing successful integration, the MCP Engine should
use this **simple format**:

```json
{
  "regulationId": 4524,
  "name": "TEACH Act 2024 Update",
  "originalContent": "Previous regulation state...",
  "updatedContent": "New regulation text with changes...",
  "status": "pending"
}
```

### Field Specifications

| Field             | Type   | Required | Description                                                 |
| ----------------- | ------ | -------- | ----------------------------------------------------------- |
| `regulationId`    | number | ✅       | EdSteward regulation ID (e.g., 4524 for REG-66)             |
| `name`            | string | ✅       | Human-readable update title                                 |
| `originalContent` | string | ✅       | **CRITICAL**: Original regulation text for diff calculation |
| `updatedContent`  | string | ✅       | **CRITICAL**: New regulation text with changes              |
| `status`          | string | ❌       | Defaults to "pending"                                       |

### Critical Requirements for Differential View

#### 1. **originalContent Field is MANDATORY**

- **Purpose**: The differential view **requires** both original and updated
  content to calculate differences
- **Error**: Without `originalContent`, the diff calculator cannot determine
  what changed
- **Format**: Should contain the complete original regulation text as plain text

#### 2. **updatedContent Field Format**

- **Purpose**: Contains the new regulation text with all changes applied
- **Format**: Should be plain text, not JSON or complex nested objects
- **Length**: Can be any length, but should be the complete updated regulation
  text

#### 3. **Text Format Best Practices**

- Use plain text format for both `originalContent` and `updatedContent`
- Preserve paragraph breaks and formatting with `\n` characters
- Avoid HTML tags or markdown formatting
- Ensure consistent encoding (UTF-8)

### Alternative Formats (Not Recommended)

The system also supports complex MCP Engine format and TUF-verified format, but
these are processed differently and may not provide optimal differential view
experience:

```json
// Complex MCP Format (converts to JSON string for display)
{
  "regulationId": 4524,
  "name": "TEACH Act 2024 Update",
  "content": {
    "uscText": { "text": "..." },
    "cfrGuidance": { "content": "..." }
  }
}

// TUF Format (for cryptographically verified updates)
{
  "regulationId": "REG-66",
  "verified": true,
  "hash": "sha256hash...",
  "content": { ... }
}
```

## API Endpoints

### Create Regulation Update

```
POST /api/regulation-updates
Content-Type: application/json

Response:
{
  "success": true,
  "updateId": "12",
  "verified": false
}
```

### Get Update Details (for Differential View)

```
GET /api/regulation-updates/:id

Response:
{
  "update": { /* RegulationUpdate object */ },
  "original": { /* Original Regulation object */ },
  "diffData": {
    "differences": [
      { "value": "unchanged text" },
      { "added": true, "value": "new text" },
      { "removed": true, "value": "old text" }
    ],
    "addedPercentage": 15,
    "removedPercentage": 8,
    "changedPercentage": 23,
    "addedChars": 150,
    "removedChars": 80,
    "originalLength": 1000,
    "updatedLength": 1070
  }
}
```

## Integration Verification

### Success Indicators

From the terminal logs, successful integration shows:

```
📋 Regulation update received: { regulationId: 4524, name: '...', ... }
✅ Detected MCP Engine format
✅ Regulation update created successfully: 12
🔌 WebSocket client connected: 10.0.0.140
📡 Received WebSocket message: { type: 'regulation_updated', ... }
📢 Broadcasting regulation update: ID unknown
✅ Broadcasted to 1 clients
```

### Testing Commands

```bash
# Test regulation update creation
curl -X POST http://10.0.0.140:3000/api/regulation-updates \
  -H "Content-Type: application/json" \
  -d '{
    "regulationId": 4524,
    "name": "Test Update",
    "originalContent": "Original regulation text here...",
    "updatedContent": "Updated regulation text with changes...",
    "status": "pending"
  }'

# Test WebSocket notification
echo '{"type":"regulation_updated","data":{"regulationId":4524}}' | \
  wscat -c ws://10.0.0.140:3000/ws
```

## Best Practices for MCP Engine

### 1. Content Preparation

- Extract the current regulation text from EdSteward before sending updates
- Ensure `originalContent` matches exactly what's currently stored
- Apply all changes to create the complete `updatedContent`

### 2. Change Granularity

- Send complete regulation text, not just deltas
- Include context around changes for better diff visualization
- Preserve original formatting and structure

### 3. Update Naming

- Use descriptive names that indicate the nature of changes
- Include regulation identifiers (e.g., "TEACH Act 2024 Update")
- Avoid generic names like "Update" or "Change"

### 4. Error Handling

- Monitor for HTTP 400 responses indicating validation failures
- Check WebSocket connection status for real-time notifications
- Implement retry logic for failed deliveries

## Regulation ID Mapping

| MCP Engine ID | EdSteward ID | Description   |
| ------------- | ------------ | ------------- |
| REG-66        | 4524         | TEACH Act     |
| REG-17        | 4662         | Copyright Act |
| REG-DMCA      | 4663         | DMCA          |

## Conclusion

The differential view system is designed to provide compliance officers with
comprehensive tools to review regulation changes. By following this
specification, the MCP Engine can deliver updates that integrate seamlessly with
EdSteward's review workflow, enabling effective change management and compliance
oversight.

The key to successful integration is providing both `originalContent` and
`updatedContent` as plain text, allowing the diff calculator to generate
meaningful visual comparisons for compliance officers to review.
