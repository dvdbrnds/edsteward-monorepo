import { pgTable, text, serial, integer, boolean, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"),
  department: text("department"),
});

// Regulations table
export const regulations = pgTable("regulations", {
  id: serial("id").primaryKey(),
  itemId: text("item_id").notNull(),
  topic: text("topic").notNull(),
  statute: text("statute").notNull(),
  statuteIds: text("statute_ids"),
  summary: text("summary"),
  requirements: text("requirements"),
  deadlines: text("deadlines"),
  category: text("category").notNull(),
  lastUpdated: timestamp("last_updated"),
});

// Notifications table
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  regulationId: integer("regulation_id").notNull(),
  userId: integer("user_id").notNull(),
  type: text("type").notNull(), // email, sms
  frequency: text("frequency").notNull(), // daily, weekly, monthly
  enabled: boolean("enabled").notNull().default(true),
});

// Deadlines table
export const deadlines = pgTable("deadlines", {
  id: serial("id").primaryKey(),
  regulationId: integer("regulation_id").notNull(),
  dueDate: date("due_date").notNull(),
  status: text("status").notNull(), // pending, completed, overdue
  assignedTo: integer("assigned_to").notNull(),
});

// Schema for inserting users
export const insertUserSchema = createInsertSchema(users)
  .extend({
    password: z.string().min(6),
    role: z.enum(["admin", "compliance_officer", "user"]),
    department: z.string().optional(),
  });

// Schema for inserting regulations
export const insertRegulationSchema = createInsertSchema(regulations);

// Schema for inserting notifications
export const insertNotificationSchema = createInsertSchema(notifications);

// Schema for inserting deadlines
export const insertDeadlineSchema = createInsertSchema(deadlines);

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Regulation = typeof regulations.$inferSelect;
export type InsertRegulation = z.infer<typeof insertRegulationSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Deadline = typeof deadlines.$inferSelect;
export type InsertDeadline = z.infer<typeof insertDeadlineSchema>;
