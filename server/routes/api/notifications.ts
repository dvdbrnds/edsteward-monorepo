import express from "express";
import { storage } from "../../storage";
import type { InsertNotification } from "@shared/schema";

const router = express.Router();

// GET /api/notifications - Get notifications for the current user
router.get("/", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const notifications = await storage.getNotificationsByUser(req.user.id);
    return res.json(notifications);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return res.status(500).json({ 
      error: "Failed to fetch notifications",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// POST /api/notifications - Create a new notification
router.post("/", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { regulationId, type, frequency, enabled, phoneNumber } = req.body;

    if (!regulationId || !type || !frequency) {
      return res.status(400).json({ error: "Missing required fields: regulationId, type, frequency" });
    }

    const notification: InsertNotification = {
      regulationId,
      userId: req.user.id,
      type,
      frequency,
      enabled: enabled !== undefined ? enabled : true,
      phoneNumber,
    };

    const createdNotification = await storage.createNotification(notification);
    return res.json(createdNotification);
  } catch (error) {
    console.error("Error creating notification:", error);
    return res.status(500).json({ 
      error: "Failed to create notification",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router; 