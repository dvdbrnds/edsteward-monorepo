import { populateRegulationData } from "./services/regulation-data-collector";
import readline from 'readline';
import { writeFileSync } from 'fs';
import { db } from "./db";
import { regulations } from "@shared/schema";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

async function getAllRegulationIds(): Promise<string[]> {
  console.log("Fetching all regulation IDs from database...");
  const allRegulations = await db.select({ itemId: regulations.itemId }).from(regulations);
  return allRegulations.map(reg => reg.itemId);
}

async function processIndividualRegulations(): Promise<string[]> {
  const regulationIds: string[] = [];

  console.log("\nExample regulation IDs you can use:");
  console.log("- TITLE-IX-2024 (Education regulation)");
  console.log("- ADA-2024-001 (Accessibility regulation)");
  console.log("- FERPA-2024-UPDATE (Privacy regulation update)");

  while (true) {
    const id = await prompt("\nEnter a regulation ID (or press enter to finish): ");
    if (!id) break;
    regulationIds.push(id);
  }

  return regulationIds;
}

async function main() {
  try {
    console.log("Welcome to the Regulation Data Collector");
    console.log("----------------------------------------");

    const mode = await prompt("\nChoose operation mode:\n1. Process individual regulations\n2. Process all regulations\nEnter choice (1 or 2): ");

    let regulationIds: string[] = [];

    if (mode === "1") {
      regulationIds = await processIndividualRegulations();
    } else if (mode === "2") {
      regulationIds = await getAllRegulationIds();
      console.log(`Found ${regulationIds.length} regulations to process`);
    } else {
      console.log("Invalid choice. Exiting...");
      process.exit(1);
    }

    if (regulationIds.length === 0) {
      console.log("No regulation IDs to process. Exiting...");
      process.exit(0);
    }

    console.log("\nCollecting data for the following regulations:");
    regulationIds.forEach(id => console.log(`- ${id}`));

    await populateRegulationData(regulationIds);

    const saveToFile = await prompt("\nWould you like to save the results to a file? (y/n): ");
    if (saveToFile.toLowerCase() === 'y') {
      const filename = `regulation-data-${new Date().toISOString().split('T')[0]}.json`;
      writeFileSync(filename, JSON.stringify(regulationIds, null, 2));
      console.log(`Results saved to ${filename}`);
    }

  } catch (error) {
    console.error("Error:", error);
  } finally {
    rl.close();
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (error) => {
  console.error('Unhandled promise rejection:', error);
  process.exit(1);
});

main().catch(console.error);