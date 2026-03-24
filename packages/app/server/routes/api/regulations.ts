import express from 'express';
import fs from 'fs';
import { storage } from '../../storage';
import { getDatabaseStorage, getDbForRequest } from '../../services/database';
import { evidenceFiles, disabledRegulations, regulationFeedback, regulations as regulationsTable, deadlines } from '@shared/schema';
import { eq, and, sql, desc, inArray, gt, ne } from 'drizzle-orm';
import { syslog, LogLevel, LogFacility } from '../../services/syslog';
import type { Regulation } from '@shared/schema';
import { 
  requireAuth, 
  requireComplianceOfficer,
  requireAdmin,
  attachUserPermissions
} from '../../middleware/role-based-auth';
import { auditRegulationAction, auditEvidence as _auditEvidence } from '../../middleware/audit-middleware';
import multer from 'multer';
import { uploadLimiter } from '../../middleware/rate-limiter';

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
    const tenantStorage = getDatabaseStorage(req.tenantId);
    
    // Get user info for filtering
    const user = req.user;
    const isAdmin = user?.role === 'admin';
    const isComplianceOfficer = user?.role === 'compliance_officer';
    
    
    // Parse query parameters
    const {
      jurisdiction, // Legacy support
      jurisdictionSource,
      institutionType,
      institutionTypes, // comma-separated list of types for multi-type filtering
      category,
      search,
      applicable,
      sortBy = 'lastUpdated',
      sortOrder = 'desc',
      page = '1',
      limit = '1000'
    } = req.query;

    let regulations = await tenantStorage.getRegulations();
    
    // Filter out disabled regulations (unless explicitly requested)
    const includeDisabled = req.query.includeDisabled === 'true';
    if (!includeDisabled) {
      try {
        const db = getDbForRequest(req);
        const disabled = await db.select({ regulationId: disabledRegulations.regulationId }).from(disabledRegulations);
        const disabledIds = new Set(disabled.map(d => d.regulationId));
        if (disabledIds.size > 0) {
          regulations = regulations.filter((reg: Regulation) => !disabledIds.has(reg.id));
        }
      } catch (_e) {
        // Table may not exist yet — skip filtering
      }
    }
    
    // Filter by ownership for compliance officers (admins see all)
    // CCOs see their assigned regulations PLUS any regulation with a deadline in the next 30 days
    if (user && isComplianceOfficer && !isAdmin) {
      let urgentRegulationIds = new Set<number>();
      try {
        const db = getDbForRequest(req);
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        const urgentDeadlines = await db.select({ regulationId: deadlines.regulationId })
          .from(deadlines)
          .where(and(
            ne(deadlines.status, 'completed'),
            sql`${deadlines.dueDate} <= ${thirtyDaysFromNow.toISOString().split('T')[0]}`
          ));
        urgentRegulationIds = new Set(urgentDeadlines.map(d => d.regulationId));
      } catch (_e) {
        // deadlines table may not exist — skip
      }

      regulations = regulations.filter((reg: any) => {
        const ownerId = reg.ownerId ?? reg.owner_id;
        return ownerId === user.id || urgentRegulationIds.has(reg.id);
      });
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
    
    // Multi-type institution filter (comma-separated)
    // Maps new two-tier taxonomy slugs to legacy regulation data slugs
    const INSTITUTION_TYPE_ALIASES: Record<string, string[]> = {
      'private-nonprofit-4year': ['private-universities'],
      'private-nonprofit-2year': ['private-universities'],
      'public-4year': ['public-universities'],
      'public-2year': ['community-colleges'],
      'private-for-profit': ['for-profit-institutions'],
      'graduate-professional': ['professional-schools'],
      'religious-affiliation': ['religious-institutions'],
      'research-intensive': ['research-institutions', 'research-institutes'],
    };
    if (institutionTypes && typeof institutionTypes === 'string') {
      const rawTypes = institutionTypes.split(',').map(t => t.trim()).filter(Boolean);
      const types = new Set(rawTypes);
      for (const t of rawTypes) {
        const aliases = INSTITUTION_TYPE_ALIASES[t];
        if (aliases) aliases.forEach(a => types.add(a));
      }
      if (types.size > 0) {
        regulations = regulations.filter((reg: Regulation) => {
          const institutions = Array.isArray(reg.applicableInstitutions)
            ? reg.applicableInstitutions
            : [];
          if (institutions.length === 0) return true;
          if (institutions.includes('all-institutions')) return true;
          return [...types].some(t => institutions.includes(t));
        });
      }
    }
    // Legacy single institution type filter
    else if (institutionType && typeof institutionType === 'string') {
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
    const tenantStorage = getDatabaseStorage(req.tenantId);
    
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
router.get("/:regulationId", async (req: any, res) => {
  try {
    const startTime = Date.now();
    const regulationId = parseInt(req.params.regulationId);
    
    if (isNaN(regulationId)) {
      return res.status(400).json({ error: "Invalid regulation ID" });
    }
    
    // Use direct database storage for single-tenant mode
    const tenantStorage = getDatabaseStorage(req.tenantId);
    
    const regulation = await tenantStorage.getRegulation(regulationId);
    
    if (!regulation) {
      return res.status(404).json({ error: "Regulation not found" });
    }

    // Add ownership info if user is authenticated
    const user = req.user;
    const ownerId = (regulation as any).ownerId ?? (regulation as any).owner_id;
    const isOwner = user ? user.id === ownerId : false;
    
    // Return regulation with ownership info
    const regulationWithOwnership = {
      ...regulation,
      isOwner, // true if current user is the Primary DRI for this regulation
      ownerId: ownerId || null,
    };

    const totalTime = Date.now() - startTime;
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Fetched regulation ${regulationId} in ${totalTime}ms`);

    res.json(regulationWithOwnership);
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

    const tenantStorage = getDatabaseStorage(req.tenantId);
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
    const tenantStorage = getDatabaseStorage(req.tenantId);
    
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
router.post("/:regulationId/evidence", uploadLimiter, requireAuth, upload.single('file'), async (req, res) => {
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
      const tenantStorage = getDatabaseStorage(req.tenantId);
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

// Delete evidence file for a regulation - admin only
router.delete("/:regulationId/evidence/:evidenceId", requireAuth, requireAdmin, async (req, res) => {
  try {
    // TENANT ISOLATION: Get tenant-specific database
    const db = getDbForRequest(req);
    
    const regulationId = parseInt(req.params.regulationId);
    const evidenceId = parseInt(req.params.evidenceId);

    if (isNaN(regulationId) || isNaN(evidenceId)) {
      return res.status(400).json({ error: "Invalid regulation ID or evidence ID" });
    }

    // Get the evidence file first to get the storage path
    const [existingEvidence] = await db
      .select()
      .from(evidenceFiles)
      .where(and(
        eq(evidenceFiles.id, evidenceId),
        eq(evidenceFiles.regulationId, regulationId)
      ))
      .limit(1);

    if (!existingEvidence) {
      return res.status(404).json({ error: "Evidence file not found" });
    }

    // Delete the file from disk if it exists
    if (existingEvidence.storagePath) {
      try {
        fs.unlinkSync(existingEvidence.storagePath);
        syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
          `Deleted evidence file from disk: ${existingEvidence.storagePath}`);
      } catch (fileError) {
        // Log but don't fail if file doesn't exist
        syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, 
          `Could not delete evidence file from disk: ${existingEvidence.storagePath}`, 
          { error: fileError instanceof Error ? fileError.message : String(fileError) });
      }
    }

    // Delete from database
    await db
      .delete(evidenceFiles)
      .where(eq(evidenceFiles.id, evidenceId));

    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
      `User ${req.user?.username} deleted evidence file ${evidenceId} for regulation ${regulationId}`);

    res.json({ 
      message: "Evidence file deleted successfully",
      deletedId: evidenceId
    });
  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, "Failed to delete evidence file", {
      error: error instanceof Error ? error.message : String(error)
    });
    res.status(500).json({ 
      error: "Failed to delete evidence file",
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
    const { id: _id, version_number: _version_number, version_date: _version_date, ...safeUpdateData } = updateData;
    
    // Add timestamp for last_updated
    safeUpdateData.last_updated = new Date().toISOString();
    
    const tenantStorage = getDatabaseStorage(req.tenantId);
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
    
    const tenantStorage = getDatabaseStorage(req.tenantId);
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
    
    const tenantStorage = getDatabaseStorage(req.tenantId);
    
    // Allow null to unassign
    const ownerValue = ownerId === null || ownerId === '' ? null : parseInt(ownerId);
    
    // Get current regulation to check if owner changed
    const currentRegulation = await tenantStorage.getRegulation(regulationId);
    const previousOwnerId = currentRegulation?.ownerId;
    
    const updatedRegulation = await tenantStorage.updateRegulation(regulationId, { 
      ownerId: ownerValue 
    });
    
    // Create notification for the new owner if assigned (and it's a different user)
    if (ownerValue && ownerValue !== previousOwnerId) {
      try {
        const regulationName = updatedRegulation?.name || updatedRegulation?.topic || `Regulation #${regulationId}`;
        const assignedByName = req.user?.firstName && req.user?.lastName 
          ? `${req.user.firstName} ${req.user.lastName}` 
          : req.user?.username || 'An administrator';
        
        await tenantStorage.createNotificationQueueItem({
          regulationId: regulationId,
          userId: ownerValue,
          type: 'regulation_assigned',
          content: {
            title: 'You have been assigned a regulation',
            message: `${assignedByName} has assigned you as the Primary DRI for "${regulationName}". Please review the regulation and its compliance requirements.`,
            regulationId: regulationId,
            regulationName: regulationName,
            assignedBy: req.user?.id,
            assignedByName: assignedByName
          },
          status: 'pending',
          priority: 'high'
        });
        
        syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
          `Created assignment notification for user ${ownerValue} for regulation ${regulationId}`);
      } catch (notificationError) {
        // Don't fail the main operation if notification fails
        syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, 
          `Failed to create assignment notification: ${notificationError instanceof Error ? notificationError.message : String(notificationError)}`);
      }
    }
    
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
    const tenantStorage = getDatabaseStorage(req.tenantId);
    
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
    
    // Update just the actions JSONB field directly via SQL to avoid
    // serialization issues with the full updateRegulation method
    try {
      const db = tenantStorage.getDb();
      const actionsJson = JSON.stringify(actions);
      await db.execute(
        sql`UPDATE regulations SET actions = ${actionsJson}::jsonb, last_updated = NOW() WHERE id = ${regulationId}`
      );
    } catch (dbError) {
      console.error('❌ DB update failed for actions:', dbError);
      console.error('Regulation ID:', regulationId, 'Action type:', actionType);
      console.error('Actions data:', JSON.stringify(actions, null, 2));
      throw dbError;
    }
    
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

/**
 * POST /api/regulations/:id/submit-to-agency
 * Submit compliance evidence to the regulatory agency
 * This endpoint:
 * 1. Records the submission with timestamp and user info
 * 2. Updates the agency_submission action to 'completed'
 * 3. Logs to audit trail
 */
router.post('/:id/submit-to-agency', requireAuth, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const regulationId = parseInt(req.params.id, 10);
    const userId = (req.user as any)?.id;
    const username = (req.user as any)?.username;
    
    if (!regulationId || isNaN(regulationId)) {
      return res.status(400).json({ error: "Invalid regulation ID" });
    }
    
    if (!userId) {
      return res.status(401).json({ error: "User not authenticated" });
    }
    
    // Get the regulation
    const tenantStorage = getDatabaseStorage(req.tenantId);
    const regulation = await tenantStorage.getRegulation(regulationId);
    
    if (!regulation) {
      return res.status(404).json({ error: "Regulation not found" });
    }
    
    // Get current actions
    const actions = Array.isArray(regulation.actions) ? [...regulation.actions] : [];
    
    // Find or create agency_submission action
    const actionIndex = actions.findIndex(a => a.type === 'agency_submission');
    const submissionDate = new Date();
    
    const completedAction = {
      type: 'agency_submission' as const,
      enabled: true,
      required: true,
      status: 'completed' as const,
      completedDate: submissionDate.toISOString(),
      completedBy: {
        userId,
        username,
      },
      completedAt: submissionDate.toISOString(),
      notes: `Submitted to ${regulation.agency_name || 'agency'} on ${submissionDate.toLocaleDateString()}`,
    };
    
    if (actionIndex === -1) {
      actions.push(completedAction);
    } else {
      actions[actionIndex] = {
        ...actions[actionIndex],
        ...completedAction,
      };
    }
    
    // Update the regulation
    await tenantStorage.updateRegulation(regulationId, { actions });
    
    // Log to audit trail if AuditService is available
    try {
      const { AuditService } = await import('../../services/audit');
      await AuditService.logAction({
        userId,
        userEmail: (req.user as any)?.email || username,
        action: 'agency_submission_completed',
        entityType: 'regulation_action',
        entityId: regulationId.toString(),
        regulationId,
        complianceImpact: true,
        riskLevel: 'low',
        ipAddress: req.ip || 'unknown',
        metadata: {
          agencyName: regulation.agency_name,
          regulationName: regulation.name,
          submittedBy: username,
          submittedAt: submissionDate.toISOString(),
        }
      });
    } catch (auditError) {
      // Log but don't fail the request if audit logging fails
      console.warn('Failed to log agency submission to audit trail:', auditError);
    }
    
    const totalTime = Date.now() - startTime;
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Agency submission completed for regulation ${regulationId} by user ${username} in ${totalTime}ms`);
    
    res.json({
      success: true,
      message: `Successfully submitted to ${regulation.agency_name || 'agency'}`,
      submission: {
        regulationId,
        regulationName: regulation.name,
        agencyName: regulation.agency_name,
        submittedBy: username,
        submittedAt: submissionDate.toISOString(),
        action: completedAction,
      }
    });
  } catch (error) {
    console.error('❌ Agency submission error:', error);
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, `Failed to submit to agency: ${error instanceof Error ? error.message : String(error)}`);
    res.status(500).json({
      error: "Failed to submit to agency",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

// ===== DISABLE/ENABLE REGULATION PER INSTITUTION =====

router.post('/:regulationId/disable', requireAdmin, async (req: any, res) => {
  try {
    const db = getDbForRequest(req);
    const regulationId = parseInt(req.params.regulationId);
    const { reason } = req.body;

    const existing = await db.select().from(disabledRegulations)
      .where(eq(disabledRegulations.regulationId, regulationId))
      .limit(1);

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Regulation is already disabled' });
    }

    const [result] = await db.insert(disabledRegulations).values({
      regulationId,
      disabledBy: req.user!.id,
      reason: reason || null,
    }).returning();

    res.json({ success: true, disabled: result });
  } catch (error) {
    console.error('Error disabling regulation:', error);
    res.status(500).json({ error: 'Failed to disable regulation' });
  }
});

router.post('/:regulationId/enable', requireAdmin, async (req: any, res) => {
  try {
    const db = getDbForRequest(req);
    const regulationId = parseInt(req.params.regulationId);

    await db.delete(disabledRegulations)
      .where(eq(disabledRegulations.regulationId, regulationId));

    res.json({ success: true, regulationId });
  } catch (error) {
    console.error('Error enabling regulation:', error);
    res.status(500).json({ error: 'Failed to enable regulation' });
  }
});

router.get('/:regulationId/disabled', requireAuth, async (req: any, res) => {
  try {
    const db = getDbForRequest(req);
    const regulationId = parseInt(req.params.regulationId);

    const result = await db.select().from(disabledRegulations)
      .where(eq(disabledRegulations.regulationId, regulationId))
      .limit(1);

    res.json({ isDisabled: result.length > 0, record: result[0] || null });
  } catch (error) {
    console.error('Error checking disabled status:', error);
    res.status(500).json({ error: 'Failed to check disabled status' });
  }
});

// ===== REGULATION FEEDBACK =====

router.post('/:regulationId/feedback', requireAuth, async (req: any, res) => {
  try {
    const db = getDbForRequest(req);
    const regulationId = parseInt(req.params.regulationId);
    const { feedbackType, feedbackText } = req.body;

    if (!feedbackText || !feedbackText.trim()) {
      return res.status(400).json({ error: 'Feedback text is required' });
    }

    const [result] = await db.insert(regulationFeedback).values({
      regulationId,
      userId: req.user!.id,
      feedbackType: feedbackType || 'other',
      feedbackText: feedbackText.trim(),
      status: 'pending',
    }).returning();

    res.json({ success: true, feedback: result });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

router.get('/:regulationId/feedback', requireAuth, async (req: any, res) => {
  try {
    const db = getDbForRequest(req);
    const regulationId = parseInt(req.params.regulationId);

    const feedback = await db.select().from(regulationFeedback)
      .where(eq(regulationFeedback.regulationId, regulationId))
      .orderBy(desc(regulationFeedback.createdAt));

    res.json(feedback);
  } catch (error) {
    console.error('Error fetching feedback:', error);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

router.patch('/:regulationId/feedback/:feedbackId', requireAdmin, async (req: any, res) => {
  try {
    const db = getDbForRequest(req);
    const feedbackId = parseInt(req.params.feedbackId);
    const { status, reviewNotes } = req.body;

    const [result] = await db.update(regulationFeedback)
      .set({
        status: status || 'reviewed',
        reviewedBy: req.user!.id,
        reviewedAt: new Date(),
        reviewNotes: reviewNotes || null,
        updatedAt: new Date(),
      })
      .where(eq(regulationFeedback.id, feedbackId))
      .returning();

    res.json({ success: true, feedback: result });
  } catch (error) {
    console.error('Error updating feedback:', error);
    res.status(500).json({ error: 'Failed to update feedback' });
  }
});

export default router;