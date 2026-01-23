/**
 * Reports API
 * Generates compliance reports in various formats (JSON, CSV)
 * PDF generation happens client-side using html2canvas and jsPDF
 */

import express, { Request, Response } from 'express';
import { getDbForRequest } from '../../services/database';
import { regulations, deadlines, complianceTasks, users } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = express.Router();

// Get compliance report data
router.get('/compliance-summary', async (req: Request, res: Response) => {
  try {
    // TENANT ISOLATION: Get tenant-specific database
    const db = getDbForRequest(req);
    
    // Fetch all data (filter regulations by is_current = true, MCP Engine sync Jan 2026)
    const allRegulations = await db.select().from(regulations).where(eq(regulations.isCurrent, true));
    const allDeadlines = await db.select().from(deadlines);
    const allTasks = await db.select().from(complianceTasks);
    const allUsers = await db.select().from(users);

    const now = new Date();

    // Calculate metrics
    const compliantRegs = allRegulations.filter(r => r.complianceStatus === 'compliant').length;
    const needsAttentionRegs = allRegulations.filter(r => 
      r.complianceStatus === 'needs_attention' || r.complianceStatus === 'in_progress'
    ).length;
    const nonCompliantRegs = allRegulations.filter(r => 
      r.complianceStatus === 'non_compliant' || r.complianceStatus === 'overdue'
    ).length;

    const completedTasks = allTasks.filter(t => t.status === 'completed').length;
    const overdueTasks = allTasks.filter(t => 
      t.status !== 'completed' && t.dueDate && new Date(t.dueDate) < now
    ).length;

    const overdueDeadlines = allDeadlines.filter(d => 
      !d.completed && d.dueDate && new Date(d.dueDate) < now
    ).length;

    // Get category breakdown
    const categoryBreakdown = allRegulations.reduce((acc, reg) => {
      const cat = reg.category || 'Uncategorized';
      if (!acc[cat]) {
        acc[cat] = { total: 0, compliant: 0, needsAttention: 0, nonCompliant: 0 };
      }
      acc[cat].total++;
      if (reg.complianceStatus === 'compliant') acc[cat].compliant++;
      else if (reg.complianceStatus === 'needs_attention' || reg.complianceStatus === 'in_progress') acc[cat].needsAttention++;
      else if (reg.complianceStatus === 'non_compliant' || reg.complianceStatus === 'overdue') acc[cat].nonCompliant++;
      return acc;
    }, {} as Record<string, { total: number; compliant: number; needsAttention: number; nonCompliant: number }>);

    // Top issues (non-compliant regulations)
    const topIssues = allRegulations
      .filter(r => r.complianceStatus === 'non_compliant' || r.complianceStatus === 'overdue')
      .slice(0, 10)
      .map(r => ({
        id: r.id,
        name: r.name,
        category: r.category,
        status: r.complianceStatus,
      }));

    // Upcoming deadlines
    const upcomingDeadlines = allDeadlines
      .filter(d => !d.completed && d.dueDate && new Date(d.dueDate) > now)
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
      .slice(0, 10)
      .map(d => ({
        id: d.id,
        title: d.title,
        dueDate: d.dueDate,
        regulationId: d.regulationId,
      }));

    const complianceScore = allRegulations.length > 0
      ? Math.round((compliantRegs / allRegulations.length) * 100)
      : 0;

    res.json({
      generatedAt: new Date().toISOString(),
      summary: {
        complianceScore,
        totalRegulations: allRegulations.length,
        compliantRegulations: compliantRegs,
        needsAttentionRegulations: needsAttentionRegs,
        nonCompliantRegulations: nonCompliantRegs,
        totalTasks: allTasks.length,
        completedTasks,
        overdueTasks,
        totalDeadlines: allDeadlines.length,
        overdueDeadlines,
        totalUsers: allUsers.length,
      },
      categoryBreakdown: Object.entries(categoryBreakdown).map(([name, data]) => ({
        name,
        ...data,
        complianceRate: data.total > 0 ? Math.round((data.compliant / data.total) * 100) : 0,
      })),
      topIssues,
      upcomingDeadlines,
    });
  } catch (error) {
    console.error('Error generating compliance summary:', error);
    res.status(500).json({ error: 'Failed to generate compliance summary' });
  }
});

