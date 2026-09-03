CREATE TABLE IF NOT EXISTS "attestation_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" text NOT NULL,
	"regulation_id" integer NOT NULL,
	"user_id" integer,
	"email" text NOT NULL,
	"attestation_type" text DEFAULT 'annual' NOT NULL,
	"attestation_statement" text NOT NULL,
	"attestation_period" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"completed_by_name" text,
	"completed_by_email" text,
	"completed_by_ip" text,
	"sent_by" integer,
	"metadata" jsonb,
	CONSTRAINT "attestation_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"action" text NOT NULL,
	"user_id" integer,
	"user_email" text,
	"ip_address" text,
	"user_agent" text,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"previous_values" jsonb,
	"new_values" jsonb,
	"changes" jsonb,
	"regulation_id" integer,
	"session_id" text,
	"request_id" text,
	"metadata" jsonb,
	"compliance_impact" text,
	"risk_level" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "canonical_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"icon" text,
	"color" text,
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "canonical_categories_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "category_mappings" (
	"id" serial PRIMARY KEY NOT NULL,
	"incoming_category" text NOT NULL,
	"canonical_category_id" integer,
	"source" text,
	"confidence" text DEFAULT '1.00',
	"is_verified" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "category_mappings_incoming_category_unique" UNIQUE("incoming_category")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "circuit_interpretations" (
	"id" serial PRIMARY KEY NOT NULL,
	"regulation_id" integer NOT NULL,
	"circuit_number" integer NOT NULL,
	"case_name" text NOT NULL,
	"case_year" integer,
	"case_citation" text,
	"court_level" text DEFAULT 'circuit' NOT NULL,
	"interpretation_type" text NOT NULL,
	"summary" text NOT NULL,
	"compliance_implication" text,
	"affected_requirements" jsonb,
	"impact_severity" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"is_circuit_split" boolean DEFAULT false,
	"split_id" integer,
	"source_url" text,
	"assessed_by" text,
	"confidence_score" text,
	"review_status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" integer,
	"reviewed_at" timestamp,
	"review_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "circuit_splits" (
	"id" serial PRIMARY KEY NOT NULL,
	"regulation_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"affected_circuits" jsonb,
	"scotus_petition_pending" boolean DEFAULT false,
	"scotus_cert_granted" boolean DEFAULT false,
	"scotus_case_info" text,
	"status" text DEFAULT 'active' NOT NULL,
	"resolved_by" text,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "compliance_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"regulation_id" integer NOT NULL,
	"parent_task_id" integer,
	"task_id" text,
	"title" text NOT NULL,
	"description" text,
	"instructions" text,
	"category" text,
	"requirement_type" text DEFAULT 'requirement',
	"statutory_role" text,
	"statutory_citation" text,
	"statutory_language" text,
	"assigned_to" integer,
	"assigned_role" text,
	"responsible_office" text,
	"responsible_office_email" text,
	"due_date" timestamp,
	"recurring_schedule" text,
	"reminder_days" integer DEFAULT 30,
	"status" text DEFAULT 'pending' NOT NULL,
	"priority" text DEFAULT 'medium',
	"completed_at" timestamp,
	"completed_by" integer,
	"attested_at" timestamp,
	"attested_by" integer,
	"attestation_signature" text,
	"attestation_notes" text,
	"attestation_status" text DEFAULT 'not_required',
	"evidence_required" boolean DEFAULT false,
	"evidence_type" text DEFAULT 'none',
	"evidence_instructions" text,
	"is_confidential" boolean DEFAULT false,
	"confidential_data_types" jsonb,
	"external_system_reference" text,
	"estimated_effort" text,
	"deliverable" text,
	"deliverable_template_url" text,
	"sort_order" integer DEFAULT 0,
	"is_template" boolean DEFAULT false,
	"escalation_email" text,
	"escalation_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" integer,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "deadlines" (
	"id" serial PRIMARY KEY NOT NULL,
	"regulation_id" integer NOT NULL,
	"due_date" date NOT NULL,
	"status" text NOT NULL,
	"assigned_to" integer NOT NULL,
	"description" text,
	"is_default" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "demo_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"institution" text NOT NULL,
	"role" text,
	"message" text,
	"status" text DEFAULT 'new' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "disabled_regulations" (
	"id" serial PRIMARY KEY NOT NULL,
	"regulation_id" integer NOT NULL,
	"disabled_by" integer NOT NULL,
	"reason" text,
	"disabled_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_email" text NOT NULL,
	"smtp_host" text NOT NULL,
	"smtp_port" integer NOT NULL,
	"smtp_secure" boolean DEFAULT true NOT NULL,
	"smtp_user" text NOT NULL,
	"smtp_pass" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_delivery_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"recipient_email" text NOT NULL,
	"recipient_user_id" integer,
	"email_type" text DEFAULT 'other' NOT NULL,
	"related_entity_type" text,
	"related_entity_id" integer,
	"subject" text,
	"smtp_message_id" text,
	"status" text DEFAULT 'sent' NOT NULL,
	"smtp_response_code" text,
	"error_message" text,
	"bounce_type" text,
	"escalation_triggered" boolean DEFAULT false NOT NULL,
	"escalation_recipient" text,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"status_updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "eo_regulation_impacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"eo_id" integer NOT NULL,
	"regulation_id" integer NOT NULL,
	"impact_type" text NOT NULL,
	"impact_severity" text NOT NULL,
	"impact_summary" text,
	"affected_sections" jsonb,
	"assessed_by" text,
	"assessment_date" date,
	"confidence_score" text,
	"reviewed_at" timestamp,
	"reviewed_by" integer,
	"review_notes" text,
	"review_status" text DEFAULT 'pending',
	"generated_task_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "eo_status_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"eo_id" integer NOT NULL,
	"previous_status" text,
	"new_status" text NOT NULL,
	"change_date" date NOT NULL,
	"change_reason" text,
	"source_url" text,
	"created_by" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "error_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"transformation_log_id" integer NOT NULL,
	"row_number" integer NOT NULL,
	"raw_data" jsonb NOT NULL,
	"error_type" text NOT NULL,
	"error_message" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "evidence_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"regulation_id" integer NOT NULL,
	"file_name" text NOT NULL,
	"file_size" integer NOT NULL,
	"file_type" text NOT NULL,
	"description" text,
	"uploaded_by" integer NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"storage_path" text NOT NULL,
	"is_official" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "executive_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"eo_number" text NOT NULL,
	"title" text NOT NULL,
	"signed_date" date NOT NULL,
	"published_date" date,
	"status" text DEFAULT 'active' NOT NULL,
	"president" text,
	"term" text,
	"summary" text,
	"full_text_url" text,
	"pdf_url" text,
	"federal_register_citation" text,
	"topics" text[],
	"enjoined_date" date,
	"enjoined_by" text,
	"revoked_date" date,
	"revoked_by" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "executive_orders_eo_number_unique" UNIQUE("eo_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "guides" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"category" text NOT NULL,
	"last_updated" timestamp DEFAULT now(),
	"created_by" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "institution_configurations" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"primary_type" text,
	"characteristics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"state_code" text,
	"hide_non_applicable" boolean DEFAULT true NOT NULL,
	"allow_users_to_toggle" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "institution_configurations_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "note_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"note_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"action" text NOT NULL,
	"previous_title" text,
	"previous_content" text,
	"previous_category" text,
	"previous_is_private" boolean,
	"new_title" text,
	"new_content" text,
	"new_category" text,
	"new_is_private" boolean,
	"change_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"regulation_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"category" text DEFAULT 'general' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"is_private" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_queue" (
	"id" serial PRIMARY KEY NOT NULL,
	"regulation_id" integer NOT NULL,
	"user_id" integer,
	"type" text NOT NULL,
	"content" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"sent_at" timestamp,
	"priority" text DEFAULT 'normal' NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"next_retry_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"regulation_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"type" text NOT NULL,
	"frequency" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"phone_number" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "regulation_feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"regulation_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"feedback_type" text DEFAULT 'other' NOT NULL,
	"feedback_text" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" integer,
	"reviewed_at" timestamp,
	"review_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "regulation_updates" (
	"id" serial PRIMARY KEY NOT NULL,
	"regulation_id" integer NOT NULL,
	"name" text NOT NULL,
	"original_content" text,
	"updated_content" text,
	"requirements" text,
	"summary" text,
	"filing_deadlines" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"update_date" timestamp DEFAULT now() NOT NULL,
	"signature" text,
	"user_id" integer,
	"rejection_reason" text,
	"processed_at" timestamp,
	"metadata" jsonb,
	"pending_tasks" jsonb,
	"mcp_payload" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "regulation_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"regulation_id" integer NOT NULL,
	"version_number" integer NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" integer,
	"source" text DEFAULT 'local' NOT NULL,
	"source_id" text,
	"validation_status" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "regulations" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_id" text NOT NULL,
	"name" text NOT NULL,
	"topic" text NOT NULL,
	"statute" text NOT NULL,
	"statute_ids" text,
	"summary" text,
	"requirements" text,
	"category" text NOT NULL,
	"jurisdiction_source" text DEFAULT 'federal' NOT NULL,
	"applicable_institutions" jsonb,
	"dro" text DEFAULT '' NOT NULL,
	"is_applicable" boolean DEFAULT true NOT NULL,
	"origination_date" timestamp,
	"effective_date" timestamp,
	"last_updated" timestamp,
	"last_verified" timestamp,
	"next_review_date" timestamp,
	"version_number" integer DEFAULT 1 NOT NULL,
	"previous_version_id" integer,
	"version_date" timestamp DEFAULT now() NOT NULL,
	"change_summary" text,
	"is_current" boolean DEFAULT true NOT NULL,
	"version_metadata" jsonb,
	"filing_deadlines" jsonb,
	"reporting_frequency" text,
	"agency_url" text,
	"agency_name" text,
	"agency_contact" text,
	"agency_department" text,
	"regulation_url" text,
	"requirements_url" text,
	"submission_guide_url" text,
	"forms_url" text,
	"submission_guidelines" text,
	"notifications_disabled" boolean DEFAULT false NOT NULL,
	"notifications_disabled_by" integer,
	"notifications_disabled_at" timestamp,
	"notifications_disabled_reason" text,
	"regulation_text" text,
	"applicable_forms" jsonb,
	"related_regulations" jsonb,
	"compliance_notes" text,
	"verification_method" text,
	"notification_schedule" jsonb,
	"notification_override" jsonb,
	"sections" jsonb,
	"sources" jsonb,
	"actions" jsonb,
	"owner_id" integer,
	"responsible_office" text,
	"responsible_office_email" text,
	"escalation_target" text,
	"escalation_email" text,
	"lovv_level" text,
	"last_validated" timestamp with time zone,
	"version_hash" text,
	"state_code" text,
	"country_code" text,
	"source_url" text,
	"original_category" text,
	"canonical_category_id" integer,
	"reg_key" text,
	"risk_score" integer,
	"risk_level" text,
	"public_law" text,
	"purpose" text,
	"scope" text,
	"reporting_requirements" jsonb,
	"risk_assessment" jsonb,
	"bespoke_source" boolean DEFAULT false,
	"penalties" jsonb,
	"responsible_roles" jsonb,
	CONSTRAINT "regulations_reg_key_unique" UNIQUE("reg_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "role_assignments" (
	"id" serial PRIMARY KEY NOT NULL,
	"role_name" text NOT NULL,
	"display_name" text,
	"office_name" text,
	"office_email" text,
	"default_user_id" integer,
	"default_email" text,
	"default_name" text,
	"backup_user_id" integer,
	"backup_email" text,
	"category" text,
	"description" text,
	"auto_assign_enabled" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" integer,
	"updated_by" integer,
	CONSTRAINT "role_assignments_role_name_unique" UNIQUE("role_name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sync_control" (
	"id" serial PRIMARY KEY NOT NULL,
	"regulation_id" integer NOT NULL,
	"last_sync_attempt" timestamp,
	"last_successful_sync" timestamp,
	"sync_errors" jsonb,
	"next_scheduled_sync" timestamp,
	"sync_state" text DEFAULT 'idle' NOT NULL,
	"sync_settings" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "system_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"facility" integer NOT NULL,
	"severity" integer NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"hostname" text NOT NULL,
	"app_name" text NOT NULL,
	"proc_id" text NOT NULL,
	"msg_id" text,
	"structured_data" jsonb,
	"message" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task_activity" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"activity_type" text NOT NULL,
	"content" text,
	"previous_value" text,
	"new_value" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task_attestation_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"token" text NOT NULL,
	"email" text NOT NULL,
	"recipient_name" text,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"can_upload_evidence" boolean DEFAULT true,
	"can_attest" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"created_by" integer,
	"personal_message" text,
	CONSTRAINT "task_attestation_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "task_evidence" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_id" integer NOT NULL,
	"file_name" text NOT NULL,
	"file_type" text,
	"file_size" integer,
	"file_url" text,
	"link_url" text,
	"link_title" text,
	"description" text,
	"uploaded_by" integer NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"verified" boolean DEFAULT false,
	"verified_by" integer,
	"verified_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "transformation_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"schema_id" integer NOT NULL,
	"file_name" text NOT NULL,
	"status" text NOT NULL,
	"records_processed" integer NOT NULL,
	"records_failed" integer NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "twilio_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"account_sid" text NOT NULL,
	"auth_token" text NOT NULL,
	"from_number" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"role" text DEFAULT 'viewer' NOT NULL,
	"roles" text,
	"department" text,
	"email" text NOT NULL,
	"firstName" text,
	"lastName" text,
	"external_id" text,
	"provider_id" text,
	"identity_provider" text,
	"last_login" timestamp,
	"last_active_at" timestamp,
	"mfa_secret" text,
	"mfa_enabled" boolean DEFAULT false NOT NULL,
	"mfa_backup_codes" text,
	"mfa_setup_at" timestamp,
	"email_status" text DEFAULT 'valid' NOT NULL,
	"must_reset_password" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_external_id_unique" UNIQUE("external_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "validation_status" (
	"id" serial PRIMARY KEY NOT NULL,
	"regulation_id" integer NOT NULL,
	"version_id" integer,
	"level" text NOT NULL,
	"status" text NOT NULL,
	"details" jsonb,
	"validated_at" timestamp DEFAULT now() NOT NULL,
	"validated_by" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "version_conflicts" (
	"id" serial PRIMARY KEY NOT NULL,
	"regulation_id" integer NOT NULL,
	"local_version_id" integer,
	"remote_version_id" text NOT NULL,
	"conflicts" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"resolution_method" text,
	"resolved_at" timestamp,
	"resolved_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attestation_tokens" ADD CONSTRAINT "attestation_tokens_regulation_id_regulations_id_fk" FOREIGN KEY ("regulation_id") REFERENCES "public"."regulations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attestation_tokens" ADD CONSTRAINT "attestation_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attestation_tokens" ADD CONSTRAINT "attestation_tokens_sent_by_users_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_regulation_id_regulations_id_fk" FOREIGN KEY ("regulation_id") REFERENCES "public"."regulations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_mappings" ADD CONSTRAINT "category_mappings_canonical_category_id_canonical_categories_id_fk" FOREIGN KEY ("canonical_category_id") REFERENCES "public"."canonical_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circuit_interpretations" ADD CONSTRAINT "circuit_interpretations_regulation_id_regulations_id_fk" FOREIGN KEY ("regulation_id") REFERENCES "public"."regulations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circuit_interpretations" ADD CONSTRAINT "circuit_interpretations_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circuit_splits" ADD CONSTRAINT "circuit_splits_regulation_id_regulations_id_fk" FOREIGN KEY ("regulation_id") REFERENCES "public"."regulations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_tasks" ADD CONSTRAINT "compliance_tasks_regulation_id_regulations_id_fk" FOREIGN KEY ("regulation_id") REFERENCES "public"."regulations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_tasks" ADD CONSTRAINT "compliance_tasks_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_tasks" ADD CONSTRAINT "compliance_tasks_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_tasks" ADD CONSTRAINT "compliance_tasks_attested_by_users_id_fk" FOREIGN KEY ("attested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_tasks" ADD CONSTRAINT "compliance_tasks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disabled_regulations" ADD CONSTRAINT "disabled_regulations_regulation_id_regulations_id_fk" FOREIGN KEY ("regulation_id") REFERENCES "public"."regulations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disabled_regulations" ADD CONSTRAINT "disabled_regulations_disabled_by_users_id_fk" FOREIGN KEY ("disabled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_delivery_log" ADD CONSTRAINT "email_delivery_log_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eo_regulation_impacts" ADD CONSTRAINT "eo_regulation_impacts_eo_id_executive_orders_id_fk" FOREIGN KEY ("eo_id") REFERENCES "public"."executive_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eo_regulation_impacts" ADD CONSTRAINT "eo_regulation_impacts_regulation_id_regulations_id_fk" FOREIGN KEY ("regulation_id") REFERENCES "public"."regulations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eo_regulation_impacts" ADD CONSTRAINT "eo_regulation_impacts_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eo_regulation_impacts" ADD CONSTRAINT "eo_regulation_impacts_generated_task_id_compliance_tasks_id_fk" FOREIGN KEY ("generated_task_id") REFERENCES "public"."compliance_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eo_status_history" ADD CONSTRAINT "eo_status_history_eo_id_executive_orders_id_fk" FOREIGN KEY ("eo_id") REFERENCES "public"."executive_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eo_status_history" ADD CONSTRAINT "eo_status_history_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_queue" ADD CONSTRAINT "notification_queue_regulation_id_regulations_id_fk" FOREIGN KEY ("regulation_id") REFERENCES "public"."regulations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_queue" ADD CONSTRAINT "notification_queue_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regulation_feedback" ADD CONSTRAINT "regulation_feedback_regulation_id_regulations_id_fk" FOREIGN KEY ("regulation_id") REFERENCES "public"."regulations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regulation_feedback" ADD CONSTRAINT "regulation_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regulation_feedback" ADD CONSTRAINT "regulation_feedback_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regulation_updates" ADD CONSTRAINT "regulation_updates_regulation_id_regulations_id_fk" FOREIGN KEY ("regulation_id") REFERENCES "public"."regulations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regulation_updates" ADD CONSTRAINT "regulation_updates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regulation_versions" ADD CONSTRAINT "regulation_versions_regulation_id_regulations_id_fk" FOREIGN KEY ("regulation_id") REFERENCES "public"."regulations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regulation_versions" ADD CONSTRAINT "regulation_versions_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regulations" ADD CONSTRAINT "regulations_previous_version_id_regulations_id_fk" FOREIGN KEY ("previous_version_id") REFERENCES "public"."regulations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regulations" ADD CONSTRAINT "regulations_notifications_disabled_by_users_id_fk" FOREIGN KEY ("notifications_disabled_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regulations" ADD CONSTRAINT "regulations_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_default_user_id_users_id_fk" FOREIGN KEY ("default_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_backup_user_id_users_id_fk" FOREIGN KEY ("backup_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_control" ADD CONSTRAINT "sync_control_regulation_id_regulations_id_fk" FOREIGN KEY ("regulation_id") REFERENCES "public"."regulations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_activity" ADD CONSTRAINT "task_activity_task_id_compliance_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."compliance_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_activity" ADD CONSTRAINT "task_activity_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_attestation_tokens" ADD CONSTRAINT "task_attestation_tokens_task_id_compliance_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."compliance_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_attestation_tokens" ADD CONSTRAINT "task_attestation_tokens_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_evidence" ADD CONSTRAINT "task_evidence_task_id_compliance_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."compliance_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_evidence" ADD CONSTRAINT "task_evidence_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_evidence" ADD CONSTRAINT "task_evidence_verified_by_users_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_status" ADD CONSTRAINT "validation_status_regulation_id_regulations_id_fk" FOREIGN KEY ("regulation_id") REFERENCES "public"."regulations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_status" ADD CONSTRAINT "validation_status_version_id_regulation_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."regulation_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_status" ADD CONSTRAINT "validation_status_validated_by_users_id_fk" FOREIGN KEY ("validated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "version_conflicts" ADD CONSTRAINT "version_conflicts_regulation_id_regulations_id_fk" FOREIGN KEY ("regulation_id") REFERENCES "public"."regulations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "version_conflicts" ADD CONSTRAINT "version_conflicts_local_version_id_regulation_versions_id_fk" FOREIGN KEY ("local_version_id") REFERENCES "public"."regulation_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "version_conflicts" ADD CONSTRAINT "version_conflicts_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attestation_tokens_token_idx" ON "attestation_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attestation_tokens_regulation_id_idx" ON "attestation_tokens" USING btree ("regulation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attestation_tokens_user_id_idx" ON "attestation_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "attestation_tokens_expires_at_idx" ON "attestation_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_entity_type_idx" ON "audit_logs" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_entity_id_idx" ON "audit_logs" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_user_id_idx" ON "audit_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_timestamp_idx" ON "audit_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_regulation_id_idx" ON "audit_logs" USING btree ("regulation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ci_regulation_idx" ON "circuit_interpretations" USING btree ("regulation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ci_circuit_idx" ON "circuit_interpretations" USING btree ("circuit_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ci_status_idx" ON "circuit_interpretations" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ci_review_status_idx" ON "circuit_interpretations" USING btree ("review_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ci_reg_circuit_idx" ON "circuit_interpretations" USING btree ("regulation_id","circuit_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cs_regulation_idx" ON "circuit_splits" USING btree ("regulation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cs_status_idx" ON "circuit_splits" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "compliance_tasks_regulation_id_idx" ON "compliance_tasks" USING btree ("regulation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "compliance_tasks_parent_task_id_idx" ON "compliance_tasks" USING btree ("parent_task_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "compliance_tasks_assigned_to_idx" ON "compliance_tasks" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "compliance_tasks_status_idx" ON "compliance_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "compliance_tasks_due_date_idx" ON "compliance_tasks" USING btree ("due_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "demo_requests_status_idx" ON "demo_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "demo_requests_email_idx" ON "demo_requests" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "disabled_regulations_regulation_id_idx" ON "disabled_regulations" USING btree ("regulation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "disabled_regulations_unique_idx" ON "disabled_regulations" USING btree ("regulation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "edl_recipient_email_idx" ON "email_delivery_log" USING btree ("recipient_email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "edl_status_idx" ON "email_delivery_log" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "edl_sent_at_idx" ON "email_delivery_log" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "edl_recipient_user_idx" ON "email_delivery_log" USING btree ("recipient_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "eori_regulation_idx" ON "eo_regulation_impacts" USING btree ("regulation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "eori_severity_idx" ON "eo_regulation_impacts" USING btree ("impact_severity");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "eori_review_status_idx" ON "eo_regulation_impacts" USING btree ("review_status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "eori_unique_idx" ON "eo_regulation_impacts" USING btree ("eo_id","regulation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "eo_history_eo_idx" ON "eo_status_history" USING btree ("eo_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "eo_history_date_idx" ON "eo_status_history" USING btree ("change_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "eo_status_idx" ON "executive_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "eo_signed_date_idx" ON "executive_orders" USING btree ("signed_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "eo_president_idx" ON "executive_orders" USING btree ("president");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "regulation_feedback_regulation_id_idx" ON "regulation_feedback" USING btree ("regulation_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "regulation_feedback_user_id_idx" ON "regulation_feedback" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "regulation_feedback_status_idx" ON "regulation_feedback" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "role_assignments_role_name_idx" ON "role_assignments" USING btree ("role_name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "role_assignments_category_idx" ON "role_assignments" USING btree ("category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_activity_task_id_idx" ON "task_activity" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_activity_created_at_idx" ON "task_activity" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_attestation_tokens_token_idx" ON "task_attestation_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_attestation_tokens_task_id_idx" ON "task_attestation_tokens" USING btree ("task_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_attestation_tokens_email_idx" ON "task_attestation_tokens" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "task_evidence_task_id_idx" ON "task_evidence" USING btree ("task_id");