# 🚨 MCP Engine Action Required: Implement LLM Stage 2

## 📊 Current Status Summary

| Component | Status | Details |
|-----------|--------|---------|
| **EdSteward API** | ✅ **READY** | Updated to handle requirements field separately |
| **EdSteward Database** | ✅ **READY** | Requirements column added to regulation_updates table |
| **EdSteward Frontend** | ✅ **READY** | Full text dialog working, requirements section ready |
| **MCP Engine LLM Stage 1** | ✅ **WORKING** | Full text extraction implemented |
| **MCP Engine LLM Stage 2** | ❌ **MISSING** | Requirements generation NOT implemented |

## 🎯 The Problem

**Current State**: MCP Engine only sends full regulation text
**Required State**: MCP Engine must send BOTH full text AND structured requirements

**Evidence**: Test script shows requirements field is NULL in database despite EdSteward API being ready to receive it.

---

## 🛠️ MCP Engine Implementation Required

### **Step 1: Add LLM Stage 2 Function**

```javascript
async function generateRequirements(fullText) {
  const prompt = `
SYSTEM: You are a compliance expert specializing in higher education regulations. Generate structured, actionable compliance requirements from regulation text.

USER: Analyze this regulation and generate specific compliance requirements for higher education institutions:

${fullText}

Generate requirements in this exact format:

**Key Compliance Requirements:**

1. **[Requirement Category]**
   - [Specific actionable requirement]
   - [Implementation deadline/frequency if applicable]
   - [Responsible party/department]

2. **[Next Category]**
   - [Specific actionable requirement]
   - [Implementation details]

**Documentation Requirements:**
- [Required records/documentation]
- [Retention periods]

**Reporting Requirements:**
- [Required reports/submissions]
- [Submission deadlines]
- [Recipient agencies]

**Training Requirements:**
- [Required training programs]
- [Target audiences]
- [Frequency]

**Monitoring & Compliance:**
- [Ongoing monitoring activities]
- [Compliance verification methods]
- [Audit requirements]

Focus on actionable, specific requirements that compliance officers can implement. Avoid generic statements.
`;

  const response = await callLLM(prompt); // Use your existing LLM call
  return response.trim();
}
```

### **Step 2: Update Regulation Processing**

```javascript
async function processRegulation(regulationId, rawData) {
  // Stage 1: Extract full text (EXISTING)
  const fullText = await extractFullText(rawData);
  
  // Stage 2: Generate requirements (NEW - ADD THIS)
  const requirements = await generateRequirements(fullText);
  
  // Send BOTH to EdSteward
  const payload = {
    regulationId: regulationId,
    name: `${getRegulationName(regulationId)} - Complete Update`,
    status: "pending",
    content: {
      uscText: {
        title: getRegulationTitle(regulationId),
        section: getRegulationSection(regulationId),
        text: fullText, // Stage 1 output
        lastUpdated: new Date().toISOString()
      },
      requirements: { // Stage 2 output - ADD THIS
        generated: true,
        llmModel: "gpt-4", // or your model
        generatedAt: new Date().toISOString(),
        content: requirements
      }
    }
  };
  
  await sendToEdSteward(payload);
}
```

### **Step 3: Test Implementation**

```bash
# Run the provided test script
node test-mcp-llm-stage-2.cjs
```

**Expected Result**: Requirements field should show "HAS_CONTENT" instead of "NULL"

---

## 🧪 Testing Process

### **Phase 1: Test with TEACH ACT (Regulation 55)**

1. **Generate requirements** for TEACH ACT using LLM Stage 2
2. **Send complete payload** with both full text and requirements
3. **Verify in test script**: Requirements field is populated
4. **Manual verification**:
   - Go to `http://localhost:3000/regulations/updates`
   - Accept the update
   - Check `http://localhost:3000/regulations/55`
   - Verify full text and requirements are separate and different

### **Phase 2: Implement for More Regulations**

- Regulation 269: Industrial Alcohol User Permits
- Regulations 1-10: Core higher education regulations
- Eventually: All 354 regulations

---

## 📋 Success Criteria

- ✅ Test script shows requirements field as "HAS_CONTENT" (not NULL)
- ✅ Full text and requirements are different content
- ✅ Requirements are actionable and specific to higher education
- ✅ Requirements follow the structured format template
- ✅ Both fields are stored separately in EdSteward database

---

## 🔧 Files Provided for MCP Engine Team

1. **`MCP_ENGINE_LLM_STAGE_2_IMPLEMENTATION.md`** - Complete implementation guide
2. **`MCP_ENGINE_REQUIREMENTS_GENERATION_SPECIFICATION.md`** - Detailed specification
3. **`test-mcp-llm-stage-2.cjs`** - Test script to verify implementation
4. **`MCP_ENGINE_FULL_TEXT_INTEGRATION_INSTRUCTIONS.md`** - Original integration guide

---

## ⚡ Next Steps

1. **MCP Engine Team**: Implement LLM Stage 2 requirements generation
2. **Test**: Use provided test script to verify implementation
3. **Deploy**: Start with TEACH ACT (regulation 55) as test case
4. **Scale**: Expand to more regulations once confirmed working

**The EdSteward side is complete and ready - waiting for MCP Engine LLM Stage 2 implementation!**
