import { pgTable, text, serial, integer, timestamp, boolean, date, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"),
  department: text("department"),
  email: text("email").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  // SAML 2.0 fields
  externalId: text("external_id").unique(),
  providerId: text("provider_id"),
  identityProvider: text("identity_provider"),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Schema for inserting users
export const insertUserSchema = createInsertSchema(users).extend({
  password: z.string().min(6).optional(), // Optional because SAML users won't have password
  role: z.enum(["admin", "compliance_officer", "user"]),
  department: z.string().optional(),
  email: z.string().email(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  externalId: z.string().optional(),
  providerId: z.string().optional(),
  identityProvider: z.string().optional(),
});

// Add notes table after users table
export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  regulationId: integer("regulation_id").notNull(),
  userId: integer("user_id").notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category").notNull().default("general"),
  status: text("status").notNull().default("active"),
  isPrivate: boolean("is_private").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Regulations table
export const regulations = pgTable("regulations", {
  id: serial("id").primaryKey(),
  itemId: text("item_id").notNull(),
  name: text("name").notNull(),
  topic: text("topic").notNull(),
  statute: text("statute").notNull(),
  statuteIds: text("statute_ids"),
  summary: text("summary"),
  requirements: text("requirements"),
  category: text("category").notNull(),
  jurisdiction: text("jurisdiction").notNull().default("federal"),
  isApplicable: boolean("is_applicable").notNull().default(true),
  originationDate: timestamp("origination_date"),
  effectiveDate: timestamp("effective_date"),
  lastUpdated: timestamp("last_updated"),
  lastVerified: timestamp("last_verified"),
  nextReviewDate: timestamp("next_review_date"),
  filingDeadlines: jsonb("filing_deadlines").$type<{
    type: string;
    date: string;
    frequency: string;
    description: string;
  }[]>(),
  reportingFrequency: text("reporting_frequency"),
  agency_url: text("agency_url"),
  agency_name: text("agency_name"),
  agency_contact: text("agency_contact"),
  agency_department: text("agency_department"),
  regulationUrl: text("regulation_url"),
  requirementsUrl: text("requirements_url"),
  submissionGuideUrl: text("submission_guide_url"),
  formsUrl: text("forms_url"),
  submissionGuidelines: text("submission_guidelines"),
  regulationText: text("regulation_text"),
  applicableforms: jsonb("applicable_forms").$type<string[]>(),
  relatedRegulations: jsonb("related_regulations").$type<string[]>(),
  complianceNotes: text("compliance_notes"),
  verificationMethod: text("verification_method"),
  notificationSchedule: jsonb("notification_schedule").$type<{
    initialReminder: number;
    weeklyReminder: number;
    dailyReminder: number;
    finalDayReminders: boolean;
  }>(),
});

// Notifications table
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  regulationId: integer("regulation_id").notNull(),
  userId: integer("user_id").notNull(),
  type: text("type").notNull(),
  frequency: text("frequency").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  phoneNumber: text("phone_number"),
});

// Deadlines table
export const deadlines = pgTable("deadlines", {
  id: serial("id").primaryKey(),
  regulationId: integer("regulation_id").notNull(),
  dueDate: date("due_date").notNull(),
  status: text("status").notNull(),
  assignedTo: integer("assigned_to").notNull(),
});

// Guides table for storing submission guides and documentation
export const guides = pgTable("guides", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  category: text("category").notNull(),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdBy: integer("created_by").notNull(),
});

// Notes schema is already defined above

// Notes insertion schema with detailed logging
console.log("Creating note insertion schema with validation rules");
export const insertNoteSchema = createInsertSchema(notes).extend({
  regulationId: z.number().positive("Regulation ID must be a positive number"),
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
});
console.log("Note insertion schema created successfully");

// Log schema structure for debugging
console.log("Note schema fields:", Object.keys(notes));

