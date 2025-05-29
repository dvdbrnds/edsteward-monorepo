import express from 'express';
import { storage } from '../../storage';
import { syslog, LogLevel, LogFacility } from '../../services/syslog';

const router = express.Router();

// Simple auth middleware (we'll improve this later)
const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

// Get all regulations (authenticated)
router.get("/", requireAuth, async (req, res) => {
  try {
    const startTime = Date.now();
    
    // Parse query parameters
    const {
      jurisdiction,
      category,
      search,
      applicable,
      sortBy = 'lastUpdated',
      sortOrder = 'desc',
      page = '1',
      limit = '50'
    } = req.query;

    let regulations = await storage.getRegulations();
    
    // Apply filters
    if (jurisdiction && typeof jurisdiction === 'string') {
      regulations = regulations.filter(reg => reg.jurisdiction === jurisdiction);
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
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10)));
    const offset = (pageNum - 1) * limitNum;
    
    const paginatedRegulations = regulations.slice(offset, offset + limitNum);
    
    const totalTime = Date.now() - startTime;
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Fetched ${paginatedRegulations.length} regulations in ${totalTime}ms`);

    res.json({
      regulations: paginatedRegulations,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: regulations.length,
        pages: Math.ceil(regulations.length / limitNum)
      }
    });
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
router.get("/:regulationId", requireAuth, async (req, res) => {
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

export { router as regulationsRouter }; 