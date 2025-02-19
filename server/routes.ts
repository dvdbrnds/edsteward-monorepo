import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertRegulationSchema, insertNotificationSchema, insertDeadlineSchema, regulations } from "@shared/schema";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { eq } from "drizzle-orm";
import { db } from "./db";

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
      let updateCount = 0;
      let skipCount = 0;

      for (const record of records) {
        try {
          // Combine multiple statute fields into an array
          const statutes = [
            record['Statute 1'],
            record['Statute 2'],
            record['Statute 3'],
            record['Statute 4']
          ].filter(Boolean);

          // Combine multiple regulation fields into an array
          const regulationTexts = [
            record['Regulation 1'],
            record['Regulation 2'],
            record['Regulation 3'],
            record['Regulation 4'],
            record['Regulation 5']
          ].filter(Boolean);

          // Extract category from Topic field or fallback to default categories
          let category = "Other";
          const topic = record['Topic'] || "";
          const itemId = record['Item ID'] || String(record['Topic ID'] || "");

          if (topic.includes("Academic")) category = "Academic Programs";
          else if (topic.includes("Athletics")) category = "Athletics";
          else if (topic.includes("Financial") || topic.includes("Accounting")) category = "Accounting";
          else if (topic.includes("Admission")) category = "Admissions";
          else if (topic.includes("Safety") || topic.includes("Security")) category = "Campus Safety";

          const existingRegulation = await db.query.regulations.findFirst({
            where: eq(regulations.itemId, itemId),
          });

          const regulationData = {
            itemId,
            topic,
            topicId: record['Topic ID'] || null,
            statute: record['Statute Name'] || statutes.join('; '),
            statuteIds: record['Statute IDs'] || null,
            summary: record['Statutory Summary'] || null,
            requirements: regulationTexts.join('\n\n') || record['Reporting Requirements'] || null,
            deadlines: record['Deadlines'] || null,
            category,
            lastUpdated: record['Last Updated'] ? new Date(record['Last Updated']) : new Date(),
            contactEmail: record['Contact Email'] || null,
            department: record['Department'] || null,
            complianceStatus: record['Compliance Status'] || null,
            reviewFrequency: record['Review Frequency'] || null,
            nextReviewDate: record['Next Review Date'] ? new Date(record['Next Review Date']) : null,
            notes: record['Notes'] || null,
            statutes: statutes,
            regulations: regulationTexts,
          };

          if (existingRegulation) {
            await db
              .update(regulations)
              .set(regulationData)
              .where(eq(regulations.id, existingRegulation.id));
            updateCount++;
            console.log(`Updated regulation: ${itemId} (${category})`);
          } else {
            await storage.createRegulation(regulationData);
            newCount++;
            console.log(`Imported new regulation: ${itemId} (${category})`);
          }
        } catch (error) {
          console.error(`Failed to process record:`, error);
          console.error('Record data:', record);
          skipCount++;
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