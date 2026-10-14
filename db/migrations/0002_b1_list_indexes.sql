CREATE INDEX "audit_log_entity_id_at_idx" ON "audit_log" USING btree ("entity","entity_id","at");--> statement-breakpoint
CREATE INDEX "documents_object_key_idx" ON "documents" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "documents_live_idx" ON "documents" USING btree ("id") WHERE "documents"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "invoice_steps_invoice_id_idx" ON "invoice_steps" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoices_created_at_id_idx" ON "invoices" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "invoices_issue_date_idx" ON "invoices" USING btree ("issue_date");--> statement-breakpoint
CREATE INDEX "invoices_deleted_at_idx" ON "invoices" USING btree ("deleted_at") WHERE "invoices"."deleted_at" IS NOT NULL;