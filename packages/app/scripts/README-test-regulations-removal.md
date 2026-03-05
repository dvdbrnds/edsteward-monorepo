# Test Regulations Removal Script

This script safely removes test regulations from all tenant databases in the EdSteward multi-tenant production environment.

## 🎯 What Gets Removed

The script identifies and removes test regulations based on these patterns:

### Clear Test Patterns (High Confidence)
- **DAVE-* regulations**: All "Davegulation" test data (e.g., `DAVE-1-001`, `DAVE-9-009`)
- **TEST-REG-* patterns**: Explicit test regulations (e.g., `TEST-REG-001`)
- **REG-DEV-* patterns**: Development test regulations

### Specific Known Test IDs
- `DAVE-1-001` through `DAVE-10-010` (Davegulation series)
- `TEST-REG-001` (explicit test regulation)
- `REG-1741205639642` (contains "TEST-123")
- `REG-DEV-001`, `REG-DEV-002` (development test regulations)

### Test Content Patterns
- Regulations with "Davegulation" in the name
- Regulations with "Test Regulation" in the name
- Regulations with obvious test content patterns

## 🛡️ Safety Features

- **Automatic Backups**: Creates JSON backups before deletion
- **Transaction Safety**: Uses database transactions with rollback on errors
- **Dry Run Mode**: Preview what would be removed without making changes
- **Force Confirmation**: Requires explicit `--force` flag for actual deletion
- **Related Data Cleanup**: Removes associated notes, deadlines, evidence files, etc.
- **Multi-Tenant Support**: Processes all tenant databases (admin, moravian, staging, test)

## 🚀 Usage

### 1. Preview Mode (Recommended First Step)
```bash
node scripts/remove-test-regulations-production.cjs
```
This shows what would be removed without making any changes.

### 2. Dry Run Mode (Test the Logic)
```bash
node scripts/remove-test-regulations-production.cjs --dry-run
```
This tests the identification logic and creates backups, but doesn't delete anything.

### 3. Live Deletion (Production)
```bash
node scripts/remove-test-regulations-production.cjs --force
```
This performs the actual deletion with all safety measures in place.

## 📊 Output Example

```
🚀 Starting Test Regulations Removal for EdSteward
📋 Mode: PREVIEW

🔍 Processing tenant: admin (edsteward_admin)
📊 Found 367 total regulations in admin
🎯 Identified 12 test regulations:
   - ID 4896: DAVE-1-001 "Jeanne Clery Disclosure..." (item_id matches pattern: /^DAVE-.*$/i)
   - ID 4897: DAVE-2-002 "Davegulation 2: Data Privacy Protocol" (item_id matches pattern: /^DAVE-.*$/i)
   ...
💾 Backup created: backups/test-regulations-removal/admin-test-regulations-2025-01-10T15-30-00-000Z.json
⚠️  About to remove 12 test regulations from admin
⚠️  Run with --force to proceed with deletion

📊 SUMMARY
==================================================
⏸️  admin: Found 12 test regulations (needs --force)
⏸️  moravian: Found 8 test regulations (needs --force)
✅ staging: Removed 0/0 test regulations
✅ test: Removed 15/15 test regulations

📈 TOTALS:
   Found: 35 test regulations
💡 Run with --force to perform actual deletion
```

## 🗄️ Tenant Databases Processed

The script processes these tenant databases:
- `edsteward_admin` - Administrative tenant
- `edsteward_moravian` - Moravian College tenant
- `edsteward_staging` - Staging environment
- `edsteward_test` - Test environment

## 💾 Backups

Backups are automatically created in: `backups/test-regulations-removal/`

Each backup file contains:
- Tenant name and timestamp
- Complete regulation data for all removed regulations
- Count of regulations removed
- Metadata for restoration if needed

Backup filename format: `{tenant}-test-regulations-{timestamp}.json`

## ⚠️ Prerequisites

1. **Environment Variables**: `DATABASE_URL` must be set
2. **Database Access**: Must have DELETE permissions on all tenant databases
3. **Node.js**: Requires Node.js with `pg` module available

## 🔧 Database Schema

The script handles these related tables:
- `regulations` (main table)
- `evidence_files` (regulation attachments)
- `notes` (regulation notes)
- `notifications` (regulation notifications)
- `deadlines` (regulation deadlines)
- `regulation_updates` (regulation update history)

## 🚨 Production Safety Checklist

Before running in production:

1. ✅ Test in staging environment first
2. ✅ Verify backup directory is writable
3. ✅ Confirm DATABASE_URL points to correct environment
4. ✅ Run in preview mode first to review what will be removed
5. ✅ Have database restoration plan ready if needed
6. ✅ Coordinate with team during maintenance window

## 🔄 Recovery

If you need to restore deleted regulations:

1. Locate the backup file in `backups/test-regulations-removal/`
2. Use the JSON data to recreate regulations if necessary
3. Contact database administrator for assistance with restoration

## 📞 Support

For issues or questions:
- Check the backup files for complete data
- Review the console output for error details
- Ensure all environment variables are correctly set
- Verify database connectivity and permissions 