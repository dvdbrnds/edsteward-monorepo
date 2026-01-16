# 🧹 Codebase Cleanup Plan

## Phase 1: Safe Removals (Immediate)

### 1. Remove Archived Files Directory
```bash
rm -rf archived_files/
```
**Impact**: None - these are clearly archived and unused
**Files**: 200+ old scripts, deployment files, and migration tools

### 2. Remove Temporary Dockerfiles
```bash
rm -f Dockerfile.fixed Dockerfile.minimal Dockerfile.patch Dockerfile.simple
```
**Keep**: `Dockerfile`, `Dockerfile.dev`, `Dockerfile.selfcontained`
**Impact**: None - these are temporary build files

### 3. Remove Old Backup Files (After verification)
```bash
# Verify these are not the current/active backups first
rm -f local_backup.sql nosync_backup.sql working_local_backup.sql
```

### 4. Remove Temporary Debug Scripts
```bash
rm -f cleanup-remaining-sgs.py
rm -f delete-unused-security-groups.sh
rm -f diagnose-auth-issue.py
rm -f diagnose-network.py
rm -f emergency_rollback.py
rm -f force-fresh-restart.py
rm -f get-logs.py
rm -f identify-security-groups.py
rm -f step-by-step-diagnosis.py
```

## Phase 2: Review and Remove (After verification)

### 5. Old Status/Summary Documents
```bash
# Review if these contain important historical information
rm -f API_INTEGRATION_FIXES_SUMMARY.md
rm -f COMPREHENSIVE_DATABASE_TESTING_SUMMARY.md
rm -f COMPREHENSIVE_STATUS_REPORT.md
rm -f DEPLOYMENT_FIX_GUIDE.md
rm -f DEPLOYMENT_STATUS.md
rm -f FINAL_DIAGNOSIS_SUMMARY.md
rm -f IMMEDIATE_SUMMARY.md
rm -f SERVICE_RECOVERY_SUCCESS.md
```

### 6. Migration Environments
```bash
rm -rf migration_env/
rm -rf deployment_fix_env/
```

### 7. Temporary JSON Configuration Files
```bash
rm -f register-final.json
rm -f register-result-v2.json
rm -f register-result.json
rm -f service-status.json
rm -f update-final.json
rm -f update-result-v2.json
rm -f updated-task-def.json
```

## Phase 3: Code Cleanup

### 8. Unused Dependencies Review
- Review `package.json` for unused dependencies
- Check for outdated packages

### 9. Dead Code Elimination
- Search for unused imports
- Remove commented-out code blocks
- Clean up unused utility functions

## Estimated Disk Space Recovery
- **Archived Files**: ~50-100MB
- **Backup Files**: ~20-50MB  
- **Temp Scripts**: ~5-10MB
- **JSON Files**: ~1-5MB
- **Migration Envs**: ~50-200MB

**Total Estimated**: 125-365MB disk space recovery

## Safety Checklist
- ✅ Verify no active references to archived files
- ✅ Confirm backup files are not current/active
- ✅ Check git history preservation
- ✅ Ensure deployment scripts still work
- ✅ Test build process after cleanup

## Git Cleanup (Optional)
After file removal, consider:
```bash
git add -A
git commit -m "chore: remove archived files and cleanup codebase"
git push
``` 