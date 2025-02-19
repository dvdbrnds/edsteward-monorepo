import { storage } from "./storage";
import type { InsertDeadline } from "@shared/schema";
import { parse, isBefore } from "date-fns";

async function populateDeadlines() {
  try {
    console.log("Starting deadline population...");

    // Get all regulations
    const regulations = await storage.getRegulations();
    console.log(`Found ${regulations.length} regulations to process`);

    let deadlinesCreated = 0;

    for (const regulation of regulations) {
      try {
        if (!regulation.deadlines) {
          console.log(`No deadlines for regulation ${regulation.itemId}`);
          continue;
        }

        console.log(`Processing deadlines for regulation ${regulation.itemId}:`, regulation.deadlines);

        // Parse the deadline date from the deadlines field
        // Try multiple date formats
        let dueDate: Date | null = null;
        const dateFormats = [
          'yyyy-MM-dd',
          'MM/dd/yyyy',
          'MM-dd-yyyy'
        ];

        // First try to match a date in yyyy-MM-dd format
        const isoMatch = regulation.deadlines.match(/\d{4}[-/]\d{2}[-/]\d{2}/);
        if (isoMatch) {
          try {
            dueDate = parse(isoMatch[0], 'yyyy-MM-dd', new Date());
          } catch (e) {
            console.log(`Failed to parse ISO date ${isoMatch[0]}`);
          }
        }

        // If no ISO date found, try other formats
        if (!dueDate) {
          const anyDateMatch = regulation.deadlines.match(/\d{1,2}[-/]\d{1,2}[-/]\d{4}/);
          if (anyDateMatch) {
            for (const format of dateFormats) {
              try {
                dueDate = parse(anyDateMatch[0], format, new Date());
                if (dueDate && !isNaN(dueDate.getTime())) {
                  break;
                }
              } catch (e) {
                continue;
              }
            }
          }
        }

        if (!dueDate) {
          console.log(`No valid date found in deadlines text: ${regulation.deadlines}`);
          continue;
        }

        // Set status based on due date
        const today = new Date();
        const status = isBefore(dueDate, today) ? "overdue" : "pending";

        const deadline: InsertDeadline = {
          regulationId: regulation.id,
          dueDate,
          status,
          assignedTo: 6, // Assuming user ID 6 is the default compliance officer
        };

        await storage.createDeadline(deadline);
        deadlinesCreated++;
        console.log(`Created deadline for regulation ${regulation.itemId} (${dueDate.toISOString()})`);
      } catch (error) {
        console.error(`Failed to process deadline for regulation ${regulation.itemId}:`, error);
        if (regulation.deadlines) {
          console.error('Deadlines content:', regulation.deadlines);
        }
      }
    }

    console.log('\nDeadlines Population Summary:');
    console.log(`Total deadlines created: ${deadlinesCreated}`);
    console.log('Population completed');

  } catch (error) {
    console.error('Failed to populate deadlines:', error);
    throw error;
  }
}

populateDeadlines().catch(console.error);