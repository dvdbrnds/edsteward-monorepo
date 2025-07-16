import { storage } from "./storage";
import type { InsertDeadline } from "@shared/schema";
import { parse, isBefore, addYears } from "date-fns";

async function populateDeadlines() {
  try {
    console.log("Starting deadline population...");

    // Get all regulations
    const regulations = await storage.getRegulations();
    console.log(`Found ${regulations.length} regulations to process`);

    let deadlinesCreated = 0;
    let defaultDeadlinesCreated = 0;

    for (const regulation of regulations) {
      try {
        // Process explicit filing deadlines if they exist
        if (regulation.filingDeadlines && regulation.filingDeadlines.length > 0) {
          console.log(`Processing explicit deadlines for regulation ${regulation.itemId}`);

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
                } catch (_e) {
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
                    } catch (_e) {
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
                assignedTo: 1, // Default to first user
              };

              await storage.createDeadline(deadline);
              deadlinesCreated++;
              console.log(`Created explicit deadline for regulation ${regulation.itemId} (${deadline.dueDate})`);
            } catch (error) {
              console.error(`Failed to process filing deadline for regulation ${regulation.itemId}:`, error);
              console.error('Filing deadline content:', filing);
            }
          }
        } else {
          // Create default annual review deadline if no explicit deadlines exist
          console.log(`Creating default annual review deadline for regulation ${regulation.itemId}`);

          // Set default review date to one year from now
          const defaultDueDate = addYears(new Date(), 1);

          const defaultDeadline: InsertDeadline = {
            regulationId: regulation.id,
            dueDate: defaultDueDate.toISOString().split('T')[0],
            status: "pending",
            assignedTo: 1, // Default to first user
          };

          await storage.createDeadline(defaultDeadline);
          defaultDeadlinesCreated++;
          console.log(`Created default annual review deadline for regulation ${regulation.itemId}`);
        }
      } catch (error) {
        console.error(`Failed to process regulation ${regulation.itemId}:`, error);
        if (regulation.filingDeadlines) {
          console.error('Filing deadlines content:', regulation.filingDeadlines);
        }
      }
    }

    console.log('\nDeadlines Population Summary:');
    console.log(`Total explicit deadlines created: ${deadlinesCreated}`);
    console.log(`Total default deadlines created: ${defaultDeadlinesCreated}`);
    console.log(`Total regulations processed: ${regulations.length}`);
    console.log('Population completed');

  } catch (error) {
    console.error('Failed to populate deadlines:', error);
    throw error;
  }
}

populateDeadlines().catch(console.error);