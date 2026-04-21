/**
 * Circuit Court Interpretations API Routes
 *
 * Tracks how different federal circuit courts interpret regulations,
 * creating binding precedent that affects institutional compliance.
 * March 2026
 */

import { Router, Request, Response } from 'express';
import { eq, desc, and, sql } from 'drizzle-orm';
import {
  circuitInterpretations,
  circuitSplits,
  regulations,
  users,
  institutionConfigurations,
  FEDERAL_CIRCUITS,
  getCircuitForState,
  getCircuitInfo,
} from '../../../shared/schema';
import { requireAuth, requireAdmin } from '../../middleware/role-based-auth';
import { getDbForRequest } from '../../services/database';

const router = Router();

// ===== GET CIRCUIT REFERENCE DATA =====
/**
 * GET /api/circuit-interpretations/circuits
 * Returns the static circuit-to-state mapping and the tenant's circuit
 */
router.get('/circuits', requireAuth, async (req: Request, res: Response) => {
  try {
    const db = getDbForRequest(req);
    const tenantId = req.tenantId || 'default';

    const [config] = await db.select()
      .from(institutionConfigurations)
      .where(eq(institutionConfigurations.tenantId, tenantId));

    const tenantState = config?.stateCode || null;
    const tenantCircuit = tenantState ? getCircuitForState(tenantState) : null;

    res.json({
      circuits: FEDERAL_CIRCUITS,
      tenant: {
        stateCode: tenantState,
        circuitNumber: tenantCircuit,
        circuitName: tenantCircuit ? getCircuitInfo(tenantCircuit)?.name : null,
      },
    });
  } catch (error) {
    console.error('Error fetching circuit data:', error);
    res.status(500).json({ error: 'Failed to fetch circuit data' });
  }
});

// ===== GET ALL INTERPRETATIONS =====
/**
 * GET /api/circuit-interpretations
 * List circuit interpretations with optional filtering.
 * Query params: regulationId, circuitNumber, status, myCircuit (boolean), limit, offset
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const db = getDbForRequest(req);
    const { regulationId, circuitNumber, status, myCircuit, limit = '50', offset = '0' } = req.query;

    const conditions: ReturnType<typeof eq>[] = [];

    if (regulationId) {
      conditions.push(eq(circuitInterpretations.regulationId, parseInt(regulationId as string)));
    }

    if (circuitNumber) {
      conditions.push(eq(circuitInterpretations.circuitNumber, parseInt(circuitNumber as string)));
    }

    if (status && typeof status === 'string') {
      conditions.push(eq(circuitInterpretations.status, status));
    }

    // "myCircuit" filter: derive tenant's circuit from their state
    if (myCircuit === 'true') {
      const tenantId = req.tenantId || 'default';
      const [config] = await db.select()
        .from(institutionConfigurations)
        .where(eq(institutionConfigurations.tenantId, tenantId));

      if (config?.stateCode) {
        const circuit = getCircuitForState(config.stateCode);
        if (circuit) {
          conditions.push(eq(circuitInterpretations.circuitNumber, circuit));
        }
      }
    }

    const whereClause = conditions.length > 0
      ? conditions.reduce((acc, cond) => and(acc, cond)!)
      : undefined;

    const results = await db.select({
      interpretation: circuitInterpretations,
      regulation: {
        id: regulations.id,
        name: regulations.name,
        topic: regulations.topic,
        regKey: regulations.regKey,
      },
      reviewedByUser: {
        id: users.id,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
      },
    })
    .from(circuitInterpretations)
    .leftJoin(regulations, eq(circuitInterpretations.regulationId, regulations.id))
    .leftJoin(users, eq(circuitInterpretations.reviewedBy, users.id))
    .where(whereClause)
    .orderBy(
      desc(sql`
        CASE ${circuitInterpretations.impactSeverity}
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END
      `),
      desc(circuitInterpretations.caseYear)
    )
    .limit(parseInt(limit as string))
    .offset(parseInt(offset as string));

    res.json(results.map(r => ({
      ...r.interpretation,
      circuitName: getCircuitInfo(r.interpretation.circuitNumber)?.name,
      regulation: r.regulation,
      reviewedByUser: r.reviewedByUser?.id ? r.reviewedByUser : null,
    })));
  } catch (error) {
    console.error('Error fetching circuit interpretations:', error);
    res.status(500).json({ error: 'Failed to fetch circuit interpretations' });
  }
});

// ===== GET INTERPRETATIONS FOR A REGULATION =====
/**
 * GET /api/circuit-interpretations/regulation/:regulationId
 * Get all circuit interpretations for a specific regulation, grouped by circuit.
 * Highlights the tenant's own circuit.
 */
