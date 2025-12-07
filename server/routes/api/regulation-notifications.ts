import express from 'express';
import { getDatabaseStorage } from '../../services/database';
import { syslog } from '../../services/syslog';

// Simple auth middleware
const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

// Role-based auth middleware for compliance officers and admins
const requireComplianceRole = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const user = req.user as any;
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // Check if user has appropriate role
  const hasComplianceRole = 
    user.role === 'admin' ||
    user.role === 'compliance_officer' ||
    user.role === 'cco' ||
    user.role === 'legal' ||
    user.username === 'dvdbrnds' ||
    (user.roles && (
      user.roles.includes('admin') ||
      user.roles.includes('compliance_officer') ||
      user.roles.includes('cco') ||
      user.roles.includes('legal')
    ));
    
  if (!hasComplianceRole) {
    return res.status(403).json({ error: 'Insufficient permissions. Compliance officer role required.' });
  }
  
  next();
};

const router = express.Router();

// POST /api/regulation-notifications/:id/toggle - Toggle notification override for a regulation
router.post("/:id/toggle", requireAuth, requireComplianceRole, async (req, res) => {
  try {
    const regulationId = parseInt(req.params.id);
    const { disabled, reason } = req.body;
    const user = req.user as any;
    
    if (isNaN(regulationId)) {
      return res.status(400).json({ error: 'Invalid regulation ID' });
    }

    const tenantStorage = getDatabaseStorage();
    
    // Get current regulation
    const regulation = await tenantStorage.getRegulationById(regulationId);
    if (!regulation) {
      return res.status(404).json({ error: 'Regulation not found' });
    }

    // Update notification override settings
    const updateData: any = {
      notificationsDisabled: disabled,
      notificationsDisabledBy: disabled ? user.id : null,
      notificationsDisabledAt: disabled ? new Date() : null,
      notificationsDisabledReason: disabled ? reason || 'No reason provided' : null
    };

    await tenantStorage.updateRegulation(regulationId, updateData);

    // Log the action
    await syslog.info(`Notification override ${disabled ? 'enabled' : 'disabled'} for regulation ${regulation.name}`, {
      regulationId,
      regulationName: regulation.name,
      userId: user.id,
      userEmail: user.email,
      disabled,
      reason: reason || 'No reason provided'
    });

    res.json({
      success: true,
      regulation: {
        id: regulationId,
        name: regulation.name,
        notificationsDisabled: disabled,
        notificationsDisabledBy: disabled ? user.id : null,
        notificationsDisabledAt: disabled ? new Date().toISOString() : null,
        notificationsDisabledReason: disabled ? reason || 'No reason provided' : null
      }
    });

  } catch (error) {
    console.error('Error toggling regulation notification override:', error);
    await syslog.error('Failed to toggle regulation notification override', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    res.status(500).json({ error: 'Failed to toggle notification override' });
  }
});

// GET /api/regulation-notifications/:id/status - Get notification override status for a regulation
router.get("/:id/status", requireAuth, async (req, res) => {
  try {
    const regulationId = parseInt(req.params.id);
    
    if (isNaN(regulationId)) {
      return res.status(400).json({ error: 'Invalid regulation ID' });
    }

    const tenantStorage = getDatabaseStorage();
    const regulation = await tenantStorage.getRegulationById(regulationId);
    
    if (!regulation) {
      return res.status(404).json({ error: 'Regulation not found' });
    }

    // Handle both camelCase and snake_case field names (ORM might return either)
    const notificationsDisabled = regulation.notificationsDisabled ?? regulation.notifications_disabled ?? false;
    const notificationsDisabledBy = regulation.notificationsDisabledBy ?? regulation.notifications_disabled_by;
    const notificationsDisabledAt = regulation.notificationsDisabledAt ?? regulation.notifications_disabled_at;
    const notificationsDisabledReason = regulation.notificationsDisabledReason ?? regulation.notifications_disabled_reason;

    // Get user info for disabled by field
    let disabledByUser = null;
    if (notificationsDisabledBy) {
      try {
        disabledByUser = await tenantStorage.getUserById(notificationsDisabledBy);
      } catch (e) {
        console.error('Error fetching user for notification status:', e);
      }
    }

    res.json({
      regulationId,
      regulationName: regulation.name,
      notificationsDisabled: notificationsDisabled,
      notificationsDisabledBy: disabledByUser ? {
        id: disabledByUser.id,
        firstName: disabledByUser.firstName,
        lastName: disabledByUser.lastName,
        email: disabledByUser.email
      } : null,
      notificationsDisabledAt: notificationsDisabledAt,
      notificationsDisabledReason: notificationsDisabledReason
    });

  } catch (error) {
    console.error('Error getting regulation notification status:', error);
    res.status(500).json({ error: 'Failed to get notification status' });
  }
});

export default router;

