/**
 * Dashboard Analytics API
 * Provides real-time compliance metrics for executive dashboards
 */

import express from 'express';
import { getDbForRequest } from '../../services/database';
import { regulations, deadlines, complianceTasks, users, attestationTokens } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = express.Router();

// Get comprehensive dashboard analytics
router.get('/', async (req, res) => {
  try {
    // TENANT ISOLATION: Get tenant-specific database
    const db = getDbForRequest(req);
    
    const now = new Date();
    const _thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // === REGULATIONS METRICS ===
    // Filter by is_current = true to exclude deprecated/duplicate regulations (MCP Engine sync Jan 2026)
    const allRegulations = await db.select().from(regulations).where(eq(regulations.isCurrent, true));
    const totalRegulations = allRegulations.length;
    
    // Count by compliance status
    const compliantRegs = allRegulations.filter(r => (r as any).complianceStatus === 'compliant').length;
    const needsAttentionRegs = allRegulations.filter(r => 
      (r as any).complianceStatus === 'needs_attention' || (r as any).complianceStatus === 'in_progress'
    ).length;
    const nonCompliantRegs = allRegulations.filter(r => 
      (r as any).complianceStatus === 'non_compliant' || (r as any).complianceStatus === 'overdue'
    ).length;
    const pendingRegs = allRegulations.filter(r => 
      !(r as any).complianceStatus || (r as any).complianceStatus === 'pending' || (r as any).complianceStatus === 'not_started'
    ).length;

    // Count by category
    const categoryBreakdown: Record<string, { total: number; compliant: number }> = {};
    allRegulations.forEach(reg => {
      const cat = reg.category || 'Uncategorized';
      if (!categoryBreakdown[cat]) {
        categoryBreakdown[cat] = { total: 0, compliant: 0 };
      }
      categoryBreakdown[cat].total++;
      if ((reg as any).complianceStatus === 'compliant') {
        categoryBreakdown[cat].compliant++;
      }
    });

    // === DEADLINES METRICS ===
    const allDeadlines = await db.select().from(deadlines);
    const totalDeadlines = allDeadlines.length;
    
    const overdueDeadlines = allDeadlines.filter(d => {
      const due = new Date(d.dueDate);
      return due < now && d.status !== 'completed';
    }).length;
    
    const upcomingDeadlines = allDeadlines.filter(d => {
      const due = new Date(d.dueDate);
      return due >= now && due <= thirtyDaysFromNow && d.status !== 'completed';
    }).length;
    
    const completedDeadlines = allDeadlines.filter(d => d.status === 'completed').length;

    // Deadlines due this week
    const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const dueThisWeek = allDeadlines.filter(d => {
      const due = new Date(d.dueDate);
      return due >= now && due <= oneWeekFromNow && d.status !== 'completed';
    });

    // === COMPLIANCE TASKS METRICS ===
    const allTasks = await db.select().from(complianceTasks);
    const totalTasks = allTasks.length;
    const completedTasks = allTasks.filter(t => t.status === 'completed').length;
    const inProgressTasks = allTasks.filter(t => t.status === 'in_progress').length;
    const pendingTasks = allTasks.filter(t => t.status === 'pending' || t.status === 'not_started').length;
    const overdueTasks = allTasks.filter(t => {
      if (t.status === 'completed') return false;
      if (!t.dueDate) return false;
      return new Date(t.dueDate) < now;
    }).length;

    const rootTaskCount = allTasks.filter(t => !t.parentTaskId).length;
    const subtaskCount = allTasks.filter(t => !!t.parentTaskId).length;

    // === REQUIREMENT TYPE BREAKDOWN (MCP Engine sync Jan 2026) ===
    // Separate legally mandated requirements from best practices
    const requirementTasks = allTasks.filter(t => !t.requirementType || t.requirementType === 'requirement');
    const bestPracticeTasks = allTasks.filter(t => t.requirementType === 'best_practice');
    
    const totalRequirements = requirementTasks.length;
    const completedRequirements = requirementTasks.filter(t => t.status === 'completed').length;
    const totalBestPractices = bestPracticeTasks.length;
    const completedBestPractices = bestPracticeTasks.filter(t => t.status === 'completed').length;

    // Tasks by regulation
    const tasksByRegulation: Record<number, { total: number; completed: number; regName: string }> = {};
    for (const task of allTasks) {
      if (!task.regulationId) continue;
      if (!tasksByRegulation[task.regulationId]) {
        const reg = allRegulations.find(r => r.id === task.regulationId);
        tasksByRegulation[task.regulationId] = { 
          total: 0, 
          completed: 0, 
          regName: reg?.name || `Regulation ${task.regulationId}` 
        };
      }
      tasksByRegulation[task.regulationId].total++;
      if (task.status === 'completed') {
        tasksByRegulation[task.regulationId].completed++;
      }
    }

    // === USERS METRICS ===
    const allUsers = await db.select().from(users);
    const totalUsers = allUsers.length;
    const adminCount = allUsers.filter(u => u.role?.toLowerCase() === 'admin').length;
    const officerCount = allUsers.filter(u => u.role?.toLowerCase() === 'compliance_officer').length;

    // === ATTESTATION METRICS ===
    const allAttestations = await db.select().from(attestationTokens);
    const completedAttestations = allAttestations.filter(a => a.completedAt !== null).length;
    const pendingAttestations = allAttestations.filter(a => a.completedAt === null && new Date(a.expiresAt) > now).length;

    // === CALCULATE OVERALL COMPLIANCE SCORE ===
    // Updated formula (MCP Engine sync Jan 2026):
    // - 40% regulation compliance status
    // - 30% REQUIREMENT task completion (legally mandated tasks)
    // - 20% deadline completion rate
    // - 10% attestation completion rate
    // - Bonus: up to 10% for best practice completion
    
    const regComplianceRate = totalRegulations > 0 
      ? (compliantRegs / totalRegulations) * 100 
      : 0;
    
    // Requirements are the primary measure - legally mandated tasks
    const requirementCompletionRate = totalRequirements > 0 
      ? (completedRequirements / totalRequirements) * 100 
      : 100; // If no requirements, consider it 100%
    
    // Best practices provide bonus points but don't affect the main score negatively
    const bestPracticeBonus = totalBestPractices > 0 
      ? (completedBestPractices / totalBestPractices) * 10 // Up to 10% bonus
      : 0;
    
    const deadlineCompletionRate = totalDeadlines > 0 
      ? (completedDeadlines / totalDeadlines) * 100 
      : 100;
    
    const attestationRate = (completedAttestations + pendingAttestations) > 0 
      ? (completedAttestations / (completedAttestations + pendingAttestations)) * 100 
      : 100;

    // Base score from requirements (capped at 100), plus best practice bonus
    const baseScore = Math.round(
      (regComplianceRate * 0.4) + 
      (requirementCompletionRate * 0.3) + 
      (deadlineCompletionRate * 0.2) + 
      (attestationRate * 0.1)
    );
    
    // Final score: base + best practice bonus, capped at 100
    const overallComplianceScore = Math.min(baseScore + Math.round(bestPracticeBonus), 100);

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (overallComplianceScore < 50 || overdueDeadlines > 5 || overdueTasks > 10) {
      riskLevel = 'critical';
    } else if (overallComplianceScore < 70 || overdueDeadlines > 2 || overdueTasks > 5) {
      riskLevel = 'high';
    } else if (overallComplianceScore < 85 || overdueDeadlines > 0 || overdueTasks > 2) {
      riskLevel = 'medium';
    }

    // === TOP REGULATIONS NEEDING ATTENTION ===
    const regulationsNeedingAttention = allRegulations
      .filter(r => (r as any).complianceStatus !== 'compliant')
      .map(r => {
        const regTasks = tasksByRegulation[r.id] || { total: 0, completed: 0 };
        const completionRate = regTasks.total > 0 
          ? Math.round((regTasks.completed / regTasks.total) * 100) 
          : 0;
        return {
          id: r.id,
          name: r.name,
          category: r.category,
          status: (r as any).complianceStatus || 'pending',
          taskCompletion: completionRate,
          totalTasks: regTasks.total,
          completedTasks: regTasks.completed
        };
      })
      .sort((a, b) => a.taskCompletion - b.taskCompletion)
      .slice(0, 5);

    // === CATEGORY PERFORMANCE ===
    const categoryPerformance = Object.entries(categoryBreakdown).map(([name, data]) => ({
      name,
      total: data.total,
      compliant: data.compliant,
      rate: data.total > 0 ? parseFloat(((data.compliant / data.total) * 100).toFixed(1)) : 0
    })).sort((a, b) => b.total - a.total);

    // === BUILD RESPONSE ===
    res.json({
      overview: {
        complianceScore: overallComplianceScore,
        riskLevel,
        lastUpdated: now.toISOString()
      },
      regulations: {
        total: totalRegulations,
        compliant: compliantRegs,
        needsAttention: needsAttentionRegs,
        nonCompliant: nonCompliantRegs,
        pending: pendingRegs,
        complianceRate: parseFloat(regComplianceRate.toFixed(1))
      },
      tasks: {
        total: totalTasks,
        completed: completedTasks,
        inProgress: inProgressTasks,
        pending: pendingTasks,
        overdue: overdueTasks,
        rootCount: rootTaskCount,
        subtaskCount,
        completionRate: parseFloat(requirementCompletionRate.toFixed(1)),
        // Requirement type breakdown (MCP Engine sync Jan 2026)
        requirements: {
          total: totalRequirements,
          completed: completedRequirements,
          completionRate: totalRequirements > 0 ? parseFloat(((completedRequirements / totalRequirements) * 100).toFixed(1)) : 100
        },
        bestPractices: {
          total: totalBestPractices,
          completed: completedBestPractices,
          completionRate: totalBestPractices > 0 ? parseFloat(((completedBestPractices / totalBestPractices) * 100).toFixed(1)) : 0,
          bonus: parseFloat(bestPracticeBonus.toFixed(1))
        }
      },
      deadlines: {
        total: totalDeadlines,
        completed: completedDeadlines,
        upcoming: upcomingDeadlines,
        overdue: overdueDeadlines,
        dueThisWeek: dueThisWeek.map(d => ({
          id: d.id,
          title: d.description,
          dueDate: d.dueDate,
          regulationId: d.regulationId
        })),
        completionRate: parseFloat(deadlineCompletionRate.toFixed(1))
      },
      attestations: {
        completed: completedAttestations,
        pending: pendingAttestations,
        rate: parseFloat(attestationRate.toFixed(1))
      },
      users: {
        total: totalUsers,
        admins: adminCount,
        complianceOfficers: officerCount
      },
      topIssues: regulationsNeedingAttention,
      categoryPerformance
    });
  } catch (error) {
    console.error('Error fetching dashboard analytics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch analytics',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

router.get('/task-counts', async (req, res) => {
  try {
    const db = getDbForRequest(req);
    const { regulationIds } = req.query;

    let tasks = await db.select({
      id: complianceTasks.id,
      parentTaskId: complianceTasks.parentTaskId,
      regulationId: complianceTasks.regulationId,
      status: complianceTasks.status,
    }).from(complianceTasks);

    if (regulationIds && typeof regulationIds === 'string') {
      const ids = new Set(regulationIds.split(',').map(Number).filter(n => !isNaN(n)));
      if (ids.size > 0) {
        tasks = tasks.filter(t => t.regulationId !== null && ids.has(t.regulationId));
      }
    }

    const rootTasks = tasks.filter(t => !t.parentTaskId);
    const completedRoot = rootTasks.filter(t => t.status === 'completed').length;

    res.json({
      rootCount: rootTasks.length,
      rootCompleted: completedRoot,
      subtaskCount: tasks.filter(t => !!t.parentTaskId).length,
      total: tasks.length,
    });
  } catch (error) {
    console.error('Error fetching task counts:', error);
    res.status(500).json({ error: 'Failed to fetch task counts' });
  }
});

export default router;

