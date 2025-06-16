import express from "express";
import { storage } from "../../storage";
import type { InsertDeadline } from "@shared/schema";

const router = express.Router();

// GET /api/deadlines - Get all deadlines (requires authentication)
router.get("/", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const deadlines = await storage.getDeadlines();
    return res.json(deadlines);
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