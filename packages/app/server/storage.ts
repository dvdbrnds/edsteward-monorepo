import {
  users,
  regulations,
  notifications,
  deadlines,
  guides,
  notes,
  noteHistory,
  evidenceFiles,
  regulationVersions,
  validationStatus,
  syncControl,
  notificationQueue,
  versionConflicts,
  institutionConfigurations,
  type EvidenceFile,
  type InsertEvidenceFile,
  type NoteHistory,
  type InsertNoteHistory,
  type InstitutionConfiguration,
  type InsertInstitutionConfiguration,
} from "@shared/schema";

import type {
  User,
  InsertUser,
  Regulation,
  InsertRegulation,
  Notification,
  InsertNotification,
  Deadline,
  InsertDeadline,
  Guide,
  InsertGuide,
  Note,
  InsertNote,
  // MCP Integration types
  RegulationVersion,
  InsertRegulationVersion,
  ValidationStatus,
  InsertValidationStatus,
  SyncControl,
  InsertSyncControl,
  NotificationQueue,
  InsertNotificationQueue,
  VersionConflict,
  InsertVersionConflict,
  MCPVersionConflict
} from "@shared/schema";

// Import RegulationUpdate type from schema
import { regulationUpdates, type RegulationUpdate, type InsertRegulationUpdate } from "@shared/schema";
import { getDatabase, getDatabasePool } from "./services/database";
import { eq, desc, or, like, sql } from "drizzle-orm";
import { getDatabaseStorage } from "./services/database";
import session from "express-session";
import connectPg from "connect-pg-simple";
// NOTE: Do NOT import { pool } from "./db" here — use this.pool for tenant isolation
import { Pool } from "pg";

const PostgresSessionStore = connectPg(session);

// Use the shared pool from services/database - NO MORE SEPARATE POOLS!
// This consolidates all database connections through a single pool.

 
export interface IStorage {
  // Database access for raw queries
  getDb(): ReturnType<typeof getDatabase> | null;
  
  // User methods - now tenant-aware
  getUser(_id: number, _tenantId?: string): Promise<User | undefined>;
  getUserByUsername(_username: string, _tenantId?: string): Promise<User | undefined>;
  getUserByEmail(_email: string, _tenantId?: string): Promise<User | undefined>;
  getUserByExternalId(_externalId: string, _tenantId?: string): Promise<User | undefined>;
  createUser(_user: InsertUser, _tenantId?: string): Promise<User>;
  getAllUsers(_tenantId?: string): Promise<User[]>;
  updateUser(_id: number, _user: Partial<InsertUser>, _tenantId?: string): Promise<User>;
  deleteUser(_id: number, _tenantId?: string): Promise<void>;

  // Regulation methods
  getRegulations(): Promise<Regulation[]>;
  getRegulation(_id: number): Promise<Regulation | undefined>;
  getRegulationById(_regulationId: string): Promise<Regulation | null>;
  createRegulation(_regulation: InsertRegulation): Promise<Regulation>;
  updateRegulation(_id: number, _regulation: Partial<InsertRegulation>): Promise<Regulation>;
  setRegulationApplicability(_id: number, _isApplicable: boolean): Promise<Regulation>;
  getRegulationsByJurisdiction(_jurisdiction: string): Promise<Regulation[]>; // Legacy method
  getRegulationsByJurisdictionSource(_jurisdictionSource: string): Promise<Regulation[]>;
  getRegulationsByInstitutionType(_institutionType: string): Promise<Regulation[]>;
  searchRegulations(_searchTerm: string): Promise<Regulation[]>;
  deleteRegulation(_id: number): Promise<void>;

  // Regulation Update methods
  getPendingRegulationUpdates(): Promise<RegulationUpdate[]>;
  getRegulationUpdateById(_id: number): Promise<RegulationUpdate | null>;
  createRegulationUpdate(_data: InsertRegulationUpdate): Promise<RegulationUpdate>;
  acceptRegulationUpdate(_id: number, _userId: number, _signature: string): Promise<void>;
  rejectRegulationUpdate(_id: number, _userId: number, _signature: string, _reason: string): Promise<void>;
  deferRegulationUpdate(_id: number, _userId: number, _signature: string): Promise<void>;
  bulkDeleteRegulationUpdates(_ids: number[]): Promise<void>;

  // MCP Regulation Version methods
  getRegulationVersions(_regulationId: number): Promise<RegulationVersion[]>;
  getRegulationVersion(_id: number): Promise<RegulationVersion | null>;
  createRegulationVersion(_version: InsertRegulationVersion): Promise<RegulationVersion>;
  getLatestRegulationVersion(_regulationId: number): Promise<RegulationVersion | null>;
  compareRegulationVersions(_versionIdA: number, _versionIdB: number): Promise<{
    changes: Array<{
      field: string;
      valueA: string;
      valueB: string;
      changeType: 'added' | 'removed' | 'modified';
    }>;
  }>;

  // MCP Validation Status methods
  getValidationStatus(_regulationId: number, _versionId?: number): Promise<ValidationStatus[]>;
  createValidationStatus(_status: InsertValidationStatus): Promise<ValidationStatus>;
  updateValidationStatus(_id: number, _status: Partial<InsertValidationStatus>): Promise<ValidationStatus>;
  validateRegulationVersion(_versionId: number, _userId: number): Promise<ValidationStatus[]>;

  // MCP Sync Control methods
  getSyncControl(_regulationId: number): Promise<SyncControl | null>;
  createSyncControl(_control: InsertSyncControl): Promise<SyncControl>;
  updateSyncControl(_id: number, _control: Partial<InsertSyncControl>): Promise<SyncControl>;
  scheduleSyncForRegulation(_regulationId: number, _nextSync: Date): Promise<SyncControl>;
  recordSyncAttempt(_regulationId: number, _success: boolean, _error?: string): Promise<SyncControl>;

  // MCP Notification Queue methods
  getNotificationQueue(_status?: 'pending' | 'sent' | 'failed'): Promise<NotificationQueue[]>;
  createNotificationQueueItem(_item: InsertNotificationQueue): Promise<NotificationQueue>;
  updateNotificationQueueItem(_id: number, _item: Partial<InsertNotificationQueue>): Promise<NotificationQueue>;
  markNotificationAsSent(_id: number): Promise<NotificationQueue>;

  // MCP Version Conflict methods
  getVersionConflicts(_status?: 'pending' | 'resolved' | 'rejected'): Promise<VersionConflict[]>;
  getVersionConflictsForRegulation(_regulationId: number): Promise<VersionConflict[]>;
  createVersionConflict(_conflict: InsertVersionConflict): Promise<VersionConflict>;
  resolveVersionConflict(_id: number, _resolutions: MCPVersionConflict[], _userId: number): Promise<VersionConflict>;
  rejectVersionConflict(_id: number, _userId: number): Promise<VersionConflict>;

  // Notification methods
  getNotificationsByUser(_userId: number): Promise<Notification[]>;
  getAllNotifications(): Promise<Notification[]>;
  createNotification(_notification: InsertNotification): Promise<Notification>;
  sendEmailNotification(_userId: number, _subject: string, _message: string): Promise<boolean>;

  // Deadline methods
  getDeadlines(): Promise<Deadline[]>;
  getAllIncompleteDeadlines(): Promise<Deadline[]>;
  createDeadline(_deadline: InsertDeadline): Promise<Deadline>;
  updateDeadline(_id: number, _deadline: Partial<InsertDeadline>): Promise<Deadline>;
  deleteDeadline(_id: number): Promise<void>;

  // Guide methods
  getGuides(): Promise<Guide[]>;
  getGuidesByCategory(_category: string): Promise<Guide[]>;
  getGuide(_id: number): Promise<Guide | undefined>;
  createGuide(_guide: InsertGuide): Promise<Guide>;
  updateGuide(_id: number, _guide: Partial<InsertGuide>): Promise<Guide>;

  // Session store
  sessionStore: session.Store;
  hasAdmin(): Promise<boolean>;

  // Note methods
  getNotesByRegulation(_regulationId: number): Promise<Note[]>;
  getNotesByUser(_userId: number): Promise<Note[]>;
  getNote(_id: number): Promise<Note | null>;
  createNote(_note: InsertNote): Promise<Note>;
  updateNote(_id: number, _note: Partial<InsertNote>, _userId?: number): Promise<Note>;
  deleteNote(_id: number): Promise<void>;
  
  // Note history methods
  createNoteHistory(_history: InsertNoteHistory): Promise<NoteHistory>;
  getNoteHistory(_noteId: number): Promise<NoteHistory[]>;

  // Evidence file methods
  createEvidenceFile(_file: InsertEvidenceFile): Promise<EvidenceFile>;
  getEvidenceFilesByRegulation(_regulationId: number): Promise<EvidenceFile[]>;
  getEvidenceFile(_id: number): Promise<EvidenceFile | undefined>;
  updateEvidenceFileStatus(_id: number, _status: string): Promise<EvidenceFile>;

  // Branding configuration methods
  getBrandingConfig(): Promise<{ [key: string]: unknown }>;
  saveBrandingConfig(_config: { [key: string]: unknown }): Promise<{ [key: string]: unknown }>;
}
 

import { emailService } from './services/email';

export class DatabaseStorage implements IStorage {
  private _db: ReturnType<typeof getDatabase> | null = null;
  private _pool: Pool | null = null;
  sessionStore: session.Store;

  constructor(customDb?: ReturnType<typeof getDatabase>, customPool?: Pool) {
    this._db = customDb || null;
    this._pool = customPool || null;
    this.sessionStore = new PostgresSessionStore({
      pool: customPool || getDatabasePool(),
      createTableIfMissing: true,
    });
  }

  private get db() {
    // Use custom database if provided, otherwise fall back to default
    return this._db || getDatabase();
  }
  
  // Get the pool to use for raw queries - tenant-specific or default
  private get pool(): Pool {
    return this._pool || getDatabasePool();
  }
  
  // Public method to get database for raw queries
  getDb() {
    return this.db;
  }
  // Regulation Update methods
  async getPendingRegulationUpdates(): Promise<RegulationUpdate[]> {
    try {
      return await this.db.select().from(regulationUpdates)
        .where(eq(regulationUpdates.status, "pending"))
        .orderBy(desc(regulationUpdates.updateDate));
    } catch (error) {
      console.error("Error fetching pending regulation updates:", error);
      return [];
    }
  }

  async getRegulationUpdateById(id: number): Promise<RegulationUpdate | null> {
    try {
      // Use parameterized query with pool for safety
      const result = await this.pool.query(
        'SELECT * FROM regulation_updates WHERE id = $1',
        [id]
      );

      if (result.rows.length > 0) {
        const update = result.rows[0];
        return {
          id: update.id,
          regulationId: update.regulation_id,
          name: update.name,
          originalContent: update.original_content,
          updatedContent: update.updated_content,
          summary: update.summary,
          requirements: update.requirements,
          filingDeadlines: update.filing_deadlines,
          status: update.status,
          updateDate: update.created_at ? new Date(update.created_at) : new Date(),
          signature: update.signature_data,
          userId: update.reviewer_id,
          rejectionReason: update.rejection_reason,
          processedAt: update.reviewed_at ? new Date(update.reviewed_at) : null,
          metadata: update.metadata,
          pendingTasks: update.pending_tasks, // MCP Engine compliance tasks (Jan 2026)
          mcpPayload: update.mcp_payload, // Complete raw MCP Engine payload (Feb 2026)
        } as RegulationUpdate;
      }
      return null;
    } catch (error) {
      console.error(`Error fetching regulation update with ID ${id}:`, error);
      return null;
    }
  }

