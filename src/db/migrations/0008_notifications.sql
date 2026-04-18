-- Migration: notifications (in-app notification inbox)
-- Date: 2026-04-18
-- Context: per-user notification delivery table. Written at emit time
-- with portal-specific title/body/linkUrl already baked in, so rows
-- render as-is. See src/db/schema/notifications.ts + src/lib/notifications/emit.ts
-- for the emission pipeline and tolerate-duplicates dedup choice.

CREATE TABLE IF NOT EXISTS "notifications" (
  "id"                        uuid                          PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "recipient_user_id"         uuid                          NOT NULL,
  "portal_type"               notification_portal           NOT NULL,
  "event_id"                  varchar(120)                  NOT NULL,
  "title"                     varchar(255)                  NOT NULL,
  "body"                      text,
  "link_url"                  varchar(500),
  "project_id"                uuid,
  "related_object_type"       varchar(120),
  "related_object_id"         uuid,
  "source_audit_event_id"     uuid,
  "created_at"                timestamp with time zone      DEFAULT now() NOT NULL,
  "read_at"                   timestamp with time zone,
  CONSTRAINT "notifications_recipient_user_id_fk"
    FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "notifications_project_id_fk"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE,
  CONSTRAINT "notifications_source_audit_event_id_fk"
    FOREIGN KEY ("source_audit_event_id") REFERENCES "audit_events"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "notifications_recipient_unread_idx"
  ON "notifications" ("recipient_user_id", "read_at");
CREATE INDEX IF NOT EXISTS "notifications_recipient_created_idx"
  ON "notifications" ("recipient_user_id", "created_at");
CREATE INDEX IF NOT EXISTS "notifications_project_idx"
  ON "notifications" ("project_id");
