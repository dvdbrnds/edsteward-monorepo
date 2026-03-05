/**
 * Task-Level Attestation Tokens (Magic Links) Schema
 * 
 * From: shared/schema.ts (lines 1281-1318)
 * Table: task_attestation_tokens
 * 
 * Used by the task-level attestation flow (compliance-tasks routes).
 * Secure tokens for field compliance officers to attest/upload evidence via email link.
 */

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
