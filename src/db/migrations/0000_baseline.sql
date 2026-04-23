CREATE TYPE "public"."client_subtype" AS ENUM('commercial', 'residential');--> statement-breakpoint
CREATE TYPE "public"."display_density" AS ENUM('comfortable', 'compact');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'expired', 'revoked');--> statement-breakpoint
CREATE TYPE "public"."membership_status" AS ENUM('invited', 'active', 'inactive', 'removed');--> statement-breakpoint
CREATE TYPE "public"."notification_portal" AS ENUM('contractor', 'subcontractor', 'commercial', 'residential');--> statement-breakpoint
CREATE TYPE "public"."organization_membership_type" AS ENUM('contractor', 'subcontractor', 'client', 'consultant');--> statement-breakpoint
CREATE TYPE "public"."organization_type" AS ENUM('contractor', 'subcontractor', 'client_company', 'household', 'internal_platform');--> statement-breakpoint
CREATE TYPE "public"."portal_type" AS ENUM('contractor', 'subcontractor', 'client', 'external_reviewer');--> statement-breakpoint
CREATE TYPE "public"."theme_mode" AS ENUM('light', 'dark', 'system');--> statement-breakpoint
CREATE TYPE "public"."access_state" AS ENUM('active', 'pending_onboarding', 'pending_compliance', 'restricted', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."audience_scope" AS ENUM('internal', 'contractor', 'subcontractor', 'client', 'commercial_client', 'residential_client', 'mixed');--> statement-breakpoint
CREATE TYPE "public"."current_phase" AS ENUM('preconstruction', 'phase_1', 'phase_2', 'phase_3', 'closeout');--> statement-breakpoint
CREATE TYPE "public"."milestone_status" AS ENUM('scheduled', 'in_progress', 'completed', 'missed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."milestone_type" AS ENUM('inspection', 'deadline', 'submission', 'walkthrough', 'delivery', 'payment', 'completion', 'custom');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('draft', 'active', 'on_hold', 'closed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."visibility_scope" AS ENUM('internal_only', 'client_visible', 'subcontractor_scoped', 'project_wide', 'phase_scoped', 'scope_scoped');--> statement-breakpoint
CREATE TYPE "public"."document_category" AS ENUM('drawings', 'specifications', 'submittal', 'contracts', 'photos', 'permits', 'compliance', 'billing_backup', 'other');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('active', 'pending_review', 'superseded', 'archived');--> statement-breakpoint
CREATE TYPE "public"."approval_category" AS ENUM('general', 'design', 'procurement', 'change_order', 'other');--> statement-breakpoint
CREATE TYPE "public"."approval_status" AS ENUM('draft', 'pending_review', 'approved', 'rejected', 'needs_revision');--> statement-breakpoint
CREATE TYPE "public"."change_order_status" AS ENUM('draft', 'pending_review', 'pending_client_approval', 'approved', 'rejected', 'voided');--> statement-breakpoint
CREATE TYPE "public"."compliance_status" AS ENUM('pending', 'active', 'expired', 'rejected', 'waived');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('open', 'submitted', 'revision_requested', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."rfi_status" AS ENUM('draft', 'open', 'pending_response', 'answered', 'closed');--> statement-breakpoint
CREATE TYPE "public"."rfi_type" AS ENUM('formal', 'issue');--> statement-breakpoint
CREATE TYPE "public"."billing_package_status" AS ENUM('draft', 'ready_for_review', 'under_review', 'approved', 'rejected', 'closed');--> statement-breakpoint
CREATE TYPE "public"."draw_request_status" AS ENUM('draft', 'ready_for_review', 'submitted', 'under_review', 'approved', 'approved_with_note', 'returned', 'revised', 'paid', 'closed');--> statement-breakpoint
CREATE TYPE "public"."lien_waiver_status" AS ENUM('requested', 'submitted', 'accepted', 'rejected', 'waived');--> statement-breakpoint
CREATE TYPE "public"."lien_waiver_type" AS ENUM('conditional_progress', 'unconditional_progress', 'conditional_final', 'unconditional_final');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('not_started', 'pending', 'in_review', 'approved', 'paid', 'overdue', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."retainage_release_status" AS ENUM('held', 'release_requested', 'released', 'forfeited');--> statement-breakpoint
CREATE TYPE "public"."sov_line_item_type" AS ENUM('original', 'change_order');--> statement-breakpoint
CREATE TYPE "public"."sov_status" AS ENUM('draft', 'active', 'locked', 'archived');--> statement-breakpoint
CREATE TYPE "public"."conversation_type" AS ENUM('project_general', 'rfi_thread', 'change_order_thread', 'approval_thread', 'direct');--> statement-breakpoint
CREATE TYPE "public"."selection_item_status" AS ENUM('not_started', 'exploring', 'provisional', 'confirmed', 'revision_open', 'locked');--> statement-breakpoint
CREATE TYPE "public"."selection_option_tier" AS ENUM('included', 'upgrade', 'premium_upgrade');--> statement-breakpoint
CREATE TYPE "public"."integration_connection_status" AS ENUM('connecting', 'connected', 'needs_reauth', 'error', 'disconnected');--> statement-breakpoint
CREATE TYPE "public"."integration_provider" AS ENUM('quickbooks_online', 'xero', 'sage_business_cloud', 'stripe', 'google_calendar', 'outlook_365', 'postmark', 'sendgrid');--> statement-breakpoint
CREATE TYPE "public"."payment_method_type" AS ENUM('ach_debit', 'card', 'wire', 'check', 'other');--> statement-breakpoint
CREATE TYPE "public"."payment_transaction_status" AS ENUM('pending', 'processing', 'succeeded', 'failed', 'canceled', 'refunded', 'partially_refunded', 'disputed');--> statement-breakpoint
CREATE TYPE "public"."sync_direction" AS ENUM('push', 'pull', 'reconciliation');--> statement-breakpoint
CREATE TYPE "public"."sync_event_status" AS ENUM('pending', 'in_progress', 'succeeded', 'failed', 'skipped', 'partial', 'mapping_error');--> statement-breakpoint
CREATE TYPE "public"."webhook_delivery_status" AS ENUM('received', 'processed', 'processing_failed', 'queued', 'delivered', 'delivery_failed', 'retrying', 'exhausted');--> statement-breakpoint
CREATE TYPE "public"."webhook_direction" AS ENUM('inbound', 'outbound');--> statement-breakpoint
CREATE TYPE "public"."activity_type" AS ENUM('project_update', 'milestone_update', 'approval_requested', 'approval_completed', 'file_uploaded', 'selection_ready', 'payment_update', 'comment_added');--> statement-breakpoint
CREATE TYPE "public"."surface_type" AS ENUM('feed_item', 'homepage_summary', 'client_update', 'notification_source', 'status_strip');--> statement-breakpoint
CREATE TYPE "public"."daily_log_amendment_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."daily_log_crew_submitted_by_role" AS ENUM('sub', 'contractor');--> statement-breakpoint
CREATE TYPE "public"."daily_log_delay_type" AS ENUM('weather', 'material', 'inspection', 'subcontractor_no_show', 'coordination', 'other');--> statement-breakpoint
CREATE TYPE "public"."daily_log_issue_type" AS ENUM('safety_near_miss', 'safety_incident', 'coordination', 'quality', 'other');--> statement-breakpoint
CREATE TYPE "public"."daily_log_milestone_type" AS ENUM('ok', 'warn', 'info');--> statement-breakpoint
CREATE TYPE "public"."daily_log_residential_mood" AS ENUM('great', 'good', 'slow');--> statement-breakpoint
CREATE TYPE "public"."daily_log_status" AS ENUM('draft', 'submitted');--> statement-breakpoint
CREATE TYPE "public"."daily_log_weather_conditions" AS ENUM('clear', 'partly_cloudy', 'overcast', 'light_rain', 'heavy_rain', 'snow');--> statement-breakpoint
CREATE TYPE "public"."daily_log_weather_source" AS ENUM('manual', 'api');--> statement-breakpoint
CREATE TYPE "public"."punch_item_priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."punch_item_status" AS ENUM('open', 'in_progress', 'ready_to_verify', 'verified', 'rejected', 'void');--> statement-breakpoint
CREATE TYPE "public"."submittal_document_role" AS ENUM('package', 'reviewer_comments', 'stamp_page');--> statement-breakpoint
CREATE TYPE "public"."submittal_status" AS ENUM('draft', 'submitted', 'under_review', 'returned_approved', 'returned_as_noted', 'revise_resubmit', 'rejected', 'closed');--> statement-breakpoint
CREATE TYPE "public"."submittal_transmittal_direction" AS ENUM('outgoing_to_reviewer', 'incoming_from_reviewer', 'forwarded_to_sub');--> statement-breakpoint
CREATE TYPE "public"."submittal_type" AS ENUM('product_data', 'shop_drawing', 'sample', 'mock_up', 'calculations', 'schedule_of_values');--> statement-breakpoint
CREATE TYPE "public"."weekly_report_section_type" AS ENUM('daily_logs', 'photos', 'milestones', 'rfis', 'change_orders', 'issues');--> statement-breakpoint
CREATE TYPE "public"."weekly_report_status" AS ENUM('auto_draft', 'editing', 'sent', 'archived');--> statement-breakpoint
CREATE TYPE "public"."procurement_po_status" AS ENUM('draft', 'issued', 'revised', 'partially_received', 'fully_received', 'invoiced', 'closed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."vendor_rating" AS ENUM('preferred', 'standard');--> statement-breakpoint
CREATE TYPE "public"."drawing_calibration_source" AS ENUM('title_block', 'manual');--> statement-breakpoint
CREATE TYPE "public"."drawing_set_processing_status" AS ENUM('pending', 'processing', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."drawing_set_status" AS ENUM('current', 'superseded', 'historical');--> statement-breakpoint
CREATE TYPE "public"."inspection_outcome" AS ENUM('pass', 'fail', 'conditional', 'na');--> statement-breakpoint
CREATE TYPE "public"."inspection_phase" AS ENUM('rough', 'final');--> statement-breakpoint
CREATE TYPE "public"."inspection_status" AS ENUM('scheduled', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invited_email" varchar(320) NOT NULL,
	"invited_name" varchar(200),
	"invited_by_user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid,
	"portal_type" varchar(40) NOT NULL,
	"client_subtype" varchar(40),
	"role_key" varchar(120) NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"invitation_status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"accepted_by_user_id" uuid,
	"personal_message" text,
	"scope_object_type" varchar(64),
	"scope_object_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitations_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "organization_certifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"kind" varchar(200) NOT NULL,
	"holder" varchar(200),
	"issued_on" varchar(60),
	"expires_on" varchar(60),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_licenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"kind" varchar(200) NOT NULL,
	"license_number" varchar(120) NOT NULL,
	"state_region" varchar(80),
	"expires_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"membership_status" "membership_status" DEFAULT 'active' NOT NULL,
	"job_title" varchar(180),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_users_org_user_unique" UNIQUE("organization_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"organization_type" "organization_type" NOT NULL,
	"legal_name" varchar(255),
	"tax_id" varchar(40),
	"website" varchar(500),
	"phone" varchar(40),
	"addr1" varchar(255),
	"addr2" varchar(120),
	"city" varchar(120),
	"state_region" varchar(80),
	"postal_code" varchar(20),
	"country" varchar(80),
	"primary_contact_name" varchar(200),
	"primary_contact_title" varchar(200),
	"primary_contact_email" varchar(320),
	"primary_contact_phone" varchar(40),
	"billing_contact_name" varchar(200),
	"billing_email" varchar(320),
	"logo_storage_key" text,
	"primary_trade" varchar(120),
	"secondary_trades" text[],
	"years_in_business" varchar(10),
	"crew_size" varchar(10),
	"regions" text[],
	"allowed_email_domains" text[],
	"session_timeout_minutes" integer,
	"require_2fa_org" boolean DEFAULT false NOT NULL,
	"industry" varchar(120),
	"company_size" varchar(40),
	"invoice_delivery" varchar(40),
	"project_name" varchar(255),
	"preferred_name" varchar(120),
	"preferred_channel" varchar(40),
	"preferred_time" varchar(40),
	"emergency_name" varchar(200),
	"emergency_relation" varchar(80),
	"emergency_phone" varchar(40),
	"current_plan_slug" varchar(40),
	"usage_project_count" integer DEFAULT 0 NOT NULL,
	"usage_team_count" integer DEFAULT 0 NOT NULL,
	"usage_storage_bytes" bigint DEFAULT 0 NOT NULL,
	"default_tax_rate_percent" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"portal_type" "portal_type" NOT NULL,
	"role_key" varchar(120) NOT NULL,
	"client_subtype" "client_subtype",
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_assignments_client_subtype_check" CHECK ((
        ("role_assignments"."portal_type" = 'client' and "role_assignments"."client_subtype" is not null)
        or
        ("role_assignments"."portal_type" <> 'client' and "role_assignments"."client_subtype" is null)
      ))
);
--> statement-breakpoint
CREATE TABLE "user_notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"portal_type" "notification_portal" NOT NULL,
	"event_id" varchar(120) NOT NULL,
	"email" boolean DEFAULT true NOT NULL,
	"in_app" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_notif_prefs_uniq" UNIQUE("user_id","portal_type","event_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"first_name" varchar(120),
	"last_name" varchar(120),
	"display_name" varchar(200),
	"phone" varchar(40),
	"title" varchar(120),
	"timezone" varchar(64) DEFAULT 'America/Los_Angeles' NOT NULL,
	"theme" "theme_mode" DEFAULT 'system' NOT NULL,
	"density" "display_density" DEFAULT 'comfortable' NOT NULL,
	"language" varchar(10) DEFAULT 'en' NOT NULL,
	"avatar_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "auth_account" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_session" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"app_user_id" uuid,
	"organization_id" uuid,
	"role" text,
	"portal_type" text,
	"client_subtype" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "two_factor" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"secret" text NOT NULL,
	"backup_codes" text NOT NULL,
	"verified" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_user" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"app_user_id" uuid,
	"two_factor_enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "auth_verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "milestone_dependencies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"predecessor_id" uuid NOT NULL,
	"successor_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "milestone_dependencies_no_self" CHECK ("milestone_dependencies"."predecessor_id" <> "milestone_dependencies"."successor_id")
);
--> statement-breakpoint
CREATE TABLE "milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"milestone_type" "milestone_type" DEFAULT 'custom' NOT NULL,
	"milestone_status" "milestone_status" DEFAULT 'scheduled' NOT NULL,
	"start_date" timestamp with time zone,
	"scheduled_date" timestamp with time zone NOT NULL,
	"completed_date" timestamp with time zone,
	"phase" varchar(60),
	"assigned_to_user_id" uuid,
	"assigned_to_organization_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"visibility_scope" varchar(60) DEFAULT 'project_wide' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_organization_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"membership_type" "organization_membership_type" NOT NULL,
	"relationship_scope" text,
	"phase_scope" text,
	"work_scope" text,
	"scope_discipline" char(1),
	"membership_status" "membership_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_org_memberships_project_org_unique" UNIQUE("project_id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "project_user_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"role_assignment_id" uuid NOT NULL,
	"membership_status" "membership_status" DEFAULT 'active' NOT NULL,
	"access_state" "access_state" DEFAULT 'active' NOT NULL,
	"phase_scope" text,
	"work_scope" text,
	"default_landing_page" varchar(120),
	"default_emphasized_module" varchar(120),
	"communication_scope_override" text,
	"notification_profile_override" text,
	"restriction_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_user_memberships_project_user_org_unique" UNIQUE("project_id","user_id","organization_id")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"project_code" varchar(80),
	"project_type" varchar(120),
	"client_subtype" "client_subtype",
	"project_status" "project_status" DEFAULT 'draft' NOT NULL,
	"current_phase" "current_phase" DEFAULT 'preconstruction' NOT NULL,
	"start_date" timestamp with time zone,
	"target_completion_date" timestamp with time zone,
	"actual_completion_date" timestamp with time zone,
	"contractor_organization_id" uuid NOT NULL,
	"contract_value_cents" integer,
	"address_line_1" varchar(255),
	"address_line_2" varchar(255),
	"city" varchar(120),
	"state_province" varchar(120),
	"postal_code" varchar(20),
	"country" varchar(3) DEFAULT 'CA',
	"timezone" varchar(64) DEFAULT 'UTC' NOT NULL,
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	"geocoded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_project_code_unique" UNIQUE("project_code")
);
--> statement-breakpoint
CREATE TABLE "document_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"linked_object_type" varchar(120) NOT NULL,
	"linked_object_id" uuid NOT NULL,
	"link_role" varchar(120) NOT NULL,
	"pin_version" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"document_type" varchar(120) NOT NULL,
	"title" varchar(255) NOT NULL,
	"storage_key" text NOT NULL,
	"uploaded_by_user_id" uuid NOT NULL,
	"visibility_scope" "visibility_scope" NOT NULL,
	"audience_scope" "audience_scope" NOT NULL,
	"file_size_bytes" bigint,
	"document_status" "document_status" DEFAULT 'active' NOT NULL,
	"category" "document_category" DEFAULT 'other' NOT NULL,
	"is_superseded" boolean DEFAULT false NOT NULL,
	"supersedes_document_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "documents_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"approval_number" integer NOT NULL,
	"category" "approval_category" DEFAULT 'general' NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"approval_status" "approval_status" DEFAULT 'draft' NOT NULL,
	"impact_cost_cents" integer DEFAULT 0 NOT NULL,
	"impact_schedule_days" integer DEFAULT 0 NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"assigned_to_organization_id" uuid,
	"submitted_at" timestamp with time zone,
	"decided_by_user_id" uuid,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"related_object_type" varchar(120),
	"related_object_id" uuid,
	"visibility_scope" varchar(60) DEFAULT 'client_visible' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "approvals_project_number_unique" UNIQUE("project_id","approval_number")
);
--> statement-breakpoint
CREATE TABLE "change_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"change_order_number" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"change_order_status" "change_order_status" DEFAULT 'draft' NOT NULL,
	"amount_cents" integer DEFAULT 0 NOT NULL,
	"schedule_impact_days" integer DEFAULT 0 NOT NULL,
	"reason" text,
	"originating_rfi_id" uuid,
	"requested_by_user_id" uuid NOT NULL,
	"approved_by_user_id" uuid,
	"approved_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"rejection_reason" text,
	"submitted_at" timestamp with time zone,
	"visibility_scope" varchar(60) DEFAULT 'client_visible' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "change_orders_project_number_unique" UNIQUE("project_id","change_order_number")
);
--> statement-breakpoint
CREATE TABLE "compliance_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid,
	"organization_id" uuid NOT NULL,
	"compliance_type" varchar(120) NOT NULL,
	"compliance_status" "compliance_status" DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone,
	"document_id" uuid,
	"metadata_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rfi_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rfi_id" uuid NOT NULL,
	"responded_by_user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"attached_document_id" uuid,
	"is_official_response" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rfis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"sequential_number" integer NOT NULL,
	"subject" varchar(255) NOT NULL,
	"body" text,
	"rfi_status" "rfi_status" DEFAULT 'draft' NOT NULL,
	"rfi_type" "rfi_type" DEFAULT 'issue' NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"assigned_to_user_id" uuid,
	"assigned_to_organization_id" uuid,
	"due_at" timestamp with time zone,
	"responded_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"resulting_change_order_id" uuid,
	"visibility_scope" varchar(60) DEFAULT 'project_wide' NOT NULL,
	"drawing_reference" varchar(255),
	"specification_reference" varchar(255),
	"location_description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rfis_project_number_unique" UNIQUE("project_id","sequential_number")
);
--> statement-breakpoint
CREATE TABLE "upload_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"request_status" "request_status" DEFAULT 'open' NOT NULL,
	"requested_from_user_id" uuid,
	"requested_from_organization_id" uuid,
	"due_at" timestamp with time zone,
	"expected_file_type" varchar(120),
	"submitted_document_id" uuid,
	"submitted_at" timestamp with time zone,
	"submitted_by_user_id" uuid,
	"completed_at" timestamp with time zone,
	"revision_note" text,
	"response_note" text,
	"created_by_user_id" uuid,
	"related_object_type" varchar(120),
	"related_object_id" uuid,
	"visibility_scope" "visibility_scope" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "upload_requests_target_required_check" CHECK ("upload_requests"."requested_from_user_id" is not null or "upload_requests"."requested_from_organization_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "billing_packages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"billing_package_number" varchar(80) NOT NULL,
	"title" varchar(255) NOT NULL,
	"billing_package_status" "billing_package_status" DEFAULT 'draft' NOT NULL,
	"submitted_at" timestamp with time zone,
	"review_due_at" timestamp with time zone,
	"created_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_packages_project_number_unique" UNIQUE("project_id","billing_package_number")
);
--> statement-breakpoint
CREATE TABLE "draw_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draw_request_id" uuid NOT NULL,
	"sov_line_item_id" uuid NOT NULL,
	"work_completed_previous_cents" integer DEFAULT 0 NOT NULL,
	"work_completed_this_period_cents" integer DEFAULT 0 NOT NULL,
	"materials_presently_stored_cents" integer DEFAULT 0 NOT NULL,
	"total_completed_stored_to_date_cents" integer DEFAULT 0 NOT NULL,
	"percent_complete_basis_points" integer DEFAULT 0 NOT NULL,
	"balance_to_finish_cents" integer DEFAULT 0 NOT NULL,
	"retainage_cents" integer DEFAULT 0 NOT NULL,
	"retainage_percent_applied" integer DEFAULT 10 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "draw_line_items_draw_sov_unique" UNIQUE("draw_request_id","sov_line_item_id"),
	CONSTRAINT "draw_line_items_total_check" CHECK (total_completed_stored_to_date_cents = work_completed_previous_cents + work_completed_this_period_cents + materials_presently_stored_cents)
);
--> statement-breakpoint
CREATE TABLE "draw_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"sov_id" uuid NOT NULL,
	"draw_number" integer NOT NULL,
	"period_from" timestamp with time zone NOT NULL,
	"period_to" timestamp with time zone NOT NULL,
	"draw_request_status" "draw_request_status" DEFAULT 'draft' NOT NULL,
	"original_contract_sum_cents" integer DEFAULT 0 NOT NULL,
	"net_change_orders_cents" integer DEFAULT 0 NOT NULL,
	"contract_sum_to_date_cents" integer DEFAULT 0 NOT NULL,
	"total_completed_to_date_cents" integer DEFAULT 0 NOT NULL,
	"retainage_on_completed_cents" integer DEFAULT 0 NOT NULL,
	"retainage_on_stored_cents" integer DEFAULT 0 NOT NULL,
	"total_retainage_cents" integer DEFAULT 0 NOT NULL,
	"total_earned_less_retainage_cents" integer DEFAULT 0 NOT NULL,
	"previous_certificates_cents" integer DEFAULT 0 NOT NULL,
	"retainage_released_cents" integer DEFAULT 0 NOT NULL,
	"current_payment_due_cents" integer DEFAULT 0 NOT NULL,
	"balance_to_finish_cents" integer DEFAULT 0 NOT NULL,
	"created_by_user_id" uuid NOT NULL,
	"submitted_at" timestamp with time zone,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"returned_at" timestamp with time zone,
	"return_reason" text,
	"paid_at" timestamp with time zone,
	"payment_reference_name" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "draw_requests_project_draw_unique" UNIQUE("project_id","draw_number"),
	CONSTRAINT "draw_requests_contract_sum_check" CHECK (contract_sum_to_date_cents = original_contract_sum_cents + net_change_orders_cents)
);
--> statement-breakpoint
CREATE TABLE "lien_waivers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"draw_request_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"lien_waiver_type" "lien_waiver_type" NOT NULL,
	"lien_waiver_status" "lien_waiver_status" DEFAULT 'requested' NOT NULL,
	"amount_cents" integer NOT NULL,
	"through_date" timestamp with time zone,
	"document_id" uuid,
	"template_id" varchar(60),
	"requested_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"accepted_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lien_waivers_draw_org_type_unique" UNIQUE("draw_request_id","organization_id","lien_waiver_type")
);
--> statement-breakpoint
CREATE TABLE "retainage_releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"sov_line_item_id" uuid,
	"retainage_release_status" "retainage_release_status" DEFAULT 'held' NOT NULL,
	"release_amount_cents" integer NOT NULL,
	"total_retainage_held_cents" integer NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"requested_at" timestamp with time zone,
	"approved_by_user_id" uuid,
	"approved_at" timestamp with time zone,
	"approval_note" text,
	"consumed_by_draw_request_id" uuid,
	"consumed_at" timestamp with time zone,
	"scheduled_release_at" timestamp with time zone,
	"release_trigger_milestone_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_of_values" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"sov_status" "sov_status" DEFAULT 'draft' NOT NULL,
	"total_scheduled_value_cents" integer DEFAULT 0 NOT NULL,
	"total_original_contract_cents" integer DEFAULT 0 NOT NULL,
	"total_change_orders_cents" integer DEFAULT 0 NOT NULL,
	"default_retainage_percent" integer DEFAULT 10 NOT NULL,
	"approved_by_user_id" uuid,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sov_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sov_id" uuid NOT NULL,
	"item_number" varchar(40) NOT NULL,
	"cost_code" varchar(40),
	"description" varchar(500) NOT NULL,
	"line_item_type" "sov_line_item_type" DEFAULT 'original' NOT NULL,
	"scheduled_value_cents" integer NOT NULL,
	"change_order_id" uuid,
	"retainage_percent_override" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sov_line_items_sov_number_unique" UNIQUE("sov_id","item_number")
);
--> statement-breakpoint
CREATE TABLE "conversation_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"last_read_at" timestamp with time zone,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversation_participants_conv_user_unique" UNIQUE("conversation_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"title" varchar(255),
	"conversation_type" "conversation_type" DEFAULT 'project_general' NOT NULL,
	"linked_object_type" varchar(120),
	"linked_object_id" uuid,
	"last_message_at" timestamp with time zone,
	"last_message_preview" varchar(255),
	"message_count" integer DEFAULT 0 NOT NULL,
	"visibility_scope" varchar(60) DEFAULT 'project_wide' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"attached_document_id" uuid,
	"edited_at" timestamp with time zone,
	"is_system_message" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "selection_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "selection_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"selection_item_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"selected_option_id" uuid NOT NULL,
	"decided_by_user_id" uuid NOT NULL,
	"is_provisional" boolean DEFAULT true NOT NULL,
	"is_confirmed" boolean DEFAULT false NOT NULL,
	"is_locked" boolean DEFAULT false NOT NULL,
	"confirmed_at" timestamp with time zone,
	"locked_at" timestamp with time zone,
	"revision_expires_at" timestamp with time zone,
	"previous_option_id" uuid,
	"revision_note" text,
	"price_delta_cents" integer DEFAULT 0 NOT NULL,
	"schedule_delta_days" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "selection_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text,
	"selection_item_status" "selection_item_status" DEFAULT 'not_started' NOT NULL,
	"allowance_cents" integer DEFAULT 0 NOT NULL,
	"decision_deadline" timestamp with time zone,
	"urgency_note" text,
	"affects_schedule" boolean DEFAULT false NOT NULL,
	"schedule_impact_note" text,
	"recommended_option_id" uuid,
	"revision_window_hours" integer DEFAULT 48 NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"published_by_user_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "selection_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"selection_item_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"option_tier" "selection_option_tier" DEFAULT 'included' NOT NULL,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"lead_time_days" integer,
	"additional_schedule_days" integer,
	"image_document_id" uuid,
	"swatch_color" varchar(7),
	"spec_document_id" uuid,
	"supplier_name" varchar(255),
	"product_sku" varchar(120),
	"product_url" text,
	"tags" jsonb,
	"is_available" boolean DEFAULT true NOT NULL,
	"unavailable_reason" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "integration_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"connection_status" "integration_connection_status" DEFAULT 'connecting' NOT NULL,
	"connected_by_user_id" uuid NOT NULL,
	"access_token_enc" text,
	"refresh_token_enc" text,
	"token_expires_at" timestamp with time zone,
	"external_account_id" varchar(255),
	"external_account_name" varchar(255),
	"mapping_config" jsonb,
	"sync_preferences" jsonb,
	"last_sync_at" timestamp with time zone,
	"last_sync_status" "sync_event_status",
	"last_error_message" text,
	"consecutive_errors" integer DEFAULT 0 NOT NULL,
	"granted_scopes" jsonb,
	"connected_at" timestamp with time zone,
	"disconnected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"related_entity_type" varchar(120) NOT NULL,
	"related_entity_id" uuid NOT NULL,
	"payment_method_type" "payment_method_type" NOT NULL,
	"transaction_status" "payment_transaction_status" DEFAULT 'pending' NOT NULL,
	"gross_amount_cents" integer NOT NULL,
	"processing_fee_cents" integer DEFAULT 0 NOT NULL,
	"platform_fee_cents" integer DEFAULT 0 NOT NULL,
	"net_amount_cents" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'CAD' NOT NULL,
	"stripe_payment_intent_id" varchar(255),
	"stripe_charge_id" varchar(255),
	"stripe_transfer_id" varchar(255),
	"payment_method_details" jsonb,
	"initiated_by_user_id" uuid,
	"external_reference" varchar(255),
	"initiated_at" timestamp with time zone,
	"succeeded_at" timestamp with time zone,
	"failed_at" timestamp with time zone,
	"failure_reason" text,
	"refunded_amount_cents" integer DEFAULT 0 NOT NULL,
	"refunded_at" timestamp with time zone,
	"refund_reason" text,
	"receipt_url" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_transactions_net_amount_check" CHECK (net_amount_cents = gross_amount_cents - processing_fee_cents - platform_fee_cents)
);
--> statement-breakpoint
CREATE TABLE "sync_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"integration_connection_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"sync_direction" "sync_direction" NOT NULL,
	"sync_event_status" "sync_event_status" DEFAULT 'pending' NOT NULL,
	"entity_type" varchar(120),
	"entity_id" uuid,
	"external_entity_type" varchar(120),
	"external_entity_id" varchar(255),
	"idempotency_key" varchar(500),
	"summary" text,
	"result_data" jsonb,
	"error_code" varchar(120),
	"error_message" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"max_retries" integer DEFAULT 5 NOT NULL,
	"next_retry_at" timestamp with time zone,
	"job_id" varchar(255),
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"webhook_direction" "webhook_direction" NOT NULL,
	"delivery_status" "webhook_delivery_status" DEFAULT 'received' NOT NULL,
	"event_type" varchar(255) NOT NULL,
	"event_id" varchar(255) NOT NULL,
	"source_provider" varchar(120) NOT NULL,
	"endpoint_url" text,
	"payload_hash" varchar(64),
	"payload" jsonb,
	"http_status_code" integer,
	"response_body" text,
	"processing_duration_ms" integer,
	"signature_verified" boolean,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"max_retries" integer DEFAULT 6 NOT NULL,
	"next_retry_at" timestamp with time zone,
	"error_message" text,
	"subscription_id" varchar(255),
	"received_at" timestamp with time zone,
	"processed_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_feed_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"actor_user_id" uuid,
	"activity_type" "activity_type" NOT NULL,
	"surface_type" "surface_type" NOT NULL,
	"title" varchar(255) NOT NULL,
	"body" text,
	"related_object_type" varchar(120),
	"related_object_id" uuid,
	"visibility_scope" "visibility_scope" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid NOT NULL,
	"project_id" uuid,
	"organization_id" uuid,
	"object_type" varchar(120) NOT NULL,
	"object_id" uuid NOT NULL,
	"action_name" varchar(120) NOT NULL,
	"previous_state" jsonb,
	"next_state" jsonb,
	"metadata_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_user_id" uuid NOT NULL,
	"portal_type" "notification_portal" NOT NULL,
	"event_id" varchar(120) NOT NULL,
	"title" varchar(255) NOT NULL,
	"body" text,
	"link_url" varchar(500),
	"project_id" uuid,
	"related_object_type" varchar(120),
	"related_object_id" uuid,
	"source_audit_event_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "organization_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"stripe_subscription_id" varchar(120),
	"status" varchar(40) NOT NULL,
	"billing_cycle" varchar(20) NOT NULL,
	"trial_end" timestamp with time zone,
	"current_period_start" timestamp with time zone NOT NULL,
	"current_period_end" timestamp with time zone NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"canceled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "organization_subscriptions_organization_id_unique" UNIQUE("organization_id"),
	CONSTRAINT "organization_subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id"),
	CONSTRAINT "organization_subscriptions_status_check" CHECK ("organization_subscriptions"."status" in ('trialing','active','past_due','canceled','incomplete','incomplete_expired','unpaid')),
	CONSTRAINT "organization_subscriptions_billing_cycle_check" CHECK ("organization_subscriptions"."billing_cycle" in ('monthly','annual'))
);
--> statement-breakpoint
CREATE TABLE "stripe_customers" (
	"organization_id" uuid PRIMARY KEY NOT NULL,
	"stripe_customer_id" varchar(120) NOT NULL,
	"email" varchar(320) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stripe_customers_stripe_customer_id_unique" UNIQUE("stripe_customer_id")
);
--> statement-breakpoint
CREATE TABLE "subscription_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_subscription_id" uuid NOT NULL,
	"stripe_invoice_id" varchar(120) NOT NULL,
	"number" varchar(40),
	"amount_paid_cents" integer DEFAULT 0 NOT NULL,
	"currency" varchar(3) DEFAULT 'usd' NOT NULL,
	"status" varchar(40) NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"hosted_invoice_url" text,
	"invoice_pdf_url" text,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_invoices_stripe_invoice_id_unique" UNIQUE("stripe_invoice_id")
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(40) NOT NULL,
	"name" varchar(80) NOT NULL,
	"price_monthly_cents" integer,
	"price_annual_cents" integer,
	"stripe_price_id_monthly" varchar(120),
	"stripe_price_id_annual" varchar(120),
	"project_limit" integer,
	"team_limit" integer,
	"storage_limit_gb" integer,
	"is_self_serve_purchasable" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_plans_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "data_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"export_kind" text NOT NULL,
	"scope" jsonb,
	"status" text DEFAULT 'queued' NOT NULL,
	"storage_key" text,
	"expires_at" timestamp with time zone,
	"error_message" text,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "data_exports_kind_check" CHECK ("data_exports"."export_kind" in ('projects_csv','financial_csv','documents_zip','full_archive','audit_log_csv')),
	CONSTRAINT "data_exports_status_check" CHECK ("data_exports"."status" in ('queued','running','ready','failed'))
);
--> statement-breakpoint
CREATE TABLE "sso_providers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(120) NOT NULL,
	"entity_id" text NOT NULL,
	"sso_url" text NOT NULL,
	"certificate_pem" text NOT NULL,
	"allowed_email_domain" varchar(253) NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sso_providers_organization_id_unique" UNIQUE("organization_id"),
	CONSTRAINT "sso_providers_status_check" CHECK ("sso_providers"."status" in ('active','disabled'))
);
--> statement-breakpoint
CREATE TABLE "daily_log_amendments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"daily_log_id" uuid NOT NULL,
	"change_summary" text NOT NULL,
	"changed_fields" jsonb NOT NULL,
	"status" "daily_log_amendment_status" DEFAULT 'pending' NOT NULL,
	"requested_by_user_id" uuid NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_by_user_id" uuid,
	"reviewed_at" timestamp with time zone,
	"review_note" text,
	"applied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_log_crew_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"daily_log_id" uuid,
	"project_id" uuid NOT NULL,
	"log_date" date NOT NULL,
	"org_id" uuid NOT NULL,
	"trade" varchar(120),
	"headcount" integer NOT NULL,
	"hours" numeric(6, 2) NOT NULL,
	"submitted_note" text,
	"submitted_issues" text,
	"submitted_by_user_id" uuid NOT NULL,
	"submitted_by_role" "daily_log_crew_submitted_by_role" NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reconciled_headcount" integer,
	"reconciled_hours" numeric(6, 2),
	"reconciled_by_user_id" uuid,
	"reconciled_at" timestamp with time zone,
	"sub_acked_reconciliation_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_log_crew_entries_project_date_org_unique" UNIQUE("project_id","log_date","org_id")
);
--> statement-breakpoint
CREATE TABLE "daily_log_delays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"daily_log_id" uuid NOT NULL,
	"delay_type" "daily_log_delay_type" NOT NULL,
	"description" text NOT NULL,
	"hours_lost" numeric(5, 2) NOT NULL,
	"impacted_activity" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_log_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"daily_log_id" uuid NOT NULL,
	"issue_type" "daily_log_issue_type" NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_log_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"daily_log_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"caption" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_hero" boolean DEFAULT false NOT NULL,
	"uploaded_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"log_date" date NOT NULL,
	"status" "daily_log_status" DEFAULT 'draft' NOT NULL,
	"reported_by_user_id" uuid NOT NULL,
	"submitted_at" timestamp with time zone,
	"edit_window_closes_at" timestamp with time zone,
	"weather_conditions" "daily_log_weather_conditions",
	"weather_high_c" integer,
	"weather_low_c" integer,
	"weather_precip_pct" integer,
	"weather_wind_kmh" integer,
	"weather_source" "daily_log_weather_source" DEFAULT 'manual' NOT NULL,
	"weather_captured_at" timestamp with time zone,
	"notes" text,
	"client_summary" text,
	"client_highlights" jsonb,
	"milestone" text,
	"milestone_type" "daily_log_milestone_type",
	"residential_hero_title" text,
	"residential_summary" text,
	"residential_mood" "daily_log_residential_mood",
	"residential_team_note" text,
	"residential_team_note_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_logs_project_date_unique" UNIQUE("project_id","log_date")
);
--> statement-breakpoint
CREATE TABLE "punch_item_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"punch_item_id" uuid NOT NULL,
	"author_user_id" uuid,
	"body" text NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "punch_item_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"punch_item_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"caption" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"uploaded_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "punch_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"sequential_number" integer NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"location" text,
	"priority" "punch_item_priority" DEFAULT 'normal' NOT NULL,
	"status" "punch_item_status" DEFAULT 'open' NOT NULL,
	"assignee_org_id" uuid,
	"assignee_user_id" uuid,
	"due_date" date,
	"created_by_user_id" uuid NOT NULL,
	"rejection_reason" text,
	"void_reason" text,
	"verified_by_user_id" uuid,
	"verified_at" timestamp with time zone,
	"last_transition_at" timestamp with time zone DEFAULT now() NOT NULL,
	"client_facing_note" text,
	"source_inspection_id" uuid,
	"source_inspection_result_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "punch_items_project_number_unique" UNIQUE("project_id","sequential_number")
);
--> statement-breakpoint
CREATE TABLE "submittal_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submittal_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"role" "submittal_document_role" NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"attached_by_user_id" uuid NOT NULL,
	"pin_version" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "submittal_documents_unique" UNIQUE("submittal_id","document_id","role")
);
--> statement-breakpoint
CREATE TABLE "submittal_transmittals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"submittal_id" uuid NOT NULL,
	"direction" "submittal_transmittal_direction" NOT NULL,
	"transmitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"transmitted_by_user_id" uuid NOT NULL,
	"document_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submittals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"sequential_number" integer NOT NULL,
	"spec_section" varchar(40) NOT NULL,
	"title" varchar(255) NOT NULL,
	"submittal_type" "submittal_type" NOT NULL,
	"submitted_by_org_id" uuid NOT NULL,
	"routed_to_org_id" uuid,
	"reviewer_name" varchar(200),
	"reviewer_org" varchar(200),
	"reviewer_email" varchar(320),
	"status" "submittal_status" DEFAULT 'draft' NOT NULL,
	"submitted_at" timestamp with time zone,
	"returned_at" timestamp with time zone,
	"revision_of_id" uuid,
	"due_date" date,
	"created_by_user_id" uuid NOT NULL,
	"rejection_reason" text,
	"last_transition_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "submittals_project_number_unique" UNIQUE("project_id","sequential_number")
);
--> statement-breakpoint
CREATE TABLE "weekly_report_sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"report_id" uuid NOT NULL,
	"section_type" "weekly_report_section_type" NOT NULL,
	"content" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weekly_report_sections_report_type_unique" UNIQUE("report_id","section_type")
);
--> statement-breakpoint
CREATE TABLE "weekly_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"week_end" date NOT NULL,
	"status" "weekly_report_status" DEFAULT 'auto_draft' NOT NULL,
	"summary_text" text,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"generated_by_user_id" uuid,
	"sent_at" timestamp with time zone,
	"sent_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weekly_reports_project_week_unique" UNIQUE("project_id","week_start")
);
--> statement-breakpoint
CREATE TABLE "cost_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"code" varchar(40) NOT NULL,
	"description" varchar(255) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cost_codes_org_code_unique" UNIQUE("organization_id","code")
);
--> statement-breakpoint
CREATE TABLE "purchase_order_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(12, 3) DEFAULT '0.000' NOT NULL,
	"unit" varchar(32) DEFAULT 'ea' NOT NULL,
	"unit_cost_cents" integer DEFAULT 0 NOT NULL,
	"received_quantity" numeric(12, 3) DEFAULT '0.000' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"po_number" varchar(40) NOT NULL,
	"vendor_id" uuid NOT NULL,
	"cost_code_id" uuid,
	"status" "procurement_po_status" DEFAULT 'draft' NOT NULL,
	"ordered_at" timestamp with time zone,
	"ordered_by_user_id" uuid,
	"expected_delivery_at" timestamp with time zone,
	"tax_rate_percent" numeric(5, 2) DEFAULT '0.00' NOT NULL,
	"notes" text,
	"revision_number" integer DEFAULT 1 NOT NULL,
	"last_revised_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_orders_org_po_number_unique" UNIQUE("organization_id","po_number")
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"contact_name" varchar(200),
	"contact_email" varchar(320),
	"contact_phone" varchar(40),
	"address" text,
	"payment_terms" varchar(120),
	"rating" "vendor_rating" DEFAULT 'standard' NOT NULL,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"report_type" text NOT NULL,
	"scope_description" text,
	"scope_filters" jsonb,
	"schedule_cron" text,
	"schedule_label" text,
	"schedule_timezone" text,
	"recipients" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_run_at" timestamp with time zone,
	"next_run_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_reports_schedule_coherence_check" CHECK ((
        "saved_reports"."schedule_cron" is null
        and "saved_reports"."schedule_label" is null
        and "saved_reports"."schedule_timezone" is null
        and "saved_reports"."next_run_at" is null
      ) or (
        "saved_reports"."schedule_cron" is not null
        and "saved_reports"."schedule_timezone" is not null
      ))
);
--> statement-breakpoint
CREATE TABLE "drawing_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sheet_id" uuid NOT NULL,
	"parent_comment_id" uuid,
	"user_id" uuid NOT NULL,
	"pin_number" integer,
	"x" numeric(5, 2) NOT NULL,
	"y" numeric(5, 2) NOT NULL,
	"text" text NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"resolved_by_user_id" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drawing_comments_sheet_pin_unique" UNIQUE("sheet_id","pin_number")
);
--> statement-breakpoint
CREATE TABLE "drawing_markups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sheet_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"markup_data" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drawing_markups_sheet_user_unique" UNIQUE("sheet_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "drawing_measurements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sheet_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"measurement_data" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drawing_measurements_sheet_user_unique" UNIQUE("sheet_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "drawing_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"family" varchar(64) NOT NULL,
	"name" varchar(160) NOT NULL,
	"version" integer NOT NULL,
	"status" "drawing_set_status" DEFAULT 'current' NOT NULL,
	"as_built" boolean DEFAULT false NOT NULL,
	"supersedes_id" uuid,
	"source_file_key" text,
	"file_size_bytes" bigint,
	"sheet_count" integer DEFAULT 0 NOT NULL,
	"uploaded_by_user_id" uuid NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processing_status" "drawing_set_processing_status" DEFAULT 'pending' NOT NULL,
	"processing_error" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drawing_sets_project_family_version_unique" UNIQUE("project_id","family","version")
);
--> statement-breakpoint
CREATE TABLE "drawing_sheets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"set_id" uuid NOT NULL,
	"page_index" integer NOT NULL,
	"sheet_number" varchar(40) NOT NULL,
	"sheet_title" varchar(255) NOT NULL,
	"discipline" char(1),
	"auto_detected" boolean DEFAULT false NOT NULL,
	"thumbnail_key" text,
	"changed_from_prior_version" boolean DEFAULT false NOT NULL,
	"calibration_scale" varchar(40),
	"calibration_source" "drawing_calibration_source",
	"calibrated_by_user_id" uuid,
	"calibrated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drawing_sheets_set_page_unique" UNIQUE("set_id","page_index")
);
--> statement-breakpoint
CREATE TABLE "inspection_result_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inspection_result_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"caption" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"uploaded_by_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inspection_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inspection_id" uuid NOT NULL,
	"line_item_key" varchar(80) NOT NULL,
	"outcome" "inspection_outcome" NOT NULL,
	"notes" text,
	"recorded_by_user_id" uuid,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inspection_results_inspection_key_unique" UNIQUE("inspection_id","line_item_key")
);
--> statement-breakpoint
CREATE TABLE "inspection_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(160) NOT NULL,
	"trade_category" varchar(40) NOT NULL,
	"phase" "inspection_phase" NOT NULL,
	"description" text,
	"line_items_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_custom" boolean DEFAULT false NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inspections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"sequential_number" integer NOT NULL,
	"template_id" uuid NOT NULL,
	"template_snapshot_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"zone" varchar(80) NOT NULL,
	"assigned_org_id" uuid,
	"assigned_user_id" uuid,
	"scheduled_date" date,
	"status" "inspection_status" DEFAULT 'scheduled' NOT NULL,
	"notes" text,
	"created_by_user_id" uuid NOT NULL,
	"completed_by_user_id" uuid,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inspections_project_number_unique" UNIQUE("project_id","sequential_number")
);
--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_accepted_by_user_id_users_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_certifications" ADD CONSTRAINT "organization_certifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_licenses" ADD CONSTRAINT "organization_licenses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_users" ADD CONSTRAINT "organization_users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_users" ADD CONSTRAINT "organization_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_assignments" ADD CONSTRAINT "role_assignments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_notification_preferences" ADD CONSTRAINT "user_notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_account" ADD CONSTRAINT "auth_account_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_session" ADD CONSTRAINT "auth_session_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "two_factor" ADD CONSTRAINT "two_factor_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."auth_user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone_dependencies" ADD CONSTRAINT "milestone_dependencies_predecessor_id_milestones_id_fk" FOREIGN KEY ("predecessor_id") REFERENCES "public"."milestones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestone_dependencies" ADD CONSTRAINT "milestone_dependencies_successor_id_milestones_id_fk" FOREIGN KEY ("successor_id") REFERENCES "public"."milestones"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_assigned_to_organization_id_organizations_id_fk" FOREIGN KEY ("assigned_to_organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_organization_memberships" ADD CONSTRAINT "project_organization_memberships_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_organization_memberships" ADD CONSTRAINT "project_organization_memberships_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_user_memberships" ADD CONSTRAINT "project_user_memberships_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_user_memberships" ADD CONSTRAINT "project_user_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_user_memberships" ADD CONSTRAINT "project_user_memberships_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_user_memberships" ADD CONSTRAINT "project_user_memberships_role_assignment_id_fk" FOREIGN KEY ("role_assignment_id") REFERENCES "public"."role_assignments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_contractor_organization_id_organizations_id_fk" FOREIGN KEY ("contractor_organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_links" ADD CONSTRAINT "document_links_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_supersedes_document_id_documents_id_fk" FOREIGN KEY ("supersedes_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_assigned_to_organization_id_organizations_id_fk" FOREIGN KEY ("assigned_to_organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_orders" ADD CONSTRAINT "change_orders_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_orders" ADD CONSTRAINT "change_orders_originating_rfi_id_rfis_id_fk" FOREIGN KEY ("originating_rfi_id") REFERENCES "public"."rfis"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_orders" ADD CONSTRAINT "change_orders_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_orders" ADD CONSTRAINT "change_orders_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_records" ADD CONSTRAINT "compliance_records_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_records" ADD CONSTRAINT "compliance_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_records" ADD CONSTRAINT "compliance_records_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfi_responses" ADD CONSTRAINT "rfi_responses_rfi_id_rfis_id_fk" FOREIGN KEY ("rfi_id") REFERENCES "public"."rfis"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfi_responses" ADD CONSTRAINT "rfi_responses_responded_by_user_id_users_id_fk" FOREIGN KEY ("responded_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfi_responses" ADD CONSTRAINT "rfi_responses_attached_document_id_documents_id_fk" FOREIGN KEY ("attached_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfis" ADD CONSTRAINT "rfis_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfis" ADD CONSTRAINT "rfis_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfis" ADD CONSTRAINT "rfis_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfis" ADD CONSTRAINT "rfis_assigned_to_organization_id_organizations_id_fk" FOREIGN KEY ("assigned_to_organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rfis" ADD CONSTRAINT "rfis_resulting_change_order_id_change_orders_id_fk" FOREIGN KEY ("resulting_change_order_id") REFERENCES "public"."change_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_requests" ADD CONSTRAINT "upload_requests_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_requests" ADD CONSTRAINT "upload_requests_requested_from_user_id_users_id_fk" FOREIGN KEY ("requested_from_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_requests" ADD CONSTRAINT "upload_requests_submitted_document_id_documents_id_fk" FOREIGN KEY ("submitted_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_requests" ADD CONSTRAINT "upload_requests_submitted_by_user_id_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_requests" ADD CONSTRAINT "upload_requests_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_requests" ADD CONSTRAINT "upload_requests_requested_from_organization_id_fk" FOREIGN KEY ("requested_from_organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_packages" ADD CONSTRAINT "billing_packages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_packages" ADD CONSTRAINT "billing_packages_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draw_line_items" ADD CONSTRAINT "draw_line_items_draw_request_id_draw_requests_id_fk" FOREIGN KEY ("draw_request_id") REFERENCES "public"."draw_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draw_line_items" ADD CONSTRAINT "draw_line_items_sov_line_item_id_sov_line_items_id_fk" FOREIGN KEY ("sov_line_item_id") REFERENCES "public"."sov_line_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draw_requests" ADD CONSTRAINT "draw_requests_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draw_requests" ADD CONSTRAINT "draw_requests_sov_id_schedule_of_values_id_fk" FOREIGN KEY ("sov_id") REFERENCES "public"."schedule_of_values"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draw_requests" ADD CONSTRAINT "draw_requests_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "draw_requests" ADD CONSTRAINT "draw_requests_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lien_waivers" ADD CONSTRAINT "lien_waivers_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lien_waivers" ADD CONSTRAINT "lien_waivers_draw_request_id_draw_requests_id_fk" FOREIGN KEY ("draw_request_id") REFERENCES "public"."draw_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lien_waivers" ADD CONSTRAINT "lien_waivers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lien_waivers" ADD CONSTRAINT "lien_waivers_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lien_waivers" ADD CONSTRAINT "lien_waivers_accepted_by_user_id_users_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retainage_releases" ADD CONSTRAINT "retainage_releases_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retainage_releases" ADD CONSTRAINT "retainage_releases_sov_line_item_id_sov_line_items_id_fk" FOREIGN KEY ("sov_line_item_id") REFERENCES "public"."sov_line_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retainage_releases" ADD CONSTRAINT "retainage_releases_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retainage_releases" ADD CONSTRAINT "retainage_releases_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retainage_releases" ADD CONSTRAINT "retainage_releases_consumed_by_draw_request_id_fk" FOREIGN KEY ("consumed_by_draw_request_id") REFERENCES "public"."draw_requests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_of_values" ADD CONSTRAINT "schedule_of_values_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_of_values" ADD CONSTRAINT "schedule_of_values_approved_by_user_id_users_id_fk" FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sov_line_items" ADD CONSTRAINT "sov_line_items_sov_id_schedule_of_values_id_fk" FOREIGN KEY ("sov_id") REFERENCES "public"."schedule_of_values"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sov_line_items" ADD CONSTRAINT "sov_line_items_change_order_id_change_orders_id_fk" FOREIGN KEY ("change_order_id") REFERENCES "public"."change_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_user_id_users_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_attached_document_id_documents_id_fk" FOREIGN KEY ("attached_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "selection_categories" ADD CONSTRAINT "selection_categories_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "selection_decisions" ADD CONSTRAINT "selection_decisions_selection_item_id_selection_items_id_fk" FOREIGN KEY ("selection_item_id") REFERENCES "public"."selection_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "selection_decisions" ADD CONSTRAINT "selection_decisions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "selection_decisions" ADD CONSTRAINT "selection_decisions_selected_option_id_selection_options_id_fk" FOREIGN KEY ("selected_option_id") REFERENCES "public"."selection_options"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "selection_decisions" ADD CONSTRAINT "selection_decisions_decided_by_user_id_users_id_fk" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "selection_decisions" ADD CONSTRAINT "selection_decisions_previous_option_id_selection_options_id_fk" FOREIGN KEY ("previous_option_id") REFERENCES "public"."selection_options"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "selection_items" ADD CONSTRAINT "selection_items_category_id_selection_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."selection_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "selection_items" ADD CONSTRAINT "selection_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "selection_items" ADD CONSTRAINT "selection_items_recommended_option_id_selection_options_id_fk" FOREIGN KEY ("recommended_option_id") REFERENCES "public"."selection_options"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "selection_items" ADD CONSTRAINT "selection_items_published_by_user_id_users_id_fk" FOREIGN KEY ("published_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "selection_options" ADD CONSTRAINT "selection_options_selection_item_id_selection_items_id_fk" FOREIGN KEY ("selection_item_id") REFERENCES "public"."selection_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "selection_options" ADD CONSTRAINT "selection_options_image_document_id_documents_id_fk" FOREIGN KEY ("image_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "selection_options" ADD CONSTRAINT "selection_options_spec_document_id_documents_id_fk" FOREIGN KEY ("spec_document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "integration_connections" ADD CONSTRAINT "integration_connections_connected_by_user_id_users_id_fk" FOREIGN KEY ("connected_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_initiated_by_user_id_users_id_fk" FOREIGN KEY ("initiated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_events" ADD CONSTRAINT "sync_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_events" ADD CONSTRAINT "sync_events_integration_connection_id_fk" FOREIGN KEY ("integration_connection_id") REFERENCES "public"."integration_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_feed_items" ADD CONSTRAINT "activity_feed_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_feed_items" ADD CONSTRAINT "activity_feed_items_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_source_audit_event_id_audit_events_id_fk" FOREIGN KEY ("source_audit_event_id") REFERENCES "public"."audit_events"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_subscriptions" ADD CONSTRAINT "organization_subscriptions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_subscriptions" ADD CONSTRAINT "organization_subscriptions_plan_id_subscription_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_customers" ADD CONSTRAINT "stripe_customers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_organization_subscription_id_fk" FOREIGN KEY ("organization_subscription_id") REFERENCES "public"."organization_subscriptions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_exports" ADD CONSTRAINT "data_exports_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_exports" ADD CONSTRAINT "data_exports_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sso_providers" ADD CONSTRAINT "sso_providers_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_log_amendments" ADD CONSTRAINT "daily_log_amendments_daily_log_id_daily_logs_id_fk" FOREIGN KEY ("daily_log_id") REFERENCES "public"."daily_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_log_amendments" ADD CONSTRAINT "daily_log_amendments_requested_by_user_id_users_id_fk" FOREIGN KEY ("requested_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_log_amendments" ADD CONSTRAINT "daily_log_amendments_reviewed_by_user_id_users_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_log_crew_entries" ADD CONSTRAINT "daily_log_crew_entries_daily_log_id_daily_logs_id_fk" FOREIGN KEY ("daily_log_id") REFERENCES "public"."daily_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_log_crew_entries" ADD CONSTRAINT "daily_log_crew_entries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_log_crew_entries" ADD CONSTRAINT "daily_log_crew_entries_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_log_crew_entries" ADD CONSTRAINT "daily_log_crew_entries_submitted_by_user_id_users_id_fk" FOREIGN KEY ("submitted_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_log_crew_entries" ADD CONSTRAINT "daily_log_crew_entries_reconciled_by_user_id_users_id_fk" FOREIGN KEY ("reconciled_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_log_delays" ADD CONSTRAINT "daily_log_delays_daily_log_id_daily_logs_id_fk" FOREIGN KEY ("daily_log_id") REFERENCES "public"."daily_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_log_issues" ADD CONSTRAINT "daily_log_issues_daily_log_id_daily_logs_id_fk" FOREIGN KEY ("daily_log_id") REFERENCES "public"."daily_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_log_photos" ADD CONSTRAINT "daily_log_photos_daily_log_id_daily_logs_id_fk" FOREIGN KEY ("daily_log_id") REFERENCES "public"."daily_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_log_photos" ADD CONSTRAINT "daily_log_photos_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_log_photos" ADD CONSTRAINT "daily_log_photos_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_logs" ADD CONSTRAINT "daily_logs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_logs" ADD CONSTRAINT "daily_logs_reported_by_user_id_users_id_fk" FOREIGN KEY ("reported_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_logs" ADD CONSTRAINT "daily_logs_residential_team_note_by_user_id_users_id_fk" FOREIGN KEY ("residential_team_note_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "punch_item_comments" ADD CONSTRAINT "punch_item_comments_punch_item_id_punch_items_id_fk" FOREIGN KEY ("punch_item_id") REFERENCES "public"."punch_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "punch_item_comments" ADD CONSTRAINT "punch_item_comments_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "punch_item_photos" ADD CONSTRAINT "punch_item_photos_punch_item_id_punch_items_id_fk" FOREIGN KEY ("punch_item_id") REFERENCES "public"."punch_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "punch_item_photos" ADD CONSTRAINT "punch_item_photos_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "punch_item_photos" ADD CONSTRAINT "punch_item_photos_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "punch_items" ADD CONSTRAINT "punch_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "punch_items" ADD CONSTRAINT "punch_items_assignee_org_id_organizations_id_fk" FOREIGN KEY ("assignee_org_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "punch_items" ADD CONSTRAINT "punch_items_assignee_user_id_users_id_fk" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "punch_items" ADD CONSTRAINT "punch_items_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "punch_items" ADD CONSTRAINT "punch_items_verified_by_user_id_users_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "punch_items" ADD CONSTRAINT "punch_items_source_inspection_id_inspections_id_fk" FOREIGN KEY ("source_inspection_id") REFERENCES "public"."inspections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "punch_items" ADD CONSTRAINT "punch_items_source_inspection_result_id_fk" FOREIGN KEY ("source_inspection_result_id") REFERENCES "public"."inspection_results"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submittal_documents" ADD CONSTRAINT "submittal_documents_submittal_id_submittals_id_fk" FOREIGN KEY ("submittal_id") REFERENCES "public"."submittals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submittal_documents" ADD CONSTRAINT "submittal_documents_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submittal_documents" ADD CONSTRAINT "submittal_documents_attached_by_user_id_users_id_fk" FOREIGN KEY ("attached_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submittal_transmittals" ADD CONSTRAINT "submittal_transmittals_submittal_id_submittals_id_fk" FOREIGN KEY ("submittal_id") REFERENCES "public"."submittals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submittal_transmittals" ADD CONSTRAINT "submittal_transmittals_transmitted_by_user_id_users_id_fk" FOREIGN KEY ("transmitted_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submittal_transmittals" ADD CONSTRAINT "submittal_transmittals_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submittals" ADD CONSTRAINT "submittals_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submittals" ADD CONSTRAINT "submittals_submitted_by_org_id_organizations_id_fk" FOREIGN KEY ("submitted_by_org_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submittals" ADD CONSTRAINT "submittals_routed_to_org_id_organizations_id_fk" FOREIGN KEY ("routed_to_org_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submittals" ADD CONSTRAINT "submittals_revision_of_id_submittals_id_fk" FOREIGN KEY ("revision_of_id") REFERENCES "public"."submittals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submittals" ADD CONSTRAINT "submittals_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_report_sections" ADD CONSTRAINT "weekly_report_sections_report_id_weekly_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."weekly_reports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_generated_by_user_id_users_id_fk" FOREIGN KEY ("generated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_reports" ADD CONSTRAINT "weekly_reports_sent_by_user_id_users_id_fk" FOREIGN KEY ("sent_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cost_codes" ADD CONSTRAINT "cost_codes_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_cost_code_id_cost_codes_id_fk" FOREIGN KEY ("cost_code_id") REFERENCES "public"."cost_codes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_ordered_by_user_id_users_id_fk" FOREIGN KEY ("ordered_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_reports" ADD CONSTRAINT "saved_reports_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_reports" ADD CONSTRAINT "saved_reports_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drawing_comments" ADD CONSTRAINT "drawing_comments_sheet_id_drawing_sheets_id_fk" FOREIGN KEY ("sheet_id") REFERENCES "public"."drawing_sheets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drawing_comments" ADD CONSTRAINT "drawing_comments_parent_comment_id_drawing_comments_id_fk" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."drawing_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drawing_comments" ADD CONSTRAINT "drawing_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drawing_comments" ADD CONSTRAINT "drawing_comments_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drawing_markups" ADD CONSTRAINT "drawing_markups_sheet_id_drawing_sheets_id_fk" FOREIGN KEY ("sheet_id") REFERENCES "public"."drawing_sheets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drawing_markups" ADD CONSTRAINT "drawing_markups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drawing_measurements" ADD CONSTRAINT "drawing_measurements_sheet_id_drawing_sheets_id_fk" FOREIGN KEY ("sheet_id") REFERENCES "public"."drawing_sheets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drawing_measurements" ADD CONSTRAINT "drawing_measurements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drawing_sets" ADD CONSTRAINT "drawing_sets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drawing_sets" ADD CONSTRAINT "drawing_sets_supersedes_id_drawing_sets_id_fk" FOREIGN KEY ("supersedes_id") REFERENCES "public"."drawing_sets"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drawing_sets" ADD CONSTRAINT "drawing_sets_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drawing_sheets" ADD CONSTRAINT "drawing_sheets_set_id_drawing_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."drawing_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drawing_sheets" ADD CONSTRAINT "drawing_sheets_calibrated_by_user_id_users_id_fk" FOREIGN KEY ("calibrated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_result_photos" ADD CONSTRAINT "inspection_result_photos_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_result_photos" ADD CONSTRAINT "inspection_result_photos_uploaded_by_user_id_users_id_fk" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_result_photos" ADD CONSTRAINT "inspection_result_photos_inspection_result_id_fk" FOREIGN KEY ("inspection_result_id") REFERENCES "public"."inspection_results"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_results" ADD CONSTRAINT "inspection_results_inspection_id_inspections_id_fk" FOREIGN KEY ("inspection_id") REFERENCES "public"."inspections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_results" ADD CONSTRAINT "inspection_results_recorded_by_user_id_users_id_fk" FOREIGN KEY ("recorded_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_templates" ADD CONSTRAINT "inspection_templates_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspection_templates" ADD CONSTRAINT "inspection_templates_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_template_id_inspection_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."inspection_templates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_assigned_org_id_organizations_id_fk" FOREIGN KEY ("assigned_org_id") REFERENCES "public"."organizations"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_assigned_user_id_users_id_fk" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inspections" ADD CONSTRAINT "inspections_completed_by_user_id_users_id_fk" FOREIGN KEY ("completed_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invitations_email_idx" ON "invitations" USING btree ("invited_email");--> statement-breakpoint
CREATE INDEX "invitations_project_idx" ON "invitations" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "invitations_status_idx" ON "invitations" USING btree ("invitation_status");--> statement-breakpoint
CREATE INDEX "invitations_scope_idx" ON "invitations" USING btree ("scope_object_type","scope_object_id");--> statement-breakpoint
CREATE INDEX "organization_certifications_org_idx" ON "organization_certifications" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "organization_licenses_org_idx" ON "organization_licenses" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "organization_users_org_idx" ON "organization_users" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "organization_users_user_idx" ON "organization_users" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "organizations_name_idx" ON "organizations" USING btree ("name");--> statement-breakpoint
CREATE INDEX "role_assignments_user_org_idx" ON "role_assignments" USING btree ("user_id","organization_id");--> statement-breakpoint
CREATE INDEX "role_assignments_portal_idx" ON "role_assignments" USING btree ("portal_type");--> statement-breakpoint
CREATE INDEX "user_notif_prefs_user_idx" ON "user_notification_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_account_user_idx" ON "auth_account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "auth_session_user_idx" ON "auth_session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "two_factor_user_idx" ON "two_factor" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "two_factor_secret_idx" ON "two_factor" USING btree ("secret");--> statement-breakpoint
CREATE INDEX "auth_user_app_user_idx" ON "auth_user" USING btree ("app_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "milestone_dependencies_edge_unique" ON "milestone_dependencies" USING btree ("predecessor_id","successor_id");--> statement-breakpoint
CREATE INDEX "milestone_dependencies_predecessor_idx" ON "milestone_dependencies" USING btree ("predecessor_id");--> statement-breakpoint
CREATE INDEX "milestone_dependencies_successor_idx" ON "milestone_dependencies" USING btree ("successor_id");--> statement-breakpoint
CREATE INDEX "milestones_project_idx" ON "milestones" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "milestones_scheduled_idx" ON "milestones" USING btree ("scheduled_date");--> statement-breakpoint
CREATE INDEX "milestones_status_idx" ON "milestones" USING btree ("milestone_status");--> statement-breakpoint
CREATE INDEX "milestones_project_schedule_idx" ON "milestones" USING btree ("project_id","scheduled_date");--> statement-breakpoint
CREATE INDEX "milestones_start_date_idx" ON "milestones" USING btree ("start_date");--> statement-breakpoint
CREATE INDEX "project_org_memberships_project_idx" ON "project_organization_memberships" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_org_memberships_org_idx" ON "project_organization_memberships" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "project_user_memberships_project_idx" ON "project_user_memberships" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_user_memberships_user_idx" ON "project_user_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "project_user_memberships_access_idx" ON "project_user_memberships" USING btree ("access_state");--> statement-breakpoint
CREATE INDEX "projects_contractor_org_idx" ON "projects" USING btree ("contractor_organization_id");--> statement-breakpoint
CREATE INDEX "projects_status_idx" ON "projects" USING btree ("project_status");--> statement-breakpoint
CREATE INDEX "document_links_document_idx" ON "document_links" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "document_links_object_idx" ON "document_links" USING btree ("linked_object_type","linked_object_id");--> statement-breakpoint
CREATE INDEX "documents_project_idx" ON "documents" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "documents_audience_idx" ON "documents" USING btree ("audience_scope");--> statement-breakpoint
CREATE INDEX "documents_supersedes_idx" ON "documents" USING btree ("supersedes_document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "documents_supersedes_unique" ON "documents" USING btree ("supersedes_document_id") WHERE "documents"."supersedes_document_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "approvals_project_idx" ON "approvals" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "approvals_status_idx" ON "approvals" USING btree ("approval_status");--> statement-breakpoint
CREATE INDEX "change_orders_project_idx" ON "change_orders" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "change_orders_status_idx" ON "change_orders" USING btree ("change_order_status");--> statement-breakpoint
CREATE INDEX "compliance_records_org_idx" ON "compliance_records" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "compliance_records_project_idx" ON "compliance_records" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "compliance_records_status_idx" ON "compliance_records" USING btree ("compliance_status");--> statement-breakpoint
CREATE INDEX "rfi_responses_rfi_idx" ON "rfi_responses" USING btree ("rfi_id");--> statement-breakpoint
CREATE INDEX "rfi_responses_responder_idx" ON "rfi_responses" USING btree ("responded_by_user_id");--> statement-breakpoint
CREATE INDEX "rfis_project_idx" ON "rfis" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "rfis_status_idx" ON "rfis" USING btree ("rfi_status");--> statement-breakpoint
CREATE INDEX "rfis_assigned_idx" ON "rfis" USING btree ("assigned_to_user_id");--> statement-breakpoint
CREATE INDEX "rfis_due_idx" ON "rfis" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "upload_requests_project_idx" ON "upload_requests" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "upload_requests_status_idx" ON "upload_requests" USING btree ("request_status");--> statement-breakpoint
CREATE INDEX "upload_requests_requested_org_idx" ON "upload_requests" USING btree ("requested_from_organization_id");--> statement-breakpoint
CREATE INDEX "billing_packages_project_idx" ON "billing_packages" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "billing_packages_status_idx" ON "billing_packages" USING btree ("billing_package_status");--> statement-breakpoint
CREATE INDEX "draw_line_items_draw_idx" ON "draw_line_items" USING btree ("draw_request_id");--> statement-breakpoint
CREATE INDEX "draw_line_items_sov_line_idx" ON "draw_line_items" USING btree ("sov_line_item_id");--> statement-breakpoint
CREATE INDEX "draw_requests_project_idx" ON "draw_requests" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "draw_requests_status_idx" ON "draw_requests" USING btree ("draw_request_status");--> statement-breakpoint
CREATE INDEX "draw_requests_sov_idx" ON "draw_requests" USING btree ("sov_id");--> statement-breakpoint
CREATE INDEX "lien_waivers_project_idx" ON "lien_waivers" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "lien_waivers_draw_idx" ON "lien_waivers" USING btree ("draw_request_id");--> statement-breakpoint
CREATE INDEX "lien_waivers_org_idx" ON "lien_waivers" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "lien_waivers_status_idx" ON "lien_waivers" USING btree ("lien_waiver_status");--> statement-breakpoint
CREATE INDEX "retainage_releases_project_idx" ON "retainage_releases" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "retainage_releases_status_idx" ON "retainage_releases" USING btree ("retainage_release_status");--> statement-breakpoint
CREATE INDEX "retainage_releases_sov_line_idx" ON "retainage_releases" USING btree ("sov_line_item_id");--> statement-breakpoint
CREATE INDEX "retainage_releases_consumed_by_idx" ON "retainage_releases" USING btree ("consumed_by_draw_request_id");--> statement-breakpoint
CREATE INDEX "retainage_releases_scheduled_release_at_idx" ON "retainage_releases" USING btree ("scheduled_release_at");--> statement-breakpoint
CREATE INDEX "retainage_releases_trigger_milestone_idx" ON "retainage_releases" USING btree ("release_trigger_milestone_id");--> statement-breakpoint
CREATE INDEX "sov_project_idx" ON "schedule_of_values" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "sov_line_items_sov_idx" ON "sov_line_items" USING btree ("sov_id");--> statement-breakpoint
CREATE INDEX "sov_line_items_cost_code_idx" ON "sov_line_items" USING btree ("cost_code");--> statement-breakpoint
CREATE INDEX "sov_line_items_co_idx" ON "sov_line_items" USING btree ("change_order_id");--> statement-breakpoint
CREATE INDEX "sov_line_items_active_idx" ON "sov_line_items" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "conversation_participants_conv_idx" ON "conversation_participants" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "conversation_participants_user_idx" ON "conversation_participants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "conversations_project_idx" ON "conversations" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "conversations_last_message_idx" ON "conversations" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX "conversations_linked_object_idx" ON "conversations" USING btree ("linked_object_type","linked_object_id");--> statement-breakpoint
CREATE INDEX "messages_conversation_idx" ON "messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "messages_sender_idx" ON "messages" USING btree ("sender_user_id");--> statement-breakpoint
CREATE INDEX "messages_created_idx" ON "messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "selection_categories_project_idx" ON "selection_categories" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "selection_decisions_item_idx" ON "selection_decisions" USING btree ("selection_item_id");--> statement-breakpoint
CREATE INDEX "selection_decisions_project_idx" ON "selection_decisions" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "selection_decisions_option_idx" ON "selection_decisions" USING btree ("selected_option_id");--> statement-breakpoint
CREATE INDEX "selection_items_category_idx" ON "selection_items" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "selection_items_project_idx" ON "selection_items" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "selection_items_status_idx" ON "selection_items" USING btree ("selection_item_status");--> statement-breakpoint
CREATE INDEX "selection_options_item_idx" ON "selection_options" USING btree ("selection_item_id");--> statement-breakpoint
CREATE INDEX "integration_connections_org_idx" ON "integration_connections" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "integration_connections_provider_idx" ON "integration_connections" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "integration_connections_status_idx" ON "integration_connections" USING btree ("connection_status");--> statement-breakpoint
CREATE INDEX "payment_transactions_org_idx" ON "payment_transactions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "payment_transactions_project_idx" ON "payment_transactions" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "payment_transactions_related_entity_idx" ON "payment_transactions" USING btree ("related_entity_type","related_entity_id");--> statement-breakpoint
CREATE INDEX "payment_transactions_status_idx" ON "payment_transactions" USING btree ("transaction_status");--> statement-breakpoint
CREATE INDEX "payment_transactions_stripe_pi_idx" ON "payment_transactions" USING btree ("stripe_payment_intent_id");--> statement-breakpoint
CREATE INDEX "payment_transactions_created_idx" ON "payment_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "sync_events_connection_idx" ON "sync_events" USING btree ("integration_connection_id");--> statement-breakpoint
CREATE INDEX "sync_events_org_idx" ON "sync_events" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "sync_events_status_idx" ON "sync_events" USING btree ("sync_event_status");--> statement-breakpoint
CREATE INDEX "sync_events_entity_idx" ON "sync_events" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "sync_events_idempotency_idx" ON "sync_events" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "sync_events_created_idx" ON "sync_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "webhook_events_org_idx" ON "webhook_events" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "webhook_events_direction_idx" ON "webhook_events" USING btree ("webhook_direction");--> statement-breakpoint
CREATE INDEX "webhook_events_status_idx" ON "webhook_events" USING btree ("delivery_status");--> statement-breakpoint
CREATE INDEX "webhook_events_event_type_idx" ON "webhook_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "webhook_events_event_id_idx" ON "webhook_events" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "webhook_events_source_idx" ON "webhook_events" USING btree ("source_provider");--> statement-breakpoint
CREATE INDEX "webhook_events_created_idx" ON "webhook_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "activity_feed_items_project_idx" ON "activity_feed_items" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "activity_feed_items_activity_idx" ON "activity_feed_items" USING btree ("activity_type");--> statement-breakpoint
CREATE INDEX "activity_feed_items_actor_idx" ON "activity_feed_items" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "audit_events_actor_idx" ON "audit_events" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "audit_events_project_idx" ON "audit_events" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "audit_events_object_idx" ON "audit_events" USING btree ("object_type","object_id");--> statement-breakpoint
CREATE INDEX "notifications_recipient_unread_idx" ON "notifications" USING btree ("recipient_user_id","read_at");--> statement-breakpoint
CREATE INDEX "notifications_recipient_created_idx" ON "notifications" USING btree ("recipient_user_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_project_idx" ON "notifications" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "organization_subscriptions_plan_idx" ON "organization_subscriptions" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "organization_subscriptions_status_idx" ON "organization_subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "subscription_invoices_subscription_idx" ON "subscription_invoices" USING btree ("organization_subscription_id");--> statement-breakpoint
CREATE INDEX "data_exports_org_idx" ON "data_exports" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "data_exports_status_idx" ON "data_exports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "data_exports_org_created_idx" ON "data_exports" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "sso_providers_status_idx" ON "sso_providers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "daily_log_amendments_log_idx" ON "daily_log_amendments" USING btree ("daily_log_id");--> statement-breakpoint
CREATE INDEX "daily_log_amendments_status_idx" ON "daily_log_amendments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "daily_log_crew_entries_org_date_idx" ON "daily_log_crew_entries" USING btree ("org_id","log_date");--> statement-breakpoint
CREATE INDEX "daily_log_crew_entries_log_idx" ON "daily_log_crew_entries" USING btree ("daily_log_id");--> statement-breakpoint
CREATE INDEX "daily_log_delays_log_idx" ON "daily_log_delays" USING btree ("daily_log_id");--> statement-breakpoint
CREATE INDEX "daily_log_issues_log_idx" ON "daily_log_issues" USING btree ("daily_log_id");--> statement-breakpoint
CREATE INDEX "daily_log_photos_log_idx" ON "daily_log_photos" USING btree ("daily_log_id");--> statement-breakpoint
CREATE UNIQUE INDEX "daily_log_photos_one_hero_per_log" ON "daily_log_photos" USING btree ("daily_log_id") WHERE "daily_log_photos"."is_hero" = true;--> statement-breakpoint
CREATE INDEX "daily_logs_project_status_date_idx" ON "daily_logs" USING btree ("project_id","status","log_date");--> statement-breakpoint
CREATE INDEX "daily_logs_reported_by_idx" ON "daily_logs" USING btree ("reported_by_user_id");--> statement-breakpoint
CREATE INDEX "punch_item_comments_item_idx" ON "punch_item_comments" USING btree ("punch_item_id");--> statement-breakpoint
CREATE INDEX "punch_item_photos_item_idx" ON "punch_item_photos" USING btree ("punch_item_id");--> statement-breakpoint
CREATE INDEX "punch_items_project_status_priority_idx" ON "punch_items" USING btree ("project_id","status","priority");--> statement-breakpoint
CREATE INDEX "punch_items_assignee_status_idx" ON "punch_items" USING btree ("assignee_org_id","status");--> statement-breakpoint
CREATE INDEX "punch_items_source_inspection_idx" ON "punch_items" USING btree ("source_inspection_id");--> statement-breakpoint
CREATE INDEX "submittal_documents_submittal_idx" ON "submittal_documents" USING btree ("submittal_id");--> statement-breakpoint
CREATE INDEX "submittal_transmittals_submittal_idx" ON "submittal_transmittals" USING btree ("submittal_id","transmitted_at");--> statement-breakpoint
CREATE INDEX "submittals_project_status_idx" ON "submittals" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "submittals_spec_section_idx" ON "submittals" USING btree ("project_id","spec_section");--> statement-breakpoint
CREATE INDEX "submittals_submitted_by_org_idx" ON "submittals" USING btree ("submitted_by_org_id","status");--> statement-breakpoint
CREATE INDEX "submittals_revision_of_idx" ON "submittals" USING btree ("revision_of_id");--> statement-breakpoint
CREATE INDEX "weekly_report_sections_report_idx" ON "weekly_report_sections" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "weekly_reports_project_idx" ON "weekly_reports" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "weekly_reports_status_idx" ON "weekly_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "weekly_reports_sent_at_idx" ON "weekly_reports" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "cost_codes_org_active_idx" ON "cost_codes" USING btree ("organization_id","active");--> statement-breakpoint
CREATE INDEX "purchase_order_lines_po_idx" ON "purchase_order_lines" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "purchase_orders_project_status_idx" ON "purchase_orders" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "purchase_orders_org_status_idx" ON "purchase_orders" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "purchase_orders_vendor_idx" ON "purchase_orders" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "purchase_orders_cost_code_idx" ON "purchase_orders" USING btree ("cost_code_id");--> statement-breakpoint
CREATE INDEX "vendors_org_name_idx" ON "vendors" USING btree ("organization_id","name");--> statement-breakpoint
CREATE INDEX "vendors_org_active_idx" ON "vendors" USING btree ("organization_id","active");--> statement-breakpoint
CREATE INDEX "saved_reports_organization_id_idx" ON "saved_reports" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "saved_reports_owner_user_id_idx" ON "saved_reports" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "saved_reports_org_created_idx" ON "saved_reports" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "saved_reports_next_run_at_idx" ON "saved_reports" USING btree ("next_run_at") WHERE "saved_reports"."schedule_cron" is not null;--> statement-breakpoint
CREATE INDEX "drawing_comments_sheet_idx" ON "drawing_comments" USING btree ("sheet_id");--> statement-breakpoint
CREATE INDEX "drawing_comments_sheet_resolved_idx" ON "drawing_comments" USING btree ("sheet_id","resolved");--> statement-breakpoint
CREATE INDEX "drawing_comments_parent_idx" ON "drawing_comments" USING btree ("parent_comment_id");--> statement-breakpoint
CREATE INDEX "drawing_markups_sheet_idx" ON "drawing_markups" USING btree ("sheet_id");--> statement-breakpoint
CREATE INDEX "drawing_measurements_sheet_idx" ON "drawing_measurements" USING btree ("sheet_id");--> statement-breakpoint
CREATE INDEX "drawing_sets_project_idx" ON "drawing_sets" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "drawing_sets_project_status_idx" ON "drawing_sets" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "drawing_sets_family_idx" ON "drawing_sets" USING btree ("project_id","family");--> statement-breakpoint
CREATE INDEX "drawing_sheets_set_idx" ON "drawing_sheets" USING btree ("set_id");--> statement-breakpoint
CREATE INDEX "drawing_sheets_set_discipline_idx" ON "drawing_sheets" USING btree ("set_id","discipline");--> statement-breakpoint
CREATE INDEX "drawing_sheets_set_sheet_number_idx" ON "drawing_sheets" USING btree ("set_id","sheet_number");--> statement-breakpoint
CREATE INDEX "inspection_result_photos_result_idx" ON "inspection_result_photos" USING btree ("inspection_result_id");--> statement-breakpoint
CREATE INDEX "inspection_results_inspection_idx" ON "inspection_results" USING btree ("inspection_id");--> statement-breakpoint
CREATE INDEX "inspection_templates_org_archived_idx" ON "inspection_templates" USING btree ("org_id","is_archived");--> statement-breakpoint
CREATE INDEX "inspection_templates_org_trade_idx" ON "inspection_templates" USING btree ("org_id","trade_category");--> statement-breakpoint
CREATE INDEX "inspections_project_status_idx" ON "inspections" USING btree ("project_id","status");--> statement-breakpoint
CREATE INDEX "inspections_assigned_org_status_idx" ON "inspections" USING btree ("assigned_org_id","status");--> statement-breakpoint
CREATE INDEX "inspections_template_idx" ON "inspections" USING btree ("template_id");