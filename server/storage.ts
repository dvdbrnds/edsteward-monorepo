import { users, regulations, notifications, deadlines } from "@shared/schema";
import type {
  User,
  InsertUser,
  Regulation,
  InsertRegulation,
  Notification,
  InsertNotification,
  Deadline,
  InsertDeadline,
} from "@shared/schema";
import session from "express-session";
import { db } from "./db";
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

  // Notification methods
  getNotificationsByUser(userId: number): Promise<Notification[]>;
  createNotification(notification: InsertNotification): Promise<Notification>;

  // Deadline methods
  getDeadlines(): Promise<Deadline[]>;
  createDeadline(deadline: InsertDeadline): Promise<Deadline>;

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
    const results = await db.select().from(users).where(({ id: userId }) => userId.eq(id));
    return results[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const results = await db.select().from(users).where(({ username: un }) => un.eq(username));
    return results[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const results = await db.insert(users).values(user).returning();
    return results[0];
  }

  async getRegulations(): Promise<Regulation[]> {
    return await db.select().from(regulations);
  }

  async createRegulation(regulation: InsertRegulation): Promise<Regulation> {
    const results = await db.insert(regulations).values(regulation).returning();
    return results[0];
  }

  async getNotificationsByUser(userId: number): Promise<Notification[]> {
    return await db.select().from(notifications).where(({ userId: uid }) => uid.eq(userId));
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const results = await db.insert(notifications).values(notification).returning();
    return results[0];
  }

  async getDeadlines(): Promise<Deadline[]> {
    return await db.select().from(deadlines);
  }

  async createDeadline(deadline: InsertDeadline): Promise<Deadline> {
    const results = await db.insert(deadlines).values(deadline).returning();
    return results[0];
  }
}

export const storage = new DatabaseStorage();