import { users, regulations, notifications, deadlines, comments, guides, csvSchemas, validationRules, fieldMappings } from "@shared/schema";
import type {
  User,
  InsertUser,
  Regulation,
  InsertRegulation,
  Notification,
  InsertNotification,
  Deadline,
  InsertDeadline,
  Comment,
  InsertComment,
  Guide,
  InsertGuide,
  CsvSchema,
  InsertCsvSchema,
  ValidationRule,
  InsertValidationRule,
  FieldMapping,
  InsertFieldMapping,
} from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Regulation methods
  getRegulations(): Promise<Regulation[]>;
  getRegulation(id: number): Promise<Regulation | undefined>;  
  createRegulation(regulation: InsertRegulation): Promise<Regulation>;
  updateRegulation(id: number, regulation: Partial<InsertRegulation>): Promise<Regulation>;
  setRegulationApplicability(id: number, isApplicable: boolean): Promise<Regulation>;
  getRegulationsByJurisdiction(jurisdiction: string): Promise<Regulation[]>; // Added method

  // Comment methods
  getCommentsByRegulation(regulationId: number): Promise<Comment[]>;
  createComment(comment: InsertComment): Promise<Comment>;
  updateComment(id: number, content: string): Promise<Comment>;
  deleteComment(id: number): Promise<void>;

  // Notification methods
  getNotificationsByUser(userId: number): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  sendEmailNotification(userId: number, subject: string, message: string): Promise<boolean>;

  // Deadline methods
  getDeadlines(): Promise<Deadline[]>;
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
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getRegulations(): Promise<Regulation[]> {
    console.log("Fetching regulations from database...");
    const result = await db.select({
      id: regulations.id,
      itemId: regulations.itemId,
      name: regulations.name,
      topic: regulations.topic,
      statute: regulations.statute,
      statuteIds: regulations.statuteIds,
      summary: regulations.summary,
      requirements: regulations.requirements,
      category: regulations.category,
      jurisdiction: regulations.jurisdiction,
      isApplicable: regulations.isApplicable,
      regulationUrl: regulations.regulationUrl,
      requirementsUrl: regulations.requirementsUrl,
      submissionGuidelines: regulations.submissionGuidelines
    }).from(regulations);
    console.log(`Found ${result.length} regulations in database:`, result);
    return result;
  }

  async getRegulation(id: number): Promise<Regulation | undefined> {
    const [regulation] = await db.select().from(regulations).where(eq(regulations.id, id));
    return regulation;
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

  async getCommentsByRegulation(regulationId: number): Promise<Comment[]> {
    return await db
      .select()
      .from(comments)
      .where(eq(comments.regulationId, regulationId));
  }

  async createComment(comment: InsertComment): Promise<Comment> {
    const [newComment] = await db.insert(comments).values(comment).returning();
    return newComment;
  }

  async updateComment(id: number, content: string): Promise<Comment> {
    const [updatedComment] = await db
      .update(comments)
      .set({ content })
      .where(eq(comments.id, id))
      .returning();
    return updatedComment;
  }

  async deleteComment(id: number): Promise<void> {
    await db.delete(comments).where(eq(comments.id, id));
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

  async getRegulationsByJurisdiction(jurisdiction: string): Promise<Regulation[]> {
    console.log(`Fetching regulations with jurisdiction: ${jurisdiction}`);
    const result = await db
      .select()
      .from(regulations)
      .where(eq(regulations.jurisdiction, jurisdiction));
    console.log(`Found ${result.length} ${jurisdiction} regulations`);
    return result;
  }
}

export const storage = new DatabaseStorage();