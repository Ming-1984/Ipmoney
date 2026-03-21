-- CreateEnum
CREATE TYPE "ConsultationRouting" AS ENUM ('PLATFORM', 'OWNER');

-- CreateEnum
CREATE TYPE "PatentJobStatus" AS ENUM ('PENDING', 'RUNNING', 'PAUSED', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "PatentImportDuplicatePolicy" AS ENUM ('SKIP', 'OVERWRITE');

-- CreateEnum
CREATE TYPE "PatentImportRowStatus" AS ENUM ('PENDING', 'VALID', 'INVALID', 'SUCCEEDED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "PatentOwnerClaimSource" AS ENUM ('PLATFORM_IMPORT', 'USER_CLAIM', 'ADMIN_ASSIGN');

-- CreateEnum
CREATE TYPE "PatentClaimStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "listings" ADD COLUMN "consultation_routing" "ConsultationRouting" NOT NULL DEFAULT 'PLATFORM';

-- AlterTable
ALTER TABLE "patents"
ADD COLUMN "owner_user_id" UUID,
ADD COLUMN "owner_claimed_at" TIMESTAMP(3),
ADD COLUMN "owner_claim_source" "PatentOwnerClaimSource";

-- CreateTable
CREATE TABLE "conversation_agents" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "operator_user_id" UUID NOT NULL,
    "assigned_by_user_id" UUID,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patent_import_jobs" (
    "id" UUID NOT NULL,
    "operator_user_id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "duplicate_policy" "PatentImportDuplicatePolicy" NOT NULL DEFAULT 'SKIP',
    "defaults_json" JSONB,
    "status" "PatentJobStatus" NOT NULL DEFAULT 'PENDING',
    "total_count" INTEGER NOT NULL DEFAULT 0,
    "valid_count" INTEGER NOT NULL DEFAULT 0,
    "invalid_count" INTEGER NOT NULL DEFAULT 0,
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "fail_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "validated_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "paused_at" TIMESTAMP(3),
    "error_file_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patent_import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patent_import_job_rows" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "row_no" INTEGER NOT NULL,
    "status" "PatentImportRowStatus" NOT NULL DEFAULT 'PENDING',
    "raw_json" JSONB NOT NULL,
    "normalized_json" JSONB,
    "patent_id" UUID,
    "error_code" TEXT,
    "error_message" TEXT,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patent_import_job_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patent_claim_requests" (
    "id" UUID NOT NULL,
    "patent_id" UUID NOT NULL,
    "applicant_user_id" UUID NOT NULL,
    "status" "PatentClaimStatus" NOT NULL DEFAULT 'PENDING',
    "claim_reason" TEXT,
    "evidence_file_ids_json" JSONB,
    "reviewer_user_id" UUID,
    "review_comment" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patent_claim_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "conversation_agents_conversation_id_operator_user_id_key" ON "conversation_agents"("conversation_id", "operator_user_id");

-- CreateIndex
CREATE INDEX "conversation_agents_operator_user_id_active_assigned_at_idx" ON "conversation_agents"("operator_user_id", "active", "assigned_at");

-- CreateIndex
CREATE INDEX "conversation_agents_conversation_id_active_assigned_at_idx" ON "conversation_agents"("conversation_id", "active", "assigned_at");

-- CreateIndex
CREATE INDEX "patents_owner_user_id_idx" ON "patents"("owner_user_id");

-- CreateIndex
CREATE INDEX "patent_import_jobs_operator_user_id_created_at_idx" ON "patent_import_jobs"("operator_user_id", "created_at");

-- CreateIndex
CREATE INDEX "patent_import_jobs_status_created_at_idx" ON "patent_import_jobs"("status", "created_at");

-- CreateIndex
CREATE INDEX "patent_import_jobs_file_id_idx" ON "patent_import_jobs"("file_id");

-- CreateIndex
CREATE UNIQUE INDEX "patent_import_job_rows_job_id_row_no_key" ON "patent_import_job_rows"("job_id", "row_no");

-- CreateIndex
CREATE INDEX "patent_import_job_rows_job_id_status_idx" ON "patent_import_job_rows"("job_id", "status");

-- CreateIndex
CREATE INDEX "patent_import_job_rows_patent_id_created_at_idx" ON "patent_import_job_rows"("patent_id", "created_at");

-- CreateIndex
CREATE INDEX "patent_claim_requests_patent_id_status_created_at_idx" ON "patent_claim_requests"("patent_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "patent_claim_requests_applicant_user_id_status_created_at_idx" ON "patent_claim_requests"("applicant_user_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "patent_claim_requests_status_submitted_at_idx" ON "patent_claim_requests"("status", "submitted_at");

-- AddForeignKey
ALTER TABLE "patents" ADD CONSTRAINT "patents_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_agents" ADD CONSTRAINT "conversation_agents_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_agents" ADD CONSTRAINT "conversation_agents_operator_user_id_fkey" FOREIGN KEY ("operator_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_agents" ADD CONSTRAINT "conversation_agents_assigned_by_user_id_fkey" FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patent_import_jobs" ADD CONSTRAINT "patent_import_jobs_operator_user_id_fkey" FOREIGN KEY ("operator_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patent_import_jobs" ADD CONSTRAINT "patent_import_jobs_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patent_import_jobs" ADD CONSTRAINT "patent_import_jobs_error_file_id_fkey" FOREIGN KEY ("error_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patent_import_job_rows" ADD CONSTRAINT "patent_import_job_rows_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "patent_import_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patent_import_job_rows" ADD CONSTRAINT "patent_import_job_rows_patent_id_fkey" FOREIGN KEY ("patent_id") REFERENCES "patents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patent_claim_requests" ADD CONSTRAINT "patent_claim_requests_patent_id_fkey" FOREIGN KEY ("patent_id") REFERENCES "patents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patent_claim_requests" ADD CONSTRAINT "patent_claim_requests_applicant_user_id_fkey" FOREIGN KEY ("applicant_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patent_claim_requests" ADD CONSTRAINT "patent_claim_requests_reviewer_user_id_fkey" FOREIGN KEY ("reviewer_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