router.get('/regulation/:regulationId', requireAuth, async (req: Request, res: Response) => {
  try {
    const db = getDbForRequest(req);
    const regulationId = parseInt(req.params.regulationId);
    const tenantId = req.tenantId || 'default';

    // Get tenant's circuit
    const [config] = await db.select()
      .from(institutionConfigurations)
      .where(eq(institutionConfigurations.tenantId, tenantId));

    const tenantCircuit = config?.stateCode ? getCircuitForState(config.stateCode) : null;

    // Get all interpretations for this regulation
    const results = await db.select({
      interpretation: circuitInterpretations,
      reviewedByUser: {
        id: users.id,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
      },
    })
    .from(circuitInterpretations)
    .leftJoin(users, eq(circuitInterpretations.reviewedBy, users.id))
    .where(eq(circuitInterpretations.regulationId, regulationId))
    .orderBy(
      desc(sql`
        CASE ${circuitInterpretations.impactSeverity}
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END
      `),
      desc(circuitInterpretations.caseYear)
    );

    // Get related circuit splits
    const splits = await db.select()
      .from(circuitSplits)
      .where(eq(circuitSplits.regulationId, regulationId))
      .orderBy(desc(circuitSplits.createdAt));

    const interpretations = results.map(r => ({
      ...r.interpretation,
      circuitName: getCircuitInfo(r.interpretation.circuitNumber)?.name,
      isMyCircuit: r.interpretation.circuitNumber === tenantCircuit,
      reviewedByUser: r.reviewedByUser?.id ? r.reviewedByUser : null,
    }));

    // Separate tenant's circuit interpretations from others
    const myCircuit = interpretations.filter(i => i.isMyCircuit);
    const otherCircuits = interpretations.filter(i => !i.isMyCircuit);

    res.json({
      tenantCircuit: tenantCircuit ? {
        number: tenantCircuit,
        name: getCircuitInfo(tenantCircuit)?.name,
        stateCode: config?.stateCode,
      } : null,
      myCircuitInterpretations: myCircuit,
      otherCircuitInterpretations: otherCircuits,
      circuitSplits: splits,
      totalCount: interpretations.length,
    });
  } catch (error) {
    console.error('Error fetching circuit interpretations for regulation:', error);
    res.status(500).json({ error: 'Failed to fetch circuit interpretations' });
  }
});

// ===== GET SINGLE INTERPRETATION =====
/**
 * GET /api/circuit-interpretations/:id
 */
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const db = getDbForRequest(req);
    const id = parseInt(req.params.id);

    const [result] = await db.select({
      interpretation: circuitInterpretations,
      regulation: {
        id: regulations.id,
        name: regulations.name,
        topic: regulations.topic,
        regKey: regulations.regKey,
      },
      reviewedByUser: {
        id: users.id,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
      },
    })
    .from(circuitInterpretations)
    .leftJoin(regulations, eq(circuitInterpretations.regulationId, regulations.id))
    .leftJoin(users, eq(circuitInterpretations.reviewedBy, users.id))
    .where(eq(circuitInterpretations.id, id));

    if (!result) {
      return res.status(404).json({ error: 'Circuit interpretation not found' });
    }

    // If part of a split, fetch the split info
    let split = null;
    if (result.interpretation.splitId) {
      const [splitResult] = await db.select()
        .from(circuitSplits)
        .where(eq(circuitSplits.id, result.interpretation.splitId));
      split = splitResult || null;
    }

    res.json({
      ...result.interpretation,
      circuitName: getCircuitInfo(result.interpretation.circuitNumber)?.name,
      regulation: result.regulation,
      reviewedByUser: result.reviewedByUser?.id ? result.reviewedByUser : null,
      circuitSplit: split,
    });
  } catch (error) {
    console.error('Error fetching circuit interpretation:', error);
    res.status(500).json({ error: 'Failed to fetch circuit interpretation' });
  }
});

