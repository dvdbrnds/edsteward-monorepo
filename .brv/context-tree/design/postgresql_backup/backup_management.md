EdSteward Database Backup System (December 2025)

Implemented a tiered backup system for on-premises deployments:

**Schedule:**
- Daily: 2 AM, 7-day retention
- Weekly: Sunday 3 AM, 4-week retention  
- Monthly: 1st of month 4 AM, 12-month retention

**Key Files:**
- `server/services/backup-service.ts` - Core backup logic with pg_dump
- `server/routes/api/backups.ts` - Admin API endpoints
- `client/src/components/admin/backup-management.tsx` - Admin UI

**API Endpoints:**
- `GET /api/backups` - List backups
- `POST /api/backups` - Create manual backup
- `GET /api/backups/:id/download` - Download backup
- `POST /api/backups/:id/restore` - Restore from backup
- `DELETE /api/backups/:id` - Delete backup

**Docker Requirements:**
- Alpine: `apk add postgresql-client`
- Mount `/app/backups` volume for persistence
- Set `DOCKER_CONTAINER=true` env var

**Dev Mode:** Scheduler disabled by default. Enable with `ENABLE_BACKUP_SCHEDULER=true`

**Note:** Requires pg_dump version >= database version (Neon uses PG 17)