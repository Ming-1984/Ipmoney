-- Add moderation state for user-uploaded files so WeChat content security
-- results can be persisted and enforced before public publish/use.
CREATE TYPE "FileModerationStatus" AS ENUM (
  'NOT_REQUIRED',
  'PENDING',
  'APPROVED',
  'REJECTED',
  'FAILED'
);

ALTER TABLE "files"
ADD COLUMN "moderation_status" "FileModerationStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
ADD COLUMN "moderation_provider" TEXT,
ADD COLUMN "moderation_trace_id" TEXT,
ADD COLUMN "moderation_label" TEXT,
ADD COLUMN "moderation_reason" TEXT,
ADD COLUMN "moderation_requested_at" TIMESTAMP(3),
ADD COLUMN "moderation_checked_at" TIMESTAMP(3);

CREATE INDEX "files_moderation_status_created_at_idx" ON "files"("moderation_status", "created_at");
CREATE INDEX "files_moderation_trace_id_idx" ON "files"("moderation_trace_id");
