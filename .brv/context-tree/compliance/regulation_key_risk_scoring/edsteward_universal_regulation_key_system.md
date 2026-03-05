## EdSteward Universal Regulation Key (REG-XXX) System - January 20, 2026

### Overview
Implemented universal `reg_key` field (REG-001 to REG-251) for MCP Engine alignment. Keys are ordered by Institutional Risk Score (REG-001 = Clery Act, highest risk at 96).

### Database Schema Changes
```sql
-- Added to regulations table:
reg_key VARCHAR(10) UNIQUE  -- Universal key (REG-001 to REG-251)
risk_score INTEGER          -- Institutional risk score (1-100)
risk_level VARCHAR(20)      -- CRITICAL, SEVERE, HIGH, MODERATE, LOW
CREATE INDEX idx_regulations_reg_key ON regulations(reg_key);
```

### API Lookup Priority
`resolveRegulationId()` in regulation-updates-api.ts now uses:
1. **regKey** (REG-001 format) - PREFERRED
2. **itemId** (slug like "ferpa")
3. **regulationId** (numeric database ID)

### MCP Engine Payload Format
```json
{
  "regKey": "REG-001",
  "itemId": "jeanne-clery-disclosure-of-campus-security-policy-",
  "regulationId": 519,
  "riskScore": 96,
  "riskLevel": "CRITICAL",
  "name": "Clery Act Update",
  ...
}
```

### Migration Script
`scripts/add-reg-key-column.cjs` - Adds columns and updates regulations with REG-XXX keys based on item_id matching to MCP Engine mapping.

### Current State
- 42 of 251 regulations mapped (item_ids matched)
- 209 awaiting sync from MCP Engine with matching item_ids
- Risk distribution: CRITICAL (1), SEVERE (19), HIGH (17), MODERATE (5)

### Key Files
- `shared/schema.ts`: Added regKey, riskScore, riskLevel columns
- `server/regulation-updates-api.ts`: lookupRegulationByRegKey(), resolveRegulationId()
- `server/mcp-integration-api.ts`: Sync endpoint stores reg_key, risk metadata