  async createRegulationUpdate(data: InsertRegulationUpdate): Promise<RegulationUpdate> {
    try {
      // Debug: Log what we're inserting
      console.log('📝 Creating regulation update with fields:', Object.keys(data));
      if ((data as any).metadata) {
        console.log('   📦 Has metadata with keys:', Object.keys((data as any).metadata));
        if ((data as any).metadata.executiveOrders) {
          console.log(`   ⚖️ Has ${(data as any).metadata.executiveOrders.length} executive orders`);
        }
      } else {
        console.log('   ⚠️ No metadata in update data');
      }
      if ((data as any).pendingTasks) {
        console.log(`   📋 Has ${(data as any).pendingTasks.length} pending tasks`);
      }
      
      const [newUpdate] = await this.db.insert(regulationUpdates).values(data).returning();
      
      // Debug: Verify what was saved
      console.log('   ✅ Created update ID:', newUpdate.id, 'metadata saved:', !!newUpdate.metadata);
      
      return newUpdate;
    } catch (error) {
      console.error("Error creating regulation update:", error);
      throw error;
    }
  }

  async acceptRegulationUpdate(id: number, userId: number, signature: string): Promise<void> {
    try {
      // 1. Get the update details
      const update = await this.getRegulationUpdateById(id);
      if (!update) {
        throw new Error(`Regulation update with ID ${id} not found`);
      }

      // 2. Update the regulation with the new content
      // Handle name, regulation_text, requirements, summary, and deadlines
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;

      // Update regulation name if provided in the update
      if (update.name) {
        updateFields.push(`name = $${paramIndex++}`);
        updateValues.push(update.name);
      }

      // Always update regulation_text with the full text
      updateFields.push(`regulation_text = $${paramIndex++}`);
      updateValues.push(update.updatedContent);

      // Update requirements field if provided
      if (update.requirements) {
        updateFields.push(`requirements = $${paramIndex++}`);
        updateValues.push(update.requirements);
      }

      // Update summary field if provided
      if (update.summary) {
        updateFields.push(`summary = $${paramIndex++}`);
        updateValues.push(update.summary);
      }

      // Update filing_deadlines field if provided (must be valid JSON for JSONB column)
      if (update.filingDeadlines) {
        try {
          // Try to parse as JSON first
          const parsedDeadlines = typeof update.filingDeadlines === 'string' 
            ? JSON.parse(update.filingDeadlines)
            : update.filingDeadlines;
          updateFields.push(`filing_deadlines = $${paramIndex++}`);
          updateValues.push(JSON.stringify(parsedDeadlines));
        } catch {
          // If not valid JSON, wrap the text in a JSON object
          updateFields.push(`filing_deadlines = $${paramIndex++}`);
          updateValues.push(JSON.stringify({ description: update.filingDeadlines }));
        }
      }

      // 2.5. Apply expanded regulation fields from MCP metadata (Feb 2026 schema alignment)
      // When the Updates endpoint stores MCP data, it puts expanded fields in metadata.regulationFields
      const updateMetadata = (update as any).metadata;
      const regFields = updateMetadata?.regulationFields;
      if (regFields && typeof regFields === 'object') {
        console.log('📋 Applying expanded regulation fields from MCP metadata...');
        
        // Map of metadata field → DB column name
        const fieldMap: Record<string, string> = {
          statute: 'statute',
          statuteIds: 'statute_ids',
          publicLaw: 'public_law',
          category: 'category',
          topic: 'topic',
          jurisdictionSource: 'jurisdiction_source',
          effectiveDate: 'effective_date',
          originationDate: 'origination_date',
          nextReviewDate: 'next_review_date',
          purpose: 'purpose',
          scope: 'scope',
          submissionGuidelines: 'submission_guidelines',
          complianceNotes: 'compliance_notes',
          verificationMethod: 'verification_method',
          reportingFrequency: 'reporting_frequency',
          agencyName: 'agency_name',
          agencyUrl: 'agency_url',
          agencyContact: 'agency_contact',
          agencyDepartment: 'agency_department',
          regulationUrl: 'regulation_url',
          requirementsUrl: 'requirements_url',
          submissionGuideUrl: 'submission_guide_url',
          formsUrl: 'forms_url',
          sourceUrl: 'source_url',
          stateCode: 'state_code',
          lovvLevel: 'lovv_level',
          versionHash: 'version_hash',
        };
        
        // Simple text/varchar fields
        for (const [jsField, dbCol] of Object.entries(fieldMap)) {
          const value = regFields[jsField];
          if (value !== undefined && value !== null) {
            updateFields.push(`${dbCol} = $${paramIndex++}`);
            updateValues.push(value);
          }
        }
        
        // JSONB fields (need JSON.stringify)
        const jsonbFields: Record<string, string> = {
          sources: 'sources',
          sections: 'sections',
          relatedRegulations: 'related_regulations',
          reportingRequirements: 'reporting_requirements',
          riskAssessment: 'risk_assessment',
        };
        
        for (const [jsField, dbCol] of Object.entries(jsonbFields)) {
          const value = regFields[jsField];
          if (value !== undefined && value !== null) {
            updateFields.push(`${dbCol} = $${paramIndex++}`);
            updateValues.push(JSON.stringify(value));
          }
        }
        
        // Array fields (store as JSONB)
        if (regFields.applicableInstitutions) {
          updateFields.push(`applicable_institutions = $${paramIndex++}`);
          updateValues.push(JSON.stringify(regFields.applicableInstitutions));
        }
        if (regFields.applicableForms) {
          updateFields.push(`applicable_forms = $${paramIndex++}`);
          updateValues.push(JSON.stringify(regFields.applicableForms));
        }
        
        // Numeric fields
        if (regFields.riskScore !== undefined && regFields.riskScore !== null) {
          updateFields.push(`risk_score = $${paramIndex++}`);
          updateValues.push(regFields.riskScore);
        }
        if (regFields.riskLevel) {
          updateFields.push(`risk_level = $${paramIndex++}`);
          updateValues.push(regFields.riskLevel);
        }
        
        console.log(`   📝 Applying ${Object.keys(regFields).filter(k => regFields[k] !== null && regFields[k] !== undefined).length} expanded fields`);
      }

      // Always update last_updated timestamp
      updateFields.push(`last_updated = $${paramIndex++}`);
      updateValues.push(new Date());

      // Add the regulation ID for WHERE clause
      updateValues.push(update.regulationId);

      await this.pool.query(
        `UPDATE regulations 
         SET ${updateFields.join(', ')} 
         WHERE id = $${paramIndex}`,
        updateValues
      );

      // 3. Create a version record for this update
      // Calculate next version number by finding the max version number for this regulation
      const existingVersions = await this.db
        .select({ versionNumber: regulationVersions.versionNumber })
        .from(regulationVersions)
        .where(eq(regulationVersions.regulationId, update.regulationId))
        .orderBy(desc(regulationVersions.versionNumber))
        .limit(1);
      
      const nextVersionNumber = existingVersions.length > 0 
        ? (existingVersions[0].versionNumber + 1) 
        : 1;
      
      
      const _changeSummary = `Updated via regulation update #${id}`;
      const versionContent = JSON.stringify({
        regulation_text: update.updatedContent,
        requirements: update.requirements || null,
        summary: update.summary || null,
        filing_deadlines: update.filingDeadlines || null,
        updated_by: userId,
        update_id: id
      });

      await this.db.insert(regulationVersions).values({
        regulationId: update.regulationId,
        versionNumber: nextVersionNumber,
        content: versionContent,
        createdBy: userId,
        source: 'regulation_update',
        sourceId: id.toString(),
        validationStatus: 'approved'
      });

      // 3.5. Apply pending compliance tasks if present (MCP Engine sync Jan 2026)
      const pendingTasks = (update as any).pendingTasks;
      if (pendingTasks && Array.isArray(pendingTasks) && pendingTasks.length > 0) {
        // Determine sync mode from stored mcpPayload
        const mcpPayload = (update as any).mcpPayload || updateMetadata || {};
        let replaceMode = false;
        if (mcpPayload.taskSyncMode === 'replace') {
          replaceMode = true;
        } else if (mcpPayload.taskSyncMode === 'merge') {
          replaceMode = false;
        } else if (mcpPayload.bespokeSource) {
          replaceMode = true;
        }

        const mode = replaceMode ? 'REPLACE' : 'MERGE';
        console.log(`📋 Applying ${pendingTasks.length} compliance tasks on approval (${mode} mode)...`);

        if (replaceMode) {
          // REPLACE: delete all existing tasks (and dependents) before inserting
          const existingIds = await this.pool.query(
            `SELECT id FROM compliance_tasks WHERE regulation_id = $1`,
            [update.regulationId]
          );
          if (existingIds.rows.length > 0) {
            const ids = existingIds.rows.map((r: any) => r.id);
            const pgArray = `{${ids.join(',')}}`;
            await this.pool.query(`DELETE FROM task_attestation_tokens WHERE task_id = ANY($1::int[])`, [pgArray]);
            await this.pool.query(`DELETE FROM task_evidence WHERE task_id = ANY($1::int[])`, [pgArray]);
            await this.pool.query(`DELETE FROM task_activity WHERE task_id = ANY($1::int[])`, [pgArray]);
            console.log(`   🧹 Cleared dependents for ${ids.length} existing tasks`);
          }
          await this.pool.query(`DELETE FROM compliance_tasks WHERE regulation_id = $1`, [update.regulationId]);
          console.log(`   🗑️  Deleted ${existingIds.rows.length} existing tasks for regulation ${update.regulationId}`);
        }

        // Fetch role assignments for auto-assign (Jan 2026)
        const roleAssignmentsResult = await this.pool.query(
          'SELECT role_name, default_user_id, auto_assign_enabled FROM role_assignments WHERE auto_assign_enabled = true'
        );
        const roleToUserMap = new Map<string, number>();
        for (const ra of roleAssignmentsResult.rows) {
          if (ra.default_user_id) {
            roleToUserMap.set(ra.role_name.toLowerCase(), ra.default_user_id);
          }
        }
        console.log(`   🔗 Loaded ${roleToUserMap.size} role assignments for auto-assign`);
        
        // Helper function to resolve assigned_to from assignedRole
        const resolveAssignedTo = (assignedRole: string | null): number | null => {
          if (!assignedRole) return null;
          return roleToUserMap.get(assignedRole.toLowerCase()) || null;
        };
        
        // Build lookup maps for existing tasks (skip in REPLACE mode — nothing left)
        const existingByTaskId = new Map<string, any>();
        const existingByTitle = new Map<string, any>();
        let preservedCount = 0;

        if (!replaceMode) {
          const existingTasksResult = await this.pool.query(
            `SELECT id, task_id, title, status, attestation_status FROM compliance_tasks WHERE regulation_id = $1`,
            [update.regulationId]
          );
          for (const existing of existingTasksResult.rows) {
            const isCompleted = existing.status === 'completed' || 
                                existing.attestation_status === 'attested';
            if (existing.task_id) {
              existingByTaskId.set(existing.task_id, { ...existing, isCompleted });
            }
            existingByTitle.set(existing.title.toLowerCase(), { ...existing, isCompleted });
          }
          console.log(`   📊 Found ${existingTasksResult.rows.length} existing tasks`);
        }
        
        // Build task ID mapping for parent-child relationships
        const taskIdMap = new Map<string, number>();
        let autoAssignedCount = 0;
        let insertedCount = 0;
        let updatedCount = 0;
        
        // Helper to check if task already exists
        const findExistingTask = (task: any) => {
          if (task.taskId && existingByTaskId.has(task.taskId)) {
            return existingByTaskId.get(task.taskId);
          }
          return existingByTitle.get(task.title.toLowerCase());
        };
        
        // First pass: process root tasks (no parentTempId)
        const rootTasks = pendingTasks.filter((t: any) => !t.parentTempId);
        for (const task of rootTasks) {
          const existing = replaceMode ? null : findExistingTask(task);
          
          // If task exists and is completed, preserve it - don't touch it
          if (existing?.isCompleted) {
            console.log(`   ✅ Preserved completed task: "${task.title}"`);
            preservedCount++;
            if (task.tempId) {
              taskIdMap.set(task.tempId, existing.id);
            }
            continue;
          }
          
          // Auto-assign from statutory role first, then fallback to assigned role
          const assignedTo = resolveAssignedTo(task.statutoryRole) || resolveAssignedTo(task.assignedRole);
          if (assignedTo) autoAssignedCount++;
          
          if (existing) {
            // Task exists but is not completed - update it with new info (21-field schema Feb 2026)
            await this.pool.query(
              `UPDATE compliance_tasks SET 
                description = COALESCE($1, description),
                instructions = COALESCE($2, instructions),
                category = COALESCE($3, category),
                statutory_role = COALESCE($4, statutory_role),
                statutory_citation = COALESCE($5, statutory_citation),
                assigned_role = COALESCE($6, assigned_role),
                priority = COALESCE($7, priority),
                requirement_type = COALESCE($8, requirement_type),
                evidence_required = COALESCE($9, evidence_required),
                evidence_type = COALESCE($10, evidence_type),
                sort_order = COALESCE($11, sort_order),
                evidence_instructions = COALESCE($12, evidence_instructions),
                estimated_effort = COALESCE($13, estimated_effort),
                deliverable = COALESCE($14, deliverable),
                deliverable_template_url = COALESCE($15, deliverable_template_url),
                recurring_schedule = COALESCE($16, recurring_schedule)
              WHERE id = $17`,
              [
                task.description || null,
                task.instructions || null,
                task.category || null,
                task.statutoryRole || null,
                task.statutoryCitation || null,
                task.assignedRole || null,
                task.priority || null,
                task.requirementType || null,
                task.evidenceRequired || null,
                task.evidenceType || null,
                task.sortOrder || null,
                task.evidenceInstructions || null,
                task.estimatedEffort || null,
                task.deliverable || null,
                task.deliverableTemplateUrl || null,
                task.recurringSchedule || null,
                existing.id
              ]
            );
            updatedCount++;
            if (task.tempId) {
              taskIdMap.set(task.tempId, existing.id);
            }
          } else {
            // Task doesn't exist - insert with full 21-field schema (Feb 2026)
            const result = await this.pool.query(
              `INSERT INTO compliance_tasks (
                regulation_id, task_id, title, description, instructions, 
                category, statutory_role, statutory_citation, assigned_to, assigned_role, 
                due_date, recurring_schedule, reminder_days, status, priority, 
                requirement_type, evidence_required, evidence_type, evidence_instructions,
                estimated_effort, deliverable, deliverable_template_url,
                sort_order, is_template, attestation_status
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25) 
              RETURNING id`,
              [
                update.regulationId,
                task.taskId || null,
                task.title,
                task.description || null,
                task.instructions || null,
                task.category || null,
                task.statutoryRole || null,
                task.statutoryCitation || null,
                assignedTo,
                task.assignedRole || null,
                task.dueDate ? new Date(task.dueDate) : null,
                task.recurringSchedule || null,
                task.reminderDays || 30,
                'pending',
                task.priority || 'medium',
                task.requirementType || 'requirement',
                task.evidenceRequired || false,
                task.evidenceType || 'none',
                task.evidenceInstructions || null,
                task.estimatedEffort || null,
                task.deliverable || null,
                task.deliverableTemplateUrl || null,
                task.sortOrder || 0,
                false,
                task.evidenceRequired ? 'pending' : 'not_required'
              ]
            );
            insertedCount++;
            if (task.tempId && result.rows[0]) {
              taskIdMap.set(task.tempId, result.rows[0].id);
            }
          }

          // Process inline subtasks[] if present on this root task
          if (Array.isArray(task.subtasks) && task.subtasks.length > 0) {
            const parentDbId = task.tempId ? taskIdMap.get(task.tempId) : (existing?.id || null);
            if (parentDbId) {
              for (const sub of task.subtasks) {
                const subAssignedTo = resolveAssignedTo(sub.statutoryRole) || resolveAssignedTo(sub.assignedRole);
                if (subAssignedTo) autoAssignedCount++;

                const subExisting = replaceMode ? null : findExistingTask(sub);
                if (subExisting?.isCompleted) {
                  preservedCount++;
                  continue;
                }
                if (subExisting) {
                  await this.pool.query(
                    `UPDATE compliance_tasks SET 
                      parent_task_id = $1,
                      description = COALESCE($2, description),
                      instructions = COALESCE($3, instructions),
                      category = COALESCE($4, category),
                      statutory_role = COALESCE($5, statutory_role),
                      statutory_citation = COALESCE($6, statutory_citation),
                      assigned_role = COALESCE($7, assigned_role),
                      priority = COALESCE($8, priority),
                      sort_order = COALESCE($9, sort_order)
                    WHERE id = $10`,
                    [
                      parentDbId,
                      sub.description || null,
                      sub.instructions || null,
                      sub.category || null,
                      sub.statutoryRole || null,
                      sub.statutoryCitation || null,
                      sub.assignedRole || null,
                      sub.priority || null,
                      sub.sortOrder || null,
                      subExisting.id
                    ]
                  );
                  updatedCount++;
                } else {
                  const subResult = await this.pool.query(
                    `INSERT INTO compliance_tasks (
                      regulation_id, parent_task_id, task_id, title, description, instructions,
                      category, statutory_role, statutory_citation, assigned_to, assigned_role,
                      due_date, status, priority, sort_order, is_template, attestation_status
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                    RETURNING id`,
                    [
                      update.regulationId,
                      parentDbId,
                      sub.taskId || null,
                      sub.title,
                      sub.description || null,
                      sub.instructions || null,
                      sub.category || null,
                      sub.statutoryRole || null,
                      sub.statutoryCitation || null,
                      subAssignedTo,
                      sub.assignedRole || null,
                      sub.dueDate ? new Date(sub.dueDate) : null,
                      'pending',
                      sub.priority || 'medium',
                      sub.sortOrder || 0,
                      false,
                      'not_required'
                    ]
                  );
                  insertedCount++;
                  if (sub.tempId && subResult.rows[0]) {
                    taskIdMap.set(sub.tempId, subResult.rows[0].id);
                  }
                }
              }
            }
          }
        }
        
        // Second pass: process child tasks (with parentTempId)
        const childTasks = pendingTasks.filter((t: any) => t.parentTempId);
        for (const task of childTasks) {
          const parentId = taskIdMap.get(task.parentTempId);
          if (!parentId) {
            console.warn(`   ⚠️ Parent not found for child task "${task.title}" (parentTempId: ${task.parentTempId})`);
            continue;
          }
          
          const existing = replaceMode ? null : findExistingTask(task);
          
          // If task exists and is completed, preserve it
          if (existing?.isCompleted) {
            console.log(`   ✅ Preserved completed child task: "${task.title}"`);
            preservedCount++;
            if (task.tempId) {
              taskIdMap.set(task.tempId, existing.id);
            }
            continue;
          }
          
          // Auto-assign from statutory role first, then fallback to assigned role
          const assignedTo = resolveAssignedTo(task.statutoryRole) || resolveAssignedTo(task.assignedRole);
          if (assignedTo) autoAssignedCount++;
          
          if (existing) {
            // Update existing pending child task (21-field schema Feb 2026)
            await this.pool.query(
              `UPDATE compliance_tasks SET 
                parent_task_id = $1,
                description = COALESCE($2, description),
                instructions = COALESCE($3, instructions),
                category = COALESCE($4, category),
                statutory_role = COALESCE($5, statutory_role),
                statutory_citation = COALESCE($6, statutory_citation),
                assigned_role = COALESCE($7, assigned_role),
                priority = COALESCE($8, priority),
                requirement_type = COALESCE($9, requirement_type),
                evidence_required = COALESCE($10, evidence_required),
                evidence_type = COALESCE($11, evidence_type),
                sort_order = COALESCE($12, sort_order),
                evidence_instructions = COALESCE($13, evidence_instructions),
                estimated_effort = COALESCE($14, estimated_effort),
                deliverable = COALESCE($15, deliverable),
                deliverable_template_url = COALESCE($16, deliverable_template_url),
                recurring_schedule = COALESCE($17, recurring_schedule)
              WHERE id = $18`,
              [
                parentId,
                task.description || null,
                task.instructions || null,
                task.category || null,
                task.statutoryRole || null,
                task.statutoryCitation || null,
                task.assignedRole || null,
                task.priority || null,
                task.requirementType || null,
                task.evidenceRequired || null,
                task.evidenceType || null,
                task.sortOrder || null,
                task.evidenceInstructions || null,
                task.estimatedEffort || null,
                task.deliverable || null,
                task.deliverableTemplateUrl || null,
                task.recurringSchedule || null,
                existing.id
              ]
            );
            updatedCount++;
            if (task.tempId) {
              taskIdMap.set(task.tempId, existing.id);
            }
          } else {
            // Insert new child task with full 21-field schema (Feb 2026)
            const result = await this.pool.query(
              `INSERT INTO compliance_tasks (
                regulation_id, parent_task_id, task_id, title, description, instructions, 
                category, statutory_role, statutory_citation, assigned_to, assigned_role, 
                due_date, recurring_schedule, reminder_days, status, priority, 
                requirement_type, evidence_required, evidence_type, evidence_instructions,
                estimated_effort, deliverable, deliverable_template_url,
                sort_order, is_template, attestation_status
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26) 
              RETURNING id`,
              [
                update.regulationId,
                parentId,
                task.taskId || null,
                task.title,
                task.description || null,
                task.instructions || null,
                task.category || null,
                task.statutoryRole || null,
                task.statutoryCitation || null,
                assignedTo,
                task.assignedRole || null,
                task.dueDate ? new Date(task.dueDate) : null,
                task.recurringSchedule || null,
                task.reminderDays || 30,
                'pending',
                task.priority || 'medium',
                task.requirementType || 'requirement',
                task.evidenceRequired || false,
                task.evidenceType || 'none',
                task.evidenceInstructions || null,
                task.estimatedEffort || null,
                task.deliverable || null,
                task.deliverableTemplateUrl || null,
                task.sortOrder || 0,
                false,
                task.evidenceRequired ? 'pending' : 'not_required'
              ]
            );
            insertedCount++;
            if (task.tempId && result.rows[0]) {
              taskIdMap.set(task.tempId, result.rows[0].id);
            }
          }
        }
        
        console.log(`   📊 Task sync complete: ${insertedCount} new, ${updatedCount} updated, ${preservedCount} preserved (completed)`);
        console.log(`   👤 Auto-assigned ${autoAssignedCount} tasks based on role mappings`);
      }

      // 3.55. Apply engine-provided regulation actions if present in mcpPayload
      const mcpRegActions = ((update as any).mcpPayload || {}).regulationActions;
      if (mcpRegActions && typeof mcpRegActions === 'object') {
        const hasDeadlines = !!update.filingDeadlines;
        const newActions = [
          { type: 'attestation', enabled: true, required: true, status: 'pending' },
          { type: 'website_publish', enabled: !!mcpRegActions.website_publish?.required, required: !!mcpRegActions.website_publish?.required, status: 'pending' },
          { type: 'community_communication', enabled: !!mcpRegActions.community_communication?.required, required: !!mcpRegActions.community_communication?.required, status: 'pending' },
          { type: 'agency_submission', enabled: !!mcpRegActions.agency_submission?.required || hasDeadlines, required: !!mcpRegActions.agency_submission?.required || hasDeadlines, status: 'pending' },
        ];
        
        // Merge with existing actions to preserve completion state
        const existingActionsRes = await this.pool.query(
          `SELECT actions FROM regulations WHERE id = $1`,
          [update.regulationId]
        );
        const existingActions = existingActionsRes.rows[0]?.actions;
        const mergedActions = existingActions && Array.isArray(existingActions)
          ? newActions.map(na => {
              const ea = existingActions.find((a: any) => a.type === na.type);
              return ea ? { ...ea, enabled: na.enabled, required: na.required } : na;
            })
          : newActions;
        
        await this.pool.query(
          `UPDATE regulations SET actions = $1 WHERE id = $2`,
          [JSON.stringify(mergedActions), update.regulationId]
        );
        const enabledTypes = mergedActions.filter((a: any) => a.enabled).map((a: any) => a.type);
        console.log(`🎯 Applied engine regulation actions: ${enabledTypes.join(', ')}`);
      }

      // 3.6. Apply Executive Orders if present in metadata (MCP Engine sync Jan 2026)
      const executiveOrders = updateMetadata?.executiveOrders;
      if (executiveOrders && Array.isArray(executiveOrders) && executiveOrders.length > 0) {
        console.log(`⚖️ Processing ${executiveOrders.length} Executive Orders...`);
        
        for (const eo of executiveOrders) {
          // 1. Insert or update the Executive Order
          const existingEO = await this.pool.query(
            'SELECT id FROM executive_orders WHERE eo_number = $1',
            [eo.eoNumber]
          );
          
          let eoId: number;
          if (existingEO.rows.length > 0) {
            // Update existing EO — full 22-field schema (Feb 2026)
            eoId = existingEO.rows[0].id;
            await this.pool.query(
              `UPDATE executive_orders SET
                title = $1, status = $2, president = $3, term = $4,
                summary = COALESCE($5, summary),
                full_text_url = COALESCE($6, full_text_url),
                pdf_url = COALESCE($7, pdf_url),
                federal_register_citation = COALESCE($8, federal_register_citation),
                topics = COALESCE($9, topics),
                enjoined_date = COALESCE($10, enjoined_date),
                enjoined_by = COALESCE($11, enjoined_by),
                revoked_date = COALESCE($12, revoked_date),
                revoked_by = COALESCE($13, revoked_by),
                published_date = COALESCE($14, published_date),
                updated_at = $15
              WHERE id = $16`,
              [
                eo.title,
                eo.status || 'active',
                eo.president || null,
                eo.term || null,
                eo.summary || null,
                eo.fullTextUrl || null,
                eo.pdfUrl || null,
                eo.federalRegisterCitation || null,
                eo.topics || null,
                eo.enjoinedDate || null,
                eo.enjoinedBy || null,
                eo.revokedDate || null,
                eo.revokedBy || null,
                eo.publishedDate || null,
                new Date(),
                eoId
              ]
            );
          } else {
            // Insert new EO — full 22-field schema (Feb 2026)
            const newEO = await this.pool.query(
              `INSERT INTO executive_orders (
                eo_number, title, signed_date, published_date, status,
                president, term, summary, full_text_url, pdf_url,
                federal_register_citation, topics,
                enjoined_date, enjoined_by, revoked_date, revoked_by
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING id`,
              [
                eo.eoNumber,
                eo.title,
                eo.signedDate,
                eo.publishedDate || null,
                eo.status || 'active',
                eo.president || null,
                eo.term || null,
                eo.summary || null,
                eo.fullTextUrl || null,
                eo.pdfUrl || null,
                eo.federalRegisterCitation || null,
                eo.topics || null,
                eo.enjoinedDate || null,
                eo.enjoinedBy || null,
                eo.revokedDate || null,
                eo.revokedBy || null
              ]
            );
            eoId = newEO.rows[0].id;
            console.log(`   📜 Created new EO: ${eo.eoNumber}`);
          }
          
          // 2. Create or update the EO-Regulation impact
          const existingImpact = await this.pool.query(
            'SELECT id FROM eo_regulation_impacts WHERE eo_id = $1 AND regulation_id = $2',
            [eoId, update.regulationId]
          );
          
          let impactId: number;
          if (existingImpact.rows.length > 0) {
            impactId = existingImpact.rows[0].id;
            await this.pool.query(
              `UPDATE eo_regulation_impacts SET
                impact_type = $1, impact_severity = $2, impact_summary = $3,
                assessed_by = $4, confidence_score = $5,
                affected_sections = COALESCE($6, affected_sections),
                assessment_date = COALESCE($7, assessment_date),
                updated_at = $8
              WHERE id = $9`,
              [
                eo.impactType,
                eo.impactSeverity,
                eo.impactSummary || null,
                'MCP Engine AI',
                eo.confidenceScore?.toString() || null,
                eo.affectedSections ? JSON.stringify(eo.affectedSections) : null,
                eo.assessmentDate || null,
                new Date(),
                impactId
              ]
            );
          } else {
            const newImpact = await this.pool.query(
              `INSERT INTO eo_regulation_impacts (
                eo_id, regulation_id, impact_type, impact_severity, impact_summary,
                assessed_by, assessment_date, confidence_score, affected_sections, review_status
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
              [
                eoId,
                update.regulationId,
                eo.impactType,
                eo.impactSeverity,
                eo.impactSummary || null,
                'MCP Engine AI',
                eo.assessmentDate || new Date().toISOString().split('T')[0],
                eo.confidenceScore?.toString() || null,
                eo.affectedSections ? JSON.stringify(eo.affectedSections) : null,
                'pending'
              ]
            );
            impactId = newImpact.rows[0].id;
          }
          
          // 3. Auto-create a best practice task for this EO impact
          const taskTitle = `Review: ${eo.eoNumber} - ${eo.title}`;
          const existingTask = await this.pool.query(
            `SELECT id FROM compliance_tasks 
             WHERE regulation_id = $1 AND title = $2`,
            [update.regulationId, taskTitle]
          );
          
          if (existingTask.rows.length === 0) {
            const priorityMap: Record<string, string> = {
              'critical': 'critical',
              'high': 'high',
              'medium': 'medium',
              'low': 'low'
            };
            
            const newTask = await this.pool.query(
              `INSERT INTO compliance_tasks (
                regulation_id, title, description, instructions,
                priority, requirement_type, status, assigned_role
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
              [
                update.regulationId,
                taskTitle,
                eo.impactSummary || `Executive Order ${eo.eoNumber} may affect this regulation.`,
                `Review the impact of ${eo.eoNumber} "${eo.title}" on your compliance policies. ` +
                `Impact: ${eo.impactType} (${eo.impactSeverity} severity). ` +
                `Federal Register: ${eo.fullTextUrl || 'N/A'}`,
                priorityMap[eo.impactSeverity] || 'medium',
                'best_practice', // EO reviews are best practices
                'pending',
                'Chief Compliance Officer' // Default to CCO
              ]
            );
            
            // Link the task to the impact
            await this.pool.query(
              'UPDATE eo_regulation_impacts SET generated_task_id = $1 WHERE id = $2',
              [newTask.rows[0].id, impactId]
            );
            
            console.log(`   ✅ Created review task for ${eo.eoNumber} (${eo.impactSeverity})`);
          }
        }
        
        console.log(`   ⚖️ Processed ${executiveOrders.length} Executive Orders`);
      }

      // 4. Mark the update as accepted
      await this.db.update(regulationUpdates)
        .set({
          status: "accepted",
          signature,
          userId,
          processedAt: new Date(),
        })
        .where(eq(regulationUpdates.id, id));

    } catch (error) {
      console.error(`Error accepting regulation update with ID ${id}:`, error);
      throw error;
    }
  }

  async rejectRegulationUpdate(id: number, userId: number, signature: string, reason: string): Promise<void> {
    try {
      await this.db.update(regulationUpdates)
        .set({
          status: "rejected",
          signature,
          userId,
          rejectionReason: reason,
          processedAt: new Date(),
        })
        .where(eq(regulationUpdates.id, id));
    } catch (error) {
      console.error(`Error rejecting regulation update with ID ${id}:`, error);
      throw error;
    }
  }

  async deferRegulationUpdate(id: number, userId: number, signature: string): Promise<void> {
    try {
      await this.db.update(regulationUpdates)
        .set({
          status: "deferred",
          signature,
          userId,
          processedAt: new Date(),
        })
        .where(eq(regulationUpdates.id, id));
    } catch (error) {
      console.error(`Error deferring regulation update with ID ${id}:`, error);
      throw error;
    }
  }

  async bulkDeleteRegulationUpdates(ids: number[]): Promise<void> {
    try {
      // Use raw SQL for bulk delete with IN clause
      const placeholders = ids.map((_, index) => `$${index + 1}`).join(',');
      await this.pool.query(
        `DELETE FROM regulation_updates WHERE id IN (${placeholders})`,
        ids
      );
    } catch (error) {
      console.error(`Error bulk deleting regulation updates:`, error);
      throw error;
    }
  }

  async getUser(id: number, _tenantId?: string): Promise<User | undefined> {
    try {
      const [user] = await this.db.select().from(users).where(eq(users.id, id));
      return user;
    } catch (error) {
      console.error("Error in getUser:", error);
      return undefined;
    }
  }

  async getUserByUsername(username: string, _tenantId?: string): Promise<User | undefined> {
    try {
      const [user] = await this.db.select().from(users).where(eq(users.username, username));
      return user;
    } catch (error) {
      console.error(`Error in getUserByUsername for ${username}:`, error);
      throw error;
    }
  }

  async getUserByEmail(email: string, _tenantId?: string): Promise<User | undefined> {
    try {
      const [user] = await this.db.select().from(users).where(eq(users.email, email));
      return user;
    } catch (error) {
      console.error(`Error in getUserByEmail for ${email}:`, error);
      throw error;
    }
  }

  async getUserByExternalId(externalId: string, _tenantId?: string): Promise<User | undefined> {
    try {
      const [user] = await this.db.select().from(users).where(eq(users.externalId, externalId));
      return user;
    } catch (error) {
      console.error(`Error in getUserByExternalId for ${externalId}:`, error);
      throw error;
    }
  }

  async createUser(insertUser: InsertUser, _tenantId?: string): Promise<User> {
    // NOTE: In multi-tenant mode, this storage instance is already bound to the
    // correct tenant database via getDatabaseStorage(tenantId). We do NOT need to
    // re-resolve tenant storage here — this.db already points to the right database.

    // Handle optional password for SAML users - ensure we have a valid password or null
    const userToCreate = {
      ...insertUser,
      password: insertUser.password || '' // Use empty string instead of null for database compatibility
    };

    const [user] = await this.db.insert(users).values(userToCreate).returning();
    return user;
  }

  async getAllUsers(_tenantId?: string): Promise<User[]> {
    return await this.db.select().from(users);
  }

  async updateUser(id: number, userData: Partial<InsertUser>, _tenantId?: string): Promise<User> {
    const [user] = await this.db
      .update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async deleteUser(id: number, _tenantId?: string): Promise<void> {
    await this.db.delete(users).where(eq(users.id, id));
  }

  async getRegulations(): Promise<Regulation[]> {
    try {
      
      // Temporary fix: Use raw SQL to bypass Drizzle column mapping issues
      // Filter by is_current = true to exclude deprecated/duplicate regulations (MCP Engine sync Jan 2026)
      const result = await this.db.execute(sql`
        SELECT * FROM regulations 
        WHERE is_current = true
        ORDER BY last_updated DESC 
        LIMIT 1000
      `);
      
      // Convert raw result to proper format
      const formattedResult = result.rows.map((row: any) => ({
        ...row,
        jurisdictionSource: row.jurisdiction_source,
        lastUpdated: row.last_updated,
        lastVerified: row.last_verified,
        nextReviewDate: row.next_review_date,
        originationDate: row.origination_date,
        effectiveDate: row.effective_date,
        versionNumber: row.version_number,
        previousVersionId: row.previous_version_id,
        isApplicable: row.is_applicable,
        applicableInstitutions: row.applicable_institutions,
        filingDeadlines: row.filing_deadlines,
        relatedRegulations: row.related_regulations,
        notificationSchedule: row.notification_schedule,
        notificationOverride: row.notification_override,
        versionMetadata: row.version_metadata
      }));

      return formattedResult as Regulation[];
    } catch (error) {
      console.error("❌ [DEBUG] Error in getRegulations:", error);
      console.error("❌ [DEBUG] Error stack:", error.stack);
      // Return empty array instead of throwing to prevent frontend from getting stuck
      return [];
    }
  }

  async getRegulation(id: number): Promise<Regulation | undefined> {
    // Use raw SQL query to ensure regulation_text is included
    const result = await this.db.execute(sql`SELECT *, regulation_text FROM regulations WHERE id = ${id} LIMIT 1`);
    const regulation = result.rows[0] as any;
    
    if (regulation) {
      // Map snake_case to camelCase for consistency
      regulation.regulationText = regulation.regulation_text;
      
      // Parse JSON fields that come back as strings from raw SQL
      if (typeof regulation.actions === 'string') {
        try {
          regulation.actions = JSON.parse(regulation.actions);
        } catch {
          regulation.actions = [];
        }
      }
      
      if (typeof regulation.sections === 'string') {
        try {
          regulation.sections = JSON.parse(regulation.sections);
        } catch {
          regulation.sections = [];
        }
      }
    }
    
    return regulation as Regulation | undefined;
  }

  async getRegulationById(regulationId: string): Promise<Regulation | null> {
    try {
      // First try to find by itemId (which is what the UI uses)
      const results = await this.db.select()
        .from(regulations)
        .where(eq(regulations.itemId, regulationId));

      if (results.length > 0) {
        return results[0] as Regulation;
      }

      // Fallback to regular numeric ID if itemId search fails
      const numericId = parseInt(regulationId, 10);
      if (isNaN(numericId)) {
        return null;
      }
      const fallbackResults = await this.db.select()
        .from(regulations)
        .where(eq(regulations.id, numericId));

      return fallbackResults.length > 0 ? (fallbackResults[0] as Regulation) : null;
    } catch (error) {
      console.error(`Error fetching regulation with ID ${regulationId}:`, error);
      throw error;
    }
  }

  async getRegulationByRegKey(regKey: string): Promise<Regulation | null> {
    try {
      const results = await this.db.select()
        .from(regulations)
        .where(eq(regulations.regKey, regKey));

      return results.length > 0 ? (results[0] as Regulation) : null;
    } catch (error) {
      console.error(`Error fetching regulation by reg_key ${regKey}:`, error);
      return null;
    }
  }

  async createRegulation(regulation: InsertRegulation): Promise<Regulation> {
    const [newRegulation] = await this.db.insert(regulations).values(regulation).returning();
    return newRegulation as Regulation;
  }

  async updateRegulation(id: number, regulation: Partial<InsertRegulation>): Promise<Regulation> {

    try {
      // If we're updating content/requirements, handle it differently due to potential size
      if (regulation.requirements) {
        // First, update the text field directly using parameterized query
        await this.pool.query(
          `UPDATE regulations SET requirements = $1, last_updated = $2 WHERE id = $3`,
          [regulation.requirements, new Date(), id]
        );

        // Remove the requirements field from the update object
        const { requirements: _requirements, ...otherFields } = regulation;

        // If there are other fields to update, do that separately
        if (Object.keys(otherFields).length > 0) {
          await this.db.update(regulations)
            .set({
              ...otherFields,
              lastUpdated: new Date()
            })
            .where(eq(regulations.id, id));
        }

        // Fetch and return the updated regulation
        const results = await this.db.select().from(regulations).where(eq(regulations.id, id));
        if (results.length > 0) {
          return results[0] as Regulation;
        } else {
          throw new Error(`Regulation with ID ${id} not found after update`);
        }
      } else {
        // No requirements field, regular update
        const [updatedRegulation] = await this.db
          .update(regulations)
          .set({
            ...regulation,
            lastUpdated: new Date()
          })
          .where(eq(regulations.id, id))
          .returning();

        return updatedRegulation as Regulation;
      }
    } catch (error) {
      console.error(`Error updating regulation ${id}:`, error);
      throw error;
    }
  }

  async setRegulationApplicability(id: number, isApplicable: boolean): Promise<Regulation> {
    const [updatedRegulation] = await this.db
      .update(regulations)
      .set({
        isApplicable,
        lastUpdated: new Date()
      })
      .where(eq(regulations.id, id))
      .returning();
    return updatedRegulation as Regulation;
  }

  async getRegulationsByJurisdiction(jurisdiction: string): Promise<Regulation[]> {
    const result = await this.db
      .select()
      .from(regulations)
      .where(eq(regulations.jurisdictionSource, jurisdiction));
    return result as Regulation[];
  }

  async getRegulationsByJurisdictionSource(jurisdictionSource: string): Promise<Regulation[]> {
    const result = await this.db
      .select()
      .from(regulations)
      .where(eq(regulations.jurisdictionSource, jurisdictionSource));
    return result as Regulation[];
  }

  async getRegulationsByInstitutionType(institutionType: string): Promise<Regulation[]> {

    // Use raw SQL to query JSONB field
    const query = `
      SELECT * FROM regulations 
      WHERE applicable_institutions @> $1 
      OR applicable_institutions @> $2
      ORDER BY last_updated DESC
    `;

    const result = await this.pool.query(query, [
      JSON.stringify([institutionType]),
      JSON.stringify(['all-institutions'])
    ]);

    return result.rows as Regulation[];
  }

  async searchRegulations(searchTerm: string): Promise<Regulation[]> {
    try {
      const results = await this.db.select()
        .from(regulations)
        .where(
          or(
            eq(regulations.itemId, searchTerm),
            like(regulations.name, `%${searchTerm}%`),
            like(regulations.topic, `%${searchTerm}%`)
          )
        );
      return results as Regulation[];
    } catch (error) {
      console.error("Error searching regulations:", error);
      return [];
    }
  }

  async deleteRegulation(id: number): Promise<void> {
    await this.db.delete(regulations).where(eq(regulations.id, id));
  }

  async getNotificationsByUser(userId: number): Promise<Notification[]> {
    return await this.db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId));
  }

