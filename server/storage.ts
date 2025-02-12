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
import MemoryStore from "memorystore";

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

export class MemoryStorage implements IStorage {
  private users: User[] = [];
  private regulations: Regulation[] = [];
  private notifications: Notification[] = [];
  private deadlines: Deadline[] = [];
  private nextId = 1;
  sessionStore: session.Store;

  constructor() {
    const MemoryStoreConstructor = MemoryStore(session);
    this.sessionStore = new MemoryStoreConstructor({
      checkPeriod: 86400000 // prune expired entries every 24h
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.find(u => u.id === id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return this.users.find(u => u.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const user: User = { ...insertUser, id: this.nextId++ };
    this.users.push(user);
    return user;
  }

  async getRegulations(): Promise<Regulation[]> {
    return this.regulations;
  }

  async createRegulation(regulation: InsertRegulation): Promise<Regulation> {
    const newRegulation: Regulation = { ...regulation, id: this.nextId++ };
    this.regulations.push(newRegulation);
    return newRegulation;
  }

  async getNotificationsByUser(userId: number): Promise<Notification[]> {
    return this.notifications.filter(n => n.userId === userId);
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const newNotification: Notification = { ...notification, id: this.nextId++ };
    this.notifications.push(newNotification);
    return newNotification;
  }

  async getDeadlines(): Promise<Deadline[]> {
    return this.deadlines;
  }

  async createDeadline(deadline: InsertDeadline): Promise<Deadline> {
    const newDeadline: Deadline = { ...deadline, id: this.nextId++ };
    this.deadlines.push(newDeadline);
    return newDeadline;
  }
}

export const storage = new MemoryStorage();