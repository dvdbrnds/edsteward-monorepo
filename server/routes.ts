import express, { type Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import passport from "passport";
import { z } from "zod";
import { Server } from 'http';
import { createServer } from 'http';
import { log } from './vite';
import { setupAuth } from './auth';
import { syslog, LogLevel, LogFacility } from './services/syslog';

export function registerRoutes(app: express.Application): Server {
  // Create HTTP server
  const httpServer = createServer(app);

  // Setup auth routes first
  setupAuth(app);

  // Test route to verify API handling
  app.get("/api/test", (req, res) => {
    res.json({ status: "ok", message: "API is working" });
  });

  // Add the missing /api/regulations route
  app.get("/api/regulations", async (req, res) => {
    try {
      if (!req.user) {
        syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, "Unauthorized access attempt to regulations");
        return res.status(401).json({ error: "Authentication required" });
      }

      try {
        syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Fetching regulations from storage");
        const regulations = await storage.getRegulations();
        syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Found ${regulations.length} regulations`);

        return res.json(regulations);
      } catch (dbError) {
        syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Database error fetching regulations", {
          error: dbError instanceof Error ? dbError.message : String(dbError)
        });
        return res.status(500).json({ 
          error: "Database error fetching regulations",
          details: dbError instanceof Error ? dbError.message : String(dbError)
        });
      }
    } catch (error) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Failed to fetch regulations", {
        error: error instanceof Error ? error.message : String(error)
      });
      return res.status(500).json({ 
        error: "Failed to fetch regulations", 
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // API routes
  app.get("/api/regulations/ids", async (req, res) => {
    try {
      if (!req.user) {
        syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, "Unauthorized access attempt to regulations");
        return res.status(401).json({ error: "Authentication required" });
      }

      try {
        syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Fetching regulations from storage");
        const regulations = await storage.getRegulations();
        syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Found ${regulations.length} regulations`);

        if (!regulations || regulations.length === 0) {
          syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, "No regulations found in database");
          return res.json({ 
            count: 0,
            ids: [],
            message: "No regulations found"
          });
        }

        const ids = regulations.map(reg => reg.itemId);
        return res.json({ 
          count: ids.length,
          ids
        });
      } catch (dbError) {
        syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Database error fetching regulations", {
          error: dbError instanceof Error ? dbError.message : String(dbError)
        });
        return res.status(500).json({ 
          error: "Database error fetching regulation IDs",
          details: dbError instanceof Error ? dbError.message : String(dbError)
        });
      }
    } catch (error) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Failed to fetch regulations", {
        error: error instanceof Error ? error.message : String(error)
      });
      return res.status(500).json({ 
        error: "Failed to fetch regulation IDs", 
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });
  
  // Add endpoint to fetch individual regulation by ID
  app.get("/api/deadlines", async (req, res) => {
    try {
      if (!req.user) {
        syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, "Unauthorized access attempt to deadlines");
        return res.status(401).json({ error: "Authentication required" });
      }

      try {
        syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Fetching deadlines from storage");
        const deadlines = await storage.getDeadlines();
        syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Found ${deadlines.length} deadlines`);
        return res.json(deadlines);
      } catch (dbError) {
        syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Database error fetching deadlines", {
          error: dbError instanceof Error ? dbError.message : String(dbError)
        });
        return res.status(500).json({ 
          error: "Database error fetching deadlines",
          details: dbError instanceof Error ? dbError.message : String(dbError)
        });
      }
    } catch (error) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Failed to fetch deadlines", {
        error: error instanceof Error ? error.message : String(error)
      });
      return res.status(500).json({ 
        error: "Failed to fetch deadlines", 
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Add endpoint to create a new deadline
  app.post("/api/deadlines", async (req, res) => {
    try {
      if (!req.user) {
        syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, "Unauthorized deadline creation attempt");
        return res.status(401).json({ error: "Authentication required" });
      }

      const { regulationId, dueDate, status, assignedTo } = req.body;

      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Creating new deadline", {
        regulationId,
        dueDate,
        status,
        assignedTo: assignedTo || 1
      });

      if (!regulationId || !dueDate || !status) {
        syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, "Invalid deadline data received", { body: req.body });
        return res.status(400).json({ error: "Missing required fields" });
      }

      try {
        const deadline = await storage.createDeadline({
          regulationId,
          dueDate,
          status,
          assignedTo: assignedTo || 1
        });

        syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Successfully created deadline", { deadlineId: deadline.id });
        return res.json(deadline);
      } catch (dbError) {
        syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Database error creating deadline", {
          error: dbError instanceof Error ? dbError.message : String(dbError)
        });
        return res.status(500).json({ 
          error: "Database error creating deadline",
          details: dbError instanceof Error ? dbError.message : String(dbError)
        });
      }
    } catch (error) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Failed to create deadline", {
        error: error instanceof Error ? error.message : String(error)
      });
      return res.status(500).json({ 
        error: "Failed to create deadline", 
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.get("/api/regulations/:regulationId", async (req, res) => {
    try {
      if (!req.user) {
        syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, "Unauthorized access attempt to regulation details");
        return res.status(401).json({ error: "Authentication required" });
      }

      const { regulationId } = req.params;
      
      if (!regulationId) {
        return res.status(400).json({ error: "Regulation ID is required" });
      }

      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Fetching regulation with ID: ${regulationId}`);
      
      try {
        const regulation = await storage.getRegulationById(regulationId);
        
        if (!regulation) {
          syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, `Regulation not found with ID: ${regulationId}`);
          return res.status(404).json({ error: "Regulation not found" });
        }
        
        syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Found regulation: ${regulation.name || regulation.topic}`);
        return res.json(regulation);
      } catch (dbError) {
        syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Database error fetching regulation", {
          regulationId,
          error: dbError instanceof Error ? dbError.message : String(dbError)
        });
        return res.status(500).json({ 
          error: "Database error fetching regulation",
          details: dbError instanceof Error ? dbError.message : String(dbError)
        });
      }
    } catch (error) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Failed to fetch regulation", {
        error: error instanceof Error ? error.message : String(error)
      });
      return res.status(500).json({ 
        error: "Failed to fetch regulation", 
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // System endpoint for OpenAI API check
  app.get("/api/system/check-openai", async (req, res) => {
    try {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, "OpenAI API key not configured");
        return res.status(500).json({
          status: "error",
          message: "OpenAI API key not configured",
          details: "API key is missing in environment variables"
        });
      }

      // Simple test call to OpenAI API
      const response = await fetch("https://api.openai.com/v1/models", {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      if (response.ok) {
        syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "OpenAI API connection successful");
        return res.status(200).json({
          status: "ok",
          message: "OpenAI API connection successful",
          details: "API key is valid and working properly"
        });
      } else {
        const errorData = await response.json();
        syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "OpenAI API connection failed", {
          error: errorData.error?.message
        });
        return res.status(response.status).json({
          status: "error",
          message: "OpenAI API connection failed",
          details: errorData.error?.message || "Unknown API error"
        });
      }
    } catch (error) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "OpenAI API check error", {
        error: error instanceof Error ? error.message : String(error)
      });
      return res.status(500).json({
        status: "error",
        message: "Failed to check OpenAI API",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Global error handler for API routes
  app.use('/api', (err: Error, req: Request, res: Response, next: NextFunction) => {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 'API Error', {
      error: err.message,
      stack: err.stack
    });
    res.status(500).json({
      error: 'Internal Server Error',
      message: err.message || 'An unexpected error occurred'
    });
  });

  // Add endpoint to update regulation category
  app.patch("/api/regulations/:regulationId/category", async (req, res) => {
    try {
      if (!req.user) {
        syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, "Unauthorized regulation update attempt");
        return res.status(401).json({ error: "Authentication required" });
      }

      const { regulationId } = req.params;
      const { category } = req.body;

      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Updating category for regulation ${regulationId}`, {
        newCategory: category
      });

      if (!category) {
        syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, "Invalid category update data received", { body: req.body });
        return res.status(400).json({ error: "Category is required" });
      }

      try {
        const regulation = await storage.updateRegulation(parseInt(regulationId), { category });

        syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Successfully updated regulation category", { 
          regulationId,
          newCategory: category 
        });

        return res.json(regulation);
      } catch (dbError) {
        syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Database error updating regulation category", {
          error: dbError instanceof Error ? dbError.message : String(dbError)
        });
        return res.status(500).json({ 
          error: "Database error updating regulation category",
          details: dbError instanceof Error ? dbError.message : String(dbError)
        });
      }
    } catch (error) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Failed to update regulation category", {
        error: error instanceof Error ? error.message : String(error)
      });
      return res.status(500).json({ 
        error: "Failed to update regulation category", 
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  return httpServer;
}