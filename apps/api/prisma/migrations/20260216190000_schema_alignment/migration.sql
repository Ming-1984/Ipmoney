-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserRole" ADD VALUE 'operator';
ALTER TYPE "UserRole" ADD VALUE 'finance';

-- DropForeignKey
ALTER TABLE "conversations" DROP CONSTRAINT "conversations_listing_id_fkey";

-- DropForeignKey
ALTER TABLE "cs_case_evidences" DROP CONSTRAINT "cs_case_evidences_case_id_fkey";

-- DropForeignKey
ALTER TABLE "cs_case_evidences" DROP CONSTRAINT "cs_case_evidences_file_id_fkey";

-- DropForeignKey
ALTER TABLE "cs_case_notes" DROP CONSTRAINT "cs_case_notes_author_id_fkey";

-- DropForeignKey
ALTER TABLE "cs_case_notes" DROP CONSTRAINT "cs_case_notes_case_id_fkey";

-- DropForeignKey
ALTER TABLE "cs_cases" DROP CONSTRAINT "cs_cases_cs_user_id_fkey";

-- DropForeignKey
ALTER TABLE "cs_cases" DROP CONSTRAINT "cs_cases_order_id_fkey";

-- DropForeignKey
ALTER TABLE "idempotency_keys" DROP CONSTRAINT "idempotency_keys_user_id_fkey";

-- DropForeignKey
ALTER TABLE "listings" DROP CONSTRAINT "listings_patent_id_fkey";

-- DropForeignKey
ALTER TABLE "tech_manager_profiles" DROP CONSTRAINT "tech_manager_profiles_user_id_fkey";

-- DropIndex
DROP INDEX "patents_application_no_norm_key";

-- AlterTable
ALTER TABLE "files" ADD COLUMN     "file_name" TEXT;

-- AlterTable
ALTER TABLE "idempotency_keys" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "cluster_id" TEXT,
ADD COLUMN     "listing_topics_json" JSONB,
ADD COLUMN     "proof_file_ids_json" JSONB,
ADD COLUMN     "source" "ContentSource" NOT NULL DEFAULT 'USER',
ALTER COLUMN "patent_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "patents" ADD COLUMN     "grant_publication_no_display" TEXT,
ADD COLUMN     "legal_status_raw" TEXT,
ADD COLUMN     "patent_no_display" TEXT,
ADD COLUMN     "publication_no_display" TEXT,
ADD COLUMN     "transfer_count" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "tech_manager_profiles" ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateTable
CREATE TABLE "patent_legal_events" (
    "id" UUID NOT NULL,
    "patent_id" UUID NOT NULL,
    "event_date" DATE NOT NULL,
    "event_code" TEXT NOT NULL,
    "event_text_raw" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "patent_legal_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "patent_legal_events_patent_id_event_date_idx" ON "patent_legal_events"("patent_id", "event_date");

-- CreateIndex
CREATE INDEX "listings_status_audit_status_created_at_idx" ON "listings"("status", "audit_status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "patent_identifiers_id_value_norm_key" ON "patent_identifiers"("id_value_norm");

-- CreateIndex
CREATE INDEX "patents_jurisdiction_application_no_norm_idx" ON "patents"("jurisdiction", "application_no_norm");

-- CreateIndex
CREATE UNIQUE INDEX "patents_jurisdiction_application_no_norm_key" ON "patents"("jurisdiction", "application_no_norm");

-- AddForeignKey
ALTER TABLE "tech_manager_profiles" ADD CONSTRAINT "tech_manager_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patent_legal_events" ADD CONSTRAINT "patent_legal_events_patent_id_fkey" FOREIGN KEY ("patent_id") REFERENCES "patents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_patent_id_fkey" FOREIGN KEY ("patent_id") REFERENCES "patents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cs_cases" ADD CONSTRAINT "cs_cases_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cs_cases" ADD CONSTRAINT "cs_cases_cs_user_id_fkey" FOREIGN KEY ("cs_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cs_case_notes" ADD CONSTRAINT "cs_case_notes_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cs_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cs_case_notes" ADD CONSTRAINT "cs_case_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cs_case_evidences" ADD CONSTRAINT "cs_case_evidences_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cs_cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cs_case_evidences" ADD CONSTRAINT "cs_case_evidences_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "content_events_content_type_content_id_event_type_actor_key_cre" RENAME TO "content_events_content_type_content_id_event_type_actor_key_idx";

-- RenameIndex
ALTER INDEX "idempotency_keys_key_scope_user_id_key" RENAME TO "idempotency_keys_idempotency_key_scope_user_id_key";

