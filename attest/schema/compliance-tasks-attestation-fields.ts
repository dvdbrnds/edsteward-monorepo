/**
 * Attestation Fields on compliance_tasks Table
 * 
 * From: shared/schema.ts (lines 1195-1200)
 * These fields are part of the complianceTasks table definition.
 * 
 * When a DRI attests to a task via magic link, these fields are populated.
 */

// These fields live on the complianceTasks table (compliance_tasks):

// Attestation workflow (Jan 2026) - DRI signs off on task completion
attestedAt:            timestamp("attested_at"),           // When DRI attested to completion
attestedBy:            integer("attested_by").references(() => users.id), // DRI who attested
attestationSignature:  text("attestation_signature"),      // Digital signature text
attestationNotes:      text("attestation_notes"),          // Optional notes from DRI
attestationStatus:     text("attestation_status").default('not_required'),
  // Possible values: 'not_required', 'pending', 'attested', 'rejected'

// Related constants:
export const ATTESTATION_STATUS = ['not_required', 'pending', 'attested', 'rejected'] as const;
export type AttestationStatus = typeof ATTESTATION_STATUS[number];
