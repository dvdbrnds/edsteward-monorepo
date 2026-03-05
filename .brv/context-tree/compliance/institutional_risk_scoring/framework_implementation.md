Institutional Risk Scoring (IRS) Framework - Successfully implemented in MCP Engine (January 2025):

**Database Schema:** `risk_assessments` table with 5-factor scoring:
- Financial Penalty (0-30)
- Federal Funding (0-25)  
- Accreditation Impact (0-20)
- Reputation/Legal (0-15)
- Operational Disruption (0-10)

**Risk Distribution (251 regulations scored):**
- CRITICAL (90-100): 1 regulation (Clery Act = 96)
- SEVERE (70-89): 25 regulations (Title IX=88, FERPA=85, VAWA=77)
- HIGH (50-69): 137 regulations (HEOA, OSHA, Export Controls)
- MODERATE (30-49): 87 regulations (Age Discrimination, HR regs)
- LOW (1-29): 1 regulation (Textbook Information=29)

**API Response Structure:**
```json
"riskAssessment": {
  "riskScore": 96,
  "riskLevel": "CRITICAL",
  "riskFactors": {
    "financialPenalty": {"score": 30, "rationale": "...", "maxPenaltyReference": "..."},
    "federalFunding": {"score": 25, "rationale": "...", "fundingTypesAtRisk": [...]},
    "accreditationImpact": {"score": 18, "rationale": "...", "accreditorRelevance": [...]},
    "reputationalLegal": {"score": 15, "rationale": "...", "precedentCases": [...]},
    "operationalDisruption": {"score": 8, "rationale": "...", "affectedOperations": [...]}
  },
  "enforcementTrend": "INCREASING|STABLE|DECREASING",
  "recentEnforcementActions": [...]
}
```

**NPM Scripts Added:**
- `npm run enrich:risk` - Calculate/recalculate risk scores
- `npm run enrich:all` - Includes risk scoring
- `npm run align` - Syncs risk data to EdSteward

Key insight: L.O.V.V. measures validation certainty, IRS measures consequence severity. Both delivered in every payload.