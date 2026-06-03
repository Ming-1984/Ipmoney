-- CreateEnum
CREATE TYPE "ContentEventType" AS ENUM ('VIEW', 'FAVORITE', 'CONSULT');

-- CreateTable
CREATE TABLE "content_events" (
    "id" UUID NOT NULL,
    "content_type" "CommentContentType" NOT NULL,
    "content_id" UUID NOT NULL,
    "event_type" "ContentEventType" NOT NULL,
    "actor_key" TEXT NOT NULL,
    "actor_user_id" UUID,
    "device_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "content_events_content_type_content_id_event_type_actor_key_created_at_idx" ON "content_events"("content_type", "content_id", "event_type", "actor_key", "created_at");
