DO $$ BEGIN
 CREATE TYPE "public"."approval_status" AS ENUM('pending', 'approved', 'rejected');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "lineage_nodes" ADD COLUMN IF NOT EXISTS "approval_status" "approval_status" DEFAULT 'approved' NOT NULL;
ALTER TABLE "lineage_nodes" ADD COLUMN IF NOT EXISTS "submitted_by" uuid;
ALTER TABLE "lineage_nodes" ADD COLUMN IF NOT EXISTS "reviewed_by" uuid;
ALTER TABLE "lineage_nodes" ADD COLUMN IF NOT EXISTS "reviewed_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "sound_changes" ADD COLUMN IF NOT EXISTS "approval_status" "approval_status" DEFAULT 'approved' NOT NULL;
ALTER TABLE "sound_changes" ADD COLUMN IF NOT EXISTS "submitted_by" uuid;
ALTER TABLE "sound_changes" ADD COLUMN IF NOT EXISTS "reviewed_by" uuid;
ALTER TABLE "sound_changes" ADD COLUMN IF NOT EXISTS "reviewed_at" timestamp with time zone;
