# Prompt for EdSteward AI - MCP Engine Changes

Use this prompt when communicating with EdSteward about the regulation database changes.

---

## The Prompt

```
IMPORTANT UPDATE FROM MCP ENGINE - January 22, 2026

The compliance regulation database has been significantly updated. Please sync your understanding:

## 1. NEW: Task Categorization
Tasks now have a `requirement_type` field:
- "requirement" = Legally mandated (must do)
- "best_practice" = Recommended (should do)

Display these differently in the UI. Requirements are critical; best practices are supplemental.

## 2. Task Data Rebuilt
All generic/template tasks have been REMOVED and replaced with actual statutory requirements.

OLD (deleted): "Conduct Annual Compliance Training", "Conduct IT Security Risk Assessment", etc.
NEW: Specific tasks like "GLBA-001: Written Information Security Program", "BBP-003: Universal Precautions"

Each task now references actual CFR/USC requirements.

## 3. Registry Changes
- Active regulations: 241 (down from 249)
- Total tasks: 1,410
- Requirements: 1,223 (87%)
- Best practices: 187 (13%)

Removed duplicates (now is_current=false):
- REG-107, REG-122, REG-131, REG-215, REG-239, REG-250

Always filter: WHERE is_current = true

## 4. Gold Certification
23 regulations are gold certified (individually reviewed):
REG-001, 002, 004, 005, 006, 007, 008, 009, 010, 011, 012, 013, 014, 015, 017, 018, 019, 020, 023, 024, 025, 026, 098

218 more are ready for manual review.

## 5. What EdSteward Should Do
1. Refresh any cached regulation/task data
2. Handle the new requirement_type field
3. Update compliance scoring to weight requirements > best practices
4. Add UI distinction between requirements and best practices
5. Filter out is_current=false regulations

## 6. Sample Task Object
{
  "task_id": "COPPA-004",
  "title": "Verifiable Parental Consent",
  "requirement_type": "requirement",
  "priority": "critical"
}

Please confirm you understand these changes and will update accordingly.
```

---

## Usage Notes

1. Send this prompt to EdSteward when starting a session about compliance
2. EdSteward should acknowledge and adapt its responses
3. Follow up with specific questions about implementation if needed
