MCP Engine System Prompt for Institutional Risk Scoring - comprehensive instructions for the MCP Engine to calculate and deliver risk scores with every regulation package:

**Core Directive:** Every regulation delivered MUST include a risk_assessment object with:
- risk_score (1-100)
- risk_level (CRITICAL/SEVERE/HIGH/MODERATE/LOW)
- 5 factor scores with rationales
- enforcement_trend
- recent_enforcement_actions

**Required JSON Schema:**
```json
{
  "risk_assessment": {
    "risk_score": 0-100,
    "risk_level": "CRITICAL|SEVERE|HIGH|MODERATE|LOW",
    "risk_factors": {
      "financial_penalty": {"score": 0-30, "rationale": "string"},
      "federal_funding": {"score": 0-25, "rationale": "string"},
      "accreditation_impact": {"score": 0-20, "rationale": "string"},
      "reputational_legal": {"score": 0-15, "rationale": "string"},
      "operational_disruption": {"score": 0-10, "rationale": "string"}
    },
    "assessment_date": "ISO8601",
    "enforcement_trend": "INCREASING|STABLE|DECREASING"
  }
}
```

**Client Notification Triggers:**
- Risk score changes ≥10 points
- New enforcement action on CRITICAL/SEVERE regulations
- Risk level category changes
- New SEVERE/CRITICAL regulation added

File location: /home/claude/MCP_ENGINE_RISK_SCORING_PROMPT.md