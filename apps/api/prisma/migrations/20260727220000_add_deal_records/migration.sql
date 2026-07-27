-- CreateEnum
CREATE TYPE "DealRecordSource" AS ENUM ('ONLINE_ORDER', 'ADMIN_IMPORT');

-- CreateEnum
CREATE TYPE "DealRecordStatus" AS ENUM ('ACTIVE', 'VOIDED');

-- CreateEnum
CREATE TYPE "DealTradeType" AS ENUM ('LICENSE', 'TRANSFER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DealRecordImportDuplicatePolicy" AS ENUM ('SKIP', 'UPSERT');

-- CreateEnum
CREATE TYPE "DealRecordImportJobStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'PARTIAL_FAILED');

-- CreateEnum
CREATE TYPE "DealRecordImportRowStatus" AS ENUM ('VALID', 'INVALID', 'SUCCEEDED', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "deal_record_import_jobs" (
    "id" UUID NOT NULL,
    "operator_user_id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "status" "DealRecordImportJobStatus" NOT NULL DEFAULT 'PENDING',
    "duplicate_policy" "DealRecordImportDuplicatePolicy" NOT NULL DEFAULT 'SKIP',
    "total_count" INTEGER NOT NULL DEFAULT 0,
    "valid_count" INTEGER NOT NULL DEFAULT 0,
    "invalid_count" INTEGER NOT NULL DEFAULT 0,
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "deal_record_import_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_records" (
    "id" UUID NOT NULL,
    "source" "DealRecordSource" NOT NULL,
    "status" "DealRecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "source_order_id" UUID,
    "import_job_id" UUID,
    "patent_id" UUID,
    "patent_no_norm" TEXT NOT NULL,
    "patent_no_display" TEXT NOT NULL,
    "patent_title" TEXT NOT NULL,
    "trade_type" "DealTradeType" NOT NULL DEFAULT 'UNKNOWN',
    "seller_party_name" TEXT NOT NULL,
    "buyer_party_name" TEXT NOT NULL,
    "deal_at" TIMESTAMP(3) NOT NULL,
    "price_fen" INTEGER NOT NULL,
    "dedupe_key" TEXT NOT NULL,
    "raw_json" JSONB,
    "note" TEXT,
    "created_by_user_id" UUID,
    "updated_by_user_id" UUID,
    "voided_by_user_id" UUID,
    "voided_at" TIMESTAMP(3),
    "void_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deal_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deal_record_import_job_rows" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "row_no" INTEGER NOT NULL,
    "status" "DealRecordImportRowStatus" NOT NULL,
    "raw_json" JSONB NOT NULL,
    "normalized_json" JSONB,
    "deal_record_id" UUID,
    "error_code" TEXT,
    "error_message" TEXT,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deal_record_import_job_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deal_record_import_jobs_operator_user_id_created_at_idx" ON "deal_record_import_jobs"("operator_user_id", "created_at");

-- CreateIndex
CREATE INDEX "deal_record_import_jobs_status_created_at_idx" ON "deal_record_import_jobs"("status", "created_at");

-- CreateIndex
CREATE INDEX "deal_record_import_jobs_file_id_idx" ON "deal_record_import_jobs"("file_id");

-- CreateIndex
CREATE UNIQUE INDEX "deal_records_source_order_id_key" ON "deal_records"("source_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "deal_records_dedupe_key_key" ON "deal_records"("dedupe_key");

-- CreateIndex
CREATE INDEX "deal_records_status_deal_at_idx" ON "deal_records"("status", "deal_at");

-- CreateIndex
CREATE INDEX "deal_records_source_status_deal_at_idx" ON "deal_records"("source", "status", "deal_at");

-- CreateIndex
CREATE INDEX "deal_records_patent_no_norm_idx" ON "deal_records"("patent_no_norm");

-- CreateIndex
CREATE INDEX "deal_records_patent_title_idx" ON "deal_records"("patent_title");

-- CreateIndex
CREATE INDEX "deal_records_import_job_id_idx" ON "deal_records"("import_job_id");

-- CreateIndex
CREATE UNIQUE INDEX "deal_record_import_job_rows_job_id_row_no_key" ON "deal_record_import_job_rows"("job_id", "row_no");

-- CreateIndex
CREATE INDEX "deal_record_import_job_rows_job_id_status_idx" ON "deal_record_import_job_rows"("job_id", "status");

-- CreateIndex
CREATE INDEX "deal_record_import_job_rows_deal_record_id_idx" ON "deal_record_import_job_rows"("deal_record_id");

-- AddForeignKey
ALTER TABLE "deal_record_import_jobs" ADD CONSTRAINT "deal_record_import_jobs_operator_user_id_fkey" FOREIGN KEY ("operator_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_record_import_jobs" ADD CONSTRAINT "deal_record_import_jobs_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_records" ADD CONSTRAINT "deal_records_source_order_id_fkey" FOREIGN KEY ("source_order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_records" ADD CONSTRAINT "deal_records_import_job_id_fkey" FOREIGN KEY ("import_job_id") REFERENCES "deal_record_import_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_records" ADD CONSTRAINT "deal_records_patent_id_fkey" FOREIGN KEY ("patent_id") REFERENCES "patents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_records" ADD CONSTRAINT "deal_records_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_records" ADD CONSTRAINT "deal_records_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_records" ADD CONSTRAINT "deal_records_voided_by_user_id_fkey" FOREIGN KEY ("voided_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_record_import_job_rows" ADD CONSTRAINT "deal_record_import_job_rows_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "deal_record_import_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deal_record_import_job_rows" ADD CONSTRAINT "deal_record_import_job_rows_deal_record_id_fkey" FOREIGN KEY ("deal_record_id") REFERENCES "deal_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
