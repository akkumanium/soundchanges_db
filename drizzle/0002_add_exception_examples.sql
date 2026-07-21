ALTER TABLE "sound_changes" ADD COLUMN IF NOT EXISTS "exception_examples" text[] DEFAULT '{}' NOT NULL;
