/**
 * Console Version Control API Routes
 * 
 * Provides API endpoints for managing gold standard console versions.
 * These endpoints power the version control UI in regulation consoles.
 */

import express from 'express';
import ConsoleVersionRegistry from '../services/console-version-registry.js';

const router = express.Router();

/**
 * GET /api/console-versions/:regKey
 * Get version info for a regulation
 */
router.get('/:regKey', async (req, res) => {
    try {
        const { regKey } = req.params;
        
        const active = await ConsoleVersionRegistry.getActive(regKey);
        const versions = await ConsoleVersionRegistry.listVersions(regKey);
        
        res.json({
            success: true,
            regKey,
            active: active || null,
            versions: versions,
            hasGoldStandard: active !== null && active.status === 'gold'
        });
    } catch (err) {
        console.error(`[ConsoleVersions] Error getting versions for ${req.params.regKey}:`, err);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

/**
 * GET /api/console-versions/:regKey/active
 * Get the currently active gold version
 */
router.get('/:regKey/active', async (req, res) => {
    try {
        const { regKey } = req.params;
        const active = await ConsoleVersionRegistry.getActive(regKey);
        
        if (!active) {
            return res.json({
                success: true,
                active: null,
                message: 'No active gold version'
            });
        }
        
        res.json({
            success: true,
            active
        });
    } catch (err) {
        console.error(`[ConsoleVersions] Error getting active version:`, err);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

/**
 * POST /api/console-versions/:regKey/certify
 * Certify current console as new gold version
 */
router.post('/:regKey/certify', async (req, res) => {
    try {
        const { regKey } = req.params;
        const { workflowResults, certifiedBy, notes } = req.body;
        
        const result = await ConsoleVersionRegistry.certifyGold(
            regKey,
            workflowResults || {},
            certifiedBy || 'console-ui',
            notes || ''
        );
        
        res.json({
            success: true,
            message: `${regKey} ${result.version} certified as GOLD`,
            result
        });
    } catch (err) {
        console.error(`[ConsoleVersions] Error certifying ${req.params.regKey}:`, err);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

/**
 * POST /api/console-versions/:regKey/rollback
 * Rollback to a previous gold version
 */
router.post('/:regKey/rollback', async (req, res) => {
    try {
        const { regKey } = req.params;
        const { targetVersion, performedBy, reason } = req.body;
        
        if (!targetVersion) {
            return res.status(400).json({
                success: false,
                error: 'targetVersion is required'
            });
        }
        
        const result = await ConsoleVersionRegistry.rollback(
            regKey,
            targetVersion,
            performedBy || 'console-ui',
            reason || ''
        );
        
        res.json({
            success: true,
            message: `${regKey} rolled back to ${targetVersion}`,
            result
        });
    } catch (err) {
        console.error(`[ConsoleVersions] Error rolling back ${req.params.regKey}:`, err);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

/**
 * GET /api/console-versions/:regKey/verify
 * Verify integrity of active or specified version
 */
router.get('/:regKey/verify', async (req, res) => {
    try {
        const { regKey } = req.params;
        const { version } = req.query;
        
        let targetVersion = version;
        if (!targetVersion) {
            const active = await ConsoleVersionRegistry.getActive(regKey);
            if (!active) {
                return res.json({
                    success: false,
                    error: 'No active version to verify'
                });
            }
            targetVersion = active.version;
        }
        
        const result = await ConsoleVersionRegistry.verifyIntegrity(regKey, targetVersion);
        
        res.json({
            success: true,
            verification: result
        });
    } catch (err) {
        console.error(`[ConsoleVersions] Error verifying ${req.params.regKey}:`, err);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

/**
 * GET /api/console-versions/:regKey/audit
 * Get audit history for a regulation
 */
router.get('/:regKey/audit', async (req, res) => {
    try {
        const { regKey } = req.params;
        const limit = parseInt(req.query.limit) || 50;
        
        const history = await ConsoleVersionRegistry.getAuditHistory(regKey, limit);
        
        res.json({
            success: true,
            regKey,
            auditHistory: history
        });
    } catch (err) {
        console.error(`[ConsoleVersions] Error getting audit history:`, err);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

/**
 * GET /api/console-versions
 * List all active gold standards
 */
router.get('/', async (req, res) => {
    try {
        const allActive = await ConsoleVersionRegistry.getAllActive();
        
        res.json({
            success: true,
            goldStandards: allActive,
            count: allActive.length
        });
    } catch (err) {
        console.error('[ConsoleVersions] Error getting all active:', err);
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

export default router;
