import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertRegulationSchema, insertUserSchema, insertNoteSchema } from "@shared/schema";
import { z } from "zod";
import { RegulationValidator } from "./validation";
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import path from 'path';
import fs from 'fs';
import { desc, eq, like, or, sql, and, gte, lte } from "drizzle-orm";
import { db } from "./db";
import { systemLogs, users } from "@shared/schema";
import { syslog, LogLevel, LogFacility } from './services/syslog';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

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
    userId?: number;
    role?: string;
    username?: string;
  }
}

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // Add this error handler middleware to catch syslog errors
  app.use(async (err: Error, req: Request, res: Response, next: Function) => {
    await syslog.error("Unhandled error", { 
      error: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method
    });
    next(err);
  });

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

      // Log the applicability change
      await syslog.info(
        `User ${req.user.username} changed applicability of regulation ${regulation.itemId} (${regulation.name}) to ${data.isApplicable ? 'applicable' : 'not applicable'}`,
        {
          username: req.user.username,
          userId: req.user.id,
          regulationId: regulation.id,
          regulationName: regulation.name,
          regulationItemId: regulation.itemId,
          newValue: data.isApplicable,
          context: 'COMPLIANCE_CHANGE',
          type: 'applicability_update',
          timestamp: new Date().toISOString()
        }
      );

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

  // Debug endpoints
  app.get("/api/debug/note-schemas", (req, res) => {
    try {
      // Import the debug logger
      const { DebugLogger } = require('./services/debug-logger');
      DebugLogger.log('DEBUG_API', 'Checking note schema information');

      // This endpoint helps us debug schema issues
      let schemaStructure;
      try {
        schemaStructure = Object.keys(insertNoteSchema._def?.shape() || {});
      } catch (e) {
        schemaStructure = `Error getting schema structure: ${e.message}`;
      }

      // Recreate a schema for testing
      const testSchema = z.object({
        regulationId: z.number().positive(),
        userId: z.number().positive(),
        title: z.string().min(1),
        content: z.string().min(1),
        isPrivate: z.boolean().optional()
      });

      const testData = {
        regulationId: 3869,
        userId: 1,
        title: "Test Note",
        content: "Test Content"
      };

      const schemaInfo = {
        originalSchemaType: typeof insertNoteSchema,
        originalSchemaShape: schemaStructure,
        testSchemaResult: testSchema.safeParse(testData),
        originalSchemaTest: insertNoteSchema.safeParse(testData),
        reconstructedSchema: {
          description: "Testing if we can create a new schema from scratch",
          result: z.object({
            regulationId: z.number().positive(),
            userId: z.number(),
            title: z.string().min(1),
            content: z.string().min(1)
          }).safeParse(testData)
        }
      };

      DebugLogger.log('DEBUG_API', 'Schema information generated', schemaInfo);
      res.json(schemaInfo);
    } catch (error) {
      console.error("Debug schema error:", error);
      res.status(500).json({
        error: "Failed to get schema info",
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
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
      // and enrich notes with user information
      const filteredNotes = await Promise.all(
        notes
          .filter(note => !note.isPrivate || note.userId === req.user!.id)
          .map(async (note) => {
            const noteUser = await storage.getUser(note.userId);
            return {
              ...note,
              user: noteUser ? {
                username: noteUser.username,
                firstName: noteUser.firstName,
                lastName: noteUser.lastName
              } : undefined
            };
          })
      );

      res.json(filteredNotes);
    } catch (error) {
      console.error("Failed to fetch notes:", error);
      res.status(500).json({ error: "Failed to fetch notes" });
    }
  });

  app.post("/api/notes", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Must be logged in to create notes" });
      }

      const data = insertNoteSchema.parse({
        ...req.body,
        userId: req.user.id,
      });

      const note = await storage.createNote(data);

      // Include user information in the response
      const noteWithUser = {
        ...note,
        user: {
          username: req.user.username,
          firstName: req.user.firstName,
          lastName: req.user.lastName
        }
      };

      res.status(201).json(noteWithUser);
    } catch (error) {
      console.error("Failed to create note:", error);
      res.status(500).json({ error: "Failed to create note" });
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

  // Update auth routes with better logging
  app.post("/api/auth/login", async (req, res) => {
    const { username, password } = req.body;
    const { DebugLogger } = require('./services/debug-logger');

    try {
      DebugLogger.logRequest(req, 'AUTH_LOGIN');

      // Debug log for request information
      const requestInfo = {
        ip: req.get('x-forwarded-for') || req.ip,
        userAgent: req.get('user-agent'),
        hostname: req.hostname,
        protocol: req.protocol
      };

      console.log('[AUTH] Login attempt starting:', { username, ...requestInfo });

      if (!username || !password) {
        await syslog.warning("Login attempt with missing credentials", { 
          username,
          ...requestInfo,
          context: 'AUTH_LOGIN',
          type: 'login_attempt'
        });
        await DebugLogger.logAuthAttempt('AUTH_LOGIN', false, username || 'unknown', { 
          reason: 'missing_credentials',
          ...requestInfo
        });
        return res.status(400).json({ error: "Username and password are required" });
      }

      const user = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .then((res) => res[0]);

      if (!user) {
        console.log('[AUTH] User not found:', username);
        await syslog.warning("Failed login attempt - user not found", { 
          username,
          ...requestInfo,
          context: 'AUTH_LOGIN',
          type: 'login_failure'
        });
        await DebugLogger.logAuthAttempt('AUTH_LOGIN', false, username, { 
          reason: 'user_not_found',
          ...requestInfo
        });
        return res.status(400).json({ error: "Invalid username or password" });
      }

      const passwordMatch = await bcrypt.compare(password, user.password);

      if (!passwordMatch) {
        console.log('[AUTH] Invalid password for user:', username);
        await syslog.warning("Failed login attempt - incorrect password", { 
          username,
          ...requestInfo,
          context: 'AUTH_LOGIN',
          type: 'login_failure'
        });
        await DebugLogger.logAuthAttempt('AUTH_LOGIN', false, username, { 
          reason: 'invalid_password',
          ...requestInfo
        });
        return res.status(400).json({ error: "Invalid username or password" });
      }

      // Log session data before setting
      console.log('[AUTH] Setting session data:', {
        userId: user.id,
        role: user.role,
        username: user.username,
        ...requestInfo
      });

      req.session.userId = user.id;
      req.session.role = user.role;
      req.session.username = user.username;

      // Create structured data for successful login
      const authData = {
        username: user.username,
        userId: user.id,
        role: user.role,
        ...requestInfo,
        context: 'AUTH_LOGIN',
        type: 'login_success',
        timestamp: new Date().toISOString()
      };

      await syslog.logAuthEvent(LogLevel.INFO, `User ${user.username} logged in successfully`, user.id, user.username, authData);
      await DebugLogger.logAuthAttempt('AUTH_LOGIN', true, username, authData);

      console.log('[AUTH] Login successful for user:', username);

      return res.status(200).json({ 
        message: "Login successful", 
        user: { 
          id: user.id, 
          username: user.username, 
          role: user.role 
        } 
      });
    } catch (error) {
      console.error("Login error:", error);
      await syslog.error("Login system error", { 
        error: error instanceof Error ? error.message : String(error),
        ...requestInfo
      });
      await DebugLogger.logError('AUTH_LOGIN', error);
      return res.status(500).json({ error: "Internal server error" });
    }
  });

  // Add logging to logout route
  app.post("/api/auth/logout", async (req, res) => {
    const { DebugLogger } = require('./services/debug-logger');

    try {
      DebugLogger.logRequest(req, 'AUTH_LOGOUT');
      console.log('[AUTH] Logout attempt starting');

      const requestInfo = {
        ip: req.get('x-forwarded-for') || req.ip,
        userAgent: req.get('user-agent'),
        hostname: req.hostname
      };

      if (req.session.userId) {
        const userId = req.session.userId;
        const username = req.session.username;

        console.log('[AUTH] Logging out user:', { userId, username, ...requestInfo });

        await syslog.logAuthEvent(LogLevel.INFO, "User logged out", userId, username, requestInfo);
        await DebugLogger.logAuthAttempt('AUTH_LOGOUT', true, username || 'unknown', { 
          userId,
          ...requestInfo
        });
      } else {
        console.log('[AUTH] Logout attempt without active session');
        await syslog.warning("Logout attempt without active session", requestInfo);
        res.status(200).json({ message: "No active session to logout" });
      }
      req.session.destroy((err) => {
        if (err) {
          throw err;
        }
        console.log('[AUTH] Session destroyed successfully');
        res.status(200).json({ message: "Logged out successfully" });
      });
    } catch (error) {
      console.error("Logout error:", error);
      await syslog.error("Logout system error", { 
        error: error instanceof Error ? error.message : String(error),
        ...requestInfo
      });
      await DebugLogger.logError('AUTH_LOGOUT', error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Update the logs endpoint to use database
  app.get("/api/admin/logs", async (req, res) => {
    try {
      // Check if user is admin
      if (req.user?.role !== "admin") {
        return res.status(403).json({ error: "Only administrators can access logs" });
      }

      const { level, facility, startDate, endDate, search, page = 1, limit = 100 } = req.query;

      // Build the query
      let query = db
        .select({
          id: systemLogs.id,
          timestamp: systemLogs.timestamp,
          facility: systemLogs.facility,
          severity: systemLogs.severity,
          message: systemLogs.message,
          msgId: systemLogs.msgId,
          structuredData: systemLogs.structuredData,
          username: sql<string>`COALESCE(
            ${systemLogs.structuredData}->>'username',
            ${systemLogs.structuredData}->>'user',
            'system'
          )`,
          context: sql<string>`COALESCE(
            ${systemLogs.structuredData}->>'context',
            ${systemLogs.msgId},
            'general'
          )`,
          ip: sql<string>`COALESCE(
            ${systemLogs.structuredData}->>'ip',
            'N/A'
          )`,
          userAgent: sql<string>`COALESCE(
            ${systemLogs.structuredData}->>'userAgent',
            'N/A'
          )`
        })
        .from(systemLogs);

      // Apply filters
      if (level !== undefined) {
        query = query.where(eq(systemLogs.severity, parseInt(level as string)));
      }

      if (facility !== undefined) {
        query = query.where(eq(systemLogs.facility, parseInt(facility as string)));
      }

      if (startDate) {
        query = query.where(gte(systemLogs.timestamp, new Date(startDate as string)));
      }

      if (endDate) {
        query = query.where(lte(systemLogs.timestamp, new Date(endDate as string)));
      }

      if (search) {
        // Check if it's a username search in format username:value
        if (search.toString().startsWith('username:')) {
          const username = search.toString().substring(9).trim();
          console.log(`Filtering logs by username: ${username}`);
          query = query.where(
            or(
              sql`${systemLogs.structuredData}->>'username' = ${username}`,
              sql`${systemLogs.structuredData}->>'user' = ${username}`
            )
          );
        } else if (search.trim() !== '') {  // Only filter if search is not empty
          // Regular search
          const searchTerm = `%${search}%`;
          query = query.where(
            or(
              like(systemLogs.message, searchTerm),
              like(systemLogs.msgId, searchTerm)
            )
          );
        }
      }

      // Get total count for pagination
      const totalCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(systemLogs)
        .then((res) => Number(res[0].count));

      // Execute the query with pagination
      const logs = await query
        .orderBy(desc(systemLogs.timestamp))
        .limit(parseInt(limit as string))
        .offset((parseInt(page as string) - 1) * parseInt(limit as string));

      // Format the logs to include username and additional context
      const formattedLogs = logs.map(log => ({
        ...log,
        timestamp: new Date(log.timestamp).toLocaleString(),
        username: log.username || 'system',
        level: LogLevelNames[log.severity as LogLevel],
        facility: LogFacilityNames[log.facility as LogFacility],
        context: log.context || 'general',
        ip: log.ip || 'N/A',
        userAgent: log.userAgent || 'N/A'
      }));

      res.json({
        logs: formattedLogs,
        total: totalCount,
        page: parseInt(page as string),
        totalPages: Math.ceil(totalCount / parseInt(limit as string))
      });

    } catch (error) {
      console.error("Failed to fetch logs:", error);
      res.status(500).json({ error: "Failed to fetch logs" });
    }
  });

  // Enhanced logging middleware for key routes
  const logUserActivity = (activityType: string) => {
    return async (req: Request, res: Response, next: NextFunction) => {
      const originalSend = res.send;
      res.send = function(body) {
        if (req.user && res.statusCode >= 200 && res.statusCode < 300) {
          const activity = `${activityType} - ${req.method} ${req.path}`;
          const contextMap: Record<string, string> = {
            '/api/regulations': 'REGULATION_ACCESS',
            '/api/notes': 'NOTE_MANAGEMENT',
            '/api/deadlines': 'DEADLINE_REVIEW',
            '/api/admin/users': 'USER_MANAGEMENT',
            '/api/bug-report': 'BUG_REPORT'
          };
          
          // Determine the context based on the path
          let context = 'USER_ACTIVITY';
          for (const key in contextMap) {
            if (req.path.startsWith(key)) {
              context = contextMap[key];
              break;
            }
          }
          
          syslog.info(activity, {
            username: req.user.username,
            user: req.user.username,
            userId: req.user.id,
            ip: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
            userAgent: req.headers['user-agent'] || 'Unknown',
            context: context,
            type: 'user_action',
            path: req.path,
            method: req.method,
            timestamp: new Date().toISOString()
          }).catch(err => console.error('Error logging user activity:', err));
        }
        return originalSend.call(this, body);
      };
      next();
    };
  };

  // Apply activity logging middleware to key routes
  app.use('/api/regulations*', logUserActivity('Regulation access'));
  app.use('/api/notes*', logUserActivity('Note management'));
  app.use('/api/deadlines*', logUserActivity('Deadline review'));
  app.use('/api/bug-report', logUserActivity('Bug report submission'));
  app.use('/api/admin/users*', logUserActivity('User management'));
  app.use('/api/auth/login', logUserActivity('Authentication'));
  app.use('/api/auth/logout', logUserActivity('Authentication'));
  
  // Log all API requests for comprehensive activity tracking
  app.use('/api/*', async (req, res, next) => {
    if (req.user) {
      const username = req.user.username || 'unknown';
      const userId = req.user.id;
      const path = req.path;
      const method = req.method;
      const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
      
      try {
        await syslog.info(`API request: ${method} ${path}`, {
          username,
          userId,
          path,
          method,
          ip,
          userAgent: req.headers['user-agent'] || 'unknown',
          timestamp: new Date().toISOString(),
          context: 'API_REQUEST'
        });
      } catch (error) {
        console.error('Failed to log API request:', error);
      }
    }
    next();
  });
  
  // Enhanced validation logging
  app.use('/api/regulations/validate', async (req, res, next) => {
    if (req.user) {
      await syslog.info(`User ${req.user.username} initiated regulation validation`, {
        username: req.user.username,
        userId: req.user.id,
        context: 'REGULATION_VALIDATION',
        type: 'user_action'
      }).catch(err => console.error('Error logging validation activity:', err));
    }
    next();
  });

  // Add logging to the routes for testing
  app.get("/api/test-logs", async (req, res) => {
    try {
      // Check if user is admin
      if (req.user?.role !== "admin") {
        return res.status(403).json({ error: "Only administrators can test logs" });
      }

      // Generate test logs at different levels
      syslog.emergency("Test emergency message", { test: true });
      syslog.alert("Test alert message", { test: true });
      syslog.critical("Test critical message", { test: true });
      syslog.error("Test error message", { test: true });
      syslog.warning("Test warning message", { test: true });
      syslog.notice("Test notice message", { test: true }); 
      syslog.info("Test info message", { test: true });
      syslog.debug("Test debug message", { test: true });

      // Test specific event logging
      syslog.logAuthEvent(LogLevel.INFO, "User login test", 1, "testuser");
      syslog.logSecurityEvent(LogLevel.WARNING, "Security test", { event: "test" });
      syslog.logAuditEvent(LogLevel.INFO, "Audit test", { action: "test" });
      syslog.logSystemEvent(LogLevel.NOTICE, "System test", { component: "test" });

      res.json({ message: "Test logs generated successfully" });
    } catch (error) {
      console.error("Failed to generate test logs:", error);
      res.status(500).json({ error: "Failed to generate test logs" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

const LogLevelNames: Record<LogLevel, string> = {
  0: 'EMERG',
  1: 'ALERT',
  2: 'CRIT',
  3: 'ERR',
  4: 'WARNING',
  5: 'NOTICE',
  6: 'INFO',
  7: 'DEBUG'
};

const LogFacilityNames: Record<LogFacility, string> = {
  0: 'KERN',
  1: 'USER',
  2: 'MAIL',
  3: 'DAEMON',
  4: 'AUTH',
  5: 'SYSLOG',
  6: 'LPR',
  7: 'NEWS',
  8: 'UUCP',
  9: 'CRON',
  10: 'AUTHPRIV',
  11: 'FTP',
  12: 'LOCAL0',
  13: 'LOCAL1',
  14: 'LOCAL2',
  15: 'LOCAL3',
  16: 'LOCAL4',
  17: 'LOCAL5',
  18: 'LOCAL6',
  19: 'LOCAL7'
};