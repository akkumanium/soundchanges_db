UPDATE "lineage_nodes"
SET "approval_status" = 'approved', "submitted_by" = NULL
WHERE "approval_status" = 'pending';
--> statement-breakpoint
UPDATE "sound_changes"
SET "approval_status" = 'approved', "submitted_by" = NULL
WHERE "approval_status" = 'pending';
