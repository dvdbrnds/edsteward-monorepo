import express from 'express';
import { storage } from '../../storage';
import { syslog, LogLevel, LogFacility } from '../../services/syslog';
import { tenantMiddleware } from '../../middleware/tenant';
import { getTenantStorage } from '../../services/tenantStorage';

const router = express.Router();

// Apply new tenant middleware to all routes
router.use(tenantMiddleware);

// Simple auth middleware (we'll improve this later)
const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!(req as any).user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

// Helper function to log regulation changes with user details
const logRegulationChange = (
  action: string,
  regulationId: number,
  userId: number,
  username: string,
  changes?: Record<string, { from: any; to: any }>,
  metadata?: any
) => {
  const changeDetails = changes 
    ? Object.entries(changes)
        .map(([field, { from, to }]) => `${field}: "${from}" → "${to}"`)
        .join(', ')
    : '';
  
  const message = `${action} regulation ${regulationId} by user ${username} (${userId})${changeDetails ? `: ${changeDetails}` : ''}`;
  
  syslog.log(LogFacility.LOCAL0, LogLevel.INFO, message, {
    id: 'regulation-change',
    parameters: {
      userId,
      username,
      regulationId,
      action,
      changes,
      ...metadata
    }
  });
};

// Helper function to compare regulation objects and detect changes
const detectChanges = (original: any, updated: any): Record<string, { from: any; to: any }> => {
  const changes: Record<string, { from: any; to: any }> = {};
  const fieldsToTrack = [
    'name', 'description', 'requirements', 'category', 'jurisdiction', 
    'isApplicable', 'effectiveDate', 'nextReviewDate', 'agency_name',
    'agency_contact', 'regulationUrl', 'complianceNotes'
  ];
  
  for (const field of fieldsToTrack) {
    if (original[field] !== updated[field]) {
      changes[field] = {
        from: original[field],
        to: updated[field]
      };
    }
  }
  
  return changes;
};