// ===== CREATE INTERPRETATION =====
/**
 * POST /api/circuit-interpretations
 * Admin-only: create a new circuit interpretation
 */
router.post('/', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDbForRequest(req);

    const [created] = await db.insert(circuitInterpretations)
      .values({
        ...req.body,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    res.status(201).json(created);
  } catch (error) {
    console.error('Error creating circuit interpretation:', error);
    res.status(500).json({ error: 'Failed to create circuit interpretation' });
  }
});

// ===== UPDATE INTERPRETATION =====
/**
 * PATCH /api/circuit-interpretations/:id
 * Admin-only: update a circuit interpretation
 */
router.patch('/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDbForRequest(req);
    const id = parseInt(req.params.id);

    const [existing] = await db.select()
      .from(circuitInterpretations)
      .where(eq(circuitInterpretations.id, id));

    if (!existing) {
      return res.status(404).json({ error: 'Circuit interpretation not found' });
    }

    const [updated] = await db.update(circuitInterpretations)
      .set({
        ...req.body,
        updatedAt: new Date(),
      })
      .where(eq(circuitInterpretations.id, id))
      .returning();

    res.json(updated);
  } catch (error) {
    console.error('Error updating circuit interpretation:', error);
    res.status(500).json({ error: 'Failed to update circuit interpretation' });
  }
});

// ===== REVIEW INTERPRETATION (CCO Workflow) =====
/**
 * PATCH /api/circuit-interpretations/:id/review
 * Mark an interpretation as reviewed/addressed/dismissed
 */
router.patch('/:id/review', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDbForRequest(req);
    const id = parseInt(req.params.id);
    const { reviewStatus, reviewNotes } = req.body;

    const [existing] = await db.select()
      .from(circuitInterpretations)
      .where(eq(circuitInterpretations.id, id));

    if (!existing) {
      return res.status(404).json({ error: 'Circuit interpretation not found' });
    }

    const [updated] = await db.update(circuitInterpretations)
      .set({
        reviewStatus,
        reviewNotes,
        reviewedBy: req.user?.id,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(circuitInterpretations.id, id))
      .returning();

    res.json({ success: true, interpretation: updated });
  } catch (error) {
    console.error('Error reviewing circuit interpretation:', error);
    res.status(500).json({ error: 'Failed to review circuit interpretation' });
  }
});

// ===== DELETE INTERPRETATION =====
/**
 * DELETE /api/circuit-interpretations/:id
 * Admin-only
 */
router.delete('/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDbForRequest(req);
    const id = parseInt(req.params.id);

    const [existing] = await db.select()
      .from(circuitInterpretations)
      .where(eq(circuitInterpretations.id, id));

    if (!existing) {
      return res.status(404).json({ error: 'Circuit interpretation not found' });
    }

    await db.delete(circuitInterpretations)
      .where(eq(circuitInterpretations.id, id));

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting circuit interpretation:', error);
    res.status(500).json({ error: 'Failed to delete circuit interpretation' });
  }
});

// ===== CIRCUIT SPLITS ENDPOINTS =====

/**
 * GET /api/circuit-interpretations/splits
 * List all active circuit splits
 */
router.get('/splits/all', requireAuth, async (req: Request, res: Response) => {
  try {
    const db = getDbForRequest(req);
    const { status = 'active', regulationId } = req.query;

    const conditions: ReturnType<typeof eq>[] = [];

    if (status && typeof status === 'string') {
      conditions.push(eq(circuitSplits.status, status));
    }

    if (regulationId) {
      conditions.push(eq(circuitSplits.regulationId, parseInt(regulationId as string)));
    }

    const whereClause = conditions.length > 0
      ? conditions.reduce((acc, cond) => and(acc, cond)!)
      : undefined;

    const splits = await db.select({
      split: circuitSplits,
      regulation: {
        id: regulations.id,
        name: regulations.name,
        topic: regulations.topic,
        regKey: regulations.regKey,
      },
    })
    .from(circuitSplits)
    .leftJoin(regulations, eq(circuitSplits.regulationId, regulations.id))
    .where(whereClause)
    .orderBy(desc(circuitSplits.createdAt));

    // For each split, count related interpretations
    const splitsWithCounts = await Promise.all(splits.map(async (s) => {
      const [counts] = await db.select({
        total: sql<number>`count(*)`,
        activeCount: sql<number>`count(*) filter (where ${circuitInterpretations.status} = 'active')`,
      })
      .from(circuitInterpretations)
      .where(eq(circuitInterpretations.splitId, s.split.id));

      return {
        ...s.split,
        regulation: s.regulation,
        interpretationCount: Number(counts?.total || 0),
        activeInterpretationCount: Number(counts?.activeCount || 0),
      };
    }));

    res.json(splitsWithCounts);
  } catch (error) {
    console.error('Error fetching circuit splits:', error);
    res.status(500).json({ error: 'Failed to fetch circuit splits' });
  }
});

