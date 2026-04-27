ALTER TABLE "tech_manager_profiles"
  ADD COLUMN IF NOT EXISTS "position" TEXT,
  ADD COLUMN IF NOT EXISTS "organization" TEXT,
  ADD COLUMN IF NOT EXISTS "service_directions_json" JSONB,
  ADD COLUMN IF NOT EXISTS "work_highlights" TEXT,
  ADD COLUMN IF NOT EXISTS "contact_name" TEXT,
  ADD COLUMN IF NOT EXISTS "contact_phone" TEXT;

ALTER TABLE "achievements"
  ADD COLUMN IF NOT EXISTS "external_id" TEXT,
  ADD COLUMN IF NOT EXISTS "source_raw_category" TEXT,
  ADD COLUMN IF NOT EXISTS "source_raw_status" TEXT,
  ADD COLUMN IF NOT EXISTS "source_batch" TEXT,
  ADD COLUMN IF NOT EXISTS "source_raw_region" TEXT,
  ADD COLUMN IF NOT EXISTS "source_org_name" TEXT;

DO $$ BEGIN
  CREATE UNIQUE INDEX "achievements_external_id_key" ON "achievements"("external_id");
EXCEPTION
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "achievements_source_batch_created_at_idx"
  ON "achievements"("source_batch", "created_at");