  async getAllNotifications(): Promise<Notification[]> {
    return await this.db
      .select()
      .from(notifications)
      .orderBy(notifications.id);
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [newNotification] = await this.db
      .insert(notifications)
      .values(notification)
      .returning();
    return newNotification;
  }

  async sendEmailNotification(userId: number, subject: string, message: string): Promise<boolean> {
    const user = await this.getUser(userId);
    if (!user) return false;

    const userNotifications = await this.getNotificationsByUser(userId);
    const emailEnabled = userNotifications.some(n => n.type === 'email' && n.enabled);

    if (!emailEnabled) return false;

    return emailService.sendEmail(user.email, subject, message);
  }

  async getDeadlines(): Promise<Deadline[]> {
    return await this.db.select().from(deadlines);
  }

  async getAllIncompleteDeadlines(): Promise<Deadline[]> {
    return await this.db
      .select()
      .from(deadlines)
      .where(eq(deadlines.status, "pending"));
  }

  async createDeadline(deadline: InsertDeadline): Promise<Deadline> {
    const [newDeadline] = await this.db.insert(deadlines).values(deadline).returning();
    return newDeadline;
  }

  async updateDeadline(id: number, deadlineData: Partial<InsertDeadline>): Promise<Deadline> {
    const [updatedDeadline] = await this.db
      .update(deadlines)
      .set(deadlineData)
      .where(eq(deadlines.id, id))
      .returning();
    return updatedDeadline;
  }

