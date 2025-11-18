#!/usr/bin/env node

/**
 * Test Okta Group to Role Mapping
 * Verifies that the role mapping system works correctly
 */

// Use tsx to run TypeScript directly
require('tsx/cjs');
const { mapOktaGroupsToRoles, getHighestPriorityRole, edStewardRoles } = require('./server/config/role-mapping.ts');

console.log('🧪 Testing Okta Group to Role Mapping System\n');

// Test scenarios
const testCases = [
  {
    name: 'Admin user',
    groups: ['EdSteward-Admin'],
    expectedPrimaryRole: 'admin',
    expectedRoles: ['admin']
  },
  {
    name: 'Compliance Officer',
    groups: ['EdSteward-ComplianceOfficer'],
    expectedPrimaryRole: 'compliance_officer',
    expectedRoles: ['compliance_officer']
  },
  {
    name: 'Department Head',
    groups: ['EdSteward-DepartmentHead'],
    expectedPrimaryRole: 'department_head',
    expectedRoles: ['department_head']
  },
  {
    name: 'Viewer',
    groups: ['EdSteward-Viewer'],
    expectedPrimaryRole: 'viewer',
    expectedRoles: ['viewer']
  },
  {
    name: 'Multiple groups (Admin + Compliance Officer)',
    groups: ['EdSteward-Admin', 'EdSteward-ComplianceOfficer'],
    expectedPrimaryRole: 'admin', // Admin has highest priority
    expectedRoles: ['admin', 'compliance_officer']
  },
  {
    name: 'Multiple groups (Viewer + Department Head)',
    groups: ['EdSteward-Viewer', 'EdSteward-DepartmentHead'],
    expectedPrimaryRole: 'department_head', // Higher priority
    expectedRoles: ['department_head', 'viewer']
  },
  {
    name: 'No matching groups',
    groups: ['Finance-Team', 'HR-Department'],
    expectedPrimaryRole: 'viewer', // Default
    expectedRoles: ['viewer']
  },
  {
    name: 'Empty groups array',
    groups: [],
    expectedPrimaryRole: 'viewer', // Default
    expectedRoles: ['viewer']
  },
  {
    name: 'Lowercase variant',
    groups: ['edsteward-admin'],
    expectedPrimaryRole: 'admin',
    expectedRoles: ['admin']
  },
  {
    name: 'Space variant',
    groups: ['EdSteward Admin'],
    expectedPrimaryRole: 'admin',
    expectedRoles: ['admin']
  }
];

let passedTests = 0;
let failedTests = 0;

console.log('Running test scenarios...\n');

for (const testCase of testCases) {
  console.log(`📝 Test: ${testCase.name}`);
  console.log(`   Groups: ${JSON.stringify(testCase.groups)}`);
  
  try {
    const mappedRoles = mapOktaGroupsToRoles(testCase.groups);
    const primaryRole = getHighestPriorityRole(mappedRoles);
    
    console.log(`   Mapped Roles: ${JSON.stringify(mappedRoles)}`);
    console.log(`   Primary Role: ${primaryRole}`);
    
    // Verify primary role
    if (primaryRole === testCase.expectedPrimaryRole) {
      console.log(`   ✅ Primary role correct`);
    } else {
      console.log(`   ❌ Primary role INCORRECT (expected: ${testCase.expectedPrimaryRole})`);
      failedTests++;
      continue;
    }
    
    // Verify mapped roles (order doesn't matter)
    const sortedMapped = [...mappedRoles].sort();
    const sortedExpected = [...testCase.expectedRoles].sort();
    
    if (JSON.stringify(sortedMapped) === JSON.stringify(sortedExpected)) {
      console.log(`   ✅ Mapped roles correct`);
      passedTests++;
    } else {
      console.log(`   ❌ Mapped roles INCORRECT (expected: ${JSON.stringify(testCase.expectedRoles)})`);
      failedTests++;
    }
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`);
    failedTests++;
  }
  
  console.log('');
}

// Print role hierarchy
console.log('\n📊 Role Hierarchy:');
const rolesByHierarchy = Object.values(edStewardRoles).sort((a, b) => b.hierarchy - a.hierarchy);
for (const role of rolesByHierarchy) {
  console.log(`   ${role.hierarchy}: ${role.name} (${role.displayName})`);
}

// Summary
console.log('\n' + '='.repeat(50));
console.log(`✅ Passed: ${passedTests}`);
console.log(`❌ Failed: ${failedTests}`);
console.log(`📊 Total: ${testCases.length}`);
console.log('='.repeat(50) + '\n');

if (failedTests === 0) {
  console.log('🎉 All tests passed! Okta group mapping is working correctly.\n');
  process.exit(0);
} else {
  console.log('⚠️  Some tests failed. Please review the role mapping configuration.\n');
  process.exit(1);
}

