/**
 * Compliance Tasks API
 * 
 * Manages hierarchical task management for complex regulations.
 * Supports sub-tasks, per-task DRIs, evidence requirements, and activity tracking.
 */

import { Router, Request, Response } from 'express';
import { db } from '../../db';
import { complianceTasks, taskEvidence, taskActivity, users, regulations } from '@shared/schema';
import { eq, desc, asc } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { requireAuth, requireAdmin } from '../../middleware/role-based-auth';
import { emailService } from '../../services/email';
import { getCleryTasksWithDates, getCleryTaskCount } from '../../templates/clery-act-tasks';

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

    // Get evidence counts for each task
    const evidenceCounts = await db.select({
      taskId: taskEvidence.taskId,
    })
    .from(taskEvidence);

    const evidenceByTask = evidenceCounts.reduce((acc, e) => {
      acc[e.taskId] = (acc[e.taskId] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    // Build hierarchical structure
    const taskMap = new Map<number, any>();
    const rootTasks: any[] = [];

    tasks.forEach(({ task, assignedUser, completedByUser }) => {
      const taskWithMeta = {
        ...task,
        assignedUser: assignedUser?.id ? assignedUser : null,
        completedByUser: completedByUser?.id ? completedByUser : null,
        evidenceCount: evidenceByTask[task.id] || 0,
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

export default router;

