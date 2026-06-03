-- CreateTable
CREATE TABLE "idempotency_keys" (
  "id" UUID NOT NULL,
  "idempotency_key" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "user_id" UUID NOT NULL,
  "request_hash" TEXT,
  "status" TEXT NOT NULL,
  "response_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_key_scope_user_id_key" ON "idempotency_keys"("idempotency_key", "scope", "user_id");
CREATE INDEX "idempotency_keys_scope_idx" ON "idempotency_keys"("scope");

-- AddForeignKey
ALTER TABLE "idempotency_keys" ADD CONSTRAINT "idempotency_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
