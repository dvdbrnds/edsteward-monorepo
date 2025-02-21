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
        if (!regulation.filingDeadlines || regulation.filingDeadlines.length === 0) {
          console.log(`No filing deadlines for regulation ${regulation.itemId}`);
          continue;
        }

        console.log(`Processing deadlines for regulation ${regulation.itemId}:`, regulation.filingDeadlines);

        // Process each filing deadline from the JSONB array
        for (const filing of regulation.filingDeadlines) {
          try {
            // Parse the deadline date from the date field
            let dueDate: Date | null = null;
            const dateFormats = [
              'yyyy-MM-dd',
              'MM/dd/yyyy',
              'MM-dd-yyyy'
            ];

            // First try to match a date in yyyy-MM-dd format
            const isoMatch = filing.date.match(/\d{4}[-/]\d{2}[-/]\d{2}/);
            if (isoMatch) {
              try {
                dueDate = parse(isoMatch[0], 'yyyy-MM-dd', new Date());
              } catch (e) {
                console.log(`Failed to parse ISO date ${isoMatch[0]}`);
              }
            }

            // If no ISO date found, try other formats
            if (!dueDate) {
              const anyDateMatch = filing.date.match(/\d{1,2}[-/]\d{1,2}[-/]\d{4}/);
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
              console.log(`No valid date found in filing deadline: ${filing.date}`);
              continue;
            }

            // Set status based on due date
            const today = new Date();
            const status = isBefore(dueDate, today) ? "overdue" : "pending";

            const deadline: InsertDeadline = {
              regulationId: regulation.id,
              dueDate: dueDate.toISOString().split('T')[0], // Convert to YYYY-MM-DD string format
              status,
              completed: false,
              assignedTo: 6, // Assuming user ID 6 is the default compliance officer
            };

            await storage.createDeadline(deadline);
            deadlinesCreated++;
            console.log(`Created deadline for regulation ${regulation.itemId} (${deadline.dueDate})`);
          } catch (error) {
            console.error(`Failed to process filing deadline for regulation ${regulation.itemId}:`, error);
            console.error('Filing deadline content:', filing);
          }
        }
      } catch (error) {
        console.error(`Failed to process regulation ${regulation.itemId}:`, error);
        if (regulation.filingDeadlines) {
          console.error('Filing deadlines content:', regulation.filingDeadlines);
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