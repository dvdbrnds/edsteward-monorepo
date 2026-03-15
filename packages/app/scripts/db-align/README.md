# Database ID Alignment

This directory contains exports used to align local dev regulation IDs with production.

## Problem

Production and local/staging databases had completely different numeric IDs for the
same regulations. This broke features like circuit interpretations that reference
`regulation_id` foreign keys — data seeded locally with one set of IDs would be
meaningless in production.

## Solution (applied 2026-03-14)

1. Exported all production regulation data (with IDs preserved)
2. Wiped local dev regulations and child tables
3. Re-imported production data, preserving exact IDs
4. Re-imported local-only regulations (test regs, extra state laws) with new IDs starting after production's max

## Prevention

Run `check-regulation-id-alignment.sh` before any production deployment:

```bash
cd packages/app
./scripts/check-regulation-id-alignment.sh
```

This verifies every production regulation exists in local with the same numeric ID.

## Rules Going Forward

1. **Never reset or re-seed the regulations table** without exporting production first
2. **New regulations** added locally will get IDs > production max — that's fine
3. **New regulations** added to production should be synced to local before further dev work
4. **The MCP Engine** is the source of truth for regulation content; the App DB stores it with stable IDs
5. **`drizzle-kit push`** is safe for schema changes (additive columns) but never for data operations
