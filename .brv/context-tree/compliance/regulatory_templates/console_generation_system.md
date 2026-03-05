## Console Template Generation System (January 22, 2026)

### Problem Solved
Individual console HTML files had inconsistent UI/UX - some had old framework, others had new gold standard layout.

### Solution
Created template-based console generator that uses Clery (REG-001) as the gold standard template.

### Script: scripts/generate-console-from-template.cjs

**Usage:**
```bash
# Single regulation
node scripts/generate-console-from-template.cjs REG-004

# Top 20 regulations
node scripts/generate-console-from-template.cjs --top20

# All regulations
node scripts/generate-console-from-template.cjs --all
```

**What it replaces:**
- `<title>` tag
- `REGULATION_SLUG` constant
- `REG_KEY` constant
- Regulation name references
- REG-001 hardcoded values

**Result:**
- All 250 consoles now have identical UI/UX framework
- Each console has correct REGULATION_SLUG and REG_KEY for API calls
- Backups created before overwriting (can be cleaned up with rm -f *.backup-*)

### Gold Standard Template Features (Clery)
- Version control integration
- 5-tab layout
- Category-grouped task display
- Certification workflow
- ~6069 lines