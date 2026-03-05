## Universal REG-KEY Field Implementation - January 20, 2026 (Commit 9c01e6a)

MCP Engine implemented a universal `reg_key` field for perfect regulation identification between MCP Engine and EdSteward:

### Numbering Convention
- **REG-001 to REG-251** numbered by Institutional Risk Score (highest risk = lowest number)
- REG-001 = Clery Act (Risk: 96, CRITICAL)
- REG-004 = FERPA (Risk: 85, SEVERE)
- REG-251 = Textbook Information (Risk: 29, LOW)

### Database Schema
```sql
ALTER TABLE regulations ADD COLUMN reg_key VARCHAR(10) UNIQUE;
CREATE INDEX idx_regulations_reg_key ON regulations(reg_key);
```

### Key Files
- `data/reg-key-mapping.json` - Complete mapping (all 251 regulations)
- `data/edsteward-regkey-update.sql` - SQL script for EdSteward
- `docs/EDSTEWARD-REGKEY-ALIGNMENT.md` - Implementation guide

### API Response Format
All regulation endpoints now return `regKey`:
```json
{
  "regKey": "REG-001",
  "regulationId": "jeanne-clery-...",
  "id": 67,
  "name": "Clery Act...",
  "riskScore": 96
}
```

### Priority for Lookups
1. `regKey` (REG-001 format) - PRIMARY
2. `itemId` (slug) - BACKUP
3. `regulationId` (numeric) - LEGACY