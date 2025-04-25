/**
 * MCP Engine Demo Client
 * 
 * This script demonstrates the core functionality of the MCP Engine
 * without requiring a running server.
 */

import { v4 as uuidv4 } from 'uuid';

// Mock database for regulations
const regulations = [
  {
    regulationId: 'gdpr-2018',
    name: 'General Data Protection Regulation',
    description: 'EU data protection and privacy regulation',
    version: '1.0',
    enactedDate: '2018-05-25',
    publicLaw: 'EU 2016/679',
    status: 'Active',
    createdAt: '2023-06-10T12:00:00Z',
    updatedAt: '2023-06-10T12:00:00Z',
    keyProvisions: [
      {
        title: 'Right to Access',
        description: 'Individuals have the right to access their personal data'
      },
      {
        title: 'Right to be Forgotten',
        description: 'Individuals have the right to have their personal data erased'
      }
    ]
  },
  {
    regulationId: 'hipaa-1996',
    name: 'Health Insurance Portability and Accountability Act',
    description: 'US healthcare privacy regulation',
    version: '2.1',
    enactedDate: '1996-08-21',
    publicLaw: '104-191',
    status: 'Active',
    createdAt: '2023-06-10T12:01:00Z',
    updatedAt: '2023-06-10T12:01:00Z',
    keyProvisions: [
      {
        title: 'Privacy Rule',
        description: 'Establishes national standards for the protection of health information'
      },
      {
        title: 'Security Rule',
        description: 'Sets standards for securing patient data'
      }
    ]
  },
  {
    regulationId: 'ccpa-2018',
    name: 'California Consumer Privacy Act',
    description: 'California law focused on consumer privacy rights',
    version: '1.0',
    enactedDate: '2018-06-28',
    publicLaw: 'AB-375',
    status: 'Active',
    createdAt: '2023-06-10T12:02:00Z',
    updatedAt: '2023-06-10T12:02:00Z',
    keyProvisions: [
      {
        title: 'Right to Know',
        description: 'Consumers have the right to know what personal information businesses collect'
      },
      {
        title: 'Right to Delete',
        description: 'Consumers have the right to request deletion of personal information'
      }
    ]
  }
];

// Mock responses for queries
const mockResponses = {
  'GDPR': 'The GDPR (General Data Protection Regulation) provides several rights to data subjects including: right to access, right to rectification, right to erasure, right to restriction of processing, right to data portability, right to object, and rights related to automated decision making and profiling.',
  'HIPAA': 'HIPAA (Health Insurance Portability and Accountability Act) provides patients with several rights including: right to access their health information, right to request corrections, right to receive a notice of privacy practices, right to request restrictions, right to confidential communications, right to an accounting of disclosures, and right to file complaints.',
  'CCPA': 'The CCPA (California Consumer Privacy Act) provides California residents with rights including: right to know what personal information is collected, right to delete personal information, right to opt-out of the sale of personal information, and right to non-discrimination for exercising these rights.',
  default: 'This regulation has not been fully processed yet. Please check back later or initiate data collection.'
};

// RegulationMCPClient mock
class RegulationMCPClient {
  // Get all regulations
  async getRegulations() {
    console.log('🔍 Fetching all regulations...');
    await this.simulateDelay(500);
    console.log(`✅ Retrieved ${regulations.length} regulations`);
    return [...regulations];
  }
  
  // Get a specific regulation
  async getRegulation(regulationId) {
    console.log(`🔍 Fetching regulation with ID: ${regulationId}...`);
    await this.simulateDelay(300);
    
    const regulation = regulations.find(r => r.regulationId === regulationId);
    if (!regulation) {
      console.error(`❌ Regulation not found: ${regulationId}`);
      throw new Error('Regulation not found');
    }
    
    console.log(`✅ Retrieved regulation: ${regulation.name}`);
    return { ...regulation };
  }
  
  // Add regulations
  async addRegulations(newRegulations) {
    console.log(`🔍 Adding ${Array.isArray(newRegulations) ? newRegulations.length : 1} regulations...`);
    await this.simulateDelay(800);
    
    const regs = Array.isArray(newRegulations) ? newRegulations : [newRegulations];
    const added = [];
    const updated = [];
    
    regs.forEach(reg => {
      const existingIndex = regulations.findIndex(r => 
        r.name === reg.name && r.version === reg.version
      );
      
      if (existingIndex >= 0) {
        console.log(`📝 Updating existing regulation: ${reg.name}`);
        regulations[existingIndex] = {
          ...regulations[existingIndex],
          ...reg,
          updatedAt: new Date().toISOString()
        };
        updated.push(regulations[existingIndex].regulationId);
      } else {
        console.log(`📝 Adding new regulation: ${reg.name}`);
        const regulationId = reg.regulationId || uuidv4();
        const now = new Date().toISOString();
        
        const newReg = {
          ...reg,
          regulationId,
          status: reg.status || 'Pending',
          createdAt: now,
          updatedAt: now
        };
        
        regulations.push(newReg);
        added.push(regulationId);
      }
    });
    
    console.log(`✅ Added: ${added.length}, Updated: ${updated.length}`);
    return {
      message: 'Regulations processed successfully',
      added: added.length,
      updated: updated.length,
      addedIds: added,
      updatedIds: updated
    };
  }
  
  // Update a regulation
  async updateRegulation(regulationId, data) {
    console.log(`🔍 Updating regulation with ID: ${regulationId}...`);
    await this.simulateDelay(300);
    
    const index = regulations.findIndex(r => r.regulationId === regulationId);
    if (index === -1) {
      console.error(`❌ Regulation not found: ${regulationId}`);
      throw new Error('Regulation not found');
    }
    
    regulations[index] = {
      ...regulations[index],
      ...data,
      updatedAt: new Date().toISOString()
    };
    
    console.log(`✅ Updated regulation: ${regulations[index].name}`);
    return { ...regulations[index] };
  }
  
