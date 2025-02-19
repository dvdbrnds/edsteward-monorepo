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
import { RegulationETL } from "./services/etl";
import xlsx from 'xlsx';

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

  const etlService = new RegulationETL();

  // CSV Import endpoint
  app.post("/api/regulations/import", upload.single('file'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        message: "No file uploaded" 
      });
    }

    try {
      const fileContent = req.file.buffer.toString('utf-8');
      const result = await etlService.importFromCSV(fileContent);

      res.json({
        success: true,
        message: 'Import completed successfully',
        ...result
      });
    } catch (error) {
      console.error('Import failed:', error);
      res.status(500).json({ 
        success: false,
        message: 'Failed to import CSV file',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Excel Import endpoint
  app.post("/api/regulations/import/excel", upload.single('file'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        message: "No file uploaded" 
      });
    }

    try {
      const workbook = xlsx.read(req.file.buffer);
      const result = await etlService.importFromExcel(workbook);

      res.json({
        success: true,
        message: 'Import completed successfully',
        ...result
      });
    } catch (error) {
      console.error('Import failed:', error);
      res.status(500).json({ 
        success: false,
        message: 'Failed to import Excel file',
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