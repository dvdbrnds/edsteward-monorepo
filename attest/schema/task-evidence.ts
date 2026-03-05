/**
 * Task Evidence Schema
 * 
 * From: shared/schema.ts (lines 1246-1279)
 * Table: task_evidence
 * 
 * Stores evidence uploads for compliance tasks. Evidence can be uploaded
 * by authenticated users OR by external users via magic link attestation tokens.
 * Supports both file uploads and link-type evidence.
 */

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
