-- B7-05: authenticated users may read audit rows tied to invoices/documents they can see.
-- Admin retains full audit SELECT. Insert policy unchanged.
DROP POLICY IF EXISTS audit_log_select_admin ON audit_log;--> statement-breakpoint
CREATE POLICY audit_log_select ON audit_log
  FOR SELECT
  USING (
    app_is_admin()
    OR (
      app_is_authenticated()
      AND (
        (
          entity = 'invoice'
          AND entity_id IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM invoices i
            WHERE i.id::text = audit_log.entity_id
              AND (i.deleted_at IS NULL OR app_is_admin())
          )
        )
        OR (
          entity = 'invoice_step'
          AND entity_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM invoice_steps s
            JOIN invoices i ON i.id = s.invoice_id
            WHERE s.id::text = audit_log.entity_id
              AND (i.deleted_at IS NULL OR app_is_admin())
          )
        )
        OR (
          entity = 'document'
          AND entity_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM documents d
            JOIN invoice_steps s ON s.id = d.invoice_step_id
            JOIN invoices i ON i.id = s.invoice_id
            WHERE d.id::text = audit_log.entity_id
              AND (i.deleted_at IS NULL OR app_is_admin())
          )
        )
      )
    )
  );
