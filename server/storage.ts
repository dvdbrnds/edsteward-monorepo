import { users, regulations, notifications, deadlines, comments, guides } from "@shared/schema";
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
  createRegulation(regulation: InsertRegulation): Promise<Regulation>;
  updateRegulation(id: number, regulation: Partial<InsertRegulation>): Promise<Regulation>;

  // Comment methods
  getCommentsByRegulation(regulationId: number): Promise<Comment[]>;
  createComment(comment: InsertComment): Promise<Comment>;
  updateComment(id: number, content: string): Promise<Comment>;
  deleteComment(id: number): Promise<void>;

  // Notification methods
  getNotificationsByUser(userId: number): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;

  // Deadline methods
  getDeadlines(): Promise<Deadline[]>;
  createDeadline(deadline: InsertDeadline): Promise<Deadline>;

  // Guide methods
  getGuides(): Promise<Guide[]>;
  getGuidesByCategory(category: string): Promise<Guide[]>;
  getGuide(id: number): Promise<Guide | undefined>;
  createGuide(guide: InsertGuide): Promise<Guide>;
  updateGuide(id: number, guide: Partial<InsertGuide>): Promise<Guide>;

  // Session store
  sessionStore: session.Store;
}

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
    return await db.select().from(regulations);
  }

  async createRegulation(regulation: InsertRegulation): Promise<Regulation> {
    const [newRegulation] = await db.insert(regulations).values(regulation).returning();
    return newRegulation;
  }

  async updateRegulation(id: number, regulation: Partial<InsertRegulation>): Promise<Regulation> {
    const [updatedRegulation] = await db
      .update(regulations)
      .set({
        ...regulation,
        lastUpdated: new Date()
      })
      .where(eq(regulations.id, id))
      .returning();
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
}

export const storage = new DatabaseStorage();