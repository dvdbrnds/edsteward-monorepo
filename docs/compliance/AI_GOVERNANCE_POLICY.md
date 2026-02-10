# EdSteward AI Governance Policy

**Document Version:** 1.0  
**Effective Date:** February 2026  
**Last Reviewed:** February 5, 2026  
**Next Review Date:** August 2026  
**Document Owner:** EdSteward Product & Security Teams  

---

## 1. Purpose

This AI Governance Policy establishes guidelines for the responsible development, deployment, and use of artificial intelligence (AI) and machine learning (ML) systems within EdSteward. This policy ensures compliance with HECVAT 4.0 AI governance requirements and reflects our commitment to transparent, ethical, and secure AI practices.

## 2. Scope

This policy covers:
- All AI/ML systems integrated into EdSteward
- Third-party AI services used by EdSteward
- AI-assisted features available to customers
- Data used for AI processing
- AI system monitoring and governance

## 3. AI Systems Inventory

### 3.1 Current AI Implementations

| System | Provider | Purpose | Data Processed |
|--------|----------|---------|----------------|
| **Regulation Analysis** | OpenAI GPT-4 | Extract compliance requirements from regulatory documents | Regulatory text (public documents) |
| **Document Understanding** | Anthropic Claude | Summarize and analyze compliance documentation | Regulatory text (public documents) |
| **Task Suggestion** | Internal Logic | Recommend compliance tasks based on regulations | Regulation metadata |

### 3.2 AI System Classification

| Risk Level | Criteria | Systems |
|------------|----------|---------|
| **Low Risk** | No personal data, advisory only, human oversight | Regulation analysis, task suggestions |
| **Medium Risk** | Limited personal data, influences decisions | None currently |
| **High Risk** | Significant personal data, automated decisions | None currently |

### 3.3 What Our AI Does NOT Do

- **Does not process personal information**: AI analyzes regulatory text, not customer PII
- **Does not make autonomous decisions**: All AI outputs are suggestions requiring human review
- **Does not access education records**: AI is isolated from FERPA-protected data
- **Does not profile users**: No behavioral analysis or profiling of individuals
- **Does not use customer data for training**: Customer data is never used to train AI models

## 4. AI Principles

### 4.1 Core Principles

EdSteward's AI systems adhere to the following principles:

| Principle | Implementation |
|-----------|----------------|
| **Transparency** | Clear disclosure of AI use, explainable outputs |
| **Human Oversight** | All AI outputs reviewed by humans before action |
| **Privacy by Design** | AI systems process only necessary data |
| **Security** | AI integrations follow security best practices |
| **Fairness** | Regular review for bias and discrimination |
| **Accountability** | Clear ownership and governance of AI systems |

### 4.2 Transparency Commitments

We commit to:
1. **Disclosure**: Clearly identify AI-generated or AI-assisted content
2. **Explanation**: Provide understandable explanations of AI recommendations
3. **Documentation**: Maintain records of AI system capabilities and limitations
4. **Communication**: Respond to customer inquiries about AI systems

## 5. Data Governance for AI

### 5.1 Data Input Controls

| Control | Description |
|---------|-------------|
| **Data Minimization** | Only necessary data sent to AI systems |
| **PII Exclusion** | Personal information stripped before AI processing |
| **Data Classification** | Only public regulatory content processed by AI |
| **Input Validation** | All inputs validated before AI processing |

### 5.2 Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     AI DATA FLOW                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   CUSTOMER DATA                    AI PROCESSING                 │
│   ┌───────────────┐               ┌─────────────────┐           │
│   │ Regulations   │──[extract]───▶│ Regulatory Text │           │
│   │ (metadata)    │               │ (no PII)        │           │
│   └───────────────┘               └────────┬────────┘           │
│                                            │                     │
│   ┌───────────────┐                        ▼                     │
│   │ User Data     │    [BLOCKED]   ┌─────────────────┐          │
│   │ (PII)         │───────X────────│ AI Service      │          │
│   └───────────────┘                │ (OpenAI/Claude) │          │
│                                    └────────┬────────┘          │
│   ┌───────────────┐                        │                     │
│   │ Evidence      │    [BLOCKED]           ▼                     │
│   │ Files         │───────X────────┌─────────────────┐          │
│   └───────────────┘                │ AI Output       │          │
│                                    │ (suggestions)   │          │
│                                    └────────┬────────┘          │
│                                             │                    │
│                                    ┌────────▼────────┐          │
│                                    │ Human Review    │          │
│                                    │ Required        │          │
│                                    └─────────────────┘          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 Third-Party AI Provider Controls

