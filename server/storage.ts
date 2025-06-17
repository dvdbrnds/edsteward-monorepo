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
  evidenceFiles, 
  regulationVersions,
  validationStatus,
  syncControl,
  notificationQueue,
  versionConflicts,
  type EvidenceFile, 
  type InsertEvidenceFile 
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
  MCPValidationResult,
  MCPVersionConflict
} from "@shared/schema";

// Import RegulationUpdate type from schema
import { regulationUpdates, type RegulationUpdate, type InsertRegulationUpdate } from "@shared/schema";
import { db } from "./db";
import { eq, desc, or, like } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByExternalId(externalId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUser(id: number, user: Partial<InsertUser>): Promise<User>;
  deleteUser(id: number): Promise<void>;

  // Regulation methods
  getRegulations(): Promise<Regulation[]>;
  getRegulation(id: number): Promise<Regulation | undefined>;
  getRegulationById(regulationId: string): Promise<Regulation | null>;
  createRegulation(regulation: InsertRegulation): Promise<Regulation>;
  updateRegulation(id: number, regulation: Partial<InsertRegulation>): Promise<Regulation>;
  setRegulationApplicability(id: number, isApplicable: boolean): Promise<Regulation>;
  getRegulationsByJurisdiction(jurisdiction: string): Promise<Regulation[]>; // Legacy method
  getRegulationsByJurisdictionSource(jurisdictionSource: string): Promise<Regulation[]>;
  getRegulationsByInstitutionType(institutionType: string): Promise<Regulation[]>;
  searchRegulations(searchTerm: string): Promise<Regulation[]>;
  deleteRegulation(id: number): Promise<void>;
  
  // Regulation Update methods
  getPendingRegulationUpdates(): Promise<RegulationUpdate[]>;
  getRegulationUpdateById(id: number): Promise<RegulationUpdate | null>;
  acceptRegulationUpdate(id: number, userId: number, signature: string): Promise<void>;
  rejectRegulationUpdate(id: number, userId: number, signature: string, reason: string): Promise<void>;
  deferRegulationUpdate(id: number, userId: number, signature: string): Promise<void>;
  
  // MCP Regulation Version methods
  getRegulationVersions(regulationId: number): Promise<RegulationVersion[]>;
  getRegulationVersion(id: number): Promise<RegulationVersion | null>;
  createRegulationVersion(version: InsertRegulationVersion): Promise<RegulationVersion>;
  getLatestRegulationVersion(regulationId: number): Promise<RegulationVersion | null>;
  compareRegulationVersions(versionIdA: number, versionIdB: number): Promise<{
    changes: Array<{
      field: string;
      valueA: string;
      valueB: string;
      changeType: 'added' | 'removed' | 'modified';
    }>;
  }>;
  
  // MCP Validation Status methods
  getValidationStatus(regulationId: number, versionId?: number): Promise<ValidationStatus[]>;
  createValidationStatus(status: InsertValidationStatus): Promise<ValidationStatus>;
  updateValidationStatus(id: number, status: Partial<InsertValidationStatus>): Promise<ValidationStatus>;
  validateRegulationVersion(versionId: number, userId: number): Promise<ValidationStatus[]>;
  
  // MCP Sync Control methods
  getSyncControl(regulationId: number): Promise<SyncControl | null>;
  createSyncControl(control: InsertSyncControl): Promise<SyncControl>;
  updateSyncControl(id: number, control: Partial<InsertSyncControl>): Promise<SyncControl>;
  scheduleSyncForRegulation(regulationId: number, nextSync: Date): Promise<SyncControl>;
  recordSyncAttempt(regulationId: number, success: boolean, error?: string): Promise<SyncControl>;
  
  // MCP Notification Queue methods
  getNotificationQueue(status?: 'pending' | 'sent' | 'failed'): Promise<NotificationQueue[]>;
  createNotificationQueueItem(item: InsertNotificationQueue): Promise<NotificationQueue>;
  updateNotificationQueueItem(id: number, item: Partial<InsertNotificationQueue>): Promise<NotificationQueue>;
  markNotificationAsSent(id: number): Promise<NotificationQueue>;
  
  // MCP Version Conflict methods
  getVersionConflicts(status?: 'pending' | 'resolved' | 'rejected'): Promise<VersionConflict[]>;
  getVersionConflictsForRegulation(regulationId: number): Promise<VersionConflict[]>;
  createVersionConflict(conflict: InsertVersionConflict): Promise<VersionConflict>;
  resolveVersionConflict(id: number, resolutions: MCPVersionConflict[], userId: number): Promise<VersionConflict>;
  rejectVersionConflict(id: number, userId: number): Promise<VersionConflict>;

  // Notification methods
  getNotificationsByUser(userId: number): Promise<Notification[]>;
  getAllNotifications(): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  sendEmailNotification(userId: number, subject: string, message: string): Promise<boolean>;

  // Deadline methods
  getDeadlines(): Promise<Deadline[]>;
  getAllIncompleteDeadlines(): Promise<Deadline[]>;
  createDeadline(deadline: InsertDeadline): Promise<Deadline>;

  // Guide methods
  getGuides(): Promise<Guide[]>;
  getGuidesByCategory(category: string): Promise<Guide[]>;
  getGuide(id: number): Promise<Guide | undefined>;
  createGuide(guide: InsertGuide): Promise<Guide>;
  updateGuide(id: number, guide: Partial<InsertGuide>): Promise<Guide>;

  // ETL methods
  getCsvSchemas(): Promise<CsvSchema[]>;
  getCsvSchema(id: number): Promise<CsvSchema | undefined>;
  createCsvSchema(schema: InsertCsvSchema): Promise<CsvSchema>;
  getValidationRules(schemaId: number): Promise<ValidationRule[]>;
  createValidationRule(rule: InsertValidationRule): Promise<ValidationRule>;
  createFieldMapping(mapping: InsertFieldMapping): Promise<FieldMapping>;

  // Session store
  sessionStore: session.Store;
  hasAdmin(): Promise<boolean>;

  // Note methods
  getNotesByRegulation(regulationId: number): Promise<Note[]>;
  getNotesByUser(userId: number): Promise<Note[]>;
  getNote(id: number): Promise<Note | null>;
  createNote(note: InsertNote): Promise<Note>;
  updateNote(id: number, note: Partial<InsertNote>): Promise<Note>;
  deleteNote(id: number): Promise<void>;

  // Evidence file methods
  createEvidenceFile(file: InsertEvidenceFile): Promise<EvidenceFile>;
  getEvidenceFilesByRegulation(regulationId: number): Promise<EvidenceFile[]>;
  getEvidenceFile(id: number): Promise<EvidenceFile | undefined>;
  updateEvidenceFileStatus(id: number, status: string): Promise<EvidenceFile>;
}

