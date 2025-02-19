import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertRegulationSchema, insertNotificationSchema, insertDeadlineSchema } from "@shared/schema";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { regulations } from "@shared/schema";
import { RegulationValidator } from "./validation";

const upload = multer({ storage: multer.memoryStorage() });

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // Regulations endpoints
  app.get("/api/regulations", async (req, res) => {
    const regulations = await storage.getRegulations();
    res.json(regulations);
  });

  app.post("/api/regulations", async (req, res) => {
    const data = insertRegulationSchema.parse(req.body);
    const regulation = await storage.createRegulation(data);
    res.json(regulation);
  });

  // CSV Import endpoint
  app.post("/api/regulations/import", upload.single('file'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    try {
      // Parse CSV content
      const fileContent = req.file.buffer.toString('utf-8');
      const records = parse(fileContent, {
        columns: (header: string[]) => {
          return header.map(col => col.trim()).filter(col => col !== '');
        },
        skip_empty_lines: true,
        from_line: 2,
        relax_column_count: true,
        trim: true
      });

      console.log(`Processing ${records.length} records from uploaded CSV`);

      let newCount = 0;
      let skipCount = 0;
      let updateCount = 0;

      for (const record of records) {
        try {
          // Combine multiple statute fields into one
          const statutes = [
            record['Statute 1'],
            record['Statute 2'],
            record['Statute 3'],
            record['Statute 4']
          ].filter(Boolean).join('; ');

          // Combine multiple regulation fields
          const requirements = [
            record['Regulation 1'],
            record['Regulation 2'],
            record['Regulation 3'],
            record['Regulation 4'],
            record['Regulation 5']
          ].filter(Boolean).join('\n\n');

          // Extract category from Topic field or fallback to default categories
          let category = "Other";
          const topic = record['Topic'] || "";
          const itemId = record['Item ID'] || String(record['Topic ID'] || "");

          if (topic.includes("Academic")) category = "Academic Programs";
          else if (topic.includes("Athletics")) category = "Athletics";
          else if (topic.includes("Financial") || topic.includes("Accounting")) category = "Accounting";
          else if (topic.includes("Admission")) category = "Admissions";
          else if (topic.includes("Safety") || topic.includes("Security")) category = "Campus Safety";

          // Check if regulation already exists
          const [existingRegulation] = await db
            .select()
            .from(regulations)
            .where(eq(regulations.itemId, itemId));

          if (existingRegulation) {
            if (
              existingRegulation.topic !== topic ||
              existingRegulation.statute !== record['Statute Name'] ||
              existingRegulation.requirements !== requirements
            ) {
              // Update existing regulation if content has changed
              await db
                .update(regulations)
                .set({
                  topic,
                  statute: record['Statute Name'] || statutes,
                  requirements: requirements || record['Reporting Requirements'] || "",
                  deadlines: record['Deadlines'] || "",
                  category,
                  lastUpdated: new Date()
                })
                .where(eq(regulations.id, existingRegulation.id));
              updateCount++;
            } else {
              skipCount++;
            }
            continue;
          }

          const regulation = {
            itemId,
            topic,
            statute: record['Statute Name'] || statutes,
            requirements: requirements || record['Reporting Requirements'] || "",
            deadlines: record['Deadlines'] || "",
            category,
            lastUpdated: record['Last Updated'] ? new Date(record['Last Updated']) : new Date()
          };

          await storage.createRegulation(regulation);
          newCount++;
        } catch (error) {
          console.error(`Failed to process record:`, error);
          console.error('Record data:', record);
        }
      }

      res.json({
        message: 'Import completed successfully',
        newCount,
        updateCount,
        skipCount
      });
    } catch (error) {
      console.error('Import failed:', error);
      res.status(500).json({ 
        message: 'Failed to import CSV file',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Add new validation endpoint
  app.post("/api/regulations/validate", async (req, res) => {
    try {
      console.log("Starting validation process...");
      const regulations = await storage.getRegulations();
      console.log(`Found ${regulations.length} regulations to validate`);

      const validator = new RegulationValidator();
      const report = await validator.validateAll(regulations);

      console.log("Validation complete:", {
        totalRegulations: report.totalRegulations,
        validRegulations: report.validRegulations,
        errors: report.errors.length,
        warnings: report.warnings.length
      });

      res.json(report);
    } catch (error) {
      console.error('Validation failed:', error);
      res.status(500).json({ 
        message: 'Failed to validate regulations',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Notifications endpoints
  app.get("/api/notifications", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const notifications = await storage.getNotificationsByUser(req.user.id);
    res.json(notifications);
  });

  app.post("/api/notifications", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const data = insertNotificationSchema.parse(req.body);
    const notification = await storage.createNotification(data);
    res.json(notification);
  });

  // Deadlines endpoints
  app.get("/api/deadlines", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const deadlines = await storage.getDeadlines();
    res.json(deadlines);
  });

  app.post("/api/deadlines", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    const data = insertDeadlineSchema.parse(req.body);
    const deadline = await storage.createDeadline(data);
    res.json(deadline);
  });

  // Guides endpoints
  app.get("/api/guides", async (req, res) => {
    const { category } = req.query;
    if (category) {
      const guides = await storage.getGuidesByCategory(category as string);
      res.json(guides);
    } else {
      const guides = await storage.getGuides();
      res.json(guides);
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}