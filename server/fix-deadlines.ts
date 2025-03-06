
import { storage } from "./storage";
import type { InsertDeadline } from "@shared/schema";
import { addYears, addMonths } from "date-fns";

async function createDeadlines() {
  try {
    console.log("Starting deadline generation...");

    // Get all regulations
    const regulations = await storage.getRegulations();
    console.log(`Found ${regulations.length} regulations to process`);

    // Create a deadline for each regulation (if it doesn't already have one)
    let deadlinesCreated = 0;

    for (const regulation of regulations) {
      try {
        // Create deadline - some in the near future, some in past (to show overdue)
        const randomMonths = Math.floor(Math.random() * 6) - 2; // -2 to 3 months
        const dueDate = addMonths(new Date(), randomMonths);
        
        const deadline: InsertDeadline = {
          regulationId: regulation.id,
          dueDate: dueDate.toISOString().split('T')[0], // Convert to YYYY-MM-DD string format
          status: randomMonths < 0 ? "overdue" : "pending", // Set overdue if in past
          assignedTo: 1, // Default to first user
        };

        await storage.createDeadline(deadline);
        deadlinesCreated++;
        console.log(`Created deadline for regulation ${regulation.itemId} (${deadline.dueDate})`);
      } catch (error) {
        console.error(`Failed to create deadline for regulation ${regulation.itemId}:`, error);
      }
    }

    console.log(`\nTotal deadlines created: ${deadlinesCreated}`);
    console.log(`Total regulations processed: ${regulations.length}`);
    console.log('Deadline generation completed');

  } catch (error) {
    console.error('Failed to generate deadlines:', error);
  }
}

createDeadlines().catch(console.error);
