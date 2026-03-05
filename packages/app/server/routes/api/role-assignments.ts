/**
 * Role Assignments API
 * 
 * Manages the mapping of suggested roles (from MCP Engine) to default DRIs.
 * Enables automatic task assignment based on role.
 */

import { Router, Request, Response } from 'express';
import { getDbForRequest } from '../../services/database';
import { roleAssignments, users } from '@shared/schema';
import { eq, asc, ilike } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { requireAuth, requireAdmin } from '../../middleware/role-based-auth';

const router = Router();

// Aliases for user joins
const defaultUsers = alias(users, 'defaultUsers');
const backupUsers = alias(users, 'backupUsers');

/**
 * GET /api/role-assignments
 * Get all role assignments with user details
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const db = getDbForRequest(req);
    
    const assignments = await db.select({
      id: roleAssignments.id,
      roleName: roleAssignments.roleName,
      displayName: roleAssignments.displayName,
      defaultUserId: roleAssignments.defaultUserId,
      defaultEmail: roleAssignments.defaultEmail,
      defaultName: roleAssignments.defaultName,
      backupUserId: roleAssignments.backupUserId,
      backupEmail: roleAssignments.backupEmail,
      category: roleAssignments.category,
      description: roleAssignments.description,
      autoAssignEnabled: roleAssignments.autoAssignEnabled,
      createdAt: roleAssignments.createdAt,
      updatedAt: roleAssignments.updatedAt,
      defaultUser: {
        id: defaultUsers.id,
        username: defaultUsers.username,
        email: defaultUsers.email,
        firstName: defaultUsers.firstName,
        lastName: defaultUsers.lastName,
      },
      backupUser: {
        id: backupUsers.id,
        username: backupUsers.username,
        email: backupUsers.email,
        firstName: backupUsers.firstName,
        lastName: backupUsers.lastName,
      },
    })
    .from(roleAssignments)
    .leftJoin(defaultUsers, eq(roleAssignments.defaultUserId, defaultUsers.id))
    .leftJoin(backupUsers, eq(roleAssignments.backupUserId, backupUsers.id))
    .orderBy(asc(roleAssignments.category), asc(roleAssignments.roleName));

    // Clean up null user objects
    const cleanedAssignments = assignments.map(a => ({
      ...a,
      defaultUser: a.defaultUser?.id ? a.defaultUser : null,
      backupUser: a.backupUser?.id ? a.backupUser : null,
    }));

    res.json(cleanedAssignments);
  } catch (error) {
    console.error('Error fetching role assignments:', error);
    res.status(500).json({ error: 'Failed to fetch role assignments' });
  }
});

/**
 * GET /api/role-assignments/by-role/:roleName
 * Get assignment for a specific role name
 */
router.get('/by-role/:roleName', requireAuth, async (req: Request, res: Response) => {
  try {
    const db = getDbForRequest(req);
    const { roleName } = req.params;

    const [assignment] = await db.select({
      id: roleAssignments.id,
      roleName: roleAssignments.roleName,
      displayName: roleAssignments.displayName,
      defaultUserId: roleAssignments.defaultUserId,
      defaultEmail: roleAssignments.defaultEmail,
      defaultName: roleAssignments.defaultName,
      autoAssignEnabled: roleAssignments.autoAssignEnabled,
      defaultUser: {
        id: defaultUsers.id,
        username: defaultUsers.username,
        email: defaultUsers.email,
        firstName: defaultUsers.firstName,
        lastName: defaultUsers.lastName,
      },
    })
    .from(roleAssignments)
    .leftJoin(defaultUsers, eq(roleAssignments.defaultUserId, defaultUsers.id))
    .where(ilike(roleAssignments.roleName, roleName))
    .limit(1);

    if (!assignment) {
      return res.status(404).json({ error: 'Role not found' });
    }

    res.json({
      ...assignment,
      defaultUser: assignment.defaultUser?.id ? assignment.defaultUser : null,
    });
  } catch (error) {
    console.error('Error fetching role assignment:', error);
    res.status(500).json({ error: 'Failed to fetch role assignment' });
  }
});

/**
 * GET /api/role-assignments/categories
 * Get list of unique categories
 */
