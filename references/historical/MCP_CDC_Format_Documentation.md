# MCP Change Data Capture (CDC) Format Documentation

This document provides a comprehensive overview of the CDC format used in the MCP integration for the regulatory compliance platform.

## Schema Definitions

### RegulationVersion Interface

```typescript
export interface RegulationVersion {
  changes: {
    field: string;
    oldValue: string;
    newValue: string;
    type: 'addition' | 'deletion' | 'modification';
  }[];
  mergeMetadata?: {
    mergedFrom: string[];
    conflictResolutions?: Record<string, string>;
  };
}
```

### ValidationLevel Enum

```typescript
export enum ValidationLevel {
  A = "A", // Basic structural validation
  B = "B", // Content-level validation
  C = "C", // Business rules validation
  D = "D"  // Contextual/cross-reference validation
}
```

### Regulation Version Schema

```typescript
const regulationVersionSchema = z.object({
  regulationId: z.number(),
  content: z.string(),
  source: z.string(),
  sourceId: z.string().optional(),
  validationStatus: z.array(z.object({
    level: z.nativeEnum(ValidationLevel),
    passed: z.boolean(),
    errors: z.array(z.object({
      field: z.string(),
      message: z.string(),
      code: z.string(),
      severity: z.enum(['warning', 'error', 'critical'])
    })),
    validatedAt: z.coerce.date(),
    validatedBy: z.number().optional()
  })).optional()
});
```

### Version Conflict Schema

```typescript
const versionConflictSchema = z.object({
  regulationId: z.number(),
  localVersionId: z.number(),
  remoteVersionId: z.string(),
  conflicts: z.array(z.object({
    field: z.string(),
    localValue: z.string(),
    remoteValue: z.string(),
    resolutionStrategy: z.enum(['local', 'remote', 'merge', 'manual'])
  }))
});
```

### RegulationAction Interface

```typescript
export interface RegulationAction {
  type: 'attestation' | 'website_publish' | 'community_communication' | 'agency_submission';
  enabled: boolean;
  required: boolean;
  dueDate?: Date;
  completedDate?: Date;
  status: 'pending' | 'in_progress' | 'completed';
  notes?: string;
  completedBy?: {
    userId: number;
    username: string;
    fullName?: string;
  };
  completedAt?: Date;
}
```

## Database Tables

The MCP integration uses the following tables:

1. `regulation_versions` - Stores version history of regulations
2. `validation_status` - Stores validation results for each regulation version
3. `sync_control` - Controls synchronization settings and status
4. `notification_queue` - Manages notifications for regulation updates
5. `version_conflicts` - Tracks conflicts between local and remote versions

## Sample CDC Update File (Comprehensive)

