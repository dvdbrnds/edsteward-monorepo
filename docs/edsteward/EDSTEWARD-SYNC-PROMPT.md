# EdSteward System Sync - Major Changes Notification

**Date:** January 22, 2026  
**From:** MCP Engine Compliance Team  
**To:** EdSteward Client Integration

---

## Summary of Changes

The MCP Engine regulation database has undergone significant updates. EdSteward clients must be aware of these changes to properly display and process compliance data.

---

## 1. New Task Categorization System

### Schema Change
The `regulation_tasks` table now includes a `requirement_type` column:

```sql
requirement_type VARCHAR(20) DEFAULT 'requirement'
-- Values: 'requirement' | 'best_practice'
```

### What This Means
- **requirement** = Legally mandated by statute/CFR. Non-compliance = violation.
- **best_practice** = Recommended but not legally required. Improves compliance posture.

### UI Implications
- Tasks should be visually distinguished by type
- Compliance scoring should weight requirements higher than best practices
- Filtering options should allow viewing by requirement type

---

## 2. Task Data Overhaul

### What Changed
- **REMOVED:** All generic/template tasks that were copy-pasted across regulations
- **ADDED:** Specific tasks tied to actual statutory requirements (CFR/USC citations)

### Old Template Tasks (Now Removed)
These generic tasks no longer exist:
- "Conduct Annual Compliance Training"
- "Conduct IT Security Risk Assessment"
- "Conduct Fire Drill"
- "Conduct Lab Safety Inspection"
- "Review Grant Expenditure Reports"
- "Conduct Data Inventory"
- "Conduct Privacy Impact Assessment"
- "Deliver Privacy Training"
- "Review Data Access Controls"
- "Update Privacy Notice"

### New Task Format
Each task now:
- Has a unique task_id (e.g., `GLBA-001`, `OSHA-005`)
- References specific regulatory requirements
- Is categorized as requirement or best_practice
- Has accurate priority levels

---

## 3. Regulation Registry Changes

### Current Counts
| Metric | Value |
|--------|-------|
| Active Regulations | 241 |
| Total Tasks | 1,410 |
| Requirements | 1,223 (86.7%) |
| Best Practices | 187 (13.3%) |

### Removed Duplicates
The following reg_keys are now `is_current = false`:
- REG-107 (duplicate of REG-076 Equal Pay Act)
- REG-122 (placeholder "Unknown Regulation")
- REG-131 (duplicate of REG-019 EPCRA)
- REG-215 (duplicate of REG-154 INA)
- REG-239 (duplicate of REG-238 ADEA)
- REG-250 (duplicate of REG-251 Textbook Info)

### Query Update Required
Always filter by `is_current = true`:
```sql
SELECT * FROM regulations WHERE is_current = true;
```

---

## 4. Gold Certification Status

### Certified Regulations (23)
These have been individually reviewed and approved:
```
REG-001, REG-002, REG-004, REG-005, REG-006, REG-007,
REG-008, REG-009, REG-010, REG-011, REG-012, REG-013,
REG-014, REG-015, REG-017, REG-018, REG-019, REG-020,
REG-023, REG-024, REG-025, REG-026, REG-098
```

### Pending Review (218)
Remaining regulations have accurate tasks but await manual review for gold certification.

---

## 5. API Response Changes

### Task Objects Now Include:
```json
{
  "task_id": "GLBA-001",
  "title": "Written Information Security Program",
  "description": "Develop written information security program...",
  "priority": "critical",
  "requirement_type": "requirement",
  "sort_order": 1
}
```

### New Fields to Handle:
- `requirement_type` - string, values: "requirement" | "best_practice"

---

## 6. Recommended EdSteward Updates

### UI Changes
1. Add visual indicator for requirement vs best_practice tasks
2. Add filter to show "Requirements Only" or "Best Practices Only"
3. Update compliance score calculations to weight by requirement_type
4. Display requirement counts in regulation summaries

### Data Handling
1. Refresh regulation cache to get updated task data
2. Handle `requirement_type` field in task processing
3. Filter out `is_current = false` regulations
4. Update any hardcoded task references

### Compliance Scoring Suggestion
```
Score = (completed_requirements / total_requirements) * 100
Bonus = (completed_best_practices / total_best_practices) * 10
Final = min(Score + Bonus, 100)
```

---

## 7. Sample Queries

### Get all active regulations with task counts:
```sql
SELECT 
  r.reg_key,
  r.name,
  COUNT(rt.id) FILTER (WHERE rt.requirement_type = 'requirement') as requirements,
  COUNT(rt.id) FILTER (WHERE rt.requirement_type = 'best_practice') as best_practices
FROM regulations r
LEFT JOIN regulation_tasks rt ON rt.regulation_id = r.id
WHERE r.is_current = true
GROUP BY r.reg_key, r.name
ORDER BY r.reg_key;
```

### Get tasks for a specific regulation:
```sql
SELECT task_id, title, requirement_type, priority
FROM regulation_tasks rt
JOIN regulations r ON rt.regulation_id = r.id
WHERE r.reg_key = 'REG-001'
ORDER BY rt.sort_order;
```

---

## 8. Migration Checklist for EdSteward

- [ ] Update API client to handle `requirement_type` field
- [ ] Update UI to display requirement/best_practice distinction
- [ ] Refresh cached regulation data
- [ ] Update compliance scoring algorithm
- [ ] Remove references to deleted duplicate regulations
- [ ] Test task display for all 241 active regulations
- [ ] Verify deadline associations still work

---

## Contact

For questions about these changes, contact the MCP Engine team.

**Change Log:**
- 2026-01-22: Initial sync document created
- Tasks rebuilt for all 241 regulations
- Duplicates removed from active registry
- requirement_type categorization implemented
