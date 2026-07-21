CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TYPE "public"."moderator_role" AS ENUM('moderator', 'admin');--> statement-breakpoint
CREATE TYPE "public"."node_kind" AS ENUM('family', 'subgroup', 'stage', 'language', 'variety');--> statement-breakpoint
CREATE TYPE "public"."proposal_kind" AS ENUM('create_lineage', 'update_lineage', 'delete_lineage', 'create_transition', 'update_transition', 'delete_transition', 'create_rule', 'update_rule', 'delete_rule', 'create_example', 'update_example', 'delete_example', 'create_source', 'editorial_request');--> statement-breakpoint
CREATE TYPE "public"."proposal_status" AS ENUM('pending', 'approved', 'rejected', 'conflict');--> statement-breakpoint
CREATE TYPE "public"."relationship_kind" AS ENUM('contains', 'descends_from');--> statement-breakpoint
CREATE TABLE "examples" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sound_change_id" uuid NOT NULL,
	"source_form" text NOT NULL,
	"target_form" text NOT NULL,
	"source_reconstructed" boolean DEFAULT false NOT NULL,
	"target_reconstructed" boolean DEFAULT false NOT NULL,
	"gloss" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"source_wiktionary_url" text DEFAULT '' NOT NULL,
	"target_wiktionary_url" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lineage_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"aliases" text[] DEFAULT '{}' NOT NULL,
	"kind" "node_kind" NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"parent_id" uuid,
	"relationship_kind" "relationship_kind" DEFAULT 'contains' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moderators" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "moderator_role" DEFAULT 'moderator' NOT NULL,
	"disabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "proposal_kind" NOT NULL,
	"status" "proposal_status" DEFAULT 'pending' NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"operations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"base_revisions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"contributor_name" text DEFAULT '' NOT NULL,
	"contributor_contact" text DEFAULT '' NOT NULL,
	"license_accepted" boolean NOT NULL,
	"submitter_hash" text DEFAULT '' NOT NULL,
	"moderator_note" text DEFAULT '' NOT NULL,
	"amended_operations" jsonb,
	"reviewed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "rate_limit_buckets" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"window_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "revision_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid,
	"moderator_id" uuid,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"action" text NOT NULL,
	"summary" text NOT NULL,
	"contributor_credit" text DEFAULT '' NOT NULL,
	"before_snapshot" jsonb,
	"after_snapshot" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"moderator_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slug_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"old_slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sound_change_sources" (
	"sound_change_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	CONSTRAINT "sound_change_sources_sound_change_id_source_id_pk" PRIMARY KEY("sound_change_id","source_id")
);
--> statement-breakpoint
CREATE TABLE "sound_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transition_id" uuid NOT NULL,
	"input" text DEFAULT '' NOT NULL,
	"output" text DEFAULT '' NOT NULL,
	"environment" text DEFAULT '' NOT NULL,
	"exceptions" text DEFAULT '' NOT NULL,
	"qualifier" text DEFAULT '' NOT NULL,
	"explanation" text DEFAULT '' NOT NULL,
	"display_notation" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"display_citation" text NOT NULL,
	"authors" text DEFAULT '' NOT NULL,
	"year" text DEFAULT '' NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"container_title" text DEFAULT '' NOT NULL,
	"publisher" text DEFAULT '' NOT NULL,
	"pages" text DEFAULT '' NOT NULL,
	"doi" text DEFAULT '' NOT NULL,
	"url" text DEFAULT '' NOT NULL,
	"accessed_at" text DEFAULT '' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transition_sources" (
	"transition_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	CONSTRAINT "transition_sources_transition_id_source_id_pk" PRIMARY KEY("transition_id","source_id")
);
--> statement-breakpoint
CREATE TABLE "transitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"source_node_id" uuid NOT NULL,
	"target_node_id" uuid NOT NULL,
	"title" text NOT NULL,
	"chronology" text DEFAULT '' NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "examples" ADD CONSTRAINT "examples_sound_change_id_sound_changes_id_fk" FOREIGN KEY ("sound_change_id") REFERENCES "public"."sound_changes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lineage_nodes" ADD CONSTRAINT "lineage_nodes_parent_id_lineage_nodes_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."lineage_nodes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_reviewed_by_moderators_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."moderators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revision_events" ADD CONSTRAINT "revision_events_proposal_id_proposals_id_fk" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revision_events" ADD CONSTRAINT "revision_events_moderator_id_moderators_id_fk" FOREIGN KEY ("moderator_id") REFERENCES "public"."moderators"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_moderator_id_moderators_id_fk" FOREIGN KEY ("moderator_id") REFERENCES "public"."moderators"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sound_change_sources" ADD CONSTRAINT "sound_change_sources_sound_change_id_sound_changes_id_fk" FOREIGN KEY ("sound_change_id") REFERENCES "public"."sound_changes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sound_change_sources" ADD CONSTRAINT "sound_change_sources_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sound_changes" ADD CONSTRAINT "sound_changes_transition_id_transitions_id_fk" FOREIGN KEY ("transition_id") REFERENCES "public"."transitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transition_sources" ADD CONSTRAINT "transition_sources_transition_id_transitions_id_fk" FOREIGN KEY ("transition_id") REFERENCES "public"."transitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transition_sources" ADD CONSTRAINT "transition_sources_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transitions" ADD CONSTRAINT "transitions_source_node_id_lineage_nodes_id_fk" FOREIGN KEY ("source_node_id") REFERENCES "public"."lineage_nodes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transitions" ADD CONSTRAINT "transitions_target_node_id_lineage_nodes_id_fk" FOREIGN KEY ("target_node_id") REFERENCES "public"."lineage_nodes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "examples_change_idx" ON "examples" USING btree ("sound_change_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "lineage_nodes_slug_idx" ON "lineage_nodes" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "lineage_nodes_parent_idx" ON "lineage_nodes" USING btree ("parent_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "moderators_username_idx" ON "moderators" USING btree ("username");--> statement-breakpoint
CREATE INDEX "proposals_queue_idx" ON "proposals" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "rate_limit_expiry_idx" ON "rate_limit_buckets" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "revision_events_created_idx" ON "revision_events" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_hash_idx" ON "sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "sessions_expiry_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "slug_aliases_old_slug_idx" ON "slug_aliases" USING btree ("entity_type","old_slug");--> statement-breakpoint
CREATE INDEX "sound_changes_transition_idx" ON "sound_changes" USING btree ("transition_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "transitions_slug_idx" ON "transitions" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "transitions_source_idx" ON "transitions" USING btree ("source_node_id");--> statement-breakpoint
CREATE INDEX "transitions_target_idx" ON "transitions" USING btree ("target_node_id");
--> statement-breakpoint
CREATE INDEX "lineage_nodes_name_trgm_idx" ON "lineage_nodes" USING gin ("name" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX "transitions_title_trgm_idx" ON "transitions" USING gin ("title" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX "sound_changes_notation_trgm_idx" ON "sound_changes" USING gin ("display_notation" gin_trgm_ops);
