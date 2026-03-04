import { pgTable, text, serial, integer, timestamp, boolean, date, jsonb } from "drizzle-orm/pg-core";
import { index } from "drizzle-orm/pg-core";
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
 
export enum ValidationLevel {
  // Basic structural validation
  A = "A",
  // Content-level validation  
  B = "B", 
  // Business rules validation
  C = "C",
  // Contextual/cross-reference validation
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

// Strong password validation for new accounts and password changes (HECVAT PROD-03)
export const strongPasswordSchema = z.string()
  .min(12, "Password must be at least 12 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

// Login schema - only validates that credentials are provided, NOT password strength
// (existing users may have older passwords that don't meet new requirements)
export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

// Schema for inserting users
export const insertUserSchema = createInsertSchema(users).extend({
  password: strongPasswordSchema
    .optional(), // Optional because SAML users won't have password
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

// Note history table for tracking modifications
export const noteHistory = pgTable("note_history", {
  id: serial("id").primaryKey(),
  noteId: integer("note_id").notNull(),
  userId: integer("user_id").notNull(), // Who made the change
  action: text("action").notNull(), // 'created', 'updated', 'deleted'
  previousTitle: text("previous_title"),
  previousContent: text("previous_content"),
  previousCategory: text("previous_category"),
  previousIsPrivate: boolean("previous_is_private"),
  newTitle: text("new_title"),
  newContent: text("new_content"),
  newCategory: text("new_category"),
  newIsPrivate: boolean("new_is_private"),
  changeReason: text("change_reason"), // Optional reason for the change
  createdAt: timestamp("created_at").notNull().defaultNow(),
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
  // Notification override fields
  notificationsDisabled: boolean("notifications_disabled").notNull().default(false),
  notificationsDisabledBy: integer("notifications_disabled_by").references(() => users.id),
  notificationsDisabledAt: timestamp("notifications_disabled_at"),
  notificationsDisabledReason: text("notifications_disabled_reason"),
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
  actions: jsonb("actions").$type<RegulationAction[]>(),
  // Owner/assignment field - compliance officer responsible for this regulation
  ownerId: integer("owner_id").references(() => users.id),
  // Responsible office (field compliance office)
  responsibleOffice: text("responsible_office"),
  responsibleOfficeEmail: text("responsible_office_email"),
  // Escalation target (supervisor/VP for escalations)
  escalationTarget: text("escalation_target"),
  escalationEmail: text("escalation_email"),
  // MCP Engine integration fields
  lovvLevel: text("lovv_level"), // L.O.V.V. validation level: A, B, C, D
  lastValidated: timestamp("last_validated", { withTimezone: true }),
  versionHash: text("version_hash"), // SHA-256 hash of content for change detection
  stateCode: text("state_code"), // Two-letter state code for state regulations (PA, NJ, etc.)
  countryCode: text("country_code"), // Two-letter country code (US, GB, etc.)
  sourceUrl: text("source_url"), // Original source URL for the regulation
  // Category normalization fields
  originalCategory: text("original_category"), // Preserves the original category from source
  canonicalCategoryId: integer("canonical_category_id"), // FK to canonical_categories
  // Universal Regulation Key (MCP Engine alignment)
  regKey: text("reg_key").unique(), // Universal key REG-001 to REG-251, ordered by risk score
  riskScore: integer("risk_score"), // Institutional risk score 1-100
  riskLevel: text("risk_level"), // CRITICAL, SEVERE, HIGH, MODERATE, LOW
  // MCP Engine expanded fields (Feb 2026 schema alignment)
  publicLaw: text("public_law"), // e.g., "Public Law 101-542"
  purpose: text("purpose"), // Regulation purpose statement
  scope: text("scope"), // Regulation scope description
  reportingRequirements: jsonb("reporting_requirements"), // Structured reporting requirements
  riskAssessment: jsonb("risk_assessment"), // Full risk assessment object from MCP
});

// Canonical Categories - the 15 master categories
export const canonicalCategories = pgTable("canonical_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  icon: text("icon"),
  color: text("color"),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Category Mappings - maps incoming categories to canonical
export const categoryMappings = pgTable("category_mappings", {
  id: serial("id").primaryKey(),
  incomingCategory: text("incoming_category").notNull().unique(),
  canonicalCategoryId: integer("canonical_category_id").references(() => canonicalCategories.id),
  source: text("source"), // Where this mapping came from (e.g., 'PA-DOE', 'federal', 'manual')
  confidence: text("confidence").default("1.00"), // Confidence score for auto-mappings
  isVerified: boolean("is_verified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
  description: text("description"),
  isDefault: boolean("is_default").default(false),
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

// Note history types
export type NoteHistory = typeof noteHistory.$inferSelect;
export type InsertNoteHistory = typeof noteHistory.$inferInsert;

// Note categories enum
export const NOTE_CATEGORIES = ["general", "compliance", "legal", "technical", "administrative", "deadline", "evidence", "review"] as const;

// Notes insertion schema with detailed logging
console.log("Creating note insertion schema with validation rules");
export const insertNoteSchema = createInsertSchema(notes).extend({
  regulationId: z.number().positive("Regulation ID must be a positive number"),
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  category: z.enum(NOTE_CATEGORIES).default("general"),
}).omit({
  userId: true, // userId is added server-side from authenticated user
  id: true,     // id is auto-generated
  createdAt: true, // createdAt is auto-generated
  updatedAt: true, // updatedAt is auto-generated
  isPrivate: true, // All notes are public by design
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
  stateCode: z.string().max(2).optional(),
  countryCode: z.string().max(2).optional(),
  stateAgency: z.string().optional(),
  // MCP Engine integration fields
  lovvLevel: z.enum(['A', 'B', 'C', 'D']).optional().nullable(),
  lastValidated: z.date().optional().nullable(),
  versionHash: z.string().max(64).optional().nullable(),
  sourceUrl: z.string().url().optional().nullable(),
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
      enabled: false,  // Only enable when regulation actually requires agency filing
      required: false,
      status: 'pending'
    }
  ])
});

// Schema for inserting notifications
export const insertNotificationSchema = createInsertSchema(notifications);

// Schema for inserting deadlines
export const insertDeadlineSchema = createInsertSchema(deadlines).omit({
  id: true, // id is auto-generated
});

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

// Table for regulation updates
export const regulationUpdates = pgTable("regulation_updates", {
  id: serial("id").primaryKey(),
  regulationId: integer("regulation_id").notNull().references(() => regulations.id),
  name: text("name").notNull(),
  originalContent: text("original_content"),
  updatedContent: text("updated_content"),
  requirements: text("requirements"), // AI-generated compliance requirements
  summary: text("summary"), // Brief summary of the regulation
  filingDeadlines: text("filing_deadlines"), // Deadlines for filing/reporting
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
    // Executive Orders affecting this regulation (MCP Engine sync Jan 2026)
    executiveOrders?: Array<{
      eoNumber: string;
      title: string;
      signedDate: string;
      status?: string;
      president?: string;
      term?: string;
      fullTextUrl?: string;
      impactType: string;
      impactSeverity: string;
      impactSummary?: string;
      confidenceScore?: number;
      affectedSections?: string[];
      complianceDeadline?: string;
      actionRequired?: string;
    }>;
    eo_count?: number;
    eo_critical_count?: number;
    // Expanded regulation fields (Feb 2026 schema alignment)
    regulationFields?: Record<string, any>;
  }>(), // Federal Register and Executive Order metadata
  // Pending compliance tasks to be applied on approval (MCP Engine sync)
  pendingTasks: jsonb("pending_tasks").$type<Array<Record<string, any>>>(),
  // Complete MCP Engine payload — stored verbatim for CCO review (Feb 2026)
  mcpPayload: jsonb("mcp_payload").$type<Record<string, any>>(),
});

// Schema for inserting regulation updates
// Note: regulationId is made optional here because API accepts regKey/itemId and resolves internally
// Schema for compliance task in regulation update (MCP Engine sync)
const pendingTaskSchema = z.object({
  tempId: z.string().optional(),
  parentTempId: z.string().optional().nullable(),
  taskId: z.string().optional(),
  title: z.string(),
  description: z.string().optional(),
  instructions: z.string().optional(),
  category: z.string().optional(),
  statutoryRole: z.string().optional(),
  statutoryCitation: z.string().optional(),
  assignedRole: z.string().optional(),
  priority: z.string().optional(),                 // Any priority string (critical, high, medium, low)
  requirementType: z.string().optional(),           // Any type (requirement, recommendation, best-practice, best_practice)
  dueDate: z.string().optional(),
  recurringSchedule: z.string().optional(),
  reminderDays: z.number().optional(),
  evidenceRequired: z.boolean().optional(),
  evidenceType: z.string().optional(),
  evidenceInstructions: z.string().optional(),
  estimatedEffort: z.string().optional(),
  deliverable: z.string().optional(),
  deliverableTemplateUrl: z.string().optional(),
  sortOrder: z.number().optional(),
  source: z.string().optional(),                    // "rules-engine", "llm-extractor", "manual"
}).passthrough();

export const insertRegulationUpdateSchema = createInsertSchema(regulationUpdates).extend({
  regulationId: z.number().optional(), // API resolves from regKey/itemId
  regKey: z.string().optional(), // Universal key (REG-001) - PREFERRED identifier
  mcpRegKey: z.string().optional(), // Alias for regKey
  itemId: z.string().optional(), // Slug-based ID fallback
  status: z.enum(["pending", "accepted", "rejected", "deferred"]).default("pending"),
  signature: z.string().optional(),
  rejectionReason: z.string().optional(),
  originalContent: z.string().optional().nullable(), // Now optional — MCP Engine may not send
  updatedContent: z.string().optional().nullable(),   // Now optional — MCP Engine may not send
  requirements: z.union([z.string(), z.array(z.any())]).optional().nullable(),
  filingDeadlines: z.any().optional().nullable(),     // Accept string, array, or object
  // Compliance tasks to be applied on approval (MCP Engine sync)
  complianceTasks: z.array(pendingTaskSchema).optional(),
  // Executive Orders
  executiveOrders: z.array(z.any()).optional(),
  // Risk assessment
  riskScore: z.number().optional().nullable(),
  riskLevel: z.string().optional().nullable(),
  riskAssessment: z.any().optional().nullable(),
  // Additional MCP Engine fields — accept and passthrough
  relatedRegulations: z.any().optional(),
  applicableForms: z.any().optional(),
  sections: z.any().optional(),
  mcpEngineTimestamp: z.string().optional(),
  lovvLevel: z.string().optional().nullable(),
  agencyDepartment: z.string().optional().nullable(),
  regulationUrl: z.string().optional().nullable(),
  applicableInstitutions: z.any().optional().nullable(),
  reportingRequirements: z.any().optional().nullable(),
  submissionGuidelines: z.string().optional().nullable(),
  reportingFrequency: z.string().optional().nullable(),
}).passthrough();

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

// Audit Logs table for compliance action tracking
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  entityType: text("entity_type").notNull(), // 'regulation_action', 'deadline', 'note', etc.
  entityId: text("entity_id").notNull(), // ID of the entity being audited
  action: text("action").notNull(), // 'create', 'update', 'delete', 'view'
  userId: integer("user_id").references(() => users.id),
  userEmail: text("user_email"), // Backup in case user is deleted
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  
  // Change tracking
  previousValues: jsonb("previous_values").$type<Record<string, any>>(),
  newValues: jsonb("new_values").$type<Record<string, any>>(),
  changes: jsonb("changes").$type<Record<string, { old: any; new: any }>>(),
  
  // Context and metadata
  regulationId: integer("regulation_id").references(() => regulations.id), // For regulation-related actions
  sessionId: text("session_id"), // Session identifier
  requestId: text("request_id"), // Request tracking ID
  metadata: jsonb("metadata").$type<Record<string, any>>(), // Additional context
  
  // Compliance specific fields
  complianceImpact: text("compliance_impact"), // 'high', 'medium', 'low'
  riskLevel: text("risk_level"), // 'critical', 'high', 'medium', 'low'
  
}, (table) => {
  return {
    entityTypeIdx: index("audit_logs_entity_type_idx").on(table.entityType),
    entityIdIdx: index("audit_logs_entity_id_idx").on(table.entityId),
    userIdIdx: index("audit_logs_user_id_idx").on(table.userId),
    timestampIdx: index("audit_logs_timestamp_idx").on(table.timestamp),
    regulationIdIdx: index("audit_logs_regulation_id_idx").on(table.regulationId),
    actionIdx: index("audit_logs_action_idx").on(table.action),
  };
});

// Schema for inserting audit logs
export const insertAuditLogSchema = createInsertSchema(auditLogs).extend({
  entityType: z.string(),
  entityId: z.string(),
  action: z.enum(['create', 'update', 'delete', 'view']),
  userId: z.number().optional(),
  userEmail: z.string().optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  previousValues: z.record(z.string(), z.any()).optional(),
  newValues: z.record(z.string(), z.any()).optional(),
  changes: z.record(z.string(), z.object({ old: z.any(), new: z.any() })).optional(),
  regulationId: z.number().optional(),
  sessionId: z.string().optional(),
  requestId: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  complianceImpact: z.enum(['high', 'medium', 'low']).optional(),
  riskLevel: z.enum(['critical', 'high', 'medium', 'low']).optional(),
});

// Add to the type exports
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;

// ===== ATTESTATION TOKENS =====
// Email-based attestation tokens for one-click compliance attestations
export const attestationTokens = pgTable("attestation_tokens", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  regulationId: integer("regulation_id").notNull().references(() => regulations.id),
  userId: integer("user_id").references(() => users.id), // May be null for manual email
  email: text("email").notNull(), // Target email address
  attestationType: text("attestation_type").notNull().default('annual'), // quarterly, annual, etc.
  attestationStatement: text("attestation_statement").notNull(),
  attestationPeriod: text("attestation_period"), // e.g., "Q4 2025", "FY 2025"
  
  // Token lifecycle
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  completedAt: timestamp("completed_at"), // null until used
  
  // Completion tracking
  completedByName: text("completed_by_name"),
  completedByEmail: text("completed_by_email"),
  completedByIp: text("completed_by_ip"),
  
  // Metadata
  sentBy: integer("sent_by").references(() => users.id), // Admin who sent the request
  metadata: jsonb("metadata").$type<Record<string, any>>(),
}, (table) => {
  return {
    tokenIdx: index("attestation_tokens_token_idx").on(table.token),
    regulationIdIdx: index("attestation_tokens_regulation_id_idx").on(table.regulationId),
    userIdIdx: index("attestation_tokens_user_id_idx").on(table.userId),
    expiresAtIdx: index("attestation_tokens_expires_at_idx").on(table.expiresAt),
  };
});

export const insertAttestationTokenSchema = createInsertSchema(attestationTokens);
export type AttestationToken = typeof attestationTokens.$inferSelect;
export type InsertAttestationToken = z.infer<typeof insertAttestationTokenSchema>;

// ===== COMPLIANCE TASKS =====
// Hierarchical task management for complex regulations (e.g., Clery Act)
// Supports sub-tasks, per-task DRIs, flexible evidence requirements

export const TASK_STATUS = ['pending', 'in_progress', 'completed', 'overdue', 'blocked', 'not_applicable'] as const;
export const EVIDENCE_TYPE = ['none', 'document', 'link', 'screenshot', 'attestation', 'form'] as const;
export const TASK_PRIORITY = ['low', 'medium', 'high', 'critical'] as const;
export const REQUIREMENT_TYPE = ['requirement', 'best_practice'] as const;
export const ATTESTATION_STATUS = ['not_required', 'pending', 'attested', 'rejected'] as const;

export type TaskStatus = typeof TASK_STATUS[number];
export type EvidenceType = typeof EVIDENCE_TYPE[number];
export type TaskPriority = typeof TASK_PRIORITY[number];
export type RequirementType = typeof REQUIREMENT_TYPE[number];
export type AttestationStatus = typeof ATTESTATION_STATUS[number];

export const complianceTasks = pgTable("compliance_tasks", {
  id: serial("id").primaryKey(),
  regulationId: integer("regulation_id").notNull().references(() => regulations.id),
  parentTaskId: integer("parent_task_id"), // Self-reference for sub-tasks (can't use references() for self-ref)
  
  // Task identification
  taskId: text("task_id"), // Unique task identifier (e.g., GLBA-001, OSHA-005)
  
  // Task details
  title: text("title").notNull(),
  description: text("description"),
  instructions: text("instructions"), // Detailed instructions for completing the task
  
  // Task categorization - from MCP Engine sync (Jan 2026)
  category: text("category"), // Task category for grouping (e.g., "Coordinator Requirements", "Training", "Documentation")
  requirementType: text("requirement_type").default('requirement'), // 'requirement' = legally mandated, 'best_practice' = recommended
  
  // Statutory requirement (Jan 2026) - who is legally required to do this task
  statutoryRole: text("statutory_role"), // Role legally required by regulation (e.g., "Title IX Coordinator" per 34 CFR 106.8)
  statutoryCitation: text("statutory_citation"), // Legal citation for the requirement (e.g., "34 CFR 106.8")
  
  // Assignment
  assignedTo: integer("assigned_to").references(() => users.id), // DRI for this specific task
  assignedRole: text("assigned_role"), // Suggested role for default assignment (may differ from statutoryRole)
  
  // Scheduling
  dueDate: timestamp("due_date"),
  recurringSchedule: text("recurring_schedule"), // 'annual', 'quarterly', 'monthly', 'daily', or cron expression
  reminderDays: integer("reminder_days").default(30), // Days before due date to send reminders
  
  // Status tracking
  status: text("status").notNull().default('pending'),
  priority: text("priority").default('medium'),
  completedAt: timestamp("completed_at"),
  completedBy: integer("completed_by").references(() => users.id),
  
  // Attestation workflow (Jan 2026) - DRI signs off on task completion
  attestedAt: timestamp("attested_at"), // When DRI attested to completion
  attestedBy: integer("attested_by").references(() => users.id), // DRI who attested
  attestationSignature: text("attestation_signature"), // Digital signature text
  attestationNotes: text("attestation_notes"), // Optional notes from DRI
  attestationStatus: text("attestation_status").default('not_required'), // 'not_required', 'pending', 'attested', 'rejected'
  
  // Evidence requirements
  evidenceRequired: boolean("evidence_required").default(false),
  evidenceType: text("evidence_type").default('none'), // What kind of evidence is needed
  evidenceInstructions: text("evidence_instructions"), // Specific guidance on what to upload
  // MCP Engine expanded task fields (Feb 2026 schema alignment)
  estimatedEffort: text("estimated_effort"), // e.g., "2-4 hours", "1 week"
  deliverable: text("deliverable"), // Expected output description
  deliverableTemplateUrl: text("deliverable_template_url"), // Link to template document
  
  // Ordering and display
  sortOrder: integer("sort_order").default(0),
  isTemplate: boolean("is_template").default(false), // Template tasks for regulation setup
  
  // Escalation path - who to escalate to if task is overdue/blocked
  escalationEmail: text("escalation_email"), // Email address for escalation
  escalationName: text("escalation_name"), // Name/title of escalation contact (e.g., "VP of Student Affairs")
  
  // Metadata
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdBy: integer("created_by").references(() => users.id),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
}, (table) => {
  return {
    regulationIdIdx: index("compliance_tasks_regulation_id_idx").on(table.regulationId),
    parentTaskIdIdx: index("compliance_tasks_parent_task_id_idx").on(table.parentTaskId),
    assignedToIdx: index("compliance_tasks_assigned_to_idx").on(table.assignedTo),
    statusIdx: index("compliance_tasks_status_idx").on(table.status),
    dueDateIdx: index("compliance_tasks_due_date_idx").on(table.dueDate),
  };
});

export const insertComplianceTaskSchema = createInsertSchema(complianceTasks).extend({
  title: z.string().min(1, "Title is required"),
  status: z.enum(TASK_STATUS).default('pending'),
  evidenceType: z.enum(EVIDENCE_TYPE).default('none'),
  priority: z.enum(TASK_PRIORITY).default('medium'),
  requirementType: z.enum(REQUIREMENT_TYPE).default('requirement'),
  attestationStatus: z.enum(ATTESTATION_STATUS).default('not_required'),
});

export type ComplianceTask = typeof complianceTasks.$inferSelect;
export type InsertComplianceTask = z.infer<typeof insertComplianceTaskSchema>;

// ===== TASK EVIDENCE =====
// Evidence uploads for compliance tasks
export const taskEvidence = pgTable("task_evidence", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => complianceTasks.id),
  
