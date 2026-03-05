## TransferIQ Network Effect / Flywheel Feature

### Core Concept
The system creates a self-reinforcing data flywheel where more data = higher confidence = better experience = more customers.

### Source School Maturity Tiers

1. **CUSTOMER** (100% confidence boost) - They're a TransferIQ customer, we have their official catalog
   - Badge: "✓ Verified Partner"
   - Confidence approaches 98-99% for exact matches

2. **VERIFIED** (20% confidence boost) - 50+ verified evaluations or 100+ total evaluations
   - Badge: "★ Trusted Source"
   - High confidence from historical data

3. **GROWING** (10% confidence boost) - 10-50 evaluations
   - Badge: "↑ Growing History"
   - Building transfer patterns

4. **EMERGING** (5% confidence boost) - 5+ evaluations
   - No badge, starting to build history

5. **NEW** (no boost) - No history
   - Relies on AI/pattern matching

### Key Implementation Details

```typescript
// In equivalency-engine.ts
async function calculateSourceSchoolMaturity(schoolId: string | null, schoolName: string): Promise<SourceSchoolMaturity>

function applyNetworkEffectBoost(baseConfidence: number, maturity: SourceSchoolMaturity, hasExactMatch: boolean): number
```

### Sales Pitch Value
- "Every transcript you process makes our database smarter"
- "Join the network and your courses become trusted everywhere"
- "Schools that are our customers get 100% confidence on course matches"

### Data Tracked for Network Effect
- `evaluationResult.sendingInstitution.maturity` - Maturity tier and stats
- `evaluation.fromSchoolId` - Links to source school if found in DB
- `evaluation.fromSchoolAccredited` - Tracks accreditation status