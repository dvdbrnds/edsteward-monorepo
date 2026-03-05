# Enhanced Regulation JSON Schema

**Version**: 2.0.0
**Updated**: 2026-03-03
**Breaking change from v1**: Adds `jurisdiction`, `deadlines`, `relationships`, `tags` blocks.

## Overview

Each file in `enhanced-regulations/` is a single regulation's enhanced data. Version 2.0 adds structured jurisdiction metadata, multiple deadlines, regulation relationships, and multi-value tags.

All new files MUST use v2 format. Existing v1 files remain backward-compatible (missing fields default to federal US jurisdiction).

## Schema

```json
{
  "regulationId": "string (required) — kebab-case slug, max 200 chars",
  "schemaVersion": "2.0",

  "jurisdiction": {
    "source": "string (required) — federal | state | international | private-organization | accreditor | industry-association",
    "countryCode": "string — ISO 3166 alpha-3 (default: US)",
    "stateCodes": ["string — two-letter US state codes, empty array for non-state"],
    "label": "string — human-readable jurisdiction label",
    "regulatoryBody": "string — issuing authority name",
    "actNumber": "string | null — e.g. Act 55 of 2022",
    "applicability": "string — all | public | private | for-profit (default: all)"
  },

  "enhanced": {
    "fullText": "string (required) — complete regulation text, 2000-5000 chars",
    "summary": "string (required) — plain-language summary, 150-400 chars",
    "requirements": "string (required) — markdown-formatted compliance requirements",
    "reportingRequirements": "string | object | null — reporting/filing obligations"
  },

  "deadlines": [
    {
      "date": "string — ISO date (2024-12-31) or descriptor (continuous, event-triggered)",
      "label": "string — short label (MOU Establishment, Annual Report)",
      "type": "string — compliance | reporting | filing | renewal",
      "description": "string — detailed description",
      "isRecurring": "boolean",
      "recurrenceFrequency": "string | null — annual, quarterly, monthly"
    }
  ],

  "relationships": [
    {
      "targetSlug": "string — item_id of the related regulation",
      "type": "string — implements | amends | extends | supersedes | related | conflicts | complements",
      "notes": "string — explanation of the relationship"
    }
  ],

  "tags": ["string — category, topic, or keyword tags"],

  "audit": {
    "score": "number — 0-100 quality score",
    "certainty": "string — A, B, C, or D",
    "scores": {
      "content": "number",
      "summary": "number",
      "requirements": "number",
      "deadlines": "number"
    },
    "timestamp": "string — ISO 8601"
  },

  "statute": "string — primary legal citation",
  "topic": "string — primary topic (kept for backward compat)"
}
```

## Examples

### Federal Regulation (v2)

```json
{
  "regulationId": "family-educational-rights-and-privacy-act-ferpa",
  "schemaVersion": "2.0",
  "jurisdiction": {
    "source": "federal",
    "countryCode": "US",
    "stateCodes": [],
    "label": "United States Federal",
    "regulatoryBody": "U.S. Department of Education",
    "actNumber": null,
    "applicability": "all"
  },
  "enhanced": {
    "fullText": "...",
    "summary": "...",
    "requirements": "...",
    "reportingRequirements": "..."
  },
  "deadlines": [
    {
      "date": "continuous",
      "label": "Student Record Access Requests",
      "type": "compliance",
      "description": "Must respond to student record access requests within 45 days",
      "isRecurring": false,
      "recurrenceFrequency": null
    }
  ],
  "relationships": [],
  "tags": ["Academic Affairs", "Student Records", "Privacy"],
  "audit": { "score": 95, "certainty": "A", "timestamp": "2025-12-05T18:00:00.000Z" },
  "statute": "20 U.S.C. § 1232g",
  "topic": "Privacy"
}
```

### State Regulation (v2)

```json
{
  "regulationId": "pennsylvania-act-55-of-2022-sexual-violence-higher-ed",
  "schemaVersion": "2.0",
  "jurisdiction": {
    "source": "state",
    "countryCode": "US",
    "stateCodes": ["PA"],
    "label": "Pennsylvania",
    "regulatoryBody": "Pennsylvania Department of Education",
    "actNumber": "Act 55 of 2022",
    "applicability": "all"
  },
  "enhanced": {
    "fullText": "...",
    "summary": "...",
    "requirements": "...",
    "reportingRequirements": "..."
  },
  "deadlines": [
    {
      "date": "2023-07-01",
      "label": "Educational Program Implementation",
      "type": "compliance",
      "description": "Establish educational program in consultation with rape crisis center and DV program",
      "isRecurring": false,
      "recurrenceFrequency": null
    },
    {
      "date": "2024-12-31",
      "label": "MOU Establishment",
      "type": "compliance",
      "description": "MOU with at least one local rape crisis center and one DV program per campus",
      "isRecurring": false,
      "recurrenceFrequency": null
    }
  ],
  "relationships": [
    {
      "targetSlug": "title-ix-of-the-education-amendment-of-1972",
      "type": "extends",
      "notes": "State-level implementation extending federal Title IX sexual violence requirements"
    },
    {
      "targetSlug": "violence-against-women-reauthorization-act",
      "type": "extends",
      "notes": "Complements VAWA/Campus SaVE Act requirements at state level"
    }
  ],
  "tags": ["Campus Safety and Security", "Sexual Misconduct", "Student Life and Services"],
  "audit": { "score": 92, "certainty": "A", "timestamp": "2026-03-03T00:00:00.000Z" },
  "statute": "24 P.S. § 20-2001 et seq. (Act 55 of 2022)",
  "topic": "Sexual Misconduct"
}
```

### International Regulation (v2)

```json
{
  "regulationId": "general-data-protection-regulation",
  "schemaVersion": "2.0",
  "jurisdiction": {
    "source": "international",
    "countryCode": "EU",
    "stateCodes": [],
    "label": "European Union",
    "regulatoryBody": "European Parliament and Council of the European Union",
    "actNumber": "Regulation (EU) 2016/679",
    "applicability": "all"
  },
  "enhanced": { "..." },
  "deadlines": [],
  "relationships": [],
  "tags": ["Privacy and Data Security", "International"],
  "audit": { "..." },
  "statute": "Regulation (EU) 2016/679",
  "topic": "Data Privacy"
}
```

### Accreditor Regulation (v2)

```json
{
  "regulationId": "msche-standards-for-accreditation",
  "schemaVersion": "2.0",
  "jurisdiction": {
    "source": "accreditor",
    "countryCode": "US",
    "stateCodes": [],
    "label": "MSCHE",
    "regulatoryBody": "Middle States Commission on Higher Education",
    "actNumber": null,
    "applicability": "all"
  },
  "enhanced": { "..." },
  "deadlines": [],
  "relationships": [],
  "tags": ["Accreditation", "Institutional Effectiveness"],
  "audit": { "..." },
  "statute": null,
  "topic": "Accreditation"
}
```

## Backward Compatibility

Files missing the v2 fields are treated as v1:
- No `jurisdiction` block: defaults to `{ source: "federal", countryCode: "US", stateCodes: [] }`
- No `deadlines`: defaults to `[]`
- No `relationships`: defaults to `[]`
- No `tags`: inferred from `topic` field
- No `schemaVersion`: treated as `"1.0"`