  // File details
  fileName: text("file_name").notNull(),
  fileType: text("file_type"), // MIME type
  fileSize: integer("file_size"), // bytes
  fileUrl: text("file_url"), // S3 or local path
  
  // For link-type evidence
  linkUrl: text("link_url"),
  linkTitle: text("link_title"),
  
  // Metadata
  description: text("description"),
  uploadedBy: integer("uploaded_by").notNull().references(() => users.id),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  
  // Verification (for audit purposes)
  verified: boolean("verified").default(false),
  verifiedBy: integer("verified_by").references(() => users.id),
  verifiedAt: timestamp("verified_at"),
}, (table) => {
  return {
    taskIdIdx: index("task_evidence_task_id_idx").on(table.taskId),
  };
});

export const insertTaskEvidenceSchema = createInsertSchema(taskEvidence);
export type TaskEvidence = typeof taskEvidence.$inferSelect;
export type InsertTaskEvidence = z.infer<typeof insertTaskEvidenceSchema>;

// ===== TASK ATTESTATION TOKENS (Magic Links) =====
// Secure tokens for field compliance officers to attest/upload evidence via email link
export const taskAttestationTokens = pgTable("task_attestation_tokens", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => complianceTasks.id),
  
  // Token for secure access
  token: text("token").notNull().unique(), // UUID or secure random string
  
  // Who the token is for
  email: text("email").notNull(), // Email address the link was sent to
  recipientName: text("recipient_name"), // Name of field compliance officer
  
  // Token validity
  expiresAt: timestamp("expires_at").notNull(), // Typically 7 days from creation
  usedAt: timestamp("used_at"), // When the token was used (for attestation)
  
  // What actions are allowed
  canUploadEvidence: boolean("can_upload_evidence").default(true),
  canAttest: boolean("can_attest").default(true),
  
  // Audit trail
  createdAt: timestamp("created_at").notNull().defaultNow(),
  createdBy: integer("created_by").references(() => users.id), // Who sent the link
  
  // Optional message to include in email
  personalMessage: text("personal_message"),
}, (table) => {
  return {
    tokenIdx: index("task_attestation_tokens_token_idx").on(table.token),
    taskIdIdx: index("task_attestation_tokens_task_id_idx").on(table.taskId),
    emailIdx: index("task_attestation_tokens_email_idx").on(table.email),
  };
});

