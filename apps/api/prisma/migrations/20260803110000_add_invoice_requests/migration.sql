CREATE TYPE "InvoiceTitleType" AS ENUM ('PERSONAL', 'ENTERPRISE');

CREATE TYPE "InvoiceRequestStatus" AS ENUM ('APPLYING', 'ISSUED', 'CANCELLED');

CREATE TABLE "invoice_requests" (
  "id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "title_type" "InvoiceTitleType" NOT NULL,
  "title_name" TEXT NOT NULL,
  "tax_no" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "remark" TEXT,
  "status" "InvoiceRequestStatus" NOT NULL DEFAULT 'APPLYING',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "invoice_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "invoice_requests_order_id_key" ON "invoice_requests"("order_id");
CREATE INDEX "invoice_requests_user_id_created_at_idx" ON "invoice_requests"("user_id", "created_at");
CREATE INDEX "invoice_requests_status_created_at_idx" ON "invoice_requests"("status", "created_at");

ALTER TABLE "invoice_requests"
  ADD CONSTRAINT "invoice_requests_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "invoice_requests"
  ADD CONSTRAINT "invoice_requests_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
