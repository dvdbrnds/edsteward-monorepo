EdSteward Demo Prep Session - January 13, 2026

Key fixes implemented:

1. **Regulation Update Accept Fix**: The `acceptRegulationUpdate` function in `server/storage.ts` was failing because `filing_deadlines` is stored as TEXT in `regulation_updates` but the `regulations` table expects JSONB. Fixed by wrapping non-JSON text in a JSON object: `{ description: filingDeadlines }`.

2. **Attestation Checkmark Display Fix**: Completed attestations weren't showing bright green on the dashboard because:
   - Non-required completed actions had `opacity-75` (removed)
   - Green dot indicator only showed for `required` actions (changed to show for ALL completed)
   - `scale-90` on non-required actions made them look faded (removed)
   
   Files: `client/src/components/regulations/regulation-list.tsx`

3. **Database Environment Note**: Local dev uses a DIFFERENT Neon database than production:
   - Local: `ep-summer-pine-ae88mdbc-pooler.c-2.us-east-2.aws.neon.tech`
   - Production: `ep-weathered-term-a5rmi9cx-pooler.us-east-2.aws.neon.tech`

4. **Demo Accounts Created**:
   - Clara (CCO): `clara.compliance@moravian.edu` / `clarademo`
   - Freddy (Field): `freddy.field@moravian.edu` / `freddydemo`
   Note: Production uses plaintext passwords due to simplified auth in `server/routes/index.ts` lines 330-332.

5. **Rate Limit Issue**: `express-rate-limit` stores limits in memory. Restart server to clear rate limits.