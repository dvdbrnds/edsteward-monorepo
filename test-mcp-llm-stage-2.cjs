#!/usr/bin/env node

/**
 * Test script for MCP Engine LLM Stage 2 Requirements Generation
 * 
 * This script tests that MCP Engine can send both full text AND requirements
 * to EdSteward and that they are stored separately.
 */

const http = require('http');
const { Pool } = require('pg');
require('dotenv').config();

// Sample TEACH ACT full text for testing
const teachActFullText = `Notwithstanding the provisions of section 106 and the enhanced digital learning provisions, the following are not infringements of copyright:

(1) performance or display of a work by instructors or pupils in the course of face-to-face teaching activities of a nonprofit educational institution, in a classroom or similar place devoted to instruction, unless, in the case of a motion picture or other audiovisual work, the performance, or the display of individual images, is given by means of a copy that was not lawfully made under this title, and that the person responsible for the performance knew or had reason to believe was not lawfully made;

(2) except with respect to a work produced or marketed primarily for performance or display as part of mediated instructional activities transmitted via digital networks, or a performance or display that is given by means of a copy or phonorecord that is not lawfully made and acquired under this title, and the transmitting government body or accredited nonprofit educational institution knew or had reason to believe was not lawfully made and acquired, the performance of a nondramatic literary or musical work or reasonable and limited portions of any other work, or display of a work in an amount comparable to that which is typically displayed in the course of a live classroom session, by or in the course of a transmission, if—

(A) the performance or display is made by, at the direction of, or under the actual supervision of an instructor as an integral part of a class session offered as a regular part of the systematic instructional activities of a governmental body or an accredited nonprofit educational institution;

(B) the performance or display is directly related and of material assistance to the teaching content of the transmission;

(C) the transmission is made solely for, and, to the extent technologically feasible, the reception of such transmission is limited to—
(i) students officially enrolled in the course for which the transmission is made; or
(ii) officers or employees of governmental bodies as a part of their official duties or employment; and

(D) the transmitting body or institution—
(i) institutes policies regarding copyright, provides informational materials to faculty, students, and relevant staff members that accurately describe, and promote compliance with, the laws of the United States relating to copyright, and provides notice to students that materials used in connection with the course may be subject to copyright protection; and
(ii) applies technological measures that reasonably prevent—
(I) retention of the work in accessible form by recipients of the transmission from the transmitting body or institution for longer than the class session; and
(II) unauthorized further dissemination of the work in accessible form by such recipients to others; and
(iii) does not engage in conduct that could reasonably be expected to interfere with technological measures used by copyright owners to prevent such retention or unauthorized further dissemination;`;

// Expected requirements output (what MCP Engine LLM Stage 2 should generate)
const expectedRequirements = `**Key Compliance Requirements:**

1. **Copyright Compliance for Digital Learning**
   - Implement technological measures to prevent unauthorized retention and distribution of copyrighted materials
   - Limit access to enrolled students for specific course sessions
   - Ensure materials are directly related to teaching content

2. **Faculty Training and Authorization**
   - Train faculty on TEACH Act limitations and requirements
   - Establish approval process for copyrighted material use in online courses
   - Document faculty acknowledgment of copyright responsibilities

**Documentation Requirements:**
- Maintain records of copyrighted materials used in courses
- Document technological protection measures implemented
- Retain course enrollment records for access verification

**Reporting Requirements:**
- No specific federal reporting required
- Internal compliance audits recommended annually

**Training Requirements:**
- Annual copyright training for all faculty using digital materials
- New faculty orientation on TEACH Act compliance
- IT staff training on technological protection measures

**Monitoring & Compliance:**
- Regular audits of online course materials
- Monitor technological protection measure effectiveness
- Review and update policies annually`;

// Test payload with both full text and requirements
const testPayload = {
  regulationId: 55,
  name: "TEACH ACT - LLM Stage 2 Implementation Test",
  status: "pending",
  content: {
    uscText: {
      title: "17 USC 110 - TEACH Act",
      section: "110(2)",
      text: teachActFullText,
      lastUpdated: "2025-01-30T12:00:00Z"
    },
    requirements: {
      generated: true,
      llmModel: "gpt-4",
      generatedAt: "2025-01-30T12:00:00Z",
      content: expectedRequirements
    }
  }
};

