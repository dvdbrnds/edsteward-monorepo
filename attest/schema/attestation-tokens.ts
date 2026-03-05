/**
 * Regulation-Level Attestation Tokens Schema
 * 
 * From: shared/schema.ts (lines 1107-1141)
 * Table: attestation_tokens
 * 
 * Used by the regulation-level attestation flow (/api/attestation/send).
 * Tracks one-click email attestation requests for entire regulations.
 */

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