export const insertTaskAttestationTokenSchema = createInsertSchema(taskAttestationTokens);
export type TaskAttestationToken = typeof taskAttestationTokens.$inferSelect;
export type InsertTaskAttestationToken = z.infer<typeof insertTaskAttestationTokenSchema>;

// ===== ROLE ASSIGNMENTS (Jan 2026) =====
// Map suggested roles to default DRIs for automatic task assignment
// Example: "Registrar" → john.doe@university.edu
export const roleAssignments = pgTable("role_assignments", {
  id: serial("id").primaryKey(),
  
  // The role name (from MCP Engine suggestions or custom)
  roleName: text("role_name").notNull().unique(), // e.g., "Registrar", "Title IX Coordinator", "Campus Police Chief"
  
  // Display name for UI
  displayName: text("display_name"), // e.g., "Office of the Registrar"
  
  // Default assignee for this role
  defaultUserId: integer("default_user_id").references(() => users.id), // Primary person for this role
  
  // For external assignees (not in system)
  defaultEmail: text("default_email"), // Email if person not in users table
  defaultName: text("default_name"), // Name for display/emails
  
  // Backup/escalation contact
  backupUserId: integer("backup_user_id").references(() => users.id),
  backupEmail: text("backup_email"),
  
  // Category for grouping in UI
  category: text("category"), // e.g., "Academic", "Safety", "Student Affairs", "HR"
  
  // Description of this role's responsibilities
  description: text("description"),
  
  // Whether auto-assignment is enabled for this role
  autoAssignEnabled: boolean("auto_assign_enabled").default(true),
  
  // Audit
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdBy: integer("created_by").references(() => users.id),
  updatedBy: integer("updated_by").references(() => users.id),
}, (table) => {
  return {
    roleNameIdx: index("role_assignments_role_name_idx").on(table.roleName),
    categoryIdx: index("role_assignments_category_idx").on(table.category),
  };
});

