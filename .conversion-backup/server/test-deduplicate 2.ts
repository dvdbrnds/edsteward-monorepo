import { expect } from 'chai';
import { deduplicateRegulations, isCleryActRegulation, countCleryRegulations } from './deduplicate-regulations';
import { storage } from './storage';
import type { InsertRegulation } from '@shared/schema';

describe('Regulation Deduplication', function() {
  // Set higher timeout for all tests in this suite
  this.timeout(10000);

  // Test data for multiple Clery Act regulations
  const testRegulations: InsertRegulation[] = [
    {
      itemId: 'TEST-CLERY-1',
      name: 'Clery Act Requirements',
      topic: 'Campus Safety',
      statute: 'Test Statute 1',
      category: 'Safety',
      jurisdiction: 'federal',
      isApplicable: true,
      lastUpdated: new Date('2025-01-01'),
      summary: 'Test summary 1'
    },
    {
      itemId: 'TEST-CLERY-2',
      name: 'Campus Security Report Requirements',
      topic: 'Clery Act Compliance',
      statute: 'Test Statute 2',
      category: 'Safety',
      jurisdiction: 'federal',
      isApplicable: true,
      lastUpdated: new Date('2025-02-01'),
      summary: 'Test summary 2'
    },
    {
      itemId: 'TEST-CLERY-3',
      name: 'Jeanne Clery Disclosure Act',
      topic: 'Campus Safety Statistics',
      statute: 'Test Statute 3',
      category: 'Safety',
      jurisdiction: 'federal',
      isApplicable: true,
      lastUpdated: new Date('2025-03-01'),
      summary: 'Test summary 3'
    }
  ];

  beforeEach(async function() {
    try {
      // Clear any existing test data
      const existingRegs = await storage.getRegulations();
      const testRegs = existingRegs.filter(reg => reg.itemId.startsWith('TEST-CLERY-'));
      for (const reg of testRegs) {
        await storage.deleteRegulation(reg.id);
      }
    } catch (error) {
      console.error('Error in beforeEach:', error);
      throw error;
    }
  });

  it('should correctly identify Clery Act regulations', function() {
    const testCases = [
      {
        regulation: {
          name: 'Clery Act Requirements',
          topic: 'Campus Safety',
          summary: 'Test summary'
        },
        expected: true
      },
      {
        regulation: {
          name: 'Campus Security Requirements',
          topic: 'Safety Reporting',
          summary: 'Related to Clery Act compliance'
        },
        expected: true
      },
      {
        regulation: {
          name: 'General Safety Guidelines',
          topic: 'Workplace Safety',
          summary: 'OSHA requirements'
        },
        expected: false
      }
    ];

    testCases.forEach(testCase => {
      expect(isCleryActRegulation(testCase.regulation as any))
        .to.equal(testCase.expected);
    });
  });

  it('should consolidate multiple Clery Act regulations into one', async function() {
    try {
      // Insert test regulations
      for (const reg of testRegulations) {
        await storage.createRegulation(reg);
      }

      // Verify initial state
      const initialCount = await countCleryRegulations();
      expect(initialCount).to.be.at.least(3);

      // Run deduplication
      const result = await deduplicateRegulations();

      // Verify results
      expect(result.finalCount).to.equal(1);
      expect(result.deletedCount).to.equal(initialCount - 1);

      // Get remaining regulation
      const regulations = await storage.getRegulations();
      const cleryRegs = regulations.filter(isCleryActRegulation);
      expect(cleryRegs).to.have.lengthOf(1);

      const remainingReg = cleryRegs[0];
      expect(remainingReg.isApplicable).to.be.true;
      expect(remainingReg.versionNumber).to.equal(1);
      expect(remainingReg.name).to.include('Jeanne Clery');
    } catch (error) {
      console.error('Error in test:', error);
      throw error;
    }
  });

  afterEach(async function() {
    try {
      // Clean up test data
      const existingRegs = await storage.getRegulations();
      const testRegs = existingRegs.filter(reg => reg.itemId.startsWith('TEST-CLERY-'));
      for (const reg of testRegs) {
        await storage.deleteRegulation(reg.id);
      }
    } catch (error) {
      console.error('Error in afterEach:', error);
      throw error;
    }
  });
});