// Schema for inserting regulations
export const insertRegulationSchema = createInsertSchema(regulations).extend({
  name: z.string().min(1, "Regulation name is required"),
  jurisdiction: z.enum(["federal", "state"]),
  originationDate: z.date().optional().nullable(),
  effectiveDate: z.date().optional().nullable(),
  nextReviewDate: z.date().optional().nullable(),
  filingDeadlines: z.array(z.object({
    type: z.string(),
    date: z.string(),
    frequency: z.string(),
    description: z.string(),
  })).optional().nullable(),
  regulationUrl: z.string().url().optional().nullable(),
  requirementsUrl: z.string().url().optional().nullable(),
  submissionGuideUrl: z.string().url().optional().nullable(),
  formsUrl: z.string().url().optional().nullable(),
  applicableforms: z.array(z.string()).optional().nullable(),
  relatedRegulations: z.array(z.string()).optional().nullable(),
  lastVerified: z.date().optional().nullable(),
  isApplicable: z.boolean().default(true),
  notificationSchedule: z.object({
    initialReminder: z.number().min(1).max(365).default(90),
    weeklyReminder: z.number().min(1).max(90).default(30),
    dailyReminder: z.number().min(1).max(30).default(7),
    finalDayReminders: z.boolean().default(true),
  }).optional().nullable(),
});

// Schema for inserting notifications
export const insertNotificationSchema = createInsertSchema(notifications).extend({
  phoneNumber: z
    .string()
    .regex(/^\+\d{1,15}$/, "Must be a valid phone number in E.164 format")
    .optional(),
});

// Schema for inserting deadlines
export const insertDeadlineSchema = createInsertSchema(deadlines);

// Schema for inserting guides
export const insertGuideSchema = createInsertSchema(guides).extend({
  content: z.string().min(1, "Guide content cannot be empty"),
  category: z.enum(["submission", "compliance", "general"]),
});

// Email Configuration table
export const emailConfigs = pgTable("email_configs", {
  id: serial("id").primaryKey(),
  fromEmail: text("from_email").notNull(),
  smtpHost: text("smtp_host").notNull(),
  smtpPort: integer("smtp_port").notNull(),
  smtpSecure: boolean("smtp_secure").notNull().default(true),
  smtpUser: text("smtp_user").notNull(),
  smtpPass: text("smtp_pass").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: integer("updated_by").notNull(),
});

// Schema for inserting email config
export const insertEmailConfigSchema = createInsertSchema(emailConfigs).extend({
  fromEmail: z.string().email("Must be a valid email address"),
  smtpHost: z.string().min(1, "SMTP host is required"),
  smtpPort: z.number().int().min(1, "Port must be a positive number"),
  smtpSecure: z.boolean(),
  smtpUser: z.string().min(1, "SMTP username is required"),
  smtpPass: z.string().min(1, "SMTP password is required"),
});

// Twilio Configuration table
export const twilioConfigs = pgTable("twilio_configs", {
  id: serial("id").primaryKey(),
  accountSid: text("account_sid").notNull(),
  authToken: text("auth_token").notNull(),
  fromNumber: text("from_number").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: integer("updated_by").notNull(),
});

// Schema for inserting Twilio config
export const insertTwilioConfigSchema = createInsertSchema(twilioConfigs).extend({
  accountSid: z.string().min(1, "Account SID is required"),
  authToken: z.string().min(1, "Auth Token is required"),
  fromNumber: z.string().regex(/^\+\d{1,15}$/, "Must be a valid phone number in E.164 format"),
});

// Add the specific schema field type definition
export interface CsvSchemaField {
  type: "string" | "number" | "boolean" | "date";
  required: boolean;
  format?: string;
}

// Update the csvSchemas table definition to include proper typing
export const csvSchemas = pgTable("csv_schemas", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  schema: jsonb("schema").notNull().$type<Record<string, CsvSchemaField>>(), // Explicit typing
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdBy: integer("created_by").notNull(),
});

// Update the insert schema to match the new typing
export const insertCsvSchemaSchema = createInsertSchema(csvSchemas).extend({
  schema: z.record(z.string(), z.object({
    type: z.enum(["string", "number", "boolean", "date"]),
    required: z.boolean(),
    format: z.string().optional(),
  })),
});