router.get('/categories', requireAuth, async (req: Request, res: Response) => {
  try {
    const db = getDbForRequest(req);
    
    const categories = await db.selectDistinct({ category: roleAssignments.category })
      .from(roleAssignments)
      .where(eq(roleAssignments.category, roleAssignments.category)); // Filter out nulls

    res.json(categories.map(c => c.category).filter(Boolean));
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

/**
 * POST /api/role-assignments
 * Create a new role assignment
 */
router.post('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDbForRequest(req);
    const {
      roleName,
      displayName,
      defaultUserId,
      defaultEmail,
      defaultName,
      backupUserId,
      backupEmail,
      category,
      description,
      autoAssignEnabled = true,
    } = req.body;

    if (!roleName) {
      return res.status(400).json({ error: 'Role name is required' });
    }

    // Check if role already exists
    const existing = await db.select().from(roleAssignments)
      .where(ilike(roleAssignments.roleName, roleName))
      .limit(1);

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Role already exists', existingId: existing[0].id });
    }

    const [newAssignment] = await db.insert(roleAssignments).values({
      roleName,
      displayName,
      defaultUserId: defaultUserId || null,
      defaultEmail: defaultEmail || null,
      defaultName: defaultName || null,
      backupUserId: backupUserId || null,
      backupEmail: backupEmail || null,
      category: category || null,
      description: description || null,
      autoAssignEnabled,
      createdBy: req.user!.id,
      updatedBy: req.user!.id,
    }).returning();

    res.status(201).json(newAssignment);
  } catch (error) {
    console.error('Error creating role assignment:', error);
    res.status(500).json({ error: 'Failed to create role assignment' });
  }
});

/**
 * PATCH /api/role-assignments/:id
 * Update a role assignment
 */
router.patch('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDbForRequest(req);
    const id = parseInt(req.params.id);
    const updates = req.body;

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID' });
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
      updatedBy: req.user!.id,
    };

    if (updates.displayName !== undefined) updateData.displayName = updates.displayName;
    if (updates.defaultUserId !== undefined) updateData.defaultUserId = updates.defaultUserId || null;
    if (updates.defaultEmail !== undefined) updateData.defaultEmail = updates.defaultEmail || null;
    if (updates.defaultName !== undefined) updateData.defaultName = updates.defaultName || null;
    if (updates.backupUserId !== undefined) updateData.backupUserId = updates.backupUserId || null;
    if (updates.backupEmail !== undefined) updateData.backupEmail = updates.backupEmail || null;
    if (updates.category !== undefined) updateData.category = updates.category || null;
    if (updates.description !== undefined) updateData.description = updates.description || null;
    if (updates.autoAssignEnabled !== undefined) updateData.autoAssignEnabled = updates.autoAssignEnabled;

    const [updated] = await db.update(roleAssignments)
      .set(updateData)
      .where(eq(roleAssignments.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Role assignment not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Error updating role assignment:', error);
    res.status(500).json({ error: 'Failed to update role assignment' });
  }
});

/**
 * DELETE /api/role-assignments/:id
 * Delete a role assignment
 */
router.delete('/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    const db = getDbForRequest(req);
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID' });
    }

    await db.delete(roleAssignments).where(eq(roleAssignments.id, id));

    res.json({ success: true, message: 'Role assignment deleted' });
  } catch (error) {
    console.error('Error deleting role assignment:', error);
    res.status(500).json({ error: 'Failed to delete role assignment' });
  }
});

/**
 * POST /api/role-assignments/resolve
 * Resolve a role name to its default assignee
 * Used by task creation to auto-assign DRI
 */
