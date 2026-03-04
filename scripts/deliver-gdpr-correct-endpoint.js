#!/usr/bin/env node
/**
 * Deliver GDPR to EdSteward - CORRECT ENDPOINT
 * Uses /api/mcp/regulations/create for NEW regulations
 */

import { ComplianceTaskGenerator } from '../src/services/compliance-task-generator.js';

const GDPR_FULL_TEXT = `
GENERAL DATA PROTECTION REGULATION (GDPR)
EU Regulation 2016/679

The General Data Protection Regulation (GDPR) is a comprehensive data protection law that governs the processing of personal data of individuals within the European Union (EU) and European Economic Area (EEA). It applies to any organization, including US higher education institutions, that processes personal data of EU residents.

APPLICABILITY TO US HIGHER EDUCATION:
GDPR applies to US colleges and universities when they:
- Recruit or admit students from EU countries
- Operate study abroad programs in the EU
- Employ EU citizens or residents
- Have EU alumni in their databases
- Conduct research involving EU participants
- Market educational services to EU residents

KEY PRINCIPLES (Article 5):
1. Lawfulness, Fairness, and Transparency
2. Purpose Limitation
3. Data Minimization
4. Accuracy
5. Storage Limitation
6. Integrity and Confidentiality
7. Accountability

DATA SUBJECT RIGHTS:
- Right to be informed (Articles 13-14)
- Right of access (Article 15) - Respond within 30 days
- Right to rectification (Article 16)
- Right to erasure/"right to be forgotten" (Article 17)
- Right to restrict processing (Article 18)
- Right to data portability (Article 20)
- Right to object (Article 21)

BREACH NOTIFICATION:
- Notify supervisory authority within 72 HOURS
- Notify affected individuals if high risk

PENALTIES:
- Up to €20,000,000 or 4% of annual global turnover
`;

const GDPR_SUMMARY = `The General Data Protection Regulation (GDPR) is EU Regulation 2016/679 establishing comprehensive data protection rules for processing personal data of EU/EEA residents. US higher education institutions must comply when processing data of international students, study abroad participants, EU employees, alumni, or research subjects. Key requirements include: establishing lawful basis for processing, providing transparent privacy notices, responding to data subject access requests within 30 days, notifying authorities of breaches within 72 hours, implementing appropriate security measures, and using Standard Contractual Clauses for international data transfers. Penalties can reach €20M or 4% of annual turnover.`;

const GDPR_REQUIREMENTS = `• Establish and document lawful basis for all processing of EU personal data
• Appoint Data Protection Officer (DPO) if required by processing activities
• Maintain Records of Processing Activities (ROPA) under Article 30
• Publish GDPR-compliant privacy notice with all required disclosures
• Implement Data Subject Access Request (DSAR) process with 30-day response deadline
• Establish 72-hour breach notification procedure to supervisory authority
• Conduct Data Protection Impact Assessments (DPIA) for high-risk processing
• Implement appropriate technical and organizational security measures
• Execute Standard Contractual Clauses (SCCs) for international data transfers
• Maintain data processing agreements with all vendors handling EU data
• Provide annual GDPR awareness training to staff handling EU personal data
• Implement consent management system for marketing and optional processing`;

const FILING_DEADLINES = [
  {
    type: "Data Breach Notification",
    date: "72 hours",
    frequency: "per-incident",
    description: "Notify supervisory authority within 72 hours of becoming aware of personal data breach"
  },
  {
    type: "Data Subject Access Request",
    date: "30 days",
    frequency: "per-request",
    description: "Respond to DSAR within 30 days (extendable to 90 days for complex requests)"
  },
  {
    type: "GDPR Training",
    date: "Annual",
    frequency: "annual",
    description: "Provide annual GDPR awareness training to staff handling EU personal data"
  }
];

async function deliverGDPR() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🇪🇺 GDPR Delivery to EdSteward - CORRECT ENDPOINT');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const taskGenerator = new ComplianceTaskGenerator();

  // Step 1: Check if GDPR already exists
  console.log('📋 Step 1: Check if GDPR already exists');
  console.log('─────────────────────────────────────────────────────────────');
  
  try {
    const lookupResponse = await fetch(
      'https://moravian.edsteward.ai/api/mcp/regulations/lookup?name=GDPR',
      {
        headers: {
          'Authorization': 'Basic ZHZkYnJuZHM6Z2FiYWRo'
        }
      }
    );
    const lookupResult = await lookupResponse.json();
    console.log(`   Lookup result:`, lookupResult);
    
    if (lookupResult.count > 0) {
      console.log('   ⚠️  GDPR already exists in EdSteward!');
      console.log('   Proceeding anyway to update/recreate...');
    } else {
      console.log('   ✅ GDPR not found - safe to create');
    }
  } catch (error) {
    console.log(`   ⚠️  Lookup failed: ${error.message}`);
    console.log('   Proceeding with create anyway...');
  }
  console.log('');

  // Step 2: Generate tasks
  console.log('📋 Step 2: Generate GDPR Compliance Tasks');
  console.log('─────────────────────────────────────────────────────────────');
  const taskResult = taskGenerator.generateTasks('gdpr');
  console.log(`   Generated ${taskResult.tasks?.length || 0} compliance tasks`);
  console.log('');

  // Step 3: Build payload (NO regulationId - EdSteward auto-assigns)
  console.log('📋 Step 3: Build Payload (no regulationId)');
  console.log('─────────────────────────────────────────────────────────────');
  
  const payload = {
    // NO regulationId - EdSteward will auto-assign
    name: 'General Data Protection Regulation (GDPR)',
    statute: 'EU Regulation 2016/679',
    category: 'Information Technology',
    topic: 'Data Privacy',
    jurisdictionSource: 'international',
    summary: GDPR_SUMMARY,
    requirements: GDPR_REQUIREMENTS,
    filingDeadlines: FILING_DEADLINES,
    complianceTasks: taskResult.tasks
  };

  console.log(`   Name: ${payload.name}`);
  console.log(`   Statute: ${payload.statute}`);
  console.log(`   Category: ${payload.category}`);
  console.log(`   Topic: ${payload.topic}`);
  console.log(`   Jurisdiction: ${payload.jurisdictionSource}`);
  console.log(`   Tasks: ${payload.complianceTasks?.length || 0}`);
  console.log('');

  // Step 4: Send to CORRECT endpoint
  console.log('📋 Step 4: Send to /api/mcp/regulations/create');
  console.log('─────────────────────────────────────────────────────────────');
  console.log('   Endpoint: https://moravian.edsteward.ai/api/mcp/regulations/create');
  
  try {
    const response = await fetch('https://moravian.edsteward.ai/api/mcp/regulations/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ZHZkYnJuZHM6Z2FiYWRo'
      },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();
    console.log(`   Status: ${response.status} ${response.statusText}`);
    
    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      result = { raw: responseText };
    }

    if (response.ok) {
      console.log('');
      console.log('   ✅ GDPR CREATED SUCCESSFULLY!');
      console.log(`   Response:`, JSON.stringify(result, null, 2));
      console.log('');
      console.log('   📋 Next Steps in EdSteward:');
      console.log('   1. Go to https://moravian.edsteward.ai');
      console.log('   2. Search for "GDPR" in regulations');
      console.log('   3. Open the regulation detail page');
      console.log('   4. Click "Apply Tasks" to create the 26 compliance tasks');
    } else {
      console.log(`   ❌ Creation failed!`);
      console.log(`   Response:`, JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.log(`   ❌ Network error: ${error.message}`);
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════════════════');
}

deliverGDPR().catch(console.error);
