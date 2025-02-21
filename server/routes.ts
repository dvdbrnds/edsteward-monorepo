import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertRegulationSchema } from "@shared/schema";
import { z } from "zod";

// Define a schema for the toggle request
const toggleApplicabilitySchema = z.object({
  isApplicable: z.boolean()
});

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // Regulations endpoints
  app.get("/api/regulations", async (req, res) => {
    const regulations = await storage.getRegulations();
    res.json(regulations);
  });

  // Add new endpoint for fetching individual regulation
  app.get("/api/regulations/:id", async (req, res) => {
    try {
      const regulationId = parseInt(req.params.id);
      if (isNaN(regulationId)) {
        return res.status(400).json({ error: "Invalid regulation ID" });
      }

      const regulation = await storage.getRegulation(regulationId);
      if (!regulation) {
        return res.status(404).json({ error: "Regulation not found" });
      }

      res.json(regulation);
    } catch (error) {
      console.error("Failed to fetch regulation:", error);
      res.status(500).json({ error: "Failed to fetch regulation" });
    }
  });

  app.post("/api/regulations", async (req, res) => {
    const data = insertRegulationSchema.parse(req.body);
    const regulation = await storage.createRegulation(data);
    res.json(regulation);
  });

  // Add new route for toggling regulation applicability
  app.patch("/api/regulations/:id/toggle-applicability", async (req, res) => {
    try {
      // Check if user is admin
      if (req.user?.role !== "admin") {
        return res.status(403).json({ error: "Only administrators can modify regulation applicability" });
      }

      const regulationId = parseInt(req.params.id);
      if (isNaN(regulationId)) {
        return res.status(400).json({ error: "Invalid regulation ID" });
      }

      // Validate request body
      const data = toggleApplicabilitySchema.parse(req.body);

      const regulation = await storage.setRegulationApplicability(regulationId, data.isApplicable);
      if (!regulation) {
        return res.status(404).json({ error: "Regulation not found" });
      }

      res.json(regulation);
    } catch (error) {
      console.error("Failed to toggle regulation applicability:", error);
      res.status(500).json({ error: "Failed to toggle regulation applicability" });
    }
  });

  // Deadlines endpoints
  app.get("/api/deadlines", async (req, res) => {
    try {
      const deadlines = await storage.getDeadlines();
      res.json(deadlines);
    } catch (error) {
      console.error("Failed to fetch deadlines:", error);
      res.status(500).json({ error: "Failed to fetch deadlines" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}