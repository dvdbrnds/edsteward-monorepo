/**
 * Executive Orders API Routes
 * 
 * Handles Presidential Executive Orders and their impact on regulations.
 * MCP Engine Integration - January 2026
 */

import { Router, Request, Response } from 'express';
import { eq, desc, sql } from 'drizzle-orm';
import { 
  executiveOrders, 
  eoRegulationImpacts, 
  eoStatusHistory,
  regulations,
  users
} from '../../../shared/schema';
import { requireAuth, requireAdmin } from '../../middleware/role-based-auth';
import { getDbForRequest } from '../../services/database';

const router = Router();

// ===== GET ALL EXECUTIVE ORDERS =====
/**
 * GET /api/executive-orders
 * List all Executive Orders with optional filtering
 * Query params: status, limit, offset
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const db = getDbForRequest(req);
    const { status, limit = '50', offset = '0' } = req.query;
    
    let query = db.select().from(executiveOrders);
    
    if (status && typeof status === 'string') {
      query = query.where(eq(executiveOrders.status, status)) as typeof query;
    }
    
    const eos = await query
      .orderBy(desc(executiveOrders.signedDate))
      .limit(parseInt(limit as string))
      .offset(parseInt(offset as string));
    
    // Get impact counts for each EO
    const eosWithCounts = await Promise.all(eos.map(async (eo) => {
      const impacts = await db.select({
        count: sql<number>`count(*)`,
        criticalCount: sql<number>`count(*) filter (where impact_severity = 'critical')`,
        highCount: sql<number>`count(*) filter (where impact_severity = 'high')`,
      })
      .from(eoRegulationImpacts)
      .where(eq(eoRegulationImpacts.eoId, eo.id));
      
      return {
        ...eo,
        impactCount: Number(impacts[0]?.count || 0),
        criticalCount: Number(impacts[0]?.criticalCount || 0),
        highCount: Number(impacts[0]?.highCount || 0),
      };
    }));
    
    res.json(eosWithCounts);
  } catch (error) {
    console.error('Error fetching executive orders:', error);
    res.status(500).json({ error: 'Failed to fetch executive orders' });
  }
});

// ===== GET SINGLE EXECUTIVE ORDER =====
/**
 * GET /api/executive-orders/:eoNumber
 * Get a single EO by number (e.g., "EO 14322")
 */
router.get('/:eoNumber', requireAuth, async (req: Request, res: Response) => {
  try {
    const db = getDbForRequest(req);
    const { eoNumber } = req.params;
    
    const [eo] = await db.select()
      .from(executiveOrders)
      .where(eq(executiveOrders.eoNumber, eoNumber));
    
    if (!eo) {
      return res.status(404).json({ error: 'Executive Order not found' });
    }
    
    // Get all impacts for this EO with regulation info
    const impacts = await db.select({
      impact: eoRegulationImpacts,
      regulation: {
        id: regulations.id,
        name: regulations.name,
        topic: regulations.topic,
      },
      reviewedByUser: {
        id: users.id,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
      }
    })
    .from(eoRegulationImpacts)
    .leftJoin(regulations, eq(eoRegulationImpacts.regulationId, regulations.id))
    .leftJoin(users, eq(eoRegulationImpacts.reviewedBy, users.id))
    .where(eq(eoRegulationImpacts.eoId, eo.id))
    .orderBy(desc(sql`
      CASE impact_severity 
        WHEN 'critical' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'medium' THEN 3 
        WHEN 'low' THEN 4 
      END
    `));
    
    // Get status history
    const history = await db.select({
      history: eoStatusHistory,
      createdByUser: {
        id: users.id,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
      }
    })
    .from(eoStatusHistory)
    .leftJoin(users, eq(eoStatusHistory.createdBy, users.id))
    .where(eq(eoStatusHistory.eoId, eo.id))
    .orderBy(desc(eoStatusHistory.changeDate));
    
    res.json({
      ...eo,
      impacts: impacts.map(i => ({
        ...i.impact,
        regulation: i.regulation,
        reviewedByUser: i.reviewedByUser,
      })),
      statusHistory: history.map(h => ({
        ...h.history,
        createdByUser: h.createdByUser,
      })),
    });
  } catch (error) {
    console.error('Error fetching executive order:', error);
    res.status(500).json({ error: 'Failed to fetch executive order' });
  }
});

// ===== GET EOs FOR A REGULATION =====
/**
 * GET /api/executive-orders/regulation/:regulationId
 * Get all EOs that impact a specific regulation
 */
router.get('/regulation/:regulationId', requireAuth, async (req: Request, res: Response) => {
  try {
    const db = getDbForRequest(req);
    const regulationId = parseInt(req.params.regulationId);
    
    const impacts = await db.select({
      impact: eoRegulationImpacts,
      eo: executiveOrders,
      reviewedByUser: {
        id: users.id,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
      }
    })
    .from(eoRegulationImpacts)
    .leftJoin(executiveOrders, eq(eoRegulationImpacts.eoId, executiveOrders.id))
    .leftJoin(users, eq(eoRegulationImpacts.reviewedBy, users.id))
    .where(eq(eoRegulationImpacts.regulationId, regulationId))
    .orderBy(desc(sql`
      CASE impact_severity 
        WHEN 'critical' THEN 1 
        WHEN 'high' THEN 2 
        WHEN 'medium' THEN 3 
        WHEN 'low' THEN 4 
      END
    `));
    
    res.json(impacts.map(i => ({
      ...i.impact,
      executiveOrder: i.eo,
      reviewedByUser: i.reviewedByUser,
    })));
  } catch (error) {
    console.error('Error fetching EOs for regulation:', error);
    res.status(500).json({ error: 'Failed to fetch executive orders for regulation' });
  }
});

