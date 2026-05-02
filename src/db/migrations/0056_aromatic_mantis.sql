CREATE TYPE "public"."retention_class" AS ENUM('statutory_tax', 'statutory_construction', 'project_record', 'operational', 'auth_ephemeral', 'design_archive', 'privacy_fulfillment', 'contract_signature_audit');--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN "retention_class" "retention_class" DEFAULT 'auth_ephemeral' NOT NULL;--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "invitations" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "auth_account" ADD COLUMN "retention_class" "retention_class" DEFAULT 'auth_ephemeral' NOT NULL;--> statement-breakpoint
ALTER TABLE "auth_account" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "auth_account" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "auth_session" ADD COLUMN "retention_class" "retention_class" DEFAULT 'auth_ephemeral' NOT NULL;--> statement-breakpoint
ALTER TABLE "auth_session" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "auth_session" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "two_factor" ADD COLUMN "retention_class" "retention_class" DEFAULT 'auth_ephemeral' NOT NULL;--> statement-breakpoint
ALTER TABLE "two_factor" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "two_factor" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "auth_verification" ADD COLUMN "retention_class" "retention_class" DEFAULT 'auth_ephemeral' NOT NULL;--> statement-breakpoint
ALTER TABLE "auth_verification" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "auth_verification" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "milestone_dependencies" ADD COLUMN "retention_class" "retention_class" DEFAULT 'project_record' NOT NULL;--> statement-breakpoint
ALTER TABLE "milestone_dependencies" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "milestone_dependencies" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "milestones" ADD COLUMN "retention_class" "retention_class" DEFAULT 'project_record' NOT NULL;--> statement-breakpoint
ALTER TABLE "milestones" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "milestones" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "project_organization_memberships" ADD COLUMN "retention_class" "retention_class" DEFAULT 'project_record' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_organization_memberships" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "project_organization_memberships" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "project_user_memberships" ADD COLUMN "retention_class" "retention_class" DEFAULT 'project_record' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_user_memberships" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "project_user_memberships" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "retention_class" "retention_class" DEFAULT 'project_record' NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "document_links" ADD COLUMN "retention_class" "retention_class" DEFAULT 'project_record' NOT NULL;--> statement-breakpoint
ALTER TABLE "document_links" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "document_links" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "retention_class" "retention_class" DEFAULT 'project_record' NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "approvals" ADD COLUMN "retention_class" "retention_class" DEFAULT 'project_record' NOT NULL;--> statement-breakpoint
ALTER TABLE "approvals" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "approvals" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "change_orders" ADD COLUMN "retention_class" "retention_class" DEFAULT 'statutory_construction' NOT NULL;--> statement-breakpoint
ALTER TABLE "change_orders" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "change_orders" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "compliance_records" ADD COLUMN "retention_class" "retention_class" DEFAULT 'project_record' NOT NULL;--> statement-breakpoint
ALTER TABLE "compliance_records" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "compliance_records" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "rfi_responses" ADD COLUMN "retention_class" "retention_class" DEFAULT 'project_record' NOT NULL;--> statement-breakpoint
ALTER TABLE "rfi_responses" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rfi_responses" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "rfis" ADD COLUMN "retention_class" "retention_class" DEFAULT 'project_record' NOT NULL;--> statement-breakpoint
ALTER TABLE "rfis" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rfis" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "upload_requests" ADD COLUMN "retention_class" "retention_class" DEFAULT 'project_record' NOT NULL;--> statement-breakpoint
ALTER TABLE "upload_requests" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "upload_requests" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_packages" ADD COLUMN "retention_class" "retention_class" DEFAULT 'statutory_tax' NOT NULL;--> statement-breakpoint
ALTER TABLE "billing_packages" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "billing_packages" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "draw_line_items" ADD COLUMN "retention_class" "retention_class" DEFAULT 'statutory_tax' NOT NULL;--> statement-breakpoint
ALTER TABLE "draw_line_items" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "draw_line_items" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "draw_requests" ADD COLUMN "retention_class" "retention_class" DEFAULT 'statutory_tax' NOT NULL;--> statement-breakpoint
ALTER TABLE "draw_requests" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "draw_requests" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "lien_waivers" ADD COLUMN "retention_class" "retention_class" DEFAULT 'statutory_construction' NOT NULL;--> statement-breakpoint
ALTER TABLE "lien_waivers" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "lien_waivers" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "retainage_releases" ADD COLUMN "retention_class" "retention_class" DEFAULT 'statutory_construction' NOT NULL;--> statement-breakpoint
ALTER TABLE "retainage_releases" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "retainage_releases" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "schedule_of_values" ADD COLUMN "retention_class" "retention_class" DEFAULT 'statutory_construction' NOT NULL;--> statement-breakpoint
ALTER TABLE "schedule_of_values" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "schedule_of_values" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sov_line_items" ADD COLUMN "retention_class" "retention_class" DEFAULT 'statutory_construction' NOT NULL;--> statement-breakpoint
ALTER TABLE "sov_line_items" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sov_line_items" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "conversation_participants" ADD COLUMN "retention_class" "retention_class" DEFAULT 'operational' NOT NULL;--> statement-breakpoint
ALTER TABLE "conversation_participants" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "conversation_participants" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "retention_class" "retention_class" DEFAULT 'operational' NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "retention_class" "retention_class" DEFAULT 'operational' NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "selection_categories" ADD COLUMN "retention_class" "retention_class" DEFAULT 'project_record' NOT NULL;--> statement-breakpoint
ALTER TABLE "selection_categories" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "selection_categories" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "selection_decisions" ADD COLUMN "retention_class" "retention_class" DEFAULT 'project_record' NOT NULL;--> statement-breakpoint
ALTER TABLE "selection_decisions" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "selection_decisions" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "selection_items" ADD COLUMN "retention_class" "retention_class" DEFAULT 'project_record' NOT NULL;--> statement-breakpoint
ALTER TABLE "selection_items" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "selection_items" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "selection_options" ADD COLUMN "retention_class" "retention_class" DEFAULT 'project_record' NOT NULL;--> statement-breakpoint
ALTER TABLE "selection_options" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "selection_options" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "integration_connections" ADD COLUMN "retention_class" "retention_class" DEFAULT 'operational' NOT NULL;--> statement-breakpoint
ALTER TABLE "integration_connections" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "integration_connections" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD COLUMN "retention_class" "retention_class" DEFAULT 'statutory_tax' NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sync_events" ADD COLUMN "retention_class" "retention_class" DEFAULT 'operational' NOT NULL;--> statement-breakpoint
ALTER TABLE "sync_events" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sync_events" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD COLUMN "retention_class" "retention_class" DEFAULT 'operational' NOT NULL;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "activity_feed_items" ADD COLUMN "retention_class" "retention_class" DEFAULT 'operational' NOT NULL;--> statement-breakpoint
ALTER TABLE "activity_feed_items" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "activity_feed_items" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN "retention_class" "retention_class" DEFAULT 'statutory_construction' NOT NULL;--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "audit_events" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "retention_class" "retention_class" DEFAULT 'operational' NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_subscriptions" ADD COLUMN "retention_class" "retention_class" DEFAULT 'statutory_tax' NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_subscriptions" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "organization_subscriptions" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "stripe_customers" ADD COLUMN "retention_class" "retention_class" DEFAULT 'statutory_tax' NOT NULL;--> statement-breakpoint
ALTER TABLE "stripe_customers" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "stripe_customers" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_invoices" ADD COLUMN "retention_class" "retention_class" DEFAULT 'statutory_tax' NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_invoices" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscription_invoices" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "data_exports" ADD COLUMN "retention_class" "retention_class" DEFAULT 'operational' NOT NULL;--> statement-breakpoint
ALTER TABLE "data_exports" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "data_exports" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_log_amendments" ADD COLUMN "retention_class" "retention_class" DEFAULT 'project_record' NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_log_amendments" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "daily_log_amendments" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_log_crew_entries" ADD COLUMN "retention_class" "retention_class" DEFAULT 'project_record' NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_log_crew_entries" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "daily_log_crew_entries" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_log_delays" ADD COLUMN "retention_class" "retention_class" DEFAULT 'project_record' NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_log_delays" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "daily_log_delays" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_log_issues" ADD COLUMN "retention_class" "retention_class" DEFAULT 'project_record' NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_log_issues" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "daily_log_issues" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_log_photos" ADD COLUMN "retention_class" "retention_class" DEFAULT 'project_record' NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_log_photos" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "daily_log_photos" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_logs" ADD COLUMN "retention_class" "retention_class" DEFAULT 'project_record' NOT NULL;--> statement-breakpoint
ALTER TABLE "daily_logs" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "daily_logs" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "punch_item_comments" ADD COLUMN "retention_class" "retention_class" DEFAULT 'project_record' NOT NULL;--> statement-breakpoint
ALTER TABLE "punch_item_comments" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "punch_item_comments" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "punch_item_photos" ADD COLUMN "retention_class" "retention_class" DEFAULT 'project_record' NOT NULL;--> statement-breakpoint
ALTER TABLE "punch_item_photos" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "punch_item_photos" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "punch_items" ADD COLUMN "retention_class" "retention_class" DEFAULT 'project_record' NOT NULL;--> statement-breakpoint
ALTER TABLE "punch_items" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "punch_items" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "submittal_documents" ADD COLUMN "retention_class" "retention_class" DEFAULT 'project_record' NOT NULL;--> statement-breakpoint
ALTER TABLE "submittal_documents" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "submittal_documents" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "submittal_transmittals" ADD COLUMN "retention_class" "retention_class" DEFAULT 'project_record' NOT NULL;--> statement-breakpoint
ALTER TABLE "submittal_transmittals" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "submittal_transmittals" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "submittals" ADD COLUMN "retention_class" "retention_class" DEFAULT 'project_record' NOT NULL;--> statement-breakpoint
ALTER TABLE "submittals" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "submittals" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "weekly_report_sections" ADD COLUMN "retention_class" "retention_class" DEFAULT 'project_record' NOT NULL;--> statement-breakpoint
ALTER TABLE "weekly_report_sections" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "weekly_report_sections" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "weekly_reports" ADD COLUMN "retention_class" "retention_class" DEFAULT 'project_record' NOT NULL;--> statement-breakpoint
ALTER TABLE "weekly_reports" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "weekly_reports" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD COLUMN "retention_class" "retention_class" DEFAULT 'statutory_tax' NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "retention_class" "retention_class" DEFAULT 'statutory_tax' NOT NULL;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "saved_reports" ADD COLUMN "retention_class" "retention_class" DEFAULT 'operational' NOT NULL;--> statement-breakpoint
ALTER TABLE "saved_reports" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "saved_reports" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "drawing_comments" ADD COLUMN "retention_class" "retention_class" DEFAULT 'design_archive' NOT NULL;--> statement-breakpoint
ALTER TABLE "drawing_comments" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "drawing_comments" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "drawing_markups" ADD COLUMN "retention_class" "retention_class" DEFAULT 'design_archive' NOT NULL;--> statement-breakpoint
ALTER TABLE "drawing_markups" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "drawing_markups" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "drawing_measurements" ADD COLUMN "retention_class" "retention_class" DEFAULT 'design_archive' NOT NULL;--> statement-breakpoint
ALTER TABLE "drawing_measurements" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "drawing_measurements" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "drawing_sets" ADD COLUMN "retention_class" "retention_class" DEFAULT 'design_archive' NOT NULL;--> statement-breakpoint
ALTER TABLE "drawing_sets" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "drawing_sets" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "drawing_sheets" ADD COLUMN "retention_class" "retention_class" DEFAULT 'design_archive' NOT NULL;--> statement-breakpoint
ALTER TABLE "drawing_sheets" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "drawing_sheets" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "inspection_result_photos" ADD COLUMN "retention_class" "retention_class" DEFAULT 'project_record' NOT NULL;--> statement-breakpoint
ALTER TABLE "inspection_result_photos" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "inspection_result_photos" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "inspection_results" ADD COLUMN "retention_class" "retention_class" DEFAULT 'project_record' NOT NULL;--> statement-breakpoint
ALTER TABLE "inspection_results" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "inspection_results" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "inspections" ADD COLUMN "retention_class" "retention_class" DEFAULT 'project_record' NOT NULL;--> statement-breakpoint
ALTER TABLE "inspections" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "inspections" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "meeting_action_items" ADD COLUMN "retention_class" "retention_class" DEFAULT 'project_record' NOT NULL;--> statement-breakpoint
ALTER TABLE "meeting_action_items" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "meeting_action_items" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "meeting_agenda_items" ADD COLUMN "retention_class" "retention_class" DEFAULT 'project_record' NOT NULL;--> statement-breakpoint
ALTER TABLE "meeting_agenda_items" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "meeting_agenda_items" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "meeting_attendees" ADD COLUMN "retention_class" "retention_class" DEFAULT 'project_record' NOT NULL;--> statement-breakpoint
ALTER TABLE "meeting_attendees" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "meeting_attendees" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "meeting_minutes" ADD COLUMN "retention_class" "retention_class" DEFAULT 'project_record' NOT NULL;--> statement-breakpoint
ALTER TABLE "meeting_minutes" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "meeting_minutes" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "retention_class" "retention_class" DEFAULT 'project_record' NOT NULL;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "transmittal_access_events" ADD COLUMN "retention_class" "retention_class" DEFAULT 'project_record' NOT NULL;--> statement-breakpoint
ALTER TABLE "transmittal_access_events" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "transmittal_access_events" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "transmittal_documents" ADD COLUMN "retention_class" "retention_class" DEFAULT 'project_record' NOT NULL;--> statement-breakpoint
ALTER TABLE "transmittal_documents" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "transmittal_documents" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "transmittal_recipients" ADD COLUMN "retention_class" "retention_class" DEFAULT 'project_record' NOT NULL;--> statement-breakpoint
ALTER TABLE "transmittal_recipients" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "transmittal_recipients" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "transmittals" ADD COLUMN "retention_class" "retention_class" DEFAULT 'project_record' NOT NULL;--> statement-breakpoint
ALTER TABLE "transmittals" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "transmittals" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "closeout_package_comments" ADD COLUMN "retention_class" "retention_class" DEFAULT 'project_record' NOT NULL;--> statement-breakpoint
ALTER TABLE "closeout_package_comments" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "closeout_package_comments" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "closeout_package_items" ADD COLUMN "retention_class" "retention_class" DEFAULT 'project_record' NOT NULL;--> statement-breakpoint
ALTER TABLE "closeout_package_items" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "closeout_package_items" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "closeout_package_sections" ADD COLUMN "retention_class" "retention_class" DEFAULT 'project_record' NOT NULL;--> statement-breakpoint
ALTER TABLE "closeout_package_sections" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "closeout_package_sections" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "closeout_packages" ADD COLUMN "retention_class" "retention_class" DEFAULT 'project_record' NOT NULL;--> statement-breakpoint
ALTER TABLE "closeout_packages" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "closeout_packages" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "prequal_documents" ADD COLUMN "retention_class" "retention_class" DEFAULT 'statutory_construction' NOT NULL;--> statement-breakpoint
ALTER TABLE "prequal_documents" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "prequal_documents" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "prequal_project_exemptions" ADD COLUMN "retention_class" "retention_class" DEFAULT 'statutory_construction' NOT NULL;--> statement-breakpoint
ALTER TABLE "prequal_project_exemptions" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "prequal_project_exemptions" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "prequal_submissions" ADD COLUMN "retention_class" "retention_class" DEFAULT 'statutory_construction' NOT NULL;--> statement-breakpoint
ALTER TABLE "prequal_submissions" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "prequal_submissions" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "safety_form_incidents" ADD COLUMN "retention_class" "retention_class" DEFAULT 'project_record' NOT NULL;--> statement-breakpoint
ALTER TABLE "safety_form_incidents" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "safety_form_incidents" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "safety_forms" ADD COLUMN "retention_class" "retention_class" DEFAULT 'project_record' NOT NULL;--> statement-breakpoint
ALTER TABLE "safety_forms" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "safety_forms" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN "retention_class" "retention_class" DEFAULT 'statutory_construction' NOT NULL;--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "time_entries" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "time_entry_amendments" ADD COLUMN "retention_class" "retention_class" DEFAULT 'statutory_construction' NOT NULL;--> statement-breakpoint
ALTER TABLE "time_entry_amendments" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "time_entry_amendments" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "photo_pins" ADD COLUMN "retention_class" "retention_class" DEFAULT 'design_archive' NOT NULL;--> statement-breakpoint
ALTER TABLE "photo_pins" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "photo_pins" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD COLUMN "retention_class" "retention_class" DEFAULT 'operational' NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "retention_class" "retention_class" DEFAULT 'auth_ephemeral' NOT NULL;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "api_keys" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "custom_field_values" ADD COLUMN "retention_class" "retention_class" DEFAULT 'project_record' NOT NULL;--> statement-breakpoint
ALTER TABLE "custom_field_values" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "custom_field_values" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "breach_notification_drafts" ADD COLUMN "retention_class" "retention_class" DEFAULT 'privacy_fulfillment' NOT NULL;--> statement-breakpoint
ALTER TABLE "breach_notification_drafts" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "breach_notification_drafts" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "breach_register" ADD COLUMN "retention_class" "retention_class" DEFAULT 'privacy_fulfillment' NOT NULL;--> statement-breakpoint
ALTER TABLE "breach_register" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "breach_register" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "consent_records" ADD COLUMN "retention_class" "retention_class" DEFAULT 'privacy_fulfillment' NOT NULL;--> statement-breakpoint
ALTER TABLE "consent_records" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "consent_records" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "dsar_requests" ADD COLUMN "retention_class" "retention_class" DEFAULT 'privacy_fulfillment' NOT NULL;--> statement-breakpoint
ALTER TABLE "dsar_requests" ADD COLUMN "retention_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "dsar_requests" ADD COLUMN "legal_hold" boolean DEFAULT false NOT NULL;