  // Delete a regulation
  async deleteRegulation(regulationId) {
    console.log(`🔍 Deleting regulation with ID: ${regulationId}...`);
    await this.simulateDelay(500);
    
    const initialLength = regulations.length;
    const index = regulations.findIndex(r => r.regulationId === regulationId);
    
    if (index === -1) {
      console.error(`❌ Regulation not found: ${regulationId}`);
      throw new Error('Regulation not found');
    }
    
    const deletedName = regulations[index].name;
    regulations.splice(index, 1);
    
    console.log(`✅ Deleted regulation: ${deletedName}`);
    return { message: 'Regulation deleted successfully' };
  }
  
  // Query a regulation
  async queryRegulation(regulationId, query) {
    console.log(`🔍 Querying regulation with ID: ${regulationId}...`);
    console.log(`📄 Query: "${query}"`);
    await this.simulateDelay(1500);
    
    const regulation = regulations.find(r => r.regulationId === regulationId);
    if (!regulation) {
      console.error(`❌ Regulation not found: ${regulationId}`);
      throw new Error('Regulation not found');
    }
    
    // Get the appropriate response
    const response = mockResponses[regulation.name] || mockResponses.default;
    
    console.log(`✅ Query completed for: ${regulation.name}`);
    return {
      response,
      regulation: regulation.name,
      query
    };
  }
  
  // Collect data
  async collectData(regulationId, urls) {
    console.log(`🔍 Collecting data for regulation with ID: ${regulationId}...`);
    console.log(`📄 URLs: ${urls.join(', ')}`);
    await this.simulateDelay(2000);
    
    const regulation = regulations.find(r => r.regulationId === regulationId);
    if (!regulation) {
      console.error(`❌ Regulation not found: ${regulationId}`);
      throw new Error('Regulation not found');
    }
    
    // Update regulation status
    regulation.status = 'Collecting';
    regulation.updatedAt = new Date().toISOString();
    console.log(`📝 Updated status to "Collecting" for: ${regulation.name}`);
    
    // Simulate background processing
    setTimeout(() => {
      regulation.status = 'Active';
      regulation.updatedAt = new Date().toISOString();
      console.log(`📝 Processing complete, updated status to "Active" for: ${regulation.name}`);
    }, 5000);
    
    console.log(`✅ Data collection initiated for: ${regulation.name}`);
    return {
      message: 'Data collection started successfully',
      regulationId,
      urls,
      jobId: `job_${Date.now()}`
    };
  }
  
  // Helper to simulate network delay
  async simulateDelay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Create client instance
const regulationClient = new RegulationMCPClient();

// Demo functions
async function runDemo() {
  console.log('🚀 Starting MCP Engine Demo...\n');
  
  try {
    // 1. Fetch all regulations
    console.log('\n===== Fetching All Regulations =====');
    const allRegulations = await regulationClient.getRegulations();
    console.log(`Found ${allRegulations.length} regulations:\n${allRegulations.map(r => `- ${r.name}`).join('\n')}\n`);
    
    // 2. Add a new regulation
    console.log('\n===== Adding New Regulation =====');
    const newRegulation = {
      name: 'EU AI Act',
      description: 'European regulation on artificial intelligence',
      version: '1.0',
      enactedDate: '2024-01-15',
      publicLaw: 'EU 2024/123',
      keyProvisions: [
        {
          title: 'Risk-Based Approach',
          description: 'Categorizes AI systems based on their risk level'
        },
        {
          title: 'Prohibited AI Practices',
          description: 'Bans AI systems that pose unacceptable risk'
        }
      ]
    };
    
    const addResult = await regulationClient.addRegulations(newRegulation);
    console.log(`Added regulation with ID: ${addResult.addedIds[0]}\n`);
    
    // Save the new regulation ID for later use
    const newRegId = addResult.addedIds[0];
    
    // 3. Query a regulation
    console.log('\n===== Querying a Regulation =====');
    const queryResult = await regulationClient.queryRegulation('gdpr-2018', 'What rights do data subjects have under this regulation?');
    console.log(`Query response: ${queryResult.response}\n`);
    
    // 4. Update a regulation
    console.log('\n===== Updating a Regulation =====');
    const updateResult = await regulationClient.updateRegulation(newRegId, {
      status: 'Under Review',
      notes: 'Pending final approval from legal team'
    });
    console.log(`Updated regulation: ${updateResult.name} (Status: ${updateResult.status})\n`);
    
    // 5. Collect data for a regulation
    console.log('\n===== Collecting Data for a Regulation =====');
    const collectResult = await regulationClient.collectData(newRegId, [
      'https://example.com/eu-ai-act-full-text',
      'https://example.com/eu-ai-act-summary'
    ]);
    console.log(`Data collection job started: ${collectResult.jobId}\n`);
    
    // 6. Delete a regulation (after waiting a bit)
    console.log('\n===== Deleting a Regulation =====');
    await regulationClient.simulateDelay(3000);
    const deleteResult = await regulationClient.deleteRegulation(newRegId);
    console.log(`${deleteResult.message}\n`);
    
    // 7. Verify deletion
    console.log('\n===== Verifying Deletion =====');
    const finalRegulations = await regulationClient.getRegulations();
    console.log(`Current regulations: ${finalRegulations.length}`);
    console.log(finalRegulations.map(r => `- ${r.name}`).join('\n'));
    
    console.log('\n✅ Demo completed successfully!');
  } catch (error) {
    console.error('\n❌ Demo failed with error:', error.message);
  }
}

// Run the demo
runDemo(); 