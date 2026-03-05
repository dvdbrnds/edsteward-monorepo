import { eq } from 'drizzle-orm';
import { users, type User, type InsertUser } from '@shared/schema';
import { BaseRepository } from './base';

export interface CreateUserData extends Omit<InsertUser, 'password'> {
  password: string; // Make password required for creation
}

export class UserRepository extends BaseRepository {
  /**
   * Get user by ID
   */
  async findById(id: number): Promise<User | undefined> {
    try {
      const userList = await this.db.select().from(users).where(eq(users.id, id));
      return userList[0];
    } catch (error) {
      this.handleDatabaseError(error, 'fetch user by ID');
    }
  }

  /**
   * Get user by username
   */
  async findByUsername(username: string): Promise<User | undefined> {
    try {
      const userList = await this.db.select().from(users).where(eq(users.username, username));
      return userList[0];
    } catch (error) {
      this.handleDatabaseError(error, 'fetch user by username');
    }
  }

  /**
   * Create a new user
   */
  async create(userData: CreateUserData): Promise<User> {
    try {
      const newUsers = await this.db.insert(users).values(userData).returning();
      return newUsers[0];
    } catch (error) {
      this.handleDatabaseError(error, 'create user');
    }
  }

  /**
   * Get all users
   */
  async findAll(): Promise<User[]> {
    try {
      return await this.db.select().from(users);
    } catch (error) {
      this.handleDatabaseError(error, 'fetch all users');
    }
  }

  /**
   * Update user by ID
   */
  async update(id: number, userData: Partial<InsertUser>): Promise<User> {
    try {
      // Validate user exists first
      await this.validateExists(id, this.findById.bind(this), 'User');
      
      const updatedUsers = await this.db
        .update(users)
        .set(userData)
        .where(eq(users.id, id))
        .returning();
      
      return updatedUsers[0];
    } catch (error) {
      this.handleDatabaseError(error, 'update user');
    }
  }

  /**
   * Delete user by ID
   */
  async delete(id: number): Promise<void> {
    try {
      // Validate user exists first
      await this.validateExists(id, this.findById.bind(this), 'User');
      
      await this.db.delete(users).where(eq(users.id, id));
    } catch (error) {
      this.handleDatabaseError(error, 'delete user');
    }
  }

  /**
   * Check if any admin users exist
   */
  async hasAdmin(): Promise<boolean> {
    try {
      const adminUsers = await this.db
        .select()
        .from(users)
        .where(eq(users.role, 'admin'))
        .limit(1);
      
      return adminUsers.length > 0;
    } catch (error) {
      this.handleDatabaseError(error, 'check admin existence');
    }
  }
} 