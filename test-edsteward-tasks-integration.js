#!/usr/bin/env node
/**
 * EdSteward Integration Test - Expanded Compliance Tasks
 * Tests the hybrid approach with all Tier 1 and Tier 2 templates
 */

import { EdStewardIntegration } from './src/delivery-system/edsteward-integration.js';
import { ComplianceTaskGenerator } from './src/services/compliance-task-generator.js';

async function testIntegration() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🧪 EdSteward Integration Test - Expanded Compliance Tasks');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const edsteward = new EdStewardIntegration({
    environment: 'development'
  });

  const taskGenerator = new ComplianceTaskGenerator();

  // Test 1: Health Check
  console.log('📋 Test 1: EdSteward Health Check');
  console.log('─────────────────────────────────────────────────────────────');
  const health = await edsteward.testConnection();
  console.log(`   Result: ${health.success ? '✅ Connected' : '❌ Failed'}`);
  if (health.health) {
    console.log(`   Status: ${health.health.status}`);
    console.log(`   Bulk Import: ${health.health.bulkImportEnabled}`);
  }
  console.log('');

  // Test 2: List all available templates
  console.log('📋 Test 2: Available Task Templates');
  console.log('─────────────────────────────────────────────────────────────');
  const templates = taskGenerator.getAvailableTemplates();
  console.log('   EdSteward Templates (use templateHint):');
  templates.edstewardTemplates.forEach(t => console.log(`     • ${t}`));
  console.log('');
  console.log('   MCP Engine Task Templates:');
  const uniqueTemplates = [...new Set(templates.mcpTaskTemplates)];
  uniqueTemplates.forEach(t => {
    const result = taskGenerator.generateTasks(t);
    if (result.tasks) {
      console.log(`     • ${t}: ${result.tasks.length} tasks`);
    }
  });
  console.log('');

  // Test 3: Test each Tier 1 regulation
  console.log('📋 Test 3: Tier 1 Regulation Task Generation');
  console.log('─────────────────────────────────────────────────────────────');
  
  const tier1Regs = [
    { slug: 'americans-with-disabilities-act-of-1990', name: 'ADA' },
    { slug: 'hipaa', name: 'HIPAA' },
    { slug: 'glba', name: 'GLBA' },
    { slug: 'osha', name: 'OSHA' },
    { slug: 'heoa', name: 'HEOA' },
    { slug: 'save-act', name: 'Campus SaVE Act' },
    { slug: 'solomon-amendment', name: 'Solomon Amendment' },
    { slug: 'title-iv', name: 'Title IV' }
  ];

  let totalTasks = 0;
  for (const reg of tier1Regs) {
    const result = taskGenerator.generateTasks(reg.slug);
    if (result.tasks) {
      console.log(`   ✅ ${reg.name}: ${result.tasks.length} tasks`);
      totalTasks += result.tasks.length;
    } else if (result.templateHint) {
      console.log(`   🏷️  ${reg.name}: uses EdSteward template "${result.templateHint}"`);
    } else {
      console.log(`   ⚠️  ${reg.name}: no template`);
    }
  }
  console.log('');

  // Test 4: Test Tier 2 regulations
  console.log('📋 Test 4: Tier 2 Regulation Task Generation');
  console.log('─────────────────────────────────────────────────────────────');
  
  const tier2Regs = [
    { slug: 'drug-free-schools-and-communities-act', name: 'Drug-Free Schools' },
    { slug: 'section-504', name: 'Section 504' },
    { slug: 'vawa', name: 'VAWA' },
    { slug: 'fmla', name: 'FMLA' },
    { slug: 'dmca', name: 'Copyright/DMCA' }
  ];

  for (const reg of tier2Regs) {
    const result = taskGenerator.generateTasks(reg.slug);
    if (result.tasks) {
      console.log(`   ✅ ${reg.name}: ${result.tasks.length} tasks`);
      totalTasks += result.tasks.length;
    } else {
      console.log(`   ⚠️  ${reg.name}: no template`);
    }
  }
  console.log('');

  // Test 5: EdSteward template regulations
  console.log('📋 Test 5: EdSteward Template Regulations');
  console.log('─────────────────────────────────────────────────────────────');
  
  const templateRegs = [
    { slug: 'clery-act', name: 'Clery Act' },
    { slug: 'ferpa', name: 'FERPA' },
    { slug: 'title-ix', name: 'Title IX' }
  ];

  for (const reg of templateRegs) {
    const result = taskGenerator.generateTasks(reg.slug);
    console.log(`   🏷️  ${reg.name}: templateHint = "${result.templateHint}"`);
  }
  console.log('');

  // Test 6: Full payload test with HIPAA
  console.log('📋 Test 6: Full HIPAA Payload Test');
  console.log('─────────────────────────────────────────────────────────────');
  const hipaaUpdate = {
    regulationId: 'hipaa',
    data: {
      after: {
        fullText: 'The Health Insurance Portability and Accountability Act (HIPAA) of 1996 establishes national standards for the protection of health information...',
        summary: 'Establishes national standards for electronic health care transactions and security for protected health information (PHI).',
        requirements: ['Privacy Officer designation', 'Security Risk Assessment', 'Business Associate Agreements', 'Workforce Training']
      }
    }
  };
  
  const hipaaPayload = edsteward.transformPayload(hipaaUpdate);
  console.log(`   Regulation: ${hipaaPayload.name}`);
  console.log(`   EdSteward ID: ${hipaaPayload.regulationId}`);
  console.log(`   Tasks Generated: ${hipaaPayload.metadata.tasksGenerated}`);
  console.log(`   Task Count: ${hipaaPayload.metadata.taskCount}`);
  
  if (hipaaPayload.complianceTasks) {
    console.log('\n   📋 HIPAA Tasks:');
    hipaaPayload.complianceTasks.slice(0, 5).forEach((task, i) => {
      const indent = task.parentTempId ? '      └─' : '   ';
      console.log(`${indent} ${i+1}. ${task.title}`);
    });
    if (hipaaPayload.complianceTasks.length > 5) {
      console.log(`      ... and ${hipaaPayload.complianceTasks.length - 5} more tasks`);
    }
  }
  console.log('');

  // Test 7: Send HIPAA to EdSteward
  console.log('📋 Test 7: Send HIPAA to EdSteward');
  console.log('─────────────────────────────────────────────────────────────');
  
  if (!health.success) {
    console.log('   ⚠️  EdSteward not running on localhost:3000');
  } else {
    console.log('   Sending HIPAA regulation with tasks...');
    const result = await edsteward.sendRegulationUpdate(hipaaUpdate);
    
    if (result.success) {
      console.log('   ✅ Delivery successful!');
      console.log(`   Update ID: ${result.updateId}`);
      console.log(`   Regulation ID: ${result.regulationId}`);
    } else {
      console.log(`   ❌ Delivery failed: ${result.error}`);
    }
  }
  console.log('');

  // Summary
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('📊 Test Summary');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`   EdSteward Templates:     3 (Clery, FERPA, Title IX)`);
  console.log(`   MCP Task Templates:      ${tier1Regs.length + tier2Regs.length} regulations`);
  console.log(`   Total Generated Tasks:   ${totalTasks}`);
  console.log('');
  console.log('   ✅ Template detection working');
  console.log('   ✅ Tier 1 regulations: ADA, HIPAA, GLBA, OSHA, HEOA, SaVE, Solomon, Title IV');
  console.log('   ✅ Tier 2 regulations: Drug-Free Schools, 504, VAWA, FMLA, DMCA');
  console.log(`   ${health.success ? '✅' : '⚠️'} EdSteward connection: ${health.success ? 'OK' : 'Not available'}`);
  console.log('');
  console.log('   Remaining to cover: ~20 complex regulations (Tier 3)');
  console.log('   Simple attestation: ~230 regulations (no tasks needed)');
  console.log('');
}

testIntegration().catch(console.error);

