import { storage } from "./storage";
import type { InsertDeadline, InsertNotification } from "@shared/schema";
import { addMonths, addDays, subDays } from "date-fns";

async function populateMissingData() {
  try {
    console.log("Starting to populate missing data...");

    // Get all regulations
    const regulations = await storage.getRegulations();
    console.log(`Found ${regulations.length} regulations`);

    // Get all users
    const users = await storage.getUsers();
    console.log(`Found ${users.length} users`);

    if (regulations.length === 0 || users.length === 0) {
      console.log("No regulations or users found, skipping data population");
      return;
    }

    // Check if deadlines already exist
    const existingDeadlines = await storage.getDeadlines();
    console.log(`Found ${existingDeadlines.length} existing deadlines`);

    if (existingDeadlines.length === 0) {
      console.log("Creating sample deadlines...");
      
      // Create deadlines for first 20 regulations
      const regulationsToProcess = regulations.slice(0, 20);
      let deadlinesCreated = 0;

      for (const regulation of regulationsToProcess) {
        try {
          // Create varied deadlines - some overdue, some upcoming, some completed
          const randomOffset = Math.floor(Math.random() * 12) - 6; // -6 to +6 months
          const dueDate = addMonths(new Date(), randomOffset);
          
          // Determine status based on date
          let status = "pending";
          if (randomOffset < -2) {
            status = "overdue";
          } else if (randomOffset < 0) {
            status = Math.random() > 0.5 ? "completed" : "overdue";
          }

          const deadline: InsertDeadline = {
            regulationId: regulation.id,
            dueDate: dueDate.toISOString().split('T')[0],
            status,
            assignedTo: users[Math.floor(Math.random() * users.length)].id,
          };

          await storage.createDeadline(deadline);
          deadlinesCreated++;
          console.log(`Created deadline for regulation ${regulation.id} (${deadline.dueDate}, ${status})`);
        } catch (error) {
          console.error(`Failed to create deadline for regulation ${regulation.id}:`, error);
        }
      }

      console.log(`Created ${deadlinesCreated} deadlines`);
    }

    // Check if notifications exist
    const existingNotifications = await storage.getNotificationsByUser(users[0].id);
    console.log(`Found ${existingNotifications.length} existing notifications for user ${users[0].id}`);

    if (existingNotifications.length === 0) {
      console.log("Creating sample notifications...");
      
      let notificationsCreated = 0;

      // Create some sample notifications for each user
      for (const user of users.slice(0, 5)) { // First 5 users
        try {
          // Email notification
          const emailNotification: InsertNotification = {
            userId: user.id,
            type: "email",
            frequency: "weekly",
            enabled: true,
            lastSent: subDays(new Date(), Math.floor(Math.random() * 7)).toISOString(),
          };

          await storage.createNotification(emailNotification);
          notificationsCreated++;

          // SMS notification (some users)
          if (Math.random() > 0.5) {
            const smsNotification: InsertNotification = {
              userId: user.id,
              type: "sms",
              frequency: "daily",
              enabled: Math.random() > 0.3, // 70% enabled
              lastSent: subDays(new Date(), Math.floor(Math.random() * 3)).toISOString(),
            };

            await storage.createNotification(smsNotification);
            notificationsCreated++;
          }

          console.log(`Created notifications for user ${user.username}`);
        } catch (error) {
          console.error(`Failed to create notifications for user ${user.id}:`, error);
        }
      }

      console.log(`Created ${notificationsCreated} notifications`);
    }

    console.log("Data population completed successfully!");

  } catch (error) {
    console.error("Failed to populate missing data:", error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  populateMissingData()
    .then(() => {
      console.log("✅ Data population completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Data population failed:", error);
      process.exit(1);
    });
}

export { populateMissingData }; 