  async deleteDeadline(id: number): Promise<void> {
    await this.db.delete(deadlines).where(eq(deadlines.id, id));
  }

  async getGuides(): Promise<Guide[]> {
    return await this.db.select().from(guides);
  }

  async getGuidesByCategory(category: string): Promise<Guide[]> {
    return await this.db
      .select()
      .from(guides)
      .where(eq(guides.category, category));
  }

  async getGuide(id: number): Promise<Guide | undefined> {
    const [guide] = await this.db.select().from(guides).where(eq(guides.id, id));
    return guide;
  }

  async createGuide(guide: InsertGuide): Promise<Guide> {
    const [newGuide] = await this.db.insert(guides).values(guide).returning();
    return newGuide;
  }

  async updateGuide(id: number, guide: Partial<InsertGuide>): Promise<Guide> {
    const [updatedGuide] = await this.db
      .update(guides)
      .set(guide)
      .where(eq(guides.id, id))
      .returning();
    return updatedGuide;
  }

  async hasAdmin(): Promise<boolean> {
    const [adminUser] = await this.db
      .select()
      .from(users)
      .where(eq(users.role, "admin"))
      .limit(1);
    return !!adminUser;
  }

  async getNotesByRegulation(regulationId: number): Promise<Note[]> {
    return await this.db
      .select()
      .from(notes)
      .where(eq(notes.regulationId, regulationId))
      .orderBy(desc(notes.updatedAt));
  }

