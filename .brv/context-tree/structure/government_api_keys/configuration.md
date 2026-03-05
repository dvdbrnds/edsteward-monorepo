MCP Engine Government API Keys Configuration (January 2026):

All government source API keys are now configured in `.env`:

```
# Congress.gov - https://api.congress.gov/sign-up/
CONGRESS_API_KEY=sPlJ7p7D6ROgAfoNjEr3rDiMUpgTSH9y6fCnXb6B

# Regulations.gov - https://api.data.gov/signup/
REGULATIONS_GOV_API_KEY=BiQSbIAInPeZewKyGZZC7XzD4S3cU8YejhfIaWXp

# GovInfo (GPO) - https://api.govinfo.gov/docs/ (uses data.gov keys)
GOVINFO_API_KEY=7eVEqDzmOBaKcXaAwbJ0HqUHF37lI90BzeX6GBFX
```

Note: data.gov is the centralized API key system for federal government APIs. One key from data.gov works for multiple APIs (Regulations.gov, GovInfo, etc.)

Sources that DON'T need API keys:
- eCFR (ecfr.gov)
- Federal Register (federalregister.gov)
- Library of Congress (loc.gov)
- Cornell LII
- OpenAlex

The eCFR API endpoint format was updated for 2025/2026 in `src/llm-gateway/services/real-cross-reference.js` to use date-based URLs like:
`https://www.ecfr.gov/api/versioner/v1/structure/${today}/title-${cfrTitle}.json`