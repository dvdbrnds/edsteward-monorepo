import express from "express";
import { storage } from "../../storage";
import type { InsertDeadline } from "@shared/schema";

const router = express.Router();

// GET /api/deadlines - Get all deadlines with regulation names (requires authentication)
router.get("/", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const deadlines = await storage.getDeadlines();
    const regulations = await storage.getRegulations();
    
    // Create a map for quick regulation lookup
    const regulationMap = new Map(regulations.map(reg => [reg.id, reg]));
    
    // Enhance deadlines with regulation names
    const enhancedDeadlines = deadlines.map(deadline => ({
      ...deadline,
      regulationName: regulationMap.get(deadline.regulationId)?.name || `Regulation #${deadline.regulationId}`,
      regulationTopic: regulationMap.get(deadline.regulationId)?.topic,
      regulationStatuteIds: regulationMap.get(deadline.regulationId)?.statuteIds
    }));

    return res.json(enhancedDeadlines);
  } catch (error) {
    console.error("Error fetching deadlines:", error);
    return res.status(500).json({ 
      error: "Failed to fetch deadlines",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// POST /api/deadlines - Create a new deadline (requires authentication)
router.post("/", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { regulationId, dueDate, status, assignedTo } = req.body;

    if (!regulationId || !dueDate || !status) {
      return res.status(400).json({ error: "Missing required fields: regulationId, dueDate, status" });
    }

    const deadline: InsertDeadline = {
      regulationId,
      dueDate,
      status,
      assignedTo: assignedTo || req.user.id,
    };

    const createdDeadline = await storage.createDeadline(deadline);
    return res.json(createdDeadline);
  } catch (error) {
    console.error("Error creating deadline:", error);
    return res.status(500).json({ 
      error: "Failed to create deadline",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router; 