// ===== UPDATE EO STATUS =====
/**
 * PATCH /api/executive-orders/:eoNumber/status
 * Update the status of an EO (e.g., enjoined, revoked)
 */
router.patch('/:eoNumber/status', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDbForRequest(req);
    const { eoNumber } = req.params;
    const { status, reason, sourceUrl } = req.body;
    
    const [eo] = await db.select()
      .from(executiveOrders)
      .where(eq(executiveOrders.eoNumber, eoNumber));
    
    if (!eo) {
      return res.status(404).json({ error: 'Executive Order not found' });
    }
    
    const previousStatus = eo.status;
    
    // Update status
    const updateData: Record<string, unknown> = {
      status,
      updatedAt: new Date(),
    };
    
    if (status === 'enjoined') {
      updateData.enjoinedDate = new Date();
      updateData.enjoinedBy = reason;
    } else if (status === 'revoked') {
      updateData.revokedDate = new Date();
    }
    
    await db.update(executiveOrders)
      .set(updateData)
      .where(eq(executiveOrders.id, eo.id));
    
    // Record status change in history
    await db.insert(eoStatusHistory).values({
      eoId: eo.id,
      previousStatus,
      newStatus: status,
      changeDate: new Date().toISOString().split('T')[0],
      changeReason: reason,
      sourceUrl,
      createdBy: req.user?.id,
    });
    
    res.json({ success: true, previousStatus, newStatus: status });
  } catch (error) {
    console.error('Error updating EO status:', error);
    res.status(500).json({ error: 'Failed to update executive order status' });
  }
});

// ===== REVIEW EO IMPACT =====
/**
 * PATCH /api/executive-orders/impacts/:impactId/review
 * Mark an EO impact as reviewed/addressed/dismissed
 */
router.patch('/impacts/:impactId/review', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDbForRequest(req);
    const impactId = parseInt(req.params.impactId);
    const { reviewStatus, reviewNotes } = req.body;
    
    const [impact] = await db.select()
      .from(eoRegulationImpacts)
      .where(eq(eoRegulationImpacts.id, impactId));
    
    if (!impact) {
      return res.status(404).json({ error: 'Impact not found' });
    }
    
    await db.update(eoRegulationImpacts)
      .set({
        reviewStatus,
        reviewNotes,
        reviewedBy: req.user?.id,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(eoRegulationImpacts.id, impactId));
    
    res.json({ success: true, reviewStatus });
  } catch (error) {
    console.error('Error reviewing EO impact:', error);
    res.status(500).json({ error: 'Failed to review executive order impact' });
  }
});

// ===== GET EO STATS =====
/**
 * GET /api/executive-orders/stats
 * Get summary statistics for dashboard
 */
router.get('/stats/summary', requireAuth, async (req: Request, res: Response) => {
  try {
    const db = getDbForRequest(req);
    
    // Get counts
    const [eoStats] = await db.select({
      totalEOs: sql<number>`count(distinct ${executiveOrders.id})`,
      activeEOs: sql<number>`count(distinct ${executiveOrders.id}) filter (where ${executiveOrders.status} = 'active')`,
      enjoinedEOs: sql<number>`count(distinct ${executiveOrders.id}) filter (where ${executiveOrders.status} = 'enjoined')`,
    }).from(executiveOrders);
    
    const [impactStats] = await db.select({
      totalImpacts: sql<number>`count(*)`,
      criticalImpacts: sql<number>`count(*) filter (where ${eoRegulationImpacts.impactSeverity} = 'critical')`,
      highImpacts: sql<number>`count(*) filter (where ${eoRegulationImpacts.impactSeverity} = 'high')`,
      pendingReview: sql<number>`count(*) filter (where ${eoRegulationImpacts.reviewStatus} = 'pending')`,
      regulationsAffected: sql<number>`count(distinct ${eoRegulationImpacts.regulationId})`,
    }).from(eoRegulationImpacts);
    
    res.json({
      executiveOrders: {
        total: Number(eoStats?.totalEOs || 0),
        active: Number(eoStats?.activeEOs || 0),
        enjoined: Number(eoStats?.enjoinedEOs || 0),
      },
      impacts: {
        total: Number(impactStats?.totalImpacts || 0),
        critical: Number(impactStats?.criticalImpacts || 0),
        high: Number(impactStats?.highImpacts || 0),
        pendingReview: Number(impactStats?.pendingReview || 0),
        regulationsAffected: Number(impactStats?.regulationsAffected || 0),
      },
    });
  } catch (error) {
    console.error('Error fetching EO stats:', error);
    res.status(500).json({ error: 'Failed to fetch executive order stats' });
  }
});

export default router;
