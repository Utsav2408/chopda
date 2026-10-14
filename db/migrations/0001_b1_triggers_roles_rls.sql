-- B1-06: published flow_steps are immutable (UPDATE/DELETE blocked).
CREATE OR REPLACE FUNCTION block_published_flow_step_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_version_id uuid;
BEGIN
  v_version_id := COALESCE(NEW.version_id, OLD.version_id);
  IF EXISTS (
    SELECT 1
    FROM flow_versions fv
    WHERE fv.id = v_version_id
      AND fv.published_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Cannot modify steps of a published flow version'
      USING ERRCODE = 'check_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER trg_flow_steps_block_published
  BEFORE UPDATE OR DELETE ON flow_steps
  FOR EACH ROW
  EXECUTE FUNCTION block_published_flow_step_mutation();
--> statement-breakpoint
-- B1-08: invoice_steps forward-only status + in-order completion.
CREATE OR REPLACE FUNCTION enforce_invoice_step_rules()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_position integer;
  v_version_id uuid;
  v_prev_incomplete integer;
BEGIN
  IF TG_OP = 'UPDATE'
     AND OLD.status = 'completed'
     AND NEW.status IS DISTINCT FROM 'completed' THEN
    RAISE EXCEPTION 'invoice_steps status is forward-only'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.status = 'completed'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'completed') THEN
    SELECT fs.position, fs.version_id
      INTO v_position, v_version_id
    FROM flow_steps fs
    WHERE fs.id = NEW.flow_step_id;

    IF v_position IS NULL THEN
      RAISE EXCEPTION 'invoice_steps flow_step_id not found'
        USING ERRCODE = 'foreign_key_violation';
    END IF;

    SELECT COUNT(*)::integer
      INTO v_prev_incomplete
    FROM flow_steps fs
    LEFT JOIN invoice_steps ist
      ON ist.flow_step_id = fs.id
     AND ist.invoice_id = NEW.invoice_id
    WHERE fs.version_id = v_version_id
      AND fs.position < v_position
      AND (ist.id IS NULL OR ist.status IS DISTINCT FROM 'completed');

    IF v_prev_incomplete > 0 THEN
      RAISE EXCEPTION 'invoice_steps must be completed in order'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER trg_invoice_steps_rules
  BEFORE INSERT OR UPDATE ON invoice_steps
  FOR EACH ROW
  EXECUTE FUNCTION enforce_invoice_step_rules();
--> statement-breakpoint
-- B1-04: limited app_user role (local/CI). On Neon, GRANT the same privileges
-- to the connecting role used by DATABASE_URL; document that runtime should
-- eventually connect as app_user (not the owner/migrator role).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user WITH LOGIN PASSWORD 'chopda_app' NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
END
$$;
--> statement-breakpoint
DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO app_user', current_database());
END
$$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO app_user;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
--> statement-breakpoint
GRANT USAGE ON TYPE user_role TO app_user;
--> statement-breakpoint
REVOKE UPDATE, DELETE ON TABLE audit_log FROM app_user;
--> statement-breakpoint
GRANT INSERT, SELECT ON TABLE audit_log TO app_user;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;
--> statement-breakpoint
-- Helpers for RLS (SET LOCAL app.user_id / app.role inside a transaction).
CREATE OR REPLACE FUNCTION app_current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_current_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.role', true), '');
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_is_authenticated()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT app_current_user_id() IS NOT NULL AND app_current_role() IS NOT NULL;
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT app_current_role() = 'admin';
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_is_admin_or_builder()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT app_current_role() IN ('admin', 'builder');
$$;
--> statement-breakpoint
-- B1-12..15: enable RLS on tenant tables.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE flow_templates ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE flow_versions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE flow_steps ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE invoice_steps ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE company_profile ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE company_bank_accounts ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE reminder_state ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- users (B1-12): all authenticated read; Admin writes role/active/create;
-- own-row profile update for non-role columns (column limits enforced in app).
CREATE POLICY users_select_authenticated ON users
  FOR SELECT
  USING (app_is_authenticated());
--> statement-breakpoint
CREATE POLICY users_insert_admin ON users
  FOR INSERT
  WITH CHECK (app_is_admin());
--> statement-breakpoint
CREATE POLICY users_update_admin_or_self ON users
  FOR UPDATE
  USING (app_is_admin() OR (app_is_authenticated() AND id = app_current_user_id()))
  WITH CHECK (app_is_admin() OR (app_is_authenticated() AND id = app_current_user_id()));
--> statement-breakpoint
CREATE POLICY users_delete_admin ON users
  FOR DELETE
  USING (app_is_admin());
--> statement-breakpoint
-- sessions: own rows; Admin can manage all.
CREATE POLICY sessions_select ON sessions
  FOR SELECT
  USING (app_is_admin() OR (app_is_authenticated() AND user_id = app_current_user_id()));
--> statement-breakpoint
CREATE POLICY sessions_insert ON sessions
  FOR INSERT
  WITH CHECK (app_is_authenticated());
--> statement-breakpoint
CREATE POLICY sessions_update ON sessions
  FOR UPDATE
  USING (app_is_admin() OR (app_is_authenticated() AND user_id = app_current_user_id()))
  WITH CHECK (app_is_admin() OR (app_is_authenticated() AND user_id = app_current_user_id()));
