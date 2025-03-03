import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertRegulationSchema, insertUserSchema, insertNoteSchema } from "@shared/schema";
import { z } from "zod";
import { RegulationValidator } from "./validation";
import { Request } from "express";
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

// Update the getRedirectUri function to handle different environments properly
function getRedirectUri(req: Request): string {
  const host = req.get('host') || '';
  const protocol = req.protocol || 'https';
  // Remove trailing slash if present and ensure consistent format
  const baseUri = `${protocol}://${host}`;
  return `${baseUri}/api/auth/google/callback`;
}

// Update the getGoogleAuthClient function to handle missing credentials
function getGoogleAuthClient(req: Request): OAuth2Client {
  const redirectUri = getRedirectUri(req);

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    throw new Error("Missing OAuth2 credentials. Please configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET");
  }

  // Validate client ID format
  if (!process.env.GOOGLE_CLIENT_ID.endsWith('.apps.googleusercontent.com')) {
    throw new Error("Invalid Google Client ID format. It should end with .apps.googleusercontent.com");
  }

  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
}

// Define schemas
const toggleApplicabilitySchema = z.object({
  isApplicable: z.boolean()
});

// Extend express session
declare module 'express-session' {
  interface SessionData {
    googleTokens?: {
      access_token?: string;
      refresh_token?: string;
      scope?: string;
      token_type?: string;
      expiry_date?: number;
    };
  }
}

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

  // Update bug report endpoint with better error handling and logging
  app.post("/api/bug-report", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Must be logged in to submit bug reports" });
      }

      if (!req.session.googleTokens) {
        return res.status(401).json({
          error: "Google authentication required",
          needsAuth: true
        });
      }

      const { location, comments } = req.body;
      console.log("Bug report received:", { location, comments, user: req.user.username });

      // Validate required fields
      if (!comments) {
        return res.status(400).json({ error: "Comments are required" });
      }

      // Get the sheet ID from environment variables
      const sheetId = process.env.GOOGLE_SHEETS_SHEET_ID;

      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !sheetId) {
        console.error("Missing Google OAuth2 configuration.", {
          hasClientId: !!process.env.GOOGLE_CLIENT_ID,
          hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
          hasSheetId: !!sheetId,
          allEnvVars: Object.keys(process.env).join(", ")
        });
        return res.status(500).json({ error: "Bug report system is not configured" });
      }

      console.log("Setting up Google Sheets API client...");
      const auth = getGoogleAuthClient(req);
      auth.setCredentials(req.session.googleTokens);
      const sheets = google.sheets({ version: 'v4', auth });

      // Format the data for Google Sheets
      const timestamp = new Date().toISOString();
      const values = [[
        timestamp,
        req.user.username,
        location || 'Not specified',
        comments
      ]];

      console.log("Attempting to append data to Google Sheet...");
      console.log("Sheet ID:", sheetId);

      try {
        // First, check if we can access the spreadsheet
        const spreadsheet = await sheets.spreadsheets.get({
          spreadsheetId: sheetId,
          fields: 'sheets.properties.title'
        });

        console.log("Spreadsheet access check:", {
          status: spreadsheet.status,
          sheetTitles: spreadsheet.data.sheets?.map(s => s.properties?.title)
        });

        // Get the first sheet name
        const firstSheetName = spreadsheet.data.sheets?.[0]?.properties?.title || "Sheet1";
        console.log("Using sheet name:", firstSheetName);

        // Append the data
        const appendResponse = await sheets.spreadsheets.values.append({
          spreadsheetId: sheetId,
          range: `${firstSheetName}!A:D`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values
          }
        });

        console.log("Google Sheets API response:", {
          status: appendResponse.status,
          data: appendResponse.data
        });

        res.json({ message: "Bug report submitted successfully" });
      } catch (error: any) {
        console.error("Failed to process bug report:", error);

        if (error.response) {
          console.error("Google Sheets API error details:", {
            status: error.response.status,
            data: JSON.stringify(error.response.data),
            headers: error.response.headers
          });
        }

        // Return a user-friendly error message
        res.status(500).json({
          error: "Failed to submit bug report",
          details: error.message || "Unknown error"
        });
      }
    } catch (error) {
      console.error("Failed to submit bug report:", error);
      res.status(500).json({
        error: "Failed to submit bug report",
        details: "Unknown error"
      });
    }
  });

  // Add auth check endpoint
  app.get("/api/auth/check-google-auth", (req, res) => {
    try {
      if (!req.session.googleTokens) {
        return res.status(401).json({ needsAuth: true });
      }

      const auth = getGoogleAuthClient(req);
      auth.setCredentials(req.session.googleTokens);

      // Check token expiry
      const expiryDate = req.session.googleTokens.expiry_date;
      if (!expiryDate || Date.now() >= expiryDate) {
        return res.status(401).json({ needsAuth: true });
      }

      res.json({ needsAuth: false });
    } catch (error) {
      console.error("Auth check error:", error);
      res.status(500).json({ error: "Failed to check authentication status" });
    }
  });

  // Add auth routes for Google OAuth2
  app.get("/api/auth/google", (req, res) => {
    try {
      const auth = getGoogleAuthClient(req);
      const authUrl = auth.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/spreadsheets']
      });

      console.log("Google OAuth2 configuration:", {
        redirectUri: getRedirectUri(req),
        hasAuth: !!auth,
        authUrl: authUrl,
        clientIdFormat: process.env.GOOGLE_CLIENT_ID.endsWith('.apps.googleusercontent.com') ? 'valid' : 'invalid'
      });

      res.redirect(authUrl);
    } catch (error: any) {
      console.error("Failed to generate auth URL:", error);
      res.status(500).json({
        error: "Failed to initiate authentication",
        details: error.message
      });
    }
  });

  app.get("/api/auth/google/callback", async (req, res) => {
    try {
      const auth = getGoogleAuthClient(req);
      const { code } = req.query;

      if (typeof code !== 'string') {
        throw new Error('No auth code provided');
      }

      const { tokens } = await auth.getToken(code);
      auth.setCredentials(tokens);

      // Store tokens in session
      req.session.googleTokens = tokens;

      // Redirect back to the original page if available
      res.redirect('/');
    } catch (error) {
      console.error('OAuth callback error:', error);
      res.status(500).send('Authentication failed');
    }
  });

  // Add this route inside registerRoutes to help with setup
  app.get("/api/auth/redirect-uri", (req, res) => {
    const redirectUri = getRedirectUri(req);
    res.json({
      redirectUri,
      message: "Use this URI as your authorized redirect URI in Google Cloud Console"
    });
  });


  // Notes endpoints
  app.get("/api/notes/regulation/:regulationId", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Must be logged in to view notes" });
      }

      const regulationId = parseInt(req.params.regulationId);
      if (isNaN(regulationId)) {
        return res.status(400).json({ error: "Invalid regulation ID" });
      }

      const notes = await storage.getNotesByRegulation(regulationId);

      // Filter out private notes that don't belong to the current user
      const filteredNotes = notes.filter(note =>
        !note.isPrivate || note.userId === req.user!.id
      );

      res.json(filteredNotes);
    } catch (error) {
      console.error("Failed to fetch notes:", error);
      res.status(500).json({ error: "Failed to fetch notes" });
    }
  });

  app.post("/api/notes", async (req, res) => {
    try {
      console.log("Note creation request received:", req.body);
      console.log("User from session:", req.user);
      
      if (!req.user) {
        console.log("Note creation rejected: No authenticated user");
        return res.status(401).json({ error: "Must be logged in to create notes" });
      }

      try {
        const data = insertNoteSchema.parse({
          ...req.body,
          userId: req.user.id,
        });
        
        console.log("Validated note data:", data);
        
        const note = await storage.createNote(data);
        console.log("Note created successfully:", note);
        
        res.status(201).json(note);
      } catch (validationError) {
        console.error("Note validation failed:", validationError);
        return res.status(400).json({ 
          error: "Invalid note data", 
          details: validationError instanceof Error ? validationError.message : String(validationError)
        });
      }
    } catch (error) {
      console.error("Failed to create note:", error);
      res.status(500).json({ 
        error: "Failed to create note",
        details: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.patch("/api/notes/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Must be logged in to update notes" });
      }

      const noteId = parseInt(req.params.id);
      if (isNaN(noteId)) {
        return res.status(400).json({ error: "Invalid note ID" });
      }

      const existingNote = await storage.getNote(noteId);
      if (!existingNote) {
        return res.status(404).json({ error: "Note not found" });
      }

      // Only allow note owner or admin to update
      if (existingNote.userId !== req.user.id && req.user.role !== "admin") {
        return res.status(403).json({ error: "Not authorized to update this note" });
      }

      const data = insertNoteSchema.partial().parse(req.body);
      const note = await storage.updateNote(noteId, data);
      res.json(note);
    } catch (error) {
      console.error("Failed to update note:", error);
      res.status(500).json({ error: "Failed to update note" });
    }
  });

  app.delete("/api/notes/:id", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Must be logged in to delete notes" });
      }

      const noteId = parseInt(req.params.id);
      if (isNaN(noteId)) {
        return res.status(400).json({ error: "Invalid note ID" });
      }

      const note = await storage.getNote(noteId);
      if (!note) {
        return res.status(404).json({ error: "Note not found" });
      }

      // Only allow note owner or admin to delete
      if (note.userId !== req.user.id && req.user.role !== "admin") {
        return res.status(403).json({ error: "Not authorized to delete this note" });
      }

      await storage.deleteNote(noteId);
      res.status(204).send();
    } catch (error) {
      console.error("Failed to delete note:", error);
      res.status(500).json({ error: "Failed to delete note" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}