import express from "express";
import { storage } from "../../storage";
import type { InsertDeadline, Regulation } from "@shared/schema";

const router = express.Router();

// Helper function to get tenant-aware storage
async function getTenantStorage(tenantId: string) {
  const { TenantStorage } = await import('../../services/tenantStorage');
  const tenantConfig = { 
    id: tenantId, 
    name: tenantId, 
    domain: `${tenantId}.edsteward.local`,
    database: tenantId 
  };
  return new TenantStorage(tenantConfig);
}

// GET /api/deadlines - Get all deadlines with regulation names (requires authentication)
router.get("/", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Get tenant-aware storage for data isolation
    const tenantReq = req as any;
    const tenantStorage = tenantReq.tenantId ? await getTenantStorage(tenantReq.tenantId) : storage;
    
    console.log(`[DEADLINES] Using tenant: ${tenantReq.tenantId || 'default'} with isolation: ${!!tenantReq.tenantId}`);

    const deadlines = await tenantStorage.getDeadlines();
    const regulations = await tenantStorage.getRegulations();
    
    // Create a map for quick regulation lookup
    const regulationMap = new Map(regulations.map((reg: Regulation) => [reg.id, reg]));
    
    // Enhance deadlines with regulation names
    const enhancedDeadlines = deadlines.map((deadline: any) => {
      const regulation = regulationMap.get(deadline.regulationId);
      return {
        ...deadline,
        regulationName: regulation?.name || `Regulation #${deadline.regulationId}`,
        regulationTopic: regulation?.topic,
        regulationStatuteIds: regulation?.statuteIds
      };
    });

    console.log(`[DEADLINES] Found ${enhancedDeadlines.length} deadlines for tenant ${tenantReq.tenantId || 'default'}`);
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

    // Get tenant-aware storage for data isolation
    const tenantReq = req as any;
    const tenantStorage = tenantReq.tenantId ? await getTenantStorage(tenantReq.tenantId) : storage;

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

    const createdDeadline = await tenantStorage.createDeadline(deadline);
    console.log(`[DEADLINES] Created deadline for tenant ${tenantReq.tenantId || 'default'}: ${createdDeadline.id}`);
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