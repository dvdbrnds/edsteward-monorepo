import express from 'express';
import { syslog, LogLevel, LogFacility } from '../../services/syslog';
import { storage } from '../../storage';

const router = express.Router();

// Public routes for Board of Trustees view-only dashboard
router.get('/regulations', async (req, res) => {
  try {
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, "Public access: Fetching regulations from storage");
    const regulations = await storage.getRegulations();
    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Public access: Found ${regulations.length} regulations`);

    // Only return necessary fields for public view
    const publicRegulations = regulations.map(reg => ({
      id: reg.id,
      itemId: reg.itemId,
      name: reg.name,
      topic: reg.topic,
      statute: reg.statute,
      statuteIds: reg.statuteIds,
      summary: reg.summary,
      category: reg.category,
      jurisdiction: reg.jurisdiction,
      isApplicable: reg.isApplicable,
      effectiveDate: reg.effectiveDate,
      lastUpdated: reg.lastUpdated,
      lastVerified: reg.lastVerified,
      nextReviewDate: reg.nextReviewDate,
      agency_name: reg.agency_name,
      agency_department: reg.agency_department
    }));

    return res.json(publicRegulations);
  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
      `Public access: Failed to fetch regulations - ${error instanceof Error ? error.message : String(error)}`);
    return res.status(500).json({ 
      error: "Failed to fetch regulations", 
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Public endpoint to fetch individual regulation by ID
router.get('/regulations/:regulationId', async (req, res) => {
  try {
    const { regulationId } = req.params;

    if (!regulationId) {
      return res.status(400).json({ error: "Regulation ID is required" });
    }

    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Public access: Fetching regulation with ID: ${regulationId}`);

    try {
      const regulation = await storage.getRegulationById(regulationId);

      if (!regulation) {
        syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, `Public access: Regulation not found with ID: ${regulationId}`);
        return res.status(404).json({ error: "Regulation not found" });
      }

      // Only return necessary fields for public view
      const publicRegulation = {
        id: regulation.id,
        itemId: regulation.itemId,
        name: regulation.name,
        topic: regulation.topic,
        statute: regulation.statute,
        statuteIds: regulation.statuteIds,
        summary: regulation.summary,
        requirements: regulation.requirements,
        category: regulation.category,
        jurisdiction: regulation.jurisdiction,
        isApplicable: regulation.isApplicable,
        effectiveDate: regulation.effectiveDate,
        lastUpdated: regulation.lastUpdated,
        lastVerified: regulation.lastVerified,
        nextReviewDate: regulation.nextReviewDate,
        agency_name: regulation.agency_name,
        agency_department: regulation.agency_department,
        agency_url: regulation.agency_url,
        regulationUrl: regulation.regulationUrl,
        requirementsUrl: regulation.requirementsUrl,
        submissionGuidelines: regulation.submissionGuidelines
      };

      syslog.log(LogFacility.LOCAL0, LogLevel.INFO, `Public access: Found regulation: ${regulation.name || regulation.topic}`);
      return res.json(publicRegulation);
    } catch (dbError) {
      syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
        `Public access: Database error fetching regulation ${regulationId} - ${dbError instanceof Error ? dbError.message : String(dbError)}`);
      return res.status(500).json({ 
        error: "Database error fetching regulation",
        details: dbError instanceof Error ? dbError.message : String(dbError)
      });
    }
  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
      `Public access: Error fetching regulation by ID ${req.params.regulationId} - ${error instanceof Error ? error.message : String(error)}`);
    return res.status(500).json({ 
      error: "Failed to fetch regulation", 
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router; 