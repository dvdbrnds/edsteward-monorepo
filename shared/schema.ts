import { pgTable, text, serial, integer, boolean, date, timestamp, jsonb } from "drizzle-orm/pg-core";
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
  agency_url: text("agency_url"),
  agency_name: text("agency_name"),
  regulationUrl: text("regulation_url"),
  requirementsUrl: text("requirements_url"),
});

// Comments table
export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  regulationId: integer("regulation_id").notNull(),
  userId: integer("user_id").notNull(),
  content: text("content").notNull(),
  parentId: integer("parent_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Notifications table - updated to include phone number
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  regulationId: integer("regulation_id").notNull(),
  userId: integer("user_id").notNull(),
  type: text("type").notNull(),
  frequency: text("frequency").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  phoneNumber: text("phone_number"),  // Added for SMS notifications
});

// Deadlines table
export const deadlines = pgTable("deadlines", {
  id: serial("id").primaryKey(),
  regulationId: integer("regulation_id").notNull(),
  dueDate: date("due_date").notNull(),  // Keep as date instead of timestamp
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

// Schema for inserting users
export const insertUserSchema = createInsertSchema(users)
  .extend({
    password: z.string().min(6),
    role: z.enum(["admin", "compliance_officer", "user"]),
    department: z.string().optional(),
  });

// Schema for inserting regulations
export const insertRegulationSchema = createInsertSchema(regulations)
  .extend({
    regulationUrl: z.string().url().optional().nullable(),
    requirementsUrl: z.string().url().optional().nullable(),
  });

// Schema for inserting comments
export const insertCommentSchema = createInsertSchema(comments)
  .extend({
    content: z.string().min(1, "Comment cannot be empty"),
    parentId: z.number().optional(),
  });

// Schema for inserting notifications - updated
export const insertNotificationSchema = createInsertSchema(notifications)
  .extend({
    phoneNumber: z.string().regex(/^\+\d{1,15}$/, "Must be a valid phone number in E.164 format").optional(),
  });

// Schema for inserting deadlines
export const insertDeadlineSchema = createInsertSchema(deadlines);

// Schema for inserting guides
export const insertGuideSchema = createInsertSchema(guides)
  .extend({
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
export const insertEmailConfigSchema = createInsertSchema(emailConfigs)
  .extend({
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
export const insertTwilioConfigSchema = createInsertSchema(twilioConfigs)
  .extend({
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
  schema: jsonb("schema").notNull().$type<Record<string, CsvSchemaField>>(),  // Explicit typing
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdBy: integer("created_by").notNull(),
});

// Update the insert schema to match the new typing
export const insertCsvSchemaSchema = createInsertSchema(csvSchemas)
  .extend({
    schema: z.record(z.string(), z.object({
      type: z.enum(["string", "number", "boolean", "date"]),
      required: z.boolean(),
      format: z.string().optional()
    }))
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
  ruleType: text("rule_type").notNull(),  // e.g., "regex", "range", "required"
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
  status: text("status").notNull(),  // "success", "partial", "failed"
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
export const insertValidationRuleSchema = createInsertSchema(validationRules)
  .extend({
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
export const insertTransformationLogSchema = createInsertSchema(transformationLogs)
  .extend({
    status: z.enum(["success", "partial", "failed"]),
    metadata: z.record(z.string(), z.unknown()).optional(),
  });

// Schema for inserting Error Record
export const insertErrorRecordSchema = createInsertSchema(errorRecords)
  .extend({
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
export type Comment = typeof comments.$inferSelect;
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Deadline = typeof deadlines.$inferSelect;
export type InsertDeadline = z.infer<typeof insertDeadlineSchema>;
export type Guide = typeof guides.$inferSelect;
export type InsertGuide = z.infer<typeof insertGuideSchema>;
export type TwilioConfig = typeof twilioConfigs.$inferSelect;
export type InsertTwilioConfig = z.infer<typeof insertTwilioConfigSchema>;