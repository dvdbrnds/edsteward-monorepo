import { pgTable, text, serial, integer, boolean, date, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Regulations table with expanded fields from survey data
export const regulations = pgTable("regulations", {
  id: serial("id").primaryKey(),
  itemId: text("item_id").notNull(),
  topic: text("topic").notNull(),
  division: text("division"),
  category: text("category").notNull(),
  statute: text("statute").notNull(),
  statuteUrl: text("statute_url"),
  yearOfPassage: text("year_of_passage"),
  yearOfAmendments: text("year_of_amendments"),
  governmentLevel: text("government_level"),
  oversightAgency: text("oversight_agency"),
  complianceRequirements: text("compliance_requirements"),
  communityNotifications: text("community_notifications"),
  submissionRequirements: text("submission_requirements"),
  relatedDepartments: text("related_departments").array(),
  associatedLaws: text("associated_laws").array(),
  noticeUrl: text("notice_url"),
  policyUrl: text("policy_url"),
  lastUpdated: timestamp("last_updated"),
  contactEmail: text("contact_email"),
  department: text("department"),
  complianceStatus: text("compliance_status"),
  reviewFrequency: text("review_frequency"),
  nextReviewDate: date("next_review_date"),
  notes: text("notes"),
});

// Other tables remain unchanged
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"),
  department: text("department"),
});

export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  regulationId: integer("regulation_id").notNull(),
  userId: integer("user_id").notNull(),
  content: text("content").notNull(),
  parentId: integer("parent_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  regulationId: integer("regulation_id").notNull(),
  userId: integer("user_id").notNull(),
  type: text("type").notNull(),
  frequency: text("frequency").notNull(),
  enabled: boolean("enabled").notNull().default(true),
});

export const deadlines = pgTable("deadlines", {
  id: serial("id").primaryKey(),
  regulationId: integer("regulation_id").notNull(),
  dueDate: date("due_date").notNull(),
  status: text("status").notNull(),
  assignedTo: integer("assigned_to").notNull(),
  description: text("description"),
  notificationType: text("notification_type"),
  submissionType: text("submission_type"),
});

export const guides = pgTable("guides", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category").notNull(),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdBy: integer("created_by").notNull(),
});

// Update schemas
export const insertRegulationSchema = createInsertSchema(regulations)
  .extend({
    statuteUrl: z.string().url().optional(),
    policyUrl: z.string().url().optional(),
    noticeUrl: z.string().url().optional(),
    contactEmail: z.string().email().optional(),
    department: z.string().optional(),
    complianceStatus: z.string().optional(),
    reviewFrequency: z.string().optional(),
    nextReviewDate: z.string().optional(),
    notes: z.string().optional(),
    relatedDepartments: z.array(z.string()).optional(),
    associatedLaws: z.array(z.string()).optional(),
  });

// Other insert schemas remain unchanged
export const insertUserSchema = createInsertSchema(users)
  .extend({
    password: z.string().min(6),
    role: z.enum(["admin", "compliance_officer", "user"]),
    department: z.string().optional(),
  });

export const insertCommentSchema = createInsertSchema(comments)
  .extend({
    content: z.string().min(1, "Comment cannot be empty"),
    parentId: z.number().optional(),
  });

export const insertNotificationSchema = createInsertSchema(notifications);

export const insertDeadlineSchema = createInsertSchema(deadlines);

export const insertGuideSchema = createInsertSchema(guides)
  .extend({
    content: z.string().min(1, "Guide content cannot be empty"),
    category: z.enum(["submission", "compliance", "general"]),
  });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Regulation = typeof regulations.$inferSelect;
export type InsertRegulation = z.infer<typeof insertRegulationSchema>;
export type Comment = typeof comments.$inferSelect;
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Deadline = typeof deadlines.$inferSelect;
export type InsertDeadline = z.infer<typeof insertDeadlineSchema>;
export type Guide = typeof guides.$inferSelect;
export type InsertGuide = z.infer<typeof insertGuideSchema>;