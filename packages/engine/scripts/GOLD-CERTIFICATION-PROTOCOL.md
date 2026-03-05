# Gold Standard Certification Protocol

## Overview
This protocol ensures regulation consoles meet gold standard quality with accurate, comprehensive compliance data.

## Prerequisites
- PostgreSQL `mcp_engine` database accessible
- Node.js with `pg` package installed
- Access to regulation console HTML files

---

## Protocol Steps

### Step 1: Decontamination Check (REQUIRED)
Run decontamination to detect data from other regulations:

```bash
# Check single regulation
node scripts/decontaminate-regulation.cjs REG-XXX

# Check all non-gold regulations
node scripts/decontaminate-regulation.cjs --all

# Fix contaminated data (removes wrong tasks/deadlines)
node scripts/decontaminate-regulation.cjs REG-XXX --fix
```

**Pass criteria:** No contamination detected, or contamination cleaned.

---

### Step 2: Duplicate Check
Before certifying, verify this isn't a duplicate of an existing regulation:

```sql
-- Check for same statute/name
SELECT reg_key, name, statute 
FROM regulations 
WHERE statute ILIKE '%<statute>%'
   OR name ILIKE '%<regulation-name>%';
```

**If duplicate found:** Merge into primary regulation (lower REG number), mark duplicate as `[MERGED INTO REG-XXX]` with `is_current = false`, `lovv_level = 'D'`.

---

### Step 3: Review Current Data
Check existing tasks and deadlines:

```sql
SELECT task_id, title, category, priority 
FROM regulation_tasks rt
JOIN regulations r ON rt.regulation_id = r.id
WHERE r.reg_key = 'REG-XXX'
ORDER BY category, sort_order;

SELECT deadline_id, name, deadline_type, frequency 
FROM regulation_deadlines rd
JOIN regulations r ON rd.regulation_id = r.id
WHERE r.reg_key = 'REG-XXX';
```

**Evaluate:** Are tasks comprehensive? Are deadlines accurate? Is data relevant to THIS regulation?

---

### Step 4: Enrich Data (if needed)
Delete incorrect data and insert comprehensive, accurate tasks/deadlines:

**Task Categories (target 6-10 categories, 25-45 tasks total):**
- Policy & Procedures
- Training & Awareness
- Documentation & Records
- Monitoring & Auditing
- Reporting & Disclosure
- [Regulation-specific categories]

**Deadline Types:**
- `report` - Filing deadlines
- `training` - Training completion
- `review` - Policy review cycles
- `audit` - Compliance audits
- `notification` - Required notifications
- `as-needed` - Triggered by events

---

### Step 5: Update Regulation Metadata
Ensure the `regulations` table has complete info:

```sql
UPDATE regulations SET
    name = 'Full Official Name',
    statute = 'U.S.C. Citation',
    cfr = 'CFR Citation (if applicable)',
    category = 'Compliance Category',
    topic = 'Specific Topic',
    summary = 'Clear 2-3 sentence summary',
    requirements = 'Detailed requirements text',
    updated_at = NOW()
WHERE reg_key = 'REG-XXX';
```

---

### Step 6: Certify as Gold
```sql
BEGIN;

-- Update LOVV level
UPDATE regulations 
SET lovv_level = 'A', updated_at = NOW()
WHERE reg_key = 'REG-XXX';

-- Get file info
-- (run separately to get hash/size)
-- CONTENT_HASH=$(shasum -a 256 "path/to/console.html" | cut -d' ' -f1)
-- CONTENT_SIZE=$(wc -c < "path/to/console.html" | tr -d ' ')

-- Insert certification record
INSERT INTO console_versions (
    reg_key, version, console_filename, console_html_path,
    content_hash, content_size_bytes, status, is_active,
    workflow_score, task_count, deadline_count, certainty_level,
    certified_by, certified_at, certification_notes
) VALUES (
    'REG-XXX', 'v1.0', 
    'regulation-slug-console.html',
    'src/client/public/regulations/regulation-slug-console.html',
    '<hash>', <size>,
    'gold', true, 100, <task_count>, <deadline_count>, 'A',
    'system', NOW(),
    'Gold certified: <X> tasks across <Y> categories, <Z> deadlines.'
);

COMMIT;
```

---

### Step 7: Restart API
```bash
pm2 restart registry-api
```

---

## Quality Checklist

- [ ] Decontamination check passed
- [ ] No duplicate regulations exist
- [ ] Tasks are specific to THIS regulation (not generic)
- [ ] Task IDs follow pattern: `<PREFIX>-<CAT>-<NUM>` (e.g., `HIPAA-PRV-001`)
- [ ] 25-45 tasks across 6-10 categories
- [ ] 4-8 deadlines with proper types/frequencies
- [ ] Statute and CFR citations are accurate
- [ ] Summary is clear and specific
- [ ] Requirements text is comprehensive
- [ ] Console HTML file exists and uses dynamic variables
- [ ] LOVV level set to 'A'
- [ ] `console_versions` entry created

---

## Contamination Patterns to Watch

| Pattern | Belongs To | Notes |
|---------|------------|-------|
| `title-ix`, `sexual-misconduct` | REG-002 | Title IX |
| `clery`, `campus-security` | REG-001 | Clery Act |
| `ferpa`, `education-records` | REG-004 | FERPA |
| `hipaa`, `phi`, `health-information` | REG-020 | HIPAA |
| `ada`, `disabilities-act` | REG-015 | ADA |
| `section-504` | REG-018 | Rehabilitation Act |
| `title-vii`, `eeoc` | REG-010 | Title VII |

---

## Merged/Deprecated Regulations

When merging duplicates, always:
1. Keep the lower REG number as primary
2. Move `transmission_log` entries to primary
3. Delete tasks/deadlines from duplicate
4. Update duplicate: `name = '[MERGED INTO REG-XXX] ...'`, `is_current = false`, `lovv_level = 'D'`