--> statement-breakpoint
CREATE POLICY sessions_delete ON sessions
  FOR DELETE
  USING (app_is_admin() OR (app_is_authenticated() AND user_id = app_current_user_id()));
--> statement-breakpoint
-- login_attempts: insert for rate limiting; Admin read.
CREATE POLICY login_attempts_insert ON login_attempts
  FOR INSERT
  WITH CHECK (true);
--> statement-breakpoint
CREATE POLICY login_attempts_select_admin ON login_attempts
  FOR SELECT
  USING (app_is_admin());
--> statement-breakpoint
-- audit_log (B1-15): insert for authenticated; select Admin only.
CREATE POLICY audit_log_insert_authenticated ON audit_log
  FOR INSERT
  WITH CHECK (app_is_authenticated());
--> statement-breakpoint
CREATE POLICY audit_log_select_admin ON audit_log
  FOR SELECT
  USING (app_is_admin());
--> statement-breakpoint
-- flows (B1-13): all read; Admin+Builder write; Viewer denied write.
CREATE POLICY flow_templates_select ON flow_templates
  FOR SELECT
  USING (app_is_authenticated());
--> statement-breakpoint
CREATE POLICY flow_templates_write ON flow_templates
  FOR ALL
  USING (app_is_admin_or_builder())
  WITH CHECK (app_is_admin_or_builder());
--> statement-breakpoint
CREATE POLICY flow_versions_select ON flow_versions
  FOR SELECT
  USING (app_is_authenticated());
--> statement-breakpoint
CREATE POLICY flow_versions_write ON flow_versions
  FOR ALL
  USING (app_is_admin_or_builder())
  WITH CHECK (app_is_admin_or_builder());
--> statement-breakpoint
CREATE POLICY flow_steps_select ON flow_steps
  FOR SELECT
  USING (app_is_authenticated());
--> statement-breakpoint
CREATE POLICY flow_steps_write ON flow_steps
  FOR ALL
  USING (app_is_admin_or_builder())
  WITH CHECK (app_is_admin_or_builder());
--> statement-breakpoint
-- invoices / steps / documents (B1-14): read all roles (soft-deleted hidden
-- except Admin); write Admin+Builder.
CREATE POLICY invoices_select ON invoices
  FOR SELECT
  USING (
    app_is_authenticated()
    AND (deleted_at IS NULL OR app_is_admin())
  );
--> statement-breakpoint
CREATE POLICY invoices_write ON invoices
  FOR ALL
  USING (app_is_admin_or_builder())
  WITH CHECK (app_is_admin_or_builder());
--> statement-breakpoint
CREATE POLICY invoice_steps_select ON invoice_steps
  FOR SELECT
  USING (
    app_is_authenticated()
    AND EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = invoice_steps.invoice_id
        AND (i.deleted_at IS NULL OR app_is_admin())
    )
  );
--> statement-breakpoint
CREATE POLICY invoice_steps_write ON invoice_steps
  FOR ALL
  USING (app_is_admin_or_builder())
  WITH CHECK (app_is_admin_or_builder());
--> statement-breakpoint
CREATE POLICY documents_select ON documents
  FOR SELECT
  USING (
    app_is_authenticated()
    AND (deleted_at IS NULL OR app_is_admin())
    AND EXISTS (
      SELECT 1
      FROM invoice_steps ist
      JOIN invoices i ON i.id = ist.invoice_id
      WHERE ist.id = documents.invoice_step_id
        AND (i.deleted_at IS NULL OR app_is_admin())
    )
  );
--> statement-breakpoint
CREATE POLICY documents_write ON documents
  FOR ALL
  USING (app_is_admin_or_builder())
  WITH CHECK (app_is_admin_or_builder());
--> statement-breakpoint
-- company_profile (B1-15): all read; Admin write.
CREATE POLICY company_profile_select ON company_profile
  FOR SELECT
  USING (app_is_authenticated());
--> statement-breakpoint
CREATE POLICY company_profile_write ON company_profile
  FOR ALL
  USING (app_is_admin())
  WITH CHECK (app_is_admin());
--> statement-breakpoint
-- bank accounts: Admin write; Builder+Admin read; Viewer denied.
CREATE POLICY company_bank_accounts_select ON company_bank_accounts
  FOR SELECT
  USING (app_is_admin_or_builder());
--> statement-breakpoint
CREATE POLICY company_bank_accounts_write ON company_bank_accounts
  FOR ALL
  USING (app_is_admin())
  WITH CHECK (app_is_admin());
--> statement-breakpoint
-- reminder_state / user_preferences: own row; Admin all.
CREATE POLICY reminder_state_own ON reminder_state
  FOR ALL
  USING (app_is_admin() OR (app_is_authenticated() AND user_id = app_current_user_id()))
  WITH CHECK (app_is_admin() OR (app_is_authenticated() AND user_id = app_current_user_id()));
--> statement-breakpoint
CREATE POLICY user_preferences_own ON user_preferences
  FOR ALL
  USING (app_is_admin() OR (app_is_authenticated() AND user_id = app_current_user_id()))
  WITH CHECK (app_is_admin() OR (app_is_authenticated() AND user_id = app_current_user_id()));
