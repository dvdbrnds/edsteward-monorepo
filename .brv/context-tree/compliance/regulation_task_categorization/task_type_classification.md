## Regulation Task Categorization - Requirements vs Best Practices (January 2026)

### Database Schema Change
Added `requirement_type` column to `regulation_tasks` table:
```sql
ALTER TABLE regulation_tasks
ADD COLUMN IF NOT EXISTS requirement_type VARCHAR(20) DEFAULT 'requirement';

COMMENT ON COLUMN regulation_tasks.requirement_type IS 
'Type: requirement (legally mandated) or best_practice (recommended but not required)';
```

### Key Findings - Statute Types

**Regulatory Compliance Statutes** (many affirmative requirements):
- HIPAA (45 CFR Part 164): Privacy Rule, Security Rule create specific duties
- ADA (28 CFR Part 35): Coordinator, grievance procedure, self-evaluation mandated

**Prohibition Statutes** (few affirmative requirements):
- Title VI (34 CFR Part 100): Primarily "don't discriminate" - minimal affirmative duties
- Title VII (29 CFR 1602): EEO-1 filing, record retention, poster display - most "tasks" are best practices

### Categorization Results
| Regulation | Requirements | Best Practices | Key Insight |
|------------|--------------|----------------|-------------|
| REG-020 HIPAA | 33 | 6 | Regulatory statute with 45 CFR duties |
| REG-015 ADA | 24 | 16 | Mix of explicit mandates and helpful practices |
| REG-010 Title VII | 9 | 23 | Prohibition statute - mostly best practices |
| REG-008 Title VI | 3 | 23 | Prohibition statute - even fewer requirements |
| REG-009 Title VI LEP | 5 | 17 | EO 13166 - four-factor analysis framework |
| REG-007 CSCPA | 4 | 18 | Only requires ASR disclosure |

### Critical Pattern
**Training is almost NEVER a statutory requirement** - consistently marked as best_practice across all regulations reviewed.

### SQL for Categorization
```sql
UPDATE regulation_tasks
SET requirement_type = 'best_practice'
WHERE regulation_id = [ID]
AND task_id IN ('task-ids-here');
```

### Legal Research Sources
- 28 CFR Part 35: ADA Title II regulations (ada.gov)
- 29 CFR Part 1602: Title VII recordkeeping (ecfr.gov)
- 34 CFR Part 100: Title VI implementing regulations (ecfr.gov)
- 45 CFR Part 164: HIPAA Privacy/Security Rules
- Executive Order 13166: LEP meaningful access requirements