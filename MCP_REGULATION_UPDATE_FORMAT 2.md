# MCP Engine Regulation Update Format

## Overview
When sending regulation updates from the MCP engine, include ALL of these fields to ensure complete regulation information is updated.

## Required Fields

### 1. **updatedContent** (REQUIRED)
The full text of the regulation.

**Example:**
```
Code of Federal Regulations - Title 29

PART 1600—TECHNOLOGY EDUCATION AND COPYRIGHT HARMONIZATION ACT IMPLEMENTATION

§ 1600.1 Purpose and effective date.
The purpose of this part is to effectuate the technology education...
[Full regulation text]
```

### 2. **requirements** (RECOMMENDED)
Detailed compliance requirements, formatted in markdown.

**Example:**
```
**Key Compliance Requirements:**

1. **Copyright Compliance for Digital Learning**
   - Implement technological measures to prevent unauthorized retention
   - Limit access to enrolled students for specific course sessions
   - Ensure materials are directly related to teaching content

2. **Faculty Training and Authorization**
   - Train faculty on TEACH Act limitations and requirements
   - Establish approval process for copyrighted material use
   - Document faculty acknowledgment of copyright responsibilities

**Documentation Requirements:**
- Maintain records of copyrighted materials used in courses
- Document technological protection measures implemented
- Retain course enrollment records for access verification

**Reporting Requirements:**
- No specific federal reporting required
- Internal compliance audits recommended annually

**Training Requirements:**
- Annual copyright training for all faculty using digital materials
- New faculty orientation on TEACH Act compliance
- IT staff training on technological protection measures
```

### 3. **summary** (RECOMMENDED)
A brief 1-2 sentence summary of what the regulation requires.

**Example:**
```
Permits an instructor to display virtually all types of works during on-line instruction at accredited nonprofit educational institutions without consent of copyright owner, provided that instruction is mediated by an instructor, transmission is intended only for students enrolled in course, and measures are employed to prevent redistribution of transmission and prevent its retention for longer than the class session.
```

### 4. **filingDeadlines** (OPTIONAL)
Any filing or reporting deadlines associated with the regulation.

**Example:**
```
Annual report due: June 30
Faculty certification due: September 1 (beginning of academic year)
Technology audit: December 31
```

## Database Schema

The `regulation_updates` table now supports these fields:

```typescript
{
  id: number;
  regulationId: number;
  name: string;
  originalContent: string;
  updatedContent: string;        // ← Full regulation text
  requirements: string | null;    // ← Compliance requirements (markdown)
  summary: string | null;         // ← Brief summary
  filingDeadlines: string | null; // ← Deadlines
  status: string;
  updateDate: Date;
  // ... other fields
}
```

## Update Process

1. **MCP Engine** sends regulation update with all fields
2. **System** creates entry in `regulation_updates` table (status: "pending")
3. **Admin/Compliance Officer** reviews update on `/regulations/updates` page
4. **Admin** accepts update
5. **System** applies ALL provided fields to the main `regulations` table:
   - `regulation_text` ← `updatedContent`
   - `requirements` ← `requirements`
   - `summary` ← `summary`
   - `filing_deadlines` ← `filingDeadlines`
   - `last_updated` ← current timestamp

## Example MCP Engine Payload

```json
{
  "regulationId": 55,
  "name": "TEACH Act 2024 Update",
  "updatedContent": "Code of Federal Regulations - Title 29\n\nPART 1600—TECHNOLOGY EDUCATION...",
  "requirements": "**Key Compliance Requirements:**\n\n1. **Copyright Compliance...",
  "summary": "Permits an instructor to display virtually all types of works during on-line instruction...",
  "filingDeadlines": "Annual report due: June 30\nFaculty certification due: September 1"
}
```

## What Gets Updated

| Field in regulation_updates | Field in regulations | Status |
|----------------------------|---------------------|--------|
| `updatedContent` | `regulation_text` | ✅ Always updated |
| `requirements` | `requirements` | ✅ Updated if provided |
| `summary` | `summary` | ✅ Updated if provided |
| `filingDeadlines` | `filing_deadlines` | ✅ Updated if provided |
| - | `last_updated` | ✅ Always updated to now |

## Important Notes

- Only `updatedContent` is required; all other fields are optional
- If a field is not provided (null), the existing value in `regulations` table will remain unchanged
- All text fields support markdown formatting
- The MCP engine should extract and structure this information from the source regulation document

