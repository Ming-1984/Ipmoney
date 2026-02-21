-- AlterEnum
ALTER TYPE "ConversationMessageType" ADD VALUE 'EMOJI';

-- CreateEnum
CREATE TYPE "ConversationContentType" AS ENUM ('LISTING', 'DEMAND', 'ACHIEVEMENT', 'ARTWORK', 'TECH_MANAGER');

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN "content_type" "ConversationContentType" NOT NULL DEFAULT 'LISTING';
ALTER TABLE "conversations" ADD COLUMN "content_id" UUID;

UPDATE "conversations" SET "content_id" = "listing_id" WHERE "content_id" IS NULL;

ALTER TABLE "conversations" ALTER COLUMN "content_id" SET NOT NULL;
ALTER TABLE "conversations" ALTER COLUMN "listing_id" DROP NOT NULL;
ALTER TABLE "conversations" ALTER COLUMN "content_type" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "conversations_content_type_content_id_updated_at_idx" ON "conversations"("content_type", "content_id", "updated_at");
