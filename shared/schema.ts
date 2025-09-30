import { pgTable, text, serial, integer, timestamp, boolean, date, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Jurisdiction and Institution Type Constants
export const JURISDICTION_SOURCES = [
  "federal",
  "state", 
  "international",
  "private-organization",
  "accreditor",
  "industry-association"
] as const;

export const INSTITUTION_TYPES = [
  "public-universities",
  "private-universities", 
  "community-colleges",
  "conservatories",
  "technical-institutes",
  "religious-institutions",
  "for-profit-institutions",
  "research-institutes",
  "professional-schools",
  "all-institutions"
] as const;

export type JurisdictionSource = typeof JURISDICTION_SOURCES[number];
export type InstitutionType = typeof INSTITUTION_TYPES[number];

// Add source interface
export interface RegulationSource {
  url: string;
  type: 'agency-api' | 'web-scrape' | 'document-link';
  title?: string;
  lastChecked?: Date;
}

// RegulationVersion interface moved to database schema section

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

// MCP Validation Levels
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export enum ValidationLevel {
  // Basic structural validation
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  A = "A",
  // Content-level validation  
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  B = "B", 
  // Business rules validation
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  C = "C",
  // Contextual/cross-reference validation
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  D = "D"
}

// Export validation levels for external use to satisfy ESLint
export const VALIDATION_LEVELS = {
  BASIC: ValidationLevel.A,
  CONTENT: ValidationLevel.B,
  BUSINESS: ValidationLevel.C,
  CONTEXTUAL: ValidationLevel.D
} as const;

// MCP Integration Types
export interface MCPSyncStatus {
  lastSyncAttempt: Date;
  lastSuccessfulSync: Date | null;
  syncErrors: Array<{
    timestamp: Date;
    message: string;
    code: string;
  }>;
  nextScheduledSync: Date | null;
  syncState: 'idle' | 'in_progress' | 'failed' | 'completed';
}

export interface MCPVersionConflict {
  field: string;
  localValue: string;
  remoteValue: string;
  resolutionStrategy: 'local' | 'remote' | 'merge' | 'manual';
  resolvedValue?: string;
  resolvedBy?: number; // User ID
  resolvedAt?: Date;
}

export interface MCPValidationResult {
  level: ValidationLevel;
  passed: boolean;
  errors: Array<{
    field: string;
    message: string;
    code: string;
    severity: 'warning' | 'error' | 'critical';
  }>;
  validatedAt: Date;
  validatedBy?: number; // User ID
}

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("viewer"),
  roles: text("roles"), // JSON string array of roles for multi-role support
  department: text("department"),
  email: text("email").notNull(),
  firstName: text("firstName"),
  lastName: text("lastName"),
  // SAML 2.0 fields
  externalId: text("external_id").unique(),
  providerId: text("provider_id"),
  identityProvider: text("identity_provider"),
  lastLogin: timestamp("last_login"),
  // MFA fields
  mfaSecret: text("mfa_secret"), // TOTP secret key (encrypted)
  mfaEnabled: boolean("mfa_enabled").notNull().default(false),
  mfaBackupCodes: text("mfa_backup_codes"), // JSON array of backup codes (encrypted)
  mfaSetupAt: timestamp("mfa_setup_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Schema for inserting users
export const insertUserSchema = createInsertSchema(users).extend({
  password: z.string().min(6).optional(), // Optional because SAML users won't have password
  role: z.enum(["admin", "compliance_officer", "department_head", "viewer", "user"]), // Updated role options
  roles: z.string().optional(), // JSON string of roles array
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
  isOfficial: boolean("is_official").notNull().default(false),
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
  jurisdictionSource: text("jurisdiction_source").notNull().default("federal"), // federal | state | international | private-organization | accreditor | etc.
  applicableInstitutions: jsonb("applicable_institutions").$type<string[]>(), // ["public-universities", "private-universities", "community-colleges", "conservatories", etc.]
  dro: text("dro").notNull().default(""),
  isApplicable: boolean("is_applicable").notNull().default(true),
  originationDate: timestamp("origination_date"),
  effectiveDate: timestamp("effective_date"),
  lastUpdated: timestamp("last_updated"),
  lastVerified: timestamp("last_verified"),
  nextReviewDate: timestamp("next_review_date"),
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
  notificationOverride: jsonb("notification_override").$type<{
    email: string | null;
    phone: string | null;
  }>(),
  sections: jsonb("sections").$type<{
    title: string;
    content: string;
    identifiers?: string[];
  }[]>(),
  sources: jsonb("sources").$type<RegulationSource[]>(),
  actions: jsonb("actions").$type<RegulationAction[]>()
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

// Update the insert schema to include new jurisdiction validation
export const insertRegulationSchema = createInsertSchema(regulations).extend({
  name: z.string().min(1, "Regulation name is required"),
  dro: z.string().email("DRO must be a valid email address").optional(),
  jurisdictionSource: z.enum(JURISDICTION_SOURCES),
  applicableInstitutions: z.array(z.enum(INSTITUTION_TYPES)).optional().nullable(),
  stateCode: z.string().optional(),
  stateAgency: z.string().optional(),
  originationDate: z.date().optional().nullable(),
  effectiveDate: z.date().optional().nullable(),
  nextReviewDate: z.date().optional().nullable(),
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
  notificationOverride: z.object({
    email: z.string().email("Invalid email").optional().nullable(),
    phone: z.string().regex(/^\+?[\d\s-()]+$/, "Invalid phone number").optional().nullable(),
  }).optional().nullable(),
  sections: z.array(z.object({
    title: z.string(),
    content: z.string(),
    identifiers: z.array(z.string()).optional(),
  })).optional().nullable(),
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
export const insertNotificationSchema = createInsertSchema(notifications);

// Schema for inserting deadlines
export const insertDeadlineSchema = createInsertSchema(deadlines);

// Schema for inserting guides
export const insertGuideSchema = createInsertSchema(guides).extend({
  content: z.string().min(1, "Guide content cannot be empty"),
  category: z.enum(["submission", "compliance", "general"]),
});

// Add after other insert schemas
export const insertEvidenceFileSchema = createInsertSchema(evidenceFiles).extend({
  isOfficial: z.boolean().default(false),
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

// Table for regulation updates
export const regulationUpdates = pgTable("regulation_updates", {
  id: serial("id").primaryKey(),
  regulationId: integer("regulation_id").notNull().references(() => regulations.id),
  name: text("name").notNull(),
  originalContent: text("original_content").notNull(),
  updatedContent: text("updated_content").notNull(),
  requirements: text("requirements"), // New field for AI-generated requirements
  status: text("status").notNull().default("pending"),
  updateDate: timestamp("update_date").notNull().defaultNow(),
  signature: text("signature"),
  userId: integer("user_id").references(() => users.id),
  rejectionReason: text("rejection_reason"),
  processedAt: timestamp("processed_at"),
  metadata: jsonb("metadata").$type<{
    federal_register_enhancement?: {
      attempted: boolean;
      successful: boolean;
      contexts_found?: number;
      total_documents_referenced?: number;
      error?: string;
      fallback_used?: boolean;
      contexts?: Array<{
        document_number: string;
        title: string;
        publication_date: string;
        type: string;
        abstract: string;
        full_text: string;
        url: string;
        cached?: boolean;
      }>;
      all_documents?: Array<{
        document_number: string;
        title: string;
        publication_date: string;
        type: string;
        abstract: string;
        url: string;
      }>;
    };
    processing_metadata?: {
      processed_at: string;
      enhancement_attempted: boolean;
      enhancement_successful: boolean;
    };
    source_attribution?: string;
    submission_guidelines?: string;
    enhanced_summary?: string;
  }>(), // Federal Register enhancement metadata
});

// Schema for inserting regulation updates
export const insertRegulationUpdateSchema = createInsertSchema(regulationUpdates).extend({
  status: z.enum(["pending", "accepted", "rejected", "deferred"]).default("pending"),
  signature: z.string().optional(),
  rejectionReason: z.string().optional(),
  requirements: z.string().optional().nullable(),
});

// Types for regulation updates
export type RegulationUpdate = typeof regulationUpdates.$inferSelect;
export type InsertRegulationUpdate = z.infer<typeof insertRegulationUpdateSchema>;

// MCP Integration Tables
export const regulationVersions = pgTable("regulation_versions", {
  id: serial("id").primaryKey(),
  regulationId: integer("regulation_id").notNull().references(() => regulations.id),
  versionNumber: integer("version_number").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: integer("created_by").references(() => users.id),
  source: text("source").notNull().default("local"), // 'local', 'mcp', 'import'
  sourceId: text("source_id"), // ID from external system if applicable
  validationStatus: jsonb("validation_status").$type<MCPValidationResult[]>(),
});

export const validationStatus = pgTable("validation_status", {
  id: serial("id").primaryKey(),
  regulationId: integer("regulation_id").notNull().references(() => regulations.id),
  versionId: integer("version_id").references(() => regulationVersions.id),
  level: text("level").notNull(), // ValidationLevel enum value
  status: text("status").notNull(), // 'passed', 'failed', 'pending', 'in_progress'
  details: jsonb("details").$type<{
    errors: Array<{
      field: string;
      message: string;
      code: string;
      severity: 'warning' | 'error' | 'critical';
    }>;
  }>(),
  validatedAt: timestamp("validated_at").notNull().defaultNow(),
  validatedBy: integer("validated_by").references(() => users.id),
});

export const syncControl = pgTable("sync_control", {
  id: serial("id").primaryKey(),
  regulationId: integer("regulation_id").notNull().references(() => regulations.id),
  lastSyncAttempt: timestamp("last_sync_attempt"),
  lastSuccessfulSync: timestamp("last_successful_sync"),
  syncErrors: jsonb("sync_errors").$type<Array<{
    timestamp: Date;
    message: string;
    code: string;
  }>>(),
  nextScheduledSync: timestamp("next_scheduled_sync"),
  syncState: text("sync_state").notNull().default("idle"), // 'idle', 'in_progress', 'failed', 'completed'
  syncSettings: jsonb("sync_settings").$type<{
    frequency: 'hourly' | 'daily' | 'weekly' | 'manual';
    priority: 'high' | 'normal' | 'low';
    includeContent: boolean;
    validateOnSync: boolean;
  }>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const notificationQueue = pgTable("notification_queue", {
  id: serial("id").primaryKey(),
  regulationId: integer("regulation_id").notNull().references(() => regulations.id),
  userId: integer("user_id").references(() => users.id),
  type: text("type").notNull(), // 'sync_complete', 'validation_failed', 'version_conflict', etc.
  content: jsonb("content").notNull(),
  status: text("status").notNull().default("pending"), // 'pending', 'sent', 'failed'
  createdAt: timestamp("created_at").notNull().defaultNow(),
  sentAt: timestamp("sent_at"),
  priority: text("priority").notNull().default("normal"), // 'high', 'normal', 'low'
  retryCount: integer("retry_count").notNull().default(0),
  nextRetryAt: timestamp("next_retry_at"),
});

export const versionConflicts = pgTable("version_conflicts", {
  id: serial("id").primaryKey(),
  regulationId: integer("regulation_id").notNull().references(() => regulations.id),
  localVersionId: integer("local_version_id").references(() => regulationVersions.id),
  remoteVersionId: text("remote_version_id").notNull(), // ID from MCP system
  conflicts: jsonb("conflicts").$type<MCPVersionConflict[]>(),
  status: text("status").notNull().default("pending"), // 'pending', 'resolved', 'rejected'
  resolutionMethod: text("resolution_method"), // 'auto', 'manual'
  resolvedAt: timestamp("resolved_at"),
  resolvedBy: integer("resolved_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Create insert schemas for MCP integration tables
export const insertRegulationVersionSchema = createInsertSchema(regulationVersions).extend({
  validationStatus: z.array(z.object({
    level: z.nativeEnum(ValidationLevel),
    passed: z.boolean(),
    errors: z.array(z.object({
      field: z.string(),
      message: z.string(),
      code: z.string(),
      severity: z.enum(['warning', 'error', 'critical'])
    })),
    validatedAt: z.date(),
    validatedBy: z.number().optional()
  })).optional().nullable()
});

export const insertValidationStatusSchema = createInsertSchema(validationStatus).extend({
  level: z.nativeEnum(ValidationLevel),
  status: z.enum(['passed', 'failed', 'pending', 'in_progress']),
  details: z.object({
    errors: z.array(z.object({
      field: z.string(),
      message: z.string(),
      code: z.string(),
      severity: z.enum(['warning', 'error', 'critical'])
    }))
  }).optional().nullable()
});

export const insertSyncControlSchema = createInsertSchema(syncControl).extend({
  syncState: z.enum(['idle', 'in_progress', 'failed', 'completed']).default('idle'),
  syncSettings: z.object({
    frequency: z.enum(['hourly', 'daily', 'weekly', 'manual']).default('daily'),
    priority: z.enum(['high', 'normal', 'low']).default('normal'),
    includeContent: z.boolean().default(true),
    validateOnSync: z.boolean().default(true)
  }).optional().nullable()
});

export const insertNotificationQueueSchema = createInsertSchema(notificationQueue).extend({
  type: z.enum([
    'sync_complete', 
    'validation_failed', 
    'version_conflict', 
    'approval_needed',
    'sync_error',
    'change_detected'
  ]),
  status: z.enum(['pending', 'sent', 'failed']).default('pending'),
  priority: z.enum(['high', 'normal', 'low']).default('normal')
});

export const insertVersionConflictSchema = createInsertSchema(versionConflicts).extend({
  status: z.enum(['pending', 'resolved', 'rejected']).default('pending'),
  resolutionMethod: z.enum(['auto', 'manual']).optional(),
  conflicts: z.array(z.object({
    field: z.string(),
    localValue: z.string(),
    remoteValue: z.string(),
    resolutionStrategy: z.enum(['local', 'remote', 'merge', 'manual']),
    resolvedValue: z.string().optional(),
    resolvedBy: z.number().optional(),
    resolvedAt: z.date().optional()
  })).optional().nullable()
});

// Export types for MCP integration
export type RegulationVersion = typeof regulationVersions.$inferSelect;
export type InsertRegulationVersion = z.infer<typeof insertRegulationVersionSchema>;

export type ValidationStatus = typeof validationStatus.$inferSelect;
export type InsertValidationStatus = z.infer<typeof insertValidationStatusSchema>;

export type SyncControl = typeof syncControl.$inferSelect;
export type InsertSyncControl = z.infer<typeof insertSyncControlSchema>;

export type NotificationQueue = typeof notificationQueue.$inferSelect;
export type InsertNotificationQueue = z.infer<typeof insertNotificationQueueSchema>;

export type VersionConflict = typeof versionConflicts.$inferSelect;
export type InsertVersionConflict = z.infer<typeof insertVersionConflictSchema>;

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
  structuredData: jsonb("structured_data").$type<Record<string, unknown>>(),
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

// ===== SINGLE-TENANT ARCHITECTURE =====
// Single-tenant configuration is handled via environment variables and config files
// No tenant tables needed for single-tenant deployment