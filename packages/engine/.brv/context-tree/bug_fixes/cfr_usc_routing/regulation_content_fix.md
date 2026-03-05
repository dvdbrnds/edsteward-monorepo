TECHNICAL IMPLEMENTATION DETAILS - CFR vs USC Fix (September 2, 2025)

KEY CODE CHANGES FOR TOMORROW'S REFERENCE:

1. CONSOLE GENERATOR ENHANCEMENTS (src/server/console-generator.js):
```javascript
// NEW: parseCFRReference() method
parseCFRReference(regulation) {
  // Detects "X C.F.R. Part Y" patterns in Regulation 1-5 fields
  // Returns: { title, section, type: 'cfr', isCFR: true }
}

// ENHANCED: parseStatuteReference() method  
parseStatuteReference(statuteReference, regulation) {
  // Now checks CFR first, then USC
  // Returns type: 'cfr' or 'usc' for proper endpoint routing
}

// NEW: CFR endpoint conversion logic
if (statuteInfo.type === 'cfr') {
  html = html.replace(/api\/llm\/usc\/17\/110/g, `api/llm/cfr/${statuteInfo.title}/${statuteInfo.section}`);
  html = html.replace(/USC 17 Section 110/g, `${statuteInfo.title} C.F.R. Part ${statuteInfo.section}`);
}
```

2. LLM GATEWAY ENHANCEMENTS (src/llm-gateway/simple-usc-gateway.js):
```javascript
// NEW: CFR Title/Part endpoint
app.get('/api/llm/cfr/:title/:part', async (req, res) => {
  // Returns rich CFR content with 5 detailed sections
  // Structure: Purpose & Scope, Definitions, Administrative Requirements, Cost Principles, Audit Requirements
});

// ENHANCED: Compliance data structure
institutionalRequirements: [...], // Was: requirements: [...]
riskAssessment: [...],           // NEW
enforcementStatistics: {...}    // NEW
```

ENDPOINT ROUTING EXAMPLES:
- CFR-based: 2 C.F.R. Part 200 → api/llm/cfr/2/200
- USC-based: 42 U.S.C. Chapter 21G → api/llm/usc/42/21  
- Fallback: Unknown → api/llm/usc/17/110 (TEACH Act)

DETECTION LOGIC:
1. Check Regulation 1-5 fields for "X C.F.R. Part Y" patterns
2. If CFR found: route to CFR endpoints
3. If USC found: route to USC endpoints  
4. If neither: fallback to USC 17/110

This ensures each regulation shows its own unique content instead of TEACH Act defaults.