router.post('/resolve', requireAuth, async (req: Request, res: Response) => {
  try {
    const db = getDbForRequest(req);
    const { roleName } = req.body;

    if (!roleName) {
      return res.status(400).json({ error: 'Role name is required' });
    }

    const [assignment] = await db.select({
      id: roleAssignments.id,
      roleName: roleAssignments.roleName,
      defaultUserId: roleAssignments.defaultUserId,
      defaultEmail: roleAssignments.defaultEmail,
      defaultName: roleAssignments.defaultName,
      autoAssignEnabled: roleAssignments.autoAssignEnabled,
      defaultUser: {
        id: defaultUsers.id,
        username: defaultUsers.username,
        email: defaultUsers.email,
        firstName: defaultUsers.firstName,
        lastName: defaultUsers.lastName,
      },
    })
    .from(roleAssignments)
    .leftJoin(defaultUsers, eq(roleAssignments.defaultUserId, defaultUsers.id))
    .where(ilike(roleAssignments.roleName, roleName))
    .limit(1);

    if (!assignment || !assignment.autoAssignEnabled) {
      return res.json({ 
        found: false, 
        roleName,
        message: assignment ? 'Auto-assign disabled for this role' : 'Role not configured'
      });
    }

    // Return assignee info
    if (assignment.defaultUserId && assignment.defaultUser?.id) {
      return res.json({
        found: true,
        roleName: assignment.roleName,
        assigneeType: 'user',
        userId: assignment.defaultUserId,
        email: assignment.defaultUser.email,
        name: `${assignment.defaultUser.firstName || ''} ${assignment.defaultUser.lastName || ''}`.trim() || assignment.defaultUser.username,
      });
    } else if (assignment.defaultEmail) {
      return res.json({
        found: true,
        roleName: assignment.roleName,
        assigneeType: 'external',
        email: assignment.defaultEmail,
        name: assignment.defaultName || assignment.defaultEmail.split('@')[0],
      });
    }

    res.json({ 
      found: false, 
      roleName: assignment.roleName,
      message: 'Role exists but no default assignee configured'
    });
  } catch (error) {
    console.error('Error resolving role:', error);
    res.status(500).json({ error: 'Failed to resolve role' });
  }
});

/**
 * POST /api/role-assignments/bulk-resolve
 * Resolve multiple role names at once (for batch task creation)
 */
router.post('/bulk-resolve', requireAuth, async (req: Request, res: Response) => {
  try {
    const db = getDbForRequest(req);
    const { roleNames } = req.body;

    if (!roleNames || !Array.isArray(roleNames)) {
      return res.status(400).json({ error: 'roleNames array is required' });
    }

    // Get all assignments
    const assignments = await db.select({
      roleName: roleAssignments.roleName,
      defaultUserId: roleAssignments.defaultUserId,
      defaultEmail: roleAssignments.defaultEmail,
      defaultName: roleAssignments.defaultName,
      autoAssignEnabled: roleAssignments.autoAssignEnabled,
      defaultUser: {
        id: defaultUsers.id,
        email: defaultUsers.email,
        firstName: defaultUsers.firstName,
        lastName: defaultUsers.lastName,
      },
    })
    .from(roleAssignments)
    .leftJoin(defaultUsers, eq(roleAssignments.defaultUserId, defaultUsers.id));

    // Build lookup map (case-insensitive)
    const assignmentMap = new Map<string, typeof assignments[0]>();
    assignments.forEach(a => {
      assignmentMap.set(a.roleName.toLowerCase(), a);
    });

    // Resolve each role
    const results: Record<string, {
      found: boolean;
      userId?: number;
      email?: string;
      name?: string;
      assigneeType?: 'user' | 'external';
    }> = {};

    for (const roleName of roleNames) {
      const assignment = assignmentMap.get(roleName.toLowerCase());
      
      if (!assignment || !assignment.autoAssignEnabled) {
        results[roleName] = { found: false };
        continue;
      }

      if (assignment.defaultUserId && assignment.defaultUser?.id) {
        results[roleName] = {
          found: true,
          assigneeType: 'user',
          userId: assignment.defaultUserId,
          email: assignment.defaultUser.email,
          name: `${assignment.defaultUser.firstName || ''} ${assignment.defaultUser.lastName || ''}`.trim(),
        };
      } else if (assignment.defaultEmail) {
        results[roleName] = {
          found: true,
          assigneeType: 'external',
          email: assignment.defaultEmail,
          name: assignment.defaultName || undefined,
        };
      } else {
        results[roleName] = { found: false };
      }
    }

    res.json({ results });
  } catch (error) {
    console.error('Error bulk resolving roles:', error);
    res.status(500).json({ error: 'Failed to bulk resolve roles' });
  }
});

export default router;
