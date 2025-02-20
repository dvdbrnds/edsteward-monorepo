import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertRegulationSchema } from "@shared/schema";
import multer from "multer";
import { importRegulationsFromCSV } from "./services/etl";

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
      return res.status(400).json({
        success: false,
        message: "No file uploaded"
      });
    }

    try {
      const fileContent = req.file.buffer.toString('utf-8');
      const result = await importRegulationsFromCSV(fileContent);

      if (result.errors.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Import completed with validation errors",
          details: {
            processed: result.newCount + result.updateCount,
            errors: result.errors
          }
        });
      }

      res.json({
        success: true,
        message: "Import completed successfully",
        details: {
          new: result.newCount,
          updated: result.updateCount
        }
      });
    } catch (error) {
      console.error("Import failed:", error);
      res.status(500).json({
        success: false,
        message: "Failed to process CSV file",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}