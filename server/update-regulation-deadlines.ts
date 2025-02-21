import { storage } from "./storage";
import type { Regulation } from "@shared/schema";

async function updateRegulationDeadlines() {
  try {
    console.log("Starting regulation deadline updates...");

    // Get all regulations
    const regulations = await storage.getRegulations();
    console.log(`Found ${regulations.length} regulations to process`);

    const deadlinePatterns = [
      {
        type: "Annual Filing",
        frequency: "Yearly",
        date: "2025-12-31",
        description: "Annual compliance report submission"
      },
      {
        type: "Quarterly Report",
        frequency: "Quarterly",
        date: "2025-03-31",
        description: "Q1 compliance status update"
      },
      {
        type: "Initial Registration",
        frequency: "One-time",
        date: "2025-06-30",
        description: "Initial registration deadline"
      }
    ];

    let updatedCount = 0;

    // Update regulations with sample filing deadlines
    for (const regulation of regulations) {
      try {
        // Only update regulations that don't have filing deadlines
        if (!regulation.filingDeadlines) {
          // Randomly assign 1-2 deadlines to each regulation
          const numDeadlines = Math.floor(Math.random() * 2) + 1;
          const selectedDeadlines = deadlinePatterns
            .sort(() => Math.random() - 0.5)
            .slice(0, numDeadlines);

          // Update the regulation
          await storage.updateRegulation(
            regulation.id,
            { filingDeadlines: selectedDeadlines }
          );

          updatedCount++;
          console.log(`Updated regulation ${regulation.itemId} with ${numDeadlines} deadline(s)`);
        }
      } catch (error) {
        console.error(`Failed to update regulation ${regulation.itemId}:`, error);
      }
    }

    console.log('\nRegulation Update Summary:');
    console.log(`Total regulations updated: ${updatedCount}`);
    console.log('Update completed');

  } catch (error) {
    console.error('Failed to update regulations:', error);
    throw error;
  }
}

updateRegulationDeadlines().catch(console.error);