```json
{
  "regulationId": 4903,
  "content": "# Davegulation 8: Research Ethics and Integrity\n\n## Purpose\nTo establish guidelines for ethical research practices and maintain integrity in all academic and scientific endeavors conducted within the institution.\n\n## Scope\nThis regulation applies to all faculty, staff, students, and affiliated researchers engaging in any form of research activity.\n\n## Requirements\n\n### Section 1: General Research Ethics\n1.1 All research involving human subjects must receive prior approval from the Institutional Review Board (IRB).\n1.2 Researchers must obtain informed consent from all participants.\n1.3 Research design must minimize risks to participants while maximizing benefits.\n\n### Section 2: Data Management\n2.1 Research data must be stored securely with appropriate access controls.\n2.2 Primary research data should be retained for a minimum of five years after publication.\n2.3 Data sharing should follow FAIR principles (Findable, Accessible, Interoperable, Reusable).\n\n### Section 3: Publication and Authorship\n3.1 All individuals who make significant intellectual contributions should be listed as authors.\n3.2 Order of authorship should reflect the relative contributions of authors.\n3.3 All sources must be properly cited and acknowledgments made appropriately.\n\n### Section 4: Conflict of Interest\n4.1 All potential conflicts of interest must be disclosed prior to initiating research.\n4.2 Financial relationships that could influence research outcomes must be reported annually.\n4.3 Researchers should recuse themselves from reviews or decisions where conflicts exist.\n\n### Section 5: Research Misconduct\n5.1 Fabrication, falsification, or plagiarism in research is prohibited.\n5.2 Suspected misconduct should be reported through established channels.\n5.3 Whistleblowers shall be protected from retaliation.\n\n## Compliance and Enforcement\nFailure to comply with these regulations may result in disciplinary action, termination of research projects, and potential legal consequences.",
  "source": "mcp_orchestrator",
  "sourceId": "mcp-update-20250519-001",
  "version_number": 2,
  "created_at": "2025-05-19T18:30:45Z",
  "changes": [
    {
      "field": "requirements.section3.3.1",
      "oldValue": "All individuals who make substantial intellectual contributions should be listed as authors.",
      "newValue": "All individuals who make significant intellectual contributions should be listed as authors.",
      "type": "modification"
    },
    {
      "field": "requirements.section2.2.3",
      "oldValue": "Data sharing should follow open science principles when possible.",
      "newValue": "Data sharing should follow FAIR principles (Findable, Accessible, Interoperable, Reusable).",
      "type": "modification"
    },
    {
      "field": "requirements.section4.4.2",
      "oldValue": "Financial relationships that could influence research outcomes must be reported.",
      "newValue": "Financial relationships that could influence research outcomes must be reported annually.",
      "type": "modification"
    },
    {
      "field": "requirements.section5",
      "oldValue": "",
      "newValue": "### Section 5: Research Misconduct\n5.1 Fabrication, falsification, or plagiarism in research is prohibited.\n5.2 Suspected misconduct should be reported through established channels.\n5.3 Whistleblowers shall be protected from retaliation.",
      "type": "addition"
    },
    {
      "field": "compliance",
      "oldValue": "Failure to comply with these regulations may result in disciplinary action and termination of research projects.",
      "newValue": "Failure to comply with these regulations may result in disciplinary action, termination of research projects, and potential legal consequences.",
      "type": "modification"
    }
  ],
  "validationStatus": [
    {
      "level": "A",
      "passed": true,
      "errors": [],
      "validatedAt": "2025-05-19T18:30:45Z"
    },
    {
      "level": "B",
      "passed": true,
      "errors": [],
      "validatedAt": "2025-05-19T18:31:02Z"
    },
    {
      "level": "C",
      "passed": false,
      "errors": [
        {
          "field": "requirements.section5.5.2",
          "message": "Reference to 'established channels' needs further specification for procedural clarity",
          "code": "REF-102",
          "severity": "warning"
        }
      ],
      "validatedAt": "2025-05-19T18:31:15Z"
    },
    {
      "level": "D",
      "passed": false,
      "errors": [
        {
          "field": "requirements.section1.1.1",
          "message": "Cross-reference to IRB approval process is missing",
          "code": "XR-101",
          "severity": "warning"
        },
        {
          "field": "requirements.section4",
          "message": "Conflict with institutional policy #2345 regarding disclosure timelines",
          "code": "CP-203",
          "severity": "error"
        }
      ],
      "validatedAt": "2025-05-19T18:31:30Z"
    }
  ],
  "mergeMetadata": {
    "mergedFrom": ["local-v1", "mcp-central-v1.5"],
    "conflictResolutions": {
      "requirements.section3.3.2": "remote",
      "requirements.section4.4.1": "local",
      "compliance": "merge"
    }
  },
  "relatedRegulations": [
    {
      "id": 4567,
      "itemId": "DAVE-7-015",
      "name": "Data Privacy and Security",
      "relationshipType": "referenced"
    },
    {
      "id": 4789,
      "itemId": "DAVE-9-002",
      "name": "Academic Integrity",
      "relationshipType": "affects"
    }
  ],
  "notificationQueue": [
    {
      "recipientType": "role",
      "recipientId": "research_admin",
      "message": "New research misconduct section added to Research Ethics regulation",
      "channel": "email",
      "priority": "high",
      "scheduledFor": "2025-05-20T09:00:00Z"
    },
    {
      "recipientType": "department",
      "recipientId": "all_researchers",
      "message": "Annual conflict of interest reporting requirement updated",
      "channel": "internal",
      "priority": "medium",
      "scheduledFor": "2025-05-21T09:00:00Z"
    }
  ],
  "syncControl": {
    "syncState": "completed",
    "syncSettings": {
      "frequency": "weekly",
      "priority": "high",
      "includeContent": true,
      "validateOnSync": true,
      "notifyOnChanges": true,
      "autoResolveNonConflicts": true
    },
    "lastSyncedAt": "2025-05-19T18:32:45Z"
  },
  "auditTrail": [
    {
      "action": "created",
      "timestamp": "2025-01-15T11:23:45Z",
      "userId": 42,
      "username": "j.smith",
      "details": "Initial regulation creation"
    },
    {
      "action": "edited",
      "timestamp": "2025-03-28T14:15:30Z",
      "userId": 56,
      "username": "a.johnson",
      "details": "Updated data management section"
    },
    {
      "action": "synced",
      "timestamp": "2025-05-19T18:30:45Z",
      "userId": 0,
      "username": "system",
      "details": "Synchronized with MCP orchestrator"
    }
  ]
}
```

## CDC Conflict Example

```json
{
  "regulationId": 4903,
  "localVersionId": 2,
  "remoteVersionId": "mcp-version-1234",
  "conflicts": [
    {
      "field": "requirements.section2.2.1",
      "localValue": "Research data must be stored securely with appropriate access controls.",
      "remoteValue": "Research data must be stored securely with appropriate access controls and encrypted when at rest.",
      "resolutionStrategy": "remote"
    },
    {
      "field": "requirements.section3.3.3",
      "localValue": "All sources must be properly cited and acknowledgments made appropriately.",
      "remoteValue": "All sources must be properly cited according to institutional citation standards and acknowledgments made appropriately.",
      "resolutionStrategy": "merge"
    },
    {
      "field": "compliance",
      "localValue": "Failure to comply with these regulations may result in disciplinary action, termination of research projects, and potential legal consequences.",
      "remoteValue": "Non-compliance may result in disciplinary action up to and including termination of employment or expulsion.",
      "resolutionStrategy": "manual"
    }
  ],
  "created_at": "2025-05-19T19:15:30Z",
  "status": "pending_resolution",
  "resolution_deadline": "2025-05-21T19:15:30Z",
  "assigned_to": 56
}
```

## CDC Import/Export Workflow

The CDC process follows these steps:

1. **Capture Changes**: When a regulation is updated, changes are captured at the field level with old and new values.
2. **Validation**: Changes go through a multi-level validation process (A-D levels).
3. **Conflict Detection**: System detects potential conflicts with other versions.
4. **Resolution**: Conflicts are resolved using predefined strategies or manual intervention.
5. **Synchronization**: Changes are synchronized between local and remote systems.
6. **Notification**: Relevant stakeholders are notified based on the nature of changes.

This format allows for efficient tracking and synchronization of regulatory changes across distributed systems while maintaining data integrity and providing clear audit trails.