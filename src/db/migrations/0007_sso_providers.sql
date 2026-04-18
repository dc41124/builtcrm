-- Migration: SSO providers table (Session 1 of SSO/SAML phase)
-- Date: 2026-04-17
-- Context: per-contractor-org SAML 2.0 IdP config. Enterprise-gated via
-- src/domain/policies/plan.ts (sso.saml feature key). One row per org —
-- multi-provider support is future scope. certificate_pem holds the IdP
-- signing certificate in public PEM form; no KMS needed for public key
-- material. ACS and initiate routes land in Session 2 with samlify.

CREATE TABLE IF NOT EXISTS "sso_providers" (
  "id"                      uuid         PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id"         uuid         NOT NULL,
  "name"                    varchar(120) NOT NULL,
  "entity_id"               text         NOT NULL,
  "sso_url"                 text         NOT NULL,
  "certificate_pem"         text         NOT NULL,
  "allowed_email_domain"    varchar(253) NOT NULL,
  "status"                  text         NOT NULL DEFAULT 'active',
  "last_login_at"           timestamp with time zone,
  "created_at"              timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at"              timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "sso_providers_organization_id_unique" UNIQUE ("organization_id"),
  CONSTRAINT "sso_providers_organization_id_fk" FOREIGN KEY ("organization_id")
    REFERENCES "organizations"("id") ON DELETE CASCADE,
  CONSTRAINT "sso_providers_status_check"
    CHECK (status IN ('active','disabled'))
);

CREATE INDEX IF NOT EXISTS "sso_providers_status_idx"
  ON "sso_providers" ("status");

COMMENT ON COLUMN "sso_providers"."certificate_pem" IS
  'IdP signing certificate in PEM form. Public material — stored plaintext. Used by samlify in Session 2 to verify SAML responses.';
COMMENT ON COLUMN "sso_providers"."allowed_email_domain" IS
  'Defence-in-depth domain lock: emails outside this domain are refused even if the IdP asserts them.';
