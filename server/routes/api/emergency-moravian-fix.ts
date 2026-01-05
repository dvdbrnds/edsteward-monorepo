import express from 'express';
import { storage } from '../../storage';

const router = express.Router();

// Emergency endpoint to bypass broken multi-tenant service for Moravian tenant
router.get('/regulations', async (req, res) => {
  try {
    
    // Use direct storage instead of broken getTenantStorage()
    const regulations = await storage.getRegulations();
    
    
    // Apply same filtering logic as original API
    const {
      jurisdiction,
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

    let filteredRegulations = regulations;
    
    // Apply filters (same as original regulations API)
    if (jurisdiction && typeof jurisdiction === 'string') {
      filteredRegulations = filteredRegulations.filter((reg: any) => reg.jurisdictionSource === jurisdiction);
    }
    
    if (jurisdictionSource && typeof jurisdictionSource === 'string') {
      filteredRegulations = filteredRegulations.filter((reg: any) => reg.jurisdictionSource === jurisdictionSource);
    }
    
    if (category && typeof category === 'string') {
      filteredRegulations = filteredRegulations.filter((reg: any) => reg.category === category);
    }
    
    if (applicable && typeof applicable === 'string') {
      const isApplicable = applicable === 'true';
      filteredRegulations = filteredRegulations.filter((reg: any) => reg.isApplicable === isApplicable);
    }

    // Apply sorting (simplified)
    filteredRegulations.sort((a: any, b: any) => {
      const aVal = a[sortBy as string];
      const bVal = b[sortBy as string];
      
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
    
    const paginatedRegulations = filteredRegulations.slice(offset, offset + limitNum);
    
    res.json(paginatedRegulations);
  } catch (error) {
    console.error('🚨 [EMERGENCY] Direct storage access failed:', error);
    res.status(500).json({ 
      error: "Emergency fix failed", 
      details: error instanceof Error ? error.message : String(error),
      note: "This is an emergency bypass for broken multi-tenant service"
    });
  }
});

export { router as emergencyMoravianRouter }; 