/**
 * Compliance Tasks API
 * 
 * Manages hierarchical task management for complex regulations.
 * Supports sub-tasks, per-task DRIs, evidence requirements, and activity tracking.
 */

import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../../db';
import { complianceTasks, taskEvidence, taskActivity, users, regulations } from '@shared/schema';
import { eq, desc, asc } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { requireAuth, requireAdmin } from '../../middleware/role-based-auth';
import { emailService } from '../../services/email';
import { getCleryTasksWithDates, getCleryTaskCount } from '../../templates/clery-act-tasks';

// JWT secret for task tokens (use same as attestation or a dedicated one)
const TASK_TOKEN_SECRET = process.env.ATTESTATION_JWT_SECRET || process.env.JWT_SECRET || 'edsteward-task-secret-key';
const TASK_TOKEN_EXPIRY = '14d'; // 14 days

// Alias for the users table to join twice (assignedTo and completedBy)
const completedByUsers = alias(users, 'completedByUsers');

const router = Router();

// ===== GET TASKS FOR A REGULATION =====
/**
 * GET /api/compliance-tasks/regulation/:regulationId
 * Get all tasks for a regulation (hierarchical structure)
 */
router.get('/regulation/:regulationId', requireAuth, async (req: Request, res: Response) => {
  try {
    const regulationId = parseInt(req.params.regulationId);
    
    if (isNaN(regulationId)) {
      return res.status(400).json({ error: 'Invalid regulation ID' });
    }

    // Get all tasks for this regulation with both assignedUser and completedByUser
    const tasks = await db.select({
      task: complianceTasks,
      assignedUser: {
        id: users.id,
        username: users.username,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      },
      completedByUser: {
        id: completedByUsers.id,
        username: completedByUsers.username,
        email: completedByUsers.email,
        firstName: completedByUsers.firstName,
        lastName: completedByUsers.lastName,
      }
    })
    .from(complianceTasks)
    .leftJoin(users, eq(complianceTasks.assignedTo, users.id))
    .leftJoin(completedByUsers, eq(complianceTasks.completedBy, completedByUsers.id))
    .where(eq(complianceTasks.regulationId, regulationId))
    .orderBy(asc(complianceTasks.sortOrder), asc(complianceTasks.id));

    // Get evidence with uploader info for each task
    const evidenceUploader = alias(users, 'evidence_uploader');
    const evidenceItems = await db.select({
      evidence: taskEvidence,
      uploader: {
        id: evidenceUploader.id,
        username: evidenceUploader.username,
        email: evidenceUploader.email,
        firstName: evidenceUploader.firstName,
        lastName: evidenceUploader.lastName,
      }
    })
    .from(taskEvidence)
    .leftJoin(evidenceUploader, eq(taskEvidence.uploadedBy, evidenceUploader.id));

    // Group evidence by task
    const evidenceByTask: Record<number, Array<{
      id: number;
      fileName: string;
      fileType: string | null;
      fileUrl: string | null;
      linkUrl: string | null;
      linkTitle: string | null;
      description: string | null;
      uploadedAt: Date | null;
      uploader: {
        id: number;
        username: string;
        email: string;
        firstName: string | null;
        lastName: string | null;
      } | null;
    }>> = {};
    
    evidenceItems.forEach(({ evidence, uploader }) => {
      if (!evidenceByTask[evidence.taskId]) {
        evidenceByTask[evidence.taskId] = [];
      }
      evidenceByTask[evidence.taskId].push({
        id: evidence.id,
        fileName: evidence.fileName,
        fileType: evidence.fileType,
        fileUrl: evidence.fileUrl,
        linkUrl: evidence.linkUrl,
        linkTitle: evidence.linkTitle,
        description: evidence.description,
        uploadedAt: evidence.uploadedAt,
        uploader: uploader?.id ? uploader : null,
      });
    });

    // Build hierarchical structure
    const taskMap = new Map<number, any>();
    const rootTasks: any[] = [];

    tasks.forEach(({ task, assignedUser, completedByUser }) => {
      const taskEvidence = evidenceByTask[task.id] || [];
      const taskWithMeta = {
        ...task,
        assignedUser: assignedUser?.id ? assignedUser : null,
        completedByUser: completedByUser?.id ? completedByUser : null,
        evidenceCount: taskEvidence.length,
        evidenceItems: taskEvidence,
        subTasks: [],
      };
      taskMap.set(task.id, taskWithMeta);
    });

    // Organize into hierarchy
    taskMap.forEach((task) => {
      if (task.parentTaskId) {
        const parent = taskMap.get(task.parentTaskId);
        if (parent) {
          parent.subTasks.push(task);
        }
      } else {
        rootTasks.push(task);
      }
    });

    // Calculate progress
    const allTasks = Array.from(taskMap.values());
    const completedTasks = allTasks.filter(t => t.status === 'completed');
    const progress = allTasks.length > 0 
      ? Math.round((completedTasks.length / allTasks.length) * 100) 
      : 0;

    // Debug logging
    const completedTasksDebug = allTasks.filter(t => t.status === 'completed');
    console.log('=== COMPLIANCE TASKS DEBUG ===');
    console.log('Total tasks:', allTasks.length);
    console.log('Completed tasks:', completedTasksDebug.length);
    completedTasksDebug.forEach(t => {
      console.log(`  Task ${t.id}: status=${t.status}, completedAt=${t.completedAt}, completedByUser=`, t.completedByUser);
    });
    console.log('==============================');

    res.json({
      tasks: rootTasks,
      totalTasks: allTasks.length,
      completedTasks: completedTasks.length,
      progress,
    });
  } catch (error) {
    console.error('Error fetching compliance tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// ===== GET SINGLE TASK =====
/**
 * GET /api/compliance-tasks/:taskId
 * Get a single task with all details
 */
router.get('/:taskId', requireAuth, async (req: Request, res: Response) => {
  try {
    const taskId = parseInt(req.params.taskId);
    
    const [task] = await db.select({
      task: complianceTasks,
      assignedUser: {
        id: users.id,
        username: users.username,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      },
    })
    .from(complianceTasks)
    .leftJoin(users, eq(complianceTasks.assignedTo, users.id))
    .where(eq(complianceTasks.id, taskId));

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Get evidence for this task
    const evidence = await db.select({
      evidence: taskEvidence,
      uploadedByUser: {
        id: users.id,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
      }
    })
    .from(taskEvidence)
    .leftJoin(users, eq(taskEvidence.uploadedBy, users.id))
    .where(eq(taskEvidence.taskId, taskId))
    .orderBy(desc(taskEvidence.uploadedAt));

    // Get activity for this task
    const activity = await db.select({
      activity: taskActivity,
      user: {
        id: users.id,
        username: users.username,
        firstName: users.firstName,
        lastName: users.lastName,
      }
    })
    .from(taskActivity)
    .leftJoin(users, eq(taskActivity.userId, users.id))
    .where(eq(taskActivity.taskId, taskId))
    .orderBy(desc(taskActivity.createdAt))
    .limit(50);

    // Get sub-tasks
    const subTasks = await db.select()
    .from(complianceTasks)
    .where(eq(complianceTasks.parentTaskId, taskId))
    .orderBy(asc(complianceTasks.sortOrder));

    res.json({
      ...task.task,
      assignedUser: task.assignedUser,
      evidence: evidence.map(e => ({ ...e.evidence, uploadedByUser: e.uploadedByUser })),
      activity: activity.map(a => ({ ...a.activity, user: a.user })),
      subTasks,
    });
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

// ===== CREATE TASK =====
/**
 * POST /api/compliance-tasks
 * Create a new compliance task
 */
router.post('/', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const {
      regulationId,
      parentTaskId,
      title,
      description,
      instructions,
      assignedTo,
      assignedRole,
      dueDate,
      recurringSchedule,
      reminderDays,
      priority,
      evidenceRequired,
      evidenceType,
      evidenceInstructions,
      sortOrder,
    } = req.body;

    if (!regulationId || !title) {
      return res.status(400).json({ error: 'regulationId and title are required' });
    }

    const [newTask] = await db.insert(complianceTasks).values({
      regulationId,
      parentTaskId: parentTaskId || null,
      title,
      description,
      instructions,
      assignedTo: assignedTo || null,
      assignedRole,
      dueDate: dueDate ? new Date(dueDate) : null,
      recurringSchedule,
      reminderDays: reminderDays || 30,
      priority: priority || 'medium',
      evidenceRequired: evidenceRequired || false,
      evidenceType: evidenceType || 'none',
      evidenceInstructions,
      sortOrder: sortOrder || 0,
      status: 'pending',
      createdBy: req.user?.id,
    }).returning();

    // Log activity
    await db.insert(taskActivity).values({
      taskId: newTask.id,
      userId: req.user!.id,
      activityType: 'status_change',
      content: 'Task created',
      newValue: 'pending',
    });

    res.status(201).json(newTask);
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// ===== UPDATE TASK =====
/**
 * PATCH /api/compliance-tasks/:taskId
 * Update a compliance task
 */
router.patch('/:taskId', requireAuth, async (req: Request, res: Response) => {
  try {
    const taskId = parseInt(req.params.taskId);
    const updates = req.body;

    // Get current task for activity logging
    const [currentTask] = await db.select().from(complianceTasks).where(eq(complianceTasks.id, taskId));
    if (!currentTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Prepare update object
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    // Handle specific fields
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.instructions !== undefined) updateData.instructions = updates.instructions;
    if (updates.assignedTo !== undefined) updateData.assignedTo = updates.assignedTo;
    if (updates.assignedRole !== undefined) updateData.assignedRole = updates.assignedRole;
    if (updates.dueDate !== undefined) updateData.dueDate = updates.dueDate ? new Date(updates.dueDate) : null;
    if (updates.priority !== undefined) updateData.priority = updates.priority;
    if (updates.evidenceRequired !== undefined) updateData.evidenceRequired = updates.evidenceRequired;
    if (updates.evidenceType !== undefined) updateData.evidenceType = updates.evidenceType;
    if (updates.evidenceInstructions !== undefined) updateData.evidenceInstructions = updates.evidenceInstructions;
    if (updates.sortOrder !== undefined) updateData.sortOrder = updates.sortOrder;
    // Escalation contact fields
    if (updates.escalationEmail !== undefined) updateData.escalationEmail = updates.escalationEmail;
    if (updates.escalationName !== undefined) updateData.escalationName = updates.escalationName;

    // Handle status change specially
    if (updates.status !== undefined && updates.status !== currentTask.status) {
      updateData.status = updates.status;
      
      if (updates.status === 'completed') {
        updateData.completedAt = new Date();
        updateData.completedBy = req.user!.id;
      } else if (currentTask.status === 'completed') {
        // Uncompleting a task
        updateData.completedAt = null;
        updateData.completedBy = null;
      }

      // Log status change
      await db.insert(taskActivity).values({
        taskId,
        userId: req.user!.id,
        activityType: 'status_change',
        content: `Status changed from ${currentTask.status} to ${updates.status}`,
        previousValue: currentTask.status,
        newValue: updates.status,
      });
    }

    // Handle assignment change
    if (updates.assignedTo !== undefined && updates.assignedTo !== currentTask.assignedTo) {
      await db.insert(taskActivity).values({
        taskId,
        userId: req.user!.id,
        activityType: 'assignment_change',
        content: 'Task assignment changed',
        previousValue: currentTask.assignedTo?.toString() || 'unassigned',
        newValue: updates.assignedTo?.toString() || 'unassigned',
      });
    }

    const [updatedTask] = await db.update(complianceTasks)
      .set(updateData)
      .where(eq(complianceTasks.id, taskId))
      .returning();

    res.json(updatedTask);
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// ===== DELETE TASK =====
/**
 * DELETE /api/compliance-tasks/:taskId
 * Delete a compliance task (and all sub-tasks)
 */
router.delete('/:taskId', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const taskId = parseInt(req.params.taskId);

    await db.delete(complianceTasks).where(eq(complianceTasks.id, taskId));

    res.json({ success: true, message: 'Task deleted' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// ===== ADD COMMENT =====
/**
 * POST /api/compliance-tasks/:taskId/comment
 * Add a comment to a task
 */
router.post('/:taskId/comment', requireAuth, async (req: Request, res: Response) => {
  try {
    const taskId = parseInt(req.params.taskId);
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    const [activity] = await db.insert(taskActivity).values({
      taskId,
      userId: req.user!.id,
      activityType: 'comment',
      content,
    }).returning();

    res.status(201).json(activity);
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// ===== NUDGE DRI =====
/**
 * POST /api/compliance-tasks/:taskId/nudge
 * Send a nudge reminder to the task's DRI
 */
router.post('/:taskId/nudge', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const taskId = parseInt(req.params.taskId);
    const { message } = req.body;

    // Get task with assigned user
    const [taskData] = await db.select({
      task: complianceTasks,
      assignedUser: users,
      regulation: regulations,
    })
    .from(complianceTasks)
    .leftJoin(users, eq(complianceTasks.assignedTo, users.id))
    .leftJoin(regulations, eq(complianceTasks.regulationId, regulations.id))
    .where(eq(complianceTasks.id, taskId));

    if (!taskData) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (!taskData.assignedUser) {
      return res.status(400).json({ error: 'Task has no assigned DRI' });
    }

    // Log the nudge
    await db.insert(taskActivity).values({
      taskId,
      userId: req.user!.id,
      activityType: 'nudge',
      content: message || 'Reminder sent to complete this task',
    });

    // Send email nudge
    const senderName = req.user?.firstName && req.user?.lastName 
      ? `${req.user.firstName} ${req.user.lastName}`
      : req.user?.username || 'Chief Compliance Officer';

    await emailService.sendEmail({
      to: taskData.assignedUser.email,
      subject: `Reminder: ${taskData.task.title} - Action Required`,
      html: `
        <h2>Task Reminder</h2>
        <p>Hello ${taskData.assignedUser.firstName || taskData.assignedUser.username},</p>
        <p>${senderName} has sent you a reminder about the following compliance task:</p>
        <div style="background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0 0 10px 0;">${taskData.task.title}</h3>
          <p style="margin: 5px 0;"><strong>Regulation:</strong> ${taskData.regulation?.name || 'Unknown'}</p>
          ${taskData.task.dueDate ? `<p style="margin: 5px 0;"><strong>Due Date:</strong> ${new Date(taskData.task.dueDate).toLocaleDateString()}</p>` : ''}
          ${message ? `<p style="margin: 15px 0; padding: 10px; background: #fff; border-left: 3px solid #0066cc;">${message}</p>` : ''}
        </div>
        <p>Please log in to EdSteward to complete this task.</p>
      `,
    });

    res.json({ success: true, message: 'Nudge sent successfully' });
  } catch (error) {
    console.error('Error sending nudge:', error);
    res.status(500).json({ error: 'Failed to send nudge' });
  }
});

// ===== ESCALATE TASK =====
/**
 * POST /api/compliance-tasks/:taskId/escalate
 * Escalate a task to supervisor
 */
router.post('/:taskId/escalate', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const taskId = parseInt(req.params.taskId);
    const { escalationEmail, message, ccDri } = req.body;

    if (!escalationEmail) {
      return res.status(400).json({ error: 'Escalation email is required' });
    }

    // Get task with assigned user and regulation
    const [taskData] = await db.select({
      task: complianceTasks,
      assignedUser: users,
      regulation: regulations,
    })
    .from(complianceTasks)
    .leftJoin(users, eq(complianceTasks.assignedTo, users.id))
    .leftJoin(regulations, eq(complianceTasks.regulationId, regulations.id))
    .where(eq(complianceTasks.id, taskId));

    if (!taskData) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Log the escalation
    await db.insert(taskActivity).values({
      taskId,
      userId: req.user!.id,
      activityType: 'escalation',
      content: `Escalated to ${escalationEmail}${message ? `: ${message}` : ''}`,
    });

    // Send escalation email
    const senderName = req.user?.firstName && req.user?.lastName 
      ? `${req.user.firstName} ${req.user.lastName}`
      : req.user?.username || 'Chief Compliance Officer';

    const driName = taskData.assignedUser 
      ? (taskData.assignedUser.firstName && taskData.assignedUser.lastName 
          ? `${taskData.assignedUser.firstName} ${taskData.assignedUser.lastName}`
          : taskData.assignedUser.username)
      : 'Unassigned';

    await emailService.sendEmail({
      to: escalationEmail,
      cc: ccDri && taskData.assignedUser ? taskData.assignedUser.email : undefined,
      subject: `ESCALATION: ${taskData.task.title} - Compliance Task Requires Attention`,
      html: `
        <h2 style="color: #cc0000;">Compliance Task Escalation</h2>
        <p>This task has been escalated by ${senderName} and requires immediate attention.</p>
        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #cc0000;">
          <h3 style="margin: 0 0 10px 0;">${taskData.task.title}</h3>
          <p style="margin: 5px 0;"><strong>Regulation:</strong> ${taskData.regulation?.name || 'Unknown'}</p>
          <p style="margin: 5px 0;"><strong>Assigned To:</strong> ${driName}</p>
          <p style="margin: 5px 0;"><strong>Status:</strong> ${taskData.task.status}</p>
          ${taskData.task.dueDate ? `<p style="margin: 5px 0;"><strong>Due Date:</strong> ${new Date(taskData.task.dueDate).toLocaleDateString()}</p>` : ''}
        </div>
        ${message ? `<div style="margin: 20px 0;"><strong>Message from ${senderName}:</strong><p style="padding: 10px; background: #f5f5f5; border-radius: 4px;">${message}</p></div>` : ''}
        <p>Please ensure this compliance requirement is addressed promptly.</p>
      `,
    });

    res.json({ success: true, message: 'Task escalated successfully' });
  } catch (error) {
    console.error('Error escalating task:', error);
    res.status(500).json({ error: 'Failed to escalate task' });
  }
});

// ===== BULK CREATE TASKS (for templates) =====
/**
 * POST /api/compliance-tasks/bulk
 * Create multiple tasks at once (for applying templates)
 */
router.post('/bulk', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { regulationId, tasks } = req.body;

    if (!regulationId || !tasks || !Array.isArray(tasks)) {
      return res.status(400).json({ error: 'regulationId and tasks array are required' });
    }

    const createdTasks: any[] = [];
    const taskIdMap = new Map<string, number>(); // Map temp IDs to real IDs for parent references

    // First pass: create all root tasks (no parent)
    for (const task of tasks.filter((t: any) => !t.parentTempId)) {
      const [newTask] = await db.insert(complianceTasks).values({
        regulationId,
        title: task.title,
        description: task.description,
        instructions: task.instructions,
        assignedRole: task.assignedRole,
        dueDate: task.dueDate ? new Date(task.dueDate) : null,
        priority: task.priority || 'medium',
        evidenceRequired: task.evidenceRequired || false,
        evidenceType: task.evidenceType || 'none',
        evidenceInstructions: task.evidenceInstructions,
        sortOrder: task.sortOrder || 0,
        status: 'pending',
        createdBy: req.user?.id,
      }).returning();

      createdTasks.push(newTask);
      if (task.tempId) {
        taskIdMap.set(task.tempId, newTask.id);
      }
    }

    // Second pass: create sub-tasks with parent references
    for (const task of tasks.filter((t: any) => t.parentTempId)) {
      const parentId = taskIdMap.get(task.parentTempId);
      if (!parentId) continue;

      const [newTask] = await db.insert(complianceTasks).values({
        regulationId,
        parentTaskId: parentId,
        title: task.title,
        description: task.description,
        instructions: task.instructions,
        assignedRole: task.assignedRole,
        dueDate: task.dueDate ? new Date(task.dueDate) : null,
        priority: task.priority || 'medium',
        evidenceRequired: task.evidenceRequired || false,
        evidenceType: task.evidenceType || 'none',
        evidenceInstructions: task.evidenceInstructions,
        sortOrder: task.sortOrder || 0,
        status: 'pending',
        createdBy: req.user?.id,
      }).returning();

      createdTasks.push(newTask);
    }

    res.status(201).json({ 
      success: true, 
      tasksCreated: createdTasks.length,
      tasks: createdTasks 
    });
  } catch (error) {
    console.error('Error bulk creating tasks:', error);
    res.status(500).json({ error: 'Failed to create tasks' });
  }
});

// ===== GET MY TASKS =====
/**
 * GET /api/compliance-tasks/my-tasks
 * Get all tasks assigned to the current user
 */
router.get('/my-tasks', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;

    const tasks = await db.select({
      task: complianceTasks,
      regulation: {
        id: regulations.id,
        name: regulations.name,
        topic: regulations.topic,
      }
    })
    .from(complianceTasks)
    .leftJoin(regulations, eq(complianceTasks.regulationId, regulations.id))
    .where(eq(complianceTasks.assignedTo, userId))
    .orderBy(asc(complianceTasks.dueDate), asc(complianceTasks.priority));

    res.json(tasks.map(t => ({ ...t.task, regulation: t.regulation })));
  } catch (error) {
    console.error('Error fetching my tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// ===== APPLY CLERY ACT TEMPLATE =====
/**
 * POST /api/compliance-tasks/apply-template/clery/:regulationId
 * Apply the Clery Act compliance task template to a regulation
 */
router.post('/apply-template/clery/:regulationId', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const regulationId = parseInt(req.params.regulationId);
    const { year } = req.body;
    
    // Check if regulation exists
    const [regulation] = await db.select().from(regulations).where(eq(regulations.id, regulationId));
    if (!regulation) {
      return res.status(404).json({ error: 'Regulation not found' });
    }

    // Check if tasks already exist for this regulation
    const existingTasks = await db.select().from(complianceTasks).where(eq(complianceTasks.regulationId, regulationId));
    if (existingTasks.length > 0) {
      return res.status(400).json({ 
        error: 'Tasks already exist for this regulation',
        existingCount: existingTasks.length,
        message: 'Delete existing tasks first or use a different regulation'
      });
    }

    // Get Clery tasks with dates for the specified year
    const cleryTasks = getCleryTasksWithDates(year || new Date().getFullYear());
    const taskIdMap = new Map<string, number>();
    const createdTasks: any[] = [];

    // First pass: create all root tasks (no parent)
    for (const task of cleryTasks.filter(t => !t.parentTempId)) {
      const [newTask] = await db.insert(complianceTasks).values({
        regulationId,
        title: task.title,
        description: task.description,
        instructions: task.instructions,
        assignedRole: task.assignedRole,
        dueDate: task.dueDate ? new Date(task.dueDate) : null,
        priority: task.priority,
        evidenceRequired: task.evidenceRequired,
        evidenceType: task.evidenceType,
        evidenceInstructions: task.evidenceInstructions,
        sortOrder: task.sortOrder,
        status: 'pending',
        createdBy: req.user?.id,
      }).returning();

      createdTasks.push(newTask);
      taskIdMap.set(task.tempId, newTask.id);
    }

    // Second pass: create sub-tasks
    for (const task of cleryTasks.filter(t => t.parentTempId)) {
      const parentId = taskIdMap.get(task.parentTempId!);
      if (!parentId) continue;

      const [newTask] = await db.insert(complianceTasks).values({
        regulationId,
        parentTaskId: parentId,
        title: task.title,
        description: task.description,
        instructions: task.instructions,
        assignedRole: task.assignedRole,
        dueDate: task.dueDate ? new Date(task.dueDate) : null,
        priority: task.priority,
        evidenceRequired: task.evidenceRequired,
        evidenceType: task.evidenceType,
        evidenceInstructions: task.evidenceInstructions,
        sortOrder: task.sortOrder,
        status: 'pending',
        createdBy: req.user?.id,
      }).returning();

      createdTasks.push(newTask);
    }

    // Log activity
    await db.insert(taskActivity).values({
      taskId: createdTasks[0].id,
      userId: req.user!.id,
      activityType: 'comment',
      content: `Applied Clery Act compliance template (${createdTasks.length} tasks created)`,
    });

    res.status(201).json({
      success: true,
      message: `Clery Act template applied successfully`,
      tasksCreated: createdTasks.length,
      stats: getCleryTaskCount(),
    });
  } catch (error) {
    console.error('Error applying Clery template:', error);
    res.status(500).json({ error: 'Failed to apply template' });
  }
});

// ===== GET AVAILABLE TEMPLATES =====
/**
 * GET /api/compliance-tasks/templates
 * Get list of available compliance task templates
 */
router.get('/templates', requireAuth, async (_req: Request, res: Response) => {
  try {
    res.json({
      templates: [
        {
          id: 'clery',
          name: 'Clery Act (Campus Security)',
          description: 'Comprehensive compliance checklist for the Jeanne Clery Act including ASR, crime statistics, timely warnings, emergency notifications, and VAWA requirements.',
          taskCount: getCleryTaskCount(),
          applicableTo: ['Clery Act', 'Campus Security', 'Crime Statistics'],
        },
        // Future templates can be added here
        // { id: 'ferpa', name: 'FERPA', ... },
        // { id: 'title-ix', name: 'Title IX', ... },
      ]
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// ===== EVIDENCE ENDPOINTS =====

/**
 * GET /api/compliance-tasks/:taskId/evidence
 * Get all evidence for a specific task
 */
router.get('/:taskId/evidence', requireAuth, async (req: Request, res: Response) => {
  try {
    const taskId = parseInt(req.params.taskId);
    
    if (isNaN(taskId)) {
      return res.status(400).json({ error: 'Invalid task ID' });
    }

    // Alias for uploaded by user
    const uploadedByUsers = alias(users, 'uploadedByUsers');

    const evidenceList = await db
      .select({
        id: taskEvidence.id,
        taskId: taskEvidence.taskId,
        fileName: taskEvidence.fileName,
        fileType: taskEvidence.fileType,
        fileSize: taskEvidence.fileSize,
        fileUrl: taskEvidence.fileUrl,
        linkUrl: taskEvidence.linkUrl,
        linkTitle: taskEvidence.linkTitle,
        description: taskEvidence.description,
        uploadedBy: taskEvidence.uploadedBy,
        createdAt: taskEvidence.createdAt,
        uploadedByUser: {
          id: uploadedByUsers.id,
          username: uploadedByUsers.username,
          email: uploadedByUsers.email,
          firstName: uploadedByUsers.firstName,
          lastName: uploadedByUsers.lastName,
        },
      })
      .from(taskEvidence)
      .leftJoin(uploadedByUsers, eq(taskEvidence.uploadedBy, uploadedByUsers.id))
      .where(eq(taskEvidence.taskId, taskId))
      .orderBy(desc(taskEvidence.createdAt));

    res.json(evidenceList);
  } catch (error) {
    console.error('Error fetching task evidence:', error);
    res.status(500).json({ error: 'Failed to fetch evidence' });
  }
});

/**
 * POST /api/compliance-tasks/:taskId/evidence
 * Upload evidence for a task (file or link)
 */
router.post('/:taskId/evidence', requireAuth, async (req: Request, res: Response) => {
  try {
    const taskId = parseInt(req.params.taskId);
    
    if (isNaN(taskId)) {
      return res.status(400).json({ error: 'Invalid task ID' });
    }

    // Check if task exists
    const task = await db.select().from(complianceTasks).where(eq(complianceTasks.id, taskId)).limit(1);
    if (task.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    let fileName = '';
    let fileType = null;
    let fileSize = null;
    let fileUrl = null;
    let linkUrl = null;
    let linkTitle = null;
    let description = '';

    // Check content type
    const contentType = req.headers['content-type'] || '';
    
    if (contentType.includes('multipart/form-data')) {
      // Handle file upload using busboy
      const busboy = await import('busboy');
      const bb = busboy.default({ headers: req.headers });
      
      const uploadPromise = new Promise<{
        fileName: string;
        fileType: string;
        fileSize: number;
        fileUrl: string;
        description: string;
        linkUrl?: string;
        linkTitle?: string;
      }>((resolve, reject) => {
        let uploadedFileName = '';
        let uploadedFileType = '';
        let uploadedFileSize = 0;
        let uploadedFileUrl = '';
        let uploadedDescription = '';
        let uploadedLinkUrl = '';
        let uploadedLinkTitle = '';
        const chunks: Buffer[] = [];

        bb.on('field', (name: string, val: string) => {
          if (name === 'description') uploadedDescription = val;
          if (name === 'linkUrl') uploadedLinkUrl = val;
          if (name === 'linkTitle') uploadedLinkTitle = val;
        });

        let fileWritePromise: Promise<void> | null = null;

        bb.on('file', (_name: string, file: import('stream').Readable, info: { filename: string; encoding: string; mimeType: string }) => {
          uploadedFileName = info.filename;
          uploadedFileType = info.mimeType;

          file.on('data', (data: Buffer) => {
            chunks.push(data);
            uploadedFileSize += data.length;
          });

          file.on('end', () => {
            // Create a promise for the file write operation
            fileWritePromise = (async () => {
              const fs = await import('fs/promises');
              const path = await import('path');
              
              const uploadsDir = path.join(process.cwd(), 'uploads', 'evidence');
              await fs.mkdir(uploadsDir, { recursive: true });

              // Generate unique filename
              const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${uploadedFileName}`;
              const filePath = path.join(uploadsDir, uniqueName);
              
              await fs.writeFile(filePath, Buffer.concat(chunks));
              uploadedFileUrl = `/uploads/evidence/${uniqueName}`;
            })();
          });
        });

        bb.on('close', async () => {
          // Wait for file write to complete before resolving
          if (fileWritePromise) {
            await fileWritePromise;
          }
          resolve({
            fileName: uploadedFileName || uploadedLinkTitle || 'Link',
            fileType: uploadedFileType,
            fileSize: uploadedFileSize,
            fileUrl: uploadedFileUrl,
            description: uploadedDescription,
            linkUrl: uploadedLinkUrl,
            linkTitle: uploadedLinkTitle,
          });
        });

        bb.on('error', reject);
        req.pipe(bb);
      });

      const uploadData = await uploadPromise;
      fileName = uploadData.fileName;
      fileType = uploadData.fileType || null;
      fileSize = uploadData.fileSize || null;
      fileUrl = uploadData.fileUrl || null;
      linkUrl = uploadData.linkUrl || null;
      linkTitle = uploadData.linkTitle || null;
      description = uploadData.description || '';

    } else {
      // Handle JSON body (for link submissions)
      const body = req.body;
      if (body.linkUrl) {
        linkUrl = body.linkUrl;
        linkTitle = body.linkTitle || body.linkUrl;
        fileName = body.linkTitle || 'Link';
        description = body.description || '';
      } else {
        return res.status(400).json({ error: 'No file or link provided' });
      }
    }

    // Insert evidence record
    const [newEvidence] = await db.insert(taskEvidence).values({
      taskId,
      fileName,
      fileType,
      fileSize,
      fileUrl,
      linkUrl,
      linkTitle,
      description,
      uploadedBy: req.user!.id,
    }).returning();

    // Log activity
    await db.insert(taskActivity).values({
      taskId,
      userId: req.user!.id,
      activityType: 'evidence_uploaded',
      content: `Uploaded evidence: ${fileName}`,
    });

    res.status(201).json(newEvidence);
  } catch (error) {
    console.error('Error uploading evidence:', error);
    res.status(500).json({ error: 'Failed to upload evidence' });
  }
});

/**
 * DELETE /api/compliance-tasks/:taskId/evidence/:evidenceId
 * Delete evidence from a task
 */
router.delete('/:taskId/evidence/:evidenceId', requireAdmin, async (req: Request, res: Response) => {
  try {
    const taskId = parseInt(req.params.taskId);
    const evidenceId = parseInt(req.params.evidenceId);
    
    if (isNaN(taskId) || isNaN(evidenceId)) {
      return res.status(400).json({ error: 'Invalid IDs' });
    }

    // Get evidence to delete (for file cleanup and logging)
    const existingEvidence = await db
      .select()
      .from(taskEvidence)
      .where(eq(taskEvidence.id, evidenceId))
      .limit(1);

    if (existingEvidence.length === 0) {
      return res.status(404).json({ error: 'Evidence not found' });
    }

    // Delete file if exists
    if (existingEvidence[0].fileUrl) {
      try {
        const fs = await import('fs/promises');
        const path = await import('path');
        const filePath = path.join(process.cwd(), existingEvidence[0].fileUrl);
        await fs.unlink(filePath);
      } catch (e) {
        console.warn('Could not delete file:', e);
      }
    }

    // Delete evidence record
    await db.delete(taskEvidence).where(eq(taskEvidence.id, evidenceId));

    // Log activity
    await db.insert(taskActivity).values({
      taskId,
      userId: req.user!.id,
      activityType: 'comment',
      content: `Deleted evidence: ${existingEvidence[0].fileName}`,
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting evidence:', error);
    res.status(500).json({ error: 'Failed to delete evidence' });
  }
});

// ===== ACTIVITY ENDPOINTS =====

/**
 * GET /api/compliance-tasks/:taskId/activity
 * Get activity log for a specific task
 */
router.get('/:taskId/activity', requireAuth, async (req: Request, res: Response) => {
  try {
    const taskId = parseInt(req.params.taskId);
    
    if (isNaN(taskId)) {
      return res.status(400).json({ error: 'Invalid task ID' });
    }

    // Alias for activity user
    const activityUsers = alias(users, 'activityUsers');

    const activityList = await db
      .select({
        id: taskActivity.id,
        taskId: taskActivity.taskId,
        userId: taskActivity.userId,
        activityType: taskActivity.activityType,
        content: taskActivity.content,
        previousValue: taskActivity.previousValue,
        newValue: taskActivity.newValue,
        createdAt: taskActivity.createdAt,
        user: {
          id: activityUsers.id,
          username: activityUsers.username,
          email: activityUsers.email,
          firstName: activityUsers.firstName,
          lastName: activityUsers.lastName,
        },
      })
      .from(taskActivity)
      .leftJoin(activityUsers, eq(taskActivity.userId, activityUsers.id))
      .where(eq(taskActivity.taskId, taskId))
      .orderBy(desc(taskActivity.createdAt));

    res.json(activityList);
  } catch (error) {
    console.error('Error fetching task activity:', error);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

/**
 * POST /api/compliance-tasks/:taskId/activity
 * Add activity (comment) to a task
 */
router.post('/:taskId/activity', requireAuth, async (req: Request, res: Response) => {
  try {
    const taskId = parseInt(req.params.taskId);
    
    if (isNaN(taskId)) {
      return res.status(400).json({ error: 'Invalid task ID' });
    }

    const { activityType, content } = req.body;

    if (!activityType || !content) {
      return res.status(400).json({ error: 'Activity type and content are required' });
    }

    const [newActivity] = await db.insert(taskActivity).values({
      taskId,
      userId: req.user!.id,
      activityType,
      content,
    }).returning();

    res.status(201).json(newActivity);
  } catch (error) {
    console.error('Error adding activity:', error);
    res.status(500).json({ error: 'Failed to add activity' });
  }
});

// ===== TASK EMAIL LINK ENDPOINTS =====

interface TaskTokenPayload {
  taskId: number;
  userId: number;
  regulationId: number;
  type: 'task_access';
  iat?: number;
  exp?: number;
}

/**
 * POST /api/compliance-tasks/:taskId/generate-link
 * Generate a secure link for task completion via email
 */
router.post('/:taskId/generate-link', requireAdmin, async (req: Request, res: Response) => {
  try {
    const taskId = parseInt(req.params.taskId);
    const { userId } = req.body;
    
    if (isNaN(taskId)) {
      return res.status(400).json({ error: 'Invalid task ID' });
    }

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Get task details
    const task = await db
      .select({
        id: complianceTasks.id,
        title: complianceTasks.title,
        regulationId: complianceTasks.regulationId,
      })
      .from(complianceTasks)
      .where(eq(complianceTasks.id, taskId))
      .limit(1);

    if (task.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Get user details
    const user = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Generate JWT token
    const payload: TaskTokenPayload = {
      taskId,
      userId,
      regulationId: task[0].regulationId,
      type: 'task_access',
    };

    const token = jwt.sign(payload, TASK_TOKEN_SECRET, { expiresIn: TASK_TOKEN_EXPIRY });

    // Build the task URL
    const baseUrl = process.env.APP_URL || `http://${req.headers.host}`;
    const taskUrl = `${baseUrl}/task/${token}`;

    res.json({
      success: true,
      taskUrl,
      token,
      expiresIn: TASK_TOKEN_EXPIRY,
      task: task[0],
      user: user[0],
    });
  } catch (error) {
    console.error('Error generating task link:', error);
    res.status(500).json({ error: 'Failed to generate task link' });
  }
});

/**
 * POST /api/compliance-tasks/:taskId/send-task-email
 * Send a task assignment/reminder email with a direct link
 */
router.post('/:taskId/send-task-email', requireAdmin, async (req: Request, res: Response) => {
  try {
    const taskId = parseInt(req.params.taskId);
    const { userId, subject, message, emailType = 'assignment' } = req.body;
    
    if (isNaN(taskId)) {
      return res.status(400).json({ error: 'Invalid task ID' });
    }

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Get task details with regulation
    const taskWithRegulation = await db
      .select({
        id: complianceTasks.id,
        title: complianceTasks.title,
        description: complianceTasks.description,
        instructions: complianceTasks.instructions,
        dueDate: complianceTasks.dueDate,
        priority: complianceTasks.priority,
        evidenceRequired: complianceTasks.evidenceRequired,
        regulationId: complianceTasks.regulationId,
        regulationName: regulations.name,
      })
      .from(complianceTasks)
      .leftJoin(regulations, eq(complianceTasks.regulationId, regulations.id))
      .where(eq(complianceTasks.id, taskId))
      .limit(1);

    if (taskWithRegulation.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = taskWithRegulation[0];

    // Get user details
    const user = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        username: users.username,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const recipient = user[0];

    // Generate JWT token for direct access
    const payload: TaskTokenPayload = {
      taskId,
      userId,
      regulationId: task.regulationId,
      type: 'task_access',
    };

    const token = jwt.sign(payload, TASK_TOKEN_SECRET, { expiresIn: TASK_TOKEN_EXPIRY });

    // Build the task URL
    const baseUrl = process.env.APP_URL || `http://${req.headers.host}`;
    const taskUrl = `${baseUrl}/task/${token}`;

    // Build email content
    const recipientName = recipient.firstName && recipient.lastName 
      ? `${recipient.firstName} ${recipient.lastName}`
      : recipient.username;

    const emailSubject = subject || (emailType === 'nudge' 
      ? `Reminder: ${task.title} - Action Required`
      : `Task Assignment: ${task.title}`);

    const dueDateText = task.dueDate 
      ? `Due Date: ${new Date(task.dueDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
      : 'No due date specified';

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1e3a5f 0%, #2c5282 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Compliance Task ${emailType === 'nudge' ? 'Reminder' : 'Assignment'}</h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 30px; border: 1px solid #e9ecef; border-top: none;">
          <p style="margin-top: 0;">Dear ${recipientName},</p>
          
          ${message ? `<p>${message}</p>` : ''}
          
          <div style="background: white; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h2 style="margin-top: 0; color: #1e3a5f; font-size: 18px;">${task.title}</h2>
            <p style="color: #666; margin-bottom: 10px;"><strong>Regulation:</strong> ${task.regulationName}</p>
            <p style="color: #666; margin-bottom: 10px;"><strong>${dueDateText}</strong></p>
            <p style="color: #666; margin-bottom: 10px;"><strong>Priority:</strong> <span style="text-transform: capitalize;">${task.priority}</span></p>
            ${task.evidenceRequired ? '<p style="color: #b45309; margin-bottom: 10px;">📎 Evidence upload required</p>' : ''}
            ${task.description ? `<p style="color: #666;">${task.description}</p>` : ''}
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${taskUrl}" style="display: inline-block; background: #1e3a5f; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600;">
              View & Complete Task
            </a>
          </div>
          
          <p style="font-size: 12px; color: #666;">
            This link will expire in 14 days. If you have questions about this task, please contact your compliance officer.
          </p>
        </div>
        
        <div style="text-align: center; padding: 20px; color: #666; font-size: 12px;">
          <p>EdSteward Compliance Management Platform</p>
        </div>
      </body>
      </html>
    `;

    // Send email
    await emailService.sendEmail({
      to: recipient.email,
      subject: emailSubject,
      html: htmlContent,
    });

    // Log activity
    await db.insert(taskActivity).values({
      taskId,
      userId: req.user!.id,
      activityType: emailType === 'nudge' ? 'nudge' : 'comment',
      content: `${emailType === 'nudge' ? 'Sent reminder' : 'Sent task assignment'} email to ${recipientName} (${recipient.email})`,
    });

    res.json({
      success: true,
      message: `Email sent to ${recipient.email}`,
    });
  } catch (error) {
    console.error('Error sending task email:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

/**
 * GET /api/compliance-tasks/token/:token
 * Verify a task token and return task details (no auth required)
 */
router.get('/token/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    // Verify token
    let payload: TaskTokenPayload;
    try {
      payload = jwt.verify(token, TASK_TOKEN_SECRET) as TaskTokenPayload;
    } catch (e) {
      if ((e as Error).name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token has expired', code: 'TOKEN_EXPIRED' });
      }
      return res.status(401).json({ error: 'Invalid token', code: 'INVALID_TOKEN' });
    }

    if (payload.type !== 'task_access') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    // Get task details with regulation
    const taskResult = await db
      .select({
        id: complianceTasks.id,
        title: complianceTasks.title,
        description: complianceTasks.description,
        instructions: complianceTasks.instructions,
        dueDate: complianceTasks.dueDate,
        status: complianceTasks.status,
        priority: complianceTasks.priority,
        evidenceRequired: complianceTasks.evidenceRequired,
        evidenceType: complianceTasks.evidenceType,
        evidenceInstructions: complianceTasks.evidenceInstructions,
        completedAt: complianceTasks.completedAt,
        regulationId: complianceTasks.regulationId,
        regulationName: regulations.name,
        completedByUser: {
          id: completedByUsers.id,
          username: completedByUsers.username,
          email: completedByUsers.email,
          firstName: completedByUsers.firstName,
          lastName: completedByUsers.lastName,
        },
      })
      .from(complianceTasks)
      .leftJoin(regulations, eq(complianceTasks.regulationId, regulations.id))
      .leftJoin(completedByUsers, eq(complianceTasks.completedBy, completedByUsers.id))
      .where(eq(complianceTasks.id, payload.taskId))
      .limit(1);

    if (taskResult.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Get user details
    const userResult = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    if (userResult.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      task: taskResult[0],
      user: userResult[0],
      tokenValid: true,
    });
  } catch (error) {
    console.error('Error verifying task token:', error);
    res.status(500).json({ error: 'Failed to verify token' });
  }
});

/**
 * POST /api/compliance-tasks/token/:token/complete
 * Complete a task using a valid token (no auth required)
 */
router.post('/token/:token/complete', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    // Verify token
    let payload: TaskTokenPayload;
    try {
      payload = jwt.verify(token, TASK_TOKEN_SECRET) as TaskTokenPayload;
    } catch (e) {
      if ((e as Error).name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token has expired', code: 'TOKEN_EXPIRED' });
      }
      return res.status(401).json({ error: 'Invalid token', code: 'INVALID_TOKEN' });
    }

    if (payload.type !== 'task_access') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    // Get current task status
    const currentTask = await db
      .select()
      .from(complianceTasks)
      .where(eq(complianceTasks.id, payload.taskId))
      .limit(1);

    if (currentTask.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    if (currentTask[0].status === 'completed') {
      return res.status(400).json({ error: 'Task is already completed' });
    }

    // Get user for activity log
    const user = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .where(eq(users.id, payload.userId))
      .limit(1);

    if (user.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Update task status
    const [updatedTask] = await db
      .update(complianceTasks)
      .set({
        status: 'completed',
        completedAt: new Date(),
        completedBy: payload.userId,
        updatedAt: new Date(),
      })
      .where(eq(complianceTasks.id, payload.taskId))
      .returning();

    // Log activity
    const userName = user[0].firstName && user[0].lastName
      ? `${user[0].firstName} ${user[0].lastName}`
      : user[0].username;

    await db.insert(taskActivity).values({
      taskId: payload.taskId,
      userId: payload.userId,
      activityType: 'status_change',
      content: `Task completed via email link by ${userName}`,
      previousValue: currentTask[0].status,
      newValue: 'completed',
    });

    res.json({
      success: true,
      task: updatedTask,
      completedBy: user[0],
      completedAt: updatedTask.completedAt,
    });
  } catch (error) {
    console.error('Error completing task via token:', error);
    res.status(500).json({ error: 'Failed to complete task' });
  }
});

// ===== BULK OPERATIONS =====

/**
 * POST /api/compliance-tasks/bulk/assign
 * Assign multiple tasks to a user (admin only)
 */
router.post('/bulk/assign', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { taskIds, userId, role } = req.body;

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ error: 'Task IDs array required' });
    }

    if (!userId && !role) {
      return res.status(400).json({ error: 'Either userId or role required' });
    }

    // Verify user exists if userId provided
    if (userId) {
      const userResult = await db.select().from(users).where(eq(users.id, userId));
      if (!userResult.length) {
        return res.status(404).json({ error: 'User not found' });
      }
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (userId) updateData.assignedTo = userId;
    if (role) updateData.assignedRole = role;

    // Update all tasks
    const updatedTasks = [];
    for (const taskId of taskIds) {
      const result = await db.update(complianceTasks)
        .set(updateData)
        .where(eq(complianceTasks.id, taskId))
        .returning();
      
      if (result.length) {
        updatedTasks.push(result[0]);
        
        // Log activity
        await db.insert(taskActivity).values({
          taskId,
          userId: req.user!.id,
          activityType: 'assignment',
          content: `Bulk assigned to ${userId ? `user ${userId}` : `role "${role}"`}`,
        });
      }
    }

    res.json({
      success: true,
      updatedCount: updatedTasks.length,
      tasks: updatedTasks,
    });
  } catch (error) {
    console.error('Error bulk assigning tasks:', error);
    res.status(500).json({ error: 'Failed to bulk assign tasks' });
  }
});

/**
 * POST /api/compliance-tasks/bulk/status
 * Update status of multiple tasks (admin only)
 */
router.post('/bulk/status', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { taskIds, status } = req.body;

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ error: 'Task IDs array required' });
    }

    const validStatuses = ['pending', 'in_progress', 'completed', 'blocked'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    const updateData: Record<string, unknown> = { 
      status,
      updatedAt: new Date(),
    };
    
    // If completing, set completion data
    if (status === 'completed') {
      updateData.completedAt = new Date();
      updateData.completedBy = req.user!.id;
    } else {
      // If un-completing, clear completion data
      updateData.completedAt = null;
      updateData.completedBy = null;
    }

    const updatedTasks = [];
    for (const taskId of taskIds) {
      // Get current status for logging
      const currentTask = await db.select().from(complianceTasks).where(eq(complianceTasks.id, taskId));
      
      const result = await db.update(complianceTasks)
        .set(updateData)
        .where(eq(complianceTasks.id, taskId))
        .returning();
      
      if (result.length) {
        updatedTasks.push(result[0]);
        
        // Log activity
        await db.insert(taskActivity).values({
          taskId,
          userId: req.user!.id,
          activityType: 'status_change',
          content: `Bulk status change`,
          previousValue: currentTask[0]?.status,
          newValue: status,
        });
      }
    }

    res.json({
      success: true,
      updatedCount: updatedTasks.length,
      tasks: updatedTasks,
    });
  } catch (error) {
    console.error('Error bulk updating task status:', error);
    res.status(500).json({ error: 'Failed to bulk update task status' });
  }
});

/**
 * POST /api/compliance-tasks/bulk/notify
 * Send notifications for multiple tasks (admin only)
 */
router.post('/bulk/notify', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { taskIds, notificationType = 'nudge' } = req.body;

    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      return res.status(400).json({ error: 'Task IDs array required' });
    }

    const { sendImmediateTaskNotification } = await import('../../services/task-notifications');
    
    const results = {
      sent: 0,
      failed: 0,
      errors: [] as string[],
    };

    for (const taskId of taskIds) {
      try {
        const success = await sendImmediateTaskNotification(taskId, notificationType);
        if (success) {
          results.sent++;
        } else {
          results.failed++;
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`Task ${taskId}: ${error}`);
      }
    }

    res.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error('Error bulk sending notifications:', error);
    res.status(500).json({ error: 'Failed to bulk send notifications' });
  }
});

// ===== TASK ANALYTICS =====

/**
 * GET /api/compliance-tasks/analytics
 * Get task analytics/statistics (admin only)
 */
router.get('/analytics', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const today = new Date();
    
    // Get all tasks
    const allTasks = await db.select({
      id: complianceTasks.id,
      status: complianceTasks.status,
      priority: complianceTasks.priority,
      dueDate: complianceTasks.dueDate,
      regulationId: complianceTasks.regulationId,
      assignedRole: complianceTasks.assignedRole,
      completedAt: complianceTasks.completedAt,
      parentTaskId: complianceTasks.parentTaskId,
    })
    .from(complianceTasks);

    // Get regulation names for grouping
    const regulationsList = await db.select({
      id: regulations.id,
      name: regulations.name,
    }).from(regulations);
    
    const regulationMap = new Map(regulationsList.map(r => [r.id, r.name]));

    // Calculate overview stats
    const total = allTasks.length;
    const completed = allTasks.filter(t => t.status === 'completed').length;
    const pending = allTasks.filter(t => t.status === 'pending').length;
    const inProgress = allTasks.filter(t => t.status === 'in_progress').length;
    const blocked = allTasks.filter(t => t.status === 'blocked').length;
    
    // Overdue tasks (due date passed, not completed)
    const overdue = allTasks.filter(t => 
      t.status !== 'completed' && 
      t.dueDate && 
      new Date(t.dueDate) < today
    ).length;

    // Due soon (next 7 days)
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const dueSoon = allTasks.filter(t => 
      t.status !== 'completed' && 
      t.dueDate && 
      new Date(t.dueDate) >= today &&
      new Date(t.dueDate) <= nextWeek
    ).length;

    // Parent vs sub-tasks
    const parentTasks = allTasks.filter(t => !t.parentTaskId).length;
    const subTasks = allTasks.filter(t => t.parentTaskId).length;

    // By regulation
    const byRegulation: Record<string, { total: number; completed: number; pending: number; overdue: number }> = {};
    allTasks.forEach(t => {
      const regName = regulationMap.get(t.regulationId) || `Regulation ${t.regulationId}`;
      if (!byRegulation[regName]) {
        byRegulation[regName] = { total: 0, completed: 0, pending: 0, overdue: 0 };
      }
      byRegulation[regName].total++;
      if (t.status === 'completed') {
        byRegulation[regName].completed++;
      } else {
        byRegulation[regName].pending++;
        if (t.dueDate && new Date(t.dueDate) < today) {
          byRegulation[regName].overdue++;
        }
      }
    });

    // By priority
    const byPriority = {
      critical: allTasks.filter(t => t.priority === 'critical').length,
      high: allTasks.filter(t => t.priority === 'high').length,
      medium: allTasks.filter(t => t.priority === 'medium').length,
      low: allTasks.filter(t => t.priority === 'low').length,
    };

    // By assigned role (top 10)
    const roleCount: Record<string, number> = {};
    allTasks.forEach(t => {
      const role = t.assignedRole || 'Unassigned';
      roleCount[role] = (roleCount[role] || 0) + 1;
    });
    const byRole = Object.entries(roleCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([role, count]) => ({ role, count }));

    // Completion trend (last 30 days)
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const completedTasks = allTasks.filter(t => 
      t.status === 'completed' && 
      t.completedAt && 
      new Date(t.completedAt) >= thirtyDaysAgo
    );

    // Group by day
    const completionsByDay: Record<string, number> = {};
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const key = date.toISOString().split('T')[0];
      completionsByDay[key] = 0;
    }
    
    completedTasks.forEach(t => {
      if (t.completedAt) {
        const key = new Date(t.completedAt).toISOString().split('T')[0];
        if (completionsByDay[key] !== undefined) {
          completionsByDay[key]++;
        }
      }
    });

    const completionTrend = Object.entries(completionsByDay)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }));

    res.json({
      overview: {
        total,
        completed,
        pending,
        inProgress,
        blocked,
        overdue,
        dueSoon,
        parentTasks,
        subTasks,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
      },
      byRegulation,
      byPriority,
      byRole,
      completionTrend,
    });
  } catch (error) {
    console.error('Error fetching task analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// ===== TASK NOTIFICATIONS =====

/**
 * POST /api/compliance-tasks/notifications/check
 * Trigger task notification check (admin only)
 * This would typically be called by a cron job
 */
router.post('/notifications/check', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const { checkAndSendTaskNotifications } = await import('../../services/task-notifications');
    const results = await checkAndSendTaskNotifications();
    
    res.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error('Error checking task notifications:', error);
    res.status(500).json({ error: 'Failed to check task notifications' });
  }
});

/**
 * POST /api/compliance-tasks/:taskId/notify
 * Send immediate notification for a specific task (admin only)
 */
router.post('/:taskId/notify', requireAdmin, async (req: Request, res: Response) => {
  try {
    const taskId = parseInt(req.params.taskId);
    const { type = 'nudge' } = req.body;
    
    if (isNaN(taskId)) {
      return res.status(400).json({ error: 'Invalid task ID' });
    }

    const { sendImmediateTaskNotification } = await import('../../services/task-notifications');
    const success = await sendImmediateTaskNotification(taskId, type);
    
    if (success) {
      res.json({ success: true, message: 'Notification sent' });
    } else {
      res.status(400).json({ error: 'Failed to send notification' });
    }
  } catch (error) {
    console.error('Error sending task notification:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

/**
 * GET /api/compliance-tasks/notifications/scheduler-status
 * Get the current status of the task notification scheduler (admin only)
 */
router.get('/notifications/scheduler-status', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const { getSchedulerStatus } = await import('../../services/task-scheduler');
    const status = getSchedulerStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting scheduler status:', error);
    res.status(500).json({ error: 'Failed to get scheduler status' });
  }
});

export default router;