| Provider | Data Processing Agreement | Data Retention | Training Use |
|----------|---------------------------|----------------|--------------|
| **OpenAI** | API Terms of Service | 30 days (API) | Opted out |
| **Anthropic** | API Terms of Service | Per terms | Opted out |

**Important**: We use API access with data processing terms that:
- Prohibit use of our data for model training
- Limit data retention
- Provide security commitments

## 6. Human Oversight

### 6.1 Human-in-the-Loop Requirements

All AI outputs in EdSteward require human review:

| AI Feature | Human Oversight |
|------------|-----------------|
| Regulation analysis | Admin reviews extracted requirements before import |
| Task suggestions | Compliance officer approves/modifies suggested tasks |
| Document summaries | Users review summaries, access original documents |

### 6.2 Override Capabilities

Users can:
- Dismiss or modify any AI suggestion
- Disable AI features entirely (admin setting)
- Access underlying data without AI interpretation
- Report incorrect or concerning AI outputs

### 6.3 Escalation Process

```
AI Output Generated
        │
        ▼
┌───────────────────┐
│ User Reviews      │
│ Suggestion        │
└─────────┬─────────┘
          │
    ┌─────┴─────┐
    ▼           ▼
 Accept      Reject/Modify
    │           │
    ▼           ▼
 Applied    Feedback Logged
(with        (for review)
attribution)
```

## 7. Security Controls

### 7.1 AI Integration Security

| Control | Implementation |
|---------|----------------|
| **API Authentication** | Secure API keys, rotated regularly |
| **Transport Security** | TLS 1.2+ for all AI API calls |
| **Input Sanitization** | All inputs sanitized before AI processing |
| **Output Validation** | AI outputs validated before display |
| **Rate Limiting** | API calls rate-limited to prevent abuse |
| **Audit Logging** | All AI interactions logged |

### 7.2 Prompt Security

- Prompts designed to prevent injection attacks
- System prompts separate from user content
- Output parsing with strict validation
- No execution of AI-generated code

### 7.3 Incident Response

AI-related security incidents follow the standard [Incident Response Plan](./INCIDENT_RESPONSE_PLAN.md) with additional considerations:
- Immediate suspension of AI feature if compromise suspected
- Review of AI outputs during incident window
- Assessment of data exposure to AI systems

## 8. Bias and Fairness

### 8.1 Bias Monitoring

We monitor for bias in AI systems by:
- Reviewing AI outputs across different regulation types
- Analyzing suggestion patterns for consistency
- Collecting user feedback on AI accuracy
- Conducting periodic fairness reviews

### 8.2 Bias Mitigation

Mitigation strategies include:
- Using diverse training data (for any internal models)
- Regular testing with varied inputs
- Human review of all AI outputs
- Feedback mechanisms for users to report issues

### 8.3 Known Limitations

| AI Feature | Known Limitations |
|------------|-------------------|
| Regulation Analysis | May miss nuanced requirements; works best with structured documents |
| Task Suggestions | Based on patterns; may not account for institution-specific context |
| Document Summaries | May oversimplify complex regulations |

## 9. Compliance Mapping

### 9.1 HECVAT 4.0 AI Questions

| HECVAT Question | Response | Evidence |
|-----------------|----------|----------|
| Do you use AI/ML systems? | Yes - for regulatory analysis | This policy, Section 3 |
| What data is processed by AI? | Public regulatory text only | This policy, Section 5 |
| Is customer data used for training? | No | Provider agreements, Section 5.3 |
| Is there human oversight of AI? | Yes - required for all outputs | This policy, Section 6 |
| Can AI features be disabled? | Yes - admin configurable | Feature flag documentation |
| How is AI bias addressed? | Monitoring and mitigation program | This policy, Section 8 |

