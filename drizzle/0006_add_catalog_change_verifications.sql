CREATE TABLE "catalog_change_verifications" (
	"change_id" uuid PRIMARY KEY NOT NULL,
	"moderator_id" uuid,
	"verified_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "catalog_change_verifications" ADD CONSTRAINT "catalog_change_verifications_change_id_catalog_changes_id_fk" FOREIGN KEY ("change_id") REFERENCES "public"."catalog_changes"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "catalog_change_verifications" ADD CONSTRAINT "catalog_change_verifications_moderator_id_moderators_id_fk" FOREIGN KEY ("moderator_id") REFERENCES "public"."moderators"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "catalog_change_verifications_moderator_idx" ON "catalog_change_verifications" USING btree ("moderator_id");
