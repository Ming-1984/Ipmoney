DO $$ BEGIN
  CREATE TYPE "PatentMaintenanceOrderStatus" AS ENUM (
    'REQUESTED',
    'QUOTED',
    'AWAITING_PAYMENT',
    'PAID',
    'EXECUTING',
    'RECEIPT_UPLOADED',
    'RECONCILED',
    'CLOSED',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PatentMaintenancePaymentChannel" AS ENUM (
    'WECHAT',
    'OFFLINE_BANK',
    'OFFLINE_OTHER'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PatentMaintenanceReconcileStatus" AS ENUM (
    'PENDING',
    'MATCHED',
    'MISMATCHED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PatentMaintenanceOrderEventType" AS ENUM (
    'CREATED',
    'QUOTE_UPDATED',
    'PAYMENT_CONFIRMED',
    'EXECUTION_SUBMITTED',
    'RECEIPT_UPLOADED',
    'RECONCILED',
    'CLOSED',
    'CANCELLED',
    'UPDATED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "patent_maintenance_orders" (
  "id" UUID NOT NULL,
  "schedule_id" UUID NOT NULL,
  "applicant_user_id" UUID NOT NULL,
  "assigned_cs_user_id" UUID,
  "status" "PatentMaintenanceOrderStatus" NOT NULL DEFAULT 'REQUESTED',
  "payment_channel" "PatentMaintenancePaymentChannel",
  "official_fee_fen" INTEGER NOT NULL DEFAULT 0,
  "late_fee_fen" INTEGER NOT NULL DEFAULT 0,
  "service_fee_fen" INTEGER NOT NULL DEFAULT 0,
  "total_amount_fen" INTEGER NOT NULL DEFAULT 0,
  "payment_deadline" TIMESTAMP(3),
  "paid_at" TIMESTAMP(3),
  "executed_at" TIMESTAMP(3),
  "receipt_issued_at" TIMESTAMP(3),
  "official_submission_no" TEXT,
  "official_receipt_no" TEXT,
  "payment_txn_no" TEXT,
  "official_receipt_file_id" UUID,
  "reconcile_status" "PatentMaintenanceReconcileStatus" NOT NULL DEFAULT 'PENDING',
  "reconcile_note" TEXT,
  "close_note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "patent_maintenance_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "patent_maintenance_order_events" (
  "id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "actor_user_id" UUID,
  "event_type" "PatentMaintenanceOrderEventType" NOT NULL,
  "from_status" "PatentMaintenanceOrderStatus",
  "to_status" "PatentMaintenanceOrderStatus" NOT NULL,
  "note" TEXT,
  "payload_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "patent_maintenance_order_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "patent_maintenance_orders_schedule_id_status_idx"
  ON "patent_maintenance_orders"("schedule_id", "status");
CREATE INDEX IF NOT EXISTS "patent_maintenance_orders_applicant_user_id_created_at_idx"
  ON "patent_maintenance_orders"("applicant_user_id", "created_at");
CREATE INDEX IF NOT EXISTS "patent_maintenance_orders_assigned_cs_user_id_status_idx"
  ON "patent_maintenance_orders"("assigned_cs_user_id", "status");
CREATE INDEX IF NOT EXISTS "patent_maintenance_order_events_order_id_created_at_idx"
  ON "patent_maintenance_order_events"("order_id", "created_at");
CREATE INDEX IF NOT EXISTS "patent_maintenance_order_events_actor_user_id_created_at_idx"
  ON "patent_maintenance_order_events"("actor_user_id", "created_at");

DO $$ BEGIN
  ALTER TABLE "patent_maintenance_orders"
    ADD CONSTRAINT "patent_maintenance_orders_schedule_id_fkey"
    FOREIGN KEY ("schedule_id") REFERENCES "patent_maintenance_schedules"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "patent_maintenance_orders"
    ADD CONSTRAINT "patent_maintenance_orders_applicant_user_id_fkey"
    FOREIGN KEY ("applicant_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "patent_maintenance_orders"
    ADD CONSTRAINT "patent_maintenance_orders_assigned_cs_user_id_fkey"
    FOREIGN KEY ("assigned_cs_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "patent_maintenance_orders"
    ADD CONSTRAINT "patent_maintenance_orders_official_receipt_file_id_fkey"
    FOREIGN KEY ("official_receipt_file_id") REFERENCES "files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "patent_maintenance_order_events"
    ADD CONSTRAINT "patent_maintenance_order_events_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "patent_maintenance_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "patent_maintenance_order_events"
    ADD CONSTRAINT "patent_maintenance_order_events_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