  async getNotesByUser(userId: number): Promise<Note[]> {
    return await this.db
      .select()
      .from(notes)
      .where(eq(notes.userId, userId))
      .orderBy(desc(notes.updatedAt));
  }

  async getNote(id: number): Promise<Note | null> {
    const result = await this.db
      .select()
      .from(notes)
      .where(eq(notes.id, id))
      .then((res) => res[0]);
    return result || null;
  }

  async createNote(note: InsertNote): Promise<Note> {
    const [newNote] = await this.db
      .insert(notes)
      .values(note)
      .returning();
    return newNote;
  }

  async updateNote(id: number, noteData: Partial<InsertNote>, userId?: number): Promise<Note> {
    // Get the current note state before updating
    const currentNote = await this.getNote(id);
    if (!currentNote) {
      throw new Error(`Note with id ${id} not found`);
    }

    // Update the note
    const [updatedNote] = await this.db
      .update(notes)
      .set({
        ...noteData,
        updatedAt: new Date()
      })
      .where(eq(notes.id, id))
      .returning();

    // Create history record if userId is provided
    if (userId) {
      await this.createNoteHistory({
        noteId: id,
        userId: userId,
        action: 'updated',
        previousTitle: currentNote.title,
        previousContent: currentNote.content,
        previousCategory: currentNote.category,
        previousIsPrivate: currentNote.isPrivate,
        newTitle: noteData.title || currentNote.title,
        newContent: noteData.content || currentNote.content,
        newCategory: noteData.category || currentNote.category,
        newIsPrivate: noteData.isPrivate !== undefined ? noteData.isPrivate : currentNote.isPrivate,
      });
    }

    return updatedNote;
  }