### 9.2 Customer Audit Support

We provide customers with:
- This AI Governance Policy
- AI system inventory and data flows
- Third-party AI provider security information
- AI feature configuration options
- Audit logs of AI system usage

## 10. Customer Controls

### 10.1 AI Feature Configuration

| Setting | Options | Default |
|---------|---------|---------|
| **AI Analysis** | Enabled / Disabled | Enabled |
| **AI Suggestions** | Enabled / Disabled | Enabled |
| **AI Provider** | OpenAI / Anthropic / Disabled | OpenAI |

### 10.2 Opting Out

Customers can disable AI features:
1. **Admin Settings**: Toggle AI features off in admin console
2. **Support Request**: Request permanent AI feature removal
3. **Contract Terms**: Negotiate AI-free deployment

### 10.3 Data Processing Agreements

Enterprise customers may request:
- AI-specific data processing addendum
- Confirmation of AI data handling practices
- Annual AI governance attestation

## 11. Governance Structure

### 11.1 AI Governance Roles

| Role | Responsibility |
|------|----------------|
| **Product Owner** | AI feature development and roadmap |
| **Security Team** | AI security review and monitoring |
| **Engineering** | AI integration implementation |
| **Compliance** | Regulatory alignment and policy |
| **Executive Sponsor** | Strategic direction and risk acceptance |

### 11.2 Review Cadence

| Review Type | Frequency | Owner |
|-------------|-----------|-------|
| AI System Inventory | Quarterly | Product |
| Security Assessment | Semi-annually | Security |
| Bias Review | Annually | Product + Compliance |
| Policy Review | Annually | Compliance |
| Third-Party Review | Annually | Security |

### 11.3 Change Management

New AI systems or significant changes require:
1. Security review
2. Privacy impact assessment
3. Documentation update
4. Customer communication (if material)
5. Executive approval (for high-risk systems)

## 12. Future AI Development

### 12.1 Evaluation Criteria

New AI features are evaluated against:
- Customer value and use case clarity
- Data privacy implications
- Security risk assessment
- Compliance requirements
- Ethical considerations
- Human oversight requirements

### 12.2 Prohibited Uses

EdSteward will NOT develop AI systems that:
- Make autonomous decisions affecting individuals without human review
- Process education records without explicit authorization
- Profile or score individual users
- Use customer data for model training without consent
- Generate misleading or deceptive content

## 13. Training and Awareness

### 13.1 Staff Training

| Audience | Training |
|----------|----------|
| **All Staff** | AI ethics and responsible use (annual) |
| **Engineering** | AI security best practices |
| **Product** | AI governance requirements |
| **Support** | AI feature explanation for customers |

### 13.2 Customer Education

We provide customers with:
- AI feature documentation
- Best practices for AI-assisted compliance
- FAQ on AI data handling
- Support for AI-related questions

---

## Appendix A: AI Quick Reference

```
┌────────────────────────────────────────────────────────────────┐
│               EDSTEWARD AI QUICK REFERENCE                      │
├────────────────────────────────────────────────────────────────┤
│ AI PROVIDERS:                                                   │
│   • OpenAI GPT-4 - Regulation analysis                         │
│   • Anthropic Claude - Document understanding                   │
├────────────────────────────────────────────────────────────────┤
│ DATA PROCESSED BY AI:                                           │
│   ✓ Public regulatory text                                      │
│   ✗ Personal information (BLOCKED)                              │
│   ✗ Education records (BLOCKED)                                 │
│   ✗ Customer evidence files (BLOCKED)                           │
├────────────────────────────────────────────────────────────────┤
│ HUMAN OVERSIGHT:                                                │
│   • All AI outputs require human review                         │
│   • Users can modify or reject suggestions                      │
│   • AI features can be disabled                                 │
├────────────────────────────────────────────────────────────────┤
│ CUSTOMER DATA & TRAINING:                                       │
│   • Customer data is NOT used for AI training                   │
│   • Opted out of provider training programs                     │
└────────────────────────────────────────────────────────────────┘
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | February 2026 | EdSteward Product & Security | Initial policy creation |

---

**Approved By:** David Brandes, Founder & CEO  
**Date:** February 5, 2026
