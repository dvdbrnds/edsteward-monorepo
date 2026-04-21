import express from 'express';
import { getDatabaseStorage } from '../../services/database';
import { syslog, LogLevel, LogFacility } from '../../services/syslog';

// Simple auth middleware
const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

const router = express.Router();

// GET /api/notification-history - Get sent notification history
router.get("/", requireAuth, async (req, res) => {
  try {
    const tenantStorage = getDatabaseStorage(req.tenantId);
    
    // Get query parameters for filtering and sorting
    const { 
      status = 'sent', // Default to sent notifications
      limit = 50,
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Get notification history from notification_queue table
    const notifications = await tenantStorage.getNotificationQueue(status as 'pending' | 'sent' | 'failed');
    
    // Get associated regulation and user data for each notification
    const enrichedNotifications = await Promise.all(
      notifications.map(async (notification) => {
        try {
          const regulation = notification.regulationId ? 
            await tenantStorage.getRegulation(notification.regulationId) : null;
          
          const user = notification.userId ? 
            await tenantStorage.getUser(notification.userId) : null;

          // Parse content if it's JSON
          let parsedContent = notification.content;
          if (typeof notification.content === 'string') {
            try {
              parsedContent = JSON.parse(notification.content);
            } catch {
              // Keep as string if not valid JSON
            }
          }

          return {
            id: notification.id,
            type: notification.type,
            status: notification.status,
            priority: notification.priority,
            content: parsedContent,
            createdAt: notification.createdAt,
            sentAt: notification.sentAt,
            retryCount: notification.retryCount,
            regulation: regulation ? {
              id: regulation.id,
              name: regulation.name,
              category: regulation.category
            } : null,
            user: user ? {
              id: user.id,
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email
            } : null
          };
        } catch (error) {
          syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, 
            `Failed to enrich notification ${notification.id}: ${error}`);
          
          return {
            id: notification.id,
            type: notification.type,
            status: notification.status,
            priority: notification.priority,
            content: notification.content,
            createdAt: notification.createdAt,
            sentAt: notification.sentAt,
            retryCount: notification.retryCount,
            regulation: null,
            user: null
          };
        }
      })
    );

    // Apply sorting
    enrichedNotifications.sort((a, b) => {
      let aValue: any = (a as any)[sortBy as string];
      let bValue: any = (b as any)[sortBy as string];
      
      if (sortBy === 'createdAt' || sortBy === 'sentAt') {
        aValue = new Date(aValue as string).getTime();
        bValue = new Date(bValue as string).getTime();
      }
      
      if (sortOrder === 'desc') {
        return bValue > aValue ? 1 : -1;
      } else {
        return aValue > bValue ? 1 : -1;
      }
    });

    // Apply pagination
    const startIndex = parseInt(offset as string);
    const endIndex = startIndex + parseInt(limit as string);
    const paginatedNotifications = enrichedNotifications.slice(startIndex, endIndex);

    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
      `Retrieved ${paginatedNotifications.length} notification history items`);
    
    res.json({
      notifications: paginatedNotifications,
      total: enrichedNotifications.length,
      offset: startIndex,
      limit: parseInt(limit as string)
    });
  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
      `Failed to get notification history: ${error instanceof Error ? error.message : String(error)}`);
    
    res.status(500).json({ 
      error: "Failed to get notification history", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

// GET /api/notification-history/stats - Get notification statistics
router.get("/stats", requireAuth, async (req, res) => {
  try {
    const tenantStorage = getDatabaseStorage(req.tenantId);
    
    // Get all notifications for stats
    const allNotifications = await tenantStorage.getNotificationQueue();
    
    const stats = {
      total: allNotifications.length,
      sent: allNotifications.filter(n => n.status === 'sent').length,
      pending: allNotifications.filter(n => n.status === 'pending').length,
      failed: allNotifications.filter(n => n.status === 'failed').length,
      lastSent: allNotifications
        .filter(n => n.sentAt)
        .sort((a, b) => new Date(b.sentAt!).getTime() - new Date(a.sentAt!).getTime())[0]?.sentAt || null,
      byType: allNotifications.reduce((acc, n) => {
        acc[n.type] = (acc[n.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byPriority: allNotifications.reduce((acc, n) => {
        acc[n.priority] = (acc[n.priority] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };

    res.json(stats);
  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
      `Failed to get notification stats: ${error instanceof Error ? error.message : String(error)}`);
    
    res.status(500).json({ 
      error: "Failed to get notification stats", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

// POST /api/notification-history/send - Send a new notification
router.post("/send", requireAuth, async (req, res) => {
  try {
    const tenantStorage = getDatabaseStorage(req.tenantId);
    const { 
      type, 
      title, 
      message, 
      priority = 'normal', 
      recipients, 
      regulationId,
      sendImmediately = true 
    } = req.body;

    // Validate required fields
    if (!type || !title || !message || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ 
        error: "Missing required fields: type, title, message, and recipients array" 
      });
    }

    // Validate priority
    if (!['high', 'normal', 'low'].includes(priority)) {
      return res.status(400).json({ 
        error: "Priority must be 'high', 'normal', or 'low'" 
      });
    }

    // Get regulation if specified
    let regulation = null;
    if (regulationId) {
      try {
        regulation = await tenantStorage.getRegulation(regulationId);
        if (!regulation) {
          return res.status(404).json({ error: "Regulation not found" });
        }
      } catch (error) {
        syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, 
          `Failed to fetch regulation ${regulationId}: ${error}`);
      }
    }

    // Get all users to validate recipients
    const allUsers = await tenantStorage.getAllUsers();
    const validRecipients = [];
    const invalidRecipients = [];

    for (const recipientId of recipients) {
      const user = allUsers.find(u => u.id === recipientId);
      if (user) {
        validRecipients.push(user);
      } else {
        invalidRecipients.push(recipientId);
      }
    }

    if (validRecipients.length === 0) {
      return res.status(400).json({ 
        error: "No valid recipients found",
        invalidRecipients 
      });
    }

    if (invalidRecipients.length > 0) {
      syslog.log(LogFacility.LOCAL0, LogLevel.WARNING, 
        `Invalid recipient IDs: ${invalidRecipients.join(', ')}`);
    }

    const createdNotifications = [];
    const emailPromises = [];

    // Create notification queue entries for each recipient
    for (const recipient of validRecipients) {
      const notificationContent = {
        title,
        message,
        type,
        priority,
        createdBy: req.user?.id || 'system',
        createdByName: req.user ? `${req.user.firstName} ${req.user.lastName}` : 'System',
        regulation: regulation ? {
          id: regulation.id,
          name: regulation.name,
          category: regulation.category
        } : null
      };

      // Create notification queue entry
      const queueItem = await tenantStorage.createNotificationQueueItem({
        regulationId: regulationId || null,
        userId: recipient.id,
        type: type,
        content: notificationContent,
        status: 'pending' as const,
        priority: priority,
        retryCount: 0
      });

      createdNotifications.push({
        id: queueItem.id,
        recipient: {
          id: recipient.id,
          name: `${recipient.firstName} ${recipient.lastName}`,
          email: recipient.email
        }
      });

      // If sending immediately, prepare email
      if (sendImmediately) {
        const emailSubject = `${priority === 'high' ? '[URGENT] ' : ''}${title}`;
        
        const emailContent = `
          <h2>📧 EdSteward Notification</h2>
          <div style="background-color: ${priority === 'high' ? '#fee2e2' : priority === 'normal' ? '#f0f9ff' : '#f8f9fa'}; 
                      border-left: 4px solid ${priority === 'high' ? '#dc2626' : priority === 'normal' ? '#0284c7' : '#6b7280'}; 
                      padding: 15px; margin: 20px 0;">
            <h3>${title}</h3>
            <p>${message.replace(/\n/g, '<br>')}</p>
            
            ${regulation ? `
              <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e5e7eb;">
                <p><strong>Related Regulation:</strong> ${regulation.name}</p>
                <p><strong>Category:</strong> ${regulation.category}</p>
                <p style="text-align: center; margin: 20px 0;">
                  <a href="${process.env.BASE_URL || 'http://localhost:3000'}/regulations/${regulation.id}" 
                     style="background-color: #0284c7; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                    📖 View Regulation Details
                  </a>
                </p>
              </div>
            ` : ''}
          </div>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-top: 20px;">
            <p style="margin: 0; font-size: 12px; color: #6c757d;">
              📧 This notification was sent by: ${req.user ? `${req.user.firstName} ${req.user.lastName} (${req.user.email})` : 'EdSteward System'}
              <br>
              🔧 EdSteward Compliance Management System
            </p>
          </div>
        `;

        // Import email service dynamically
        try {
          const { emailService } = await import('../../services/email');
          const tracking = {
            emailType: 'manual_notification' as const,
            relatedEntityType: regulationId ? 'regulation' as const : undefined,
            relatedEntityId: regulationId || undefined,
            recipientUserId: recipient.id,
          };
          emailPromises.push(
            emailService.sendEmailTracked(recipient.email, emailSubject, emailContent, undefined, tracking)
              .then((result) => {
                if (result.success) {
                  return tenantStorage.markNotificationAsSent(queueItem.id);
                } else {
                  syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
                    `Email delivery failed for ${recipient.email}: ${result.errorMessage}`);
                  return tenantStorage.updateNotificationQueueItem(queueItem.id, { 
                    status: 'failed',
                    retryCount: 1
                  });
                }
              })
              .catch(error => {
                syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
                  `Failed to send email to ${recipient.email}: ${error}`);
                return tenantStorage.updateNotificationQueueItem(queueItem.id, { 
                  status: 'failed',
                  retryCount: 1
                });
              })
          );
        } catch (error) {
          syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
            `Email service not available: ${error}`);
          
          // Mark as failed if email service is not available
          await tenantStorage.updateNotificationQueueItem(queueItem.id, { 
            status: 'failed',
            retryCount: 1
          });
        }
      }
    }

    // Send emails if immediate sending is requested
    if (sendImmediately && emailPromises.length > 0) {
      await Promise.allSettled(emailPromises);
    }

    syslog.log(LogFacility.LOCAL0, LogLevel.INFO, 
      `Created ${createdNotifications.length} notifications of type '${type}' with priority '${priority}'`);

    res.status(201).json({
      message: `Successfully created ${createdNotifications.length} notification(s)`,
      notifications: createdNotifications,
      invalidRecipients: invalidRecipients.length > 0 ? invalidRecipients : undefined,
      status: sendImmediately ? 'sent' : 'draft'
    });

  } catch (error) {
    syslog.log(LogFacility.LOCAL0, LogLevel.ERROR, 
      `Failed to send notification: ${error instanceof Error ? error.message : String(error)}`);
    
    res.status(500).json({ 
      error: "Failed to send notification", 
      details: error instanceof Error ? error.message : String(error) 
    });
  }
});

export default router;
