import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertRegulationSchema, insertNotificationSchema, insertDeadlineSchema } from "@shared/schema";

export function registerRoutes(app: Express): Server {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });

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

  const httpServer = createServer(app);
  return httpServer;
}