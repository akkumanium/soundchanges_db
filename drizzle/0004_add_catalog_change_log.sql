CREATE TABLE "catalog_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"moderator_id" uuid,
	"action" text NOT NULL,
	"summary" text NOT NULL,
	"reverts_change_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog_change_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"change_id" uuid NOT NULL,
	"table_name" text NOT NULL,
	"row_key" text NOT NULL,
	"before_snapshot" jsonb,
	"after_snapshot" jsonb
);
--> statement-breakpoint
ALTER TABLE "catalog_changes" ADD CONSTRAINT "catalog_changes_moderator_id_moderators_id_fk" FOREIGN KEY ("moderator_id") REFERENCES "public"."moderators"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "catalog_changes" ADD CONSTRAINT "catalog_changes_reverts_change_id_catalog_changes_id_fk" FOREIGN KEY ("reverts_change_id") REFERENCES "public"."catalog_changes"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "catalog_change_items" ADD CONSTRAINT "catalog_change_items_change_id_catalog_changes_id_fk" FOREIGN KEY ("change_id") REFERENCES "public"."catalog_changes"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "catalog_changes_created_idx" ON "catalog_changes" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX "catalog_changes_moderator_idx" ON "catalog_changes" USING btree ("moderator_id");
--> statement-breakpoint
CREATE INDEX "catalog_change_items_change_idx" ON "catalog_change_items" USING btree ("change_id");
--> statement-breakpoint
CREATE INDEX "catalog_change_items_entity_idx" ON "catalog_change_items" USING btree ("table_name", "row_key");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION prevent_catalog_audit_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'catalog audit records are append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER catalog_changes_append_only BEFORE UPDATE OR DELETE ON "catalog_changes" FOR EACH ROW EXECUTE FUNCTION prevent_catalog_audit_mutation();
--> statement-breakpoint
CREATE TRIGGER catalog_change_items_append_only BEFORE UPDATE OR DELETE ON "catalog_change_items" FOR EACH ROW EXECUTE FUNCTION prevent_catalog_audit_mutation();
--> statement-breakpoint
CREATE TRIGGER catalog_changes_no_truncate BEFORE TRUNCATE ON "catalog_changes" FOR EACH STATEMENT EXECUTE FUNCTION prevent_catalog_audit_mutation();
--> statement-breakpoint
CREATE TRIGGER catalog_change_items_no_truncate BEFORE TRUNCATE ON "catalog_change_items" FOR EACH STATEMENT EXECUTE FUNCTION prevent_catalog_audit_mutation();
