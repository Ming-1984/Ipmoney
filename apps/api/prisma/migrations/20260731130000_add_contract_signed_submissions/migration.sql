-- CreateEnum
CREATE TYPE "ContractSignedSubmissionStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'SUPERSEDED');

-- AlterTable
ALTER TABLE "contracts"
  ADD COLUMN "signed_contract_file_id" UUID,
  ADD COLUMN "signed_submission_id" UUID;

-- CreateTable
CREATE TABLE "contract_signed_submissions" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "contract_order_id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "submitted_by_user_id" UUID NOT NULL,
    "status" "ContractSignedSubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "reject_reason" TEXT,
    "reviewed_by_user_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contract_signed_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "contracts_signed_submission_id_key" ON "contracts"("signed_submission_id");

-- CreateIndex
CREATE INDEX "contract_signed_submissions_order_id_status_created_at_idx" ON "contract_signed_submissions"("order_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "contract_signed_submissions_contract_order_id_status_created_at_idx" ON "contract_signed_submissions"("contract_order_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "contract_signed_submissions_submitted_by_user_id_created_at_idx" ON "contract_signed_submissions"("submitted_by_user_id", "created_at");

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_signed_contract_file_id_fkey" FOREIGN KEY ("signed_contract_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_signed_submissions" ADD CONSTRAINT "contract_signed_submissions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_signed_submissions" ADD CONSTRAINT "contract_signed_submissions_contract_order_id_fkey" FOREIGN KEY ("contract_order_id") REFERENCES "contracts"("order_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_signed_submissions" ADD CONSTRAINT "contract_signed_submissions_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_signed_submissions" ADD CONSTRAINT "contract_signed_submissions_submitted_by_user_id_fkey" FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contract_signed_submissions" ADD CONSTRAINT "contract_signed_submissions_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_signed_submission_id_fkey" FOREIGN KEY ("signed_submission_id") REFERENCES "contract_signed_submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
