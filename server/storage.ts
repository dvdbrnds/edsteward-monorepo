import { users, regulations, notifications, deadlines } from "@shared/schema";
import type { User, InsertUser, Regulation, InsertRegulation, Notification, InsertNotification, Deadline, InsertDeadline } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

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
  sessionStore: session.SessionStore;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private regulations: Map<number, Regulation>;
  private notifications: Map<number, Notification>;
  private deadlines: Map<number, Deadline>;
  private currentId: number;
  sessionStore: session.SessionStore;

  constructor() {
    this.users = new Map();
    this.regulations = new Map();
    this.notifications = new Map();
    this.deadlines = new Map();
    this.currentId = 1;
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000,
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getRegulations(): Promise<Regulation[]> {
    return Array.from(this.regulations.values());
  }

  async createRegulation(regulation: InsertRegulation): Promise<Regulation> {
    const id = this.currentId++;
    const newRegulation: Regulation = { ...regulation, id };
    this.regulations.set(id, newRegulation);
    return newRegulation;
  }

  async getNotificationsByUser(userId: number): Promise<Notification[]> {
    return Array.from(this.notifications.values()).filter(
      (notification) => notification.userId === userId,
    );
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const id = this.currentId++;
    const newNotification: Notification = { ...notification, id };
    this.notifications.set(id, newNotification);
    return newNotification;
  }

  async getDeadlines(): Promise<Deadline[]> {
    return Array.from(this.deadlines.values());
  }

  async createDeadline(deadline: InsertDeadline): Promise<Deadline> {
    const id = this.currentId++;
    const newDeadline: Deadline = { ...deadline, id };
    this.deadlines.set(id, newDeadline);
    return newDeadline;
  }
}

export const storage = new MemStorage();
