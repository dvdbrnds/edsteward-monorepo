import { Router } from 'express';
import { hecvatReport, getComplianceSummary } from '../../data/hecvat-responses';

const router = Router();

/**
 * GET /api/compliance/hecvat
 * Returns the full HECVAT response data
 */
router.get('/hecvat', (req, res) => {
  try {
    res.json({
      success: true,
      report: hecvatReport,
    });
  } catch (error) {
    console.error('Error fetching HECVAT report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch HECVAT report',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

/**
 * GET /api/compliance/hecvat/summary
 * Returns a summary of HECVAT compliance status by section
 */
router.get('/hecvat/summary', (req, res) => {
  try {
    const summary = getComplianceSummary();
    res.json({
      success: true,
      summary,
    });
  } catch (error) {
    console.error('Error fetching HECVAT summary:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch HECVAT summary',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
