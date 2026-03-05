## MCP Engine Compliance Task Generator (January 6, 2026)

### Hybrid Approach (per EdSteward AI)
- **Template regulations** (Clery, FERPA, Title IX): Send `templateHint` only, EdSteward uses curated templates
- **Tier 1 regulations** (ADA, OSHA, Title IV, HIPAA, GLBA): Generate `complianceTasks[]` array
- **Simple regulations**: No tasks, simple attestation workflow

### Task Schema
```typescript
interface MCPComplianceTask {
  tempId: string;           // Unique ID for hierarchy linking
  parentTempId?: string;    // Parent task reference  
  title: string;            // Required
  description: string;      // Required
  instructions?: string;    // Detailed how-to
  assignedRole: string;     // EdSteward role name
  dueDate?: string;         // ISO date or relative
  recurringSchedule?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  evidenceRequired: boolean;
  evidenceType: 'none' | 'document' | 'link' | 'screenshot' | 'attestation' | 'form';
  evidenceInstructions?: string;
  sortOrder: number;
}
```

### EdSteward Standard Roles
- `Director of Campus Safety` - Clery, emergency, safety
- `Registrar` - FERPA, student records
- `Title IX Coordinator` - Title IX
- `Disability Services Director` - ADA, Section 504
- `Financial Aid Director` - Title IV
- `General Counsel` - Legal review
- `HR / Compliance` - Training, employment
- `IT Security` - Data security

### Implementation Files
- `src/services/compliance-task-generator.js` - Task generation service with templates
- `src/delivery-system/edsteward-integration.js` - v2.1 includes task generation
- Task templates for: ADA (9 tasks), OSHA (8 tasks), Title IV (9 tasks), Drug-Free Schools (7 tasks), Section 504 (4 tasks)