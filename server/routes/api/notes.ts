import express from 'express';
import { z } from 'zod';
// import { storage } from '../../storage'; // Unused - using getDatabaseStorage() directly
import { syslog, LogLevel, LogFacility } from '../../services/syslog';
import { insertNoteSchema } from '@shared/schema';
import { getDatabaseStorage } from '../../services/database';

const router = express.Router();

// Simple auth middleware
const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Use multiple authentication checks for maximum compatibility
  const isAuthenticated = req.isAuthenticated ? req.isAuthenticated() : false;
  const hasUser = !!(req as any).user;
  
  if (!isAuthenticated && !hasUser) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

// Create a new note
router.post("/", requireAuth, async (req, res) => {
  try {
    // Use direct database storage for single-tenant mode
    const tenantStorage = getDatabaseStorage();
    
    console.log(`[NOTES] Creating note for single-tenant mode`);
    console.log(`[NOTES] Request body:`, JSON.stringify(req.body, null, 2));
    
    // Validate request body
    const validatedData = insertNoteSchema.parse(req.body);
    console.log(`[NOTES] Validation successful:`, JSON.stringify(validatedData, null, 2));
    
    const note = await tenantStorage.createNote({
      ...validatedData,
      userId: req.user?.id || 1, // Default to user 1 for now
      isPrivate: false // All notes are public by design
    });

    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Created note ${note.id} for regulation ${note.regulationId}`);
    res.status(201).json(note);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: error.errors 
      });
    }
    
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, `Failed to create note: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ 
      error: "Failed to create note", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

// Get notes for a specific regulation
router.get("/regulation/:regulationId", async (req, res) => {
  try {
    // Use direct database storage for single-tenant mode
    const tenantStorage = getDatabaseStorage();
    
    const regulationId = parseInt(req.params.regulationId);
    
    if (isNaN(regulationId)) {
      return res.status(400).json({ error: "Invalid regulation ID" });
    }

    const notes = await tenantStorage.getNotesByRegulation(regulationId);
    
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Fetched ${notes.length} notes for regulation ${regulationId}`);
    res.json(notes);
  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, `Failed to fetch notes for regulation ${req.params.regulationId}: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ 
      error: "Failed to fetch notes", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

// Delete a note
router.delete("/:noteId", requireAuth, async (req, res) => {
  try {
    // Use direct database storage for single-tenant mode
    const tenantStorage = getDatabaseStorage();
    
    const noteId = parseInt(req.params.noteId);
    
    if (isNaN(noteId)) {
      return res.status(400).json({ error: "Invalid note ID" });
    }

    // Check if note exists and user has permission
    const existingNote = await tenantStorage.getNote(noteId);
    if (!existingNote) {
      return res.status(404).json({ error: "Note not found" });
    }

    // Check if user is the creator or an administrator
    const user = req.user;
    const isAdmin = user?.role === 'admin' || (user?.roles && JSON.parse(user.roles).includes('admin'));
    const isCreator = existingNote.userId === user?.id;

    if (!isAdmin && !isCreator) {
      syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, `Unauthorized note deletion attempt by user ${user?.id} for note ${noteId}`);
      return res.status(403).json({ error: "You can only delete your own notes or you must be an administrator" });
    }

    await tenantStorage.deleteNote(noteId);
    
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Deleted note ${noteId}`);
    res.status(204).send();
  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, `Failed to delete note ${req.params.noteId}: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ 
      error: "Failed to delete note", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

// Update note endpoint
router.put("/:noteId", requireAuth, async (req, res) => {
  try {
    const tenantStorage = getDatabaseStorage();
    
    const noteId = parseInt(req.params.noteId);
    
    if (isNaN(noteId)) {
      return res.status(400).json({ error: "Invalid note ID" });
    }

    // Check if note exists
    const existingNote = await tenantStorage.getNote(noteId);
    if (!existingNote) {
      return res.status(404).json({ error: "Note not found" });
    }

    // Check if user is the creator or an administrator
    const user = req.user;
    const isAdmin = user?.role === 'admin' || (user?.roles && JSON.parse(user.roles).includes('admin'));
    const isCreator = existingNote.userId === user?.id;

    if (!isAdmin && !isCreator) {
      syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, `Unauthorized note update attempt by user ${user?.id} for note ${noteId}`);
      return res.status(403).json({ error: "You can only edit your own notes or you must be an administrator" });
    }

    // Validate the request body
    const validatedData = insertNoteSchema.parse(req.body);
    
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `[NOTES] Updating note ${noteId} for user ${user?.id}`);
    
    // Update the note with user ID for history tracking
    const updatedNote = await tenantStorage.updateNote(noteId, validatedData, user?.id);
    
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Updated note ${noteId} for regulation ${validatedData.regulationId}`);
    res.status(200).json(updatedNote);
  } catch (error) {
    if (error instanceof z.ZodError) {
      syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, `Note update validation failed: ${JSON.stringify(error.errors)}`);
      return res.status(400).json({ 
        error: "Validation failed", 
        details: error.errors 
      });
    }
    
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, `Failed to update note ${req.params.noteId}: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ 
      error: "Failed to update note",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Get note history endpoint
router.get("/:noteId/history", requireAuth, async (req, res) => {
  try {
    const tenantStorage = getDatabaseStorage();
    
    const noteId = parseInt(req.params.noteId);
    
    if (isNaN(noteId)) {
      return res.status(400).json({ error: "Invalid note ID" });
    }

    // Check if note exists
    const existingNote = await tenantStorage.getNote(noteId);
    if (!existingNote) {
      return res.status(404).json({ error: "Note not found" });
    }

    // Check if user has permission to view note history
    const user = req.user;
    const isAdmin = user?.role === 'admin' || (user?.roles && JSON.parse(user.roles).includes('admin'));
    const isCreator = existingNote.userId === user?.id;

    if (!isAdmin && !isCreator) {
      syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, `Unauthorized note history access attempt by user ${user?.id} for note ${noteId}`);
      return res.status(403).json({ error: "You can only view history for your own notes or you must be an administrator" });
    }

    // Get note history
    const history = await tenantStorage.getNoteHistory(noteId);
    
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Retrieved ${history.length} history records for note ${noteId}`);
    res.status(200).json(history);
  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, `Failed to get note history for ${req.params.noteId}: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ 
      error: "Failed to get note history",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router; 