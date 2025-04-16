import express, { type Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import passport from "passport";
import { z } from "zod";
import { Server } from 'http';
import { createServer } from 'http';
import { log } from './vite';
import { setupAuth } from './auth';
import { syslog, LogLevel, LogFacility } from './services/syslog';
import { hashPassword } from './auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { notes, insertNoteSchema, type InsertRegulation } from "@shared/schema";

// ES Module compatibility: Get current file path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure multer storage
const uploadDir = path.join(process.cwd(), 'uploads');

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const multerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: multerStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png'
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});


export function registerRoutes(app: express.Application): Server {
  // Create HTTP server
  const httpServer = createServer(app);

  // Custom file download route with proper content-type handling
  app.get('/api/uploads/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(uploadDir, filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Get file extension to determine content-type
    const ext = path.extname(filename).toLowerCase();
    
    // Set appropriate content-type based on file extension
    if (ext === '.pdf') {
      res.setHeader('Content-Type', 'application/pdf');
    } else if (ext === '.doc') {
      res.setHeader('Content-Type', 'application/msword');
    } else if (ext === '.docx') {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    } else if (ext === '.jpg' || ext === '.jpeg') {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (ext === '.png') {
      res.setHeader('Content-Type', 'image/png');
    }
    
    // Set content disposition header for download
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Stream file to response
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  });

  // Serve static files from public directory for downloads
  app.use('/downloads', express.static(path.join(process.cwd(), 'public/downloads')));

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

  // Add endpoint to update notification override settings
  app.patch("/api/regulations/:regulationId/notification-override", async (req, res) => {
    try {
      if (!req.user) {
        syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, "Unauthorized notification override update attempt");
        return res.status(401).json({ error: "Authentication required" });
      }
      
      // Check for admin role
      if (req.user.role.toLowerCase() !== "admin") {
        syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, "Non-admin attempted to update notification overrides", {
          userId: req.user.id,
          username: req.user.username
        });
        return res.status(403).json({ error: "Admin permission required" });
      }

      const { regulationId } = req.params;
      const { email, phone, notificationSchedule } = req.body;

      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Updating notification override for regulation ${regulationId}`);

      try {
        // Create update object with notification override settings
        const updateData: Partial<InsertRegulation> = {
          notificationOverride: { email, phone },
          notificationSchedule
        };

        const regulation = await storage.updateRegulation(parseInt(regulationId), updateData);

        syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Successfully updated notification override settings", { 
          regulationId,
          email: email || "(not set)",
          hasSchedule: !!notificationSchedule
        });

        return res.json(regulation);
      } catch (dbError) {
        syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Database error updating notification override", {
          error: dbError instanceof Error ? dbError.message : String(dbError)
        });
        return res.status(500).json({ 
          error: "Database error updating notification override",
          details: dbError instanceof Error ? dbError.message : String(dbError)
        });
      }
    } catch (error) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Error updating notification override", {
        error: error instanceof Error ? error.message : String(error)
      });
      return res.status(500).json({ 
        error: "Error updating notification override",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Add endpoint to fetch individual regulation by ID
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


  // Update the evidence files endpoints with better error handling
  app.get("/api/regulations/:regulationId/evidence", async (req, res) => {
    try {
      if (!req.user) {
        syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, "Unauthorized evidence files access attempt");
        return res.status(401).json({ error: "Authentication required" });
      }

      const { regulationId } = req.params;

      if (!regulationId || isNaN(parseInt(regulationId))) {
        return res.status(400).json({ error: "Invalid regulation ID" });
      }

      try {
        const files = await storage.getEvidenceFilesByRegulation(parseInt(regulationId));

        syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
          `Successfully fetched ${files.length} evidence files for regulation ${regulationId}`);

        return res.json(files);
      } catch (dbError) {
        syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Database error fetching evidence files", {
          error: dbError instanceof Error ? dbError.message : String(dbError)
        });

        return res.status(500).json({
          error: "Database error fetching evidence files",
          details: dbError instanceof Error ? dbError.message : String(dbError)
        });
      }
    } catch (error) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Error fetching evidence files", {
        error: error instanceof Error ? error.message : String(error)
      });

      return res.status(500).json({
        error: "Failed to fetch evidence files",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Update the evidence upload endpoint with better error handling
  app.post("/api/regulations/:regulationId/evidence", upload.single('file'), async (req, res) => {
    try {
      if (!req.user) {
        syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, "Unauthorized evidence upload attempt");
        return res.status(401).json({ error: "Authentication required" });
      }

      const { regulationId } = req.params;

      if (!regulationId || isNaN(parseInt(regulationId))) {
        return res.status(400).json({ error: "Invalid regulation ID" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const file = req.file;
      const description = req.body.description || '';

      try {
        const evidenceFile = await storage.createEvidenceFile({
          regulationId: parseInt(regulationId),
          fileName: file.originalname,
          fileSize: file.size,
          fileType: file.mimetype,
          description,
          uploadedBy: req.user.id,
          status: "pending",
          storagePath: file.path
        });

        syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
          `Successfully uploaded evidence file for regulation ${regulationId}`);

        return res.json({
          message: "File uploaded successfully",
          file: evidenceFile
        });

      } catch (dbError) {
        syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Database error saving evidence file", {
          error: dbError instanceof Error ? dbError.message : String(dbError)
        });

        return res.status(500).json({
          error: "Database error saving evidence file",
          details: dbError instanceof Error ? dbError.message : String(dbError)
        });
      }

    } catch (error) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Error uploading evidence file", {
        error: error instanceof Error ? error.message : String(error)
      });

      return res.status(500).json({
        error: "Failed to upload evidence file",
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

  // Add notes endpoints
  app.post("/api/notes", async (req, res) => {
    try {
      if (!req.user) {
        syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, "Unauthorized note creation attempt");
        return res.status(401).json({ error: "Authentication required" });
      }

      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Creating new note", { body: req.body });

      // Validate request body
      const validatedData = insertNoteSchema.parse({
        ...req.body,
        userId: req.user.id
      });

      const note = await storage.createNote(validatedData);

      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Note created successfully", { noteId: note.id });
      return res.json(note);
    } catch (error) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Failed to create note", {
        error: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: "Invalid note data",
          details: error.errors
        });
      }

      return res.status(500).json({
        error: "Failed to create note",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.get("/api/notes/regulation/:regulationId", async (req, res) => {
    try {
      if (!req.user) {
        syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, "Unauthorized note access attempt");
        return res.status(401).json({ error: "Authentication required" });
      }

      const { regulationId } = req.params;

      if (!regulationId || isNaN(parseInt(regulationId))) {
        return res.status(400).json({ error: "Invalid regulation ID" });
      }

      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Fetching notes for regulation ${regulationId}`);

      const notes = await storage.getNotesByRegulation(parseInt(regulationId));

      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Found ${notes.length} notes for regulation ${regulationId}`);
      return res.json(notes);
    } catch (error) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Failed to fetch notes", {
        error: error instanceof Error ? error.message : String(error)
      });
      return res.status(500).json({
        error: "Failed to fetch notes",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.patch("/api/notes/:noteId", async (req, res) => {
    try {
      if (!req.user) {
        syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, "Unauthorized note update attempt");
        return res.status(401).json({ error: "Authentication required" });
      }

      const { noteId } = req.params;

      if (!noteId || isNaN(parseInt(noteId))) {
        return res.status(400).json({ error: "Invalid note ID" });
      }

      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Updating note ${noteId}`, { body: req.body });

      // Validate the update data
      const validatedData = insertNoteSchema.partial().parse(req.body);

      const note = await storage.updateNote(parseInt(noteId), validatedData);

      if (!note) {
        return res.status(404).json({ error: "Note not found" });
      }

      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Successfully updated note ${noteId}`);
      return res.json(note);
    } catch (error) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Failed to update note", {
        error: error instanceof Error ? error.message : String(error)
      });

      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: "Invalid note data",
          details: error.errors
        });
      }

      return res.status(500).json({
        error: "Failed to update note",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  app.delete("/api/notes/:noteId", async (req, res) => {
    try {
      if (!req.user) {
        syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, "Unauthorized note deletion attempt");
        return res.status(401).json({ error: "Authentication required" });
      }

      const { noteId } = req.params;

      if (!noteId || isNaN(parseInt(noteId))) {
        return res.status(400).json({ error: "Invalid note ID" });
      }

      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Deleting note ${noteId}`);

      await storage.deleteNote(parseInt(noteId));

      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Successfully deleted note ${noteId}`);
      return res.json({ success: true, message: "Note deleted successfully" });
    } catch (error) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Failed to delete note", {
        error: error instanceof Error ? error.message : String(error)
      });
      return res.status(500).json({
        error: "Failed to delete note",
        message: error instanceof Error ? error.message : String(error)
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

  // Add this endpoint after the category update endpoint
  app.patch("/api/regulations/:regulationId/actions/:actionType", async (req, res) => {
    try {
      if (!req.user) {
        syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, "Unauthorized action update attempt");
        return res.status(401).json({ error: "Authentication required" });
      }

      const { regulationId, actionType } = req.params;
      const actionUpdate = req.body;

      // Only admins can change 'required' status
      if ('required' in actionUpdate && req.user.role.toLowerCase() !== 'admin') {
        syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, "Non-admin attempted to update required status");
        return res.status(403).json({ error: "Admin access required to change required status" });
      }

      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Updating action for regulation ${regulationId}`, {
        actionType,
        update: actionUpdate
      });

      try {
        const regulation = await storage.getRegulationById(parseInt(regulationId));

        if (!regulation) {
          syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, `Regulation not found with ID: ${regulationId}`);
          return res.status(404).json({ error: "Regulation not found" });
        }

        if (!regulation.actions) {
          regulation.actions = [];
        }

        const actionIndex = regulation.actions.findIndex(a => a.type === actionType);
        if (actionIndex === -1) {
          regulation.actions.push(actionUpdate);
        } else {
          regulation.actions[actionIndex] = {
            ...regulation.actions[actionIndex],
            ...actionUpdate
          };
        }

        const updatedRegulation = await storage.updateRegulation(parseInt(regulationId), {
          actions: regulation.actions
        });

        syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Successfully updated regulation action", {
          regulationId,
          actionType
        });

        return res.json(updatedRegulation);
      } catch (dbError) {
        syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Database error updating regulation action", {
          error: dbError instanceof Error ? dbError.message : String(dbError)
        });
        return res.status(500).json({
          error: "Database error updating regulation action",
          details: dbError instanceof Error ? dbError.message : String(dbError)
        });
      }
    } catch (error) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Failed to update regulation action", {
        error: error instanceof Error ? error.message : String(error)
      });
      return res.status(500).json({
        error: "Failed to update regulation action",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Add the admin users endpoint
  app.get("/api/admin/users", async (req, res) => {
    try {
      if (!req.user) {
        syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, "Unauthorized access attempt to user management");
        return res.status(401).json({ error: "Authentication required" });
      }

      if (req.user.role.toLowerCase() !== 'admin') {
        syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, "Non-admin user attempted to access user management");
        return res.status(403).json({ error: "Admin access required" });
      }

      try {
        syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Fetching all users");
        const users = await storage.getAllUsers();
        syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Found ${users.length} users`);
        return res.json(users);
      } catch (dbError) {
        syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Database error fetching users", {
          error: dbError instanceof Error ? dbError.message : String(dbError)
        });
        return res.status(500).json({ 
          error: "Database error fetching users",
          details: dbError instanceof Error ? dbError.message : String(dbError)
        });
      }
    } catch (error) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Failed to fetch users", {
        error: error instanceof Error ? error.message : String(error)
      });
      return res.status(500).json({ 
        error: "Failed to fetch users", 
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Add the roadmap endpoint after the admin users endpoint
  app.get("/api/roadmap", async (req, res) => {
    try {
      if (!req.user) {
        syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, "Unauthorized access attempt to roadmap");
        return res.status(401).json({ error: "Authentication required" });
      }

      if (req.user.role.toLowerCase() !== 'admin') {
        syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, "Non-admin user attempted to access roadmap");
        return res.status(403).json({ error: "Admin access required" });
      }

      const roadmapPath = path.resolve(__dirname, '..', 'ROADMAP.md');

      try {
        const content = await fs.promises.readFile(roadmapPath, 'utf-8');
        syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Successfully served roadmap content");
        return res.send(content);
      } catch (fsError) {
        syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Error reading roadmap file", {
          error: fsError instanceof Error ? fsError.message : String(fsError)
        });
        return res.status(500).json({ 
          error: "Error reading roadmap content",
          details: fsError instanceof Error ? fsError.message : String(fsError)
        });
      }
    } catch (error) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Failed to serve roadmap", {
        error: error instanceof Error ? error.message : String(error)
      });
      return res.status(500).json({ 
        error: "Failed to serve roadmap", 
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Add endpoint to update user
  app.post("/api/admin/update-user", async (req, res) => {
    try {
      if (!req.user) {
        syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, "Unauthorized access attempt to user update");
        return res.status(401).json({ error: "Authentication required" });
      }

      if (req.user.role.toLowerCase() !== 'admin') {
        syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, "Non-admin user attempted to update user");
        return res.status(403).json({ error: "Admin access required" });
      }

      const { id, role, department } = req.body;

      if (!id || !role) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      try {
        const updatedUser = await storage.updateUser(id, { 
          role: role.toLowerCase(), 
          department 
        });
        syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Successfully updated user ${id}`);
        return res.json(updatedUser);
      } catch (dbError) {
        syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Database error updating user", {
          error: dbError instanceof Error ? dbError.message : String(dbError)
        });
        return res.status(500).json({ 
          error: "Database error updating user",
          details: dbError instanceof Error ? dbError.message : String(dbError)
        });
      }
    } catch (error) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Failed to update user", {
        error: error instanceof Error ? error.message : String(error)
      });
      return res.status(500).json({ 
        error: "Failed to update user", 
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Add the reset password endpoint
  app.post("/api/admin/reset-password", async (req, res) => {
    try {
      if (!req.user) {
        syslog.log(LogFacility.LOCAL0,LogLevel.WARNING, "Unauthorized access attempt to password reset");
        return res.status(401).json({ error: "Authentication required" });
      }

      if (req.user.role.toLowerCase() !== 'admin') {
        syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, "Non-admin user attempted to reset password");
        return res.status(403).json({ error: "Admin access required" });
      }

      const { id } = req.body;

      if (!id) {
        return res.status(400).json({ error: "User ID is required"});
      }

      try {
        // Generate a temporary password
        const tempPassword = Math.random().toString(36).slice(-8);
        const hashedPassword = await hashPassword(tempPassword);

        const updatedUser = await storage.updateUser(id, { password: hashedPassword });
        syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Successfully reset password for user ${id}`);

        return res.json({ 
          success: true, 
          temporaryPassword: tempPassword,
          message: "Password has been reset" 
        });
      } catch (dbError) {
        syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Database error resetting password", {
          error: dbError instanceof Error ? dbError.message : String(dbError)
        });
        return res.status(500).json({ 
          error: "Database error resetting password",
          details: dbError instanceof Error ? dbError.message : String(dbError)
        });
      }
    } catch (error) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Failed to reset password", {
        error: error instanceof Error ? error.message : String(error)
      });
      return res.status(500).json({ 
        error: "Failed to reset password", 
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });


  return httpServer;
}