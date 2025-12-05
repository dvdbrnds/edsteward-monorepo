import express from 'express';
import { storage } from '../../storage';
import { getDatabaseStorage } from '../../services/database';
import { syslog, LogLevel, LogFacility } from '../../services/syslog';
import type { Regulation } from '@shared/schema';
import { 
  requireAuth, 
  requireComplianceOfficer,
  attachUserPermissions
} from '../../middleware/role-based-auth';
import { auditRegulationAction, auditEvidence } from '../../middleware/audit-middleware';
import multer from 'multer';

// Simple multer configuration for evidence uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

const router = express.Router();

// Apply user permissions to all routes
router.use(attachUserPermissions);

// Get all regulations
router.get("/", async (req: any, res) => {
  try {
    const startTime = Date.now();
    
    // Handle HEAD requests - only return headers, no body
    if (req.method === 'HEAD') {
      const regulations = await storage.getRegulations();
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Length', JSON.stringify(regulations).length);
      return res.status(200).end();
    }
    
    // Single-tenant mode - use direct database storage
    const tenantStorage = getDatabaseStorage();
    
    // Get user info for filtering
    const user = req.user;
    const isAdmin = user?.role === 'admin';
    const isComplianceOfficer = user?.role === 'compliance_officer';
    
    console.log(`[REGULATIONS] Fetching regulations for user: ${user?.username || 'anonymous'}, role: ${user?.role || 'none'}`);
    
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
    
    // Filter by ownership for compliance officers (admins see all)
    // Compliance officers only see regulations specifically assigned to them
    if (user && isComplianceOfficer && !isAdmin) {
      const beforeCount = regulations.length;
      // Check for both camelCase and snake_case field names (Drizzle vs raw SQL)
      regulations = regulations.filter((reg: any) => {
        const ownerId = reg.ownerId ?? reg.owner_id;
        return ownerId === user.id;
      });
      console.log(`[REGULATIONS] Filtered from ${beforeCount} to ${regulations.length} regulations for compliance officer ${user.username} (id: ${user.id})`);
    }
    
    // Apply filters
    // Legacy jurisdiction filter support
    if (jurisdiction && typeof jurisdiction === 'string') {
      regulations = regulations.filter((reg: Regulation) => reg.jurisdictionSource === jurisdiction);
    }
    
    // New jurisdiction source filter
    if (jurisdictionSource && typeof jurisdictionSource === 'string') {
      regulations = regulations.filter((reg: Regulation) => reg.jurisdictionSource === jurisdictionSource);
    }
    
    // New institution type filter
    if (institutionType && typeof institutionType === 'string') {
      regulations = regulations.filter((reg: Regulation) => {
        if (!reg.applicableInstitutions) return false;
        const institutions = Array.isArray(reg.applicableInstitutions) 
          ? reg.applicableInstitutions 
          : [];
        return institutions.includes(institutionType) || institutions.includes('all-institutions');
      });
    }
    
    if (category && typeof category === 'string') {
      regulations = regulations.filter((reg: Regulation) => reg.category === category);
    }
    
    if (applicable && typeof applicable === 'string') {
      const isApplicable = applicable === 'true';
      regulations = regulations.filter((reg: Regulation) => reg.isApplicable === isApplicable);
    }
    
    if (search && typeof search === 'string') {
      const searchResults = await tenantStorage.searchRegulations(search);
      const searchIds = new Set(searchResults.map((r: Regulation) => r.id));
      regulations = regulations.filter((reg: Regulation) => searchIds.has(reg.id));
    }

    // Apply sorting
    const validSortFields = ['lastUpdated', 'name', 'effectiveDate', 'category', 'jurisdiction'];
    const sortField = validSortFields.includes(sortBy as string) ? sortBy as string : 'lastUpdated';
    
    regulations.sort((a: Regulation, b: Regulation) => {
      const aVal = a[sortField as keyof Regulation];
      const bVal = b[sortField as keyof Regulation];
      
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
    
    // Use direct database storage for single-tenant mode
    const tenantStorage = getDatabaseStorage();
    
    const regulations = await tenantStorage.getRegulations();
    
    const regulationIds = regulations.map((reg: Regulation) => ({
      id: reg.id,
      itemId: reg.itemId,
      name: reg.name,
      jurisdiction: reg.jurisdictionSource,
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
    
    // Use direct database storage for single-tenant mode
    const tenantStorage = getDatabaseStorage();
    
    const regulation = await tenantStorage.getRegulation(regulationId);
    
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

// Get version history for a regulation
router.get("/:regulationId/versions", async (req, res) => {
  try {
    const regulationId = parseInt(req.params.regulationId);
    
    if (isNaN(regulationId)) {
      return res.status(400).json({ error: "Invalid regulation ID" });
    }

    const tenantStorage = getDatabaseStorage();
    const versions = await tenantStorage.getRegulationVersions(regulationId);
    
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
      `Fetched ${versions.length} versions for regulation ${regulationId}`);

    res.json(versions);
  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
      `Failed to fetch versions for regulation ${req.params.regulationId}: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ 
      error: "Failed to fetch regulation versions", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

// Get evidence files for a regulation
router.get("/:regulationId/evidence", async (req, res) => {
  try {
    const startTime = Date.now();
    const regulationId = parseInt(req.params.regulationId);
    
    if (isNaN(regulationId)) {
      return res.status(400).json({ error: "Invalid regulation ID" });
    }
    
    // Use direct database storage for single-tenant mode
    const tenantStorage = getDatabaseStorage();
    
    const evidenceFiles = await tenantStorage.getEvidenceFilesByRegulation(regulationId);
    
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

// Upload evidence file for a regulation
router.post("/:regulationId/evidence", requireAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.user) {
      syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, "Unauthorized evidence upload attempt");
      return res.status(401).json({ error: "Authentication required" });
    }

    const regulationId = parseInt(req.params.regulationId);

    if (isNaN(regulationId)) {
      return res.status(400).json({ error: "Invalid regulation ID" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const file = req.file;
    const description = req.body.description || '';
    const isOfficial = req.body.isOfficial === 'true';

    try {
      const tenantStorage = getDatabaseStorage();
      const evidenceFile = await tenantStorage.createEvidenceFile({
        regulationId: regulationId,
        fileName: file.originalname,
        fileSize: file.size,
        fileType: file.mimetype,
        description,
        uploadedBy: req.user.id,
        status: "pending",
        storagePath: file.path,
        isOfficial
      });

      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
        `Successfully uploaded evidence file for regulation ${regulationId}`);

      return res.json({
        message: "File uploaded successfully",
        file: evidenceFile
      });

    } catch (dbError) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Database error saving evidence file", {
        error: dbError instanceof Error ? dbError.message : String(dbError)
      });

      return res.status(500).json({
        error: "Database error saving evidence file",
        details: dbError instanceof Error ? dbError.message : String(dbError)
      });
    }

  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Evidence upload error", {
      error: error instanceof Error ? error.message : String(error)
    });

    return res.status(500).json({
      error: "Failed to upload evidence file",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Update a regulation - requires compliance officer or admin
router.put("/:regulationId", requireAuth, requireComplianceOfficer, async (req, res) => {
  try {
    const startTime = Date.now();
    const regulationId = parseInt(req.params.regulationId);
    
    if (isNaN(regulationId)) {
      return res.status(400).json({ error: "Invalid regulation ID" });
    }
    
    const updateData = req.body;
    
    // Remove any fields that shouldn't be updated directly
    const { id, version_number, version_date, ...safeUpdateData } = updateData;
    
    // Add timestamp for last_updated
    safeUpdateData.last_updated = new Date().toISOString();
    
    const tenantStorage = getDatabaseStorage();
    const updatedRegulation = await tenantStorage.updateRegulation(regulationId, safeUpdateData);
    
    const totalTime = Date.now() - startTime;
    
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
      `Updated regulation ${regulationId} in ${totalTime}ms`);
    
    res.json(updatedRegulation);
  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Failed to update regulation", {
      error: error instanceof Error ? error.message : String(error)
    });
    
    res.status(500).json({ 
      error: "Failed to update regulation", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

// Update regulation category - requires admin
router.patch("/:regulationId/category", requireAuth, async (req: any, res) => {
  try {
    const regulationId = parseInt(req.params.regulationId);
    const { category } = req.body;
    
    if (isNaN(regulationId)) {
      return res.status(400).json({ error: "Invalid regulation ID" });
    }
    
    if (!category) {
      return res.status(400).json({ error: "Category is required" });
    }
    
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: "Admin access required" });
    }
    
    const tenantStorage = getDatabaseStorage();
    const updatedRegulation = await tenantStorage.updateRegulation(regulationId, { category });
    
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
      `Updated category for regulation ${regulationId} to ${category}`);
    
    res.json(updatedRegulation);
  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Failed to update category", {
      error: error instanceof Error ? error.message : String(error)
    });
    res.status(500).json({ error: "Failed to update category" });
  }
});

// Update regulation owner (assign to user) - requires admin
router.patch("/:regulationId/owner", requireAuth, async (req: any, res) => {
  try {
    const regulationId = parseInt(req.params.regulationId);
    const { ownerId } = req.body;
    
    if (isNaN(regulationId)) {
      return res.status(400).json({ error: "Invalid regulation ID" });
    }
    
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: "Admin access required" });
    }
    
    const tenantStorage = getDatabaseStorage();
    
    // Allow null to unassign
    const ownerValue = ownerId === null || ownerId === '' ? null : parseInt(ownerId);
    
    const updatedRegulation = await tenantStorage.updateRegulation(regulationId, { 
      ownerId: ownerValue 
    });
    
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
      `Updated owner for regulation ${regulationId} to user ${ownerValue || 'unassigned'}`);
    
    res.json(updatedRegulation);
  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Failed to update owner", {
      error: error instanceof Error ? error.message : String(error)
    });
    res.status(500).json({ error: "Failed to update owner" });
  }
});

// Update a regulation action - requires compliance officer or admin
router.patch("/:regulationId/actions/:actionType", requireAuth, requireComplianceOfficer, ...auditRegulationAction(), async (req, res) => {
  try {
    console.log('🔧 PATCH /actions endpoint hit');
    console.log('   User authenticated:', req.isAuthenticated());
    console.log('   User:', req.user?.username);
    console.log('   Params:', req.params);
    console.log('   Body:', req.body);
    
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
    
    // Use direct database storage for single-tenant mode
    const tenantStorage = getDatabaseStorage();
    
    // Get current regulation
    const regulation = await tenantStorage.getRegulation(regulationId);
    if (!regulation) {
      return res.status(404).json({ error: "Regulation not found" });
    }
    
    // Update the specific action in the actions array
    const actions = regulation.actions || [];
    const actionIndex = actions.findIndex(action => action.type === actionType);
    
    // Store the previous status for logging (for future use)
    // const previousStatus = actionIndex !== -1 ? actions[actionIndex].status : 'not_exists';
    
    if (actionIndex === -1) {
      // Action doesn't exist, create it
      actions.push({
        type: actionType as 'attestation' | 'website_publish' | 'community_communication' | 'agency_submission',
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
        type: actionType as 'attestation' | 'website_publish' | 'community_communication' | 'agency_submission' // Ensure type doesn't change
      };
    }
    
    // Update the regulation with the new actions
    await tenantStorage.updateRegulation(regulationId, { actions });
    
    const totalTime = Date.now() - startTime;
    
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Updated action ${actionType} for regulation ${regulationId} in ${totalTime}ms`);

    res.json({ 
      success: true, 
      action: actions[actionIndex !== -1 ? actionIndex : actions.length - 1] 
    });
  } catch (error) {
    console.error('❌ PATCH actions error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, `Failed to update regulation action: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({ 
      error: "Failed to update action", 
      details: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
  }
});

export default router; 