export const insertRoleAssignmentSchema = createInsertSchema(roleAssignments).extend({
  roleName: z.string().min(1, "Role name is required"),
});
export type RoleAssignment = typeof roleAssignments.$inferSelect;
export type InsertRoleAssignment = z.infer<typeof insertRoleAssignmentSchema>;

// ===== TASK ACTIVITY LOG =====
// Activity tracking for tasks (comments, status changes, nudges, escalations)
export const TASK_ACTIVITY_TYPE = ['comment', 'status_change', 'assignment_change', 'evidence_uploaded', 'nudge', 'escalation', 'due_date_change'] as const;
export type TaskActivityType = typeof TASK_ACTIVITY_TYPE[number];

export const taskActivity = pgTable("task_activity", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull().references(() => complianceTasks.id),
  userId: integer("user_id").notNull().references(() => users.id),
  
  activityType: text("activity_type").notNull(), // comment, status_change, etc.
  content: text("content"), // Comment text or change description
  
  // For status changes
  previousValue: text("previous_value"),
  newValue: text("new_value"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => {
  return {
    taskIdIdx: index("task_activity_task_id_idx").on(table.taskId),
    createdAtIdx: index("task_activity_created_at_idx").on(table.createdAt),
  };
});

export const insertTaskActivitySchema = createInsertSchema(taskActivity);
export type TaskActivity = typeof taskActivity.$inferSelect;
export type InsertTaskActivity = z.infer<typeof insertTaskActivitySchema>;

// ===== EXECUTIVE ORDERS (MCP Engine Integration - Jan 2026) =====
// Tracks Presidential Executive Orders and their impact on regulations

// EO Status values
export const EO_STATUS = ['active', 'enjoined', 'revoked', 'superseded'] as const;
export type EOStatus = typeof EO_STATUS[number];

// Impact types
export const EO_IMPACT_TYPES = ['modifies', 'reinforces', 'conflicts', 'supersedes'] as const;
export type EOImpactType = typeof EO_IMPACT_TYPES[number];

// Impact severities
export const EO_IMPACT_SEVERITIES = ['critical', 'high', 'medium', 'low'] as const;
export type EOImpactSeverity = typeof EO_IMPACT_SEVERITIES[number];

// Review status for CCO workflow
export const EO_REVIEW_STATUS = ['pending', 'reviewed', 'addressed', 'dismissed'] as const;
export type EOReviewStatus = typeof EO_REVIEW_STATUS[number];

// Executive Orders table
export const executiveOrders = pgTable("executive_orders", {
  id: serial("id").primaryKey(),
  eoNumber: text("eo_number").notNull().unique(),        // e.g., "EO 14322"
  title: text("title").notNull(),
  signedDate: date("signed_date").notNull(),
  publishedDate: date("published_date"),
  status: text("status").notNull().default('active'),    // active, enjoined, revoked, superseded
  president: text("president"),                          // e.g., "Donald Trump"
  term: text("term"),                                    // e.g., "Trump-2", "Biden-1"
  summary: text("summary"),                              // Federal Register abstract
  fullTextUrl: text("full_text_url"),                   // Link to Federal Register
  pdfUrl: text("pdf_url"),
  federalRegisterCitation: text("federal_register_citation"), // e.g., "90 FR 12345"
  topics: text("topics").array(),                        // Array of keywords
  // Court actions
  enjoinedDate: date("enjoined_date"),
  enjoinedBy: text("enjoined_by"),                      // Court that issued injunction
  revokedDate: date("revoked_date"),
  revokedBy: text("revoked_by"),                        // EO number that revoked this
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    statusIdx: index("eo_status_idx").on(table.status),
    signedDateIdx: index("eo_signed_date_idx").on(table.signedDate),
    presidentIdx: index("eo_president_idx").on(table.president),
  };
});

