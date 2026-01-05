
import { storage } from "./storage";
import type { InsertDeadline } from "@shared/schema";
import { addMonths } from "date-fns";

async function createDeadlines() {
  try {

    // Get all regulations
    const regulations = await storage.getRegulations();

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
      } catch (error) {
        console.error(`Failed to create deadline for regulation ${regulation.itemId}:`, error);
      }
    }


  } catch (error) {
    console.error('Failed to generate deadlines:', error);
  }
}

createDeadlines().catch(console.error);