// Get all regulations (temporarily without auth for testing)
router.get("/", async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Get tenant-aware storage
    const tenantReq = req as any;
    const tenantStorage = tenantReq.tenant ? getTenantStorage(tenantReq.tenant) : storage;
    
    console.log(`[REGULATIONS] Using tenant: ${tenantReq.tenantId || 'default'}`);
    
    // Parse query parameters
    const {
      jurisdiction, // Legacy support
      jurisdictionSource,
      institutionType,
      category,
      search,
      applicable,
      sortBy = 'lastUpdated',
      sortOrder = 'desc',
      page = '1',
      limit = '1000'
    } = req.query;

    let regulations = await tenantStorage.getRegulations();
    
    // Apply filters
    // Legacy jurisdiction filter support
    if (jurisdiction && typeof jurisdiction === 'string') {
      regulations = regulations.filter(reg => reg.jurisdictionSource === jurisdiction);
    }
    
    // New jurisdiction source filter
    if (jurisdictionSource && typeof jurisdictionSource === 'string') {
      regulations = regulations.filter(reg => reg.jurisdictionSource === jurisdictionSource);
    }
    
    // New institution type filter
    if (institutionType && typeof institutionType === 'string') {
      regulations = regulations.filter(reg => {
        if (!reg.applicableInstitutions) return false;
        const institutions = Array.isArray(reg.applicableInstitutions) 
          ? reg.applicableInstitutions 
          : [];
        return institutions.includes(institutionType) || institutions.includes('all-institutions');
      });
    }
    
    if (category && typeof category === 'string') {
      regulations = regulations.filter(reg => reg.category === category);
    }
    
    if (applicable && typeof applicable === 'string') {
      const isApplicable = applicable === 'true';
      regulations = regulations.filter(reg => reg.isApplicable === isApplicable);
    }
    
    if (search && typeof search === 'string') {
      const searchResults = await storage.searchRegulations(search);
      const searchIds = new Set(searchResults.map(r => r.id));
      regulations = regulations.filter(reg => searchIds.has(reg.id));
    }

    // Apply sorting
    const validSortFields = ['lastUpdated', 'name', 'effectiveDate', 'category', 'jurisdiction'];
    const sortField = validSortFields.includes(sortBy as string) ? sortBy as string : 'lastUpdated';
    
    regulations.sort((a, b) => {
      const aVal = a[sortField as keyof typeof a];
      const bVal = b[sortField as keyof typeof b];
      
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      
      let comparison = 0;
      if (aVal < bVal) comparison = -1;
      else if (aVal > bVal) comparison = 1;
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    // Apply pagination
    const pageNum = Math.max(1, parseInt(page as string, 10));
    const limitNum = Math.min(5000, Math.max(1, parseInt(limit as string, 10)));
    const offset = (pageNum - 1) * limitNum;
    
    const paginatedRegulations = regulations.slice(offset, offset + limitNum);
    
    const totalTime = Date.now() - startTime;
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Fetched ${paginatedRegulations.length} regulations in ${totalTime}ms`);

    // For compatibility with frontend expecting array directly
    res.json(paginatedRegulations);
  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, `Failed to fetch regulations: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ 
      error: "Failed to fetch regulations", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

// Get regulation IDs only (for dropdowns/selectors)
router.get("/ids", requireAuth, async (req, res) => {
  try {
    const startTime = Date.now();
    const regulations = await storage.getRegulations();
    
    const regulationIds = regulations.map(reg => ({
      id: reg.id,
      itemId: reg.itemId,
      name: reg.name,
      jurisdiction: reg.jurisdiction,
      category: reg.category,
      isApplicable: reg.isApplicable
    }));
    
    const totalTime = Date.now() - startTime;
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Fetched ${regulationIds.length} regulation IDs in ${totalTime}ms`);

    res.json(regulationIds);
  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, `Failed to fetch regulation IDs: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ 
      error: "Failed to fetch regulation IDs", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

// Get single regulation by ID
router.get("/:regulationId", async (req, res) => {
  try {
    const startTime = Date.now();
    const regulationId = parseInt(req.params.regulationId);
    
    if (isNaN(regulationId)) {
      return res.status(400).json({ error: "Invalid regulation ID" });
    }
    
    const regulation = await storage.getRegulation(regulationId);
    
    if (!regulation) {
      return res.status(404).json({ error: "Regulation not found" });
    }

    const totalTime = Date.now() - startTime;
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Fetched regulation ${regulationId} in ${totalTime}ms`);

    res.json(regulation);
  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, `Failed to fetch regulation ${req.params.regulationId}: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ 
      error: "Failed to fetch regulation", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

// Get evidence files for a regulation
router.get("/:regulationId/evidence", requireAuth, async (req, res) => {
  try {
    const startTime = Date.now();
    const regulationId = parseInt(req.params.regulationId);
    
    if (isNaN(regulationId)) {
      return res.status(400).json({ error: "Invalid regulation ID" });
    }
    
    const evidenceFiles = await storage.getEvidenceFilesByRegulation(regulationId);
    
    const totalTime = Date.now() - startTime;
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Fetched ${evidenceFiles.length} evidence files for regulation ${regulationId} in ${totalTime}ms`);

    res.json(evidenceFiles);
  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, `Failed to fetch evidence files for regulation ${req.params.regulationId}: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ 
      error: "Failed to fetch evidence files", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

// Update a regulation action
router.patch("/:regulationId/actions/:actionType", requireAuth, async (req, res) => {
  try {
    const startTime = Date.now();
    const regulationId = parseInt(req.params.regulationId);
    const actionType = req.params.actionType;
    
    if (isNaN(regulationId)) {
      return res.status(400).json({ error: "Invalid regulation ID" });
    }
    
    if (!actionType) {
      return res.status(400).json({ error: "Action type is required" });
    }
    
    const actionUpdate = req.body;
    
    // Validate action type
    const validActionTypes = ['attestation', 'website_publish', 'community_communication', 'agency_submission'];
    if (!validActionTypes.includes(actionType)) {
      return res.status(400).json({ error: "Invalid action type" });
    }
    
    // Get current regulation
    const regulation = await storage.getRegulation(regulationId);
    if (!regulation) {
      return res.status(404).json({ error: "Regulation not found" });
    }
    
    // Update the specific action in the actions array
    const actions = regulation.actions || [];
    const actionIndex = actions.findIndex(action => action.type === actionType);
    
    // Store the previous status for logging
    const previousStatus = actionIndex !== -1 ? actions[actionIndex].status : 'not_exists';
    
    if (actionIndex === -1) {
      // Action doesn't exist, create it
      actions.push({
        type: actionType as any,
        enabled: actionUpdate.enabled ?? true,
        required: actionUpdate.required ?? false,
        status: actionUpdate.status ?? 'pending',
        dueDate: actionUpdate.dueDate,
        completedDate: actionUpdate.completedDate,
        notes: actionUpdate.notes,
        completedBy: actionUpdate.completedBy,
        completedAt: actionUpdate.completedAt
      });
    } else {
      // Update existing action
      actions[actionIndex] = {
        ...actions[actionIndex],
        ...actionUpdate,
        type: actionType as any // Ensure type doesn't change
      };
    }
    
    // Update the regulation with the new actions
    await storage.updateRegulation(regulationId, { actions });
    
    const totalTime = Date.now() - startTime;
    
    // Enhanced logging with user details and action specifics
    logRegulationChange(
      `Updated action ${actionType}`,
      regulationId,
      req.user!.id,
      req.user!.username,
      {
        [`action_${actionType}_status`]: {
          from: previousStatus,
          to: actionUpdate.status || 'pending'
        }
      },
      {
        actionType,
        actionEnabled: actionUpdate.enabled,
        actionRequired: actionUpdate.required,
        updateTime: totalTime,
        completedBy: actionUpdate.completedBy,
        completedAt: actionUpdate.completedAt
      }
    );

    res.json({ 
      success: true, 
      action: actions[actionIndex !== -1 ? actionIndex : actions.length - 1] 
    });
  } catch (error) {
    const user = req.user!;
    syslog.log(
      LogFacility.LOCAL0, 
      LogLevel.ERROR, 
      `Failed to update action for regulation ${req.params.regulationId} by user ${user.username} (${user.id}): ${error instanceof Error ? error.message : String(error)}`,
      {
        id: 'regulation-action-error',
        parameters: {
          userId: user.id,
          username: user.username,
          regulationId: req.params.regulationId,
          actionType: req.params.actionType,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    );
    res.status(500).json({ 
      error: "Failed to update action", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

// Update entire regulation (PUT endpoint)
router.put("/:regulationId", requireAuth, async (req, res) => {
  try {
    const startTime = Date.now();
    const regulationId = parseInt(req.params.regulationId);
    const user = req.user!;
    
    if (isNaN(regulationId)) {
      return res.status(400).json({ error: "Invalid regulation ID" });
    }
    
    // Get current regulation for change tracking
    const currentRegulation = await storage.getRegulation(regulationId);
    if (!currentRegulation) {
      return res.status(404).json({ error: "Regulation not found" });
    }
    
    const updateData = req.body;
    
    // Validate required fields
    if (updateData.name && typeof updateData.name !== 'string') {
      return res.status(400).json({ error: "Name must be a string" });
    }
    
    // Detect changes for audit trail
    const changes = detectChanges(currentRegulation, updateData);
    
    // Update the regulation
    const updatedRegulation = await storage.updateRegulation(regulationId, updateData);
    
    const totalTime = Date.now() - startTime;
    
    // Log the regulation update with detailed change tracking
    logRegulationChange(
      'Updated',
      regulationId,
      user.id,
      user.username,
      changes,
      {
        fieldsChanged: Object.keys(changes).length,
        updateTime: totalTime,
        requestSize: JSON.stringify(updateData).length
      }
    );

    res.json(updatedRegulation);
  } catch (error) {
    const user = req.user!;
    syslog.log(
      LogFacility.LOCAL0, 
      LogLevel.ERROR, 
      `Failed to update regulation ${req.params.regulationId} by user ${user.username} (${user.id}): ${error instanceof Error ? error.message : String(error)}`
    );
    res.status(500).json({ 
      error: "Failed to update regulation", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

// Create new regulation (POST endpoint)
router.post("/", requireAuth, async (req, res) => {
  try {
    const startTime = Date.now();
    const user = req.user!;
    const regulationData = req.body;
    
    // Validate required fields
    if (!regulationData.name || typeof regulationData.name !== 'string') {
      return res.status(400).json({ error: "Name is required and must be a string" });
    }
    
    if (!regulationData.itemId || typeof regulationData.itemId !== 'string') {
      return res.status(400).json({ error: "Item ID is required and must be a string" });
    }
    
    // Create the regulation
    const newRegulation = await storage.createRegulation(regulationData);
    
    const totalTime = Date.now() - startTime;
    
    // Log the regulation creation
    logRegulationChange(
      'Created',
      newRegulation.id,
      user.id,
      user.username,
      undefined,
      {
        itemId: newRegulation.itemId,
        name: newRegulation.name,
        category: newRegulation.category,
        jurisdiction: newRegulation.jurisdiction,
        createTime: totalTime
      }
    );

    res.status(201).json(newRegulation);
  } catch (error) {
    const user = req.user!;
    syslog.log(
      LogFacility.LOCAL0, 
      LogLevel.ERROR, 
      `Failed to create regulation by user ${user.username} (${user.id}): ${error instanceof Error ? error.message : String(error)}`
    );
    res.status(500).json({ 
      error: "Failed to create regulation", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

// Delete regulation (DELETE endpoint)
router.delete("/:regulationId", requireAuth, async (req, res) => {
  try {
    const startTime = Date.now();
    const regulationId = parseInt(req.params.regulationId);
    const user = req.user!;
    
    if (isNaN(regulationId)) {
      return res.status(400).json({ error: "Invalid regulation ID" });
    }
    
    // Get regulation details before deletion for logging
    const regulation = await storage.getRegulation(regulationId);
    if (!regulation) {
      return res.status(404).json({ error: "Regulation not found" });
    }
    
    // Delete the regulation
    await storage.deleteRegulation(regulationId);
    
    const totalTime = Date.now() - startTime;
    
    // Log the regulation deletion
    logRegulationChange(
      'Deleted',
      regulationId,
      user.id,
      user.username,
      undefined,
      {
        deletedName: regulation.name,
        deletedItemId: regulation.itemId,
        deletedCategory: regulation.category,
        deletedJurisdiction: regulation.jurisdiction,
        deleteTime: totalTime
      }
    );

    res.json({ success: true, message: "Regulation deleted successfully" });
  } catch (error) {
    const user = req.user!;
    syslog.log(
      LogFacility.LOCAL0, 
      LogLevel.ERROR, 
      `Failed to delete regulation ${req.params.regulationId} by user ${user.username} (${user.id}): ${error instanceof Error ? error.message : String(error)}`,
      {
        id: 'regulation-delete-error',
        parameters: {
          userId: user.id,
          username: user.username,
          regulationId: req.params.regulationId,
          error: error instanceof Error ? error.message : String(error)
        }
      }
    );
    res.status(500).json({ 
      error: "Failed to delete regulation", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

export { router as regulationsRouter }; 