## eCFR.gov API Discovery (December 1, 2025)

The eCFR.gov API has a complex structure. The correct approach to fetch CFR parts is:

1. **Structure Endpoint** (returns JSON hierarchy):
```bash
https://www.ecfr.gov/api/versioner/v1/structure/2025-01-01/title-34.json
```

2. **Full Content Endpoint** (returns XML with ALL parts):
```bash
https://www.ecfr.gov/api/versioner/v1/full/2025-01-01/title-34.xml
```

**Key Findings:**
- There is NO direct `/part-99.json` endpoint
- Must fetch entire title XML and parse out specific parts
- Structure JSON shows hierarchy but doesn't contain regulation text
- XML parsing required to extract Part 99 from Title 34 XML
- Date format: YYYY-MM-DD (e.g., 2025-01-01)

**Implications for MCP Engine:**
For Friday demo, hybrid approach (CSV + HECA summaries) faster than full eCFR parsing. eCFR integration should be post-demo enhancement requiring proper XML parser (fast-xml-parser npm package).