// Export regulations as CSV
router.get('/export/regulations/csv', async (req: Request, res: Response) => {
  try {
    // TENANT ISOLATION: Get tenant-specific database
    const db = getDbForRequest(req);
    
    // Filter by is_current = true to exclude deprecated/duplicate regulations (MCP Engine sync Jan 2026)
    const allRegulations = await db.select().from(regulations).where(eq(regulations.isCurrent, true));

    // CSV header
    const headers = ['ID', 'Name', 'Category', 'Jurisdiction', 'Compliance Status', 'Last Updated', 'Effective Date'];
    
    // CSV rows
    const rows = allRegulations.map(r => [
      r.id,
      `"${(r.name || '').replace(/"/g, '""')}"`,
      `"${(r.category || '').replace(/"/g, '""')}"`,
      `"${(r.jurisdiction || '').replace(/"/g, '""')}"`,
      r.complianceStatus || 'unknown',
      r.lastUpdated || '',
      r.effectiveDate || '',
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="regulations-export-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting regulations:', error);
    res.status(500).json({ error: 'Failed to export regulations' });
  }
});

// Export tasks as CSV
router.get('/export/tasks/csv', async (req: Request, res: Response) => {
  try {
    // TENANT ISOLATION: Get tenant-specific database
    const db = getDbForRequest(req);
    
    const allTasks = await db.select().from(complianceTasks);

    // CSV header
    const headers = ['ID', 'Title', 'Regulation ID', 'Status', 'Priority', 'Due Date', 'Assigned To', 'Completed At'];
    
    // CSV rows
    const rows = allTasks.map(t => [
      t.id,
      `"${(t.title || '').replace(/"/g, '""')}"`,
      t.regulationId,
      t.status || 'pending',
      t.priority || 'medium',
      t.dueDate || '',
      t.assignedTo || '',
      t.completedAt || '',
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="tasks-export-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting tasks:', error);
    res.status(500).json({ error: 'Failed to export tasks' });
  }
});

// Export deadlines as CSV
router.get('/export/deadlines/csv', async (req: Request, res: Response) => {
  try {
    // TENANT ISOLATION: Get tenant-specific database
    const db = getDbForRequest(req);
    
    const allDeadlines = await db.select().from(deadlines);

    // CSV header
    const headers = ['ID', 'Title', 'Regulation ID', 'Due Date', 'Completed', 'Notes'];
    
    // CSV rows
    const rows = allDeadlines.map(d => [
      d.id,
      `"${(d.title || '').replace(/"/g, '""')}"`,
      d.regulationId,
      d.dueDate || '',
      d.completed ? 'Yes' : 'No',
      `"${(d.notes || '').replace(/"/g, '""')}"`,
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="deadlines-export-${new Date().toISOString().split('T')[0]}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Error exporting deadlines:', error);
    res.status(500).json({ error: 'Failed to export deadlines' });
  }
});

// Full compliance report data for PDF generation
router.get('/full-report', async (req: Request, res: Response) => {
  try {
    // TENANT ISOLATION: Get tenant-specific database
    const db = getDbForRequest(req);
    
    // Filter regulations by is_current = true (MCP Engine sync Jan 2026)
    const allRegulations = await db.select().from(regulations).where(eq(regulations.isCurrent, true));
    const allDeadlines = await db.select().from(deadlines);
    const allTasks = await db.select().from(complianceTasks);

    const now = new Date();

    // Group regulations by category with full details
    const regulationsByCategory: Record<string, typeof allRegulations> = {};
    allRegulations.forEach(reg => {
      const cat = reg.category || 'Uncategorized';
      if (!regulationsByCategory[cat]) {
        regulationsByCategory[cat] = [];
      }
      regulationsByCategory[cat].push(reg);
    });

    // Get overdue items
    const overdueDeadlines = allDeadlines
      .filter(d => !d.completed && d.dueDate && new Date(d.dueDate) < now)
      .map(d => ({
        ...d,
        regulation: allRegulations.find(r => r.id === d.regulationId),
      }));

    const overdueTasks = allTasks
      .filter(t => t.status !== 'completed' && t.dueDate && new Date(t.dueDate) < now)
      .map(t => ({
        ...t,
        regulation: allRegulations.find(r => r.id === t.regulationId),
      }));

    res.json({
      generatedAt: new Date().toISOString(),
      institutionName: 'EdSteward Compliance Report',
      regulationsByCategory,
      overdueDeadlines,
      overdueTasks,
      statistics: {
        totalRegulations: allRegulations.length,
        totalDeadlines: allDeadlines.length,
        totalTasks: allTasks.length,
        completedTasks: allTasks.filter(t => t.status === 'completed').length,
        overdueDeadlinesCount: overdueDeadlines.length,
        overdueTasksCount: overdueTasks.length,
      },
    });
  } catch (error) {
    console.error('Error generating full report:', error);
    res.status(500).json({ error: 'Failed to generate full report' });
  }
});

export default router;
