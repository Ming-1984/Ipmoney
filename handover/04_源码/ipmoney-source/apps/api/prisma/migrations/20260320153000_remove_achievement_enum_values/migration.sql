-- Remove achievement-related rows before shrinking enums
DELETE FROM "conversation_messages"
WHERE "conversation_id" IN (
  SELECT "id" FROM "conversations" WHERE "content_type" = 'ACHIEVEMENT'
);

DELETE FROM "conversation_participants"
WHERE "conversation_id" IN (
  SELECT "id" FROM "conversations" WHERE "content_type" = 'ACHIEVEMENT'
);

DELETE FROM "conversations" WHERE "content_type" = 'ACHIEVEMENT';
DELETE FROM "content_events" WHERE "content_type" = 'ACHIEVEMENT';

UPDATE "comments"
SET "parent_comment_id" = NULL
WHERE "parent_comment_id" IN (
  SELECT "id" FROM "comments" WHERE "content_type" = 'ACHIEVEMENT'
);
DELETE FROM "comments" WHERE "content_type" = 'ACHIEVEMENT';

DELETE FROM "ai_parse_feedbacks"
WHERE "parse_result_id" IN (
  SELECT "id" FROM "ai_parse_results" WHERE "content_type" = 'ACHIEVEMENT'
);
DELETE FROM "ai_parse_results" WHERE "content_type" = 'ACHIEVEMENT';

DELETE FROM "alert_events" WHERE "target_type" = 'ACHIEVEMENT';
DELETE FROM "files" WHERE "owner_scope" = 'ACHIEVEMENT';

-- AlterEnum
BEGIN;
CREATE TYPE "AiContentType_new" AS ENUM ('LISTING');
ALTER TABLE "ai_parse_results" ALTER COLUMN "content_type" TYPE "AiContentType_new" USING ("content_type"::text::"AiContentType_new");
ALTER TYPE "AiContentType" RENAME TO "AiContentType_old";
ALTER TYPE "AiContentType_new" RENAME TO "AiContentType";
DROP TYPE "public"."AiContentType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "AlertTargetType_new" AS ENUM ('PATENT', 'ORDER', 'LISTING', 'AI_PARSE', 'IMPORT', 'PAYMENT', 'REFUND', 'SYSTEM');
ALTER TABLE "alert_events" ALTER COLUMN "target_type" TYPE "AlertTargetType_new" USING ("target_type"::text::"AlertTargetType_new");
ALTER TYPE "AlertTargetType" RENAME TO "AlertTargetType_old";
ALTER TYPE "AlertTargetType_new" RENAME TO "AlertTargetType";
DROP TYPE "public"."AlertTargetType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "CommentContentType_new" AS ENUM ('LISTING');
ALTER TABLE "comments" ALTER COLUMN "content_type" TYPE "CommentContentType_new" USING ("content_type"::text::"CommentContentType_new");
ALTER TABLE "content_events" ALTER COLUMN "content_type" TYPE "CommentContentType_new" USING ("content_type"::text::"CommentContentType_new");
ALTER TYPE "CommentContentType" RENAME TO "CommentContentType_old";
ALTER TYPE "CommentContentType_new" RENAME TO "CommentContentType";
DROP TYPE "public"."CommentContentType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "ConversationContentType_new" AS ENUM ('LISTING', 'TECH_MANAGER');
ALTER TABLE "conversations" ALTER COLUMN "content_type" TYPE "ConversationContentType_new" USING ("content_type"::text::"ConversationContentType_new");
ALTER TYPE "ConversationContentType" RENAME TO "ConversationContentType_old";
ALTER TYPE "ConversationContentType_new" RENAME TO "ConversationContentType";
DROP TYPE "public"."ConversationContentType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "FileOwnerScope_new" AS ENUM ('LISTING', 'CASE', 'REFUND_REQUEST', 'INVOICE', 'USER', 'USER_VERIFICATION', 'MESSAGE');
ALTER TABLE "files" ALTER COLUMN "owner_scope" TYPE "FileOwnerScope_new" USING ("owner_scope"::text::"FileOwnerScope_new");
ALTER TYPE "FileOwnerScope" RENAME TO "FileOwnerScope_old";
ALTER TYPE "FileOwnerScope_new" RENAME TO "FileOwnerScope";
DROP TYPE "public"."FileOwnerScope_old";
COMMIT;
