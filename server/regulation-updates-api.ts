import express, { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { syslog, LogFacility, LogLevel } from "./services/syslog";
import { z } from "zod";
import { calculateTextChangeDiff } from "./services/diff-calculator";
// Authentication middleware function
const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ error: "Authentication required" });
};

const router = express.Router();

// Schema for signature validation
const signatureSchema = z.object({
  signature: z.string().min(1, "Signature is required"),
});

// Schema for rejection validation
const rejectionSchema = z.object({
  signature: z.string().min(1, "Signature is required"),
  reason: z.string().min(1, "Rejection reason is required"),
});

// Get list of pending regulation updates
router.get("/api/regulations/updates", isAuthenticated, async (req: Request, res: Response) => {
  try {
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Fetching pending regulation updates");
    
    // Get all regulations that have pending updates
    const pendingUpdates = await storage.getPendingRegulationUpdates();
    
    // Transform the data for the frontend
    const updatesForFrontend = pendingUpdates.map(update => {
      // Calculate change statistics
      const changeStats = calculateTextChangeDiff(
        update.originalContent || "", 
        update.updatedContent || ""
      );
      
      return {
        id: update.id,
        name: update.name,
        changes: {
          added: changeStats.addedPercentage,
          removed: changeStats.removedPercentage,
          changed: changeStats.changedPercentage
        },
        priority: determinePriority(changeStats.changedPercentage),
        date: update.updateDate
      };
    });
    
    return res.json(updatesForFrontend);
  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Error fetching regulation updates", {
      error: error instanceof Error ? error.message : String(error)
    });
    return res.status(500).json({ 
      error: "Failed to fetch regulation updates",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Get a specific regulation update
router.get("/api/regulations/updates/:id", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: "Invalid regulation update ID" });
    }
    
    const regulationId = parseInt(id);
    
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Fetching regulation update details for ID: ${regulationId}`);
    
    const updateDetails = await storage.getRegulationUpdateById(regulationId);
    
    if (!updateDetails) {
      return res.status(404).json({ error: "Regulation update not found" });
    }
    
    // Calculate change statistics
    const changeStats = calculateTextChangeDiff(
      updateDetails.originalContent || "", 
      updateDetails.updatedContent || ""
    );
    
    // Format response for frontend
    const updateForFrontend = {
      id: updateDetails.id,
      name: updateDetails.name,
      originalContent: updateDetails.originalContent,
      updatedContent: updateDetails.updatedContent,
      changeStatistics: {
        added: changeStats.addedPercentage,
        removed: changeStats.removedPercentage,
        changed: changeStats.changedPercentage
      },
      date: updateDetails.updateDate
    };
    
    return res.json(updateForFrontend);
  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Error fetching regulation update details", {
      error: error instanceof Error ? error.message : String(error)
    });
    return res.status(500).json({ 
      error: "Failed to fetch regulation update details",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Accept a regulation update
router.post("/api/regulations/:id/accept", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: "Invalid regulation ID" });
    }
    
    const regulationId = parseInt(id);
    
    // Validate the request body
    const validationResult = signatureSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: validationResult.error.errors 
      });
    }
    
    const { signature } = validationResult.data;
    
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Accepting regulation update for ID: ${regulationId}`);
    
    // Record the acceptance with signature and user info
    const user = req.user as any;
    
    await storage.acceptRegulationUpdate(
      regulationId, 
      user.id, 
      signature
    );
    
    return res.json({ success: true, message: "Regulation update accepted successfully" });
  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Error accepting regulation update", {
      error: error instanceof Error ? error.message : String(error)
    });
    return res.status(500).json({ 
      error: "Failed to accept regulation update",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Reject a regulation update
router.post("/api/regulations/:id/reject", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: "Invalid regulation ID" });
    }
    
    const regulationId = parseInt(id);
    
    // Validate the request body
    const validationResult = rejectionSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: validationResult.error.errors 
      });
    }
    
    const { signature, reason } = validationResult.data;
    
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Rejecting regulation update for ID: ${regulationId}`);
    
    // Record the rejection with signature, reason, and user info
    const user = req.user as any;
    
    await storage.rejectRegulationUpdate(
      regulationId, 
      user.id, 
      signature,
      reason
    );
    
    return res.json({ success: true, message: "Regulation update rejected successfully" });
  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Error rejecting regulation update", {
      error: error instanceof Error ? error.message : String(error)
    });
    return res.status(500).json({ 
      error: "Failed to reject regulation update",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Defer a regulation update
router.post("/api/regulations/:id/defer", isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: "Invalid regulation ID" });
    }
    
    const regulationId = parseInt(id);
    
    // Validate the request body
    const validationResult = signatureSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: "Validation failed", 
        details: validationResult.error.errors 
      });
    }
    
    const { signature } = validationResult.data;
    
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Deferring regulation update for ID: ${regulationId}`);
    
    // Record the deferral with signature and user info
    const user = req.user as any;
    
    await storage.deferRegulationUpdate(
      regulationId, 
      user.id, 
      signature
    );
    
    return res.json({ success: true, message: "Regulation update deferred successfully" });
  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Error deferring regulation update", {
      error: error instanceof Error ? error.message : String(error)
    });
    return res.status(500).json({ 
      error: "Failed to defer regulation update",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Helper function to determine priority based on change percentage
function determinePriority(changePercentage: number): "HIGH" | "MEDIUM" | "LOW" {
  if (changePercentage >= 20) {
    return "HIGH";
  } else if (changePercentage >= 5) {
    return "MEDIUM";
  } else {
    return "LOW";
  }
}

export default router;