/**
 * POST /api/circuit-interpretations/splits
 * Admin-only: create a circuit split
 */
router.post('/splits', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDbForRequest(req);

    const [created] = await db.insert(circuitSplits)
      .values({
        ...req.body,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    res.status(201).json(created);
  } catch (error) {
    console.error('Error creating circuit split:', error);
    res.status(500).json({ error: 'Failed to create circuit split' });
  }
});

/**
 * PATCH /api/circuit-interpretations/splits/:id
 * Admin-only: update a circuit split
 */
router.patch('/splits/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDbForRequest(req);
    const id = parseInt(req.params.id);

    const [updated] = await db.update(circuitSplits)
      .set({
        ...req.body,
        updatedAt: new Date(),
      })
      .where(eq(circuitSplits.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Circuit split not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Error updating circuit split:', error);
    res.status(500).json({ error: 'Failed to update circuit split' });
  }
});

// ===== STATS / DASHBOARD =====
/**
 * GET /api/circuit-interpretations/stats/summary
 * Summary statistics for the dashboard
 */
router.get('/stats/summary', requireAuth, async (req: Request, res: Response) => {
  try {
    const db = getDbForRequest(req);
    const tenantId = req.tenantId || 'default';

    // Get tenant's circuit
    const [config] = await db.select()
      .from(institutionConfigurations)
      .where(eq(institutionConfigurations.tenantId, tenantId));

    const tenantCircuit = config?.stateCode ? getCircuitForState(config.stateCode) : null;

    const [stats] = await db.select({
      total: sql<number>`count(*)`,
      active: sql<number>`count(*) filter (where ${circuitInterpretations.status} = 'active')`,
      critical: sql<number>`count(*) filter (where ${circuitInterpretations.impactSeverity} = 'critical')`,
      high: sql<number>`count(*) filter (where ${circuitInterpretations.impactSeverity} = 'high')`,
      pendingReview: sql<number>`count(*) filter (where ${circuitInterpretations.reviewStatus} = 'pending')`,
      regulationsAffected: sql<number>`count(distinct ${circuitInterpretations.regulationId})`,
      myCircuitCount: tenantCircuit
        ? sql<number>`count(*) filter (where ${circuitInterpretations.circuitNumber} = ${tenantCircuit} and ${circuitInterpretations.status} = 'active')`
        : sql<number>`0`,
    }).from(circuitInterpretations);

    const [splitStats] = await db.select({
      activeSplits: sql<number>`count(*) filter (where ${circuitSplits.status} = 'active')`,
      pendingScotus: sql<number>`count(*) filter (where ${circuitSplits.scotusPetitionPending} = true or ${circuitSplits.scotusCertGranted} = true)`,
    }).from(circuitSplits);

    res.json({
      interpretations: {
        total: Number(stats?.total || 0),
        active: Number(stats?.active || 0),
        critical: Number(stats?.critical || 0),
        high: Number(stats?.high || 0),
        pendingReview: Number(stats?.pendingReview || 0),
        regulationsAffected: Number(stats?.regulationsAffected || 0),
        myCircuitCount: Number(stats?.myCircuitCount || 0),
      },
      splits: {
        active: Number(splitStats?.activeSplits || 0),
        pendingScotus: Number(splitStats?.pendingScotus || 0),
      },
      tenantCircuit: tenantCircuit ? {
        number: tenantCircuit,
        name: getCircuitInfo(tenantCircuit)?.name,
        stateCode: config?.stateCode,
      } : null,
    });
  } catch (error) {
    console.error('Error fetching circuit interpretation stats:', error);
    res.status(500).json({ error: 'Failed to fetch circuit interpretation stats' });
  }
});

export default router;
