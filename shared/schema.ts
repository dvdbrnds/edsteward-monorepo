import { pgTable, text, serial, integer, timestamp, boolean, date, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Add source interface
export interface RegulationSource {
  url: string;
  type: 'agency-api' | 'web-scrape' | 'document-link';
  title?: string;
  lastChecked?: Date;
}

// Add after the RegulationSource interface
export interface RegulationVersion {
  changes: {
    field: string;
    oldValue: string;
    newValue: string;
    type: 'addition' | 'deletion' | 'modification';
  }[];
  mergeMetadata?: {
    mergedFrom: string[];
    conflictResolutions?: Record<string, string>;
  };
}

// Add after RegulationVersion interface
export interface RegulationAction {
  type: 'attestation' | 'website_publish' | 'community_communication' | 'agency_submission';
  enabled: boolean;
  required: boolean;
  dueDate?: Date;
  completedDate?: Date;
  status: 'pending' | 'in_progress' | 'completed';
  notes?: string;
  completedBy?: {
    userId: number;
    username: string;
    fullName?: string;
  };
  completedAt?: Date;
}

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"),
  department: text("department"),
  email: text("email").notNull(),
  firstName: text("firstName"),
  lastName: text("lastName"),
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

// Add after the notes table definition
export const evidenceFiles = pgTable("evidence_files", {
  id: serial("id").primaryKey(),
  regulationId: integer("regulation_id").notNull(),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size").notNull(),
  fileType: text("file_type").notNull(),
  description: text("description"),
  uploadedBy: integer("uploaded_by").notNull(),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  status: text("status").notNull().default("pending"),
  storagePath: text("storage_path").notNull(),
});

// Update the regulations table definition to include PA-specific fields
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
  // Add DRO field
  dro: text("dro").notNull().default(""),
  isApplicable: boolean("is_applicable").notNull().default(true),
  originationDate: timestamp("origination_date"),
  effectiveDate: timestamp("effective_date"),
  lastUpdated: timestamp("last_updated"),
  lastVerified: timestamp("last_verified"),
  nextReviewDate: timestamp("next_review_date"),
  // Version control fields remain unchanged
  versionNumber: integer("version_number").notNull().default(1),
  previousVersionId: integer("previous_version_id").references(() => regulations.id),
  versionDate: timestamp("version_date").notNull().defaultNow(),
  changeSummary: text("change_summary"),
  isCurrent: boolean("is_current").notNull().default(true),
  versionMetadata: jsonb("version_metadata").$type<RegulationVersion>(),
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
  sources: jsonb("sources").$type<RegulationSource[]>(),
  actions: jsonb("actions").$type<RegulationAction>()
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

// Update the insert schema to include PA-specific validation
export const insertRegulationSchema = createInsertSchema(regulations).extend({
  name: z.string().min(1, "Regulation name is required"),
  dro: z.string().email("DRO must be a valid email address").optional(),
  jurisdiction: z.enum(["federal", "state"]),
  stateCode: z.string().optional(),
  stateAgency: z.string().optional(),
  originationDate: z.date().optional().nullable(),
  effectiveDate: z.date().optional().nullable(),
  nextReviewDate: z.date().optional().nullable(),
  // Version control validation
  versionNumber: z.number().int().positive().default(1),
  previousVersionId: z.number().int().positive().optional().nullable(),
  versionDate: z.date().default(() => new Date()),
  changeSummary: z.string().optional(),
  isCurrent: z.boolean().default(true),
  versionMetadata: z.object({
    changes: z.array(z.object({
      field: z.string(),
      oldValue: z.string(),
      newValue: z.string(),
      type: z.enum(['addition', 'deletion', 'modification'])
    })),
    mergeMetadata: z.object({
      mergedFrom: z.array(z.string()),
      conflictResolutions: z.record(z.string()).optional()
    }).optional()
  }).optional().nullable(),
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
  sources: z.array(z.object({
    url: z.string(),
    type: z.enum(['agency-api', 'web-scrape', 'document-link']),
    title: z.string().optional(),
    lastChecked: z.date().optional()
  })).optional().nullable(),
  actions: z.array(z.object({
    type: z.enum(['attestation', 'website_publish', 'community_communication', 'agency_submission']),
    enabled: z.boolean().default(true),
    required: z.boolean().default(false),
    dueDate: z.date().optional(),
    completedDate: z.date().optional(),
    status: z.enum(['pending', 'in_progress', 'completed']).default('pending'),
    notes: z.string().optional(),
    completedBy: z.object({
      userId: z.number(),
      username: z.string(),
      fullName: z.string().optional()
    }).optional(),
    completedAt: z.date().optional()
  })).default([
    {
      type: 'attestation',
      enabled: true,
      required: false,
      status: 'pending'
    },
    {
      type: 'website_publish',
      enabled: true,
      required: false,
      status: 'pending'
    },
    {
      type: 'community_communication',
      enabled: true,
      required: false,
      status: 'pending'
    },
    {
      type: 'agency_submission',
      enabled: true,
      required: false,
      status: 'pending'
    }
  ])
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

// Add after other insert schemas
export const insertEvidenceFileSchema = createInsertSchema(evidenceFiles);

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
export type EvidenceFile = typeof evidenceFiles.$inferSelect;
export type InsertEvidenceFile = z.infer<typeof insertEvidenceFileSchema>;

// Add after the existing tables
// System Logs table according to RFC 5424 syslog standard
export const systemLogs = pgTable("system_logs", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  facility: integer("facility").notNull(),
  severity: integer("severity").notNull(),
  version: integer("version").notNull().default(1),
  hostname: text("hostname").notNull(),
  appName: text("app_name").notNull(),
  procId: text("proc_id").notNull(),
  msgId: text("msg_id"),
  structuredData: jsonb("structured_data").$type<Record<string, any>>(),
  message: text("message").notNull(),
});

// Schema for inserting system logs
export const insertSystemLogSchema = createInsertSchema(systemLogs).extend({
  facility: z.number().min(0).max(23),
  severity: z.number().min(0).max(7),
  version: z.number().default(1),
  hostname: z.string(),
  appName: z.string(),
  procId: z.string(),
  msgId: z.string().optional(),
  structuredData: z.record(z.string(), z.unknown()).optional(),
  message: z.string(),
});

// Add to the type exports
export type SystemLog = typeof systemLogs.$inferSelect;
export type InsertSystemLog = z.infer<typeof insertSystemLogSchema>;