  async deleteNote(id: number): Promise<void> {
    await this.db.delete(notes).where(eq(notes.id, id));
  }

  async createNoteHistory(history: InsertNoteHistory): Promise<NoteHistory> {
    const [noteHistoryRecord] = await this.db
      .insert(noteHistory)
      .values(history)
      .returning();
    return noteHistoryRecord;
  }

  async getNoteHistory(noteId: number): Promise<NoteHistory[]> {
    return await this.db
      .select({
        id: noteHistory.id,
        noteId: noteHistory.noteId,
        userId: noteHistory.userId,
        action: noteHistory.action,
        previousTitle: noteHistory.previousTitle,
        previousContent: noteHistory.previousContent,
        previousCategory: noteHistory.previousCategory,
        previousIsPrivate: noteHistory.previousIsPrivate,
        newTitle: noteHistory.newTitle,
        newContent: noteHistory.newContent,
        newCategory: noteHistory.newCategory,
        newIsPrivate: noteHistory.newIsPrivate,
        changeReason: noteHistory.changeReason,
        createdAt: noteHistory.createdAt,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
        }
      })
      .from(noteHistory)
      .leftJoin(users, eq(noteHistory.userId, users.id))
      .where(eq(noteHistory.noteId, noteId))
      .orderBy(desc(noteHistory.createdAt));
  }

  async createEvidenceFile(file: InsertEvidenceFile): Promise<EvidenceFile> {
    try {
      const [evidenceFile] = await this.db
        .insert(evidenceFiles)
        .values(file)
        .returning();

      return evidenceFile;
    } catch (error) {
      console.error("Error creating evidence file:", error);
      throw error;
    }
  }

  async getEvidenceFilesByRegulation(regulationId: number): Promise<EvidenceFile[]> {
    try {
      // First, get the evidence files
      const files = await this.db
        .select()
        .from(evidenceFiles)
        .where(eq(evidenceFiles.regulationId, regulationId))
        .orderBy(desc(evidenceFiles.uploadedAt));

      // Then, for each file, look up the user's details separately
      const result = await Promise.all(
        files.map(async (file) => {
          if (file.uploadedBy) {
            const user = await this.getUser(file.uploadedBy);
            return {
              ...file,
              // Use the user's first and last name if available, or username as fallback
              uploaderName: (user?.firstName && user?.lastName)
                ? `${user.firstName} ${user.lastName}`
                : user?.username || 'Unknown'
            };
          }
          return {
            ...file,
            uploaderName: 'Unknown'
          };
        })
      );

      return result;
    } catch (error) {
      console.error("Error fetching evidence files:", error);
      throw error;
    }
  }

  async getEvidenceFile(id: number): Promise<EvidenceFile | undefined> {
    try {
      const [file] = await this.db
        .select()
        .from(evidenceFiles)
        .where(eq(evidenceFiles.id, id));
      return file;
    } catch (error) {
      console.error("Error fetching evidence file:", error);
      throw error;
    }
  }

  async updateEvidenceFileStatus(id: number, status: string): Promise<EvidenceFile> {
    try {
      const [file] = await this.db
        .update(evidenceFiles)
        .set({ status })
        .where(eq(evidenceFiles.id, id))
        .returning();
      return file;
    } catch (error) {
      console.error("Error updating evidence file status:", error);
      throw error;
    }
  }

  // =========================================================================
  // MCP Regulation Version Methods
  // =========================================================================

  async getRegulationVersions(regulationId: number): Promise<RegulationVersion[]> {
    try {
      const versions = await this.db
        .select()
        .from(regulationVersions)
        .where(eq(regulationVersions.regulationId, regulationId))
        .orderBy(desc(regulationVersions.versionNumber));

      return versions;
    } catch (error) {
      console.error(`Error fetching regulation versions for regulation ${regulationId}:`, error);
      return [];
    }
  }

  async getRegulationVersion(id: number): Promise<RegulationVersion | null> {
    try {
      const [version] = await this.db
        .select()
        .from(regulationVersions)
        .where(eq(regulationVersions.id, id));

      return version || null;
    } catch (error) {
      console.error(`Error fetching regulation version ${id}:`, error);
      return null;
    }
  }

  async createRegulationVersion(version: InsertRegulationVersion): Promise<RegulationVersion> {
    try {
      const [newVersion] = await this.db
        .insert(regulationVersions)
        .values(version)
        .returning();

      return newVersion;
    } catch (error) {
      console.error("Error creating regulation version:", error);
      throw error;
    }
  }

  // Enhanced Version Control Methods for API
  async getPendingUpdatesForRegulation(regulationId: number): Promise<any[]> {
    try {
      const result = await this.pool.query(`
        SELECT 
          ru.id,
          ru.regulation_id as "regulationId",
          ru.name,
          ru.status,
          ru.update_date as "updateDate",
          ru.signature,
          ru.user_id as "userId",
          u.username,
          u."firstName" as "firstName",
          u."lastName" as "lastName"
        FROM regulation_updates ru
        LEFT JOIN users u ON ru.user_id = u.id
        WHERE ru.regulation_id = $1 AND ru.status = 'pending'
        ORDER BY ru.update_date DESC
      `, [regulationId]);

      return result.rows.map(row => ({
        ...row,
        updateDate: row.updateDate.toISOString(),
        user: row.username ? {
          username: row.username,
          firstName: row.firstName,
          lastName: row.lastName
        } : undefined
      }));
    } catch (error) {
      console.error('Error fetching pending updates:', error);
      throw error;
    }
  }


  async updateRegulationContent(regulationId: number, content: string, _userId: number): Promise<void> {
    try {
      await this.pool.query(`
        UPDATE regulations 
        SET summary = $1, last_updated = NOW()
        WHERE id = $2
      `, [content, regulationId]);
    } catch (error) {
      console.error('Error updating regulation content:', error);
      throw error;
    }
  }

  async createAuditLogEntry(entry: {
    userId: number;
    action: string;
    resourceType: string;
    resourceId: number;
    details: any;
  }): Promise<void> {
    // Import AuditService dynamically to avoid circular dependencies
    const { AuditService } = await import('./services/audit');
    
    try {
      await AuditService.logAudit({
        entityType: entry.resourceType,
        entityId: entry.resourceId.toString(),
        action: entry.action as any,
        metadata: entry.details,
        complianceImpact: 'medium'
      }, {
        userId: entry.userId,
        requestId: `legacy_${Date.now()}`
      });
    } catch (error) {
      // Fallback - audit service failed
      console.error('Audit logging failed:', error instanceof Error ? error.message : String(error));
    }
  }

  async getRegulationTimeline(regulationId: number): Promise<any[]> {
    try {
      // Get versions
      const versions = await this.getRegulationVersions(regulationId);
      
      // Get pending updates
      const pendingUpdates = await this.getPendingUpdatesForRegulation(regulationId);
      
      // Get regulation milestones
      const regulation = await this.getRegulation(regulationId);
      
      const timeline = [];
      
      // Add version events
      versions.forEach(version => {
        timeline.push({
          id: `version-${version.id}`,
          date: version.createdAt,
          type: 'version',
          title: `Version ${version.versionNumber}`,
          description: `${version.source === 'mcp' ? 'MCP Engine Update' : 
                       version.source === 'import' ? 'Imported Update' :
                       version.source === 'rollback' ? 'Rolled Back' : 'Manual Update'}`,
          data: version,
          status: 'completed'
        });
      });
      
      // Add pending update events
      pendingUpdates.forEach(update => {
        timeline.push({
          id: `update-${update.id}`,
          date: update.updateDate,
          type: 'update',
          title: 'Pending Update',
          description: update.name,
          data: update,
          status: 'pending'
        });
      });
      
      // Add regulation milestones
      if (regulation?.originationDate) {
        timeline.push({
          id: 'originated',
          date: regulation.originationDate,
          type: 'milestone',
          title: 'Regulation Originated',
          description: 'Initial publication',
          data: null,
          status: 'completed'
        });
      }
      
      if (regulation?.effectiveDate) {
        timeline.push({
          id: 'effective',
          date: regulation.effectiveDate,
          type: 'milestone',
          title: 'Became Effective',
          description: 'Regulation became legally effective',
          data: null,
          status: 'completed'
        });
      }
      
      // Sort by date (newest first)
      return timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } catch (error) {
      console.error('Error fetching regulation timeline:', error);
      throw error;
    }
  }

  async getRegulationVersionStats(regulationId: number): Promise<any> {
    try {
      const versions = await this.getRegulationVersions(regulationId);
      const pendingUpdates = await this.getPendingUpdatesForRegulation(regulationId);
      
      const sourceStats = versions.reduce((acc, version) => {
        acc[version.source] = (acc[version.source] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      return {
        totalVersions: versions.length,
        pendingUpdates: pendingUpdates.length,
        sourceBreakdown: sourceStats,
        latestVersion: versions[0]?.versionNumber || 0,
        firstCreated: versions[versions.length - 1]?.createdAt,
        lastUpdated: versions[0]?.createdAt
      };
    } catch (error) {
      console.error('Error fetching version statistics:', error);
      throw error;
    }
  }

  async getLatestRegulationVersion(regulationId: number): Promise<RegulationVersion | null> {
    try {
      const [latestVersion] = await this.db
        .select()
        .from(regulationVersions)
        .where(eq(regulationVersions.regulationId, regulationId))
        .orderBy(desc(regulationVersions.versionNumber))
        .limit(1);

      return latestVersion || null;
    } catch (error) {
      console.error(`Error fetching latest regulation version for regulation ${regulationId}:`, error);
      return null;
    }
  }

  async compareRegulationVersions(versionIdA: number, versionIdB: number): Promise<{
    changes: Array<{
      field: string;
      valueA: string;
      valueB: string;
      changeType: 'added' | 'removed' | 'modified';
    }>;
  }> {
    try {
      const versionA = await this.getRegulationVersion(versionIdA);
      const versionB = await this.getRegulationVersion(versionIdB);

      if (!versionA || !versionB) {
        throw new Error(`Cannot compare: One or both versions not found (${versionIdA}, ${versionIdB})`);
      }

      // Parse the content to compare fields
      const contentA = JSON.parse(versionA.content);
      const contentB = JSON.parse(versionB.content);

      const changes: Array<{
        field: string;
        valueA: string;
        valueB: string;
        changeType: 'added' | 'removed' | 'modified';
      }> = [];

      // Get all unique keys from both objects
      const allFields = new Set([...Object.keys(contentA), ...Object.keys(contentB)]);

      // Compare each field
      for (const field of allFields) {
        const valueA = contentA[field] !== undefined ? String(contentA[field]) : '';
        const valueB = contentB[field] !== undefined ? String(contentB[field]) : '';

        if (valueA && !valueB) {
          changes.push({
            field,
            valueA,
            valueB: '',
            changeType: 'removed'
          });
        } else if (!valueA && valueB) {
          changes.push({
            field,
            valueA: '',
            valueB,
            changeType: 'added'
          });
        } else if (valueA !== valueB) {
          changes.push({
            field,
            valueA,
            valueB,
            changeType: 'modified'
          });
        }
      }

      return { changes };
    } catch (error) {
      console.error(`Error comparing regulation versions ${versionIdA} and ${versionIdB}:`, error);
      return { changes: [] };
    }
  }

  // =========================================================================
  // MCP Validation Status Methods
  // =========================================================================

  async getValidationStatus(regulationId: number, versionId?: number): Promise<ValidationStatus[]> {
    try {
      let query = this.db
        .select()
        .from(validationStatus)
        .where(eq(validationStatus.regulationId, regulationId));

      if (versionId) {
        query = query.where(eq(validationStatus.versionId, versionId));
      }

      const statuses = await query;
      return statuses;
    } catch (error) {
      console.error(`Error fetching validation status for regulation ${regulationId}:`, error);
      return [];
    }
  }

  async createValidationStatus(status: InsertValidationStatus): Promise<ValidationStatus> {
    try {
      const [newStatus] = await this.db
        .insert(validationStatus)
        .values(status)
        .returning();

      return newStatus;
    } catch (error) {
      console.error("Error creating validation status:", error);
      throw error;
    }
  }

  async updateValidationStatus(id: number, status: Partial<InsertValidationStatus>): Promise<ValidationStatus> {
    try {
      const [updatedStatus] = await this.db
        .update(validationStatus)
        .set(status)
        .where(eq(validationStatus.id, id))
        .returning();

      return updatedStatus;
    } catch (error) {
      console.error(`Error updating validation status ${id}:`, error);
      throw error;
    }
  }

  async validateRegulationVersion(versionId: number, userId: number): Promise<ValidationStatus[]> {
    try {
      // This would typically call validation services for each level
      // For now, we'll create basic validation records
      const version = await this.getRegulationVersion(versionId);

      if (!version) {
        throw new Error(`Version ${versionId} not found`);
      }

      const results: ValidationStatus[] = [];

      // Example: Create validation records for each level
      for (const level of ['A', 'B', 'C', 'D']) {
        // Simulate validation process
        const isPassed = Math.random() > 0.3; // 70% pass rate for demonstration

        const validationRecord: InsertValidationStatus = {
          regulationId: version.regulationId,
          versionId: version.id,
          level,
          status: isPassed ? 'passed' : 'failed',
          details: {
            errors: isPassed ? [] : [{
              field: 'requirements',
              message: `Sample validation error for level ${level}`,
              code: `ERR_${level}_001`,
              severity: 'warning'
            }]
          },
          validatedAt: new Date(),
          validatedBy: userId
        };

        const savedRecord = await this.createValidationStatus(validationRecord);
        results.push(savedRecord);
      }

      return results;
    } catch (error) {
      console.error(`Error validating version ${versionId}:`, error);
      throw error;
    }
  }

  // =========================================================================
  // MCP Sync Control Methods
  // =========================================================================

  async getSyncControl(regulationId: number): Promise<SyncControl | null> {
    try {
      const [control] = await this.db
        .select()
        .from(syncControl)
        .where(eq(syncControl.regulationId, regulationId));

      return control || null;
    } catch (error) {
      console.error(`Error fetching sync control for regulation ${regulationId}:`, error);
      return null;
    }
  }

  async createSyncControl(control: InsertSyncControl): Promise<SyncControl> {
    try {
      const [newControl] = await this.db
        .insert(syncControl)
        .values(control)
        .returning();

      return newControl;
    } catch (error) {
      console.error("Error creating sync control:", error);
      throw error;
    }
  }

  async updateSyncControl(id: number, control: Partial<InsertSyncControl>): Promise<SyncControl> {
    try {
      const [updatedControl] = await this.db
        .update(syncControl)
        .set({
          ...control,
          updatedAt: new Date()
        })
        .where(eq(syncControl.id, id))
        .returning();

      return updatedControl;
    } catch (error) {
      console.error(`Error updating sync control ${id}:`, error);
      throw error;
    }
  }

  async scheduleSyncForRegulation(regulationId: number, nextSync: Date): Promise<SyncControl> {
    try {
      // Check if sync control already exists
      const existingControl = await this.getSyncControl(regulationId);

      if (existingControl) {
        // Update existing control
        return this.updateSyncControl(existingControl.id, {
          nextScheduledSync: nextSync,
          syncState: 'idle'
        });
      } else {
        // Create new control
        return this.createSyncControl({
          regulationId,
          nextScheduledSync: nextSync,
          syncState: 'idle',
          syncSettings: {
            frequency: 'daily',
            priority: 'normal',
            includeContent: true,
            validateOnSync: true
          }
        });
      }
    } catch (error) {
      console.error(`Error scheduling sync for regulation ${regulationId}:`, error);
      throw error;
    }
  }

  async recordSyncAttempt(regulationId: number, success: boolean, error?: string): Promise<SyncControl> {
    try {
      const existingControl = await this.getSyncControl(regulationId);
      const now = new Date();

      if (!existingControl) {
        // Create new control record if it doesn't exist
        return this.createSyncControl({
          regulationId,
          lastSyncAttempt: now,
          lastSuccessfulSync: success ? now : null,
          syncErrors: !success && error ? [{
            timestamp: now,
            message: error,
            code: 'SYNC_ERROR'
          }] : [],
          syncState: success ? 'completed' : 'failed'
        });
      }

      // Update existing control
      const syncErrors = existingControl.syncErrors || [];
      if (!success && error) {
        syncErrors.push({
          timestamp: now,
          message: error,
          code: 'SYNC_ERROR'
        });
      }

      return this.updateSyncControl(existingControl.id, {
        lastSyncAttempt: now,
        lastSuccessfulSync: success ? now : existingControl.lastSuccessfulSync,
        syncErrors,
        syncState: success ? 'completed' : 'failed'
      });
    } catch (error) {
      console.error(`Error recording sync attempt for regulation ${regulationId}:`, error);
      throw error;
    }
  }

  // =========================================================================
  // MCP Notification Queue Methods
  // =========================================================================

  async getNotificationQueue(status?: 'pending' | 'sent' | 'failed'): Promise<NotificationQueue[]> {
    try {
      let query = this.db.select().from(notificationQueue);

      if (status) {
        query = query.where(eq(notificationQueue.status, status));
      }

      return await query.orderBy(desc(notificationQueue.createdAt));
    } catch (error) {
      console.error(`Error fetching notification queue:`, error);
      return [];
    }
  }

  async createNotificationQueueItem(item: InsertNotificationQueue): Promise<NotificationQueue> {
    try {
      const [newItem] = await this.db
        .insert(notificationQueue)
        .values(item)
        .returning();

      return newItem;
    } catch (error) {
      console.error("Error creating notification queue item:", error);
      throw error;
    }
  }

  async updateNotificationQueueItem(id: number, item: Partial<InsertNotificationQueue>): Promise<NotificationQueue> {
    try {
      const [updatedItem] = await this.db
        .update(notificationQueue)
        .set(item)
        .where(eq(notificationQueue.id, id))
        .returning();

      return updatedItem;
    } catch (error) {
      console.error(`Error updating notification queue item ${id}:`, error);
      throw error;
    }
  }

  async markNotificationAsSent(id: number): Promise<NotificationQueue> {
    try {
      const [updatedItem] = await this.db
        .update(notificationQueue)
        .set({
          status: 'sent',
          sentAt: new Date()
        })
        .where(eq(notificationQueue.id, id))
        .returning();

      return updatedItem;
    } catch (error) {
      console.error(`Error marking notification ${id} as sent:`, error);
      throw error;
    }
  }

  // =========================================================================
  // MCP Version Conflict Methods
  // =========================================================================

  async getVersionConflicts(status?: 'pending' | 'resolved' | 'rejected'): Promise<VersionConflict[]> {
    try {
      let query = this.db.select().from(versionConflicts);

      if (status) {
        query = query.where(eq(versionConflicts.status, status));
      }

      return await query.orderBy(desc(versionConflicts.createdAt));
    } catch (error) {
      console.error(`Error fetching version conflicts:`, error);
      return [];
    }
  }

  async getVersionConflictsForRegulation(regulationId: number): Promise<VersionConflict[]> {
    try {
      return await this.db
        .select()
        .from(versionConflicts)
        .where(eq(versionConflicts.regulationId, regulationId))
        .orderBy(desc(versionConflicts.createdAt));
    } catch (error) {
      console.error(`Error fetching version conflicts for regulation ${regulationId}:`, error);
      return [];
    }
  }

  async createVersionConflict(conflict: InsertVersionConflict): Promise<VersionConflict> {
    try {
      const [newConflict] = await this.db
        .insert(versionConflicts)
        .values(conflict)
        .returning();

      return newConflict;
    } catch (error) {
      console.error("Error creating version conflict:", error);
      throw error;
    }
  }

  async resolveVersionConflict(id: number, resolutions: MCPVersionConflict[], userId: number): Promise<VersionConflict> {
    try {
      // Mark all conflicts as resolved with their resolution strategy
      const now = new Date();

      const resolvedConflicts = resolutions.map(resolution => ({
        ...resolution,
        resolvedBy: userId,
        resolvedAt: now
      }));

      const [updatedConflict] = await this.db
        .update(versionConflicts)
        .set({
          conflicts: resolvedConflicts,
          status: 'resolved',
          resolvedAt: now,
          resolvedBy: userId,
          resolutionMethod: 'manual'
        })
        .where(eq(versionConflicts.id, id))
        .returning();

      return updatedConflict;
    } catch (error) {
      console.error(`Error resolving version conflict ${id}:`, error);
      throw error;
    }
  }

  async rejectVersionConflict(id: number, userId: number): Promise<VersionConflict> {
    const [versionConflict] = await this.db
      .update(versionConflicts)
      .set({
        status: 'rejected' as const,
        resolvedBy: userId,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(versionConflicts.id, id))
      .returning();

    if (!versionConflict) {
      throw new Error(`Version conflict with ID ${id} not found`);
    }

    return versionConflict;
  }

  // Branding configuration methods
  async getBrandingConfig(): Promise<{ [key: string]: unknown }> {
    try {
      // CRITICAL FIX: Check admin mode FIRST to ensure proper admin branding
      const isAdminMode = process.env.ADMIN_MODE === 'true';
      if (isAdminMode) {
        const adminConfig = {
          institutionName: "EdSteward Admin Console",
          title: "EdSteward Admin Console",
          logoUrl: "/assets/generic-logo.svg",
          faviconUrl: "/favicon.ico",
          primaryColor: "#dc2626",
          secondaryColor: "#b91c1c",
          accentColor: "#ef4444",
          loginScreenBackgroundColor: "#fef2f2",
          loginScreenAccentColor: "#dc2626",
          loginScreenTextColor: "#1f2937",
          loginScreenHeroColor: "#991b1b",
        };
        return adminConfig;
      }

      // Local dev gets its own branding so it's visually distinct from staging/production
      if (process.env.NODE_ENV === 'development') {
        const devConfig = {
          institutionName: "EdSteward Local Dev",
          title: "EdSteward Local Dev",
          logoUrl: "/assets/generic-logo.svg",
          faviconUrl: "/favicon.ico",
          primaryColor: "#7c3aed",
          secondaryColor: "#6d28d9",
          accentColor: "#a78bfa",
          loginScreenBackgroundColor: "#f5f3ff",
          loginScreenAccentColor: "#7c3aed",
          loginScreenTextColor: "#1f2937",
          loginScreenHeroColor: "#4c1d95",
          tenantId: "local-dev",
        };
        return devConfig;
      }

      // Priority 2: Database configuration from tenant-specific or default pool
      const tableName = 'branding_configurations';

      // Create table if it doesn't exist
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS ${tableName} (
          id SERIAL PRIMARY KEY,
          config_data JSONB NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);

      const result = await this.pool.query(`
        SELECT config_data 
        FROM ${tableName} 
        WHERE id = 1
      `);

      if (result.rows.length > 0) {
        const dbConfig = result.rows[0].config_data;
        const primaryColor = dbConfig.primaryColor || '#3d1a5a';
        
        // Helper to darken a color for hero/secondary colors
        const darkenColor = (hex: string, percent: number): string => {
          const num = parseInt(hex.replace('#', ''), 16);
          const r = Math.max(0, Math.floor((num >> 16) * (1 - percent)));
          const g = Math.max(0, Math.floor(((num >> 8) & 0x00FF) * (1 - percent)));
          const b = Math.max(0, Math.floor((num & 0x0000FF) * (1 - percent)));
          return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
        };
        
        // Helper to lighten a color for accent colors
        const lightenColor = (hex: string, percent: number): string => {
          const num = parseInt(hex.replace('#', ''), 16);
          const r = Math.min(255, Math.floor((num >> 16) + (255 - (num >> 16)) * percent));
          const g = Math.min(255, Math.floor(((num >> 8) & 0x00FF) + (255 - ((num >> 8) & 0x00FF)) * percent));
          const b = Math.min(255, Math.floor((num & 0x0000FF) + (255 - (num & 0x0000FF)) * percent));
          return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
        };
        
        // Build complete config with derived colors from primaryColor
        const completeConfig = {
          institutionName: dbConfig.institutionName || dbConfig.tenantId || "EdSteward Institution",
          title: dbConfig.title || `${dbConfig.institutionName || dbConfig.tenantId || 'EdSteward'} Compliance Portal`,
          logoUrl: dbConfig.logoUrl || "/assets/generic-logo.svg",
          faviconUrl: dbConfig.faviconUrl || "/favicon.ico",
          primaryColor: primaryColor,
          secondaryColor: dbConfig.secondaryColor || darkenColor(primaryColor, 0.2),
          accentColor: dbConfig.accentColor || lightenColor(primaryColor, 0.3),
          loginScreenBackgroundColor: dbConfig.loginScreenBackgroundColor || "#f8fafc",
          loginScreenAccentColor: dbConfig.loginScreenAccentColor || primaryColor,
          loginScreenTextColor: dbConfig.loginScreenTextColor || "#1f2937",
          loginScreenHeroColor: dbConfig.loginScreenHeroColor || darkenColor(primaryColor, 0.3),
          tenantId: dbConfig.tenantId,
        };
        
        return completeConfig;
      }

      // Priority 3: Environment variables (for container isolation - fallback only)
      const envBrandingConfig = {
        institutionName: process.env.INSTITUTION_NAME,
        title: process.env.INSTITUTION_TITLE,
        logoUrl: process.env.INSTITUTION_LOGO_URL,
        faviconUrl: process.env.INSTITUTION_FAVICON_URL,
        primaryColor: process.env.INSTITUTION_PRIMARY_COLOR,
        secondaryColor: process.env.INSTITUTION_SECONDARY_COLOR,
        accentColor: process.env.INSTITUTION_ACCENT_COLOR,
        loginScreenBackgroundColor: process.env.INSTITUTION_LOGIN_BG_COLOR,
        loginScreenAccentColor: process.env.INSTITUTION_LOGIN_ACCENT_COLOR,
        loginScreenTextColor: process.env.INSTITUTION_LOGIN_TEXT_COLOR,
        loginScreenHeroColor: process.env.INSTITUTION_LOGIN_HERO_COLOR,
      };

      // Check if any environment variables are set
      const hasEnvConfig = Object.values(envBrandingConfig).some(val => val !== undefined);

      if (hasEnvConfig) {
        // Use environment variables with fallbacks
        const config = {
          institutionName: envBrandingConfig.institutionName || "EdSteward Institution",
          title: envBrandingConfig.title || "EdSteward Compliance Portal",
          logoUrl: envBrandingConfig.logoUrl || "/assets/es-white-on-purple-logo.png",
          faviconUrl: envBrandingConfig.faviconUrl || "/favicon.ico",
          primaryColor: envBrandingConfig.primaryColor || "#3d1a5a",
          secondaryColor: envBrandingConfig.secondaryColor || "#1e40af",
          accentColor: envBrandingConfig.accentColor || "#3b82f6",
          loginScreenBackgroundColor: envBrandingConfig.loginScreenBackgroundColor || "#f8fafc",
          loginScreenAccentColor: envBrandingConfig.loginScreenAccentColor || "#3d1a5a",
          loginScreenTextColor: envBrandingConfig.loginScreenTextColor || "#1f2937",
          loginScreenHeroColor: envBrandingConfig.loginScreenHeroColor || "#3d1a5a",
        };

        return config;
      }

      // Priority 4: Default configuration
      const defaultConfig = {
        institutionName: "EdSteward Institution",
        title: "EdSteward Compliance Portal",
        logoUrl: "/assets/es-white-on-purple-logo.png",
        faviconUrl: "/favicon.ico",
        primaryColor: "#3d1a5a",
        secondaryColor: "#1e40af",
        accentColor: "#3b82f6",
        loginScreenBackgroundColor: "#f8fafc",
        loginScreenAccentColor: "#3d1a5a",
        loginScreenTextColor: "#1f2937",
        loginScreenHeroColor: "#3d1a5a",
      };

      return defaultConfig;
    } catch (error) {
      console.error('Error fetching branding configuration:', error);
      throw error;
    }
  }

  async saveBrandingConfig(config: { [key: string]: unknown }): Promise<{ [key: string]: unknown }> {
    try {
      // CRITICAL FIX: Prevent admin from saving branding config to database
      // Admin environments should use environment-only branding
      const isAdminMode = process.env.ADMIN_MODE === 'true';
      if (isAdminMode) {
        throw new Error('Admin environments cannot save branding configuration to database. Use environment variables instead.');
      }

      // Use tenant-specific or default pool for database queries
      const tableName = 'branding_configurations';

      // Create the table if it doesn't exist
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS ${tableName} (
          id SERIAL PRIMARY KEY,
          config_data JSONB NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);

      // Use UPSERT (INSERT ... ON CONFLICT) to save configuration
      const result = await this.pool.query(`
        INSERT INTO ${tableName} (id, config_data, updated_at)
        VALUES (1, $1, NOW())
        ON CONFLICT (id) 
        DO UPDATE SET 
          config_data = EXCLUDED.config_data,
          updated_at = NOW()
        RETURNING config_data
      `, [JSON.stringify(config)]);

      return result.rows[0].config_data;
    } catch (error) {
      console.error("Error saving branding config:", error);
      throw error;
    }
  }

  async updateNotification(id: number, updates: Partial<Notification>): Promise<Notification> {
    const [result] = await this.db
      .update(notifications)
      .set(updates)
      .where(eq(notifications.id, id))
      .returning();
    return result;
  }

  async deleteNotification(id: number): Promise<void> {
    await this.db
      .delete(notifications)
      .where(eq(notifications.id, id));
  }

  async getInstitutionConfig(tenantId: string): Promise<InstitutionConfiguration | null> {
    try {
      const result = await this.pool.query(
        `SELECT * FROM institution_configurations WHERE tenant_id = $1 LIMIT 1`,
        [tenantId]
      );
      if (result.rows.length === 0) return null;
      const row = result.rows[0];
      return {
        id: row.id,
        tenantId: row.tenant_id,
        primaryType: row.primary_type,
        characteristics: row.characteristics || [],
        hideNonApplicable: row.hide_non_applicable,
        allowUsersToToggle: row.allow_users_to_toggle,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    } catch (error) {
      console.error("Error fetching institution config:", error);
      return null;
    }
  }

  async upsertInstitutionConfig(config: Omit<InsertInstitutionConfiguration, 'id' | 'createdAt' | 'updatedAt'>): Promise<InstitutionConfiguration> {
    const result = await this.pool.query(`
      INSERT INTO institution_configurations (tenant_id, primary_type, characteristics, hide_non_applicable, allow_users_to_toggle, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (tenant_id) DO UPDATE SET
        primary_type = EXCLUDED.primary_type,
        characteristics = EXCLUDED.characteristics,
        hide_non_applicable = EXCLUDED.hide_non_applicable,
        allow_users_to_toggle = EXCLUDED.allow_users_to_toggle,
        updated_at = NOW()
      RETURNING *
    `, [
      config.tenantId,
      config.primaryType || null,
      JSON.stringify(config.characteristics || []),
      config.hideNonApplicable ?? true,
      config.allowUsersToToggle ?? true,
    ]);
    const row = result.rows[0];
    return {
      id: row.id,
      tenantId: row.tenant_id,
      primaryType: row.primary_type,
      characteristics: row.characteristics || [],
      hideNonApplicable: row.hide_non_applicable,
      allowUsersToToggle: row.allow_users_to_toggle,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getRegulationsForInstitutionTypes(types: string[]): Promise<Regulation[]> {
    if (types.length === 0) return this.getRegulations();
    const placeholders = types.map((_, i) => `$${i + 1}`).join(', ');
    const query = `
      SELECT * FROM regulations
      WHERE applicable_institutions @> '"all-institutions"'::jsonb
      OR ${types.map((_, i) => `applicable_institutions @> $${i + 1}::jsonb`).join(' OR ')}
      ORDER BY last_updated DESC
    `;
    const result = await this.pool.query(query, types.map(t => JSON.stringify([t])));
    return result.rows as Regulation[];
  }

}

export const storage = new DatabaseStorage();