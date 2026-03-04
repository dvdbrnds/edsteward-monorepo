/**
 * USC Text API Routes - Serves real USC 17 Section 110 and related content
 * Replaces hardcoded legal text with dynamic, up-to-date content
 */

const express = require('express');
const router = express.Router();
const USCTextService = require('../services/USCTextService');

// Initialize USC service
const uscService = new USCTextService();

/**
 * GET /api/usc/17/110 - Real USC 17 Section 110 (TEACH Act)
 */
router.get('/17/110', async (req, res) => {
  try {
    console.log('📖 API request for real USC 17 Section 110...');
    
    const uscData = await uscService.fetchUSC17Section110();
    
    res.json({
      success: true,
      data: uscData,
      timestamp: new Date().toISOString(),
      source: 'USCTextService'
    });

    console.log(`✅ Served real USC 17 Section 110 (confidence: ${uscData.metadata.confidence}%)`);

  } catch (error) {
    console.error('❌ USC API error:', error.message);
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch real USC text',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/usc/17/112 - Real USC 17 Section 112(f) (Ephemeral Recordings)
 */
router.get('/17/112', async (req, res) => {
  try {
    console.log('📖 API request for real USC 17 Section 112(f)...');
    
    const uscData = await uscService.fetchUSC17Section112();
    
    res.json({
      success: true,
      data: uscData,
      timestamp: new Date().toISOString(),
      source: 'USCTextService'
    });

    console.log(`✅ Served real USC 17 Section 112(f)`);

  } catch (error) {
    console.error('❌ USC 112 API error:', error.message);
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch real USC 112 text',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/usc/17/110/subsection/:number - Specific TEACH Act subsection
 */
router.get('/17/110/subsection/:number', async (req, res) => {
  try {
    const subsectionNumber = req.params.number;
    console.log(`📖 API request for USC 17 Section 110(${subsectionNumber})...`);
    
    const uscData = await uscService.fetchUSC17Section110();
    const subsection = uscData.subsections.find(s => s.number === `(${subsectionNumber})`);
    
    if (!subsection) {
      return res.status(404).json({
        success: false,
        error: `Subsection (${subsectionNumber}) not found`,
        availableSubsections: uscData.subsections.map(s => s.number),
        timestamp: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      data: {
        ...subsection,
        parentSection: uscData.section,
        parentTitle: uscData.title,
        source: uscData.source,
        metadata: uscData.metadata
      },
      timestamp: new Date().toISOString(),
      source: 'USCTextService'
    });

    console.log(`✅ Served USC 17 Section 110(${subsectionNumber})`);

  } catch (error) {
    console.error('❌ USC subsection API error:', error.message);
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch USC subsection',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * POST /api/usc/refresh - Force refresh of USC data (clear cache)
 */
router.post('/refresh', async (req, res) => {
  try {
    console.log('🔄 Forcing USC cache refresh...');
    
    uscService.clearCache();
    
    // Fetch fresh data
    const uscData = await uscService.fetchUSC17Section110();
    
    res.json({
      success: true,
      message: 'USC data refreshed successfully',
      data: {
        section: uscData.section,
        lastUpdated: uscData.lastUpdated,
        source: uscData.source,
        confidence: uscData.metadata.confidence
      },
      timestamp: new Date().toISOString()
    });

    console.log('✅ USC cache refreshed and new data fetched');

  } catch (error) {
    console.error('❌ USC refresh error:', error.message);
    
    res.status(500).json({
      success: false,
      error: 'Failed to refresh USC data',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /api/usc/status - USC service health check
 */
router.get('/status', async (req, res) => {
  try {
    const status = {
      service: 'USCTextService',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      endpoints: [
        '/api/usc/17/110',
        '/api/usc/17/112',
        '/api/usc/17/110/subsection/:number',
        '/api/usc/refresh',
        '/api/usc/status'
      ],
      cacheStatus: 'active',
      lastFetch: 'Available via /api/usc/17/110'
    };

    res.json({
      success: true,
      data: status
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'USC service unavailable',
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
