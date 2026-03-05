## Console Version Registry Implementation (January 22, 2026)

### Purpose
Protect gold standard regulation consoles as sacrosanct compliance deliverables. Once a regulation passes workflow certification, the console becomes an immutable artifact that customers depend on.

### Database Schema
- `console_versions` table tracks versioned, immutable console artifacts
- `console_version_audit` table provides full audit trail
- `active_gold_consoles` view for quick lookups
- Constraint: Only ONE active version per reg_key

### File Structure
```
console-versions/
├── REG-001/v1.0/ (console.html, metadata.json, workflow-results.json)
├── REG-002/v1.0/
```

### CLI Commands
```bash
node scripts/console-version-cli.js certify REG-001 --score 100 --certainty A --by "admin"
node scripts/console-version-cli.js rollback REG-001 v1.0 --reason "Bug in v1.1"
node scripts/console-version-cli.js list REG-001
node scripts/console-version-cli.js active
node scripts/console-version-cli.js verify REG-001
node scripts/console-version-cli.js status
```

### Key Files
- `src/services/console-version-registry.js` - Core service (certifyGold, rollback, listVersions, getActive, verifyIntegrity)
- `scripts/console-version-cli.js` - CLI interface
- `database/migrations/004_console_version_registry.sql` - Schema

### Initial Gold Standards Certified
- REG-001 (Clery Act) v1.0 - score 100/100
- REG-002 (Title IX) v1.0 - score 100/100