// Field Mappings table
export const fieldMappings = pgTable("field_mappings", {
  id: serial("id").primaryKey(),
  schemaId: integer("schema_id").notNull(),
  sourceField: text("source_field").notNull(),
  targetField: text("target_field").notNull(),
  transformationRule: text("transformation_rule"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Validation Rules table
export const validationRules = pgTable("validation_rules", {
  id: serial("id").primaryKey(),
  schemaId: integer("schema_id").notNull(),
  fieldName: text("field_name").notNull(),
  ruleType: text("rule_type").notNull(), // e.g., "regex", "range", "required"
  ruleConfig: jsonb("rule_config").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Transformation Logs table
export const transformationLogs = pgTable("transformation_logs", {
  id: serial("id").primaryKey(),
  schemaId: integer("schema_id").notNull(),
  fileName: text("file_name").notNull(),
  status: text("status").notNull(), // "success", "partial", "failed"
  recordsProcessed: integer("records_processed").notNull(),
  recordsFailed: integer("records_failed").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  metadata: jsonb("metadata"),
});

// Error Records table
export const errorRecords = pgTable("error_records", {
  id: serial("id").primaryKey(),
  transformationLogId: integer("transformation_log_id").notNull(),
  rowNumber: integer("row_number").notNull(),
  rawData: jsonb("raw_data").notNull(),
  errorType: text("error_type").notNull(),
  errorMessage: text("error_message").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Schema for inserting Field Mapping
export const insertFieldMappingSchema = createInsertSchema(fieldMappings);

// Schema for inserting Validation Rule
export const insertValidationRuleSchema = createInsertSchema(validationRules).extend({
  ruleType: z.enum(["regex", "range", "required", "enum", "custom"]),
  ruleConfig: z.object({
    pattern: z.string().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    values: z.array(z.string()).optional(),
    customValidation: z.string().optional(),
  }),
});

// Schema for inserting Transformation Log
export const insertTransformationLogSchema = createInsertSchema(transformationLogs).extend({
  status: z.enum(["success", "partial", "failed"]),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// Schema for inserting Error Record
export const insertErrorRecordSchema = createInsertSchema(errorRecords).extend({
  errorType: z.enum(["validation", "transformation", "schema_mismatch"]),
});

// Additional type exports
export type CsvSchema = typeof csvSchemas.$inferSelect;
export type InsertCsvSchema = z.infer<typeof insertCsvSchemaSchema>;
export type FieldMapping = typeof fieldMappings.$inferSelect;
export type InsertFieldMapping = z.infer<typeof insertFieldMappingSchema>;
export type ValidationRule = typeof validationRules.$inferSelect;
export type InsertValidationRule = z.infer<typeof insertValidationRuleSchema>;
export type TransformationLog = typeof transformationLogs.$inferSelect;
export type InsertTransformationLog = z.infer<typeof insertTransformationLogSchema>;
export type ErrorRecord = typeof errorRecords.$inferSelect;
export type InsertErrorRecord = z.infer<typeof insertErrorRecordSchema>;
export type EmailConfig = typeof emailConfigs.$inferSelect;
export type InsertEmailConfig = z.infer<typeof insertEmailConfigSchema>;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Regulation = typeof regulations.$inferSelect;
export type InsertRegulation = z.infer<typeof insertRegulationSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Deadline = typeof deadlines.$inferSelect;
export type InsertDeadline = z.infer<typeof insertDeadlineSchema>;
export type Guide = typeof guides.$inferSelect;
export type InsertGuide = z.infer<typeof insertGuideSchema>;
export type TwilioConfig = typeof twilioConfigs.$inferSelect;
export type InsertTwilioConfig = z.infer<typeof insertTwilioConfigSchema>;
export type Note = typeof notes.$inferSelect;
export type InsertNote = z.infer<typeof insertNoteSchema>;