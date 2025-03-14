import { users, regulations, notifications, deadlines, guides, csvSchemas, validationRules, fieldMappings, notes, evidenceFiles, type EvidenceFile, type InsertEvidenceFile } from "@shared/schema";
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
} from "@shared/schema";
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
  getRegulationsByJurisdiction(jurisdiction: string): Promise<Regulation[]>;
  searchRegulations(searchTerm: string): Promise<Regulation[]>;
  deleteRegulation(id: number): Promise<void>;

  // Notification methods
  getNotificationsByUser(userId: number): Promise<Notification[]>;
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

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
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
      return result;
    } catch (error) {
      console.error("Error in getRegulations:", error);
      // Return empty array instead of throwing to prevent frontend from getting stuck
      return [];
    }
  }

  async getRegulation(id: number): Promise<Regulation | undefined> {
    const [regulation] = await db.select().from(regulations).where(eq(regulations.id, id));
    return regulation;
  }

  async getRegulationById(regulationId: string): Promise<Regulation | null> {
    try {
      console.log(`Looking up regulation with ID: ${regulationId}`);
      // First try to find by itemId (which is what the UI uses)
      const results = await db.select()
        .from(regulations)
        .where(eq(regulations.itemId, regulationId));

      if (results.length > 0) {
        return results[0];
      }

      // Fallback to regular ID if itemId search fails
      const fallbackResults = await db.select()
        .from(regulations)
        .where(eq(regulations.id, parseInt(regulationId, 10)));

      return fallbackResults.length > 0 ? fallbackResults[0] : null;
    } catch (error) {
      console.error(`Error fetching regulation with ID ${regulationId}:`, error);
      throw error;
    }
  }

  async createRegulation(regulation: InsertRegulation): Promise<Regulation> {
    console.log("Creating new regulation:", regulation);
    const [newRegulation] = await db.insert(regulations).values(regulation).returning();
    console.log("Created regulation:", newRegulation);
    return newRegulation;
  }

  async updateRegulation(id: number, regulation: Partial<InsertRegulation>): Promise<Regulation> {
    console.log(`Updating regulation ${id} with:`, regulation);
    const [updatedRegulation] = await db
      .update(regulations)
      .set({
        ...regulation,
        lastUpdated: new Date()
      })
      .where(eq(regulations.id, id))
      .returning();
    console.log("Updated regulation:", updatedRegulation);
    return updatedRegulation;
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
    return updatedRegulation;
  }

  async getRegulationsByJurisdiction(jurisdiction: string): Promise<Regulation[]> {
    console.log(`Fetching regulations with jurisdiction: ${jurisdiction}`);
    const result = await db
      .select()
      .from(regulations)
      .where(eq(regulations.jurisdiction, jurisdiction));
    console.log(`Found ${result.length} ${jurisdiction} regulations`);
    return result;
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
      return results;
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
  async getRegulationsByJurisdiction(jurisdiction: string): Promise<Regulation[]> {
    console.log(`Fetching regulations with jurisdiction: ${jurisdiction}`);
    const result = await db
      .select()
      .from(regulations)
      .where(eq(regulations.jurisdiction, jurisdiction));
    console.log(`Found ${result.length} ${jurisdiction} regulations`);
    return result;
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
      const files = await db
        .select()
        .from(evidenceFiles)
        .where(eq(evidenceFiles.regulationId, regulationId))
        .orderBy(desc(evidenceFiles.uploadedAt));

      console.log(`Found ${files.length} evidence files`);
      return files;
    } catch (error) {
      console.error("Error fetching evidence files:", error);
      throw error; // Let the route handler deal with the error
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
}

export const storage = new DatabaseStorage();