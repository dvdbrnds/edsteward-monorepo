EdSteward Audit Logs Bug Fix (December 2025)

Fixed SQL syntax error in audit service that caused "Failed to fetch audit logs" error on the Audit Trail page.

**Root Cause:** Invalid Drizzle ORM syntax in `server/services/audit.ts`:
```typescript
// WRONG - db.$count() doesn't exist
const [{ count }] = await db
  .select({ count: db.$count() })
  .from(auditLogs)
  .where(whereClause);

// CORRECT - use count() from drizzle-orm
import { count } from 'drizzle-orm';
const [{ total }] = await db
  .select({ total: count() })
  .from(auditLogs)
  .where(whereClause);
```

Server log showed: `syntax error at or near ")"`