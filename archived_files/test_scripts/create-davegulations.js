/**
 * Simple script to create 10 Davegulations
 * for testing MCP integration features
 */

import { db } from './server/db.js';
import { regulations } from './shared/schema.js';

async function createDavegulations() {
  console.log("Starting creation of Davegulations...");
  
  try {
    // Create 10 test regulations
    const davegulations = [];
    
    for (let i = 1; i <= 10; i++) {
      const now = new Date();
      const futureDate = new Date();
      futureDate.setMonth(now.getMonth() + 6);
      
      davegulations.push({
        itemId: `DAVE-${i}-${Date.now()}`,
        name: `Davegulation ${i}: Test Regulation`,
        topic: `Test Topic ${i}`,
        statute: `Davegulation Act ${i}`,
        summary: `This is a test regulation for MCP integration. Davegulation ${i} demonstrates integration with the MCP Orchestrator.`,
        requirements: `## Requirements for Davegulation ${i}\n\n- Requirement 1: Test requirement\n- Requirement 2: Another test requirement\n\n## Compliance Deadlines\n\nInitial documentation: 6/1/2025\nFull implementation: 12/1/2025`,
        category: i % 3 === 0 ? "Administrative" : i % 3 === 1 ? "Academic" : "Financial",
        jurisdiction: i % 2 === 0 ? "federal" : "state",
        dro: "dave@example.com",
        isApplicable: true,
        originationDate: now,
        effectiveDate: futureDate,
        lastUpdated: now,
        nextReviewDate: new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()),
        versionNumber: 1,
        versionDate: now,
        isCurrent: true,
        agency_name: "Dave Regulatory Authority",
        agency_contact: "contact@daveregulations.example.com",
        regulationUrl: `https://daveregulations.example.com/reg/${i}`
      });
    }
    
    // Insert regulations into database
    const result = await db.insert(regulations).values(davegulations).returning();
    
    console.log(`Successfully created ${result.length} Davegulations!`);
    console.log("Davegulation IDs:");
    result.forEach(reg => {
      console.log(`ID: ${reg.id}, Name: ${reg.name}`);
    });
    
  } catch (error) {
    console.error("Error creating Davegulations:", error);
  }
}

// Run the function
createDavegulations()
  .then(() => {
    console.log("Script completed successfully");
    process.exit(0);
  })
  .catch(error => {
    console.error("Script failed:", error);
    process.exit(1);
  });