EdSteward regulation ownership and actions visibility implementation (Dec 5, 2025):

1. **Password Hashing Bug Fix**: The `auth.ts` hashPassword function had a critical bug - it was passing salt as a hex string to scrypt, but verifyPassword was converting salt from hex to Buffer. Fixed by using `crypto.randomBytes(16)` directly (Buffer) instead of `.toString('hex')` in hashPassword.

2. **Owner Filtering**: Added `owner_id` column to regulations table for assigning regulations to compliance officers. The API filter in `server/routes/api/regulations.ts` must check BOTH `reg.ownerId` AND `reg.owner_id` due to Drizzle ORM vs raw SQL field name differences.

3. **Actions Required Display**: The "Actions Required" card on regulation detail page now only shows actions where `action.required === true` for compliance officers. Admins see all actions with toggle switches to mark them as required. Pattern:
```typescript
{(isAdmin ? regulation.actions : regulation.actions?.filter(a => a.required))?.map((action) => ...)}
```

4. **Owner Assignment UI**: Added dropdown on regulation detail page for admins to assign regulations to users. Uses `key` prop with ownerId to force re-render after assignment, and `refetchQueries` after mutation for immediate update.