import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertRegulationSchema, insertNotificationSchema, insertDeadlineSchema, insertCsvSchemaSchema, insertValidationRuleSchema, insertFieldMappingSchema } from "@shared/schema";
import multer from "multer";
import { parse } from "csv-parse/sync";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { regulations } from "@shared/schema";
import { RegulationValidator } from "./validation";
import { RegulationETL, ETLProcessor } from "./services/etl";
import xlsx from 'xlsx';

const upload = multer({ storage: multer.memoryStorage() });

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // Add this endpoint with the other setup routes
  app.get("/api/setup/has-admin", async (req, res) => {
    try {
      const hasAdmin = await storage.hasAdmin();
      res.json(hasAdmin);
    } catch (error) {
      console.error("Failed to check admin existence:", error);
      res.status(500).json({ message: "Failed to check admin existence" });
    }
  });

  // Setup wizard endpoint
  app.post("/api/setup/admin", async (req, res) => {
    if (!req.body.username || !req.body.password) {
      return res.status(400).json({ message: "Username and password are required" });
    }

    try {
      const hasAdmin = await storage.hasAdmin();
      if (hasAdmin) {
        return res.status(400).json({ message: "Admin already exists" });
      }

      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      const user = await storage.createUser({
        ...req.body,
        role: "admin", // Force role to be admin for setup wizard
      });

      req.login(user, (err) => {
        if (err) return res.status(500).json({ message: "Login failed after creation" });
        res.status(201).json(user);
      });
    } catch (error) {
      console.error("Setup wizard error:", error);
      res.status(500).json({ message: "Failed to create admin user" });
    }
  });

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
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required"
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded"
      });
    }

    try {
      // Create a default schema if not provided
      let schema = await storage.getCsvSchema(1); // Get default schema if exists
      if (!schema) {
        // Create a basic default schema
        schema = await storage.createCsvSchema({
          name: "Default Regulation Schema",
          description: "Default schema for regulation imports",
          createdBy: req.user.id, // Add the createdBy field
          schema: {
            "Topic": { type: "string", required: true },
            "Item ID": { type: "string", required: true },
            "Statute": { type: "string", required: true },
            "Requirements": { type: "string", required: true },
            "Category": { type: "string", required: false },
            "Deadlines": { type: "string", required: false }
          }
        });
      }

      // Get validation rules for the schema
      const validationRules = await storage.getValidationRules(schema.id);

      const fileContent = req.file.buffer.toString('utf-8');
      console.log("Processing CSV import with schema:", schema.name);

      const result = await etlService.importFromCSV(fileContent, schema, validationRules);

      res.json({
        success: true,
        message: 'Import completed successfully',
        ...result
      });
    } catch (error) {
      console.error('Import failed:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to import CSV file. Please check your file format and try again.',
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

  app.patch("/api/regulations/:id/notification-override", async (req, res) => {
    if (!req.user || req.user.role !== "admin") {
      return res.status(403).json({ message: "Only admins can set notification overrides" });
    }

    try {
      const regulationId = parseInt(req.params.id, 10);
      if (isNaN(regulationId)) {
        return res.status(400).json({ message: "Invalid regulation ID" });
      }

      const regulation = await storage.getRegulation(regulationId);
      if (!regulation) {
        return res.status(404).json({ message: "Regulation not found" });
      }

      const updatedRegulation = await storage.updateRegulation(regulationId, {
        ...regulation,
        notificationOverride: {
          email: req.body.email || null,
          phone: req.body.phone || null,
        },
      });

      res.json(updatedRegulation);
    } catch (error) {
      console.error("Failed to update notification override:", error);
      res.status(500).json({ message: "Failed to update notification override" });
    }
  });


  // CSV Schema Management
  app.post("/api/etl/schemas", async (req, res) => {
    try {
      const data = insertCsvSchemaSchema.parse(req.body);
      const schema = await storage.createCsvSchema(data);
      res.json(schema);
    } catch (error) {
      console.error("Failed to create CSV schema:", error);
      res.status(500).json({
        message: "Failed to create CSV schema",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.get("/api/etl/schemas", async (req, res) => {
    try {
      const schemas = await storage.getCsvSchemas();
      res.json(schemas);
    } catch (error) {
      console.error("Failed to fetch CSV schemas:", error);
      res.status(500).json({
        message: "Failed to fetch CSV schemas",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Validation Rules Management
  app.post("/api/etl/schemas/:schemaId/rules", async (req, res) => {
    try {
      const { schemaId } = req.params;
      const data = insertValidationRuleSchema.parse({
        ...req.body,
        schemaId: parseInt(schemaId, 10)
      });
      const rule = await storage.createValidationRule(data);
      res.json(rule);
    } catch (error) {
      console.error("Failed to create validation rule:", error);
      res.status(500).json({
        message: "Failed to create validation rule",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.get("/api/etl/schemas/:schemaId/rules", async (req, res) => {
    try {
      const { schemaId } = req.params;
      const rules = await storage.getValidationRules(parseInt(schemaId, 10));
      res.json(rules);
    } catch (error) {
      console.error("Failed to fetch validation rules:", error);
      res.status(500).json({
        message: "Failed to fetch validation rules",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Field Mappings Management
  app.post("/api/etl/schemas/:schemaId/mappings", async (req, res) => {
    try {
      const { schemaId } = req.params;
      const data = insertFieldMappingSchema.parse({
        ...req.body,
        schemaId: parseInt(schemaId, 10)
      });
      const mapping = await storage.createFieldMapping(data);
      res.json(mapping);
    } catch (error) {
      console.error("Failed to create field mapping:", error);
      res.status(500).json({
        message: "Failed to create field mapping",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Process CSV with Schema
  app.post("/api/etl/process", upload.single('file'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded"
      });
    }

    const schemaId = parseInt(req.body.schemaId, 10);
    if (isNaN(schemaId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid schema ID"
      });
    }

    try {
      const schema = await storage.getCsvSchema(schemaId);
      if (!schema) {
        return res.status(404).json({
          success: false,
          message: "Schema not found"
        });
      }

      const validationRules = await storage.getValidationRules(schemaId);
      const processor = new ETLProcessor();
      const fileContent = req.file.buffer.toString('utf-8');
      const result = await processor.processCSV(fileContent, schema, validationRules);

      res.json({
        success: true,
        message: 'Processing completed',
        ...result
      });
    } catch (error) {
      console.error('Processing failed:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process CSV file',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}