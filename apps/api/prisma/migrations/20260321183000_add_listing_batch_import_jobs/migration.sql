-- CreateEnum
CREATE TYPE "ListingJobStatus" AS ENUM ('PENDING', 'RUNNING', 'PAUSED', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "ListingBatchAction" AS ENUM ('APPROVE', 'REJECT', 'PUBLISH', 'OFF_SHELF');

-- CreateEnum
CREATE TYPE "ListingBatchItemStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ListingImportDuplicatePolicy" AS ENUM ('SKIP', 'OVERWRITE');

-- CreateEnum
CREATE TYPE "ListingImportRowStatus" AS ENUM ('PENDING', 'VALID', 'INVALID', 'SUCCEEDED', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "listing_batch_jobs" (
    "id" UUID NOT NULL,
    "operator_user_id" UUID NOT NULL,
    "action" "ListingBatchAction" NOT NULL,
    "reason" TEXT,
    "status" "ListingJobStatus" NOT NULL DEFAULT 'PENDING',
    "total_count" INTEGER NOT NULL DEFAULT 0,
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "fail_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "paused_at" TIMESTAMP(3),
    "error_file_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listing_batch_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_batch_job_items" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "status" "ListingBatchItemStatus" NOT NULL DEFAULT 'PENDING',
    "error_code" TEXT,
    "error_message" TEXT,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listing_batch_job_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_import_jobs" (
    "id" UUID NOT NULL,
    "operator_user_id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "duplicate_policy" "ListingImportDuplicatePolicy" NOT NULL DEFAULT 'SKIP',
    "defaults_json" JSONB,
    "status" "ListingJobStatus" NOT NULL DEFAULT 'PENDING',
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

    CONSTRAINT "listing_import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_import_job_rows" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "row_no" INTEGER NOT NULL,
    "status" "ListingImportRowStatus" NOT NULL DEFAULT 'PENDING',
    "raw_json" JSONB NOT NULL,
    "normalized_json" JSONB,
    "listing_id" UUID,
    "error_code" TEXT,
    "error_message" TEXT,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listing_import_job_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "listing_batch_jobs_operator_user_id_created_at_idx" ON "listing_batch_jobs"("operator_user_id", "created_at");

-- CreateIndex
CREATE INDEX "listing_batch_jobs_status_created_at_idx" ON "listing_batch_jobs"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "listing_batch_job_items_job_id_listing_id_key" ON "listing_batch_job_items"("job_id", "listing_id");

-- CreateIndex
CREATE INDEX "listing_batch_job_items_job_id_status_idx" ON "listing_batch_job_items"("job_id", "status");

-- CreateIndex
CREATE INDEX "listing_batch_job_items_listing_id_created_at_idx" ON "listing_batch_job_items"("listing_id", "created_at");

-- CreateIndex
CREATE INDEX "listing_import_jobs_operator_user_id_created_at_idx" ON "listing_import_jobs"("operator_user_id", "created_at");

-- CreateIndex
CREATE INDEX "listing_import_jobs_status_created_at_idx" ON "listing_import_jobs"("status", "created_at");

-- CreateIndex
CREATE INDEX "listing_import_jobs_file_id_idx" ON "listing_import_jobs"("file_id");

-- CreateIndex
CREATE UNIQUE INDEX "listing_import_job_rows_job_id_row_no_key" ON "listing_import_job_rows"("job_id", "row_no");

-- CreateIndex
CREATE INDEX "listing_import_job_rows_job_id_status_idx" ON "listing_import_job_rows"("job_id", "status");

-- CreateIndex
CREATE INDEX "listing_import_job_rows_listing_id_created_at_idx" ON "listing_import_job_rows"("listing_id", "created_at");

-- AddForeignKey
ALTER TABLE "listing_batch_jobs" ADD CONSTRAINT "listing_batch_jobs_operator_user_id_fkey" FOREIGN KEY ("operator_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_batch_jobs" ADD CONSTRAINT "listing_batch_jobs_error_file_id_fkey" FOREIGN KEY ("error_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_batch_job_items" ADD CONSTRAINT "listing_batch_job_items_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "listing_batch_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_batch_job_items" ADD CONSTRAINT "listing_batch_job_items_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_import_jobs" ADD CONSTRAINT "listing_import_jobs_operator_user_id_fkey" FOREIGN KEY ("operator_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_import_jobs" ADD CONSTRAINT "listing_import_jobs_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_import_jobs" ADD CONSTRAINT "listing_import_jobs_error_file_id_fkey" FOREIGN KEY ("error_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_import_job_rows" ADD CONSTRAINT "listing_import_job_rows_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "listing_import_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_import_job_rows" ADD CONSTRAINT "listing_import_job_rows_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
