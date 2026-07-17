CREATE TABLE "ops_notification_jobs" (
  "id" UUID NOT NULL,
  "event_type" TEXT NOT NULL,
  "event_key" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "recipient_json" JSONB NOT NULL,
  "payload_json" JSONB NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sent_at" TIMESTAMP(3),
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ops_notification_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ops_notification_jobs_channel_event_key_key"
ON "ops_notification_jobs"("channel", "event_key");

CREATE INDEX "ops_notification_jobs_status_next_attempt_at_idx"
ON "ops_notification_jobs"("status", "next_attempt_at");

CREATE INDEX "ops_notification_jobs_event_type_created_at_idx"
ON "ops_notification_jobs"("event_type", "created_at");
