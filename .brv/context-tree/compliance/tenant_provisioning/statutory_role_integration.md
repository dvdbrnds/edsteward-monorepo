## Tenant Provisioning + Statutory Role Integration

### Tenant Provisioning System

**API Endpoint:** `POST /api/provision-tenant`
- Bulk syncs ALL regulations to a new EdSteward tenant
- Uses direct sync (bypasses approval) for initial setup
- Parameters: customerId, limit, startFrom, dryRun

**CLI Script:** `node scripts/provision-tenant.js --customer=<id>`
- Supports --dry-run, --limit, --start-from flags
- Can use --url and --auth for custom endpoints

### Statutory Role/Citation Support

**Database Schema:**
```sql
ALTER TABLE regulation_tasks ADD COLUMN statutory_role VARCHAR(100);
ALTER TABLE regulation_tasks ADD COLUMN statutory_citation VARCHAR(100);
```

**Task Payload Format:**
```json
{
  "statutoryRole": "Title IX Coordinator",
  "statutoryCitation": "34 CFR 106.8",
  "assignedRole": "Title IX Coordinator"
}
```

### Role Normalization (in delivery-server.js)
MCP Engine maps roles to EdSteward standards:
- General Counsel → Legal Counsel
- Campus Safety Director → Campus Police Chief
- Academic Affairs → VP Academic Affairs
- IT Director → IT Security Officer
- Disability Services Director → Disability Services

### Standard Statutory Citations
| Role | Citation |
|------|----------|
| Title IX Coordinator | 34 CFR 106.8 |
| Clery Compliance Officer | 34 CFR 668.46 |
| ADA/504 Coordinator | 34 CFR 104.7 |
| Export Control Officer | 22 CFR 120-130 (ITAR) |

### Key Files Modified
- `src/delivery-system/delivery-server.js` - Added provision endpoint + role normalization
- `src/server/registry-api/routes/postgres-regulations.js` - Added statutoryRole/Citation to transformTask
- `scripts/provision-tenant.js` - New CLI tool for tenant setup