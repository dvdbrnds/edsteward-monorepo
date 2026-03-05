## Notification Override Toggle Fix - EdSteward

### Problem
The notification toggle on the regulation detail page had multiple issues:
1. The switch would toggle but immediately revert back
2. Toast messages showed incorrect state
3. Database was being updated but UI wasn't reflecting the change

### Root Causes
1. **Snake_case vs camelCase mismatch**: The database returns `notifications_disabled` (snake_case) but the code expected `notificationsDisabled` (camelCase)
2. **API response parsing**: The mutation success handler was checking `data.notificationsDisabled` but the API returned `{ regulation: { notificationsDisabled: ... } }`
3. **syslog function call**: Code was calling `syslog({...})` but `syslog` is a class instance requiring `syslog.info(...)` or `syslog.error(...)`

### Fix
1. In `server/routes/api/regulation-notifications.ts`, handle both field naming conventions:
```typescript
const notificationsDisabled = regulation.notificationsDisabled ?? regulation.notifications_disabled ?? false;
const notificationsDisabledBy = regulation.notificationsDisabledBy ?? regulation.notifications_disabled_by;
```

2. In client mutation success handler:
```typescript
const isNowDisabled = data.regulation?.notificationsDisabled ?? data.notificationsDisabled;
```

3. Change syslog calls from function-style to method calls:
```typescript
// Before (wrong):
await syslog({ level: LogLevel.INFO, facility: LogFacility.USER, message: '...' });
// After (correct):
await syslog.info('...', { metadata });
```

### Three-State Notification Badge
Implemented colored status badges:
- **Green "Standard (90-60-30-7-1)"**: Default notification schedule
- **Yellow "Custom"**: Custom notification schedule configured
- **Red "Disabled"**: Notifications turned off