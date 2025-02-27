import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertRegulationSchema, insertCommentSchema, insertUserSchema } from "@shared/schema";
import { z } from "zod";
import { RegulationValidator } from "./validation";

// Define a schema for the toggle request
const toggleApplicabilitySchema = z.object({
  isApplicable: z.boolean()
});

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // User Management Routes
  app.get("/api/admin/users", async (req, res) => {
    try {
      // Check if user is admin
      if (req.user?.role !== "admin") {
        return res.status(403).json({ error: "Only administrators can access user management" });
      }

      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Failed to fetch users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.post("/api/admin/users", async (req, res) => {
    try {
      // Check if user is admin
      if (req.user?.role !== "admin") {
        return res.status(403).json({ error: "Only administrators can create users" });
      }

      const data = insertUserSchema.parse(req.body);
      const user = await storage.createUser(data);
      res.status(201).json(user);
    } catch (error) {
      console.error("Failed to create user:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.patch("/api/admin/users/:id", async (req, res) => {
    try {
      // Check if user is admin
      if (req.user?.role !== "admin") {
        return res.status(403).json({ error: "Only administrators can update users" });
      }

      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }

      const data = insertUserSchema.partial().parse(req.body);
      const user = await storage.updateUser(userId, data);
      res.json(user);
    } catch (error) {
      console.error("Failed to update user:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.delete("/api/admin/users/:id", async (req, res) => {
    try {
      // Check if user is admin
      if (req.user?.role !== "admin") {
        return res.status(403).json({ error: "Only administrators can delete users" });
      }

      const userId = parseInt(req.params.id);
      if (isNaN(userId)) {
        return res.status(400).json({ error: "Invalid user ID" });
      }

      await storage.deleteUser(userId);
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete user:", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // Update regulations endpoint to support jurisdiction filter
  app.get("/api/regulations", async (req, res) => {
    try {
      const jurisdiction = req.query.jurisdiction as string | undefined;
      let regulations;

      if (jurisdiction && (jurisdiction === 'federal' || jurisdiction === 'state')) {
        regulations = await storage.getRegulationsByJurisdiction(jurisdiction);
      } else {
        regulations = await storage.getRegulations();
      }

      res.json(regulations);
    } catch (error) {
      console.error("Failed to fetch regulations:", error);
      res.status(500).json({ error: "Failed to fetch regulations" });
    }
  });

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

  // Comments endpoints
  app.get("/api/comments/:regulationId", async (req, res) => {
    try {
      const regulationId = parseInt(req.params.regulationId);
      if (isNaN(regulationId)) {
        return res.status(400).json({ error: "Invalid regulation ID" });
      }

      const comments = await storage.getCommentsByRegulation(regulationId);
      res.json(comments);
    } catch (error) {
      console.error("Failed to fetch comments:", error);
      res.status(500).json({ error: "Failed to fetch comments" });
    }
  });

  app.post("/api/comments", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Must be logged in to comment" });
      }

      const data = insertCommentSchema.parse({
        ...req.body,
        userId: req.user.id,
      });

      const comment = await storage.createComment(data);
      res.status(201).json(comment);
    } catch (error) {
      console.error("Failed to create comment:", error);
      res.status(500).json({ error: "Failed to create comment" });
    }
  });

  app.delete("/api/comments/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Must be logged in to delete comments" });
      }

      const commentId = parseInt(req.params.id);
      if (isNaN(commentId)) {
        return res.status(400).json({ error: "Invalid comment ID" });
      }

      const comment = await storage.getComment(commentId);
      if (!comment) {
        return res.status(404).json({ error: "Comment not found" });
      }

      // Only allow admins or the comment author to delete
      if (req.user.role !== "admin" && comment.userId !== req.user.id) {
        return res.status(403).json({ error: "Not authorized to delete this comment" });
      }

      await storage.deleteComment(commentId);
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete comment:", error);
      res.status(500).json({ error: "Failed to delete comment" });
    }
  });

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

  // Enhanced deadlines endpoint with error handling and sorting
  app.get("/api/deadlines", async (req, res) => {
    try {
      console.log("Fetching deadlines...");
      const deadlines = await storage.getDeadlines();

      // Sort deadlines by due date
      const sortedDeadlines = deadlines.sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });

      console.log(`Found ${sortedDeadlines.length} deadlines`);
      res.json(sortedDeadlines);
    } catch (error) {
      console.error("Failed to fetch deadlines:", error);
      res.status(500).json({ error: "Failed to fetch deadlines" });
    }
  });

  app.post("/api/regulations/validate", async (req, res) => {
    try {
      // Check if user is authenticated
      if (!req.user) {
        return res.status(401).json({ error: "Must be logged in to validate regulations" });
      }

      console.log("Starting regulation validation...");
      const validator = new RegulationValidator();
      const regulations = await storage.getRegulations();

      let errors = [];
      let warnings = [];

      console.log(`Validating ${regulations.length} regulations...`);
      for (const regulation of regulations) {
        const validationResults = validator.validateRegulation(regulation);
        const validationErrors = validationResults.filter(result => result.severity === 'error');
        const validationWarnings = validationResults.filter(result => result.severity === 'warning');

        errors.push(...validationErrors.map(error => ({
          regulationId: regulation.id,
          regulationName: regulation.name,
          ...error
        })));

        warnings.push(...validationWarnings.map(warning => ({
          regulationId: regulation.id,
          regulationName: regulation.name,
          ...warning
        })));
      }

      console.log(`Validation complete. Found ${errors.length} errors and ${warnings.length} warnings`);
      res.json({
        totalRegulations: regulations.length,
        errors,
        warnings,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Validation failed:", error);
      res.status(500).json({ error: "Failed to validate regulations" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}