export const insertExecutiveOrderSchema = createInsertSchema(executiveOrders);
export type ExecutiveOrder = typeof executiveOrders.$inferSelect;
export type InsertExecutiveOrder = z.infer<typeof insertExecutiveOrderSchema>;

// EO Regulation Impacts table
export const eoRegulationImpacts = pgTable("eo_regulation_impacts", {
  id: serial("id").primaryKey(),
  eoId: integer("eo_id").notNull().references(() => executiveOrders.id, { onDelete: 'cascade' }),
  regulationId: integer("regulation_id").notNull().references(() => regulations.id, { onDelete: 'cascade' }),
  
  // Impact classification
  impactType: text("impact_type").notNull(),             // modifies, reinforces, conflicts, supersedes
  impactSeverity: text("impact_severity").notNull(),     // critical, high, medium, low
  impactSummary: text("impact_summary"),                 // AI-generated analysis
  affectedSections: jsonb("affected_sections").$type<string[]>(), // Which regulation sections are affected
  
  // Assessment metadata
  assessedBy: text("assessed_by"),                       // "MCP Engine AI" or "Manual Review"
  assessmentDate: date("assessment_date"),
  confidenceScore: text("confidence_score"),             // 0.00-1.00 as text for simplicity
  
  // Review tracking (for CCO workflow)
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewNotes: text("review_notes"),
  reviewStatus: text("review_status").default('pending'), // pending, reviewed, addressed, dismissed
  
  // Auto-generated task reference
  generatedTaskId: integer("generated_task_id").references(() => complianceTasks.id),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => {
  return {
    regulationIdx: index("eori_regulation_idx").on(table.regulationId),
    severityIdx: index("eori_severity_idx").on(table.impactSeverity),
    reviewStatusIdx: index("eori_review_status_idx").on(table.reviewStatus),
    uniqueEoReg: index("eori_unique_idx").on(table.eoId, table.regulationId),
  };
});

export const insertEORegulationImpactSchema = createInsertSchema(eoRegulationImpacts);
export type EORegulationImpact = typeof eoRegulationImpacts.$inferSelect;
export type InsertEORegulationImpact = z.infer<typeof insertEORegulationImpactSchema>;

// EO Status History table
export const eoStatusHistory = pgTable("eo_status_history", {
  id: serial("id").primaryKey(),
  eoId: integer("eo_id").notNull().references(() => executiveOrders.id, { onDelete: 'cascade' }),
  previousStatus: text("previous_status"),
  newStatus: text("new_status").notNull(),
  changeDate: date("change_date").notNull(),
  changeReason: text("change_reason"),                   // e.g., "Enjoined by 5th Circuit Court"
  sourceUrl: text("source_url"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => {
  return {
    eoIdx: index("eo_history_eo_idx").on(table.eoId),
    dateIdx: index("eo_history_date_idx").on(table.changeDate),
  };
});

export const insertEOStatusHistorySchema = createInsertSchema(eoStatusHistory);
export type EOStatusHistory = typeof eoStatusHistory.$inferSelect;
export type InsertEOStatusHistory = z.infer<typeof insertEOStatusHistorySchema>;

// ===== SINGLE-TENANT ARCHITECTURE =====
// Single-tenant configuration is handled via environment variables and config files
// No tenant tables needed for single-tenant deployment