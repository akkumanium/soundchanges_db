ALTER TABLE "revision_events" DROP CONSTRAINT IF EXISTS "revision_events_proposal_id_proposals_id_fk";
ALTER TABLE "revision_events" DROP COLUMN IF EXISTS "proposal_id";
DROP TABLE IF EXISTS "proposals";
DROP TYPE IF EXISTS "proposal_kind";
DROP TYPE IF EXISTS "proposal_status";