async function testMCPLLMStage2() {
  console.log('🧪 Testing MCP Engine LLM Stage 2 Implementation');
  console.log('=' .repeat(60));
  
  try {
    // Test 1: Send payload with both full text and requirements
    console.log('\n📡 Test 1: Sending complete payload (Full Text + Requirements)...');
    console.log(`   Regulation ID: ${testPayload.regulationId}`);
    console.log(`   Full Text Length: ${testPayload.content.uscText.text.length} characters`);
    console.log(`   Requirements Length: ${testPayload.content.requirements.content.length} characters`);
    
    const response = await sendToEdSteward(testPayload);
    console.log('✅ API Response:', response);
    
    if (response.success) {
      const updateId = response.updateId;
      console.log(`✅ Update created with ID: ${updateId}`);
      
      // Test 2: Verify storage separation
      console.log('\n🔍 Test 2: Verifying separate storage...');
      await verifyStorageSeparation(updateId);
      
      // Test 3: Manual verification instructions
      console.log('\n📋 Test 3: Manual Verification Steps');
      console.log('   1. Open: http://localhost:3000/regulations/updates');
      console.log(`   2. Find: "${testPayload.name}"`);
      console.log('   3. Click "Accept" to approve the update');
      console.log('   4. Navigate to: http://localhost:3000/regulations/55');
      console.log('   5. Verify:');
      console.log('      ✅ "View Full Text" shows complete TEACH ACT text');
      console.log('      ✅ Requirements section shows structured compliance requirements');
      console.log('      ✅ Full text and requirements are DIFFERENT content');
      console.log('      ✅ Requirements are actionable and specific to higher education');
      
      // Test 4: Check current regulation state
      console.log('\n📊 Test 4: Current regulation 55 state...');
      await checkCurrentRegulationState(55);
      
    } else {
      console.log('❌ Update failed:', response);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('   - Ensure EdSteward is running on port 3000');
    console.log('   - Check that MCP Engine has implemented LLM Stage 2');
    console.log('   - Verify requirements field is being generated by LLM');
  }
}

function sendToEdSteward(payload) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
    
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/regulation-updates',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve(response);
        } catch (error) {
          reject(new Error(`Invalid JSON response: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

async function verifyStorageSeparation(updateId) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('neon') ? { rejectUnauthorized: false } : false
  });

  try {
    const client = await pool.connect();
    
    const result = await client.query(`
      SELECT 
        id,
        name,
        regulation_id,
        LENGTH(updated_content) as full_text_length,
        CASE 
          WHEN requirements IS NULL THEN 'NULL'
          WHEN requirements = '' THEN 'EMPTY'
          ELSE 'HAS_CONTENT (' || LENGTH(requirements) || ' chars)'
        END as requirements_status
      FROM regulation_updates 
      WHERE id = $1
    `, [updateId]);
    
    if (result.rows.length > 0) {
      const update = result.rows[0];
      console.log('   📊 Storage verification:');
      console.log(`      Update ID: ${update.id}`);
      console.log(`      Regulation ID: ${update.regulation_id}`);
      console.log(`      Full Text: ${update.full_text_length} characters`);
      console.log(`      Requirements: ${update.requirements_status}`);
      
      if (update.requirements_status.includes('HAS_CONTENT')) {
        console.log('   ✅ SUCCESS: Requirements field is populated separately!');
      } else {
        console.log('   ❌ ISSUE: Requirements field is not populated');
        console.log('   💡 MCP Engine needs to implement LLM Stage 2');
      }
    } else {
      console.log('   ❌ Update not found in database');
    }
    
    client.release();
  } catch (error) {
    console.error('   ❌ Database error:', error.message);
  } finally {
    await pool.end();
  }
}

async function checkCurrentRegulationState(regulationId) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('neon') ? { rejectUnauthorized: false } : false
  });

  try {
    const client = await pool.connect();
    
    const result = await client.query(`
      SELECT 
        id,
        name,
        CASE 
          WHEN regulation_text IS NULL THEN 'NULL'
          WHEN regulation_text = '' THEN 'EMPTY'
          ELSE 'HAS_CONTENT (' || LENGTH(regulation_text) || ' chars)'
        END as full_text_status,
        CASE 
          WHEN requirements IS NULL THEN 'NULL'
          WHEN requirements = '' THEN 'EMPTY'
          ELSE 'HAS_CONTENT (' || LENGTH(requirements) || ' chars)'
        END as requirements_status
      FROM regulations 
      WHERE id = $1
    `, [regulationId]);
    
    if (result.rows.length > 0) {
      const regulation = result.rows[0];
      console.log('   📊 Current regulation state:');
      console.log(`      ID: ${regulation.id}`);
      console.log(`      Name: ${regulation.name}`);
      console.log(`      Full Text: ${regulation.full_text_status}`);
      console.log(`      Requirements: ${regulation.requirements_status}`);
      
      const hasFullText = regulation.full_text_status.includes('HAS_CONTENT');
      const hasRequirements = regulation.requirements_status.includes('HAS_CONTENT');
      
      if (hasFullText && hasRequirements) {
        console.log('   ✅ PERFECT: Both full text and requirements are present!');
      } else if (hasFullText && !hasRequirements) {
        console.log('   ⚠️  PARTIAL: Has full text but missing structured requirements');
      } else if (!hasFullText && hasRequirements) {
        console.log('   ⚠️  PARTIAL: Has requirements but missing full text');
      } else {
        console.log('   ❌ MISSING: Both full text and requirements are missing');
      }
    } else {
      console.log('   ❌ Regulation not found');
    }
    
    client.release();
  } catch (error) {
    console.error('   ❌ Database error:', error.message);
  } finally {
    await pool.end();
  }
}

// Run the test
if (require.main === module) {
  testMCPLLMStage2().catch(console.error);
}

module.exports = { testMCPLLMStage2, testPayload, teachActFullText, expectedRequirements };
