CREATE TYPE "ImportBatchKind" AS ENUM (
  'PEOPLE_ACHIEVEMENTS',
  'PATENT',
  'LISTING',
  'DEAL_RECORD',
  'LISTING_BATCH_ACTION'
);

CREATE TYPE "ImportBatchStatus" AS ENUM (
  'PENDING',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'PARTIALLY_SUCCEEDED',
  'ROLLBACK_PRECHECKED',
  'ROLLBACK_RUNNING',
  'ROLLED_BACK',
  'PARTIALLY_ROLLED_BACK',
  'ROLLBACK_FAILED'
);

CREATE TYPE "ImportEntityType" AS ENUM (
  'USER',
  'USER_VERIFICATION',
  'TECH_MANAGER_PROFILE',
  'TECH_MANAGER_BADGE',
  'ACHIEVEMENT',
  'PATENT',
  'LISTING',
  'DEAL_RECORD'
);

CREATE TYPE "ImportChangeOperation" AS ENUM (
  'CREATE',
  'UPDATE',
  'APPEND',
  'REPLACE',
  'SOFT_DELETE',
  'VOID'
);

CREATE TYPE "ImportRollbackStrategy" AS ENUM (
  'DELETE',
  'RESTORE',
  'SOFT_OFF_SHELF',
  'VOID',
  'EXPIRE_BADGE',
  'MANUAL_ONLY'
);

CREATE TYPE "ImportRollbackStatus" AS ENUM (
  'PENDING',
  'ROLLBACKABLE',
  'BLOCKED',
  'CONFLICTED',
  'ROLLED_BACK',
  'FAILED',
  'SKIPPED'
);

CREATE TABLE "import_batches" (
  "id" UUID NOT NULL,
  "kind" "ImportBatchKind" NOT NULL,
  "source_batch" TEXT,
  "operator_user_id" UUID,
  "status" "ImportBatchStatus" NOT NULL DEFAULT 'PENDING',
  "legacy_job_type" TEXT,
  "legacy_job_id" UUID,
  "created_count" INTEGER NOT NULL DEFAULT 0,
  "updated_count" INTEGER NOT NULL DEFAULT 0,
  "skipped_count" INTEGER NOT NULL DEFAULT 0,
  "failed_count" INTEGER NOT NULL DEFAULT 0,
  "rollbackable_count" INTEGER NOT NULL DEFAULT 0,
  "conflicted_count" INTEGER NOT NULL DEFAULT 0,
  "blocked_count" INTEGER NOT NULL DEFAULT 0,
  "rolled_back_count" INTEGER NOT NULL DEFAULT 0,
  "file_id" UUID,
  "error_file_id" UUID,
  "executed_at" TIMESTAMP(3),
  "rollback_at" TIMESTAMP(3),
  "rollback_reason" TEXT,
  "last_prechecked_at" TIMESTAMP(3),
  "last_rollback_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "import_change_logs" (
  "id" UUID NOT NULL,
  "batch_id" UUID NOT NULL,
  "row_no" INTEGER,
  "entity_type" "ImportEntityType" NOT NULL,
  "entity_id" UUID,
  "operation" "ImportChangeOperation" NOT NULL,
  "before_json" JSONB,
  "after_json" JSONB,
  "dependency_json" JSONB,
  "after_hash" TEXT,
  "rollback_strategy" "ImportRollbackStrategy" NOT NULL,
  "rollback_status" "ImportRollbackStatus" NOT NULL DEFAULT 'PENDING',
  "blocked_reason" TEXT,
  "rolled_back_at" TIMESTAMP(3),
  "rollback_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "import_change_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "import_batches_legacy_job_type_legacy_job_id_key"
  ON "import_batches"("legacy_job_type", "legacy_job_id");
CREATE INDEX "import_batches_kind_created_at_idx" ON "import_batches"("kind", "created_at");
CREATE INDEX "import_batches_status_created_at_idx" ON "import_batches"("status", "created_at");
CREATE INDEX "import_batches_source_batch_created_at_idx" ON "import_batches"("source_batch", "created_at");
CREATE INDEX "import_batches_operator_user_id_created_at_idx" ON "import_batches"("operator_user_id", "created_at");

CREATE UNIQUE INDEX "import_change_logs_batch_id_entity_type_entity_id_row_no_key"
  ON "import_change_logs"("batch_id", "entity_type", "entity_id", "row_no");
CREATE INDEX "import_change_logs_batch_id_rollback_status_idx"
  ON "import_change_logs"("batch_id", "rollback_status");
CREATE INDEX "import_change_logs_entity_type_entity_id_idx"
  ON "import_change_logs"("entity_type", "entity_id");

ALTER TABLE "import_change_logs"
  ADD CONSTRAINT "import_change_logs_batch_id_fkey"
  FOREIGN KEY ("batch_id") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

UPDATE "rbac_roles" AS r
SET "permission_ids_json" = (
  SELECT jsonb_agg("permission_id" ORDER BY "sort")
  FROM (
    SELECT existing."permission_id", existing."sort"
    FROM jsonb_array_elements_text(COALESCE(r."permission_ids_json", '[]'::jsonb))
      WITH ORDINALITY AS existing("permission_id", "sort")
    UNION ALL
    SELECT extras."permission_id", 100000 + extras."sort"
    FROM (
      VALUES
        ('importBatch.view', 1),
        ('importBatch.rollbackPreview', 2),
        ('importBatch.reportDownload', 3)
    ) AS extras("permission_id", "sort")
    WHERE NOT EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(COALESCE(r."permission_ids_json", '[]'::jsonb)) AS current("permission_id")
      WHERE current."permission_id" = extras."permission_id"
    )
  ) AS merged
)
WHERE r."id" = 'role-operator';
