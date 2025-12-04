import {
  users,
  regulations,
  notifications,
  deadlines,
  guides,
  csvSchemas,
  validationRules,
  fieldMappings,
  notes,
  noteHistory,
  evidenceFiles,
  regulationVersions,
  validationStatus,
  syncControl,
  notificationQueue,
  versionConflicts,
  type EvidenceFile,
  type InsertEvidenceFile,
  type NoteHistory,
  type InsertNoteHistory
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
  CsvSchema,
  InsertCsvSchema,
  ValidationRule,
  InsertValidationRule,
  FieldMapping,
  InsertFieldMapping,
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
import { getDatabase } from "./services/database";
import { eq, desc, or, like, sql } from "drizzle-orm";
import { getDatabaseStorage } from "./services/database";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";
import { Pool } from "pg";
import { config } from "./config/environment";

const PostgresSessionStore = connectPg(session);

// Create a separate pool for session store to avoid conflicts
const sessionPool = new Pool({
  connectionString: config.DATABASE_URL,
  ssl: config.DATABASE_URL.includes('neondb') ? { rejectUnauthorized: false } : false,
  max: 5, // Smaller pool for sessions
  idleTimeoutMillis: 0, // Never timeout idle connections
  connectionTimeoutMillis: 10000,
  // Prevent the pool from being closed accidentally
  allowExitOnIdle: false,
});

 
export interface IStorage {
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

  // ETL methods
  getCsvSchemas(): Promise<CsvSchema[]>;
  getCsvSchema(_id: number): Promise<CsvSchema | undefined>;
  createCsvSchema(_schema: InsertCsvSchema): Promise<CsvSchema>;
  getValidationRules(_schemaId: number): Promise<ValidationRule[]>;
  createValidationRule(_rule: InsertValidationRule): Promise<ValidationRule>;
  createFieldMapping(_mapping: InsertFieldMapping): Promise<FieldMapping>;

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
  private get db() {
    return getDatabase();
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
      const result = await pool.query(
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
          metadata: update.metadata
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
      const [newUpdate] = await this.db.insert(regulationUpdates).values(data).returning();
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
      // Handle regulation_text, requirements, summary, and deadlines
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;

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

      // Update filing_deadlines field if provided
      if (update.filingDeadlines) {
        updateFields.push(`filing_deadlines = $${paramIndex++}`);
        updateValues.push(update.filingDeadlines);
      }

      // Always update last_updated timestamp
      updateFields.push(`last_updated = $${paramIndex++}`);
      updateValues.push(new Date());

      // Add the regulation ID for WHERE clause
      updateValues.push(update.regulationId);

      await pool.query(
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
      
      console.log(`Creating version ${nextVersionNumber} for regulation ${update.regulationId}`);
      
      const changeSummary = `Updated via regulation update #${id}`;
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
      await pool.query(
        `DELETE FROM regulation_updates WHERE id IN (${placeholders})`,
        ids
      );
    } catch (error) {
      console.error(`Error bulk deleting regulation updates:`, error);
      throw error;
    }
  }

  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool: sessionPool,
      createTableIfMissing: true,
    });
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
      console.log(`Looking up user with username: ${username}`);
      const [user] = await this.db.select().from(users).where(eq(users.username, username));
      console.log(`User lookup result:`, user ? `Found user with ID ${user.id}` : 'User not found');
      return user;
    } catch (error) {
      console.error(`Error in getUserByUsername for ${username}:`, error);
      throw error;
    }
  }

  async getUserByEmail(email: string, _tenantId?: string): Promise<User | undefined> {
    try {
      console.log(`Looking up user with email: ${email}`);
      const [user] = await this.db.select().from(users).where(eq(users.email, email));
      console.log(`User lookup result:`, user ? `Found user with ID ${user.id}` : 'User not found');
      return user;
    } catch (error) {
      console.error(`Error in getUserByEmail for ${email}:`, error);
      throw error;
    }
  }

  async getUserByExternalId(externalId: string, _tenantId?: string): Promise<User | undefined> {
    try {
      console.log(`Looking up user with external ID: ${externalId}`);
      const [user] = await this.db.select().from(users).where(eq(users.externalId, externalId));
      console.log(`User lookup result:`, user ? `Found user with ID ${user.id}` : 'User not found');
      return user;
    } catch (error) {
      console.error(`Error in getUserByExternalId for ${externalId}:`, error);
      throw error;
    }
  }

  async createUser(insertUser: InsertUser, _tenantId?: string): Promise<User> {
    // Use tenant-specific storage if tenantId provided
    if (_tenantId) {
      const tenantStorage = getDatabaseStorage();
      return await tenantStorage.createUser(insertUser);
    }

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
      console.log("🔍 [DEBUG] Fetching regulations from database...");
      console.log("🔍 [DEBUG] Database connection status:", this.db ? "Connected" : "Not connected");
      
      // Temporary fix: Use raw SQL to bypass Drizzle column mapping issues
      const result = await this.db.execute(sql`
        SELECT * FROM regulations 
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

      console.log(`✅ [DEBUG] Successfully fetched ${formattedResult.length} regulations from database`);
      
      if (formattedResult.length > 0) {
        console.log("📝 [DEBUG] Sample regulation:", {
          id: formattedResult[0].id,
          name: formattedResult[0].name,
          category: formattedResult[0].category
        });
      } else {
        console.log("⚠️ [DEBUG] No regulations found in query result");
      }
      
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
        } catch (e) {
          regulation.actions = [];
        }
      }
      
      if (typeof regulation.sections === 'string') {
        try {
          regulation.sections = JSON.parse(regulation.sections);
        } catch (e) {
          regulation.sections = [];
        }
      }
    }
    
    return regulation as Regulation | undefined;
  }

  async getRegulationById(regulationId: string): Promise<Regulation | null> {
    try {
      console.log(`Looking up regulation with ID: ${regulationId}`);
      // First try to find by itemId (which is what the UI uses)
      const results = await this.db.select()
        .from(regulations)
        .where(eq(regulations.itemId, regulationId));

      if (results.length > 0) {
        return results[0] as Regulation;
      }

      // Fallback to regular ID if itemId search fails
      const fallbackResults = await this.db.select()
        .from(regulations)
        .where(eq(regulations.id, parseInt(regulationId, 10)));

      return fallbackResults.length > 0 ? (fallbackResults[0] as Regulation) : null;
    } catch (error) {
      console.error(`Error fetching regulation with ID ${regulationId}:`, error);
      throw error;
    }
  }

  async createRegulation(regulation: InsertRegulation): Promise<Regulation> {
    console.log("Creating new regulation:", regulation);
    const [newRegulation] = await this.db.insert(regulations).values(regulation).returning();
    console.log("Created regulation:", newRegulation);
    return newRegulation as Regulation;
  }

  async updateRegulation(id: number, regulation: Partial<InsertRegulation>): Promise<Regulation> {
    console.log(`Updating regulation ${id} with:`, regulation);

    try {
      // If we're updating content/requirements, handle it differently due to potential size
      if (regulation.requirements) {
        // First, update the text field directly using parameterized query
        await pool.query(
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

        console.log("Updated regulation:", updatedRegulation);
        return updatedRegulation as Regulation;
      }
    } catch (error) {
      console.error(`Error updating regulation ${id}:`, error);
      throw error;
    }
  }

  async setRegulationApplicability(id: number, isApplicable: boolean): Promise<Regulation> {
    console.log(`Setting regulation ${id} applicability to: ${isApplicable}`);
    const [updatedRegulation] = await this.db
      .update(regulations)
      .set({
        isApplicable,
        lastUpdated: new Date()
      })
      .where(eq(regulations.id, id))
      .returning();
    console.log("Updated regulation:", updatedRegulation);
    return updatedRegulation as Regulation;
  }

  async getRegulationsByJurisdiction(jurisdiction: string): Promise<Regulation[]> {
    console.log(`Fetching regulations with jurisdiction: ${jurisdiction}`);
    const result = await this.db
      .select()
      .from(regulations)
      .where(eq(regulations.jurisdictionSource, jurisdiction));
    console.log(`Found ${result.length} ${jurisdiction} regulations`);
    return result as Regulation[];
  }

  async getRegulationsByJurisdictionSource(jurisdictionSource: string): Promise<Regulation[]> {
    console.log(`Fetching regulations with jurisdiction source: ${jurisdictionSource}`);
    const result = await this.db
      .select()
      .from(regulations)
      .where(eq(regulations.jurisdictionSource, jurisdictionSource));
    console.log(`Found ${result.length} ${jurisdictionSource} regulations`);
    return result as Regulation[];
  }

  async getRegulationsByInstitutionType(institutionType: string): Promise<Regulation[]> {
    console.log(`Fetching regulations applicable to institution type: ${institutionType}`);

    // Use raw SQL to query JSONB field
    const query = `
      SELECT * FROM regulations 
      WHERE applicable_institutions @> $1 
      OR applicable_institutions @> $2
      ORDER BY last_updated DESC
    `;

    const result = await pool.query(query, [
      JSON.stringify([institutionType]),
      JSON.stringify(['all-institutions'])
    ]);

    console.log(`Found ${result.rows.length} regulations for ${institutionType}`);
    return result.rows as Regulation[];
  }

  async searchRegulations(searchTerm: string): Promise<Regulation[]> {
    try {
      console.log(`Searching for regulations with term: ${searchTerm}`);
      const results = await this.db.select()
        .from(regulations)
        .where(
          or(
            eq(regulations.itemId, searchTerm),
            like(regulations.name, `%${searchTerm}%`),
            like(regulations.topic, `%${searchTerm}%`)
          )
        );
      console.log(`Found ${results.length} matching regulations`);
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

  async getCsvSchemas(): Promise<CsvSchema[]> {
    return await this.db.select().from(csvSchemas);
  }

  async getCsvSchema(id: number): Promise<CsvSchema | undefined> {
    const [schema] = await this.db
      .select()
      .from(csvSchemas)
      .where(eq(csvSchemas.id, id));
    return schema;
  }

  async createCsvSchema(schema: InsertCsvSchema): Promise<CsvSchema> {
    const [newSchema] = await this.db
      .insert(csvSchemas)
      .values(schema)
      .returning();
    return newSchema;
  }

  async getValidationRules(schemaId: number): Promise<ValidationRule[]> {
    return await this.db
      .select()
      .from(validationRules)
      .where(eq(validationRules.schemaId, schemaId));
  }

  async createValidationRule(rule: InsertValidationRule): Promise<ValidationRule> {
    const [newRule] = await this.db
      .insert(validationRules)
      .values(rule)
      .returning();
    return newRule;
  }

  async createFieldMapping(mapping: InsertFieldMapping): Promise<FieldMapping> {
    const [newMapping] = await this.db
      .insert(fieldMappings)
      .values(mapping)
      .returning();
    return newMapping;
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
      console.log("Creating new evidence file:", file);
      const [evidenceFile] = await this.db
        .insert(evidenceFiles)
        .values(file)
        .returning();

      console.log("Created evidence file:", evidenceFile);
      return evidenceFile;
    } catch (error) {
      console.error("Error creating evidence file:", error);
      throw error;
    }
  }

  async getEvidenceFilesByRegulation(regulationId: number): Promise<EvidenceFile[]> {
    try {
      console.log(`Fetching evidence files for regulation ${regulationId}`);
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

      console.log(`Found ${result.length} evidence files`);
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

      console.log(`Created new regulation version ${newVersion.id} for regulation ${version.regulationId}`);
      return newVersion;
    } catch (error) {
      console.error("Error creating regulation version:", error);
      throw error;
    }
  }

  // Enhanced Version Control Methods for API
  async getPendingUpdatesForRegulation(regulationId: number): Promise<any[]> {
    try {
      const result = await sessionPool.query(`
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
      await sessionPool.query(`
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
      // Fallback to console logging if audit service fails
      console.log('📋 AUDIT LOG (fallback):', {
        timestamp: new Date().toISOString(),
        ...entry,
        error: error instanceof Error ? error.message : String(error)
      });
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
      let query = db
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
        console.log(`🎨 Admin mode detected - forcing admin branding`);
        const adminConfig = {
          institutionName: "EdSteward Admin Console",
          title: "EdSteward Admin Console",
          logoUrl: "/assets/generic-logo.svg",
          faviconUrl: "/favicon.ico",
          primaryColor: "#dc2626", // Red for admin
          secondaryColor: "#b91c1c",
          accentColor: "#ef4444",
          loginScreenBackgroundColor: "#fef2f2",
          loginScreenAccentColor: "#dc2626",
          loginScreenTextColor: "#1f2937",
          loginScreenHeroColor: "#991b1b",
        };
        return adminConfig;
      }

      // Priority 2: Environment-specific database configuration (check database first in development)
      // Use environment-specific table names to ensure isolation
      const environmentPrefix = process.env.ENVIRONMENT_PREFIX || 'default';
      const tableName = environmentPrefix === 'default' ? 'branding_configurations' : `branding_configurations_${environmentPrefix}`;

      // Create table if it doesn't exist
      await sessionPool.query(`
        CREATE TABLE IF NOT EXISTS ${tableName} (
          id SERIAL PRIMARY KEY,
          config_data JSONB NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);

      const result = await sessionPool.query(`
        SELECT config_data 
        FROM ${tableName} 
        WHERE id = 1
      `);

      if (result.rows.length > 0) {
        console.log(`🎨 Using database branding config from ${tableName}: ${result.rows[0].config_data.institutionName}`);
        return result.rows[0].config_data;
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

        console.log(`🎨 Using environment-based branding config (fallback): ${config.institutionName}`);
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

      console.log(`🎨 Using default branding config: ${defaultConfig.institutionName}`);
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
        console.log(`🎨 Admin mode detected - preventing database branding save to maintain isolation`);
        throw new Error('Admin environments cannot save branding configuration to database. Use environment variables instead.');
      }

      // Use environment-specific table names to ensure isolation
      const environmentPrefix = process.env.ENVIRONMENT_PREFIX || 'default';
      const tableName = environmentPrefix === 'default' ? 'branding_configurations' : `branding_configurations_${environmentPrefix}`;

      // Create the table if it doesn't exist
      await sessionPool.query(`
        CREATE TABLE IF NOT EXISTS ${tableName} (
          id SERIAL PRIMARY KEY,
          config_data JSONB NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);

      // Use UPSERT (INSERT ... ON CONFLICT) to save configuration
      const result = await sessionPool.query(`
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

  // Notification methods
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
    const [result] = await this.db
      .insert(notifications)
      .values(notification)
      .returning();
    return result;
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

}

export const storage = new DatabaseStorage();