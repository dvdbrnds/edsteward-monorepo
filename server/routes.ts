import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertRegulationSchema, insertNotificationSchema, insertDeadlineSchema } from "@shared/schema";
import { importRegulations } from "./import-data";

export function registerRoutes(app: Express): Server {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });

  setupAuth(app);

  // Import initial data if needed
  importRegulations().catch(console.error);

  // Regulations endpoints
  app.get("/api/regulations", async (req, res) => {
    try {
      const regulations = await storage.getRegulations();
      res.json(regulations);
    } catch (error) {
      console.error("Error fetching regulations:", error);
      res.status(500).json({ error: "Failed to fetch regulations" });
    }
  });

  app.get("/api/regulations/:id", async (req, res) => {
    try {
      const regulationId = parseInt(req.params.id, 10);
      const regulations = await storage.getRegulations();
      const regulation = regulations.find(r => r.id === regulationId);

      if (!regulation) {
        return res.status(404).json({ error: "Regulation not found" });
      }

      res.json(regulation);
    } catch (error) {
      console.error("Error fetching regulation:", error);
      res.status(500).json({ error: "Failed to fetch regulation" });
    }
  });

  app.post("/api/regulations", async (req, res) => {
    const data = insertRegulationSchema.parse(req.body);
    const regulation = await storage.createRegulation(data);
    res.json(regulation);
  });

  // Notifications endpoints
  app.get("/api/notifications", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    try {
      const notifications = await storage.getNotificationsByUser(req.user.id);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.post("/api/notifications", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    try {
      const data = insertNotificationSchema.parse(req.body);
      const notification = await storage.createNotification(data);
      res.json(notification);
    } catch (error) {
      console.error("Error creating notification:", error);
      res.status(500).json({ error: "Failed to create notification" });
    }
  });

  // Deadlines endpoints
  app.get("/api/deadlines", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    try {
      const deadlines = await storage.getDeadlines();
      res.json(deadlines);
    } catch (error) {
      console.error("Error fetching deadlines:", error);
      res.status(500).json({ error: "Failed to fetch deadlines" });
    }
  });

  app.post("/api/deadlines", async (req, res) => {
    if (!req.user) return res.sendStatus(401);
    try {
      const data = insertDeadlineSchema.parse(req.body);
      const deadline = await storage.createDeadline(data);
      res.json(deadline);
    } catch (error) {
      console.error("Error creating deadline:", error);
      res.status(500).json({ error: "Failed to create deadline" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}