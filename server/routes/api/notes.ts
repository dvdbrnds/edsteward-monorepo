import express from 'express';
import { z } from 'zod';
import { storage } from '../../storage';
import { syslog, LogLevel, LogFacility } from '../../services/syslog';
import { insertNoteSchema } from '@shared/schema';

const router = express.Router();

// Helper function to get tenant-aware storage
function getTenantStorage(tenantId: string) {
  const { TenantStorage } = require('../../services/tenantStorage');
  return new TenantStorage(tenantId, storage);
}

// Simple auth middleware (we'll improve this later)
const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

// Create a new note
router.post("/", requireAuth, async (req, res) => {
  try {
    // Get tenant-aware storage for data isolation
    const tenantReq = req as any;
    const tenantStorage = tenantReq.tenantId ? getTenantStorage(tenantReq.tenantId) : storage;
    
    console.log(`[NOTES] Creating note for tenant: ${tenantReq.tenantId || 'default'}`);
    
    // Validate request body
    const validatedData = insertNoteSchema.parse(req.body);
    
    const note = await tenantStorage.createNote({
      ...validatedData,
      userId: req.user?.id || 1 // Default to user 1 for now
    });

    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Created note ${note.id} for regulation ${note.regulationId} in tenant ${tenantReq.tenantId || 'default'}`);
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
router.get("/regulation/:regulationId", requireAuth, async (req, res) => {
  try {
    // Get tenant-aware storage for data isolation
    const tenantReq = req as any;
    const tenantStorage = tenantReq.tenantId ? getTenantStorage(tenantReq.tenantId) : storage;
    
    const regulationId = parseInt(req.params.regulationId);
    
    if (isNaN(regulationId)) {
      return res.status(400).json({ error: "Invalid regulation ID" });
    }

    const notes = await tenantStorage.getNotesByRegulation(regulationId);
    
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Fetched ${notes.length} notes for regulation ${regulationId} in tenant ${tenantReq.tenantId || 'default'}`);
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
    // Get tenant-aware storage for data isolation
    const tenantReq = req as any;
    const tenantStorage = tenantReq.tenantId ? getTenantStorage(tenantReq.tenantId) : storage;
    
    const noteId = parseInt(req.params.noteId);
    
    if (isNaN(noteId)) {
      return res.status(400).json({ error: "Invalid note ID" });
    }

    // Check if note exists and user has permission
    const existingNote = await tenantStorage.getNote(noteId);
    if (!existingNote) {
      return res.status(404).json({ error: "Note not found" });
    }

    // For now, allow deletion (later we'll check ownership)
    await tenantStorage.deleteNote(noteId);
    
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Deleted note ${noteId} in tenant ${tenantReq.tenantId || 'default'}`);
    res.status(204).send();
  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, `Failed to delete note ${req.params.noteId}: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ 
      error: "Failed to delete note", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

export { router as notesRouter }; 