import { emailService } from './services/email';

export class DatabaseStorage implements IStorage {
  // Regulation Update methods
  async getPendingRegulationUpdates(): Promise<RegulationUpdate[]> {
    try {
      return await db.select().from(regulationUpdates).where(eq(regulationUpdates.status, "pending"));
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
          originalContent: update.original_content,
          updatedContent: update.updated_content,
          status: update.status,
          updateDate: update.created_at ? new Date(update.created_at) : new Date(),
          signature: update.signature_data,
          userId: update.reviewer_id,
          rejectionReason: update.rejection_reason,
          processedAt: update.reviewed_at ? new Date(update.reviewed_at) : null,
          name: update.summary || `Update #${update.id}`
        } as RegulationUpdate;
      }
      return null;
    } catch (error) {
      console.error(`Error fetching regulation update with ID ${id}:`, error);
      return null;
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
      // Use parameterized query
      await pool.query(
        `UPDATE regulations 
         SET requirements = $1, last_updated = $2 
         WHERE id = $3`,
        [update.updatedContent, new Date(), update.regulationId]
      );

      // 3. Mark the update as accepted
      await db.update(regulationUpdates)
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
      await db.update(regulationUpdates)
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
      await db.update(regulationUpdates)
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
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user;
    } catch (error) {
      console.error("Error in getUser:", error);
      return undefined;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      console.log(`Looking up user with username: ${username}`);
      const [user] = await db.select().from(users).where(eq(users.username, username));
      console.log(`User lookup result:`, user ? `Found user with ID ${user.id}` : 'User not found');
      return user;
    } catch (error) {
      console.error(`Error in getUserByUsername for ${username}:`, error);
      throw error;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      console.log(`Looking up user with email: ${email}`);
      const [user] = await db.select().from(users).where(eq(users.email, email));
      console.log(`User lookup result:`, user ? `Found user with ID ${user.id}` : 'User not found');
      return user;
    } catch (error) {
      console.error(`Error in getUserByEmail for ${email}:`, error);
      throw error;
    }
  }

  async getUserByExternalId(externalId: string): Promise<User | undefined> {
    try {
      console.log(`Looking up user with external ID: ${externalId}`);
      const [user] = await db.select().from(users).where(eq(users.externalId, externalId));
      console.log(`User lookup result:`, user ? `Found user with ID ${user.id}` : 'User not found');
      return user;
    } catch (error) {
      console.error(`Error in getUserByExternalId for ${externalId}:`, error);
      throw error;
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    // Handle optional password for SAML users
    const userToCreate = {
      ...insertUser,
      password: insertUser.password || null // Allow null password for SAML users
    };
    
    const [user] = await db.insert(users).values(userToCreate).returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async updateUser(id: number, userData: Partial<InsertUser>): Promise<User> {
    const [user] = await db
      .update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async deleteUser(id: number): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async getRegulations(): Promise<Regulation[]> {
    try {
      console.log("Fetching regulations from database...");
      // Add more detailed logging
      const result = await db
        .select()
        .from(regulations)
        .orderBy(desc(regulations.lastUpdated));

      console.log(`Successfully fetched ${result.length} regulations from database`);
      return result as Regulation[];
    } catch (error) {
      console.error("Error in getRegulations:", error);
      // Return empty array instead of throwing to prevent frontend from getting stuck
      return [];
    }
  }

  async getRegulation(id: number): Promise<Regulation | undefined> {
    const [regulation] = await db.select().from(regulations).where(eq(regulations.id, id));
    return regulation as Regulation | undefined;
  }

  async getRegulationById(regulationId: string): Promise<Regulation | null> {
    try {
      console.log(`Looking up regulation with ID: ${regulationId}`);
      // First try to find by itemId (which is what the UI uses)
      const results = await db.select()
        .from(regulations)
        .where(eq(regulations.itemId, regulationId));

      if (results.length > 0) {
        return results[0] as Regulation;
      }

      // Fallback to regular ID if itemId search fails
      const fallbackResults = await db.select()
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
    const [newRegulation] = await db.insert(regulations).values(regulation).returning();
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
        const { requirements, ...otherFields } = regulation;
        
        // If there are other fields to update, do that separately
        if (Object.keys(otherFields).length > 0) {
          await db.update(regulations)
            .set({
              ...otherFields,
              lastUpdated: new Date()
            })
            .where(eq(regulations.id, id));
        }
        
        // Fetch and return the updated regulation
        const results = await db.select().from(regulations).where(eq(regulations.id, id));
        if (results.length > 0) {
          return results[0] as Regulation;
        } else {
          throw new Error(`Regulation with ID ${id} not found after update`);
        }
      } else {
        // No requirements field, regular update
        const [updatedRegulation] = await db
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
    const [updatedRegulation] = await db
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
    const result = await db
      .select()
      .from(regulations)
      .where(eq(regulations.jurisdictionSource, jurisdiction));
    console.log(`Found ${result.length} ${jurisdiction} regulations`);
    return result as Regulation[];
  }

  async getRegulationsByJurisdictionSource(jurisdictionSource: string): Promise<Regulation[]> {
    console.log(`Fetching regulations with jurisdiction source: ${jurisdictionSource}`);
    const result = await db
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
      const results = await db.select()
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
    await db.delete(regulations).where(eq(regulations.id, id));
  }

  async getNotificationsByUser(userId: number): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId));
  }

  async getAllNotifications(): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .orderBy(notifications.id);
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [newNotification] = await db
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
    return await db.select().from(deadlines);
  }

  async getAllIncompleteDeadlines(): Promise<Deadline[]> {
    return await db
      .select()
      .from(deadlines)
      .where(eq(deadlines.status, "pending"));
  }

  async createDeadline(deadline: InsertDeadline): Promise<Deadline> {
    const [newDeadline] = await db.insert(deadlines).values(deadline).returning();
    return newDeadline;
  }

  async getGuides(): Promise<Guide[]> {
    return await db.select().from(guides);
  }

  async getGuidesByCategory(category: string): Promise<Guide[]> {
    return await db
      .select()
      .from(guides)
      .where(eq(guides.category, category));
  }

  async getGuide(id: number): Promise<Guide | undefined> {
    const [guide] = await db.select().from(guides).where(eq(guides.id, id));
    return guide;
  }

  async createGuide(guide: InsertGuide): Promise<Guide> {
    const [newGuide] = await db.insert(guides).values(guide).returning();
    return newGuide;
  }

  async updateGuide(id: number, guide: Partial<InsertGuide>): Promise<Guide> {
    const [updatedGuide] = await db
      .update(guides)
      .set(guide)
      .where(eq(guides.id, id))
      .returning();
    return updatedGuide;
  }

  async hasAdmin(): Promise<boolean> {
    const [adminUser] = await db
      .select()
      .from(users)
      .where(eq(users.role, "admin"))
      .limit(1);
    return !!adminUser;
  }

  async getCsvSchemas(): Promise<CsvSchema[]> {
    return await db.select().from(csvSchemas);
  }

  async getCsvSchema(id: number): Promise<CsvSchema | undefined> {
    const [schema] = await db
      .select()
      .from(csvSchemas)
      .where(eq(csvSchemas.id, id));
    return schema;
  }

  async createCsvSchema(schema: InsertCsvSchema): Promise<CsvSchema> {
    const [newSchema] = await db
      .insert(csvSchemas)
      .values(schema)
      .returning();
    return newSchema;
  }

  async getValidationRules(schemaId: number): Promise<ValidationRule[]> {
    return await db
      .select()
      .from(validationRules)
      .where(eq(validationRules.schemaId, schemaId));
  }

  async createValidationRule(rule: InsertValidationRule): Promise<ValidationRule> {
    const [newRule] = await db
      .insert(validationRules)
      .values(rule)
      .returning();
    return newRule;
  }

  async createFieldMapping(mapping: InsertFieldMapping): Promise<FieldMapping> {
    const [newMapping] = await db
      .insert(fieldMappings)
      .values(mapping)
      .returning();
    return newMapping;
  }

  async getNotesByRegulation(regulationId: number): Promise<Note[]> {
    return await db
      .select()
      .from(notes)
      .where(eq(notes.regulationId, regulationId))
      .orderBy(desc(notes.updatedAt));
  }

  async getNotesByUser(userId: number): Promise<Note[]> {
    return await db
      .select()
      .from(notes)
      .where(eq(notes.userId, userId))
      .orderBy(desc(notes.updatedAt));
  }

  async getNote(id: number): Promise<Note | null> {
    const result = await db
      .select()
      .from(notes)
      .where(eq(notes.id, id))
      .then((res) => res[0]);
    return result || null;
  }

  async createNote(note: InsertNote): Promise<Note> {
    const [newNote] = await db
      .insert(notes)
      .values(note)
      .returning();
    return newNote;
  }

  async updateNote(id: number, noteData: Partial<InsertNote>): Promise<Note> {
    const [updatedNote] = await db
      .update(notes)
      .set({
        ...noteData,
        updatedAt: new Date()
      })
      .where(eq(notes.id, id))
      .returning();
    return updatedNote;
  }

  async deleteNote(id: number): Promise<void> {
    await db.delete(notes).where(eq(notes.id, id));
  }

  async createEvidenceFile(file: InsertEvidenceFile): Promise<EvidenceFile> {
    try {
      console.log("Creating new evidence file:", file);
      const [evidenceFile] = await db
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
      const files = await db
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
      const [file] = await db
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
      const [file] = await db
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
      const versions = await db
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
      const [version] = await db
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
      const [newVersion] = await db
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
  
  async getLatestRegulationVersion(regulationId: number): Promise<RegulationVersion | null> {
    try {
      const [latestVersion] = await db
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
      const [newStatus] = await db
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
      const [updatedStatus] = await db
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
      const [control] = await db
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
      const [newControl] = await db
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
      const [updatedControl] = await db
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
      let query = db.select().from(notificationQueue);
      
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
      const [newItem] = await db
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
      const [updatedItem] = await db
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
      const [updatedItem] = await db
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
      let query = db.select().from(versionConflicts);
      
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
      return await db
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
      const [newConflict] = await db
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
      
      const [updatedConflict] = await db
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
    try {
      const [updatedConflict] = await db
        .update(versionConflicts)
        .set({
          status: 'rejected',
          resolvedAt: new Date(),
          resolvedBy: userId
        })
        .where(eq(versionConflicts.id, id))
        .returning();
      
      return updatedConflict;
    } catch (error) {
      console.error(`Error rejecting version conflict ${id}:`, error);
      throw error;
    }
  }
}

export const storage = new DatabaseStorage();