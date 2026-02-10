-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('WAIT_UPLOAD', 'WAIT_CONFIRM', 'AVAILABLE');

-- CreateTable
CREATE TABLE "contracts" (
    "order_id" UUID NOT NULL,
    "status" "ContractStatus" NOT NULL DEFAULT 'WAIT_UPLOAD',
    "contract_file_id" UUID,
    "file_url" TEXT,
    "uploaded_at" TIMESTAMP(3),
    "signed_at" TIMESTAMP(3),
    "watermark_owner" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contracts_pkey" PRIMARY KEY ("order_id")
);

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_contract_file_id_fkey" FOREIGN KEY ("contract_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
